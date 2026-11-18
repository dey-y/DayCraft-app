import { create } from 'zustand';
import {
  TimelineEvent,
  EventRecurrenceRule,
  PendingTask,
  IdeaGroup,
  IdeaItemData,
  ChatMessage,
  AppAlert,
  SEED_EVENTS,
  SEED_PENDING,
  SEED_IDEA_GROUPS,
  SEED_CHAT,
  SEED_ALERTS,
  normalizeLegacyEvents,
  initDatabase,
  getRepository,
  savePersistedState,
} from '@/services/db/sqlite';
import {
  INITIAL_DAYS,
  DayInfo,
  createDayInfoFromDate,
  getTodayKey,
} from '@/constants/theme';
import {
  evaluateDailyRollover,
  movePendingToIdeaGroups,
} from '@/services/rollover/rolloverEngine';
import { processSmartIntake } from '@/services/ai/geminiClient';
import { createSyncEngine, SyncEngine } from '@/services/sync/syncEngine';
import type {
  DayCraftRepository,
  PersistedGeminiConfig,
  SyncState,
} from '@/types/daycraft';

export type { PersistedGeminiConfig };

export interface ToastPayload {
  id: string;
  title: string;
  description: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  undoActionLabel?: string;
  onUndoAction?: () => void;
}

export interface SlotPickerTarget {
  type: 'pending' | 'idea' | 'direct_hour' | 'edit_event';
  id?: string;
  title: string;
  desc?: string;
  eventType?: 'task' | 'reminder';
  defaultStartQ?: number;
  defaultQuarters?: number;
  recurrence?: EventRecurrenceRule;
}

interface DayCraftState {
  // Navegación y Layout
  days: DayInfo[];
  selectedDayKey: string;
  lastOpenedDate: string;
  sidebarOpen: boolean;
  bellDropdownOpen: boolean;
  desktopSideTab: 'agenda' | 'ai';

  // Configuración IA Gemini
  geminiApiKey: string;
  useCloudAI: boolean;

  // Datos de Dominio
  events: TimelineEvent[];
  pendingTasks: PendingTask[];
  ideaGroups: IdeaGroup[];
  chatMessages: ChatMessage[];
  alerts: AppAlert[];

  // Modales y Feedback Efímero (Toast)
  activeToast: ToastPayload | null;
  slotPickerTarget: SlotPickerTarget | null;
  activeIdeaId: string | null;
  activeIdeaGroupId: string | null;
  isHydrated: boolean;

  // Sincronización Local-First
  syncState: SyncState;
  triggerSync: () => Promise<void>;

  // Acciones de Calendario y Layout
  hydrateFromSQLite: () => Promise<void>;
  setSelectedDayKey: (dayKey: string) => void;
  jumpToToday: () => void;
  shiftDay: (delta: number) => void;
  extendFutureDays: (extraDays?: number) => void;
  toggleSidebar: () => void;
  setBellDropdownOpen: (open: boolean) => void;
  setDesktopSideTab: (tab: 'agenda' | 'ai') => void;
  setActiveIdeaId: (ideaId: string | null) => void;
  setActiveIdeaGroupId: (groupId: string | null) => void;

  // Configuración IA
  setGeminiConfig: (updates: Partial<PersistedGeminiConfig>) => void;

  // Toast Flotante Efímero
  showToast: (payload: Omit<ToastPayload, 'id'>) => void;
  hideToast: () => void;

  // Modal 1-Tap Time Blocking & Edición Completa
  openSlotPicker: (target: SlotPickerTarget) => void;
  closeSlotPicker: () => void;
  assignSlotFromPicker: (
    startQ: number,
    quarters?: number,
    customTitle?: string,
    recurrence?: EventRecurrenceRule,
    extra?: { desc?: string; eventType?: 'task' | 'reminder' }
  ) => void;

  // Timeline 24h (Snapping 15 min)
  addTimelineEvent: (event: Omit<TimelineEvent, 'id'>) => TimelineEvent;
  updateTimelineEvent: (
    id: string,
    updates: Partial<Omit<TimelineEvent, 'id'>>
  ) => void;
  toggleTimelineEventCompleted: (id: string) => void;
  removeTimelineEvent: (id: string, withUndoToast?: boolean) => void;

  // Pendientes & Rollover Antiestrés
  addPendingTask: (title: string) => PendingTask;
  togglePendingTask: (id: string) => void;
  removePendingTask: (id: string) => void;
  simulateAllPendingDone: () => void;
  triggerRolloverSimulation: () => void;
  convertStalePendingToIdea: (pendingId: string) => void;

  // Cajón de Ideas y Proyectos (.md)
  addIdeaGroup: (group: {
    title: string;
    subtitle: string;
    icon: IdeaGroup['icon'];
    accentColor: IdeaGroup['accentColor'];
  }) => IdeaGroup;
  addIdeaToGroup: (groupId: string, title: string, desc?: string) => void;
  updateIdeaMarkdown: (
    ideaId: string,
    updates: { title: string; desc: string; markdownContent: string }
  ) => void;
  removeIdea: (ideaId: string) => void;
  moveIdeaToGroup: (ideaId: string, targetGroupId: string) => void;
  dismissAlert: (alertId: string) => void;

  // Smart Intake Omnidireccional (Voz + Texto)
  submitSmartIntake: (
    rawText: string,
    options?: {
      isOnChatScreen?: boolean;
      onOpenSlotPicker?: (target: SlotPickerTarget) => void;
    }
  ) => Promise<void>;
}

let deterministicCounter = 0;
function nextId(prefix: string): string {
  deterministicCounter += 1;
  return `${prefix}-${Date.now()}-${deterministicCounter}`;
}

let activeRepo: DayCraftRepository | null = null;
let activeSyncEngine: SyncEngine | null = null;

function ensureSyncEngine(
  repo: DayCraftRepository,
  onStateChange: (syncState: SyncState) => void
): SyncEngine {
  if (!activeSyncEngine || activeRepo !== repo) {
    activeRepo = repo;
    activeSyncEngine = createSyncEngine({
      repository: repo,
      onStateChange,
    });
  }
  return activeSyncEngine;
}

function runRepoMutation(
  task: (repo: DayCraftRepository) => Promise<unknown>,
  onOutboxUpdated?: (count: number) => void
): void {
  const repo = activeRepo ?? getRepository();
  void task(repo)
    .then(async () => {
      if (onOutboxUpdated) {
        const outbox = await repo.listSyncOutbox();
        onOutboxUpdated(outbox.length);
      }
    })
    .catch(() => {
      // Persistence errors degrade safely without crashing UI
    });
}

export function formatQuarterToTime(q: number): string {
  const clamped = Math.max(0, Math.min(96, q));
  if (clamped === 96) return '24:00';
  const h = Math.floor(clamped / 4);
  const m = (clamped % 4) * 15;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatQuartersToDuration(quarters: number): string {
  const mins = quarters * 15;
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

/**
 * Determina si un evento (puntual o recurrente) aplica en un día específico (`DayInfo`).
 */
export function doesEventApplyToDay(event: TimelineEvent, day: DayInfo): boolean {
  if (event.dayKey === day.key || event.dayKey === day.isoDate) return true;
  if (!event.recurrence || event.recurrence.frequency === 'none') return false;

  if (event.recurrence.frequency === 'daily') {
    return true;
  }
  if (event.recurrence.frequency === 'weekly') {
    return Boolean(event.recurrence.daysOfWeek?.includes(day.dayName));
  }
  if (event.recurrence.frequency === 'monthly') {
    return event.recurrence.dayNumOfMonth === day.dayNum;
  }
  return false;
}

export const useDayCraftStore = create<DayCraftState>((set, get) => {
  const syncOutboxCount = (count: number) => {
    set((state) => ({
      syncState: {
        ...state.syncState,
        pendingCount: count,
      },
    }));
  };

  const bumpPendingSyncOptimistic = () => {
    set((state) => ({
      syncState: {
        ...state.syncState,
        pendingCount: state.syncState.pendingCount + 1,
      },
    }));
  };

  const insertIdeaIntoGroup = (
    groupId: string,
    title: string,
    desc = 'Idea capturada con IA y auto-agrupada.'
  ): IdeaItemData => {
    const state = get();
    const targetExists = state.ideaGroups.some((g) => g.id === groupId);
    const effectiveGroupId = targetExists
      ? groupId
      : state.ideaGroups[0]?.id || 'grp-sparks';

    const newIdea: IdeaItemData = {
      id: nextId('idea'),
      groupId: effectiveGroupId,
      title,
      desc,
      markdownContent: `# ${title}\n\n${desc}\n\n## Pasos Siguientes\n- [ ] Definir primer bloque de enfoque en el Timeline 24h\n- [ ] Anotar recursos y referencias\n`,
      createdAtLabel: 'Ahora',
      daysInactive: 0,
      suggestedAction: `Explorar: ${title}`,
      updatedAt: new Date().toISOString(),
    };

    set((s) => {
      const updated = s.ideaGroups.map((g) =>
        g.id === effectiveGroupId ? { ...g, items: [newIdea, ...g.items] } : g
      );
      return { ideaGroups: updated };
    });

    bumpPendingSyncOptimistic();
    runRepoMutation(
      async (repo) => {
        await repo.upsertIdea(newIdea, { enqueueSync: true });
      },
      syncOutboxCount
    );

    return newIdea;
  };

  return {
    days: INITIAL_DAYS,
    selectedDayKey: getTodayKey(),
    lastOpenedDate: getTodayKey(),
    sidebarOpen: true,
    bellDropdownOpen: false,
    desktopSideTab: 'agenda',

    geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || '',
    useCloudAI: Boolean(process.env.EXPO_PUBLIC_GEMINI_API_KEY),

    events: SEED_EVENTS,
    pendingTasks: SEED_PENDING,
    ideaGroups: SEED_IDEA_GROUPS,
    chatMessages: SEED_CHAT,
    alerts: SEED_ALERTS,

    activeToast: null,
    slotPickerTarget: null,
    activeIdeaId: null,
    activeIdeaGroupId: null,
    isHydrated: false,

    syncState: {
      status: 'offline',
      pendingCount: 0,
      lastSyncedAt: null,
      lastError: null,
    },

    triggerSync: async () => {
      const repo = activeRepo ?? (await initDatabase());
      const engine = ensureSyncEngine(repo, (nextSyncState) => {
        set({ syncState: nextSyncState });
      });
      const nextState = await engine.syncNow();
      set({ syncState: nextState });
    },

    hydrateFromSQLite: async () => {
      const repo = await initDatabase();
      const todayKey = getTodayKey();

      const engine = ensureSyncEngine(repo, (nextSyncState) => {
        set({ syncState: nextSyncState });
      });

      await repo.seedIfNeeded({
        events: SEED_EVENTS,
        pendingTasks: SEED_PENDING,
        ideaGroups: SEED_IDEA_GROUPS,
        chatMessages: SEED_CHAT,
        alerts: SEED_ALERTS,
        lastOpenedDate: todayKey,
      });

      const snapshot = await repo.getSnapshot();
      const normalizedEvents = normalizeLegacyEvents(snapshot.events);

      let finalPending = snapshot.pendingTasks;
      let finalIdeaGroups = snapshot.ideaGroups;
      let finalAlerts = snapshot.alerts;

      // Motor Automático de Rollover Diario multi-día + Ideas inactivas 10d
      if (snapshot.lastOpenedDate && snapshot.lastOpenedDate !== todayKey) {
        const rolloverResult = evaluateDailyRollover(finalPending, {
          lastOpenedDate: snapshot.lastOpenedDate,
          todayKey,
          ideaGroups: finalIdeaGroups,
          existingAlerts: finalAlerts,
        });
        finalPending = rolloverResult.updatedTasks;
        finalIdeaGroups = rolloverResult.updatedIdeaGroups ?? finalIdeaGroups;
        finalAlerts =
          rolloverResult.mergedAlerts ?? [
            ...rolloverResult.generatedAlerts,
            ...finalAlerts.filter((a) => a.type === 'inactive_idea'),
          ];

        await Promise.all([
          repo.replaceAllPendingTasks(finalPending, { enqueueSync: false }),
          repo.replaceAllIdeaGroups(finalIdeaGroups, { enqueueSync: false }),
          repo.replaceAllAlerts(finalAlerts, { enqueueSync: false }),
        ]);
      } else {
        // Evaluar ideas inactivas >= 10d sin duplicar alertas existentes
        const staleEval = evaluateDailyRollover(finalPending, {
          elapsedDays: 0,
          todayKey,
          ideaGroups: finalIdeaGroups,
          existingAlerts: finalAlerts,
        });
        if (
          staleEval.mergedAlerts &&
          staleEval.mergedAlerts.length !== finalAlerts.length
        ) {
          finalAlerts = staleEval.mergedAlerts;
          await repo.replaceAllAlerts(finalAlerts, { enqueueSync: false });
        }
      }

      await repo.setMeta('last_opened_date_v9', todayKey);

      const hasLegacyShortKeys = snapshot.events.some((e) => e.dayKey.length <= 2);
      if (hasLegacyShortKeys) {
        await repo.replaceAllEvents(normalizedEvents, { enqueueSync: false });
      }

      const envKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
      const hydratedKey = snapshot.geminiConfig?.apiKey ?? envKey;
      const hydratedUseCloud =
        snapshot.geminiConfig?.useCloudAI !== undefined
          ? snapshot.geminiConfig.useCloudAI
          : Boolean(hydratedKey);

      const syncSnapshot = await engine.refreshPendingCount();

      set({
        selectedDayKey: todayKey,
        lastOpenedDate: todayKey,
        events: normalizedEvents,
        pendingTasks: finalPending,
        ideaGroups: finalIdeaGroups,
        chatMessages: snapshot.chatMessages,
        alerts: finalAlerts,
        geminiApiKey: hydratedKey,
        useCloudAI: hydratedUseCloud,
        syncState: syncSnapshot,
        isHydrated: true,
      });
    },

    setSelectedDayKey: (dayKey) => set({ selectedDayKey: dayKey }),

    jumpToToday: () => {
      const todayKey = getTodayKey();
      set({ selectedDayKey: todayKey });
    },

    shiftDay: (delta) => {
      const { days, selectedDayKey } = get();
      const idx = days.findIndex((d) => d.key === selectedDayKey);
      if (idx === -1) return;
      if (idx + delta >= days.length - 5) {
        get().extendFutureDays(30);
      }
      const updatedDays = get().days;
      const nextIdx = Math.max(0, Math.min(updatedDays.length - 1, idx + delta));
      set({ selectedDayKey: updatedDays[nextIdx].key });
    },

    extendFutureDays: (extraDays = 30) => {
      const { days } = get();
      if (days.length === 0) return;
      const lastDay = days[days.length - 1];
      const [y, m, d] = lastDay.isoDate.split('-').map(Number);
      const additional: DayInfo[] = [];
      const now = new Date();
      for (let i = 1; i <= extraDays; i++) {
        const nextDate = new Date(y, m - 1, d + i, 12, 0, 0);
        additional.push(createDayInfoFromDate(nextDate, now));
      }
      set({ days: [...days, ...additional] });
    },

    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setBellDropdownOpen: (open) => set({ bellDropdownOpen: open }),
    setDesktopSideTab: (tab) => set({ desktopSideTab: tab }),
    setActiveIdeaId: (ideaId) => set({ activeIdeaId: ideaId }),
    setActiveIdeaGroupId: (groupId) => set({ activeIdeaGroupId: groupId }),

    setGeminiConfig: (updates) => {
      set((state) => {
        const nextKey =
          updates.apiKey !== undefined ? updates.apiKey : state.geminiApiKey;
        const nextUseCloud =
          updates.useCloudAI !== undefined
            ? updates.useCloudAI
            : state.useCloudAI;
        const config: PersistedGeminiConfig = {
          apiKey: nextKey,
          useCloudAI: nextUseCloud,
        };
        void savePersistedState('gemini_config_v9', config);
        return {
          geminiApiKey: nextKey,
          useCloudAI: nextUseCloud,
        };
      });
    },

    showToast: (payload) => {
      set({
        activeToast: {
          ...payload,
          id: nextId('toast'),
        },
      });
    },

    hideToast: () => set({ activeToast: null }),

    openSlotPicker: (target) => set({ slotPickerTarget: target }),
    closeSlotPicker: () => set({ slotPickerTarget: null }),

    assignSlotFromPicker: (startQ, quarters = 2, customTitle, recurrence, extra) => {
      const { slotPickerTarget, selectedDayKey, pendingTasks } = get();
      const title =
        customTitle?.trim() || slotPickerTarget?.title || 'Bloque enfocado';
      const dayKey = selectedDayKey || getTodayKey();

      if (slotPickerTarget?.type === 'edit_event' && slotPickerTarget.id) {
        const targetId = slotPickerTarget.id;
        const prevEvent = get().events.find((e) => e.id === targetId);
        const nextType =
          extra?.eventType ||
          slotPickerTarget.eventType ||
          prevEvent?.type ||
          'task';
        const nextDesc =
          extra?.desc !== undefined
            ? extra.desc
            : slotPickerTarget.desc !== undefined
            ? slotPickerTarget.desc
            : prevEvent?.desc;

        get().updateTimelineEvent(targetId, {
          title,
          desc: nextDesc,
          startQ,
          quarters,
          type: nextType,
          recurrence:
            recurrence && recurrence.frequency !== 'none'
              ? recurrence
              : undefined,
        });

        set({ slotPickerTarget: null });
        return;
      }

      const nextType = extra?.eventType || slotPickerTarget?.eventType || 'task';
      const nextDesc =
        extra?.desc !== undefined && extra.desc.trim().length > 0
          ? extra.desc.trim()
          : slotPickerTarget?.type === 'pending'
          ? 'Fijado desde Pendientes de hoy'
          : slotPickerTarget?.type === 'idea'
          ? 'Paso agendado desde Cajón de Ideas'
          : nextType === 'reminder'
          ? 'Recordatorio puntual en Timeline'
          : 'Bloque enfocado en Timeline';

      const createdEvent = get().addTimelineEvent({
        dayKey,
        title,
        desc: nextDesc,
        startQ,
        quarters,
        type: nextType,
        tag:
          slotPickerTarget?.type === 'idea'
            ? 'Idea en acción'
            : nextType === 'reminder'
            ? 'Recordatorio'
            : 'Enfoque',
        recurrence:
          recurrence && recurrence.frequency !== 'none' ? recurrence : undefined,
      });

      let removedPending: PendingTask | undefined;
      if (slotPickerTarget?.type === 'pending' && slotPickerTarget.id) {
        removedPending = pendingTasks.find((p) => p.id === slotPickerTarget.id);
        get().removePendingTask(slotPickerTarget.id);
      }

      set({ slotPickerTarget: null });

      const startTimeStr = formatQuarterToTime(startQ);
      get().showToast({
        title: 'Fijado en Timeline 24h',
        description: `"${title}" a las ${startTimeStr}`,
        undoActionLabel: 'Deshacer',
        onUndoAction: () => {
          get().removeTimelineEvent(createdEvent.id, false);
          if (removedPending) {
            const restoredTask = removedPending;
            set((s) => ({
              pendingTasks: [restoredTask, ...s.pendingTasks],
            }));
            runRepoMutation(
              (repo) => repo.upsertPendingTask(restoredTask, { enqueueSync: true }),
              syncOutboxCount
            );
          }
        },
      });
    },

    addTimelineEvent: (eventData) => {
      const newEvent: TimelineEvent = {
        ...eventData,
        id: nextId('ev'),
        updatedAt: new Date().toISOString(),
      };
      set((state) => ({
        events: [...state.events, newEvent].sort((a, b) => a.startQ - b.startQ),
      }));
      bumpPendingSyncOptimistic();
      runRepoMutation(
        (repo) => repo.upsertEvent(newEvent, { enqueueSync: true }).then(() => undefined),
        syncOutboxCount
      );
      return newEvent;
    },

    updateTimelineEvent: (id, updates) => {
      const prevEvent = get().events.find((e) => e.id === id);
      if (!prevEvent) return;

      const updatedEvent: TimelineEvent = {
        ...prevEvent,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      set((state) => ({
        events: state.events
          .map((e) => (e.id === id ? updatedEvent : e))
          .sort((a, b) => a.startQ - b.startQ),
      }));
      bumpPendingSyncOptimistic();
      runRepoMutation(
        (repo) => repo.upsertEvent(updatedEvent, { enqueueSync: true }).then(() => undefined),
        syncOutboxCount
      );

      const nextTitle = updates.title || prevEvent.title;
      const nextStartQ =
        updates.startQ !== undefined ? updates.startQ : prevEvent.startQ;
      get().showToast({
        title: 'Bloque actualizado',
        description: `"${nextTitle}" (${formatQuarterToTime(nextStartQ)})`,
        undoActionLabel: 'Deshacer',
        onUndoAction: () => {
          set((state) => ({
            events: state.events
              .map((e) => (e.id === id ? prevEvent : e))
              .sort((a, b) => a.startQ - b.startQ),
          }));
          runRepoMutation(
            (repo) => repo.upsertEvent(prevEvent, { enqueueSync: true }).then(() => undefined),
            syncOutboxCount
          );
        },
      });
    },

    toggleTimelineEventCompleted: (id) => {
      const ev = get().events.find((e) => e.id === id);
      if (!ev) return;
      const nextCompleted = !ev.completed;
      const updatedEvent: TimelineEvent = {
        ...ev,
        completed: nextCompleted,
        updatedAt: new Date().toISOString(),
      };

      set((state) => ({
        events: state.events.map((e) => (e.id === id ? updatedEvent : e)),
      }));
      bumpPendingSyncOptimistic();
      runRepoMutation(
        (repo) => repo.upsertEvent(updatedEvent, { enqueueSync: true }).then(() => undefined),
        syncOutboxCount
      );

      if (nextCompleted) {
        get().showToast({
          title: 'Bloque completado',
          description: `"${ev.title}"`,
          undoActionLabel: 'Deshacer',
          onUndoAction: () => {
            const reverted: TimelineEvent = {
              ...updatedEvent,
              completed: false,
              updatedAt: new Date().toISOString(),
            };
            set((state) => ({
              events: state.events.map((e) => (e.id === id ? reverted : e)),
            }));
            runRepoMutation(
              (repo) => repo.upsertEvent(reverted, { enqueueSync: true }).then(() => undefined),
              syncOutboxCount
            );
          },
        });
      }
    },

    removeTimelineEvent: (id, withUndoToast = true) => {
      const target = get().events.find((e) => e.id === id);
      set((state) => ({
        events: state.events.filter((e) => e.id !== id),
      }));
      bumpPendingSyncOptimistic();
      runRepoMutation(
        (repo) => repo.deleteEvent(id, { enqueueSync: true }),
        syncOutboxCount
      );

      if (withUndoToast && target) {
        get().showToast({
          title: 'Bloque eliminado',
          description: `"${target.title}"`,
          undoActionLabel: 'Deshacer',
          onUndoAction: () => {
            const restored: TimelineEvent = {
              ...target,
              deletedAt: null,
              updatedAt: new Date().toISOString(),
            };
            set((state) => ({
              events: [...state.events, restored].sort(
                (a, b) => a.startQ - b.startQ
              ),
            }));
            runRepoMutation(
              (repo) => repo.upsertEvent(restored, { enqueueSync: true }).then(() => undefined),
              syncOutboxCount
            );
          },
        });
      }
    },

    addPendingTask: (title) => {
      const newTask: PendingTask = {
        id: nextId('pending'),
        title,
        completed: false,
        isFromYesterday: false,
        rolloverDays: 0,
        createdAt: 'Hoy',
        updatedAt: new Date().toISOString(),
      };
      set((state) => ({
        pendingTasks: [newTask, ...state.pendingTasks],
      }));
      bumpPendingSyncOptimistic();
      runRepoMutation(
        (repo) => repo.upsertPendingTask(newTask, { enqueueSync: true }).then(() => undefined),
        syncOutboxCount
      );
      return newTask;
    },

    togglePendingTask: (id) => {
      const task = get().pendingTasks.find((t) => t.id === id);
      if (!task) return;
      const nextCompleted = !task.completed;
      const updatedTask: PendingTask = {
        ...task,
        completed: nextCompleted,
        updatedAt: new Date().toISOString(),
      };

      set((state) => ({
        pendingTasks: state.pendingTasks.map((t) =>
          t.id === id ? updatedTask : t
        ),
      }));
      bumpPendingSyncOptimistic();
      runRepoMutation(
        (repo) => repo.upsertPendingTask(updatedTask, { enqueueSync: true }).then(() => undefined),
        syncOutboxCount
      );

      if (nextCompleted) {
        get().showToast({
          title: 'Pendiente completado',
          description: `"${task.title}"`,
          undoActionLabel: 'Deshacer',
          onUndoAction: () => {
            const reverted: PendingTask = {
              ...updatedTask,
              completed: false,
              updatedAt: new Date().toISOString(),
            };
            set((state) => ({
              pendingTasks: state.pendingTasks.map((t) =>
                t.id === id ? reverted : t
              ),
            }));
            runRepoMutation(
              (repo) => repo.upsertPendingTask(reverted, { enqueueSync: true }).then(() => undefined),
              syncOutboxCount
            );
          },
        });
      }
    },

    removePendingTask: (id) => {
      set((state) => ({
        pendingTasks: state.pendingTasks.filter((t) => t.id !== id),
      }));
      bumpPendingSyncOptimistic();
      runRepoMutation(
        (repo) => repo.deletePendingTask(id, { enqueueSync: true }),
        syncOutboxCount
      );
    },

    simulateAllPendingDone: () => {
      const { pendingTasks } = get();
      const allCompleted =
        pendingTasks.length > 0 && pendingTasks.every((t) => t.completed);
      const updated = pendingTasks.map((t) => ({
        ...t,
        completed: !allCompleted,
        updatedAt: new Date().toISOString(),
      }));
      set({ pendingTasks: updated });
      runRepoMutation(
        (repo) => repo.replaceAllPendingTasks(updated, { enqueueSync: true }),
        syncOutboxCount
      );
    },

    triggerRolloverSimulation: () => {
      const { pendingTasks, alerts, ideaGroups } = get();
      const result = evaluateDailyRollover(pendingTasks, {
        elapsedDays: 1,
        todayKey: getTodayKey(),
        ideaGroups,
        existingAlerts: alerts,
      });
      const nextAlerts =
        result.mergedAlerts ?? [
          ...result.generatedAlerts,
          ...alerts.filter((a) => a.type === 'inactive_idea'),
        ];
      set({
        pendingTasks: result.updatedTasks,
        alerts: nextAlerts,
      });
      runRepoMutation(async (repo) => {
        await repo.replaceAllPendingTasks(result.updatedTasks, { enqueueSync: false });
        await repo.replaceAllAlerts(nextAlerts, { enqueueSync: false });
      });
    },

    convertStalePendingToIdea: (pendingId) => {
      const { pendingTasks, ideaGroups, alerts } = get();
      const target = pendingTasks.find((t) => t.id === pendingId);
      if (!target) return;

      const updatedGroups = movePendingToIdeaGroups(target, ideaGroups);
      const updatedPending = pendingTasks.filter((t) => t.id !== pendingId);
      const updatedAlerts = alerts.filter((a) => a.relatedId !== pendingId);

      set({
        ideaGroups: updatedGroups,
        pendingTasks: updatedPending,
        alerts: updatedAlerts,
      });

      runRepoMutation(async (repo) => {
        await repo.deletePendingTask(pendingId, { enqueueSync: true });
        await repo.replaceAllIdeaGroups(updatedGroups, { enqueueSync: false });
        await repo.replaceAllAlerts(updatedAlerts, { enqueueSync: false });
      }, syncOutboxCount);

      get().showToast({
        title: 'Movido al Cajón de Ideas',
        description: `"${target.title}" libre de presión`,
      });
    },

    addIdeaGroup: ({ title, subtitle, icon, accentColor }) => {
      const newGroup: IdeaGroup = {
        id: nextId('grp'),
        title: title.trim() || 'Nuevo Proyecto',
        subtitle: subtitle.trim() || 'Notas y recursos del proyecto',
        icon,
        accentColor,
        items: [],
        updatedAt: new Date().toISOString(),
      };
      set((state) => ({
        ideaGroups: [newGroup, ...state.ideaGroups],
      }));
      bumpPendingSyncOptimistic();
      runRepoMutation(
        (repo) => repo.upsertIdeaGroup(newGroup, { enqueueSync: true }).then(() => undefined),
        syncOutboxCount
      );
      get().showToast({
        title: 'Proyecto creado',
        description: `"${newGroup.title}" listo en el Cajón de Ideas`,
      });
      return newGroup;
    },

    addIdeaToGroup: (groupId, title, desc = 'Idea capturada con IA y auto-agrupada.') => {
      insertIdeaIntoGroup(groupId, title, desc);
    },

    updateIdeaMarkdown: (ideaId, updates) => {
      let updatedIdea: IdeaItemData | null = null;
      set((state) => {
        const updatedGroups = state.ideaGroups.map((group) => ({
          ...group,
          items: group.items.map((item) => {
            if (item.id === ideaId) {
              updatedIdea = {
                ...item,
                title: updates.title,
                desc: updates.desc,
                markdownContent: updates.markdownContent,
                createdAtLabel: 'Editado ahora',
                updatedAt: new Date().toISOString(),
              };
              return updatedIdea;
            }
            return item;
          }),
        }));
        return { ideaGroups: updatedGroups };
      });
      if (updatedIdea) {
        const toSave = updatedIdea;
        bumpPendingSyncOptimistic();
        runRepoMutation(
          (repo) => repo.upsertIdea(toSave, { enqueueSync: true }).then(() => undefined),
          syncOutboxCount
        );
      }
      get().showToast({
        title: 'Nota .md guardada',
        description: `"${updates.title}" actualizada en SQLite`,
      });
    },

    removeIdea: (ideaId) => {
      const { ideaGroups } = get();
      let removedIdea: IdeaItemData | null = null;
      let sourceGroupId: string | null = null;

      for (const grp of ideaGroups) {
        const found = grp.items.find((it) => it.id === ideaId);
        if (found) {
          removedIdea = found;
          sourceGroupId = grp.id;
          break;
        }
      }

      if (!removedIdea || !sourceGroupId) return;

      set((state) => ({
        ideaGroups: state.ideaGroups.map((g) =>
          g.id === sourceGroupId
            ? { ...g, items: g.items.filter((it) => it.id !== ideaId) }
            : g
        ),
        activeIdeaId: state.activeIdeaId === ideaId ? null : state.activeIdeaId,
      }));

      bumpPendingSyncOptimistic();
      runRepoMutation(
        (repo) => repo.deleteIdea(ideaId, { enqueueSync: true }),
        syncOutboxCount
      );

      const backupIdea = removedIdea;
      const backupGroupId = sourceGroupId;
      get().showToast({
        title: 'Nota .md eliminada',
        description: `"${backupIdea.title}"`,
        undoActionLabel: 'Deshacer',
        onUndoAction: () => {
          const restored: IdeaItemData = {
            ...backupIdea,
            deletedAt: null,
            updatedAt: new Date().toISOString(),
          };
          set((state) => ({
            ideaGroups: state.ideaGroups.map((g) =>
              g.id === backupGroupId ? { ...g, items: [restored, ...g.items] } : g
            ),
          }));
          runRepoMutation(
            (repo) => repo.upsertIdea(restored, { enqueueSync: true }).then(() => undefined),
            syncOutboxCount
          );
        },
      });
    },

    moveIdeaToGroup: (ideaId, targetGroupId) => {
      const { ideaGroups } = get();
      let ideaToMove: IdeaItemData | null = null;
      let currentGroupId: string | null = null;

      for (const grp of ideaGroups) {
        const found = grp.items.find((it) => it.id === ideaId);
        if (found) {
          ideaToMove = found;
          currentGroupId = grp.id;
          break;
        }
      }

      if (!ideaToMove || !currentGroupId || currentGroupId === targetGroupId) return;
      const targetGroup = ideaGroups.find((g) => g.id === targetGroupId);
      if (!targetGroup) return;

      const updatedIdea: IdeaItemData = {
        ...ideaToMove,
        groupId: targetGroupId,
        updatedAt: new Date().toISOString(),
      };

      set((state) => ({
        ideaGroups: state.ideaGroups.map((g) => {
          if (g.id === currentGroupId) {
            return { ...g, items: g.items.filter((it) => it.id !== ideaId) };
          }
          if (g.id === targetGroupId) {
            return { ...g, items: [updatedIdea, ...g.items] };
          }
          return g;
        }),
      }));

      bumpPendingSyncOptimistic();
      runRepoMutation(
        (repo) => repo.upsertIdea(updatedIdea, { enqueueSync: true }).then(() => undefined),
        syncOutboxCount
      );

      get().showToast({
        title: 'Idea movida de proyecto',
        description: `Ahora en "${targetGroup.title}"`,
      });
    },

    dismissAlert: (alertId) => {
      set((state) => ({
        alerts: state.alerts.filter((a) => a.id !== alertId),
      }));
      bumpPendingSyncOptimistic();
      runRepoMutation(
        (repo) => repo.deleteAlert(alertId, { enqueueSync: true }),
        syncOutboxCount
      );
    },

    submitSmartIntake: async (rawText, options) => {
      const trimmed = rawText.trim();
      if (!trimmed) return;

      const {
        selectedDayKey,
        geminiApiKey,
        useCloudAI,
        ideaGroups,
        events,
        pendingTasks,
      } = get();

      const nowTime = new Date().toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const userMsg: ChatMessage = {
        id: nextId('msg-u'),
        role: 'user',
        text: trimmed,
        timestamp: nowTime,
      };

      set((state) => ({
        chatMessages: [...state.chatMessages, userMsg],
      }));
      runRepoMutation((repo) =>
        repo.upsertChatMessage(userMsg, { enqueueSync: false }).then(() => undefined)
      );

      const batch = await processSmartIntake(trimmed, selectedDayKey, {
        apiKey: geminiApiKey,
        useCloudAI,
        ideaGroups,
        existingEvents: events,
        existingPending: pendingTasks,
      });

      const classifiedBadges: NonNullable<ChatMessage['classifiedItems']> = [];
      let singleToastPayload: Omit<ToastPayload, 'id'> | null = null;

      for (const parsed of batch.items) {
        if (parsed.kind === 'pending') {
          const createdTask = get().addPendingTask(parsed.title);
          classifiedBadges.push({
            type: 'pending',
            title: parsed.title,
            meta: 'Para hoy (Sin hora fija)',
          });

          if (batch.items.length === 1) {
            singleToastPayload = {
              title: 'Añadido a Pendientes',
              description: `"${parsed.title}"`,
              primaryActionLabel: 'Fijar hora',
              onPrimaryAction: () => {
                const target: SlotPickerTarget = {
                  type: 'pending',
                  id: createdTask.id,
                  title: createdTask.title,
                };
                if (options?.onOpenSlotPicker) {
                  options.onOpenSlotPicker(target);
                } else {
                  get().openSlotPicker(target);
                }
              },
              undoActionLabel: 'Deshacer',
              onUndoAction: () => {
                get().removePendingTask(createdTask.id);
              },
            };
          }
        } else if (parsed.kind === 'event' || parsed.kind === 'reminder') {
          const startQ = parsed.startQ ?? 48;
          const quarters = parsed.quarters ?? 2;
          const dayKey = parsed.dayKey || selectedDayKey;
          const createdEv = get().addTimelineEvent({
            dayKey,
            title: parsed.title,
            desc: parsed.desc,
            startQ,
            quarters,
            type: parsed.kind === 'reminder' ? 'reminder' : 'task',
            tag: parsed.kind === 'reminder' ? 'Recordatorio' : 'IA Smart Intake',
          });

          const matchedDay = get().days.find((d) => d.key === dayKey);
          const dayLabel = matchedDay
            ? matchedDay.isToday
              ? 'Hoy'
              : `${matchedDay.dayName} ${matchedDay.dayNum}`
            : dayKey;

          const timeLabel = formatQuarterToTime(startQ);
          classifiedBadges.push({
            type: parsed.kind,
            title: parsed.title,
            meta: `${dayLabel} · ${timeLabel}`,
          });

          if (batch.items.length === 1) {
            singleToastPayload = {
              title:
                parsed.kind === 'reminder'
                  ? 'Recordatorio Fijado'
                  : 'Agendado en Timeline',
              description: `"${parsed.title}" (${dayLabel} · ${timeLabel})`,
              undoActionLabel: 'Deshacer',
              onUndoAction: () => {
                get().removeTimelineEvent(createdEv.id, false);
              },
            };
          }
        } else if (parsed.kind === 'idea') {
          const groupId = parsed.ideaGroupId || 'grp-sparks';
          const createdIdea = insertIdeaIntoGroup(groupId, parsed.title, parsed.desc);
          const targetGroup = get().ideaGroups.find(
            (g) => g.id === createdIdea.groupId
          );
          classifiedBadges.push({
            type: 'idea',
            title: parsed.title,
            meta: targetGroup ? targetGroup.title : 'Cajón de Ideas (Auto-IA)',
          });

          if (batch.items.length === 1) {
            singleToastPayload = {
              title: 'Guardado en Cajón de Ideas',
              description: `"${parsed.title}"`,
              primaryActionLabel: 'Fijar hora',
              onPrimaryAction: () => {
                const target: SlotPickerTarget = {
                  type: 'idea',
                  id: createdIdea.id,
                  title: parsed.title,
                };
                if (options?.onOpenSlotPicker) {
                  options.onOpenSlotPicker(target);
                } else {
                  get().openSlotPicker(target);
                }
              },
            };
          }
        } else if (parsed.kind === 'question') {
          set({ desktopSideTab: 'ai' });
          if (batch.items.length === 1) {
            singleToastPayload = {
              title: 'Asistente IA Gemini',
              description: batch.aiReply,
            };
          }
        }
      }

      if (!options?.isOnChatScreen) {
        if (singleToastPayload) {
          get().showToast(singleToastPayload);
        } else if (batch.items.length > 1) {
          get().showToast({
            title: 'Organizado con Smart Intake',
            description: batch.aiReply,
          });
        }
      }

      const aiMsg: ChatMessage = {
        id: nextId('msg-a'),
        role: 'assistant',
        text: batch.aiReply,
        timestamp: nowTime,
        classifiedItems: classifiedBadges.length > 0 ? classifiedBadges : undefined,
      };

      set((state) => ({
        chatMessages: [...state.chatMessages, aiMsg],
      }));
      runRepoMutation((repo) =>
        repo.upsertChatMessage(aiMsg, { enqueueSync: false }).then(() => undefined)
      );
    },
  };
});
