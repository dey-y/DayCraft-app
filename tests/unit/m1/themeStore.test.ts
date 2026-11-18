import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_THEME,
  THEMES,
  THEME_ORDER,
  themeCssVars,
  type ThemeColors,
  type ThemeName,
} from '@/constants/themes';
import type { SQLiteBindValue, SQLiteExecutor } from '@/services/db/migrations';
import {
  ExpoSQLiteDayCraftRepository,
  createInMemoryRepository,
  createWebRepository,
  loadPersistedState,
  setRepositoryForTesting,
} from '@/services/db/sqlite';
import { useThemeStore } from '@/store/useThemeStore';

function createAsyncNodeSQLiteExecutor(delayMs = 5): SQLiteExecutor & {
  closeAsync: () => Promise<void>;
} {
  const rawDb = new DatabaseSync(':memory:');
  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, delayMs));
  return {
    async execAsync(sql: string) {
      await tick();
      rawDb.exec(sql);
    },
    async runAsync(sql: string, ...params: SQLiteBindValue[]) {
      await tick();
      const res = rawDb.prepare(sql).run(...params);
      return {
        changes: Number(res.changes ?? 0),
        lastInsertRowId: Number(res.lastInsertRowid ?? 0),
      };
    },
    async getFirstAsync<T>(sql: string, ...params: SQLiteBindValue[]) {
      await tick();
      return (rawDb.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async getAllAsync<T>(sql: string, ...params: SQLiteBindValue[]) {
      await tick();
      return rawDb.prepare(sql).all(...params) as T[];
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
          // ignore
        }
        throw err;
      }
    },
    async closeAsync() {
      rawDb.close();
    },
  };
}

describe('M1 Theme Store (Kuro-Zen Persistence & Murasaki Bug Fix)', () => {
  beforeEach(async () => {
    const repo = createInMemoryRepository();
    await repo.init();
    setRepositoryForTesting(repo);
    useThemeStore.setState({ themeName: DEFAULT_THEME });
  });

  afterEach(() => {
    setRepositoryForTesting(null);
    vi.unstubAllGlobals();
  });

  it('preserves murasaki across setTheme and hydrateTheme instead of resetting to granate', async () => {
    useThemeStore.getState().setTheme('murasaki');
    expect(useThemeStore.getState().themeName).toBe('murasaki');

    // Allow fire-and-forget KV write to flush before resetting memory state
    await Promise.resolve();
    expect(await loadPersistedState<ThemeName>('theme_v1')).toBe('murasaki');

    // Simulate app restart (in-memory store reset to default) followed by hydration
    useThemeStore.setState({ themeName: DEFAULT_THEME });
    await useThemeStore.getState().hydrateTheme();

    expect(useThemeStore.getState().themeName).toBe('murasaki');
    expect(await loadPersistedState<ThemeName>('theme_v1')).toBe('murasaki');
  });

  it('persists and rehydrates all 6 THEME_ORDER themes plus akane faithfully', async () => {
    const allThemes: ThemeName[] = [...THEME_ORDER, 'akane'];

    for (const name of allThemes) {
      useThemeStore.getState().setTheme(name);
      await Promise.resolve();

      useThemeStore.setState({ themeName: DEFAULT_THEME });
      await useThemeStore.getState().hydrateTheme();

      expect(useThemeStore.getState().themeName).toBe(name);
    }
  });

  it('falls back to DEFAULT_THEME (granate) only when saved theme is missing or invalid', async () => {
    // Missing key
    await useThemeStore.getState().hydrateTheme();
    expect(useThemeStore.getState().themeName).toBe(DEFAULT_THEME);
    expect(await loadPersistedState<ThemeName>('theme_v1')).toBe(DEFAULT_THEME);

    // Corrupted / unknown theme string
    const repo = createInMemoryRepository();
    await repo.init();
    await repo.setKv('theme_v1', 'corrupted-theme-name');
    setRepositoryForTesting(repo);

    useThemeStore.setState({ themeName: 'shiro' });
    await useThemeStore.getState().hydrateTheme();
    expect(useThemeStore.getState().themeName).toBe(DEFAULT_THEME);
    expect(await loadPersistedState<ThemeName>('theme_v1')).toBe(DEFAULT_THEME);
  });

  it('ignores invalid theme names and Object.prototype keys in setTheme and hydrateTheme', async () => {
    useThemeStore.getState().setTheme('bosque');
    useThemeStore.getState().setTheme('nonexistent' as ThemeName);
    useThemeStore.getState().setTheme('constructor' as ThemeName);
    useThemeStore.getState().setTheme('toString' as ThemeName);
    await Promise.resolve();

    expect(useThemeStore.getState().themeName).toBe('bosque');
    expect(await loadPersistedState<ThemeName>('theme_v1')).toBe('bosque');

    // Prototype key in persisted storage must fall back to DEFAULT_THEME
    const repo = createInMemoryRepository();
    await repo.init();
    await repo.setKv('theme_v1', 'constructor');
    setRepositoryForTesting(repo);

    await useThemeStore.getState().hydrateTheme();
    expect(useThemeStore.getState().themeName).toBe(DEFAULT_THEME);
    expect(await loadPersistedState<ThemeName>('theme_v1')).toBe(DEFAULT_THEME);
  });

  it('RACE-THEME-1: preserves murasaki when setTheme is immediately followed by hydrateTheme under async SQLite', async () => {
    const repo = new ExpoSQLiteDayCraftRepository(createAsyncNodeSQLiteExecutor(5));
    await repo.init();
    setRepositoryForTesting(repo);

    useThemeStore.getState().setTheme('murasaki');
    await useThemeStore.getState().hydrateTheme();

    expect(useThemeStore.getState().themeName).toBe('murasaki');
    expect(await repo.getKv<ThemeName>('theme_v1')).toBe('murasaki');
    await repo.close();
  });

  it('prevents an in-flight hydrateTheme() from clobbering a newer setTheme() selection', async () => {
    const baseRepo = createInMemoryRepository();
    await baseRepo.init();
    let releaseRead!: () => void;
    const readGate = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const slowReadRepo = Object.create(baseRepo) as typeof baseRepo;
    slowReadRepo.getKv = async <T,>(key: string): Promise<T | null> => {
      await readGate;
      return baseRepo.getKv<T>(key);
    };
    setRepositoryForTesting(slowReadRepo);

    const hydratePromise = useThemeStore.getState().hydrateTheme();
    useThemeStore.getState().setTheme('sumi');
    releaseRead();
    await hydratePromise;

    expect(useThemeStore.getState().themeName).toBe('sumi');
    expect(await baseRepo.getKv<ThemeName>('theme_v1')).toBe('sumi');
  });

  it('persists setTheme synchronously to WebStorage before any microtask yield', async () => {
    const store = new Map<string, string>();
    const storage: Storage = {
      get length() {
        return store.size;
      },
      clear: () => store.clear(),
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      removeItem: (k: string) => {
        store.delete(k);
      },
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
    };
    setRepositoryForTesting(createWebRepository(storage));

    useThemeStore.getState().setTheme('sumi');
    expect(JSON.parse(storage.getItem('daycraft_theme_v1')!)).toBe('sumi');
  });

  it('exposes complete 15-token hex palettes and CSS vars for every theme', () => {
    const requiredTokens: (keyof ThemeColors)[] = [
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
    ];

    expect(THEME_ORDER).toEqual([
      'granate',
      'murasaki',
      'sumi',
      'aizome',
      'bosque',
      'shiro',
    ]);

    for (const name of [...THEME_ORDER, 'akane'] as ThemeName[]) {
      const def = THEMES[name];
      expect(def).toBeDefined();
      for (const token of requiredTokens) {
        expect(def.colors[token]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
      const vars = themeCssVars(def);
      expect(Object.keys(vars)).toHaveLength(15);
      expect(vars['--c-canvas']).toMatch(/^\d+ \d+ \d+$/);
      expect(vars['--c-line-subtle']).toMatch(/^\d+ \d+ \d+$/);
    }
  });
});
