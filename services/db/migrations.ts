/**
 * DayCraft AI — Versioned SQLite Schema & Legacy v9 Migration Engine.
 * Pure TypeScript (zero `react-native` or `expo-*` imports).
 */

import { getDateKeyWithOffset, getTodayKey } from '@/constants/theme';
import type {
  AppAlert,
  ChatMessage,
  IdeaGroup,
  PendingTask,
  TimelineEvent,
} from '@/types/daycraft';

export type SQLiteBindValue = string | number | null;

export interface SQLiteRunResult {
  changes: number;
  lastInsertRowId: number;
}

export interface SQLiteExecutor {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: SQLiteBindValue[]): Promise<SQLiteRunResult>;
  getFirstAsync<T>(sql: string, ...params: SQLiteBindValue[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: SQLiteBindValue[]): Promise<T[]>;
  withTransactionAsync?: (task: () => Promise<void>) => Promise<void>;
}

export const CURRENT_SCHEMA_VERSION = 1;

export const V1_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kv_store (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY NOT NULL,
  day_key TEXT NOT NULL,
  title TEXT NOT NULL,
  "desc" TEXT,
  start_q INTEGER NOT NULL,
  quarters INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('task', 'reminder')),
  tag TEXT,
  completed INTEGER NOT NULL DEFAULT 0,
  recurrence_json TEXT,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_events_day_key ON events(day_key);
CREATE INDEX IF NOT EXISTS idx_events_deleted_at ON events(deleted_at);

CREATE TABLE IF NOT EXISTS pending_tasks (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  is_from_yesterday INTEGER NOT NULL DEFAULT 0,
  rollover_days INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS idea_groups (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  icon TEXT NOT NULL,
  accent_color TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS ideas (
  id TEXT PRIMARY KEY NOT NULL,
  group_id TEXT NOT NULL REFERENCES idea_groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  "desc" TEXT NOT NULL,
  markdown_content TEXT,
  created_at_label TEXT NOT NULL,
  days_inactive INTEGER NOT NULL DEFAULT 0,
  suggested_action TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_ideas_group_id ON ideas(group_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  text TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  classified_items_json TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('rollover', 'inactive_idea')),
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  badge_text TEXT NOT NULL,
  related_id TEXT,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sync_outbox (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('upsert', 'delete')),
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sync_outbox_created_at ON sync_outbox(created_at);
`;

/**
 * Normaliza claves legadas de 2 dígitos ('27', '28', '29', '30') a claves ISO reales ('YYYY-MM-DD').
 */
export function normalizeLegacyEvents(
  events: TimelineEvent[]
): TimelineEvent[] {
  if (!Array.isArray(events)) return [];
  const today = getTodayKey();
  const tomorrow = getDateKeyWithOffset(1);
  const plusTwo = getDateKeyWithOffset(2);
  const plusThree = getDateKeyWithOffset(3);

  return events.map((ev) => {
    if (!ev || typeof ev !== 'object') {
      return ev;
    }
    if (typeof ev.dayKey === 'string' && ev.dayKey.length > 0 && ev.dayKey.length <= 2) {
      const mapped =
        ev.dayKey === '27'
          ? today
          : ev.dayKey === '28'
            ? tomorrow
            : ev.dayKey === '29'
              ? plusTwo
              : ev.dayKey === '30'
                ? plusThree
                : today;
      return { ...ev, dayKey: mapped };
    }
    return ev;
  });
}

function safeJsonParse<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function sanitizeOptionalString(val: unknown): string | null {
  return typeof val === 'string' ? val : null;
}

function sanitizeUpdatedAt(val: unknown, fallback: string): string {
  return typeof val === 'string' && val.length > 0 ? val : fallback;
}

function sanitizeVersion(val: unknown): number {
  return typeof val === 'number' && Number.isFinite(val) && val >= 1
    ? Math.trunc(val)
    : 1;
}

function sanitizeSyncStatus(
  val: unknown
): 'synced' | 'pending' | 'conflict' {
  return val === 'pending' || val === 'conflict' || val === 'synced'
    ? val
    : 'synced';
}

const LEGACY_DOMAIN_KEYS = [
  'events_v9',
  'pending_v9',
  'ideas_v9',
  'chat_v9',
  'alerts_v9',
] as const;

const ALL_LEGACY_KV_KEYS = [
  ...LEGACY_DOMAIN_KEYS,
  'last_opened_date_v9',
  'gemini_config_v9',
] as const;

/**
 * Migra datos existentes de `kv_store` (v9) a tablas relacionales v1.
 * Conserva las filas de `kv_store` intactas para compatibilidad previa a M2.
 */
export async function migrateLegacyKvV9ToRelational(
  db: SQLiteExecutor
): Promise<void> {
  const placeholders = ALL_LEGACY_KV_KEYS.map(() => '?').join(', ');
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM kv_store WHERE key IN (${placeholders})`,
    ...ALL_LEGACY_KV_KEYS
  );

  if (rows.length === 0) {
    return;
  }

  const kvMap = new Map<string, string>();
  for (const row of rows) {
    kvMap.set(row.key, row.value);
  }

  const nowIso = new Date().toISOString();

  // 1. Events
  const rawEvents = safeJsonParse<TimelineEvent[]>(kvMap.get('events_v9'));
  if (Array.isArray(rawEvents)) {
    const normalized = normalizeLegacyEvents(rawEvents);
    for (const ev of normalized) {
      if (!ev || typeof ev.id !== 'string' || typeof ev.title !== 'string') {
        continue;
      }
      const eventType = ev.type === 'reminder' ? 'reminder' : 'task';
      const startQ =
        typeof ev.startQ === 'number' && Number.isFinite(ev.startQ)
          ? ev.startQ
          : 36;
      const quarters =
        typeof ev.quarters === 'number' &&
        Number.isFinite(ev.quarters) &&
        ev.quarters >= 1
          ? ev.quarters
          : 2;
      await db.runAsync(
        `INSERT OR REPLACE INTO events (
          id, day_key, title, "desc", start_q, quarters, type, tag, completed,
          recurrence_json, updated_at, deleted_at, sync_status, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ev.id,
        typeof ev.dayKey === 'string' && ev.dayKey ? ev.dayKey : getTodayKey(),
        ev.title,
        sanitizeOptionalString(ev.desc),
        startQ,
        quarters,
        eventType,
        sanitizeOptionalString(ev.tag),
        ev.completed ? 1 : 0,
        ev.recurrence && typeof ev.recurrence === 'object'
          ? JSON.stringify(ev.recurrence)
          : null,
        sanitizeUpdatedAt(ev.updatedAt, nowIso),
        sanitizeOptionalString(ev.deletedAt),
        sanitizeSyncStatus(ev.syncStatus),
        sanitizeVersion(ev.version)
      );
    }
  }

  // 2. Pending Tasks
  const rawPending = safeJsonParse<PendingTask[]>(kvMap.get('pending_v9'));
  if (Array.isArray(rawPending)) {
    for (const task of rawPending) {
      if (
        !task ||
        typeof task.id !== 'string' ||
        typeof task.title !== 'string'
      ) {
        continue;
      }
      await db.runAsync(
        `INSERT OR REPLACE INTO pending_tasks (
          id, title, completed, is_from_yesterday, rollover_days, created_at,
          archived, updated_at, deleted_at, sync_status, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        task.id,
        task.title,
        task.completed ? 1 : 0,
        task.isFromYesterday ? 1 : 0,
        typeof task.rolloverDays === 'number' && Number.isFinite(task.rolloverDays)
          ? task.rolloverDays
          : 0,
        typeof task.createdAt === 'string' ? task.createdAt : 'Hoy',
        task.archived ? 1 : 0,
        sanitizeUpdatedAt(task.updatedAt, nowIso),
        sanitizeOptionalString(task.deletedAt),
        sanitizeSyncStatus(task.syncStatus),
        sanitizeVersion(task.version)
      );
    }
  }

  // 3. Idea Groups & Ideas
  const rawIdeaGroups = safeJsonParse<IdeaGroup[]>(kvMap.get('ideas_v9'));
  if (Array.isArray(rawIdeaGroups)) {
    const groupIds = new Set<string>();
    for (let gIdx = 0; gIdx < rawIdeaGroups.length; gIdx++) {
      const group = rawIdeaGroups[gIdx];
      if (!group || typeof group.id !== 'string') continue;
      groupIds.add(group.id);
      await db.runAsync(
        `INSERT OR REPLACE INTO idea_groups (
          id, title, subtitle, icon, accent_color, sort_order,
          updated_at, deleted_at, sync_status, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        group.id,
        typeof group.title === 'string' ? group.title : 'Proyecto',
        typeof group.subtitle === 'string' ? group.subtitle : '',
        typeof group.icon === 'string' ? group.icon : 'sparkle',
        typeof group.accentColor === 'string' ? group.accentColor : 'indigo',
        gIdx,
        sanitizeUpdatedAt(group.updatedAt, nowIso),
        sanitizeOptionalString(group.deletedAt),
        sanitizeSyncStatus(group.syncStatus),
        sanitizeVersion(group.version)
      );
    }

    for (const group of rawIdeaGroups) {
      if (!group || typeof group.id !== 'string' || !Array.isArray(group.items)) {
        continue;
      }
      for (let iIdx = 0; iIdx < group.items.length; iIdx++) {
        const item = group.items[iIdx];
        if (!item || typeof item.id !== 'string') continue;
        const resolvedGroupId =
          typeof item.groupId === 'string' && groupIds.has(item.groupId)
            ? item.groupId
            : group.id;
        await db.runAsync(
          `INSERT OR REPLACE INTO ideas (
            id, group_id, title, "desc", markdown_content, created_at_label,
            days_inactive, suggested_action, sort_order,
            updated_at, deleted_at, sync_status, version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          item.id,
          resolvedGroupId,
          typeof item.title === 'string' ? item.title : 'Idea',
          typeof item.desc === 'string' ? item.desc : '',
          sanitizeOptionalString(item.markdownContent),
          typeof item.createdAtLabel === 'string' ? item.createdAtLabel : 'Hoy',
          typeof item.daysInactive === 'number' && Number.isFinite(item.daysInactive)
            ? item.daysInactive
            : 0,
          sanitizeOptionalString(item.suggestedAction),
          iIdx,
          sanitizeUpdatedAt(item.updatedAt, nowIso),
          sanitizeOptionalString(item.deletedAt),
          sanitizeSyncStatus(item.syncStatus),
          sanitizeVersion(item.version)
        );
      }
    }
  }

  // 4. Chat Messages
  const rawChat = safeJsonParse<ChatMessage[]>(kvMap.get('chat_v9'));
  if (Array.isArray(rawChat)) {
    for (let idx = 0; idx < rawChat.length; idx++) {
      const msg = rawChat[idx];
      if (!msg || typeof msg.id !== 'string' || typeof msg.text !== 'string') {
        continue;
      }
      const role = msg.role === 'user' ? 'user' : 'assistant';
      await db.runAsync(
        `INSERT OR REPLACE INTO chat_messages (
          id, role, text, timestamp, classified_items_json, sort_order,
          updated_at, deleted_at, sync_status, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        msg.id,
        role,
        msg.text,
        typeof msg.timestamp === 'string' ? msg.timestamp : '',
        Array.isArray(msg.classifiedItems)
          ? JSON.stringify(msg.classifiedItems)
          : null,
        idx,
        sanitizeUpdatedAt(msg.updatedAt, nowIso),
        sanitizeOptionalString(msg.deletedAt),
        sanitizeSyncStatus(msg.syncStatus),
        sanitizeVersion(msg.version)
      );
    }
  }

  // 5. Alerts
  const rawAlerts = safeJsonParse<AppAlert[]>(kvMap.get('alerts_v9'));
  if (Array.isArray(rawAlerts)) {
    for (const alert of rawAlerts) {
      if (!alert || typeof alert.id !== 'string') continue;
      const alertType =
        alert.type === 'inactive_idea' ? 'inactive_idea' : 'rollover';
      await db.runAsync(
        `INSERT OR REPLACE INTO alerts (
          id, type, title, subtitle, badge_text, related_id,
          updated_at, deleted_at, sync_status, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        alert.id,
        alertType,
        typeof alert.title === 'string' ? alert.title : '',
        typeof alert.subtitle === 'string' ? alert.subtitle : '',
        typeof alert.badgeText === 'string' ? alert.badgeText : '',
        sanitizeOptionalString(alert.relatedId),
        sanitizeUpdatedAt(alert.updatedAt, nowIso),
        sanitizeOptionalString(alert.deletedAt),
        sanitizeSyncStatus(alert.syncStatus),
        sanitizeVersion(alert.version)
      );
    }
  }

  // 6. Meta: last_opened_date, gemini_config, seed_initialized
  const lastOpenedDate = safeJsonParse<string>(
    kvMap.get('last_opened_date_v9')
  );
  if (typeof lastOpenedDate === 'string' && lastOpenedDate) {
    await db.runAsync(
      'INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)',
      'last_opened_date',
      lastOpenedDate,
      nowIso
    );
  }

  const rawGemini = kvMap.get('gemini_config_v9');
  if (rawGemini && safeJsonParse<unknown>(rawGemini) !== null) {
    await db.runAsync(
      'INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)',
      'gemini_config',
      rawGemini,
      nowIso
    );
  }

  const hasDomainLegacyData =
    Array.isArray(rawEvents) ||
    Array.isArray(rawPending) ||
    Array.isArray(rawIdeaGroups) ||
    Array.isArray(rawChat) ||
    Array.isArray(rawAlerts);
  if (hasDomainLegacyData) {
    await db.runAsync(
      'INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)',
      'seed_initialized',
      'true',
      nowIso
    );
  }
}

/**
 * Ejecuta migraciones versionadas usando `PRAGMA user_version`.
 * Es idempotente y segura ante re-ejecuciones.
 */
export async function runMigrations(db: SQLiteExecutor): Promise<number> {
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  let version = row?.user_version ?? 0;

  if (version < 1) {
    const applyV1 = async () => {
      await db.execAsync(V1_SCHEMA_SQL);
      await migrateLegacyKvV9ToRelational(db);
      await db.execAsync('PRAGMA user_version = 1;');
    };

    if (db.withTransactionAsync) {
      await db.withTransactionAsync(applyV1);
    } else {
      await applyV1();
    }
    version = 1;
  }

  return version;
}
