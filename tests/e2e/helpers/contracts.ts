/**
 * Locked Interface Contracts derived from PROJECT.md § Interface Contracts
 * Used by opaque-box E2E tests without coupling to unimplemented files or internals.
 */

export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly';

export interface EventRecurrenceRule {
  frequency: RecurrenceFrequency;
  daysOfWeek?: string[];
  dayNumOfMonth?: string;
}

export interface SyncMetadata {
  updatedAt?: string;
  deletedAt?: string | null;
  syncStatus?: 'synced' | 'pending' | 'conflict';
  version?: number;
}

export interface TimelineEvent extends SyncMetadata {
  id: string;
  dayKey: string;
  title: string;
  desc?: string;
  startQ: number;
  quarters: number;
  type: 'task' | 'reminder';
  tag?: string;
  completed?: boolean;
  recurrence?: EventRecurrenceRule;
}

export interface PendingTask extends SyncMetadata {
  id: string;
  title: string;
  completed: boolean;
  isFromYesterday: boolean;
  rolloverDays: number;
  createdAt: string;
  archived?: boolean;
}

export interface IdeaItemData extends SyncMetadata {
  id: string;
  groupId: string;
  title: string;
  desc: string;
  markdownContent?: string;
  createdAtLabel: string;
  daysInactive: number;
  suggestedAction?: string;
}

export interface IdeaGroup extends SyncMetadata {
  id: string;
  title: string;
  subtitle: string;
  icon: 'smartphone' | 'cup' | 'sparkle' | 'folder' | 'lightbulb';
  accentColor: 'indigo' | 'emerald' | 'amber';
  items: IdeaItemData[];
}

export interface ChatMessage extends SyncMetadata {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  classifiedItems?: {
    type: 'event' | 'reminder' | 'pending' | 'idea';
    title: string;
    meta: string;
  }[];
}

export interface AppAlert extends SyncMetadata {
  id: string;
  type: 'rollover' | 'inactive_idea';
  title: string;
  subtitle: string;
  badgeText: string;
  relatedId?: string;
}

export type IntakeIntentKind = 'question' | 'event' | 'reminder' | 'idea' | 'pending';

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

export type SyncStatusKind = 'offline' | 'syncing' | 'synced' | 'error';

export interface SyncState {
  status: SyncStatusKind;
  pendingCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export interface SyncOutboxEntry {
  id: string;
  entityType: 'event' | 'pending' | 'idea_group' | 'idea' | 'chat' | 'alert';
  entityId: string;
  operation: 'upsert' | 'delete';
  payload: string;
  createdAt: string;
  attempts: number;
}

export const LOCKED_LAYOUT_CONTRACT = {
  desktopBreakpoint: 900,
  hourHeightMobile: 64,
  hourHeightDesktop: 72,
  railPaddingHorizontal: 16,
  quarterMinutes: 15,
  quartersPerDay: 96,
  toastDurationMs: 4200,
  maxRolloverDays: 3,
} as const;

export const LOCKED_THEME_ORDER = [
  'granate',
  'murasaki',
  'sumi',
  'aizome',
  'bosque',
  'shiro',
] as const;

export const LOCKED_SEMANTIC_TOKENS = [
  'canvas',
  'header',
  'card',
  'raised',
  'line',
  'lineSubtle',
  'ink',
  'muted',
  'accent',
  'accentSoft',
  'onAccent',
  'ok',
  'warm',
  'info',
  'now',
] as const;

export const LOCKED_MCP_TOOLS = [
  'list_events',
  'create_event',
  'update_event',
  'delete_event',
  'list_pending',
  'add_pending',
  'complete_pending',
  'list_ideas',
  'create_idea',
  'search_notes',
  'smart_intake',
  'get_daily_briefing',
] as const;

export const LOCKED_MCP_RESOURCES = [
  'daycraft://timeline/today',
  'daycraft://pending',
  'daycraft://ideas/groups',
] as const;
