import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: {
    OS: 'web',
    select: (obj: Record<string, any>) => obj.web ?? obj.default,
  },
  Animated: {
    Value: class {
      constructor(public value: number) {}
    },
    timing: () => ({ start: (cb?: () => void) => cb?.() }),
    spring: () => ({ start: (cb?: () => void) => cb?.() }),
    sequence: () => ({ start: (cb?: () => void) => cb?.() }),
  },
}));

import {
  LOCKED_MCP_RESOURCES,
  LOCKED_MCP_TOOLS,
  LOCKED_THEME_ORDER,
} from './helpers/contracts';
import {
  getTestRepository,
  loadContractModule,
  projectFileExists,
  readProjectFile,
} from './helpers/contractLoader';
import {
  contrastRatio,
  findColorEmojisInUi,
  findHardcodedColorsInUi,
  findSub12pxFontsInUi,
} from './helpers/runtimeEnv';
import { mockGlobalFetch, setupIsolatedStores } from './helpers/storeReset';

let restoreFetch: (() => void) | null = null;

beforeEach(() => {
  restoreFetch = null;
});

afterEach(() => {
  restoreFetch?.();
  vi.useRealTimers();
});

// ============================================================================
// TIER 4 — REAL-WORLD APPLICATION SCENARIOS (>= 9 scenarios)
// ============================================================================

describe('Tier 4 — Real-World Application Scenarios', () => {
  it('S1: Morning Brain Dump & Multi-Intent Dictation splits into all 4 drawers cleanly', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    await dayCraftStore.getState().hydrateFromSQLite();
    dayCraftStore.getState().setGeminiConfig({ apiKey: 'AIza-morning', useCloudAI: true });

    restoreFetch = mockGlobalFetch(async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: 'dispatch_intake_actions',
                      args: {
                        aiReply: 'Todo organizado para tu mañana sin estrés.',
                        items: [
                          {
                            kind: 'event',
                            title: 'Diseño de arquitectura v10',
                            dayKey: dayCraftStore.getState().selectedDayKey,
                            startQ: 38, // 09:30
                            quarters: 4, // 1h
                          },
                          {
                            kind: 'reminder',
                            title: 'Tomar vitamina D',
                            dayKey: dayCraftStore.getState().selectedDayKey,
                            startQ: 56, // 14:00
                            quarters: 1,
                          },
                          {
                            kind: 'pending',
                            title: 'Comprar café en grano',
                          },
                          {
                            kind: 'idea',
                            title: 'Modo lectura zen en Markdown',
                            ideaGroupId: 'grp-app',
                          },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await dayCraftStore
      .getState()
      .submitSmartIntake(
        'Bloque de diseño de arquitectura a las 09:30 1h, recuérdame tomar vitamina D a las 14:00, comprar café en grano hoy, y tengo la idea de un modo lectura zen en Markdown para mi app'
      );

    const state = dayCraftStore.getState();
    expect(state.events.some((e: any) => e.title === 'Diseño de arquitectura v10' && e.startQ === 38)).toBe(true);
    expect(state.events.some((e: any) => e.title === 'Tomar vitamina D' && e.type === 'reminder')).toBe(true);
    expect(state.pendingTasks.some((p: any) => p.title === 'Comprar café en grano')).toBe(true);
    const appGroup = state.ideaGroups.find((g: any) => g.id === 'grp-app');
    expect(appGroup.items.some((i: any) => i.title === 'Modo lectura zen en Markdown')).toBe(true);
    expect(state.activeToast).not.toBeNull();
  });

  it('S2: Full Time-Blocking Lifecycle (Pending -> Slot Picker -> Edit/Recurrence -> Complete -> Undo -> Persist)', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    await dayCraftStore.getState().hydrateFromSQLite();

    // 1. Capture unscheduled task
    const task = dayCraftStore.getState().addPendingTask('Revisar métricas semanales');
    expect(dayCraftStore.getState().pendingTasks.some((t: any) => t.id === task.id)).toBe(true);

    // 2. Schedule onto 24h Rail via 1-Tap Slot Picker
    dayCraftStore.getState().openSlotPicker({ type: 'pending', id: task.id, title: task.title });
    dayCraftStore.getState().assignSlotFromPicker(48, 2); // 12:00 - 12:30
    expect(dayCraftStore.getState().pendingTasks.some((t: any) => t.id === task.id)).toBe(false);

    const scheduled = dayCraftStore
      .getState()
      .events.find((e: any) => e.title === 'Revisar métricas semanales');
    expect(scheduled).toBeDefined();

    // 3. Edit block duration & add daily recurrence
    dayCraftStore.getState().openSlotPicker({
      type: 'edit_event',
      id: scheduled.id,
      title: scheduled.title,
      defaultStartQ: scheduled.startQ,
      defaultQuarters: scheduled.quarters,
    });
    dayCraftStore
      .getState()
      .assignSlotFromPicker(48, 4, 'Revisar métricas semanales', { frequency: 'daily' });

    // 4. Complete and Undo
    dayCraftStore.getState().toggleTimelineEventCompleted(scheduled.id);
    expect(
      dayCraftStore.getState().events.find((e: any) => e.id === scheduled.id)?.completed
    ).toBe(true);

    dayCraftStore.getState().activeToast?.onUndoAction?.();
    expect(
      dayCraftStore.getState().events.find((e: any) => e.id === scheduled.id)?.completed
    ).toBe(false);

    // 5. Cold reload persists edited event
    dayCraftStore.setState({ isHydrated: false, events: [] });
    await dayCraftStore.getState().hydrateFromSQLite();
    const reloaded = dayCraftStore
      .getState()
      .events.find((e: any) => e.title === 'Revisar métricas semanales');
    expect(reloaded?.quarters).toBe(4);
    expect(reloaded?.recurrence?.frequency).toBe('daily');
  });

  it('S3: Anti-Stress Multi-Day Rollover, 3-Day Rule Bell Rescue & Empty Celebration', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 17, 9, 0, 0));

    const { storage, dayCraftStore } = await setupIsolatedStores();
    storage.setItem('daycraft_last_opened_date_v9', JSON.stringify('2026-11-14')); // 3 days elapsed!
    storage.setItem(
      'daycraft_pending_v9',
      JSON.stringify([
        {
          id: 'p-old-1',
          title: 'Ordenar cables del estudio',
          completed: false,
          isFromYesterday: false,
          rolloverDays: 0,
          createdAt: 'Hace 3d',
        },
        {
          id: 'p-old-2',
          title: 'Responder correo de banco',
          completed: false,
          isFromYesterday: false,
          rolloverDays: 0,
          createdAt: 'Hace 3d',
        },
      ])
    );

    await dayCraftStore.getState().hydrateFromSQLite();

    // Multi-day elapsed rollover triggers 3-day rule alerts
    const p1 = dayCraftStore.getState().pendingTasks.find((p: any) => p.id === 'p-old-1');
    expect(p1.isFromYesterday).toBe(true);
    expect(p1.rolloverDays).toBeGreaterThanOrEqual(3);
    expect(dayCraftStore.getState().alerts.some((a: any) => a.relatedId === 'p-old-1')).toBe(true);

    // Rescue p-old-1 to Ideas Drawer without guilt, complete p-old-2
    dayCraftStore.getState().convertStalePendingToIdea('p-old-1');
    dayCraftStore.getState().togglePendingTask('p-old-2');

    const incompleteCount = dayCraftStore
      .getState()
      .pendingTasks.filter((t: any) => !t.completed).length;
    expect(incompleteCount).toBe(0);
    expect(
      dayCraftStore
        .getState()
        .ideaGroups.find((g: any) => g.id === 'grp-sparks')
        .items.some((i: any) => i.title === 'Ordenar cables del estudio')
    ).toBe(true);
  });

  it('S4: Custom Project Creation -> Smart Intake Auto-Match -> .md Edit -> Group Move -> Timeline Schedule', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    await dayCraftStore.getState().hydrateFromSQLite();

    // 1. Create custom folder
    const proj = dayCraftStore.getState().addIdeaGroup({
      title: 'Proyecto: Huerta Urbana',
      subtitle: 'Riego y semillas de temporada',
      icon: 'cup',
      accentColor: 'emerald',
    });

    // 2. Capture idea matching new project via Smart Intake
    await dayCraftStore
      .getState()
      .submitSmartIntake('Idea: Sistema de riego automático para Huerta Urbana');

    const projState = dayCraftStore.getState().ideaGroups.find((g: any) => g.id === proj.id);
    const createdIdea = projState.items.find((i: any) => i.title.includes('riego'));
    expect(createdIdea).toBeDefined();

    // 3. Edit markdown with checklist
    dayCraftStore.getState().updateIdeaMarkdown(createdIdea.id, {
      title: 'Riego por goteo solar',
      desc: 'Checklist de componentes',
      markdownContent: '# Riego por goteo solar\n\n- [x] Medir balcón\n- [ ] Comprar manguera 4mm',
    });

    // 4. Move to another group and schedule on Timeline
    dayCraftStore.getState().moveIdeaToGroup(createdIdea.id, 'grp-app');
    expect(
      dayCraftStore
        .getState()
        .ideaGroups.find((g: any) => g.id === 'grp-app')
        .items.some((i: any) => i.id === createdIdea.id)
    ).toBe(true);

    dayCraftStore.getState().openSlotPicker({
      type: 'idea',
      id: createdIdea.id,
      title: 'Comprar manguera 4mm',
    });
    dayCraftStore.getState().assignSlotFromPicker(68, 2); // 17:00
    expect(
      dayCraftStore.getState().events.some((e: any) => e.title === 'Comprar manguera 4mm')
    ).toBe(true);
  });

  it('S5: Offline Commute Outbox Queue -> Reconnect Sync -> Conflict Resolution', async () => {
    const syncMod = await loadContractModule<any>('services/sync/syncEngine');
    const repo = await getTestRepository();

    let isOnline = false;
    const pushedBatches: any[] = [];

    const transport = {
      push: async (entries: any[]) => {
        if (!isOnline) throw new Error('Offline in metro tunnel');
        pushedBatches.push(...entries);
        return { acceptedIds: entries.map((e) => e.id), serverEvents: [], conflicts: [] };
      },
      pull: async () => {
        if (!isOnline) throw new Error('Offline in metro tunnel');
        return {
          events: [
            {
              id: 'ev-remote-win',
              dayKey: '2026-11-17',
              title: 'Bloque actualizado en nube',
              startQ: 52,
              quarters: 2,
              type: 'task',
              updatedAt: '2026-11-17T18:00:00Z',
              version: 3,
            },
          ],
          pendingTasks: [],
          ideaGroups: [],
          cursor: 'cursor-10',
        };
      },
    };

    const engine = syncMod.createSyncEngine
      ? syncMod.createSyncEngine({ repository: repo, transport })
      : new syncMod.SyncEngine({ repository: repo, transport });

    // Offline work
    await repo.upsertEvent({
      id: 'ev-remote-win',
      dayKey: '2026-11-17',
      title: 'Borrador local viejo',
      startQ: 52,
      quarters: 2,
      type: 'task',
      updatedAt: '2026-11-17T08:00:00Z',
      version: 1,
    });
    await repo.enqueueSyncOutbox({
      id: 'out-metro-1',
      entityType: 'event',
      entityId: 'ev-metro-new',
      operation: 'upsert',
      payload: JSON.stringify({
        id: 'ev-metro-new',
        dayKey: '2026-11-17',
        title: 'Nota en metro',
        startQ: 60,
        quarters: 2,
        type: 'task',
      }),
      createdAt: '2026-11-17T08:15:00Z',
      attempts: 0,
    });

    const offlineState = await engine.syncNow();
    expect(offlineState.status).toBe('error');
    expect(offlineState.pendingCount).toBeGreaterThanOrEqual(1);

    // Reconnect
    isOnline = true;
    const syncedState = await engine.syncNow();
    expect(syncedState.status).toBe('synced');
    expect(syncedState.pendingCount).toBe(0);
    expect(pushedBatches.some((b) => b.entityId === 'ev-metro-new')).toBe(true);

    const snap = await repo.getSnapshot();
    expect(snap.events.find((e: any) => e.id === 'ev-remote-win')?.title).toBe(
      'Bloque actualizado en nube'
    );
  });

  it('S6: Headless MCP Server External Assistant Session (Resources + Tools + Shared Persistence)', async () => {
    const mcpMod = await loadContractModule<any>('services/mcp');
    const repo = await getTestRepository();

    const server = mcpMod.createDayCraftMcpServer
      ? mcpMod.createDayCraftMcpServer(repo)
      : new mcpMod.DayCraftMcpServer(repo);

    // 1. Discover tools & resources
    const toolsList = await server.listTools();
    const resList = await server.listResources();
    expect((toolsList.tools || toolsList).map((t: any) => t.name)).toEqual(
      expect.arrayContaining([...LOCKED_MCP_TOOLS])
    );
    expect((resList.resources || resList).map((r: any) => r.uri)).toEqual(
      expect.arrayContaining([...LOCKED_MCP_RESOURCES])
    );

    // 2. Read initial briefing & resources
    const briefing = await server.callTool('get_daily_briefing', {});
    expect(briefing.isError).not.toBe(true);
    await server.readResource('daycraft://timeline/today');
    await server.readResource('daycraft://pending');
    await server.readResource('daycraft://ideas/groups');

    // 3. Mutate across timeline, pending, and ideas
    await server.callTool('create_event', {
      dayKey: '2026-11-17',
      title: 'Deep Focus vía MCP',
      startQ: 40,
      quarters: 4,
      type: 'task',
    });
    const addedPending = await server.callTool('add_pending', { title: 'Revisar MCP docs' });
    expect(addedPending.isError).not.toBe(true);

    await server.callTool('create_idea', {
      groupId: 'grp-app',
      title: 'Conector Claude Desktop',
      desc: 'Servidor stdio headless',
    });

    const search = await server.callTool('search_notes', { query: 'Claude' });
    expect(JSON.stringify(search)).toContain('Conector Claude Desktop');

    const snap = await repo.getSnapshot();
    expect(snap.events.some((e: any) => e.title === 'Deep Focus vía MCP')).toBe(true);
    expect(snap.pendingTasks.some((p: any) => p.title === 'Revisar MCP docs')).toBe(true);
  });

  it('S7: Cloud Gemini Success -> Outage -> 0ms Local Fallback Recovery without Data Loss', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    await dayCraftStore.getState().hydrateFromSQLite();
    dayCraftStore.getState().setGeminiConfig({ apiKey: 'AIza-live', useCloudAI: true });

    let failCloud = false;
    restoreFetch = mockGlobalFetch(async () => {
      if (failCloud) return new Response('Quota exceeded', { status: 429 });
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: 'dispatch_intake_actions',
                      args: {
                        aiReply: 'Agendado en Cloud.',
                        items: [
                          {
                            kind: 'event',
                            title: 'Sprint Cloud',
                            dayKey: dayCraftStore.getState().selectedDayKey,
                            startQ: 36,
                            quarters: 2,
                          },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    await dayCraftStore.getState().submitSmartIntake('Sprint Cloud a las 09:00');
    expect(dayCraftStore.getState().events.some((e: any) => e.title === 'Sprint Cloud')).toBe(true);

    // Sudden API outage
    failCloud = true;
    await dayCraftStore.getState().submitSmartIntake('Comprar adaptador HDMI hoy');
    expect(
      dayCraftStore.getState().pendingTasks.some((p: any) => p.title.includes('adaptador HDMI'))
    ).toBe(true);
  });

  it('S8: Kuro-Zen Theme Personalization & Empty-State Persistence Across Cold Restarts', async () => {
    const { dayCraftStore, themeStore } = await setupIsolatedStores();
    const themesMod = await loadContractModule<any>('constants/themes');
    await dayCraftStore.getState().hydrateFromSQLite();
    await themeStore.getState().hydrateTheme();

    // User chooses murasaki, checks contrast, then deletes all seed pending tasks
    themeStore.getState().setTheme('murasaki');
    const c = themesMod.THEMES.murasaki.colors;
    expect(contrastRatio(c.ink, c.canvas)).toBeGreaterThanOrEqual(7.0);

    for (const p of [...dayCraftStore.getState().pendingTasks]) {
      dayCraftStore.getState().removePendingTask(p.id);
    }

    // Cold restart simulation
    themeStore.setState({ themeName: 'granate' });
    dayCraftStore.setState({ isHydrated: false, pendingTasks: [] });

    await dayCraftStore.getState().hydrateFromSQLite();
    await themeStore.getState().hydrateTheme();

    expect(themeStore.getState().themeName).toBe('murasaki');
    expect(dayCraftStore.getState().pendingTasks).toHaveLength(0);
  });

  it('S9: Multi-Month Calendar Planning with Infinite Extension & Recurring Routines', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const storeMod = await loadContractModule<any>('store/useDayCraftStore');
    await dayCraftStore.getState().hydrateFromSQLite();

    dayCraftStore.getState().extendFutureDays(60);
    const days = dayCraftStore.getState().days;
    expect(days.length).toBeGreaterThanOrEqual(433);

    // Schedule weekly & monthly recurring blocks
    const firstOfFutureMonth = days.find((d: any) => !d.isPast && !d.isToday && d.isFirstOfMonth);
    expect(firstOfFutureMonth).toBeDefined();

    dayCraftStore.getState().addTimelineEvent({
      dayKey: days[0].key,
      title: 'Cierre mensual',
      startQ: 40,
      quarters: 4,
      type: 'task',
      recurrence: { frequency: 'monthly', dayNumOfMonth: '01' },
    });

    const matches = dayCraftStore
      .getState()
      .events.filter((e: any) => storeMod.doesEventApplyToDay(e, firstOfFutureMonth));
    expect(matches.some((m: any) => m.title === 'Cierre mensual')).toBe(true);

    dayCraftStore.getState().setSelectedDayKey(firstOfFutureMonth.key);
    dayCraftStore.getState().jumpToToday();
    const todayInfo = dayCraftStore
      .getState()
      .days.find((d: any) => d.key === dayCraftStore.getState().selectedDayKey);
    expect(todayInfo.isToday).toBe(true);
  });

  it('S10: Production UX & Design System Gate Audit across entire app/ and components/', async () => {
    const themesMod = await loadContractModule<any>('constants/themes');

    // 1. Zero hardcoded colors, zero sub-12px fonts, zero color emojis
    expect(findHardcodedColorsInUi()).toEqual([]);
    expect(findSub12pxFontsInUi()).toEqual([]);
    expect(findColorEmojisInUi()).toEqual([]);

    // 2. Dead legacy components removed
    expect(projectFileExists('components/ui/Badge.tsx')).toBe(false);
    expect(projectFileExists('components/ui/Button.tsx')).toBe(false);
    expect(projectFileExists('components/timeline/TimeSlot.tsx')).toBe(false);

    // 3. All 6 themes WCAG AA/AAA verified
    for (const name of LOCKED_THEME_ORDER) {
      const c = themesMod.THEMES[name].colors;
      expect(contrastRatio(c.ink, c.canvas)).toBeGreaterThanOrEqual(7.0);
      expect(contrastRatio(c.accentSoft, c.card)).toBeGreaterThanOrEqual(4.5);
    }

    // 4. App metadata & single-intake UX mandates
    const appJson = JSON.parse(readProjectFile('app.json'));
    expect(appJson.expo.splash.backgroundColor.toLowerCase()).toBe('#130f11');
    expect(readProjectFile('app/(tabs)/pending.tsx')).not.toMatch(/<TextInput\b/);
    expect(readProjectFile('app/(tabs)/_layout.tsx')).toMatch(/allowFontScaling=\{false\}/);
  });
});
