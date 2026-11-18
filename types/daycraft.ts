/**
 * DayCraft AI — Pure Domain, Sync, AI, Rollover, and Repository Contracts.
 * Runtime-agnostic TypeScript definitions (zero `react-native` or `expo-*` imports).
 */

// Sync & Lifecycle Metadata
export type EntitySyncStatus = 'synced' | 'pending' | 'conflict';
export type SyncStatusKind = 'offline' | 'syncing' | 'synced' | 'error';
export type SyncEntityType =
  | 'event'
  | 'pending'
  | 'idea_group'
  | 'idea'
  | 'chat'
  | 'alert';
export type SyncOutboxOperation = 'upsert' | 'delete';

export interface SyncEntityMetadata {
  updatedAt?: string; // ISO-8601
  deletedAt?: string | null;
  syncStatus?: EntitySyncStatus;
  version?: number;
}

export interface SyncState {
  status: SyncStatusKind;
  pendingCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export interface SyncOutboxEntry {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOutboxOperation;
  payload: string;
  createdAt: string;
  attempts: number;
}

// Calendar / Day Contract
export interface DayInfo {
  key: string; // Clave ISO 'YYYY-MM-DD'
  isoDate: string; // 'YYYY-MM-DD'
  dayName: string; // 'LUN', 'MAR', 'MIÉ'...
  dayNum: string; // '27', '01'...
  monthShort: string; // 'OCT', 'NOV', 'DIC'...
  monthFull: string; // 'Octubre', 'Noviembre'...
  year: number;
  fullTitle: string; // 'Sábado 31 de Octubre 2026 (Hoy)'
  isToday?: boolean;
  isPast?: boolean;
  isFirstOfMonth?: boolean;
}

// Domain Entities
export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly';

export interface EventRecurrenceRule {
  frequency: RecurrenceFrequency;
  daysOfWeek?: string[];
  dayNumOfMonth?: string;
}

export interface TimelineEvent extends SyncEntityMetadata {
  id: string;
  dayKey: string; // Clave ISO 'YYYY-MM-DD'
  title: string;
  desc?: string;
  startQ: number; // Cuarto de hora inicial (0..95)
  quarters: number; // Duración en cuartos de hora (1 = 15m, 2 = 30m, etc.)
  type: 'task' | 'reminder';
  tag?: string;
  completed?: boolean;
  recurrence?: EventRecurrenceRule;
}

export interface PendingTask extends SyncEntityMetadata {
  id: string;
  title: string;
  completed: boolean;
  isFromYesterday: boolean;
  rolloverDays: number;
  createdAt: string;
  archived?: boolean;
}

export interface IdeaItemData extends SyncEntityMetadata {
  id: string;
  groupId: string;
  title: string;
  desc: string;
  markdownContent?: string;
  createdAtLabel: string;
  daysInactive: number;
  suggestedAction?: string;
}

export interface IdeaGroup extends SyncEntityMetadata {
  id: string;
  title: string;
  subtitle: string;
  icon: 'smartphone' | 'cup' | 'sparkle' | 'folder' | 'lightbulb';
  accentColor: 'indigo' | 'emerald' | 'amber';
  items: IdeaItemData[];
}

export interface ChatMessageClassifiedItem {
  type: 'event' | 'reminder' | 'pending' | 'idea';
  title: string;
  meta: string;
}

export interface ChatMessage extends SyncEntityMetadata {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  classifiedItems?: ChatMessageClassifiedItem[];
}

export interface AppAlert extends SyncEntityMetadata {
  id: string;
  type: 'rollover' | 'inactive_idea';
  title: string;
  subtitle: string;
  badgeText: string;
  relatedId?: string;
}

// AI & Rollover Contracts
export type IntakeIntentKind =
  | 'question'
  | 'event'
  | 'reminder'
  | 'idea'
  | 'pending';

export interface ParsedIntakeAction {
  kind: IntakeIntentKind;
  title: string;
  desc?: string;
  dayKey?: string;
  startQ?: number;
  quarters?: number;
  ideaGroupId?: string;
  aiReply: string;
}

export interface ParsedIntakeBatch {
  items: ParsedIntakeAction[];
  aiReply: string;
  source: 'gemini' | 'local';
}

export interface SmartIntakeProcessOptions {
  apiKey?: string;
  useCloudAI?: boolean;
  ideaGroups?: IdeaGroup[];
  existingEvents?: TimelineEvent[];
  existingPending?: PendingTask[];
}

export interface PersistedGeminiConfig {
  apiKey: string;
  useCloudAI: boolean;
}

export interface RolloverEvaluationResult {
  updatedTasks: PendingTask[];
  threeDayRuleTriggered: PendingTask[];
  generatedAlerts: AppAlert[];
  elapsedDays?: number;
  staleIdeasTriggered?: IdeaItemData[];
  updatedIdeaGroups?: IdeaGroup[];
  mergedAlerts?: AppAlert[];
}

// Repository & Snapshot Contracts
export interface DayCraftSnapshot {
  events: TimelineEvent[];
  pendingTasks: PendingTask[];
  ideaGroups: IdeaGroup[];
  chatMessages: ChatMessage[];
  alerts: AppAlert[];
  lastOpenedDate: string | null;
  geminiConfig: PersistedGeminiConfig;
  seedInitialized: boolean;
}

export interface RepositorySeedPayload {
  events: TimelineEvent[];
  pendingTasks: PendingTask[];
  ideaGroups: IdeaGroup[];
  chatMessages: ChatMessage[];
  alerts: AppAlert[];
  lastOpenedDate?: string | null;
}

export interface RepositoryWriteOptions {
  enqueueSync?: boolean;
  soft?: boolean;
}

export interface DayCraftRepository {
  init(): Promise<void>;
  close(): Promise<void>;
  getSchemaVersion(): Promise<number>;
  isSeedInitialized(): Promise<boolean>;
  seedIfNeeded(seed: RepositorySeedPayload): Promise<boolean>;
  getSnapshot(): Promise<DayCraftSnapshot>;

  // Events
  listEvents(options?: {
    dayKey?: string;
    includeDeleted?: boolean;
  }): Promise<TimelineEvent[]>;
  getEventById(id: string): Promise<TimelineEvent | null>;
  upsertEvent(
    event: TimelineEvent,
    options?: RepositoryWriteOptions
  ): Promise<TimelineEvent>;
  deleteEvent(id: string, options?: RepositoryWriteOptions): Promise<void>;
  replaceAllEvents(
    events: TimelineEvent[],
    options?: RepositoryWriteOptions
  ): Promise<void>;

  // Pending Tasks
  listPendingTasks(options?: {
    includeArchived?: boolean;
    includeDeleted?: boolean;
  }): Promise<PendingTask[]>;
  getPendingTaskById(id: string): Promise<PendingTask | null>;
  upsertPendingTask(
    task: PendingTask,
    options?: RepositoryWriteOptions
  ): Promise<PendingTask>;
  deletePendingTask(id: string, options?: RepositoryWriteOptions): Promise<void>;
  replaceAllPendingTasks(
    tasks: PendingTask[],
    options?: RepositoryWriteOptions
  ): Promise<void>;

  // Idea Groups & Ideas
  listIdeaGroups(options?: { includeDeleted?: boolean }): Promise<IdeaGroup[]>;
  getIdeaGroupById(id: string): Promise<IdeaGroup | null>;
  upsertIdeaGroup(
    group: IdeaGroup,
    options?: RepositoryWriteOptions
  ): Promise<IdeaGroup>;
  deleteIdeaGroup(id: string, options?: RepositoryWriteOptions): Promise<void>;
  listIdeas(options?: {
    groupId?: string;
    includeDeleted?: boolean;
  }): Promise<IdeaItemData[]>;
  getIdeaById(id: string): Promise<IdeaItemData | null>;
  upsertIdea(
    idea: IdeaItemData,
    options?: RepositoryWriteOptions
  ): Promise<IdeaItemData>;
  deleteIdea(id: string, options?: RepositoryWriteOptions): Promise<void>;
  searchIdeas(query: string): Promise<IdeaItemData[]>;
  replaceAllIdeaGroups(
    groups: IdeaGroup[],
    options?: RepositoryWriteOptions
  ): Promise<void>;

  // Chat & Alerts
  listChatMessages(options?: {
    includeDeleted?: boolean;
  }): Promise<ChatMessage[]>;
  upsertChatMessage(
    message: ChatMessage,
    options?: RepositoryWriteOptions
  ): Promise<ChatMessage>;
  deleteChatMessage(id: string, options?: RepositoryWriteOptions): Promise<void>;
  replaceAllChatMessages(
    messages: ChatMessage[],
    options?: RepositoryWriteOptions
  ): Promise<void>;

  listAlerts(options?: { includeDeleted?: boolean }): Promise<AppAlert[]>;
  upsertAlert(
    alert: AppAlert,
    options?: RepositoryWriteOptions
  ): Promise<AppAlert>;
  deleteAlert(id: string, options?: RepositoryWriteOptions): Promise<void>;
  replaceAllAlerts(
    alerts: AppAlert[],
    options?: RepositoryWriteOptions
  ): Promise<void>;

  // Meta & Legacy KV
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
  getKv<T>(key: string): Promise<T | null>;
  setKv(key: string, value: unknown): Promise<void>;

  // Sync Outbox
  listSyncOutbox(): Promise<SyncOutboxEntry[]>;
  enqueueSyncOutbox(
    entry: Omit<SyncOutboxEntry, 'id' | 'createdAt' | 'attempts'> &
      Partial<Pick<SyncOutboxEntry, 'id' | 'createdAt' | 'attempts'>>
  ): Promise<SyncOutboxEntry>;
  removeSyncOutboxEntry(id: string): Promise<void>;
  incrementSyncOutboxAttempts(id: string): Promise<void>;
  clearSyncOutbox(): Promise<void>;
}
