import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDateKeyWithOffset, getTodayKey } from '@/constants/theme';
import {
  CURRENT_SCHEMA_VERSION,
  runMigrations,
  type SQLiteBindValue,
  type SQLiteExecutor,
} from '@/services/db/migrations';
import {
  ExpoSQLiteDayCraftRepository,
  InMemoryDayCraftRepository,
  SEED_ALERTS,
  SEED_CHAT,
  SEED_EVENTS,
  SEED_IDEA_GROUPS,
  SEED_PENDING,
  WebStorageDayCraftRepository,
  createInMemoryRepository,
  createSQLiteRepository,
  createWebRepository,
  getRepository,
  initDatabase,
  isWebRuntime,
  loadPersistedState,
  savePersistedState,
  setRepositoryForTesting,
} from '@/services/db/sqlite';
import type { IdeaGroup, TimelineEvent } from '@/types/daycraft';

/**
 * Genuine SQLite 3 executor backed by Node 22 `node:sqlite` (`DatabaseSync(':memory:')`)
 * so migrations, PRAGMA user_version, foreign keys, CHECK constraints, and SQL CRUD execute against real SQLite.
 */
function createNodeSQLiteExecutor(): {
  executor: SQLiteExecutor & { closeAsync: () => Promise<void> };
  rawDb: DatabaseSync;
} {
  const rawDb = new DatabaseSync(':memory:');
  const executor: SQLiteExecutor & { closeAsync: () => Promise<void> } = {
    async execAsync(sql: string) {
      rawDb.exec(sql);
    },
    async runAsync(sql: string, ...params: SQLiteBindValue[]) {
      const stmt = rawDb.prepare(sql);
      const res = stmt.run(...params);
      return {
        changes: Number(res.changes ?? 0),
        lastInsertRowId: Number(res.lastInsertRowid ?? 0),
      };
    },
    async getFirstAsync<T>(sql: string, ...params: SQLiteBindValue[]) {
      const stmt = rawDb.prepare(sql);
      const row = stmt.get(...params) as T | undefined;
      return row ?? null;
    },
    async getAllAsync<T>(sql: string, ...params: SQLiteBindValue[]) {
      const stmt = rawDb.prepare(sql);
      return stmt.all(...params) as T[];
    },
    async withTransactionAsync(task: () => Promise<void>) {
      rawDb.exec('BEGIN');
      try {
        await task();
        rawDb.exec('COMMIT');
      } catch (err) {
        try {
          rawDb.exec('ROLLBACK');
        } catch {
          // ignore rollback error
        }
        throw err;
      }
    },
    async closeAsync() {
      rawDb.close();
    },
  };
  return { executor, rawDb };
}

function createMemoryWebStorage(initial: Record<string, string> = {}): Storage {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe('M1 Persistence, Migrations, Repositories & Queued Writes', () => {
  afterEach(() => {
    setRepositoryForTesting(null);
    vi.unstubAllGlobals();
  });

  describe('SQLite Schema Migrations (PRAGMA user_version v0 -> v1)', () => {
    it('creates all 9 relational tables, advances PRAGMA user_version to 1, and is idempotent', async () => {
      const { executor, rawDb } = createNodeSQLiteExecutor();

      const before = rawDb.prepare('PRAGMA user_version').get() as {
        user_version: number;
      };
      expect(before.user_version).toBe(0);

      const v1 = await runMigrations(executor);
      expect(v1).toBe(CURRENT_SCHEMA_VERSION);

      const after = rawDb.prepare('PRAGMA user_version').get() as {
        user_version: number;
      };
      expect(after.user_version).toBe(1);

      const tables = await executor.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
      );
      const tableNames = tables.map((t) => t.name);
      expect(tableNames).toEqual(
        expect.arrayContaining([
          'alerts',
          'app_meta',
          'chat_messages',
          'events',
          'idea_groups',
          'ideas',
          'kv_store',
          'pending_tasks',
          'sync_outbox',
        ])
      );

      // Insert a row and verify re-running migrations is idempotent
      await executor.runAsync(
        'INSERT INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)',
        'test_key',
        'test_val',
        '2026-11-17T00:00:00.000Z'
      );
      const vRepeat = await runMigrations(executor);
      expect(vRepeat).toBe(1);
      const row = await executor.getFirstAsync<{ value: string }>(
        'SELECT value FROM app_meta WHERE key = ?',
        'test_key'
      );
      expect(row?.value).toBe('test_val');

      rawDb.close();
    });

    it('migrates legacy v9 kv_store rows into relational tables while preserving kv_store', async () => {
      const { executor, rawDb } = createNodeSQLiteExecutor();
      rawDb.exec(`
        CREATE TABLE kv_store (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      `);
      rawDb
        .prepare('INSERT INTO kv_store (key, value) VALUES (?, ?)')
        .run(
          'events_v9',
          JSON.stringify([
            {
              id: 'leg-ev-1',
              dayKey: '27',
              title: 'Evento legado hoy',
              startQ: 40,
              quarters: 2,
              type: 'task',
            },
            {
              id: 'leg-ev-2',
              dayKey: '28',
              title: 'Recordatorio legado mañana',
              startQ: 60,
              quarters: 2,
              type: 'reminder',
            },
          ])
        );
      rawDb
        .prepare('INSERT INTO kv_store (key, value) VALUES (?, ?)')
        .run(
          'pending_v9',
          JSON.stringify([
            {
              id: 'leg-p-1',
              title: 'Comprar café',
              completed: false,
              isFromYesterday: true,
              rolloverDays: 2,
              createdAt: 'Ayer',
            },
          ])
        );
      rawDb
        .prepare('INSERT INTO kv_store (key, value) VALUES (?, ?)')
        .run('ideas_v9', JSON.stringify(SEED_IDEA_GROUPS));
      rawDb
        .prepare('INSERT INTO kv_store (key, value) VALUES (?, ?)')
        .run('chat_v9', JSON.stringify(SEED_CHAT));
      rawDb
        .prepare('INSERT INTO kv_store (key, value) VALUES (?, ?)')
        .run('alerts_v9', JSON.stringify(SEED_ALERTS));
      rawDb
        .prepare('INSERT INTO kv_store (key, value) VALUES (?, ?)')
        .run('last_opened_date_v9', JSON.stringify('2026-11-15'));
      rawDb
        .prepare('INSERT INTO kv_store (key, value) VALUES (?, ?)')
        .run(
          'gemini_config_v9',
          JSON.stringify({ apiKey: 'AIzaTestKey', useCloudAI: true })
        );
      rawDb
        .prepare('INSERT INTO kv_store (key, value) VALUES (?, ?)')
        .run('theme_v1', JSON.stringify('murasaki'));

      const repo = createSQLiteRepository(executor);
      await repo.init();

      expect(await repo.getSchemaVersion()).toBe(1);
      expect(await repo.isSeedInitialized()).toBe(true);

      const snapshot = await repo.getSnapshot();
      expect(snapshot.events).toHaveLength(2);
      expect(snapshot.events[0].dayKey).toBe(getTodayKey());
      expect(snapshot.events[1].dayKey).toBe(getDateKeyWithOffset(1));
      expect(snapshot.pendingTasks).toHaveLength(1);
      expect(snapshot.pendingTasks[0].rolloverDays).toBe(2);
      expect(snapshot.ideaGroups).toHaveLength(SEED_IDEA_GROUPS.length);
      expect(snapshot.chatMessages).toHaveLength(SEED_CHAT.length);
      expect(snapshot.alerts).toHaveLength(SEED_ALERTS.length);
      expect(snapshot.lastOpenedDate).toBe('2026-11-15');
      expect(snapshot.geminiConfig).toEqual({
        apiKey: 'AIzaTestKey',
        useCloudAI: true,
      });

      // kv_store remains intact for backward compatibility
      expect(await repo.getKv<string>('theme_v1')).toBe('murasaki');
      expect(await repo.getKv<unknown[]>('events_v9')).toHaveLength(2);

      await repo.close();
    });

    it('tolerates corrupt JSON in legacy kv_store during migration without failing', async () => {
      const { executor, rawDb } = createNodeSQLiteExecutor();
      rawDb.exec(
        'CREATE TABLE kv_store (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);'
      );
      rawDb
        .prepare('INSERT INTO kv_store (key, value) VALUES (?, ?)')
        .run('events_v9', '{not-valid-json');
      rawDb
        .prepare('INSERT INTO kv_store (key, value) VALUES (?, ?)')
        .run('gemini_config_v9', 'corrupt');

      const repo = createSQLiteRepository(executor);
      await expect(repo.init()).resolves.toBeUndefined();
      expect(await repo.getSchemaVersion()).toBe(1);
      await repo.close();
    });
  });

  describe('SQLite Repository CRUD, seed_initialized Guard, Search & Outbox', () => {
    let repo: ExpoSQLiteDayCraftRepository;

    beforeEach(async () => {
      const { executor } = createNodeSQLiteExecutor();
      repo = new ExpoSQLiteDayCraftRepository(executor);
      await repo.init();
    });

    afterEach(async () => {
      await repo.close();
    });

    it('seeds once via seedIfNeeded and never re-seeds after user clears data', async () => {
      const first = await repo.seedIfNeeded({
        events: SEED_EVENTS,
        pendingTasks: SEED_PENDING,
        ideaGroups: SEED_IDEA_GROUPS,
        chatMessages: SEED_CHAT,
        alerts: SEED_ALERTS,
        lastOpenedDate: getTodayKey(),
      });
      expect(first).toBe(true);
      expect(await repo.isSeedInitialized()).toBe(true);
      expect(await repo.listSyncOutbox()).toHaveLength(0);

      // User deletes all events and pending tasks
      await repo.replaceAllEvents([]);
      await repo.replaceAllPendingTasks([]);
      await repo.replaceAllIdeaGroups([]);

      const second = await repo.seedIfNeeded({
        events: SEED_EVENTS,
        pendingTasks: SEED_PENDING,
        ideaGroups: SEED_IDEA_GROUPS,
        chatMessages: SEED_CHAT,
        alerts: SEED_ALERTS,
      });
      expect(second).toBe(false);

      const snap = await repo.getSnapshot();
      expect(snap.events).toEqual([]);
      expect(snap.pendingTasks).toEqual([]);
      expect(snap.ideaGroups).toEqual([]);
      expect(snap.seedInitialized).toBe(true);
    });

    it('supports full CRUD, soft delete, markdown idea search, and sync_outbox lifecycle', async () => {
      const ev: TimelineEvent = {
        id: 'ev-test-1',
        dayKey: '2026-11-17',
        title: 'Diseño Japandi',
        desc: 'Revisar tokens Kuro-Zen',
        startQ: 36,
        quarters: 4,
        type: 'task',
        tag: 'UI',
        completed: false,
      };
      const savedEv = await repo.upsertEvent(ev);
      expect(savedEv.syncStatus).toBe('pending');
      expect(savedEv.version).toBe(1);

      const loaded = await repo.getEventById('ev-test-1');
      expect(loaded?.title).toBe('Diseño Japandi');

      // Soft delete hides from default listEvents, reveals with includeDeleted
      await repo.deleteEvent('ev-test-1', { soft: true });
      expect(await repo.getEventById('ev-test-1')).toBeNull();
      expect(await repo.listEvents()).toHaveLength(0);
      expect(await repo.listEvents({ includeDeleted: true })).toHaveLength(1);

      // Ideas & searchIdeas
      await repo.upsertIdeaGroup({
        id: 'grp-1',
        title: 'Arquitectura',
        subtitle: 'Notas técnicas',
        icon: 'folder',
        accentColor: 'indigo',
        items: [
          {
            id: 'idea-sql',
            groupId: 'grp-1',
            title: 'Migraciones SQLite',
            desc: 'Usar PRAGMA user_version',
            markdownContent: '# Esquema\nCola de escritura FIFO con **MCP**',
            createdAtLabel: 'Hoy',
            daysInactive: 0,
            suggestedAction: 'Escribir tests',
          },
        ],
      });

      const foundByMd = await repo.searchIdeas('mcp');
      expect(foundByMd).toHaveLength(1);
      expect(foundByMd[0].id).toBe('idea-sql');

      const notFound = await repo.searchIdeas('inexistente-xyz');
      expect(notFound).toHaveLength(0);

      // Sync outbox lifecycle
      const outbox = await repo.listSyncOutbox();
      expect(outbox.length).toBeGreaterThanOrEqual(3);
      const firstId = outbox[0].id;
      await repo.incrementSyncOutboxAttempts(firstId);
      const updatedOutbox = await repo.listSyncOutbox();
      expect(updatedOutbox.find((e) => e.id === firstId)?.attempts).toBe(1);
      await repo.removeSyncOutboxEntry(firstId);
      expect(
        (await repo.listSyncOutbox()).find((e) => e.id === firstId)
      ).toBeUndefined();
      await repo.clearSyncOutbox();
      expect(await repo.listSyncOutbox()).toHaveLength(0);
    });

    it('serializes concurrent unawaited writes in FIFO order and recovers from a failed write', async () => {
      // Launch 15 concurrent writes without awaiting each individually
      const writes: Promise<unknown>[] = [];
      for (let i = 0; i < 15; i++) {
        writes.push(
          repo.upsertEvent({
            id: `conc-${i}`,
            dayKey: '2026-11-17',
            title: `Concurrente ${i}`,
            startQ: i,
            quarters: 1,
            type: 'task',
          })
        );
      }
      await Promise.all(writes);
      const events = await repo.listEvents();
      expect(events).toHaveLength(15);

      // Force a constraint error (CHECK constraint on type) via a write, then verify subsequent writes succeed
      await expect(
        repo.upsertEvent({
          id: 'bad-ev',
          dayKey: '2026-11-17',
          title: 'Invalid type',
          startQ: 10,
          quarters: 1,
          type: 'invalid_type' as 'task',
        })
      ).rejects.toThrow();

      await expect(
        repo.upsertEvent({
          id: 'after-error',
          dayKey: '2026-11-17',
          title: 'Recuperado',
          startQ: 20,
          quarters: 2,
          type: 'reminder',
        })
      ).resolves.toMatchObject({ id: 'after-error', title: 'Recuperado' });
    });

    it('preserves pending task and idea group ordering across updates and reconciles removed group items', async () => {
      await repo.upsertPendingTask({
        id: 'pt-1',
        title: 'Primero',
        completed: false,
        isFromYesterday: false,
        rolloverDays: 0,
        createdAt: 'Hoy',
      });
      await repo.upsertPendingTask({
        id: 'pt-2',
        title: 'Segundo',
        completed: false,
        isFromYesterday: false,
        rolloverDays: 0,
        createdAt: 'Hoy',
      });
      // Completing pt-1 should not move it behind pt-2
      await repo.upsertPendingTask({
        id: 'pt-1',
        title: 'Primero',
        completed: true,
        isFromYesterday: false,
        rolloverDays: 0,
        createdAt: 'Hoy',
      });
      const pending = await repo.listPendingTasks();
      expect(pending.map((p) => p.id)).toEqual(['pt-1', 'pt-2']);

      // Sequential upsertIdeaGroup maintains creation order and updating group reconciles removed items
      const grpA: IdeaGroup = {
        id: 'grp-a',
        title: 'Grupo A',
        subtitle: 'Sub A',
        icon: 'folder',
        accentColor: 'indigo',
        items: [
          {
            id: 'i-1',
            groupId: 'grp-a',
            title: 'Idea 1',
            desc: 'Uno',
            createdAtLabel: 'Hoy',
            daysInactive: 0,
          },
          {
            id: 'i-2',
            groupId: 'grp-a',
            title: 'Idea 2',
            desc: 'Dos',
            createdAtLabel: 'Hoy',
            daysInactive: 0,
          },
        ],
      };
      const grpB: IdeaGroup = {
        id: 'grp-b',
        title: 'Grupo B',
        subtitle: 'Sub B',
        icon: 'sparkle',
        accentColor: 'amber',
        items: [],
      };
      await repo.upsertIdeaGroup(grpA);
      await repo.upsertIdeaGroup(grpB);

      // Update grpA keeping only i-2
      await repo.upsertIdeaGroup({
        ...grpA,
        title: 'Grupo A Actualizado',
        items: [grpA.items[1]],
      });

      const groups = await repo.listIdeaGroups();
      expect(groups.map((g) => g.id)).toEqual(['grp-a', 'grp-b']);
      expect(groups[0].title).toBe('Grupo A Actualizado');
      expect(groups[0].items.map((i) => i.id)).toEqual(['i-2']);
      expect(await repo.getIdeaById('i-1')).toBeNull();
    });
  });

  describe('InMemoryDayCraftRepository & WebStorageDayCraftRepository Parity', () => {
    it('provides full repository parity in InMemoryDayCraftRepository', async () => {
      const repo = createInMemoryRepository();
      await repo.init();

      await repo.upsertPendingTask({
        id: 'p1',
        title: 'Activa',
        completed: false,
        isFromYesterday: false,
        rolloverDays: 0,
        createdAt: 'Hoy',
      });
      await repo.upsertPendingTask({
        id: 'p2',
        title: 'Archivada',
        completed: false,
        isFromYesterday: true,
        rolloverDays: 3,
        createdAt: 'Hace 3 días',
        archived: true,
      });

      expect(await repo.listPendingTasks()).toHaveLength(1);
      expect(
        await repo.listPendingTasks({ includeArchived: true })
      ).toHaveLength(2);

      // KV distinguishes empty array from null
      expect(await repo.getKv<unknown[]>('events_v9')).toBeNull();
      await repo.setKv('events_v9', []);
      expect(await repo.getKv<unknown[]>('events_v9')).toEqual([]);
    });

    it('migrates legacy daycraft_*_v9 localStorage keys and tolerates malformed JSON & quota errors', async () => {
      const storage = createMemoryWebStorage({
        daycraft_events_v9: JSON.stringify([
          {
            id: 'web-ev-1',
            dayKey: '27',
            title: 'Evento web legado',
            startQ: 36,
            quarters: 2,
            type: 'task',
          },
        ]),
        daycraft_pending_v9: '{broken-json',
        daycraft_ideas_v9: JSON.stringify(SEED_IDEA_GROUPS),
        daycraft_last_opened_date_v9: JSON.stringify('2026-11-14'),
        daycraft_theme_v1: JSON.stringify('murasaki'),
      });

      const repo = createWebRepository(storage);
      await repo.init();

      expect(await repo.isSeedInitialized()).toBe(true);
      const snap = await repo.getSnapshot();
      expect(snap.events).toHaveLength(1);
      expect(snap.events[0].dayKey).toBe(getTodayKey());
      expect(snap.pendingTasks).toEqual([]);
      expect(snap.ideaGroups).toHaveLength(SEED_IDEA_GROUPS.length);
      expect(snap.lastOpenedDate).toBe('2026-11-14');
      expect(await repo.getKv<string>('theme_v1')).toBe('murasaki');

      // Re-opening against the same storage restores persisted mutations
      await repo.upsertEvent({
        id: 'web-ev-2',
        dayKey: '2026-11-20',
        title: 'Nuevo evento web',
        startQ: 40,
        quarters: 2,
        type: 'reminder',
      });
      const repo2 = new WebStorageDayCraftRepository(storage);
      await repo2.init();
      expect(await repo2.getEventById('web-ev-2')).not.toBeNull();

      // QuotaExceededError fallback keeps memory working without throwing
      const quotaStorage: Storage = {
        ...createMemoryWebStorage(),
        setItem() {
          throw new Error('QuotaExceededError');
        },
      };
      const quotaRepo = createWebRepository(quotaStorage);
      await quotaRepo.init();
      await expect(
        quotaRepo.setKv('theme_v1', 'shiro')
      ).resolves.toBeUndefined();
      expect(await quotaRepo.getKv<string>('theme_v1')).toBe('shiro');
    });
  });

  describe('Singleton Lifecycle & Runtime Fallbacks (initDatabase / KV helpers)', () => {
    it('initializes in-memory fallback cleanly in Node and round-trips KV state', async () => {
      const repo = await initDatabase();
      expect(repo).toBeInstanceOf(InMemoryDayCraftRepository);
      expect(getRepository()).toBe(repo);

      await savePersistedState('empty_list_v9', []);
      expect(await loadPersistedState<unknown[]>('empty_list_v9')).toEqual([]);
      expect(await loadPersistedState<unknown[]>('missing_key')).toBeNull();
    });

    it('activates WebStorageDayCraftRepository when browser globals exist', async () => {
      const storage = createMemoryWebStorage();
      vi.stubGlobal('window', { localStorage: storage });
      vi.stubGlobal('document', {});
      vi.stubGlobal('navigator', { product: 'Gecko' });

      const repo = await initDatabase();
      expect(repo).toBeInstanceOf(WebStorageDayCraftRepository);

      await savePersistedState('theme_v1', 'aizome');
      expect(storage.getItem('daycraft_theme_v1')).toBe('"aizome"');
      expect(await loadPersistedState<string>('theme_v1')).toBe('aizome');
    });

    it('falls back to InMemoryDayCraftRepository without throwing when native SQLite fails to open', async () => {
      vi.stubGlobal('navigator', { product: 'ReactNative' });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const repo = await initDatabase();
      expect(repo).toBeInstanceOf(InMemoryDayCraftRepository);
      await savePersistedState('resilience_test', { ok: true });
      expect(
        await loadPersistedState<{ ok: boolean }>('resilience_test')
      ).toEqual({ ok: true });

      warnSpy.mockRestore();
    });

    it('handles SecurityError on window.localStorage getter gracefully without crashing', async () => {
      const restrictedWindow = {};
      Object.defineProperty(restrictedWindow, 'localStorage', {
        get() {
          throw new Error('SecurityError');
        },
      });
      vi.stubGlobal('window', restrictedWindow);
      vi.stubGlobal('document', {});
      vi.stubGlobal('navigator', { product: 'Gecko' });

      expect(isWebRuntime()).toBe(false);
      const repo = await initDatabase();
      expect(repo).toBeInstanceOf(InMemoryDayCraftRepository);
    });
  });

  describe('M1 Remediation Regression Tests (Migrations, Concurrency, Atomicity & Parity)', () => {
    function createAsyncYieldingNodeSQLiteExecutor(delayMs = 5): {
      executor: SQLiteExecutor & { closeAsync: () => Promise<void> };
      rawDb: DatabaseSync;
    } {
      const { executor: base, rawDb } = createNodeSQLiteExecutor();
      const tick = () => new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      const executor: SQLiteExecutor & { closeAsync: () => Promise<void> } = {
        async execAsync(sql: string) {
          await tick();
          return base.execAsync(sql);
        },
        async runAsync(sql: string, ...params: SQLiteBindValue[]) {
          await tick();
          return base.runAsync(sql, ...params);
        },
        async getFirstAsync<T>(sql: string, ...params: SQLiteBindValue[]) {
          await tick();
          return base.getFirstAsync<T>(sql, ...params);
        },
        async getAllAsync<T>(sql: string, ...params: SQLiteBindValue[]) {
          await tick();
          return base.getAllAsync<T>(sql, ...params);
        },
        async withTransactionAsync(task: () => Promise<void>) {
          rawDb.exec('BEGIN');
          try {
            await task();
            await tick();
            rawDb.exec('COMMIT');
          } catch (err) {
            try {
              rawDb.exec('ROLLBACK');
            } catch {
              // ignore rollback error
            }
            throw err;
          }
        },
        async closeAsync() {
          rawDb.close();
        },
      };
      return { executor, rawDb };
    }

    it('MIGRATE-NULL-EVENT & MIGRATE-CORRUPT-1: handles null/non-object legacy events and corrupt-only JSON without setting seed_initialized', async () => {
      // 1. SQLite migration with null/undefined/primitive items inside events_v9
      const { executor, rawDb } = createNodeSQLiteExecutor();
      rawDb.exec(
        'CREATE TABLE kv_store (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);'
      );
      rawDb
        .prepare('INSERT INTO kv_store (key, value) VALUES (?, ?)')
        .run(
          'events_v9',
          JSON.stringify([
            null,
            123,
            {
              id: 'ok-1',
              dayKey: '27',
              title: 'Valid',
              startQ: 10,
              quarters: 2,
              type: 'task',
            },
          ])
        );

      const repo = createSQLiteRepository(executor);
      await repo.init();
      const events = await repo.listEvents();
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe('ok-1');
      expect(events[0].dayKey).toBe(getTodayKey());
      expect(await repo.isSeedInitialized()).toBe(true);
      await repo.close();

      // 2. Corrupt-only JSON must NOT set seed_initialized = true (SQLite)
      const corrupt = createNodeSQLiteExecutor();
      corrupt.rawDb.exec(
        'CREATE TABLE kv_store (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);'
      );
      corrupt.rawDb
        .prepare('INSERT INTO kv_store (key, value) VALUES (?, ?)')
        .run('events_v9', '{corrupt-json');
      const corruptRepo = createSQLiteRepository(corrupt.executor);
      await corruptRepo.init();
      expect(await corruptRepo.isSeedInitialized()).toBe(false);
      await corruptRepo.close();

      // 3. WebStorage parity for MIGRATE-NULL-EVENT & MIGRATE-CORRUPT-1
      const webNullStorage = createMemoryWebStorage({
        daycraft_events_v9: JSON.stringify([
          null,
          'bad',
          {
            id: 'web-ok',
            dayKey: '28',
            title: 'Web Valid',
            startQ: 20,
            quarters: 2,
            type: 'task',
          },
        ]),
      });
      const webNullRepo = createWebRepository(webNullStorage);
      await webNullRepo.init();
      const webEvents = await webNullRepo.listEvents();
      expect(webEvents.map((e) => e.id)).toEqual(['web-ok']);
      expect(webEvents[0].dayKey).toBe(getDateKeyWithOffset(1));
      expect(await webNullRepo.isSeedInitialized()).toBe(true);

      const webCorruptStorage = createMemoryWebStorage({
        daycraft_events_v9: '{corrupt-json',
      });
      const webCorruptRepo = createWebRepository(webCorruptStorage);
      await webCorruptRepo.init();
      expect(await webCorruptRepo.isSeedInitialized()).toBe(false);
    });

    it('STAMP-VERSION-1: bumps version, refreshes updatedAt, and sets syncStatus=pending on read-modify-write local updates', async () => {
      const { executor } = createNodeSQLiteExecutor();
      const repo = createSQLiteRepository(executor);
      await repo.init();

      await repo.upsertEvent(
        {
          id: 'ev-rmw',
          dayKey: '2026-11-17',
          title: 'v1',
          startQ: 36,
          quarters: 2,
          type: 'task',
          updatedAt: '2026-11-01T00:00:00.000Z',
          syncStatus: 'synced',
          version: 1,
        },
        { enqueueSync: false }
      );

      const loaded = await repo.getEventById('ev-rmw');
      expect(loaded).not.toBeNull();
      expect(loaded?.version).toBe(1);
      expect(loaded?.syncStatus).toBe('synced');

      const updated = await repo.upsertEvent({ ...loaded!, title: 'v2' });
      expect(updated.version).toBe(2);
      expect(updated.syncStatus).toBe('pending');
      expect(updated.updatedAt).not.toBe('2026-11-01T00:00:00.000Z');

      const outbox = await repo.listSyncOutbox();
      expect(outbox).toHaveLength(1);
      const outboxPayload = JSON.parse(outbox[0].payload) as TimelineEvent;
      expect(outboxPayload.version).toBe(2);
      expect(outboxPayload.syncStatus).toBe('pending');

      // Remote sync pull (enqueueSync: false) preserves caller metadata
      const pulled = await repo.upsertEvent(
        {
          ...updated,
          title: 'remote-v5',
          version: 5,
          syncStatus: 'synced',
          updatedAt: '2026-11-18T12:00:00.000Z',
        },
        { enqueueSync: false }
      );
      expect(pulled.version).toBe(5);
      expect(pulled.syncStatus).toBe('synced');
      expect(pulled.updatedAt).toBe('2026-11-18T12:00:00.000Z');

      await repo.close();
    });

    it('RACE-READ-TX-1 & CLOSE-RACE-1: serializes reads behind pending transactions and drains synchronous writes before close()', async () => {
      const { executor } = createAsyncYieldingNodeSQLiteExecutor(4);
      const repo = new ExpoSQLiteDayCraftRepository(executor);
      await repo.init();

      const bigGroup: IdeaGroup = {
        id: 'grp-concurrent-read',
        title: 'Concurrent Group',
        subtitle: '6 items',
        icon: 'folder',
        accentColor: 'indigo',
        items: Array.from({ length: 6 }, (_, i) => ({
          id: `item-${i}`,
          groupId: 'grp-concurrent-read',
          title: `Idea ${i}`,
          desc: `Desc ${i}`,
          createdAtLabel: 'Hoy',
          daysInactive: 0,
        })),
      };

      const writePromise = repo.upsertIdeaGroup(bigGroup);
      const readPromise = repo.listIdeaGroups();

      const [written, readGroups] = await Promise.all([writePromise, readPromise]);
      expect(written.items).toHaveLength(6);
      expect(readGroups).toHaveLength(1);
      expect(readGroups[0].items).toHaveLength(6);

      // CLOSE-RACE-1: write enqueued synchronously immediately before close() must succeed
      const w1 = repo.upsertEvent({
        id: 'close-race-ev',
        dayKey: '2026-11-17',
        title: 'Before Close',
        startQ: 40,
        quarters: 2,
        type: 'task',
      });
      await repo.close();
      await expect(w1).resolves.toMatchObject({ id: 'close-race-ev' });
    });

    it('rolls back single-entity upsert/delete atomically if sync_outbox insert fails', async () => {
      const { executor, rawDb } = createNodeSQLiteExecutor();
      const repo = createSQLiteRepository(executor);
      await repo.init();

      rawDb.exec(`
        CREATE TRIGGER block_outbox_insert
        BEFORE INSERT ON sync_outbox
        BEGIN
          SELECT RAISE(ABORT, 'simulated outbox failure');
        END;
      `);

      await expect(
        repo.upsertEvent({
          id: 'tx-rollback-ev',
          dayKey: '2026-11-17',
          title: 'Should Rollback',
          startQ: 40,
          quarters: 2,
          type: 'task',
        })
      ).rejects.toThrow(/simulated outbox failure/);

      expect(await repo.getEventById('tx-rollback-ev')).toBeNull();
      expect(await repo.listSyncOutbox()).toHaveLength(0);

      rawDb.exec('DROP TRIGGER block_outbox_insert;');
      await repo.upsertEvent({
        id: 'tx-ok-ev',
        dayKey: '2026-11-17',
        title: 'Committed',
        startQ: 40,
        quarters: 2,
        type: 'task',
      });

      rawDb.exec(`
        CREATE TRIGGER block_outbox_delete
        BEFORE INSERT ON sync_outbox
        BEGIN
          SELECT RAISE(ABORT, 'simulated outbox delete failure');
        END;
      `);

      await expect(repo.deleteEvent('tx-ok-ev', { soft: true })).rejects.toThrow(
        /simulated outbox delete failure/
      );
      expect(await repo.getEventById('tx-ok-ev')).not.toBeNull();

      await repo.close();
    });

    it('WebStorageDayCraftRepository.setKv persists to localStorage synchronously before any await', () => {
      const storage = createMemoryWebStorage();
      const repo = createWebRepository(storage);

      void repo.setKv('theme_v1', 'sumi');
      expect(storage.getItem('daycraft_theme_v1')).toBe('"sumi"');
    });

    it('enforces full cross-repository parity across InMemory, WebStorage, and ExpoSQLite', async () => {
      const { executor } = createNodeSQLiteExecutor();
      const repos = [
        { name: 'InMemory', repo: createInMemoryRepository() },
        { name: 'WebStorage', repo: createWebRepository(createMemoryWebStorage()) },
        { name: 'ExpoSQLite', repo: createSQLiteRepository(executor) },
      ];

      for (const { repo } of repos) {
        await repo.init();

        // 1. listEvents sorting: dayKey ASC, startQ ASC
        await repo.upsertEvent({
          id: 'e-late',
          dayKey: '2026-11-20',
          title: 'Late',
          startQ: 60,
          quarters: 2,
          type: 'task',
        });
        await repo.upsertEvent({
          id: 'e-early-2',
          dayKey: '2026-11-17',
          title: 'Early Q40',
          startQ: 40,
          quarters: 2,
          type: 'task',
        });
        await repo.upsertEvent({
          id: 'e-early-1',
          dayKey: '2026-11-17',
          title: 'Early Q20',
          startQ: 20,
          quarters: 2,
          type: 'task',
        });
        expect((await repo.listEvents()).map((e) => e.id)).toEqual([
          'e-early-1',
          'e-early-2',
          'e-late',
        ]);

        // 2. upsertIdea append ordering & searchIdeas literal '%' and '_'
        await repo.upsertIdea({
          id: 'i1',
          groupId: 'grp-parity',
          title: 'First 100% real',
          desc: 'Contains percent',
          createdAtLabel: 'Hoy',
          daysInactive: 0,
        });
        await repo.upsertIdea({
          id: 'i2',
          groupId: 'grp-parity',
          title: 'Second normal_key',
          desc: 'Contains underscore',
          createdAtLabel: 'Hoy',
          daysInactive: 0,
        });
        expect((await repo.listIdeas({ groupId: 'grp-parity' })).map((i) => i.id)).toEqual([
          'i1',
          'i2',
        ]);
        expect((await repo.searchIdeas('%')).map((i) => i.id)).toEqual(['i1']);
        expect((await repo.searchIdeas('_')).map((i) => i.id)).toEqual(['i2']);

        // 3. listSyncOutbox sorted by createdAt ASC
        await repo.clearSyncOutbox();
        await repo.enqueueSyncOutbox({
          id: 'o-2',
          entityType: 'event',
          entityId: 'e-late',
          operation: 'upsert',
          payload: '{}',
          createdAt: '2026-11-17T12:00:00.000Z',
        });
        await repo.enqueueSyncOutbox({
          id: 'o-1',
          entityType: 'event',
          entityId: 'e-early-1',
          operation: 'upsert',
          payload: '{}',
          createdAt: '2026-11-17T10:00:00.000Z',
        });
        expect((await repo.listSyncOutbox()).map((o) => o.id)).toEqual(['o-1', 'o-2']);

        // 4. soft-delete with enqueueSync: false sets syncStatus = 'synced'
        await repo.deleteEvent('e-late', { soft: true, enqueueSync: false });
        const allWithDeleted = await repo.listEvents({ includeDeleted: true });
        expect(allWithDeleted.find((e) => e.id === 'e-late')?.syncStatus).toBe('synced');

        // 5. upsertIdeaGroup enforces child groupId = group.id & preserves soft-deleted tombstones
        await repo.upsertIdeaGroup({
          id: 'grp-tomb',
          title: 'Tombstone Group',
          subtitle: 'Test',
          icon: 'folder',
          accentColor: 'indigo',
          items: [
            {
              id: 't1',
              groupId: 'wrong-group-id',
              title: 'Keep',
              desc: 'Active',
              createdAtLabel: 'Hoy',
              daysInactive: 0,
            },
            {
              id: 't2',
              groupId: 'grp-tomb',
              title: 'Soft Delete',
              desc: 'Will be soft deleted',
              createdAtLabel: 'Hoy',
              daysInactive: 0,
            },
          ],
        });
        await repo.deleteIdea('t2', { soft: true });
        const activeSnap = await repo.getIdeaGroupById('grp-tomb');
        expect(activeSnap?.items.map((i) => i.id)).toEqual(['t1']);
        expect(activeSnap?.items[0].groupId).toBe('grp-tomb');

        const updatedGrp = await repo.upsertIdeaGroup({
          ...activeSnap!,
          title: 'Tombstone Group Updated',
        });
        expect(updatedGrp.items[0].groupId).toBe('grp-tomb');
        const withDeletedGroups = await repo.listIdeaGroups({ includeDeleted: true });
        const tombGroup = withDeletedGroups.find((g) => g.id === 'grp-tomb');
        expect(tombGroup?.items.some((i) => i.id === 't2' && Boolean(i.deletedAt))).toBe(true);

        // 6. upsertAlert preserves alert ordering
        await repo.upsertAlert({
          id: 'al-1',
          type: 'rollover',
          title: 'First',
          subtitle: 'Sub',
          badgeText: '1/3',
        });
        await repo.upsertAlert({
          id: 'al-2',
          type: 'rollover',
          title: 'Second',
          subtitle: 'Sub',
          badgeText: '2/3',
        });
        await repo.upsertAlert({
          id: 'al-1',
          type: 'rollover',
          title: 'First Updated',
          subtitle: 'Sub',
          badgeText: '1/3',
        });
        expect((await repo.listAlerts()).map((a) => a.id)).toEqual(['al-1', 'al-2']);

        await repo.close();
      }
    });

    it('searchIdeas Unicode/Spanish case-folding, listIdeas cross-group order, and upsertIdeaGroup cross-group move match across all 3 repositories', async () => {
      const { executor } = createNodeSQLiteExecutor();
      const repos = [
        { name: 'InMemory', repo: createInMemoryRepository() },
        { name: 'WebStorage', repo: createWebRepository(createMemoryWebStorage()) },
        { name: 'ExpoSQLite', repo: createSQLiteRepository(executor) },
      ];

      for (const { repo } of repos) {
        await repo.init();

        const g1: IdeaGroup = {
          id: 'g1',
          title: 'Grupo Uno',
          subtitle: 'Sub 1',
          icon: 'folder',
          accentColor: 'indigo',
          items: [
            {
              id: 'g1-i1',
              groupId: 'g1',
              title: 'Árbol y Ñandú',
              desc: 'Café 100% puro_test\\slash',
              markdownContent: '# Éxito\nÍndigo óptimo y pingüino',
              createdAtLabel: 'Hoy',
              daysInactive: 0,
              suggestedAction: 'Último paso',
            },
            {
              id: 'g1-i2',
              groupId: 'g1',
              title: 'Segunda en G1',
              desc: 'Sin acentos especiales',
              createdAtLabel: 'Hoy',
              daysInactive: 0,
            },
          ],
        };
        const g2: IdeaGroup = {
          id: 'g2',
          title: 'Grupo Dos',
          subtitle: 'Sub 2',
          icon: 'sparkle',
          accentColor: 'amber',
          items: [
            {
              id: 'g2-i1',
              groupId: 'g2',
              title: 'Primera en G2',
              desc: 'ÁRBOL de notas',
              createdAtLabel: 'Hoy',
              daysInactive: 0,
            },
            {
              id: 'g2-i2',
              groupId: 'g2',
              title: 'Segunda en G2',
              desc: 'Otro elemento',
              createdAtLabel: 'Hoy',
              daysInactive: 0,
            },
          ],
        };

        await repo.upsertIdeaGroup(g1);
        await repo.upsertIdeaGroup(g2);

        // Cross-group listIdeas & searchIdeas('') ordering must group by group order
        expect((await repo.listIdeas()).map((i) => i.id)).toEqual([
          'g1-i1',
          'g1-i2',
          'g2-i1',
          'g2-i2',
        ]);
        expect((await repo.searchIdeas('')).map((i) => i.id)).toEqual([
          'g1-i1',
          'g1-i2',
          'g2-i1',
          'g2-i2',
        ]);

        // Spanish Unicode case-folding + LIKE metacharacters across all 3 repos
        expect((await repo.searchIdeas('árbol')).map((i) => i.id)).toEqual([
          'g1-i1',
          'g2-i1',
        ]);
        expect((await repo.searchIdeas('ÁRBOL')).map((i) => i.id)).toEqual([
          'g1-i1',
          'g2-i1',
        ]);
        expect((await repo.searchIdeas('ñandú')).map((i) => i.id)).toEqual([
          'g1-i1',
        ]);
        expect((await repo.searchIdeas('éxito')).map((i) => i.id)).toEqual([
          'g1-i1',
        ]);
        expect((await repo.searchIdeas('último')).map((i) => i.id)).toEqual([
          'g1-i1',
        ]);
        expect((await repo.searchIdeas('%')).map((i) => i.id)).toEqual([
          'g1-i1',
        ]);
        expect((await repo.searchIdeas('_')).map((i) => i.id)).toEqual([
          'g1-i1',
        ]);
        expect((await repo.searchIdeas('\\')).map((i) => i.id)).toEqual([
          'g1-i1',
        ]);

        // Cross-group move via upsertIdeaGroup must remove moved item from source group without duplicates
        const movedItem = { ...g1.items[0], groupId: 'g2' };
        await repo.upsertIdeaGroup({
          ...g2,
          items: [...g2.items, movedItem],
        });

        const updatedG1 = await repo.getIdeaGroupById('g1');
        const updatedG2 = await repo.getIdeaGroupById('g2');
        expect(updatedG1?.items.map((i) => i.id)).toEqual(['g1-i2']);
        expect(updatedG2?.items.map((i) => i.id)).toEqual([
          'g2-i1',
          'g2-i2',
          'g1-i1',
        ]);
        expect(updatedG2?.items[2].groupId).toBe('g2');
        expect(updatedG2?.items[2].version).toBe(2);
        expect((await repo.listIdeas()).map((i) => i.id)).toEqual([
          'g1-i2',
          'g2-i1',
          'g2-i2',
          'g1-i1',
        ]);

        await repo.close();
      }
    });

    it('WEB-IDEAS-NULL-ITEMS-1 & getKv QuotaExceededError: normalizes malformed WebStorage idea groups and prefers in-session kvMap after quota failure', async () => {
      // 1. Legacy daycraft_ideas_v9 with missing items, null/non-object items, and invalid groupId
      const legacyStorage = createMemoryWebStorage({
        daycraft_ideas_v9: JSON.stringify([
          null,
          {
            id: 'grp-no-items',
            title: 'Sin Items',
            subtitle: 'Test',
            icon: 'folder',
            accentColor: 'indigo',
          },
          {
            id: 'grp-mixed',
            title: 'Mixto',
            subtitle: 'Con nulos',
            icon: 'sparkle',
            accentColor: 'amber',
            items: [
              null,
              42,
              { title: 'missing-id' },
              {
                id: 'idea-mismatch',
                groupId: 'nonexistent',
                title: 'Normalizada',
                desc: 'OK',
                createdAtLabel: 'Hoy',
                daysInactive: 0,
              },
            ],
          },
        ]),
      });

      const webRepo = createWebRepository(legacyStorage);
      await webRepo.init();

      const groups = await webRepo.listIdeaGroups();
      expect(groups.map((g) => g.id)).toEqual(['grp-no-items', 'grp-mixed']);
      expect(groups[0].items).toEqual([]);
      expect(groups[1].items).toHaveLength(1);
      expect(groups[1].items[0].id).toBe('idea-mismatch');
      expect(groups[1].items[0].groupId).toBe('grp-mixed');

      const snap = await webRepo.getSnapshot();
      expect(snap.ideaGroups).toHaveLength(2);

      // 2. Also handle malformed daycraft_v1_idea_groups on reload
      const v1MalformedStorage = createMemoryWebStorage({
        daycraft_v1_idea_groups: JSON.stringify([
          { id: 'v1-no-items', title: 'V1', subtitle: '', icon: 'folder', accentColor: 'indigo' },
          {
            id: 'v1-null-item',
            title: 'V1 Nulls',
            subtitle: '',
            icon: 'folder',
            accentColor: 'indigo',
            items: [null, { id: 'v1-ok', title: 'Valid', desc: '', createdAtLabel: 'Hoy', daysInactive: 0 }],
          },
        ]),
      });
      const v1Repo = createWebRepository(v1MalformedStorage);
      await v1Repo.init();
      const v1Groups = await v1Repo.listIdeaGroups();
      expect(v1Groups[0].items).toEqual([]);
      expect(v1Groups[1].items).toHaveLength(1);
      expect(v1Groups[1].items[0].groupId).toBe('v1-null-item');

      // 3. QuotaExceededError: getKv() must return latest in-session kvMap value instead of stale localStorage
      let failWrites = false;
      const baseMap = new Map<string, string>([
        ['daycraft_theme_v1', JSON.stringify('granate')],
      ]);
      const quotaStorage: Storage = {
        get length() {
          return baseMap.size;
        },
        clear() {
          baseMap.clear();
        },
        getItem(k: string) {
          return baseMap.has(k) ? baseMap.get(k)! : null;
        },
        key(i: number) {
          return Array.from(baseMap.keys())[i] ?? null;
        },
        removeItem(k: string) {
          baseMap.delete(k);
        },
        setItem(k: string, v: string) {
          if (failWrites) {
            throw new Error('QuotaExceededError');
          }
          baseMap.set(k, v);
        },
      };

      const quotaRepo = createWebRepository(quotaStorage);
      await quotaRepo.init();
      expect(await quotaRepo.getKv<string>('theme_v1')).toBe('granate');

      failWrites = true;
      await quotaRepo.setKv('theme_v1', 'murasaki');
      expect(await quotaRepo.getKv<string>('theme_v1')).toBe('murasaki');
      // Stale value in underlying localStorage was untouched, yet getKv reflects in-session update
      expect(quotaStorage.getItem('daycraft_theme_v1')).toBe('"granate"');
    });

    it('CLOSE-INIT-RACE-1: awaits in-flight init() inside close() and leaves SQLite handle closed', async () => {
      let closeCount = 0;
      let isClosed = false;
      const { executor } = createNodeSQLiteExecutor();

      const repo = new ExpoSQLiteDayCraftRepository(async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 15));
        isClosed = false;
        return {
          ...executor,
          async closeAsync() {
            closeCount += 1;
            isClosed = true;
            await executor.closeAsync();
          },
        };
      });

      const pInit = repo.init();
      await Promise.all([repo.close(), repo.close()]);
      await pInit;

      expect(closeCount).toBe(1);
      expect(isClosed).toBe(true);
      expect((repo as unknown as { db: unknown }).db).toBeNull();
    });

    it('MIGRATE-EDGE-VALUES-1: sanitizes non-primitive objects in optional legacy v9 fields without aborting SQLite migration', async () => {
      const { executor, rawDb } = createNodeSQLiteExecutor();
      rawDb.exec(
        'CREATE TABLE kv_store (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);'
      );
      rawDb
        .prepare('INSERT INTO kv_store (key, value) VALUES (?, ?)')
        .run(
          'events_v9',
          JSON.stringify([
            {
              id: 'edge-ev-1',
              dayKey: '27',
              title: 'Evento con objetos inválidos',
              desc: { obj: 1 },
              tag: { nested: true },
              startQ: 40,
              quarters: 2,
              type: 'task',
              updatedAt: { bad: 'ts' },
              deletedAt: ['bad'],
              syncStatus: { bad: 'status' },
              version: { bad: 99 },
            },
          ])
        );
      rawDb
        .prepare('INSERT INTO kv_store (key, value) VALUES (?, ?)')
        .run(
          'ideas_v9',
          JSON.stringify([
            {
              id: 'edge-grp-1',
              title: 'Grupo Edge',
              subtitle: 'Sub',
              icon: 'folder',
              accentColor: 'indigo',
              updatedAt: { bad: true },
              version: 'not-a-number',
              items: [
                {
                  id: 'edge-idea-1',
                  groupId: 'edge-grp-1',
                  title: 'Idea Edge',
                  desc: 'Desc válida',
                  markdownContent: { raw: '# bad' },
                  suggestedAction: ['not-a-string'],
                  createdAtLabel: 'Hoy',
                  daysInactive: 0,
                  updatedAt: 12345,
                  version: null,
                },
              ],
            },
          ])
        );

      const repo = createSQLiteRepository(executor);
      await expect(repo.init()).resolves.toBeUndefined();
      expect(await repo.getSchemaVersion()).toBe(1);
      expect(await repo.isSeedInitialized()).toBe(true);

      const events = await repo.listEvents();
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe('edge-ev-1');
      expect(events[0].desc).toBeUndefined();
      expect(events[0].tag).toBeUndefined();
      expect(events[0].version).toBe(1);
      expect(events[0].syncStatus).toBe('synced');

      const ideas = await repo.listIdeas();
      expect(ideas).toHaveLength(1);
      expect(ideas[0].id).toBe('edge-idea-1');
      expect(ideas[0].markdownContent).toBeUndefined();
      expect(ideas[0].suggestedAction).toBeUndefined();
      expect(ideas[0].version).toBe(1);

      await repo.close();
    });

    it('CLOSE-INIT-RACE-2: resolves upsertEvent + immediate close() on uninitialized ExpoSQLiteDayCraftRepository without deadlock', async () => {
      let closeCount = 0;
      let isClosed = false;
      const { executor } = createNodeSQLiteExecutor();

      const repo = new ExpoSQLiteDayCraftRepository(async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
        isClosed = false;
        return {
          ...executor,
          async closeAsync() {
            closeCount += 1;
            isClosed = true;
            await executor.closeAsync();
          },
        };
      });

      const pWrite = repo.upsertEvent({
        id: 'race2-ev',
        dayKey: '2026-11-17',
        title: 'Write before immediate close',
        startQ: 36,
        quarters: 2,
        type: 'task',
      });
      const pClose = repo.close();

      const [saved] = await Promise.all([pWrite, pClose]);
      expect(saved.id).toBe('race2-ev');
      expect(closeCount).toBe(1);
      expect(isClosed).toBe(true);
      expect((repo as unknown as { db: unknown }).db).toBeNull();
    });

    it('init() called during async closeAsync() waits for close to finish and re-opens a valid handle', async () => {
      let openCount = 0;
      const handleStates: { closed: boolean }[] = [];

      const repo = new ExpoSQLiteDayCraftRepository(async () => {
        openCount += 1;
        const { executor } = createNodeSQLiteExecutor();
        const state = { closed: false };
        handleStates.push(state);
        return {
          ...executor,
          async closeAsync() {
            await new Promise<void>((resolve) => setTimeout(resolve, 35));
            state.closed = true;
            await executor.closeAsync();
          },
        };
      });

      await repo.init();
      expect(openCount).toBe(1);

      const pClose = repo.close();
      let resolvedWhileFirstHandleOpen = false;
      const pInit = repo.init().then(() => {
        resolvedWhileFirstHandleOpen = !handleStates[0].closed;
      });

      await Promise.all([pClose, pInit]);

      expect(resolvedWhileFirstHandleOpen).toBe(false);
      expect(handleStates[0].closed).toBe(true);
      expect(openCount).toBe(2);
      expect(handleStates[1].closed).toBe(false);
      expect((repo as unknown as { db: unknown }).db).not.toBeNull();

      await repo.upsertEvent({
        id: 'reopened-ev',
        dayKey: '2026-11-17',
        title: 'After reopen',
        startQ: 40,
        quarters: 2,
        type: 'task',
      });
      expect((await repo.getEventById('reopened-ev'))?.title).toBe('After reopen');

      await repo.close();
      expect(handleStates[1].closed).toBe(true);
    });

    it('simultaneous close() + upsertEvent() on uninitialized repo and writes during async closeAsync() resolve without deadlock or closed-handle errors', async () => {
      const handleStates: { closed: boolean }[] = [];

      const repo = new ExpoSQLiteDayCraftRepository(async () => {
        const { executor } = createNodeSQLiteExecutor();
        const state = { closed: false };
        handleStates.push(state);
        return {
          ...executor,
          async closeAsync() {
            await new Promise<void>((resolve) => setTimeout(resolve, 25));
            state.closed = true;
            await executor.closeAsync();
          },
        };
      });

      // Simultaneous close() + upsertEvent() on uninitialized repo
      const pCloseUninitialized = repo.close();
      const pWriteAfterClose = repo.upsertEvent({
        id: 'after-uninit-close-ev',
        dayKey: '2026-11-17',
        title: 'Deferred after uninit close',
        startQ: 42,
        quarters: 2,
        type: 'task',
      });
      const [, saved1] = await Promise.all([pCloseUninitialized, pWriteAfterClose]);
      expect(saved1.id).toBe('after-uninit-close-ev');
      expect((await repo.getEventById('after-uninit-close-ev'))?.title).toBe(
        'Deferred after uninit close'
      );

      // Write arriving mid-closeAsync() defers until close finishes and re-opens cleanly
      const pCloseAsync = repo.close();
      await new Promise<void>((resolve) => setTimeout(resolve, 5));
      const pWriteMidClose = repo.upsertEvent({
        id: 'mid-close-ev',
        dayKey: '2026-11-17',
        title: 'Deferred mid-close',
        startQ: 44,
        quarters: 2,
        type: 'task',
      });
      const [, saved2] = await Promise.all([pCloseAsync, pWriteMidClose]);
      expect(saved2.id).toBe('mid-close-ev');
      expect(handleStates[0].closed).toBe(true);
      expect(handleStates).toHaveLength(2);
      expect((await repo.getEventById('mid-close-ev'))?.title).toBe(
        'Deferred mid-close'
      );

      await repo.close();
    });

    it('hardens WebStorage v1 idea_groups groupId validation and getSnapshot() KV fallback type validation', async () => {
      // 1. WebStorage v1 reload validates item.groupId against valid groupIds
      const v1Storage = createMemoryWebStorage({
        daycraft_v1_idea_groups: JSON.stringify([
          {
            id: 'v1-grp-a',
            title: 'Group A',
            subtitle: '',
            icon: 'folder',
            accentColor: 'indigo',
            items: [
              {
                id: 'v1-dangling',
                groupId: 'deleted-or-unknown-grp',
                title: 'Dangling groupId',
                desc: '',
                createdAtLabel: 'Hoy',
                daysInactive: 0,
              },
            ],
          },
          {
            id: 'v1-grp-b',
            title: 'Group B',
            subtitle: '',
            icon: 'sparkle',
            accentColor: 'amber',
            items: [],
          },
        ]),
      });
      const webRepo = createWebRepository(v1Storage);
      await webRepo.init();
      const loadedGroups = await webRepo.listIdeaGroups();
      expect(loadedGroups[0].items[0].groupId).toBe('v1-grp-a');

      // 2. getSnapshot() validates non-string last_opened_date_v9 and non-plain-object gemini_config_v9
      const { executor } = createNodeSQLiteExecutor();
      const repos = [
        createInMemoryRepository(),
        createWebRepository(createMemoryWebStorage()),
        createSQLiteRepository(executor),
      ];

      for (const repo of repos) {
        await repo.init();
        await repo.setKv('last_opened_date_v9', { bad: 'object' });
        await repo.setKv('gemini_config_v9', ['not', 'an', 'object']);

        const snap1 = await repo.getSnapshot();
        expect(snap1.lastOpenedDate).toBeNull();
        expect(snap1.geminiConfig).toEqual({ apiKey: '', useCloudAI: false });

        await repo.setKv('gemini_config_v9', 'not-an-object-string');
        const snap2 = await repo.getSnapshot();
        expect(snap2.geminiConfig).toEqual({ apiKey: '', useCloudAI: false });

        await repo.close();
      }
    });
  });
});
