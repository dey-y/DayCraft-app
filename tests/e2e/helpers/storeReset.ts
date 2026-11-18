import { loadContractModule } from './contractLoader';
import { installWebStorageShim, MemoryStorage } from './runtimeEnv';

export interface IsolatedEnvironment {
  storage: MemoryStorage;
  dayCraftStore: any;
  themeStore: any;
}

/**
 * Sets up an isolated per-test Web-parity storage + fresh Zustand store state
 * without relying on execution order or leaking state between tests.
 */
export async function setupIsolatedStores(): Promise<IsolatedEnvironment> {
  const storage = installWebStorageShim();
  storage.clear();

  const dayCraftMod = await loadContractModule<any>('store/useDayCraftStore');
  const themeMod = await loadContractModule<any>('store/useThemeStore');
  const sqliteMod = await loadContractModule<any>('services/db/sqlite');
  const themeConstMod = await loadContractModule<any>('constants/theme');

  if (typeof sqliteMod.setRepositoryForTesting === 'function') {
    const freshRepo =
      typeof sqliteMod.createWebRepository === 'function'
        ? sqliteMod.createWebRepository(storage)
        : typeof sqliteMod.createInMemoryRepository === 'function'
        ? sqliteMod.createInMemoryRepository()
        : null;
    sqliteMod.setRepositoryForTesting(freshRepo);
  }

  const dayCraftStore = dayCraftMod.useDayCraftStore;
  const themeStore = themeMod.useThemeStore;

  const todayKey = themeConstMod.getTodayKey();

  dayCraftStore.setState({
    days: themeConstMod.generateDaysRange(-7, 365),
    selectedDayKey: todayKey,
    lastOpenedDate: todayKey,
    sidebarOpen: true,
    bellDropdownOpen: false,
    desktopSideTab: 'agenda',
    geminiApiKey: '',
    useCloudAI: false,
    events: [...sqliteMod.SEED_EVENTS],
    pendingTasks: [...sqliteMod.SEED_PENDING],
    ideaGroups: sqliteMod.SEED_IDEA_GROUPS.map((g: any) => ({
      ...g,
      items: [...g.items],
    })),
    chatMessages: [...sqliteMod.SEED_CHAT],
    alerts: [...sqliteMod.SEED_ALERTS],
    activeToast: null,
    slotPickerTarget: null,
    activeIdeaId: null,
    isHydrated: false,
  });

  themeStore.setState({ themeName: 'granate' });

  return { storage, dayCraftStore, themeStore };
}

/**
 * Helper to create a clean fake fetch function for Gemini Cloud / Sync tests.
 */
export function mockGlobalFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response> | Response
): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    return handler(url, init);
  }) as typeof fetch;

  return () => {
    globalThis.fetch = original;
  };
}
