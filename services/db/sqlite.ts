/**
 * DayCraft AI — Cross-Platform Persistence & Repository Layer.
 * Zero top-level `react-native` or `expo-*` imports (runs in React Native, Web, Node/MCP, and Vitest).
 */

import { getDateKeyWithOffset, getTodayKey } from '@/constants/theme';
import {
  CURRENT_SCHEMA_VERSION,
  normalizeLegacyEvents,
  runMigrations,
  type SQLiteBindValue,
  type SQLiteExecutor,
  type SQLiteRunResult,
} from '@/services/db/migrations';
import type {
  AppAlert,
  ChatMessage,
  ChatMessageClassifiedItem,
  DayCraftRepository,
  DayCraftSnapshot,
  DayInfo,
  EntitySyncStatus,
  EventRecurrenceRule,
  IdeaGroup,
  IdeaItemData,
  IntakeIntentKind,
  ParsedIntakeAction,
  ParsedIntakeBatch,
  PendingTask,
  PersistedGeminiConfig,
  RecurrenceFrequency,
  RepositorySeedPayload,
  RepositoryWriteOptions,
  RolloverEvaluationResult,
  SmartIntakeProcessOptions,
  SyncEntityMetadata,
  SyncEntityType,
  SyncOutboxEntry,
  SyncOutboxOperation,
  SyncState,
  SyncStatusKind,
  TimelineEvent,
} from '@/types/daycraft';

// Backward-compatible type and helper re-exports
export type {
  AppAlert,
  ChatMessage,
  ChatMessageClassifiedItem,
  DayCraftRepository,
  DayCraftSnapshot,
  DayInfo,
  EntitySyncStatus,
  EventRecurrenceRule,
  IdeaGroup,
  IdeaItemData,
  IntakeIntentKind,
  ParsedIntakeAction,
  ParsedIntakeBatch,
  PendingTask,
  PersistedGeminiConfig,
  RecurrenceFrequency,
  RepositorySeedPayload,
  RepositoryWriteOptions,
  RolloverEvaluationResult,
  SmartIntakeProcessOptions,
  SyncEntityMetadata,
  SyncEntityType,
  SyncOutboxEntry,
  SyncOutboxOperation,
  SyncState,
  SyncStatusKind,
  TimelineEvent,
  SQLiteBindValue,
  SQLiteExecutor,
  SQLiteRunResult,
};

export { CURRENT_SCHEMA_VERSION, normalizeLegacyEvents, runMigrations };

// Datos semilla iniciales basados fielmente en los prototipos v9 con fechas ISO reales
export const SEED_EVENTS: TimelineEvent[] = [
  {
    id: 'ev-1',
    dayKey: getTodayKey(),
    title: 'Revisar informe de gastos mensual',
    desc: 'Bloque enfocado con comprobantes',
    startQ: 46, // 11:30
    quarters: 2, // 30 min (11:30 - 12:00)
    type: 'task',
    tag: 'Finanzas',
    completed: false,
  },
  {
    id: 'ev-2',
    dayKey: getDateKeyWithOffset(1),
    title: 'Llamar al dentista',
    desc: 'Recordatorio puntual de revisión anual',
    startQ: 68, // 17:00
    quarters: 2, // 30 min
    type: 'reminder',
    tag: 'Salud',
    completed: false,
  },
  {
    id: 'ev-3',
    dayKey: getDateKeyWithOffset(3),
    title: 'Planificar sprint de la app',
    desc: 'Diseño backlog en Expo y NativeWind',
    startQ: 40, // 10:00
    quarters: 6, // 1h 30m (10:00 - 11:30)
    type: 'task',
    tag: 'Mi App Móvil',
    completed: false,
  },
];

export const SEED_PENDING: PendingTask[] = [
  {
    id: 'pending-1',
    title: 'Comprar pilas para el mando',
    completed: false,
    isFromYesterday: true,
    rolloverDays: 1,
    createdAt: 'Ayer',
  },
  {
    id: 'pending-2',
    title: 'Llamar a Carlos por presupuesto',
    completed: false,
    isFromYesterday: false,
    rolloverDays: 0,
    createdAt: 'Hoy',
  },
];

export const SEED_IDEA_GROUPS: IdeaGroup[] = [
  {
    id: 'grp-app',
    title: 'Proyecto: Mi App Móvil',
    subtitle: 'DayCraft con React Native',
    icon: 'smartphone',
    accentColor: 'indigo',
    items: [
      {
        id: 'idea-1',
        groupId: 'grp-app',
        title: 'App sin fricción para organizar el día',
        desc: 'Eliminar la pereza inicial: dictas por voz y la IA separa tareas agendadas, pendientes e ideas.',
        markdownContent: `# App sin fricción para organizar el día\n\n## Objetivo Principal\nEliminar la pereza de rellenar formularios complejos al agendar el día.\n\n## Puntos Clave\n- [x] Captura única omnidireccional (Smart Intake)\n- [x] Clasificación automática por IA (Gemini)\n- [ ] Widget nativo de captura rápida por voz\n\n## Notas Técnicas\nUsar \`expo-sqlite\` para persistencia local y exportación directa a Markdown \`.md\`.`,
        createdAtLabel: 'Hace 2 días',
        daysInactive: 2,
        suggestedAction: 'Definir wireframes entrada por voz',
      },
      {
        id: 'idea-2',
        groupId: 'grp-app',
        title: 'Sincronización Offline con SQLite',
        desc: 'Poder registrar notas y bloques en el metro sin cobertura móvil.',
        markdownContent: `# Sincronización Offline con SQLite\n\n## Arquitectura Local-First\n1. Guardar cada cambio inmediatamente en SQLite (\`daycraft_v9.db\`).\n2. Encolar mutaciones cuando no haya red.\n3. Permitir exportar cualquier idea como archivo \`.md\` independiente.`,
        createdAtLabel: 'Hoy',
        daysInactive: 0,
        suggestedAction: 'Configurar tablas expo-sqlite',
      },
      {
        id: 'idea-3',
        groupId: 'grp-app',
        title: 'Iconografía 100% Notion Icons',
        desc: 'Cero emojis estridentes. Trazos vectoriales limpios (stroke 1.8) en toda la interfaz.',
        markdownContent: `# Iconografía 100% Notion Icons\n\n- Trazo uniforme \`strokeWidth: 1.8\`\n- Paleta monocroma oscura (\`#0d1117\`, \`#161922\`, \`#1f2430\`)\n- Sin iconos multicolores que generen fatiga visual.`,
        createdAtLabel: 'Hace 10m',
        daysInactive: 0,
        suggestedAction: 'Revisar catálogo NotionIcons',
      },
    ],
  },
  {
    id: 'grp-nutrition',
    title: 'Cocina & Nutrición',
    subtitle: 'Ideas de despensa y comidas',
    icon: 'cup',
    accentColor: 'emerald',
    items: [
      {
        id: 'idea-4',
        groupId: 'grp-nutrition',
        title: 'Gestor de despensa semanal con IA',
        desc: 'Sugerir recetas rápidas basadas únicamente en los ingredientes que están por caducar.',
        createdAtLabel: 'Hace 4 días',
        daysInactive: 4,
        suggestedAction: 'Investigar API de escaneo de tickets',
      },
    ],
  },
  {
    id: 'grp-sparks',
    title: 'Chispazos Libres',
    subtitle: 'Pendientes de convertir en proyecto',
    icon: 'sparkle',
    accentColor: 'amber',
    items: [
      {
        id: 'idea-5',
        groupId: 'grp-sparks',
        title: 'Automatizador de presupuestos y facturas',
        desc: 'Descargar PDFs de facturas desde Gmail a Sheets de forma desatendida.',
        createdAtLabel: 'Hace 12 días',
        daysInactive: 12,
        suggestedAction: 'Explorar Automatizador (30m)',
      },
    ],
  },
];

export const SEED_CHAT: ChatMessage[] = [
  {
    id: 'msg-1',
    role: 'assistant',
    text: '¡Hola! Dime lo que tienes en mente: tareas con horario, recordatorios puntuales, pendientes para hoy sin hora fija o ideas para tus proyectos.',
    timestamp: '09:40',
  },
  {
    id: 'msg-2',
    role: 'user',
    text: 'Recuérdame mañana a las 17:00 llamar al dentista, y hoy tengo que comprar pilas para el mando',
    timestamp: '09:41',
  },
  {
    id: 'msg-3',
    role: 'assistant',
    text: 'Clasificado exactamente sin fricción:',
    timestamp: '09:41',
    classifiedItems: [
      {
        type: 'reminder',
        title: 'Llamar al dentista',
        meta: 'Mañana 17:00',
      },
      {
        type: 'pending',
        title: 'Comprar pilas para el mando',
        meta: 'Para hoy (Sin hora)',
      },
    ],
  },
];

export const SEED_ALERTS: AppAlert[] = [
  {
    id: 'alert-1',
    type: 'rollover',
    title: '"Comprar pilas para el mando"',
    subtitle: 'Se movió automáticamente a tus pendientes de hoy (1/3 días).',
    badgeText: 'Ayer · 1/3 días',
    relatedId: 'pending-1',
  },
  {
    id: 'alert-2',
    type: 'inactive_idea',
    title: '"Automatizador de presupuestos"',
    subtitle:
      'Lleva 12 días en el cajón sin tocarse. ¿La retomamos hoy a las 16:00 o la archivamos?',
    badgeText: '12 días inactiva',
    relatedId: 'idea-5',
  },
];

// Helpers
let outboxCounter = 0;

function nextOutboxId(): string {
  outboxCounter += 1;
  return `outbox-${Date.now()}-${outboxCounter}`;
}

function cloneValue<T>(val: T): T {
  if (val === null || typeof val !== 'object') return val;
  return JSON.parse(JSON.stringify(val)) as T;
}

function stampEntity<T extends SyncEntityMetadata>(
  entity: T,
  existing: T | undefined,
  options?: RepositoryWriteOptions
): T {
  const nowIso = new Date().toISOString();
  const enqueueSync = options?.enqueueSync !== false;
  if (enqueueSync) {
    return {
      ...cloneValue(entity),
      updatedAt: nowIso,
      deletedAt: entity.deletedAt ?? null,
      syncStatus: 'pending',
      version: existing ? (existing.version ?? 1) + 1 : (entity.version ?? 1),
    };
  }
  return {
    ...cloneValue(entity),
    updatedAt: entity.updatedAt ?? nowIso,
    deletedAt: entity.deletedAt ?? null,
    syncStatus: entity.syncStatus ?? 'synced',
    version: entity.version ?? (existing ? (existing.version ?? 1) + 1 : 1),
  };
}

function defaultGeminiConfig(): PersistedGeminiConfig {
  return { apiKey: '', useCloudAI: false };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeGeminiConfig(value: unknown): PersistedGeminiConfig | null {
  if (!isPlainObject(value)) return null;
  return {
    apiKey: typeof value.apiKey === 'string' ? value.apiKey : '',
    useCloudAI:
      typeof value.useCloudAI === 'boolean' ? value.useCloudAI : false,
  };
}

function resolveSnapshotConfig(
  metaLastOpened: string | null,
  kvLastOpened: unknown,
  metaGemini: string | null,
  kvGemini: unknown
): { lastOpenedDate: string | null; geminiConfig: PersistedGeminiConfig } {
  const parsedMetaGemini = safeJsonParse<unknown>(metaGemini);
  const validMetaGemini = normalizeGeminiConfig(parsedMetaGemini);
  const validKvGemini = normalizeGeminiConfig(kvGemini);
  const validKvLastOpened =
    typeof kvLastOpened === 'string' ? kvLastOpened : null;

  return {
    lastOpenedDate: metaLastOpened ?? validKvLastOpened ?? null,
    geminiConfig: validMetaGemini ?? validKvGemini ?? defaultGeminiConfig(),
  };
}

function safeJsonParse<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Detección segura de entorno sin importar `react-native`.
 */
export function isWebRuntime(): boolean {
  try {
    return (
      typeof document !== 'undefined' &&
      typeof window !== 'undefined' &&
      typeof window.localStorage !== 'undefined' &&
      (typeof navigator === 'undefined' || navigator.product !== 'ReactNative')
    );
  } catch {
    return false;
  }
}

export function isReactNativeRuntime(): boolean {
  const g = globalThis as Record<string, unknown>;
  if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
    return true;
  }
  return Boolean(
    g.ExpoModules ||
      g.RN$Bridgeless ||
      g.__fbBatchedBridge ||
      g.nativeCallSyncHook
  );
}

/**
 * Implementación en memoria de `DayCraftRepository`.
 * Usada en Node/Vitest, entornos sin almacenamiento y fallback ante errores nativos/Web.
 */
export class InMemoryDayCraftRepository implements DayCraftRepository {
  protected eventsMap = new Map<string, TimelineEvent>();
  protected pendingMap = new Map<string, PendingTask>();
  protected ideaGroupsMap = new Map<string, IdeaGroup>();
  protected chatMap = new Map<string, ChatMessage>();
  protected alertsMap = new Map<string, AppAlert>();
  protected metaMap = new Map<string, string>();
  protected kvMap = new Map<string, string>();
  protected outboxMap = new Map<string, SyncOutboxEntry>();
  protected schemaVersion = CURRENT_SCHEMA_VERSION;

  async init(): Promise<void> {
    if (!this.metaMap.has('schema_version')) {
      this.metaMap.set('schema_version', String(CURRENT_SCHEMA_VERSION));
    }
  }

  async close(): Promise<void> {
    // No-op for in-memory repository
  }

  async getSchemaVersion(): Promise<number> {
    return this.schemaVersion;
  }

  async isSeedInitialized(): Promise<boolean> {
    const val = this.metaMap.get('seed_initialized');
    return val === 'true' || val === '1';
  }

  async seedIfNeeded(seed: RepositorySeedPayload): Promise<boolean> {
    if (await this.isSeedInitialized()) {
      return false;
    }
    await this.replaceAllEvents(seed.events, { enqueueSync: false });
    await this.replaceAllPendingTasks(seed.pendingTasks, {
      enqueueSync: false,
    });
    await this.replaceAllIdeaGroups(seed.ideaGroups, { enqueueSync: false });
    await this.replaceAllChatMessages(seed.chatMessages, {
      enqueueSync: false,
    });
    await this.replaceAllAlerts(seed.alerts, { enqueueSync: false });
    if (seed.lastOpenedDate !== undefined && seed.lastOpenedDate !== null) {
      await this.setMeta('last_opened_date', seed.lastOpenedDate);
    }
    await this.setMeta('seed_initialized', 'true');
    return true;
  }

  async getSnapshot(): Promise<DayCraftSnapshot> {
    const [
      events,
      pendingTasks,
      ideaGroups,
      chatMessages,
      alerts,
      metaLastOpened,
      kvLastOpened,
      metaGemini,
      kvGemini,
      seedInitialized,
    ] = await Promise.all([
      this.listEvents(),
      this.listPendingTasks({ includeArchived: true }),
      this.listIdeaGroups(),
      this.listChatMessages(),
      this.listAlerts(),
      this.getMeta('last_opened_date'),
      this.getKv<unknown>('last_opened_date_v9'),
      this.getMeta('gemini_config'),
      this.getKv<unknown>('gemini_config_v9'),
      this.isSeedInitialized(),
    ]);

    const { lastOpenedDate, geminiConfig } = resolveSnapshotConfig(
      metaLastOpened,
      kvLastOpened,
      metaGemini,
      kvGemini
    );

    return {
      events,
      pendingTasks,
      ideaGroups,
      chatMessages,
      alerts,
      lastOpenedDate,
      geminiConfig,
      seedInitialized,
    };
  }

  // Events
  async listEvents(options?: {
    dayKey?: string;
    includeDeleted?: boolean;
  }): Promise<TimelineEvent[]> {
    const includeDeleted = options?.includeDeleted ?? false;
    const out: TimelineEvent[] = [];
    for (const ev of this.eventsMap.values()) {
      if (!includeDeleted && ev.deletedAt) continue;
      if (options?.dayKey && ev.dayKey !== options.dayKey) continue;
      out.push(cloneValue(ev));
    }
    out.sort((a, b) => {
      if (a.dayKey !== b.dayKey) {
        return a.dayKey < b.dayKey ? -1 : 1;
      }
      return a.startQ - b.startQ;
    });
    return out;
  }

  async getEventById(id: string): Promise<TimelineEvent | null> {
    const ev = this.eventsMap.get(id);
    if (!ev || ev.deletedAt) return null;
    return cloneValue(ev);
  }

  async upsertEvent(
    event: TimelineEvent,
    options?: RepositoryWriteOptions
  ): Promise<TimelineEvent> {
    const existing = this.eventsMap.get(event.id);
    const saved = stampEntity(event, existing, options);
    this.eventsMap.set(saved.id, saved);
    if (options?.enqueueSync !== false) {
      await this.enqueueSyncOutbox({
        entityType: 'event',
        entityId: saved.id,
        operation: 'upsert',
        payload: JSON.stringify(saved),
      });
    }
    return cloneValue(saved);
  }

  async deleteEvent(
    id: string,
    options?: RepositoryWriteOptions
  ): Promise<void> {
    const existing = this.eventsMap.get(id);
    const nowIso = new Date().toISOString();
    if (options?.soft && existing) {
      const updated: TimelineEvent = {
        ...existing,
        deletedAt: nowIso,
        updatedAt: nowIso,
        syncStatus: options?.enqueueSync !== false ? 'pending' : 'synced',
        version: (existing.version ?? 1) + 1,
      };
      this.eventsMap.set(id, updated);
    } else {
      this.eventsMap.delete(id);
    }
    if (options?.enqueueSync !== false) {
      await this.enqueueSyncOutbox({
        entityType: 'event',
        entityId: id,
        operation: 'delete',
        payload: JSON.stringify({ id, deletedAt: options?.soft ? nowIso : null }),
      });
    }
  }

  async replaceAllEvents(
    events: TimelineEvent[],
    options?: RepositoryWriteOptions
  ): Promise<void> {
    this.eventsMap.clear();
    for (const ev of events) {
      const saved = stampEntity(ev, undefined, {
        enqueueSync: options?.enqueueSync === true,
      });
      this.eventsMap.set(saved.id, saved);
      if (options?.enqueueSync === true) {
        await this.enqueueSyncOutbox({
          entityType: 'event',
          entityId: saved.id,
          operation: 'upsert',
          payload: JSON.stringify(saved),
        });
      }
    }
  }

  // Pending Tasks
  async listPendingTasks(options?: {
    includeArchived?: boolean;
    includeDeleted?: boolean;
  }): Promise<PendingTask[]> {
    const includeArchived = options?.includeArchived ?? false;
    const includeDeleted = options?.includeDeleted ?? false;
    const out: PendingTask[] = [];
    for (const task of this.pendingMap.values()) {
      if (!includeDeleted && task.deletedAt) continue;
      if (!includeArchived && task.archived) continue;
      out.push(cloneValue(task));
    }
    return out;
  }

  async getPendingTaskById(id: string): Promise<PendingTask | null> {
    const task = this.pendingMap.get(id);
    if (!task || task.deletedAt) return null;
    return cloneValue(task);
  }

  async upsertPendingTask(
    task: PendingTask,
    options?: RepositoryWriteOptions
  ): Promise<PendingTask> {
    const existing = this.pendingMap.get(task.id);
    const saved = stampEntity(task, existing, options);
    this.pendingMap.set(saved.id, saved);
    if (options?.enqueueSync !== false) {
      await this.enqueueSyncOutbox({
        entityType: 'pending',
        entityId: saved.id,
        operation: 'upsert',
        payload: JSON.stringify(saved),
      });
    }
    return cloneValue(saved);
  }

  async deletePendingTask(
    id: string,
    options?: RepositoryWriteOptions
  ): Promise<void> {
    const existing = this.pendingMap.get(id);
    const nowIso = new Date().toISOString();
    if (options?.soft && existing) {
      this.pendingMap.set(id, {
        ...existing,
        deletedAt: nowIso,
        updatedAt: nowIso,
        syncStatus: options?.enqueueSync !== false ? 'pending' : 'synced',
        version: (existing.version ?? 1) + 1,
      });
    } else {
      this.pendingMap.delete(id);
    }
    if (options?.enqueueSync !== false) {
      await this.enqueueSyncOutbox({
        entityType: 'pending',
        entityId: id,
        operation: 'delete',
        payload: JSON.stringify({ id, deletedAt: options?.soft ? nowIso : null }),
      });
    }
  }

  async replaceAllPendingTasks(
    tasks: PendingTask[],
    options?: RepositoryWriteOptions
  ): Promise<void> {
    this.pendingMap.clear();
    for (const task of tasks) {
      const saved = stampEntity(task, undefined, {
        enqueueSync: options?.enqueueSync === true,
      });
      this.pendingMap.set(saved.id, saved);
      if (options?.enqueueSync === true) {
        await this.enqueueSyncOutbox({
          entityType: 'pending',
          entityId: saved.id,
          operation: 'upsert',
          payload: JSON.stringify(saved),
        });
      }
    }
  }

  // Idea Groups & Ideas
  async listIdeaGroups(options?: {
    includeDeleted?: boolean;
  }): Promise<IdeaGroup[]> {
    const includeDeleted = options?.includeDeleted ?? false;
    const out: IdeaGroup[] = [];
    for (const group of this.ideaGroupsMap.values()) {
      if (!includeDeleted && group.deletedAt) continue;
      const cloned = cloneValue(group);
      if (!includeDeleted) {
        cloned.items = cloned.items.filter((item) => !item.deletedAt);
      }
      out.push(cloned);
    }
    return out;
  }

  async getIdeaGroupById(id: string): Promise<IdeaGroup | null> {
    const group = this.ideaGroupsMap.get(id);
    if (!group || group.deletedAt) return null;
    const cloned = cloneValue(group);
    cloned.items = cloned.items.filter((item) => !item.deletedAt);
    return cloned;
  }

  async upsertIdeaGroup(
    group: IdeaGroup,
    options?: RepositoryWriteOptions
  ): Promise<IdeaGroup> {
    const existing = this.ideaGroupsMap.get(group.id);
    const existingItemsById = new Map<string, IdeaItemData>();
    for (const grp of this.ideaGroupsMap.values()) {
      for (const item of grp.items) {
        existingItemsById.set(item.id, item);
      }
    }

    const stampedItems = (group.items ?? []).map((item) => {
      const prevItem = existingItemsById.get(item.id);
      return stampEntity(
        { ...item, groupId: group.id },
        prevItem,
        options
      );
    });
    const saved = stampEntity(
      { ...group, items: stampedItems },
      existing,
      options
    );
    const incomingIds = new Set(stampedItems.map((i) => i.id));
    for (const [otherId, otherGroup] of this.ideaGroupsMap.entries()) {
      if (otherId === saved.id) continue;
      if (otherGroup.items.some((i) => incomingIds.has(i.id))) {
        otherGroup.items = otherGroup.items.filter(
          (i) => !incomingIds.has(i.id)
        );
      }
    }
    const preservedTombstones = (existing?.items ?? [])
      .filter((i) => Boolean(i.deletedAt) && !incomingIds.has(i.id))
      .map((i) => cloneValue(i));
    this.ideaGroupsMap.set(saved.id, {
      ...saved,
      items: [...saved.items, ...preservedTombstones],
    });
    if (options?.enqueueSync !== false) {
      await this.enqueueSyncOutbox({
        entityType: 'idea_group',
        entityId: saved.id,
        operation: 'upsert',
        payload: JSON.stringify(saved),
      });
    }
    return cloneValue(saved);
  }

  async deleteIdeaGroup(
    id: string,
    options?: RepositoryWriteOptions
  ): Promise<void> {
    const existing = this.ideaGroupsMap.get(id);
    const nowIso = new Date().toISOString();
    if (options?.soft && existing) {
      this.ideaGroupsMap.set(id, {
        ...existing,
        deletedAt: nowIso,
        updatedAt: nowIso,
        syncStatus: options?.enqueueSync !== false ? 'pending' : 'synced',
        version: (existing.version ?? 1) + 1,
      });
    } else {
      this.ideaGroupsMap.delete(id);
    }
    if (options?.enqueueSync !== false) {
      await this.enqueueSyncOutbox({
        entityType: 'idea_group',
        entityId: id,
        operation: 'delete',
        payload: JSON.stringify({ id, deletedAt: options?.soft ? nowIso : null }),
      });
    }
  }

  async listIdeas(options?: {
    groupId?: string;
    includeDeleted?: boolean;
  }): Promise<IdeaItemData[]> {
    const includeDeleted = options?.includeDeleted ?? false;
    const out: IdeaItemData[] = [];
    for (const group of this.ideaGroupsMap.values()) {
      if (!includeDeleted && group.deletedAt) continue;
      if (options?.groupId && group.id !== options.groupId) continue;
      for (const item of group.items) {
        if (!includeDeleted && item.deletedAt) continue;
        out.push(cloneValue(item));
      }
    }
    return out;
  }

  async getIdeaById(id: string): Promise<IdeaItemData | null> {
    for (const group of this.ideaGroupsMap.values()) {
      if (group.deletedAt) continue;
      const found = group.items.find((i) => i.id === id && !i.deletedAt);
      if (found) return cloneValue(found);
    }
    return null;
  }

  async upsertIdea(
    idea: IdeaItemData,
    options?: RepositoryWriteOptions
  ): Promise<IdeaItemData> {
    let existingItem: IdeaItemData | undefined;
    for (const group of this.ideaGroupsMap.values()) {
      const idx = group.items.findIndex((i) => i.id === idea.id);
      if (idx !== -1) {
        existingItem = group.items[idx];
        if (group.id !== idea.groupId) {
          group.items.splice(idx, 1);
        }
      }
    }

    const saved = stampEntity(idea, existingItem, options);
    let targetGroup = this.ideaGroupsMap.get(saved.groupId);
    if (!targetGroup) {
      targetGroup = stampEntity<IdeaGroup>(
        {
          id: saved.groupId,
          title:
            saved.groupId === 'grp-sparks' ? 'Chispazos Libres' : 'Proyecto',
          subtitle: 'Grupo de ideas',
          icon: 'sparkle',
          accentColor: 'amber',
          items: [],
        },
        undefined,
        { enqueueSync: false }
      );
      this.ideaGroupsMap.set(targetGroup.id, targetGroup);
    }

    const existingIdx = targetGroup.items.findIndex((i) => i.id === saved.id);
    if (existingIdx !== -1) {
      targetGroup.items[existingIdx] = saved;
    } else {
      targetGroup.items.push(saved);
    }

    if (options?.enqueueSync !== false) {
      await this.enqueueSyncOutbox({
        entityType: 'idea',
        entityId: saved.id,
        operation: 'upsert',
        payload: JSON.stringify(saved),
      });
    }
    return cloneValue(saved);
  }

  async deleteIdea(
    id: string,
    options?: RepositoryWriteOptions
  ): Promise<void> {
    const nowIso = new Date().toISOString();
    for (const group of this.ideaGroupsMap.values()) {
      const idx = group.items.findIndex((i) => i.id === id);
      if (idx !== -1) {
        if (options?.soft) {
          const existing = group.items[idx];
          group.items[idx] = {
            ...existing,
            deletedAt: nowIso,
            updatedAt: nowIso,
            syncStatus:
              options?.enqueueSync !== false ? 'pending' : 'synced',
            version: (existing.version ?? 1) + 1,
          };
        } else {
          group.items.splice(idx, 1);
        }
      }
    }
    if (options?.enqueueSync !== false) {
      await this.enqueueSyncOutbox({
        entityType: 'idea',
        entityId: id,
        operation: 'delete',
        payload: JSON.stringify({ id, deletedAt: options?.soft ? nowIso : null }),
      });
    }
  }

  async searchIdeas(query: string): Promise<IdeaItemData[]> {
    const normalized = query.trim().toLowerCase();
    const activeIdeas = await this.listIdeas({ includeDeleted: false });
    if (!normalized) return activeIdeas;

    return activeIdeas.filter((item) => {
      const haystack = [
        item.title,
        item.desc,
        item.markdownContent ?? '',
        item.suggestedAction ?? '',
      ]
        .join('\n')
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }

  async replaceAllIdeaGroups(
    groups: IdeaGroup[],
    options?: RepositoryWriteOptions
  ): Promise<void> {
    this.ideaGroupsMap.clear();
    for (const group of groups) {
      const stampedItems = (group.items ?? []).map((item) =>
        stampEntity(
          { ...item, groupId: group.id },
          undefined,
          { enqueueSync: options?.enqueueSync === true }
        )
      );
      const savedGroup = stampEntity(
        { ...group, items: stampedItems },
        undefined,
        { enqueueSync: options?.enqueueSync === true }
      );
      this.ideaGroupsMap.set(savedGroup.id, savedGroup);
      if (options?.enqueueSync === true) {
        await this.enqueueSyncOutbox({
          entityType: 'idea_group',
          entityId: savedGroup.id,
          operation: 'upsert',
          payload: JSON.stringify(savedGroup),
        });
      }
    }
  }

  // Chat Messages
  async listChatMessages(options?: {
    includeDeleted?: boolean;
  }): Promise<ChatMessage[]> {
    const includeDeleted = options?.includeDeleted ?? false;
    const out: ChatMessage[] = [];
    for (const msg of this.chatMap.values()) {
      if (!includeDeleted && msg.deletedAt) continue;
      out.push(cloneValue(msg));
    }
    return out;
  }

  async upsertChatMessage(
    message: ChatMessage,
    options?: RepositoryWriteOptions
  ): Promise<ChatMessage> {
    const existing = this.chatMap.get(message.id);
    const saved = stampEntity(message, existing, options);
    this.chatMap.set(saved.id, saved);
    if (options?.enqueueSync !== false) {
      await this.enqueueSyncOutbox({
        entityType: 'chat',
        entityId: saved.id,
        operation: 'upsert',
        payload: JSON.stringify(saved),
      });
    }
    return cloneValue(saved);
  }

  async deleteChatMessage(
    id: string,
    options?: RepositoryWriteOptions
  ): Promise<void> {
    const existing = this.chatMap.get(id);
    const nowIso = new Date().toISOString();
    if (options?.soft && existing) {
      this.chatMap.set(id, {
        ...existing,
        deletedAt: nowIso,
        updatedAt: nowIso,
        syncStatus: options?.enqueueSync !== false ? 'pending' : 'synced',
        version: (existing.version ?? 1) + 1,
      });
    } else {
      this.chatMap.delete(id);
    }
    if (options?.enqueueSync !== false) {
      await this.enqueueSyncOutbox({
        entityType: 'chat',
        entityId: id,
        operation: 'delete',
        payload: JSON.stringify({ id, deletedAt: options?.soft ? nowIso : null }),
      });
    }
  }

  async replaceAllChatMessages(
    messages: ChatMessage[],
    options?: RepositoryWriteOptions
  ): Promise<void> {
    this.chatMap.clear();
    for (const msg of messages) {
      const saved = stampEntity(msg, undefined, {
        enqueueSync: options?.enqueueSync === true,
      });
      this.chatMap.set(saved.id, saved);
      if (options?.enqueueSync === true) {
        await this.enqueueSyncOutbox({
          entityType: 'chat',
          entityId: saved.id,
          operation: 'upsert',
          payload: JSON.stringify(saved),
        });
      }
    }
  }

  // Alerts
  async listAlerts(options?: {
    includeDeleted?: boolean;
  }): Promise<AppAlert[]> {
    const includeDeleted = options?.includeDeleted ?? false;
    const out: AppAlert[] = [];
    for (const alert of this.alertsMap.values()) {
      if (!includeDeleted && alert.deletedAt) continue;
      out.push(cloneValue(alert));
    }
    return out;
  }

  async upsertAlert(
    alert: AppAlert,
    options?: RepositoryWriteOptions
  ): Promise<AppAlert> {
    const existing = this.alertsMap.get(alert.id);
    const saved = stampEntity(alert, existing, options);
    this.alertsMap.set(saved.id, saved);
    if (options?.enqueueSync !== false) {
      await this.enqueueSyncOutbox({
        entityType: 'alert',
        entityId: saved.id,
        operation: 'upsert',
        payload: JSON.stringify(saved),
      });
    }
    return cloneValue(saved);
  }

  async deleteAlert(
    id: string,
    options?: RepositoryWriteOptions
  ): Promise<void> {
    const existing = this.alertsMap.get(id);
    const nowIso = new Date().toISOString();
    if (options?.soft && existing) {
      this.alertsMap.set(id, {
        ...existing,
        deletedAt: nowIso,
        updatedAt: nowIso,
        syncStatus: options?.enqueueSync !== false ? 'pending' : 'synced',
        version: (existing.version ?? 1) + 1,
      });
    } else {
      this.alertsMap.delete(id);
    }
    if (options?.enqueueSync !== false) {
      await this.enqueueSyncOutbox({
        entityType: 'alert',
        entityId: id,
        operation: 'delete',
        payload: JSON.stringify({ id, deletedAt: options?.soft ? nowIso : null }),
      });
    }
  }

  async replaceAllAlerts(
    alerts: AppAlert[],
    options?: RepositoryWriteOptions
  ): Promise<void> {
    this.alertsMap.clear();
    for (const alert of alerts) {
      const saved = stampEntity(alert, undefined, {
        enqueueSync: options?.enqueueSync === true,
      });
      this.alertsMap.set(saved.id, saved);
      if (options?.enqueueSync === true) {
        await this.enqueueSyncOutbox({
          entityType: 'alert',
          entityId: saved.id,
          operation: 'upsert',
          payload: JSON.stringify(saved),
        });
      }
    }
  }

  // Meta & Legacy KV
  async getMeta(key: string): Promise<string | null> {
    return this.metaMap.get(key) ?? null;
  }

  async setMeta(key: string, value: string): Promise<void> {
    this.metaMap.set(key, value);
  }

  async getKv<T>(key: string): Promise<T | null> {
    const raw = this.kvMap.get(key);
    if (raw === undefined) return null;
    return safeJsonParse<T>(raw);
  }

  async setKv(key: string, value: unknown): Promise<void> {
    const serialized = value === undefined ? 'null' : JSON.stringify(value);
    this.kvMap.set(key, serialized);
  }

  // Sync Outbox
  async listSyncOutbox(): Promise<SyncOutboxEntry[]> {
    return Array.from(this.outboxMap.values())
      .sort((a, b) =>
        a.createdAt === b.createdAt ? 0 : a.createdAt < b.createdAt ? -1 : 1
      )
      .map((entry) => cloneValue(entry));
  }

  async enqueueSyncOutbox(
    entry: Omit<SyncOutboxEntry, 'id' | 'createdAt' | 'attempts'> &
      Partial<Pick<SyncOutboxEntry, 'id' | 'createdAt' | 'attempts'>>
  ): Promise<SyncOutboxEntry> {
    const saved: SyncOutboxEntry = {
      id: entry.id ?? nextOutboxId(),
      entityType: entry.entityType,
      entityId: entry.entityId,
      operation: entry.operation,
      payload: entry.payload,
      createdAt: entry.createdAt ?? new Date().toISOString(),
      attempts: entry.attempts ?? 0,
    };
    this.outboxMap.set(saved.id, saved);
    return cloneValue(saved);
  }

  async removeSyncOutboxEntry(id: string): Promise<void> {
    this.outboxMap.delete(id);
  }

  async incrementSyncOutboxAttempts(id: string): Promise<void> {
    const entry = this.outboxMap.get(id);
    if (entry) {
      this.outboxMap.set(id, { ...entry, attempts: entry.attempts + 1 });
    }
  }

  async clearSyncOutbox(): Promise<void> {
    this.outboxMap.clear();
  }
}

const WEB_KEYS = {
  events: 'daycraft_v1_events',
  pending: 'daycraft_v1_pending',
  ideaGroups: 'daycraft_v1_idea_groups',
  chat: 'daycraft_v1_chat',
  alerts: 'daycraft_v1_alerts',
  meta: 'daycraft_v1_meta',
  outbox: 'daycraft_v1_outbox',
} as const;

/**
 * Repositorio para Web (`localStorage`) con paridad relacional v1, migración v9 y fallback en memoria ante cuota/errores.
 */
export class WebStorageDayCraftRepository extends InMemoryDayCraftRepository {
  private storage: Storage | null;
  private initialized = false;

  constructor(storage?: Storage) {
    super();
    if (storage) {
      this.storage = storage;
    } else {
      try {
        this.storage =
          typeof window !== 'undefined' && window.localStorage
            ? window.localStorage
            : null;
      } catch {
        this.storage = null;
      }
    }
  }

  private safeGetItem(key: string): string | null {
    if (!this.storage) return null;
    try {
      return this.storage.getItem(key);
    } catch {
      return null;
    }
  }

  private safeSetItem(key: string, value: string): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(key, value);
    } catch {
      // Fallback en memoria permanece activo si localStorage falla (p. ej. QuotaExceededError o modo privado)
    }
  }

  private persistMetaMap(): void {
    const obj: Record<string, string> = {};
    for (const [k, v] of this.metaMap.entries()) {
      obj[k] = v;
    }
    this.safeSetItem(WEB_KEYS.meta, JSON.stringify(obj));
  }

  private persistEvents(): void {
    this.safeSetItem(
      WEB_KEYS.events,
      JSON.stringify(Array.from(this.eventsMap.values()))
    );
  }

  private persistPending(): void {
    this.safeSetItem(
      WEB_KEYS.pending,
      JSON.stringify(Array.from(this.pendingMap.values()))
    );
  }

  private persistIdeaGroups(): void {
    this.safeSetItem(
      WEB_KEYS.ideaGroups,
      JSON.stringify(Array.from(this.ideaGroupsMap.values()))
    );
  }

  private persistChat(): void {
    this.safeSetItem(
      WEB_KEYS.chat,
      JSON.stringify(Array.from(this.chatMap.values()))
    );
  }

  private persistAlerts(): void {
    this.safeSetItem(
      WEB_KEYS.alerts,
      JSON.stringify(Array.from(this.alertsMap.values()))
    );
  }

  private persistOutbox(): void {
    this.safeSetItem(
      WEB_KEYS.outbox,
      JSON.stringify(Array.from(this.outboxMap.values()))
    );
  }

  override async init(): Promise<void> {
    if (this.initialized) return;

    // Cargar meta existente
    const rawMeta = safeJsonParse<Record<string, string>>(
      this.safeGetItem(WEB_KEYS.meta)
    );
    if (rawMeta && typeof rawMeta === 'object') {
      for (const [k, v] of Object.entries(rawMeta)) {
        if (typeof v === 'string') {
          this.metaMap.set(k, v);
        }
      }
    }

    const storedVersion = Number(this.metaMap.get('schema_version') ?? '0');

    // Cargar colecciones v1 existentes
    const v1Events = safeJsonParse<TimelineEvent[]>(
      this.safeGetItem(WEB_KEYS.events)
    );
    if (Array.isArray(v1Events)) {
      for (const ev of v1Events) {
        if (ev?.id) this.eventsMap.set(ev.id, ev);
      }
    }

    const v1Pending = safeJsonParse<PendingTask[]>(
      this.safeGetItem(WEB_KEYS.pending)
    );
    if (Array.isArray(v1Pending)) {
      for (const t of v1Pending) {
        if (t?.id) this.pendingMap.set(t.id, t);
      }
    }

    const v1Groups = safeJsonParse<IdeaGroup[]>(
      this.safeGetItem(WEB_KEYS.ideaGroups)
    );
    if (Array.isArray(v1Groups)) {
      const validV1Groups = v1Groups.filter(
        (g): g is IdeaGroup =>
          Boolean(g && typeof g === 'object' && typeof g.id === 'string')
      );
      const groupIds = new Set(validV1Groups.map((g) => g.id));
      for (const g of validV1Groups) {
        const items = Array.isArray(g.items)
          ? g.items
              .filter(
                (item): item is IdeaItemData =>
                  Boolean(
                    item &&
                      typeof item === 'object' &&
                      typeof item.id === 'string'
                  )
              )
              .map((item) => ({
                ...item,
                groupId:
                  typeof item.groupId === 'string' &&
                  groupIds.has(item.groupId)
                    ? item.groupId
                    : g.id,
              }))
          : [];
        this.ideaGroupsMap.set(g.id, { ...g, items });
      }
    }

    const v1Chat = safeJsonParse<ChatMessage[]>(
      this.safeGetItem(WEB_KEYS.chat)
    );
    if (Array.isArray(v1Chat)) {
      for (const m of v1Chat) {
        if (m?.id) this.chatMap.set(m.id, m);
      }
    }

    const v1Alerts = safeJsonParse<AppAlert[]>(
      this.safeGetItem(WEB_KEYS.alerts)
    );
    if (Array.isArray(v1Alerts)) {
      for (const a of v1Alerts) {
        if (a?.id) this.alertsMap.set(a.id, a);
      }
    }

    const v1Outbox = safeJsonParse<SyncOutboxEntry[]>(
      this.safeGetItem(WEB_KEYS.outbox)
    );
    if (Array.isArray(v1Outbox)) {
      for (const o of v1Outbox) {
        if (o?.id) this.outboxMap.set(o.id, o);
      }
    }

    // Migración única desde claves legadas daycraft_*_v9
    if (storedVersion < CURRENT_SCHEMA_VERSION) {
      let hasLegacyDomainData = false;

      const legacyEventsRaw = this.safeGetItem('daycraft_events_v9');
      const legacyEvents = safeJsonParse<TimelineEvent[]>(legacyEventsRaw);
      if (Array.isArray(legacyEvents)) {
        hasLegacyDomainData = true;
        if (this.eventsMap.size === 0) {
          for (const ev of normalizeLegacyEvents(legacyEvents)) {
            if (ev && typeof ev === 'object' && typeof ev.id === 'string') {
              this.eventsMap.set(
                ev.id,
                stampEntity(ev, undefined, { enqueueSync: false })
              );
            }
          }
          this.persistEvents();
        }
      }

      const legacyPendingRaw = this.safeGetItem('daycraft_pending_v9');
      const legacyPending = safeJsonParse<PendingTask[]>(legacyPendingRaw);
      if (Array.isArray(legacyPending)) {
        hasLegacyDomainData = true;
        if (this.pendingMap.size === 0) {
          for (const t of legacyPending) {
            if (t && typeof t === 'object' && typeof t.id === 'string') {
              this.pendingMap.set(
                t.id,
                stampEntity(t, undefined, { enqueueSync: false })
              );
            }
          }
          this.persistPending();
        }
      }

      const legacyIdeasRaw = this.safeGetItem('daycraft_ideas_v9');
      const legacyIdeas = safeJsonParse<IdeaGroup[]>(legacyIdeasRaw);
      if (Array.isArray(legacyIdeas)) {
        hasLegacyDomainData = true;
        if (this.ideaGroupsMap.size === 0) {
          const validGroups = legacyIdeas.filter(
            (g): g is IdeaGroup =>
              Boolean(g && typeof g === 'object' && typeof g.id === 'string')
          );
          const groupIds = new Set(validGroups.map((g) => g.id));

          for (const g of validGroups) {
            this.ideaGroupsMap.set(
              g.id,
              stampEntity(
                {
                  ...g,
                  title: typeof g.title === 'string' ? g.title : 'Proyecto',
                  subtitle: typeof g.subtitle === 'string' ? g.subtitle : '',
                  icon: typeof g.icon === 'string' ? g.icon : 'sparkle',
                  accentColor:
                    typeof g.accentColor === 'string'
                      ? g.accentColor
                      : 'indigo',
                  items: [],
                },
                undefined,
                { enqueueSync: false }
              )
            );
          }

          for (const g of validGroups) {
            if (!Array.isArray(g.items)) continue;
            for (const item of g.items) {
              if (!item || typeof item !== 'object' || typeof item.id !== 'string') {
                continue;
              }
              const resolvedGroupId =
                typeof item.groupId === 'string' && groupIds.has(item.groupId)
                  ? item.groupId
                  : g.id;
              const normalizedItem = stampEntity(
                {
                  ...item,
                  groupId: resolvedGroupId,
                  title: typeof item.title === 'string' ? item.title : 'Idea',
                  desc: typeof item.desc === 'string' ? item.desc : '',
                  createdAtLabel:
                    typeof item.createdAtLabel === 'string'
                      ? item.createdAtLabel
                      : 'Hoy',
                  daysInactive:
                    typeof item.daysInactive === 'number' &&
                    Number.isFinite(item.daysInactive)
                      ? item.daysInactive
                      : 0,
                },
                undefined,
                { enqueueSync: false }
              );
              const targetGroup = this.ideaGroupsMap.get(resolvedGroupId);
              if (targetGroup) {
                targetGroup.items.push(normalizedItem);
              }
            }
          }
          this.persistIdeaGroups();
        }
      }

      const legacyChatRaw = this.safeGetItem('daycraft_chat_v9');
      const legacyChat = safeJsonParse<ChatMessage[]>(legacyChatRaw);
      if (Array.isArray(legacyChat)) {
        hasLegacyDomainData = true;
        if (this.chatMap.size === 0) {
          for (const m of legacyChat) {
            if (m && typeof m === 'object' && typeof m.id === 'string') {
              this.chatMap.set(
                m.id,
                stampEntity(m, undefined, { enqueueSync: false })
              );
            }
          }
          this.persistChat();
        }
      }

      const legacyAlertsRaw = this.safeGetItem('daycraft_alerts_v9');
      const legacyAlerts = safeJsonParse<AppAlert[]>(legacyAlertsRaw);
      if (Array.isArray(legacyAlerts)) {
        hasLegacyDomainData = true;
        if (this.alertsMap.size === 0) {
          for (const a of legacyAlerts) {
            if (a && typeof a === 'object' && typeof a.id === 'string') {
              this.alertsMap.set(
                a.id,
                stampEntity(a, undefined, { enqueueSync: false })
              );
            }
          }
          this.persistAlerts();
        }
      }

      const legacyLastOpened = safeJsonParse<string>(
        this.safeGetItem('daycraft_last_opened_date_v9')
      );
      if (typeof legacyLastOpened === 'string' && legacyLastOpened) {
        this.metaMap.set('last_opened_date', legacyLastOpened);
      }

      const legacyGeminiRaw = this.safeGetItem('daycraft_gemini_config_v9');
      if (legacyGeminiRaw && safeJsonParse<unknown>(legacyGeminiRaw) !== null) {
        this.metaMap.set('gemini_config', legacyGeminiRaw);
      }

      if (hasLegacyDomainData) {
        this.metaMap.set('seed_initialized', 'true');
      }

      this.metaMap.set('schema_version', String(CURRENT_SCHEMA_VERSION));
      this.persistMetaMap();
    }

    this.initialized = true;
  }

  override async upsertEvent(
    event: TimelineEvent,
    options?: RepositoryWriteOptions
  ): Promise<TimelineEvent> {
    const res = await super.upsertEvent(event, options);
    this.persistEvents();
    return res;
  }

  override async deleteEvent(
    id: string,
    options?: RepositoryWriteOptions
  ): Promise<void> {
    await super.deleteEvent(id, options);
    this.persistEvents();
  }

  override async replaceAllEvents(
    events: TimelineEvent[],
    options?: RepositoryWriteOptions
  ): Promise<void> {
    await super.replaceAllEvents(events, options);
    this.persistEvents();
  }

  override async upsertPendingTask(
    task: PendingTask,
    options?: RepositoryWriteOptions
  ): Promise<PendingTask> {
    const res = await super.upsertPendingTask(task, options);
    this.persistPending();
    return res;
  }

  override async deletePendingTask(
    id: string,
    options?: RepositoryWriteOptions
  ): Promise<void> {
    await super.deletePendingTask(id, options);
    this.persistPending();
  }

  override async replaceAllPendingTasks(
    tasks: PendingTask[],
    options?: RepositoryWriteOptions
  ): Promise<void> {
    await super.replaceAllPendingTasks(tasks, options);
    this.persistPending();
  }

  override async upsertIdeaGroup(
    group: IdeaGroup,
    options?: RepositoryWriteOptions
  ): Promise<IdeaGroup> {
    const res = await super.upsertIdeaGroup(group, options);
    this.persistIdeaGroups();
    return res;
  }

  override async deleteIdeaGroup(
    id: string,
    options?: RepositoryWriteOptions
  ): Promise<void> {
    await super.deleteIdeaGroup(id, options);
    this.persistIdeaGroups();
  }

  override async upsertIdea(
    idea: IdeaItemData,
    options?: RepositoryWriteOptions
  ): Promise<IdeaItemData> {
    const res = await super.upsertIdea(idea, options);
    this.persistIdeaGroups();
    return res;
  }

  override async deleteIdea(
    id: string,
    options?: RepositoryWriteOptions
  ): Promise<void> {
    await super.deleteIdea(id, options);
    this.persistIdeaGroups();
  }

  override async replaceAllIdeaGroups(
    groups: IdeaGroup[],
    options?: RepositoryWriteOptions
  ): Promise<void> {
    await super.replaceAllIdeaGroups(groups, options);
    this.persistIdeaGroups();
  }

  override async upsertChatMessage(
    message: ChatMessage,
    options?: RepositoryWriteOptions
  ): Promise<ChatMessage> {
    const res = await super.upsertChatMessage(message, options);
    this.persistChat();
    return res;
  }

  override async deleteChatMessage(
    id: string,
    options?: RepositoryWriteOptions
  ): Promise<void> {
    await super.deleteChatMessage(id, options);
    this.persistChat();
  }

  override async replaceAllChatMessages(
    messages: ChatMessage[],
    options?: RepositoryWriteOptions
  ): Promise<void> {
    await super.replaceAllChatMessages(messages, options);
    this.persistChat();
  }

  override async upsertAlert(
    alert: AppAlert,
    options?: RepositoryWriteOptions
  ): Promise<AppAlert> {
    const res = await super.upsertAlert(alert, options);
    this.persistAlerts();
    return res;
  }

  override async deleteAlert(
    id: string,
    options?: RepositoryWriteOptions
  ): Promise<void> {
    await super.deleteAlert(id, options);
    this.persistAlerts();
  }

  override async replaceAllAlerts(
    alerts: AppAlert[],
    options?: RepositoryWriteOptions
  ): Promise<void> {
    await super.replaceAllAlerts(alerts, options);
    this.persistAlerts();
  }

  override async setMeta(key: string, value: string): Promise<void> {
    await super.setMeta(key, value);
    this.persistMetaMap();
  }

  override async getKv<T>(key: string): Promise<T | null> {
    if (this.kvMap.has(key)) {
      return super.getKv<T>(key);
    }
    const raw = this.safeGetItem(`daycraft_${key}`);
    if (raw !== null) {
      const parsed = safeJsonParse<T>(raw);
      if (parsed !== null || raw === 'null') {
        return parsed;
      }
      return null;
    }
    return super.getKv<T>(key);
  }

  override async setKv(key: string, value: unknown): Promise<void> {
    const serialized = value === undefined ? 'null' : JSON.stringify(value);
    this.kvMap.set(key, serialized);
    this.safeSetItem(`daycraft_${key}`, serialized);
  }

  override async enqueueSyncOutbox(
    entry: Omit<SyncOutboxEntry, 'id' | 'createdAt' | 'attempts'> &
      Partial<Pick<SyncOutboxEntry, 'id' | 'createdAt' | 'attempts'>>
  ): Promise<SyncOutboxEntry> {
    const res = await super.enqueueSyncOutbox(entry);
    this.persistOutbox();
    return res;
  }

  override async removeSyncOutboxEntry(id: string): Promise<void> {
    await super.removeSyncOutboxEntry(id);
    this.persistOutbox();
  }

  override async incrementSyncOutboxAttempts(id: string): Promise<void> {
    await super.incrementSyncOutboxAttempts(id);
    this.persistOutbox();
  }

  override async clearSyncOutbox(): Promise<void> {
    await super.clearSyncOutbox();
    this.persistOutbox();
  }
}

interface EventRow {
  id: string;
  day_key: string;
  title: string;
  desc: string | null;
  start_q: number;
  quarters: number;
  type: 'task' | 'reminder';
  tag: string | null;
  completed: number;
  recurrence_json: string | null;
  updated_at: string;
  deleted_at: string | null;
  sync_status: EntitySyncStatus;
  version: number;
}

interface PendingRow {
  id: string;
  title: string;
  completed: number;
  is_from_yesterday: number;
  rollover_days: number;
  created_at: string;
  archived: number;
  updated_at: string;
  deleted_at: string | null;
  sync_status: EntitySyncStatus;
  version: number;
}

interface IdeaGroupRow {
  id: string;
  title: string;
  subtitle: string;
  icon: IdeaGroup['icon'];
  accent_color: IdeaGroup['accentColor'];
  sort_order: number;
  updated_at: string;
  deleted_at: string | null;
  sync_status: EntitySyncStatus;
  version: number;
}

interface IdeaRow {
  id: string;
  group_id: string;
  title: string;
  desc: string;
  markdown_content: string | null;
  created_at_label: string;
  days_inactive: number;
  suggested_action: string | null;
  sort_order: number;
  updated_at: string;
  deleted_at: string | null;
  sync_status: EntitySyncStatus;
  version: number;
}

interface ChatRow {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  classified_items_json: string | null;
  sort_order: number;
  updated_at: string;
  deleted_at: string | null;
  sync_status: EntitySyncStatus;
  version: number;
}

interface AlertRow {
  id: string;
  type: 'rollover' | 'inactive_idea';
  title: string;
  subtitle: string;
  badge_text: string;
  related_id: string | null;
  updated_at: string;
  deleted_at: string | null;
  sync_status: EntitySyncStatus;
  version: number;
}

interface OutboxRow {
  id: string;
  entity_type: SyncEntityType;
  entity_id: string;
  operation: SyncOutboxOperation;
  payload: string;
  created_at: string;
  attempts: number;
}

function mapEventRow(row: EventRow): TimelineEvent {
  const ev: TimelineEvent = {
    id: row.id,
    dayKey: row.day_key,
    title: row.title,
    startQ: row.start_q,
    quarters: row.quarters,
    type: row.type,
    completed: Boolean(row.completed),
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    syncStatus: row.sync_status,
    version: row.version,
  };
  if (row.desc !== null) ev.desc = row.desc;
  if (row.tag !== null) ev.tag = row.tag;
  const rec = safeJsonParse<EventRecurrenceRule>(row.recurrence_json);
  if (rec) ev.recurrence = rec;
  return ev;
}

function mapPendingRow(row: PendingRow): PendingTask {
  return {
    id: row.id,
    title: row.title,
    completed: Boolean(row.completed),
    isFromYesterday: Boolean(row.is_from_yesterday),
    rolloverDays: row.rollover_days,
    createdAt: row.created_at,
    archived: Boolean(row.archived),
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    syncStatus: row.sync_status,
    version: row.version,
  };
}

function mapIdeaRow(row: IdeaRow): IdeaItemData {
  const idea: IdeaItemData = {
    id: row.id,
    groupId: row.group_id,
    title: row.title,
    desc: row.desc,
    createdAtLabel: row.created_at_label,
    daysInactive: row.days_inactive,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    syncStatus: row.sync_status,
    version: row.version,
  };
  if (row.markdown_content !== null) idea.markdownContent = row.markdown_content;
  if (row.suggested_action !== null) idea.suggestedAction = row.suggested_action;
  return idea;
}

function mapChatRow(row: ChatRow): ChatMessage {
  const msg: ChatMessage = {
    id: row.id,
    role: row.role,
    text: row.text,
    timestamp: row.timestamp,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    syncStatus: row.sync_status,
    version: row.version,
  };
  const classified = safeJsonParse<ChatMessageClassifiedItem[]>(
    row.classified_items_json
  );
  if (classified) msg.classifiedItems = classified;
  return msg;
}

function mapAlertRow(row: AlertRow): AppAlert {
  const alert: AppAlert = {
    id: row.id,
    type: row.type,
    title: row.title,
    subtitle: row.subtitle,
    badgeText: row.badge_text,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    syncStatus: row.sync_status,
    version: row.version,
  };
  if (row.related_id !== null) alert.relatedId = row.related_id;
  return alert;
}

async function openExpoSQLiteExecutor(): Promise<SQLiteExecutor> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SQLiteModule = require('expo-sqlite') as {
    openDatabaseAsync: (
      name: string
    ) => Promise<SQLiteExecutor & { closeAsync?: () => Promise<void> }>;
  };
  return SQLiteModule.openDatabaseAsync('daycraft_v9.db');
}

/**
 * Repositorio SQLite real (`expo-sqlite` o cualquier `SQLiteExecutor` compatible)
 * con migraciones versionadas (`PRAGMA user_version`) y cola FIFO de escrituras.
 */
export class ExpoSQLiteDayCraftRepository implements DayCraftRepository {
  private db: (SQLiteExecutor & { closeAsync?: () => Promise<void> }) | null =
    null;
  private readonly executorOrFactory:
    | SQLiteExecutor
    | (() => Promise<SQLiteExecutor>);
  private initPromise: Promise<void> | null = null;
  private closePromise: Promise<void> | null = null;
  private writeChain: Promise<unknown> = Promise.resolve();

  constructor(
    executorOrFactory?: SQLiteExecutor | (() => Promise<SQLiteExecutor>)
  ) {
    this.executorOrFactory = executorOrFactory ?? openExpoSQLiteExecutor;
  }

  private enqueueOperation<T>(
    fn: (db: SQLiteExecutor) => Promise<T>
  ): Promise<T> {
    if (this.closePromise) {
      return this.closePromise.then(() => this.enqueueOperation(fn));
    }
    const execute = async () => {
      const db = await this.ensureDb();
      return fn(db);
    };
    const run = this.writeChain.then(execute, execute);
    this.writeChain = run.catch(() => undefined);
    return run;
  }

  private enqueueWrite<T>(fn: (db: SQLiteExecutor) => Promise<T>): Promise<T> {
    return this.enqueueOperation(fn);
  }

  private enqueueRead<T>(fn: (db: SQLiteExecutor) => Promise<T>): Promise<T> {
    return this.enqueueOperation(fn);
  }

  private async ensureInitialized(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const resolved =
        typeof this.executorOrFactory === 'function'
          ? await this.executorOrFactory()
          : this.executorOrFactory;
      try {
        await resolved.execAsync('PRAGMA journal_mode = WAL;');
      } catch {
        // Ignore if backend does not support WAL (e.g., certain test executors)
      }
      await runMigrations(resolved);
      this.db = resolved as SQLiteExecutor & {
        closeAsync?: () => Promise<void>;
      };
    })();

    try {
      await this.initPromise;
    } catch (err) {
      this.initPromise = null;
      throw err;
    }
  }

  private async ensureDb(): Promise<SQLiteExecutor> {
    if (!this.db) {
      await this.ensureInitialized();
    }
    if (!this.db) {
      throw new Error('SQLite database is not initialized');
    }
    return this.db;
  }

  private async withTransaction(
    db: SQLiteExecutor,
    fn: () => Promise<void>
  ): Promise<void> {
    if (db.withTransactionAsync) {
      await db.withTransactionAsync(fn);
    } else {
      await fn();
    }
  }

  private async insertOutboxEntry(
    db: SQLiteExecutor,
    entry: Omit<SyncOutboxEntry, 'id' | 'createdAt' | 'attempts'> &
      Partial<Pick<SyncOutboxEntry, 'id' | 'createdAt' | 'attempts'>>
  ): Promise<SyncOutboxEntry> {
    const saved: SyncOutboxEntry = {
      id: entry.id ?? nextOutboxId(),
      entityType: entry.entityType,
      entityId: entry.entityId,
      operation: entry.operation,
      payload: entry.payload,
      createdAt: entry.createdAt ?? new Date().toISOString(),
      attempts: entry.attempts ?? 0,
    };
    await db.runAsync(
      `INSERT INTO sync_outbox (id, entity_type, entity_id, operation, payload, created_at, attempts)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      saved.id,
      saved.entityType,
      saved.entityId,
      saved.operation,
      saved.payload,
      saved.createdAt,
      saved.attempts
    );
    return saved;
  }

  async init(): Promise<void> {
    while (this.closePromise) {
      await this.closePromise;
    }
    await this.ensureInitialized();
  }

  async close(): Promise<void> {
    if (this.closePromise) {
      return this.closePromise;
    }
    this.closePromise = (async () => {
      try {
        if (this.initPromise) {
          try {
            await this.initPromise;
          } catch {
            // Ignore init error during close
          }
        }
        let pending = this.writeChain;
        await pending;
        while (pending !== this.writeChain) {
          pending = this.writeChain;
          await pending;
        }
        const dbToClose = this.db;
        this.db = null;
        this.initPromise = null;
        if (dbToClose?.closeAsync) {
          await dbToClose.closeAsync();
        }
      } finally {
        this.closePromise = null;
      }
    })();
    return this.closePromise;
  }

  async getSchemaVersion(): Promise<number> {
    return this.enqueueRead(async (db) => {
      const row = await db.getFirstAsync<{ user_version: number }>(
        'PRAGMA user_version'
      );
      return row?.user_version ?? 0;
    });
  }

  private async readMeta(
    db: SQLiteExecutor,
    key: string
  ): Promise<string | null> {
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_meta WHERE key = ?',
      key
    );
    return row?.value ?? null;
  }

  private async readKv<T>(
    db: SQLiteExecutor,
    key: string
  ): Promise<T | null> {
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM kv_store WHERE key = ?',
      key
    );
    if (!row) return null;
    return safeJsonParse<T>(row.value);
  }

  private async readIsSeedInitialized(db: SQLiteExecutor): Promise<boolean> {
    const val = await this.readMeta(db, 'seed_initialized');
    return val === 'true' || val === '1';
  }

  async isSeedInitialized(): Promise<boolean> {
    return this.enqueueRead((db) => this.readIsSeedInitialized(db));
  }

  async seedIfNeeded(seed: RepositorySeedPayload): Promise<boolean> {
    return this.enqueueWrite(async (db) => {
      const existing = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM app_meta WHERE key = ?',
        'seed_initialized'
      );
      if (existing && (existing.value === 'true' || existing.value === '1')) {
        return false;
      }

      const nowIso = new Date().toISOString();
      await this.withTransaction(db, async () => {
        await this.writeAllEvents(db, seed.events, false);
        await this.writeAllPending(db, seed.pendingTasks, false);
        await this.writeAllIdeaGroups(db, seed.ideaGroups, false);
        await this.writeAllChat(db, seed.chatMessages, false);
        await this.writeAllAlerts(db, seed.alerts, false);

        if (
          seed.lastOpenedDate !== undefined &&
          seed.lastOpenedDate !== null
        ) {
          await db.runAsync(
            'INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)',
            'last_opened_date',
            seed.lastOpenedDate,
            nowIso
          );
        }
        await db.runAsync(
          'INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)',
          'seed_initialized',
          'true',
          nowIso
        );
      });
      return true;
    });
  }

  async getSnapshot(): Promise<DayCraftSnapshot> {
    return this.enqueueRead(async (db) => {
      const events = await this.readEvents(db);
      const pendingTasks = await this.readPendingTasks(db, {
        includeArchived: true,
      });
      const ideaGroups = await this.readIdeaGroups(db);
      const chatMessages = await this.readChatMessages(db);
      const alerts = await this.readAlerts(db);
      const metaLastOpened = await this.readMeta(db, 'last_opened_date');
      const kvLastOpened = await this.readKv<unknown>(
        db,
        'last_opened_date_v9'
      );
      const metaGemini = await this.readMeta(db, 'gemini_config');
      const kvGemini = await this.readKv<unknown>(
        db,
        'gemini_config_v9'
      );
      const seedInitialized = await this.readIsSeedInitialized(db);

      const { lastOpenedDate, geminiConfig } = resolveSnapshotConfig(
        metaLastOpened,
        kvLastOpened,
        metaGemini,
        kvGemini
      );

      return {
        events,
        pendingTasks,
        ideaGroups,
        chatMessages,
        alerts,
        lastOpenedDate,
        geminiConfig,
        seedInitialized,
      };
    });
  }

  // Events
  private async readEvents(
    db: SQLiteExecutor,
    options?: {
      dayKey?: string;
      includeDeleted?: boolean;
    }
  ): Promise<TimelineEvent[]> {
    const clauses: string[] = [];
    const params: SQLiteBindValue[] = [];

    if (!options?.includeDeleted) {
      clauses.push('deleted_at IS NULL');
    }
    if (options?.dayKey) {
      clauses.push('day_key = ?');
      params.push(options.dayKey);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await db.getAllAsync<EventRow>(
      `SELECT * FROM events ${where} ORDER BY day_key ASC, start_q ASC`,
      ...params
    );
    return rows.map(mapEventRow);
  }

  async listEvents(options?: {
    dayKey?: string;
    includeDeleted?: boolean;
  }): Promise<TimelineEvent[]> {
    return this.enqueueRead((db) => this.readEvents(db, options));
  }

  async getEventById(id: string): Promise<TimelineEvent | null> {
    return this.enqueueRead(async (db) => {
      const row = await db.getFirstAsync<EventRow>(
        'SELECT * FROM events WHERE id = ? AND deleted_at IS NULL',
        id
      );
      return row ? mapEventRow(row) : null;
    });
  }

  async upsertEvent(
    event: TimelineEvent,
    options?: RepositoryWriteOptions
  ): Promise<TimelineEvent> {
    return this.enqueueWrite(async (db) => {
      const existingRow = await db.getFirstAsync<EventRow>(
        'SELECT * FROM events WHERE id = ?',
        event.id
      );
      const existing = existingRow ? mapEventRow(existingRow) : undefined;
      const saved = stampEntity(event, existing, options);

      await this.withTransaction(db, async () => {
        await db.runAsync(
          `INSERT INTO events (
            id, day_key, title, "desc", start_q, quarters, type, tag, completed,
            recurrence_json, updated_at, deleted_at, sync_status, version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            day_key = excluded.day_key,
            title = excluded.title,
            "desc" = excluded."desc",
            start_q = excluded.start_q,
            quarters = excluded.quarters,
            type = excluded.type,
            tag = excluded.tag,
            completed = excluded.completed,
            recurrence_json = excluded.recurrence_json,
            updated_at = excluded.updated_at,
            deleted_at = excluded.deleted_at,
            sync_status = excluded.sync_status,
            version = excluded.version`,
          saved.id,
          saved.dayKey,
          saved.title,
          saved.desc ?? null,
          saved.startQ,
          saved.quarters,
          saved.type,
          saved.tag ?? null,
          saved.completed ? 1 : 0,
          saved.recurrence ? JSON.stringify(saved.recurrence) : null,
          saved.updatedAt!,
          saved.deletedAt ?? null,
          saved.syncStatus!,
          saved.version!
        );

        if (options?.enqueueSync !== false) {
          await this.insertOutboxEntry(db, {
            entityType: 'event',
            entityId: saved.id,
            operation: 'upsert',
            payload: JSON.stringify(saved),
          });
        }
      });

      return saved;
    });
  }

  async deleteEvent(
    id: string,
    options?: RepositoryWriteOptions
  ): Promise<void> {
    await this.enqueueWrite(async (db) => {
      const nowIso = new Date().toISOString();
      await this.withTransaction(db, async () => {
        if (options?.soft) {
          await db.runAsync(
            `UPDATE events
             SET deleted_at = ?, updated_at = ?, sync_status = ?, version = version + 1
             WHERE id = ?`,
            nowIso,
            nowIso,
            options?.enqueueSync !== false ? 'pending' : 'synced',
            id
          );
        } else {
          await db.runAsync('DELETE FROM events WHERE id = ?', id);
        }
        if (options?.enqueueSync !== false) {
          await this.insertOutboxEntry(db, {
            entityType: 'event',
            entityId: id,
            operation: 'delete',
            payload: JSON.stringify({
              id,
              deletedAt: options?.soft ? nowIso : null,
            }),
          });
        }
      });
    });
  }

  private async writeAllEvents(
    db: SQLiteExecutor,
    events: TimelineEvent[],
    enqueueSync: boolean
  ): Promise<void> {
    await db.runAsync('DELETE FROM events');
    for (const ev of events) {
      const saved = stampEntity(ev, undefined, { enqueueSync });
      await db.runAsync(
        `INSERT OR REPLACE INTO events (
          id, day_key, title, "desc", start_q, quarters, type, tag, completed,
          recurrence_json, updated_at, deleted_at, sync_status, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        saved.id,
        saved.dayKey,
        saved.title,
        saved.desc ?? null,
        saved.startQ,
        saved.quarters,
        saved.type,
        saved.tag ?? null,
        saved.completed ? 1 : 0,
        saved.recurrence ? JSON.stringify(saved.recurrence) : null,
        saved.updatedAt!,
        saved.deletedAt ?? null,
        saved.syncStatus!,
        saved.version!
      );
      if (enqueueSync) {
        await this.insertOutboxEntry(db, {
          entityType: 'event',
          entityId: saved.id,
          operation: 'upsert',
          payload: JSON.stringify(saved),
        });
      }
    }
  }

  async replaceAllEvents(
    events: TimelineEvent[],
    options?: RepositoryWriteOptions
  ): Promise<void> {
    await this.enqueueWrite(async (db) => {
      await this.withTransaction(db, async () => {
        await this.writeAllEvents(
          db,
          events,
          options?.enqueueSync === true
        );
      });
    });
  }

  // Pending Tasks
  private async readPendingTasks(
    db: SQLiteExecutor,
    options?: {
      includeArchived?: boolean;
      includeDeleted?: boolean;
    }
  ): Promise<PendingTask[]> {
    const clauses: string[] = [];
    if (!options?.includeDeleted) clauses.push('deleted_at IS NULL');
    if (!options?.includeArchived) clauses.push('archived = 0');
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await db.getAllAsync<PendingRow>(
      `SELECT * FROM pending_tasks ${where} ORDER BY rowid ASC`
    );
    return rows.map(mapPendingRow);
  }

  async listPendingTasks(options?: {
    includeArchived?: boolean;
    includeDeleted?: boolean;
  }): Promise<PendingTask[]> {
    return this.enqueueRead((db) => this.readPendingTasks(db, options));
  }

  async getPendingTaskById(id: string): Promise<PendingTask | null> {
    return this.enqueueRead(async (db) => {
      const row = await db.getFirstAsync<PendingRow>(
        'SELECT * FROM pending_tasks WHERE id = ? AND deleted_at IS NULL',
        id
      );
      return row ? mapPendingRow(row) : null;
    });
  }

  async upsertPendingTask(
    task: PendingTask,
    options?: RepositoryWriteOptions
  ): Promise<PendingTask> {
    return this.enqueueWrite(async (db) => {
      const existingRow = await db.getFirstAsync<PendingRow>(
        'SELECT * FROM pending_tasks WHERE id = ?',
        task.id
      );
      const existing = existingRow ? mapPendingRow(existingRow) : undefined;
      const saved = stampEntity(task, existing, options);

      await this.withTransaction(db, async () => {
        await db.runAsync(
          `INSERT INTO pending_tasks (
            id, title, completed, is_from_yesterday, rollover_days, created_at,
            archived, updated_at, deleted_at, sync_status, version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            completed = excluded.completed,
            is_from_yesterday = excluded.is_from_yesterday,
            rollover_days = excluded.rollover_days,
            created_at = excluded.created_at,
            archived = excluded.archived,
            updated_at = excluded.updated_at,
            deleted_at = excluded.deleted_at,
            sync_status = excluded.sync_status,
            version = excluded.version`,
          saved.id,
          saved.title,
          saved.completed ? 1 : 0,
          saved.isFromYesterday ? 1 : 0,
          saved.rolloverDays,
          saved.createdAt,
          saved.archived ? 1 : 0,
          saved.updatedAt!,
          saved.deletedAt ?? null,
          saved.syncStatus!,
          saved.version!
        );

        if (options?.enqueueSync !== false) {
          await this.insertOutboxEntry(db, {
            entityType: 'pending',
            entityId: saved.id,
            operation: 'upsert',
            payload: JSON.stringify(saved),
          });
        }
      });
      return saved;
    });
  }

  async deletePendingTask(
    id: string,
    options?: RepositoryWriteOptions
  ): Promise<void> {
    await this.enqueueWrite(async (db) => {
      const nowIso = new Date().toISOString();
      await this.withTransaction(db, async () => {
        if (options?.soft) {
          await db.runAsync(
            `UPDATE pending_tasks
             SET deleted_at = ?, updated_at = ?, sync_status = ?, version = version + 1
             WHERE id = ?`,
            nowIso,
            nowIso,
            options?.enqueueSync !== false ? 'pending' : 'synced',
            id
          );
        } else {
          await db.runAsync('DELETE FROM pending_tasks WHERE id = ?', id);
        }
        if (options?.enqueueSync !== false) {
          await this.insertOutboxEntry(db, {
            entityType: 'pending',
            entityId: id,
            operation: 'delete',
            payload: JSON.stringify({
              id,
              deletedAt: options?.soft ? nowIso : null,
            }),
          });
        }
      });
    });
  }

  private async writeAllPending(
    db: SQLiteExecutor,
    tasks: PendingTask[],
    enqueueSync: boolean
  ): Promise<void> {
    await db.runAsync('DELETE FROM pending_tasks');
    for (const task of tasks) {
      const saved = stampEntity(task, undefined, { enqueueSync });
      await db.runAsync(
        `INSERT OR REPLACE INTO pending_tasks (
          id, title, completed, is_from_yesterday, rollover_days, created_at,
          archived, updated_at, deleted_at, sync_status, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        saved.id,
        saved.title,
        saved.completed ? 1 : 0,
        saved.isFromYesterday ? 1 : 0,
        saved.rolloverDays,
        saved.createdAt,
        saved.archived ? 1 : 0,
        saved.updatedAt!,
        saved.deletedAt ?? null,
        saved.syncStatus!,
        saved.version!
      );
      if (enqueueSync) {
        await this.insertOutboxEntry(db, {
          entityType: 'pending',
          entityId: saved.id,
          operation: 'upsert',
          payload: JSON.stringify(saved),
        });
      }
    }
  }

  async replaceAllPendingTasks(
    tasks: PendingTask[],
    options?: RepositoryWriteOptions
  ): Promise<void> {
    await this.enqueueWrite(async (db) => {
      await this.withTransaction(db, async () => {
        await this.writeAllPending(db, tasks, options?.enqueueSync === true);
      });
    });
  }

  // Idea Groups & Ideas
  private async readIdeaGroups(
    db: SQLiteExecutor,
    options?: {
      includeDeleted?: boolean;
    }
  ): Promise<IdeaGroup[]> {
    const includeDeleted = options?.includeDeleted ?? false;
    const groupWhere = includeDeleted ? '' : 'WHERE deleted_at IS NULL';
    const ideaWhere = includeDeleted ? '' : 'WHERE deleted_at IS NULL';

    const groupRows = await db.getAllAsync<IdeaGroupRow>(
      `SELECT * FROM idea_groups ${groupWhere} ORDER BY sort_order ASC`
    );
    const ideaRows = await db.getAllAsync<IdeaRow>(
      `SELECT * FROM ideas ${ideaWhere} ORDER BY sort_order ASC`
    );

    const itemsByGroup = new Map<string, IdeaItemData[]>();
    for (const row of ideaRows) {
      const list = itemsByGroup.get(row.group_id) ?? [];
      list.push(mapIdeaRow(row));
      itemsByGroup.set(row.group_id, list);
    }

    return groupRows.map((row) => ({
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      icon: row.icon,
      accentColor: row.accent_color,
      items: itemsByGroup.get(row.id) ?? [],
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
      syncStatus: row.sync_status,
      version: row.version,
    }));
  }

  async listIdeaGroups(options?: {
    includeDeleted?: boolean;
  }): Promise<IdeaGroup[]> {
    return this.enqueueRead((db) => this.readIdeaGroups(db, options));
  }

  async getIdeaGroupById(id: string): Promise<IdeaGroup | null> {
    return this.enqueueRead(async (db) => {
      const row = await db.getFirstAsync<IdeaGroupRow>(
        'SELECT * FROM idea_groups WHERE id = ? AND deleted_at IS NULL',
        id
      );
      if (!row) return null;
      const ideaRows = await db.getAllAsync<IdeaRow>(
        'SELECT * FROM ideas WHERE group_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC',
        id
      );
      return {
        id: row.id,
        title: row.title,
        subtitle: row.subtitle,
        icon: row.icon,
        accentColor: row.accent_color,
        items: ideaRows.map(mapIdeaRow),
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at,
        syncStatus: row.sync_status,
        version: row.version,
      };
    });
  }

  async upsertIdeaGroup(
    group: IdeaGroup,
    options?: RepositoryWriteOptions
  ): Promise<IdeaGroup> {
    return this.enqueueWrite(async (db) => {
      const existingRow = await db.getFirstAsync<IdeaGroupRow>(
        'SELECT * FROM idea_groups WHERE id = ?',
        group.id
      );
      const existingMeta: SyncEntityMetadata | undefined = existingRow
        ? {
            updatedAt: existingRow.updated_at,
            deletedAt: existingRow.deleted_at,
            syncStatus: existingRow.sync_status,
            version: existingRow.version,
          }
        : undefined;
      let sortOrder = existingRow?.sort_order;
      if (sortOrder === undefined) {
        const maxRow = await db.getFirstAsync<{ max_order: number | null }>(
          'SELECT MAX(sort_order) AS max_order FROM idea_groups'
        );
        sortOrder = (maxRow?.max_order ?? -1) + 1;
      }
      const saved = stampEntity(
        group,
        existingMeta as IdeaGroup | undefined,
        options
      );

      await this.withTransaction(db, async () => {
        await db.runAsync(
          `INSERT INTO idea_groups (
            id, title, subtitle, icon, accent_color, sort_order,
            updated_at, deleted_at, sync_status, version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            subtitle = excluded.subtitle,
            icon = excluded.icon,
            accent_color = excluded.accent_color,
            sort_order = excluded.sort_order,
            updated_at = excluded.updated_at,
            deleted_at = excluded.deleted_at,
            sync_status = excluded.sync_status,
            version = excluded.version`,
          saved.id,
          saved.title,
          saved.subtitle,
          saved.icon,
          saved.accentColor,
          sortOrder,
          saved.updatedAt!,
          saved.deletedAt ?? null,
          saved.syncStatus!,
          saved.version!
        );

        const items = saved.items ?? [];
        const savedItems: IdeaItemData[] = [];
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          const prevIdeaRow = await db.getFirstAsync<IdeaRow>(
            'SELECT * FROM ideas WHERE id = ?',
            item.id
          );
          const prevIdea = prevIdeaRow ? mapIdeaRow(prevIdeaRow) : undefined;
          const savedItem = stampEntity(
            { ...item, groupId: saved.id },
            prevIdea,
            options
          );
          savedItems.push(savedItem);
          await db.runAsync(
            `INSERT INTO ideas (
              id, group_id, title, "desc", markdown_content, created_at_label,
              days_inactive, suggested_action, sort_order,
              updated_at, deleted_at, sync_status, version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              group_id = excluded.group_id,
              title = excluded.title,
              "desc" = excluded."desc",
              markdown_content = excluded.markdown_content,
              created_at_label = excluded.created_at_label,
              days_inactive = excluded.days_inactive,
              suggested_action = excluded.suggested_action,
              sort_order = excluded.sort_order,
              updated_at = excluded.updated_at,
              deleted_at = excluded.deleted_at,
              sync_status = excluded.sync_status,
              version = excluded.version`,
            savedItem.id,
            saved.id,
            savedItem.title,
            savedItem.desc,
            savedItem.markdownContent ?? null,
            savedItem.createdAtLabel,
            savedItem.daysInactive,
            savedItem.suggestedAction ?? null,
            idx,
            savedItem.updatedAt!,
            savedItem.deletedAt ?? null,
            savedItem.syncStatus!,
            savedItem.version!
          );
        }
        if (savedItems.length === 0) {
          await db.runAsync(
            'DELETE FROM ideas WHERE group_id = ? AND deleted_at IS NULL',
            saved.id
          );
        } else {
          const placeholders = savedItems.map(() => '?').join(', ');
          await db.runAsync(
            `DELETE FROM ideas WHERE group_id = ? AND deleted_at IS NULL AND id NOT IN (${placeholders})`,
            saved.id,
            ...savedItems.map((i) => i.id)
          );
        }
        saved.items = savedItems;

        if (options?.enqueueSync !== false) {
          await this.insertOutboxEntry(db, {
            entityType: 'idea_group',
            entityId: saved.id,
            operation: 'upsert',
            payload: JSON.stringify(saved),
          });
        }
      });

      return saved;
    });
  }

  async deleteIdeaGroup(
    id: string,
    options?: RepositoryWriteOptions
  ): Promise<void> {
    await this.enqueueWrite(async (db) => {
      const nowIso = new Date().toISOString();
      await this.withTransaction(db, async () => {
        if (options?.soft) {
          await db.runAsync(
            `UPDATE idea_groups
             SET deleted_at = ?, updated_at = ?, sync_status = ?, version = version + 1
             WHERE id = ?`,
            nowIso,
            nowIso,
            options?.enqueueSync !== false ? 'pending' : 'synced',
            id
          );
        } else {
          await db.runAsync('DELETE FROM idea_groups WHERE id = ?', id);
        }
        if (options?.enqueueSync !== false) {
          await this.insertOutboxEntry(db, {
            entityType: 'idea_group',
            entityId: id,
            operation: 'delete',
            payload: JSON.stringify({
              id,
              deletedAt: options?.soft ? nowIso : null,
            }),
          });
        }
      });
    });
  }

  private async readIdeas(
    db: SQLiteExecutor,
    options?: {
      groupId?: string;
      includeDeleted?: boolean;
    }
  ): Promise<IdeaItemData[]> {
    const clauses: string[] = [];
    const params: SQLiteBindValue[] = [];
    if (!options?.includeDeleted) {
      clauses.push('i.deleted_at IS NULL');
      clauses.push('g.deleted_at IS NULL');
    }
    if (options?.groupId) {
      clauses.push('i.group_id = ?');
      params.push(options.groupId);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await db.getAllAsync<IdeaRow>(
      `SELECT i.* FROM ideas i
       INNER JOIN idea_groups g ON g.id = i.group_id
       ${where}
       ORDER BY g.sort_order ASC, i.sort_order ASC`,
      ...params
    );
    return rows.map(mapIdeaRow);
  }

  async listIdeas(options?: {
    groupId?: string;
    includeDeleted?: boolean;
  }): Promise<IdeaItemData[]> {
    return this.enqueueRead((db) => this.readIdeas(db, options));
  }

  async getIdeaById(id: string): Promise<IdeaItemData | null> {
    return this.enqueueRead(async (db) => {
      const row = await db.getFirstAsync<IdeaRow>(
        `SELECT i.* FROM ideas i
         INNER JOIN idea_groups g ON g.id = i.group_id
         WHERE i.id = ? AND i.deleted_at IS NULL AND g.deleted_at IS NULL`,
        id
      );
      return row ? mapIdeaRow(row) : null;
    });
  }

  async upsertIdea(
    idea: IdeaItemData,
    options?: RepositoryWriteOptions
  ): Promise<IdeaItemData> {
    return this.enqueueWrite(async (db) => {
      const existingRow = await db.getFirstAsync<IdeaRow>(
        'SELECT * FROM ideas WHERE id = ?',
        idea.id
      );
      const existing = existingRow ? mapIdeaRow(existingRow) : undefined;
      const saved = stampEntity(idea, existing, options);

      await this.withTransaction(db, async () => {
        const groupExists = await db.getFirstAsync<{ id: string }>(
          'SELECT id FROM idea_groups WHERE id = ?',
          saved.groupId
        );
        if (!groupExists) {
          const nowIso = new Date().toISOString();
          await db.runAsync(
            `INSERT INTO idea_groups (
              id, title, subtitle, icon, accent_color, sort_order,
              updated_at, deleted_at, sync_status, version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            saved.groupId,
            saved.groupId === 'grp-sparks' ? 'Chispazos Libres' : 'Proyecto',
            'Grupo de ideas',
            'sparkle',
            'amber',
            99,
            nowIso,
            null,
            'synced',
            1
          );
        }

        let sortOrder =
          existingRow && existingRow.group_id === saved.groupId
            ? existingRow.sort_order
            : undefined;
        if (sortOrder === undefined) {
          const maxRow = await db.getFirstAsync<{ max_order: number | null }>(
            'SELECT MAX(sort_order) AS max_order FROM ideas WHERE group_id = ?',
            saved.groupId
          );
          sortOrder = (maxRow?.max_order ?? -1) + 1;
        }

        await db.runAsync(
          `INSERT INTO ideas (
            id, group_id, title, "desc", markdown_content, created_at_label,
            days_inactive, suggested_action, sort_order,
            updated_at, deleted_at, sync_status, version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            group_id = excluded.group_id,
            title = excluded.title,
            "desc" = excluded."desc",
            markdown_content = excluded.markdown_content,
            created_at_label = excluded.created_at_label,
            days_inactive = excluded.days_inactive,
            suggested_action = excluded.suggested_action,
            sort_order = excluded.sort_order,
            updated_at = excluded.updated_at,
            deleted_at = excluded.deleted_at,
            sync_status = excluded.sync_status,
            version = excluded.version`,
          saved.id,
          saved.groupId,
          saved.title,
          saved.desc,
          saved.markdownContent ?? null,
          saved.createdAtLabel,
          saved.daysInactive,
          saved.suggestedAction ?? null,
          sortOrder,
          saved.updatedAt!,
          saved.deletedAt ?? null,
          saved.syncStatus!,
          saved.version!
        );

        if (options?.enqueueSync !== false) {
          await this.insertOutboxEntry(db, {
            entityType: 'idea',
            entityId: saved.id,
            operation: 'upsert',
            payload: JSON.stringify(saved),
          });
        }
      });

      return saved;
    });
  }

  async deleteIdea(
    id: string,
    options?: RepositoryWriteOptions
  ): Promise<void> {
    await this.enqueueWrite(async (db) => {
      const nowIso = new Date().toISOString();
      await this.withTransaction(db, async () => {
        if (options?.soft) {
          await db.runAsync(
            `UPDATE ideas
             SET deleted_at = ?, updated_at = ?, sync_status = ?, version = version + 1
             WHERE id = ?`,
            nowIso,
            nowIso,
            options?.enqueueSync !== false ? 'pending' : 'synced',
            id
          );
        } else {
          await db.runAsync('DELETE FROM ideas WHERE id = ?', id);
        }
        if (options?.enqueueSync !== false) {
          await this.insertOutboxEntry(db, {
            entityType: 'idea',
            entityId: id,
            operation: 'delete',
            payload: JSON.stringify({
              id,
              deletedAt: options?.soft ? nowIso : null,
            }),
          });
        }
      });
    });
  }

  private async readSearchIdeas(
    db: SQLiteExecutor,
    query: string
  ): Promise<IdeaItemData[]> {
    const normalized = query.trim().toLowerCase();
    const activeIdeas = await this.readIdeas(db, { includeDeleted: false });
    if (!normalized) {
      return activeIdeas;
    }

    return activeIdeas.filter((item) => {
      const haystack = [
        item.title,
        item.desc,
        item.markdownContent ?? '',
        item.suggestedAction ?? '',
      ]
        .join('\n')
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }

  async searchIdeas(query: string): Promise<IdeaItemData[]> {
    return this.enqueueRead((db) => this.readSearchIdeas(db, query));
  }

  private async writeAllIdeaGroups(
    db: SQLiteExecutor,
    groups: IdeaGroup[],
    enqueueSync: boolean
  ): Promise<void> {
    await db.runAsync('DELETE FROM ideas');
    await db.runAsync('DELETE FROM idea_groups');

    for (let gIdx = 0; gIdx < groups.length; gIdx++) {
      const group = groups[gIdx];
      const savedGroup = stampEntity(group, undefined, { enqueueSync });
      await db.runAsync(
        `INSERT OR REPLACE INTO idea_groups (
          id, title, subtitle, icon, accent_color, sort_order,
          updated_at, deleted_at, sync_status, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        savedGroup.id,
        savedGroup.title,
        savedGroup.subtitle,
        savedGroup.icon,
        savedGroup.accentColor,
        gIdx,
        savedGroup.updatedAt!,
        savedGroup.deletedAt ?? null,
        savedGroup.syncStatus!,
        savedGroup.version!
      );

      const items = group.items ?? [];
      for (let iIdx = 0; iIdx < items.length; iIdx++) {
        const item = items[iIdx];
        const savedItem = stampEntity(
          { ...item, groupId: savedGroup.id },
          undefined,
          { enqueueSync }
        );
        await db.runAsync(
          `INSERT OR REPLACE INTO ideas (
            id, group_id, title, "desc", markdown_content, created_at_label,
            days_inactive, suggested_action, sort_order,
            updated_at, deleted_at, sync_status, version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          savedItem.id,
          savedGroup.id,
          savedItem.title,
          savedItem.desc,
          savedItem.markdownContent ?? null,
          savedItem.createdAtLabel,
          savedItem.daysInactive,
          savedItem.suggestedAction ?? null,
          iIdx,
          savedItem.updatedAt!,
          savedItem.deletedAt ?? null,
          savedItem.syncStatus!,
          savedItem.version!
        );
      }

      if (enqueueSync) {
        await this.insertOutboxEntry(db, {
          entityType: 'idea_group',
          entityId: savedGroup.id,
          operation: 'upsert',
          payload: JSON.stringify(savedGroup),
        });
      }
    }
  }

  async replaceAllIdeaGroups(
    groups: IdeaGroup[],
    options?: RepositoryWriteOptions
  ): Promise<void> {
    await this.enqueueWrite(async (db) => {
      await this.withTransaction(db, async () => {
        await this.writeAllIdeaGroups(
          db,
          groups,
          options?.enqueueSync === true
        );
      });
    });
  }

  // Chat Messages
  private async readChatMessages(
    db: SQLiteExecutor,
    options?: {
      includeDeleted?: boolean;
    }
  ): Promise<ChatMessage[]> {
    const where = options?.includeDeleted ? '' : 'WHERE deleted_at IS NULL';
    const rows = await db.getAllAsync<ChatRow>(
      `SELECT * FROM chat_messages ${where} ORDER BY sort_order ASC`
    );
    return rows.map(mapChatRow);
  }

  async listChatMessages(options?: {
    includeDeleted?: boolean;
  }): Promise<ChatMessage[]> {
    return this.enqueueRead((db) => this.readChatMessages(db, options));
  }

  async upsertChatMessage(
    message: ChatMessage,
    options?: RepositoryWriteOptions
  ): Promise<ChatMessage> {
    return this.enqueueWrite(async (db) => {
      const existingRow = await db.getFirstAsync<ChatRow>(
        'SELECT * FROM chat_messages WHERE id = ?',
        message.id
      );
      const existing = existingRow ? mapChatRow(existingRow) : undefined;
      const saved = stampEntity(message, existing, options);

      let sortOrder = existingRow?.sort_order;
      if (sortOrder === undefined) {
        const maxRow = await db.getFirstAsync<{ max_order: number | null }>(
          'SELECT MAX(sort_order) AS max_order FROM chat_messages'
        );
        sortOrder = (maxRow?.max_order ?? -1) + 1;
      }

      await this.withTransaction(db, async () => {
        await db.runAsync(
          `INSERT INTO chat_messages (
            id, role, text, timestamp, classified_items_json, sort_order,
            updated_at, deleted_at, sync_status, version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            role = excluded.role,
            text = excluded.text,
            timestamp = excluded.timestamp,
            classified_items_json = excluded.classified_items_json,
            sort_order = excluded.sort_order,
            updated_at = excluded.updated_at,
            deleted_at = excluded.deleted_at,
            sync_status = excluded.sync_status,
            version = excluded.version`,
          saved.id,
          saved.role,
          saved.text,
          saved.timestamp,
          saved.classifiedItems ? JSON.stringify(saved.classifiedItems) : null,
          sortOrder,
          saved.updatedAt!,
          saved.deletedAt ?? null,
          saved.syncStatus!,
          saved.version!
        );

        if (options?.enqueueSync !== false) {
          await this.insertOutboxEntry(db, {
            entityType: 'chat',
            entityId: saved.id,
            operation: 'upsert',
            payload: JSON.stringify(saved),
          });
        }
      });
      return saved;
    });
  }

  async deleteChatMessage(
    id: string,
    options?: RepositoryWriteOptions
  ): Promise<void> {
    await this.enqueueWrite(async (db) => {
      const nowIso = new Date().toISOString();
      await this.withTransaction(db, async () => {
        if (options?.soft) {
          await db.runAsync(
            `UPDATE chat_messages
             SET deleted_at = ?, updated_at = ?, sync_status = ?, version = version + 1
             WHERE id = ?`,
            nowIso,
            nowIso,
            options?.enqueueSync !== false ? 'pending' : 'synced',
            id
          );
        } else {
          await db.runAsync('DELETE FROM chat_messages WHERE id = ?', id);
        }
        if (options?.enqueueSync !== false) {
          await this.insertOutboxEntry(db, {
            entityType: 'chat',
            entityId: id,
            operation: 'delete',
            payload: JSON.stringify({
              id,
              deletedAt: options?.soft ? nowIso : null,
            }),
          });
        }
      });
    });
  }

  private async writeAllChat(
    db: SQLiteExecutor,
    messages: ChatMessage[],
    enqueueSync: boolean
  ): Promise<void> {
    await db.runAsync('DELETE FROM chat_messages');
    for (let idx = 0; idx < messages.length; idx++) {
      const msg = messages[idx];
      const saved = stampEntity(msg, undefined, { enqueueSync });
      await db.runAsync(
        `INSERT OR REPLACE INTO chat_messages (
          id, role, text, timestamp, classified_items_json, sort_order,
          updated_at, deleted_at, sync_status, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        saved.id,
        saved.role,
        saved.text,
        saved.timestamp,
        saved.classifiedItems ? JSON.stringify(saved.classifiedItems) : null,
        idx,
        saved.updatedAt!,
        saved.deletedAt ?? null,
        saved.syncStatus!,
        saved.version!
      );
      if (enqueueSync) {
        await this.insertOutboxEntry(db, {
          entityType: 'chat',
          entityId: saved.id,
          operation: 'upsert',
          payload: JSON.stringify(saved),
        });
      }
    }
  }

  async replaceAllChatMessages(
    messages: ChatMessage[],
    options?: RepositoryWriteOptions
  ): Promise<void> {
    await this.enqueueWrite(async (db) => {
      await this.withTransaction(db, async () => {
        await this.writeAllChat(db, messages, options?.enqueueSync === true);
      });
    });
  }

  // Alerts
  private async readAlerts(
    db: SQLiteExecutor,
    options?: {
      includeDeleted?: boolean;
    }
  ): Promise<AppAlert[]> {
    const where = options?.includeDeleted ? '' : 'WHERE deleted_at IS NULL';
    const rows = await db.getAllAsync<AlertRow>(
      `SELECT * FROM alerts ${where} ORDER BY rowid ASC`
    );
    return rows.map(mapAlertRow);
  }

  async listAlerts(options?: {
    includeDeleted?: boolean;
  }): Promise<AppAlert[]> {
    return this.enqueueRead((db) => this.readAlerts(db, options));
  }

  async upsertAlert(
    alert: AppAlert,
    options?: RepositoryWriteOptions
  ): Promise<AppAlert> {
    return this.enqueueWrite(async (db) => {
      const existingRow = await db.getFirstAsync<AlertRow>(
        'SELECT * FROM alerts WHERE id = ?',
        alert.id
      );
      const existing = existingRow ? mapAlertRow(existingRow) : undefined;
      const saved = stampEntity(alert, existing, options);

      await this.withTransaction(db, async () => {
        await db.runAsync(
          `INSERT INTO alerts (
            id, type, title, subtitle, badge_text, related_id,
            updated_at, deleted_at, sync_status, version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            type = excluded.type,
            title = excluded.title,
            subtitle = excluded.subtitle,
            badge_text = excluded.badge_text,
            related_id = excluded.related_id,
            updated_at = excluded.updated_at,
            deleted_at = excluded.deleted_at,
            sync_status = excluded.sync_status,
            version = excluded.version`,
          saved.id,
          saved.type,
          saved.title,
          saved.subtitle,
          saved.badgeText,
          saved.relatedId ?? null,
          saved.updatedAt!,
          saved.deletedAt ?? null,
          saved.syncStatus!,
          saved.version!
        );

        if (options?.enqueueSync !== false) {
          await this.insertOutboxEntry(db, {
            entityType: 'alert',
            entityId: saved.id,
            operation: 'upsert',
            payload: JSON.stringify(saved),
          });
        }
      });
      return saved;
    });
  }

  async deleteAlert(
    id: string,
    options?: RepositoryWriteOptions
  ): Promise<void> {
    await this.enqueueWrite(async (db) => {
      const nowIso = new Date().toISOString();
      await this.withTransaction(db, async () => {
        if (options?.soft) {
          await db.runAsync(
            `UPDATE alerts
             SET deleted_at = ?, updated_at = ?, sync_status = ?, version = version + 1
             WHERE id = ?`,
            nowIso,
            nowIso,
            options?.enqueueSync !== false ? 'pending' : 'synced',
            id
          );
        } else {
          await db.runAsync('DELETE FROM alerts WHERE id = ?', id);
        }
        if (options?.enqueueSync !== false) {
          await this.insertOutboxEntry(db, {
            entityType: 'alert',
            entityId: id,
            operation: 'delete',
            payload: JSON.stringify({
              id,
              deletedAt: options?.soft ? nowIso : null,
            }),
          });
        }
      });
    });
  }

  private async writeAllAlerts(
    db: SQLiteExecutor,
    alerts: AppAlert[],
    enqueueSync: boolean
  ): Promise<void> {
    await db.runAsync('DELETE FROM alerts');
    for (const alert of alerts) {
      const saved = stampEntity(alert, undefined, { enqueueSync });
      await db.runAsync(
        `INSERT OR REPLACE INTO alerts (
          id, type, title, subtitle, badge_text, related_id,
          updated_at, deleted_at, sync_status, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        saved.id,
        saved.type,
        saved.title,
        saved.subtitle,
        saved.badgeText,
        saved.relatedId ?? null,
        saved.updatedAt!,
        saved.deletedAt ?? null,
        saved.syncStatus!,
        saved.version!
      );
      if (enqueueSync) {
        await this.insertOutboxEntry(db, {
          entityType: 'alert',
          entityId: saved.id,
          operation: 'upsert',
          payload: JSON.stringify(saved),
        });
      }
    }
  }

  async replaceAllAlerts(
    alerts: AppAlert[],
    options?: RepositoryWriteOptions
  ): Promise<void> {
    await this.enqueueWrite(async (db) => {
      await this.withTransaction(db, async () => {
        await this.writeAllAlerts(db, alerts, options?.enqueueSync === true);
      });
    });
  }

  // Meta & Legacy KV
  async getMeta(key: string): Promise<string | null> {
    return this.enqueueRead((db) => this.readMeta(db, key));
  }

  async setMeta(key: string, value: string): Promise<void> {
    await this.enqueueWrite(async (db) => {
      await db.runAsync(
        'INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)',
        key,
        value,
        new Date().toISOString()
      );
    });
  }

  async getKv<T>(key: string): Promise<T | null> {
    return this.enqueueRead((db) => this.readKv<T>(db, key));
  }

  async setKv(key: string, value: unknown): Promise<void> {
    const serialized = value === undefined ? 'null' : JSON.stringify(value);
    await this.enqueueWrite(async (db) => {
      await db.runAsync(
        'INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)',
        key,
        serialized
      );
    });
  }

  // Sync Outbox
  async listSyncOutbox(): Promise<SyncOutboxEntry[]> {
    return this.enqueueRead(async (db) => {
      const rows = await db.getAllAsync<OutboxRow>(
        'SELECT * FROM sync_outbox ORDER BY created_at ASC, rowid ASC'
      );
      return rows.map((row) => ({
        id: row.id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        operation: row.operation,
        payload: row.payload,
        createdAt: row.created_at,
        attempts: row.attempts,
      }));
    });
  }

  async enqueueSyncOutbox(
    entry: Omit<SyncOutboxEntry, 'id' | 'createdAt' | 'attempts'> &
      Partial<Pick<SyncOutboxEntry, 'id' | 'createdAt' | 'attempts'>>
  ): Promise<SyncOutboxEntry> {
    return this.enqueueWrite((db) => this.insertOutboxEntry(db, entry));
  }

  async removeSyncOutboxEntry(id: string): Promise<void> {
    await this.enqueueWrite(async (db) => {
      await db.runAsync('DELETE FROM sync_outbox WHERE id = ?', id);
    });
  }

  async incrementSyncOutboxAttempts(id: string): Promise<void> {
    await this.enqueueWrite(async (db) => {
      await db.runAsync(
        'UPDATE sync_outbox SET attempts = attempts + 1 WHERE id = ?',
        id
      );
    });
  }

  async clearSyncOutbox(): Promise<void> {
    await this.enqueueWrite(async (db) => {
      await db.runAsync('DELETE FROM sync_outbox');
    });
  }
}

// Factories
export function createInMemoryRepository(): DayCraftRepository {
  return new InMemoryDayCraftRepository();
}

export function createWebRepository(storage?: Storage): DayCraftRepository {
  return new WebStorageDayCraftRepository(storage);
}

export function createSQLiteRepository(
  executorOrFactory?: SQLiteExecutor | (() => Promise<SQLiteExecutor>)
): DayCraftRepository {
  return new ExpoSQLiteDayCraftRepository(executorOrFactory);
}

// Singleton Lifecycle & Legacy Wrappers
let activeRepository: DayCraftRepository | null = null;
let initLockPromise: Promise<DayCraftRepository> | null = null;
let testingRepositoryOverride = false;

export function getRepository(): DayCraftRepository {
  if (!activeRepository) {
    activeRepository = new InMemoryDayCraftRepository();
  }
  return activeRepository;
}

export function setRepositoryForTesting(
  repo: DayCraftRepository | null
): void {
  activeRepository = repo;
  initLockPromise = null;
  testingRepositoryOverride = repo !== null;
}

/**
 * Inicializa la persistencia según el entorno (Web localStorage, React Native SQLite, o Node/fallback en memoria).
 * Nunca lanza excepciones: ante error de apertura o migración activa un repositorio en memoria funcional.
 */
export async function initDatabase(): Promise<DayCraftRepository> {
  if (testingRepositoryOverride && activeRepository) {
    try {
      await activeRepository.init();
    } catch (err) {
      console.warn('[DayCraft SQLite] Error en repositorio de pruebas:', err);
    }
    return activeRepository;
  }

  if (initLockPromise) {
    return initLockPromise;
  }

  initLockPromise = (async () => {
    try {
      let repo: DayCraftRepository;
      if (isWebRuntime()) {
        repo = createWebRepository();
      } else if (isReactNativeRuntime()) {
        repo = createSQLiteRepository();
      } else {
        repo = createInMemoryRepository();
      }
      await repo.init();
      activeRepository = repo;
      return repo;
    } catch (err) {
      console.warn('[DayCraft SQLite] Fallback en memoria activo:', err);
      const fallback = createInMemoryRepository();
      await fallback.init();
      activeRepository = fallback;
      return fallback;
    }
  })();

  return initLockPromise;
}

export async function savePersistedState(
  key: string,
  data: unknown
): Promise<void> {
  try {
    if (!activeRepository && isWebRuntime()) {
      try {
        const serialized = data === undefined ? 'null' : JSON.stringify(data);
        window.localStorage.setItem(`daycraft_${key}`, serialized);
      } catch {
        // Fallback en memoria si localStorage falla
      }
    }
    const repo = activeRepository ?? (await initDatabase());
    await repo.setKv(key, data);
  } catch (err) {
    console.warn('[DayCraft SQLite] Error guardando estado:', err);
  }
}

export async function loadPersistedState<T>(key: string): Promise<T | null> {
  try {
    const repo = activeRepository ?? (await initDatabase());
    return await repo.getKv<T>(key);
  } catch {
    return null;
  }
}
