/**
 * DayCraft AI — Local-First Sync Engine
 * Runtime-agnostic synchronization over `DayCraftRepository` + `SyncTransport`.
 * Zero `react-native` or `expo-*` imports.
 */

import type {
  AppAlert,
  ChatMessage,
  DayCraftRepository,
  IdeaGroup,
  PendingTask,
  SyncEntityMetadata,
  SyncEntityType,
  SyncOutboxEntry,
  SyncState,
  TimelineEvent,
} from '@/types/daycraft';

export interface SyncPushConflict {
  entityType: SyncEntityType;
  entityId: string;
  remote: Record<string, unknown>;
}

export interface SyncPushResult {
  acceptedIds: string[];
  serverEvents?: TimelineEvent[];
  conflicts?: SyncPushConflict[];
}

export interface SyncPullResult {
  events?: TimelineEvent[];
  pendingTasks?: PendingTask[];
  ideaGroups?: IdeaGroup[];
  chatMessages?: ChatMessage[];
  alerts?: AppAlert[];
  cursor?: string;
}

export interface SyncTransport {
  push(entries: SyncOutboxEntry[]): Promise<SyncPushResult>;
  pull(cursor?: string | null): Promise<SyncPullResult>;
}

export interface SyncEngineOptions {
  repository: DayCraftRepository;
  transport?: SyncTransport | null;
  onStateChange?: (state: SyncState) => void;
}

/**
 * Resuelve conflictos entre una versión local y una remota.
 * Regla: si las versiones difieren explícitamente, gana la mayor `version`;
 * en caso de empate o ausencia de versión, gana el `updatedAt` más reciente.
 */
export function resolveSyncConflict<T extends SyncEntityMetadata>(
  local: T,
  remote: T
): T {
  const hasLocalVer = typeof local.version === 'number';
  const hasRemoteVer = typeof remote.version === 'number';
  if (hasLocalVer && hasRemoteVer && local.version !== remote.version) {
    return (remote.version as number) > (local.version as number) ? remote : local;
  }

  const localTs = local.updatedAt ? Date.parse(local.updatedAt) : NaN;
  const remoteTs = remote.updatedAt ? Date.parse(remote.updatedAt) : NaN;

  const hasLocalTs = Number.isFinite(localTs);
  const hasRemoteTs = Number.isFinite(remoteTs);

  if (hasLocalTs && hasRemoteTs) {
    if (remoteTs > localTs) return remote;
    if (localTs > remoteTs) return local;
  } else if (hasRemoteTs && !hasLocalTs) {
    return remote;
  } else if (hasLocalTs && !hasRemoteTs) {
    return local;
  }

  const localVer = local.version ?? 0;
  const remoteVer = remote.version ?? 0;
  return remoteVer >= localVer ? remote : local;
}

export class SyncEngine {
  private readonly repository: DayCraftRepository;
  private transport: SyncTransport | null;
  private readonly listeners = new Set<(state: SyncState) => void>();
  private state: SyncState = {
    status: 'offline',
    pendingCount: 0,
    lastSyncedAt: null,
    lastError: null,
  };

  constructor(options: SyncEngineOptions) {
    this.repository = options.repository;
    this.transport = options.transport ?? null;
    if (options.onStateChange) {
      this.listeners.add(options.onStateChange);
    }
  }

  getState(): SyncState {
    return { ...this.state };
  }

  setTransport(transport: SyncTransport | null): void {
    this.transport = transport;
    if (!transport) {
      this.updateState({ status: 'offline' });
    }
  }

  subscribe(listener: (state: SyncState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateState(patch: Partial<SyncState>): SyncState {
    this.state = {
      ...this.state,
      ...patch,
    };
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
    return snapshot;
  }

  async refreshPendingCount(): Promise<SyncState> {
    const outbox = await this.repository.listSyncOutbox();
    return this.updateState({ pendingCount: outbox.length });
  }

  async syncNow(): Promise<SyncState> {
    const outbox = await this.repository.listSyncOutbox();

    if (!this.transport) {
      return this.updateState({
        status: 'offline',
        pendingCount: outbox.length,
        lastError: null,
      });
    }

    this.updateState({
      status: 'syncing',
      pendingCount: outbox.length,
      lastError: null,
    });

    try {
      // 1. Push outbox entries
      if (outbox.length > 0) {
        const pushResult = await this.transport.push(outbox);
        const accepted = new Set(pushResult.acceptedIds || []);

        for (const entry of outbox) {
          if (accepted.has(entry.id)) {
            await this.repository.removeSyncOutboxEntry(entry.id);
          } else {
            await this.repository.incrementSyncOutboxAttempts(entry.id);
          }
        }

        if (pushResult.serverEvents && pushResult.serverEvents.length > 0) {
          await this.reconcileEvents(pushResult.serverEvents);
        }
      }

      // 2. Pull remote delta
      const cursor = await this.repository.getMeta('sync_cursor');
      const pullResult = await this.transport.pull(cursor);

      if (pullResult.events && pullResult.events.length > 0) {
        await this.reconcileEvents(pullResult.events);
      }
      if (pullResult.pendingTasks && pullResult.pendingTasks.length > 0) {
        await this.reconcilePendingTasks(pullResult.pendingTasks);
      }
      if (pullResult.ideaGroups && pullResult.ideaGroups.length > 0) {
        await this.reconcileIdeaGroups(pullResult.ideaGroups);
      }
      if (pullResult.chatMessages && pullResult.chatMessages.length > 0) {
        for (const msg of pullResult.chatMessages) {
          await this.repository.upsertChatMessage(
            { ...msg, syncStatus: 'synced' },
            { enqueueSync: false }
          );
        }
      }
      if (pullResult.alerts && pullResult.alerts.length > 0) {
        for (const alert of pullResult.alerts) {
          await this.repository.upsertAlert(
            { ...alert, syncStatus: 'synced' },
            { enqueueSync: false }
          );
        }
      }
      if (pullResult.cursor) {
        await this.repository.setMeta('sync_cursor', pullResult.cursor);
      }

      const remaining = await this.repository.listSyncOutbox();
      return this.updateState({
        status: 'synced',
        pendingCount: remaining.length,
        lastSyncedAt: new Date().toISOString(),
        lastError: null,
      });
    } catch (err) {
      const remaining = await this.repository.listSyncOutbox();
      const message =
        err instanceof Error ? err.message : 'Error de sincronización';
      return this.updateState({
        status: 'error',
        pendingCount: remaining.length,
        lastError: message,
      });
    }
  }

  private async reconcileEvents(remoteEvents: TimelineEvent[]): Promise<void> {
    for (const remote of remoteEvents) {
      const local = await this.repository.getEventById(remote.id);
      if (!local) {
        await this.repository.upsertEvent(
          { ...remote, syncStatus: 'synced' },
          { enqueueSync: false }
        );
      } else {
        const winner = resolveSyncConflict(local, remote);
        if (winner === remote) {
          await this.repository.upsertEvent(
            { ...remote, syncStatus: 'synced' },
            { enqueueSync: false }
          );
        }
      }
    }
  }

  private async reconcilePendingTasks(remoteTasks: PendingTask[]): Promise<void> {
    for (const remote of remoteTasks) {
      const local = await this.repository.getPendingTaskById(remote.id);
      if (!local) {
        await this.repository.upsertPendingTask(
          { ...remote, syncStatus: 'synced' },
          { enqueueSync: false }
        );
      } else {
        const winner = resolveSyncConflict(local, remote);
        if (winner === remote) {
          await this.repository.upsertPendingTask(
            { ...remote, syncStatus: 'synced' },
            { enqueueSync: false }
          );
        }
      }
    }
  }

  private async reconcileIdeaGroups(remoteGroups: IdeaGroup[]): Promise<void> {
    for (const remote of remoteGroups) {
      const local = await this.repository.getIdeaGroupById(remote.id);
      if (!local) {
        await this.repository.upsertIdeaGroup(
          { ...remote, syncStatus: 'synced' },
          { enqueueSync: false }
        );
      } else {
        const winner = resolveSyncConflict(local, remote);
        if (winner === remote) {
          await this.repository.upsertIdeaGroup(
            { ...remote, syncStatus: 'synced' },
            { enqueueSync: false }
          );
        }
      }
    }
  }
}

export function createSyncEngine(options: SyncEngineOptions): SyncEngine {
  return new SyncEngine(options);
}
