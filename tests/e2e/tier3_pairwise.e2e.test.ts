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

import { LOCKED_THEME_ORDER } from './helpers/contracts';
import { getTestRepository, loadContractModule, readProjectFile } from './helpers/contractLoader';
import { contrastRatio } from './helpers/runtimeEnv';
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
// TIER 3 — CROSS-FEATURE PAIRWISE COMBINATIONS (>= 18 tests)
// ============================================================================

describe('Tier 3 — Cross-Feature Pairwise Interactions', () => {
  it('T3-01: F01 Smart Intake + F03 Local Parser -> Store events, chatMessages & Toast', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    await dayCraftStore.getState().submitSmartIntake('Revisar PRs hoy a las 14:30');

    const state = dayCraftStore.getState();
    expect(state.events.some((e: any) => e.startQ === 58 && e.title.includes('PRs'))).toBe(true);
    expect(state.chatMessages.slice(-1)[0].classifiedItems?.[0].type).toBe('event');
    expect(state.activeToast?.title).toContain('Agendado');
  });

  it('T3-02: F01 Smart Intake + F03 Cloud Gemini Function Calling -> multi-intent batch & Toast', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    dayCraftStore.getState().setGeminiConfig({ apiKey: 'AIza-cloud', useCloudAI: true });

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
                        aiReply: 'He separado tu reunión y tu pendiente.',
                        items: [
                          {
                            kind: 'event',
                            title: 'Sync de producto',
                            dayKey: dayCraftStore.getState().selectedDayKey,
                            startQ: 44,
                            quarters: 2,
                          },
                          {
                            kind: 'pending',
                            title: 'Enviar minutas',
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

    await dayCraftStore.getState().submitSmartIntake('Sync de producto a las 11:00 y enviar minutas');

    const state = dayCraftStore.getState();
    expect(state.events.some((e: any) => e.title === 'Sync de producto')).toBe(true);
    expect(state.pendingTasks.some((p: any) => p.title === 'Enviar minutas')).toBe(true);
    expect(state.activeToast).not.toBeNull();
  });

  it('T3-03: F02 Voice Dictation -> F01 Smart Intake -> F10 Pending -> F07 Slot Picker', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    await dayCraftStore.getState().submitSmartIntake('Comprar tinta de impresora');

    const toast = dayCraftStore.getState().activeToast;
    expect(toast?.primaryActionLabel).toBe('Fijar hora');
    toast?.onPrimaryAction?.();

    expect(dayCraftStore.getState().slotPickerTarget?.type).toBe('pending');
    dayCraftStore.getState().assignSlotFromPicker(64, 2); // 16:00

    expect(
      dayCraftStore.getState().events.some((e: any) => e.title.includes('tinta') && e.startQ === 64)
    ).toBe(true);
    expect(
      dayCraftStore.getState().pendingTasks.some((p: any) => p.title.includes('tinta'))
    ).toBe(false);
  });

  it('T3-04: F04 AI Settings (Cloud->Local toggle) + F03 Parser bypasses fetch immediately', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    let fetchCount = 0;
    restoreFetch = mockGlobalFetch(async () => {
      fetchCount++;
      return new Response('{}', { status: 200 });
    });

    dayCraftStore.getState().setGeminiConfig({ apiKey: 'AIza-key', useCloudAI: true });
    dayCraftStore.getState().setGeminiConfig({ useCloudAI: false });
    await dayCraftStore.getState().submitSmartIntake('Pagar factura luz');

    expect(fetchCount).toBe(0);
    expect(dayCraftStore.getState().pendingTasks[0].title).toContain('Pagar factura luz');
  });

  it('T3-05: F13 Custom Project Folder + F01 Smart Intake auto-classifies into user group', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const customGrp = dayCraftStore.getState().addIdeaGroup({
      title: 'Proyecto: Podcast Tech',
      subtitle: 'Guiones e invitados',
      icon: 'lightbulb',
      accentColor: 'amber',
    });

    await dayCraftStore
      .getState()
      .submitSmartIntake('Idea: Entrevistar a autora de Rust para Podcast Tech');

    const updatedGrp = dayCraftStore
      .getState()
      .ideaGroups.find((g: any) => g.id === customGrp.id);
    expect(updatedGrp.items.some((i: any) => i.title.includes('Rust'))).toBe(true);
  });

  it('T3-06: F10 Pending + F07 Slot Picker Undo restores pending task AND removes scheduled block', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const task = dayCraftStore.getState().addPendingTask('Limpiar escritorio');

    dayCraftStore.getState().openSlotPicker({ type: 'pending', id: task.id, title: task.title });
    dayCraftStore.getState().assignSlotFromPicker(76, 2); // 19:00

    expect(dayCraftStore.getState().pendingTasks.some((t: any) => t.id === task.id)).toBe(false);
    expect(dayCraftStore.getState().events.some((e: any) => e.title === 'Limpiar escritorio')).toBe(true);

    dayCraftStore.getState().activeToast?.onUndoAction?.();
    expect(dayCraftStore.getState().pendingTasks.some((t: any) => t.id === task.id)).toBe(true);
    expect(dayCraftStore.getState().events.some((e: any) => e.title === 'Limpiar escritorio')).toBe(false);
  });

  it('T3-07: F11 3-Day Rollover + F12 Bell Alert -> convertStalePendingToIdea rescues to grp-sparks', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    dayCraftStore.setState({
      pendingTasks: [
        {
          id: 'p-stale-3',
          title: 'Organizar fotos',
          completed: false,
          isFromYesterday: true,
          rolloverDays: 2,
          createdAt: 'Hace 2d',
        },
      ],
    });

    dayCraftStore.getState().triggerRolloverSimulation();

    const alert = dayCraftStore.getState().alerts.find((a: any) => a.relatedId === 'p-stale-3');
    expect(alert).toBeDefined();
    expect(alert.badgeText).toMatch(/3/);

    dayCraftStore.getState().convertStalePendingToIdea('p-stale-3');
    expect(dayCraftStore.getState().pendingTasks).toHaveLength(0);
    expect(dayCraftStore.getState().alerts.some((a: any) => a.relatedId === 'p-stale-3')).toBe(false);
    const sparks = dayCraftStore.getState().ideaGroups.find((g: any) => g.id === 'grp-sparks');
    expect(sparks.items.some((i: any) => i.title === 'Organizar fotos')).toBe(true);
  });

  it('T3-08: F11 Stale Idea (10d+) + F12 Bell Alert + F07 Slot Picker schedules rescue block', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const staleAlert = dayCraftStore
      .getState()
      .alerts.find((a: any) => a.type === 'inactive_idea');
    expect(staleAlert).toBeDefined();

    const cleanTitle = staleAlert.title.replace(/"/g, '');
    dayCraftStore.getState().openSlotPicker({ type: 'idea', title: cleanTitle });
    dayCraftStore.getState().dismissAlert(staleAlert.id);
    dayCraftStore.getState().assignSlotFromPicker(64, 2);

    expect(dayCraftStore.getState().alerts.some((a: any) => a.id === staleAlert.id)).toBe(false);
    expect(dayCraftStore.getState().events.some((e: any) => e.title === cleanTitle)).toBe(true);
  });

  it('T3-09: F13 Idea .md + F07 Slot Picker creates TimelineEvent tagged "Idea en acción"', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const idea = dayCraftStore.getState().ideaGroups[0].items[0];

    dayCraftStore.getState().openSlotPicker({
      type: 'idea',
      id: idea.id,
      title: idea.suggestedAction || idea.title,
    });
    dayCraftStore.getState().assignSlotFromPicker(40, 4);

    const created = dayCraftStore
      .getState()
      .events.find((e: any) => e.tag === 'Idea en acción');
    expect(created).toBeDefined();
    expect(created.quarters).toBe(4);
  });

  it('T3-10: F13 Idea .md delete + F15 Floating Toast Undo restores idea to original project group', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const srcGroup = dayCraftStore.getState().ideaGroups[1];
    const targetIdea = srcGroup.items[0];

    dayCraftStore.getState().removeIdea(targetIdea.id);
    expect(
      dayCraftStore.getState().ideaGroups[1].items.some((i: any) => i.id === targetIdea.id)
    ).toBe(false);

    dayCraftStore.getState().activeToast?.onUndoAction?.();
    expect(
      dayCraftStore.getState().ideaGroups[1].items.some((i: any) => i.id === targetIdea.id)
    ).toBe(true);
  });

  it('T3-11: F06 Direct-Hour Picker + F07 Weekly Recurrence + F08 DayStrip future day matching', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const storeMod = await loadContractModule<any>('store/useDayCraftStore');
    const themeMod = await loadContractModule<any>('constants/theme');

    dayCraftStore.getState().openSlotPicker({
      type: 'direct_hour',
      title: '',
      defaultStartQ: 36, // 09:00
      defaultQuarters: 4, // 1h
    });
    dayCraftStore
      .getState()
      .assignSlotFromPicker(36, 4, 'Revisión semanal', {
        frequency: 'weekly',
        daysOfWeek: ['VIE'],
      });

    const created = dayCraftStore.getState().events.find((e: any) => e.title === 'Revisión semanal');
    const futureFriday = dayCraftStore.getState().days.find((d: any) => d.dayName === 'VIE');
    const futureTuesday = dayCraftStore.getState().days.find((d: any) => d.dayName === 'MAR');

    expect(storeMod.doesEventApplyToDay(created, futureFriday)).toBe(true);
    expect(storeMod.doesEventApplyToDay(created, futureTuesday)).toBe(false);
    expect(themeMod.LAYOUT.quartersPerDay).toBe(96);
  });

  it('T3-12: F08 DayStrip navigation + F05 Rail24h NowMarker Today-only invariant', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const getActiveDay = () =>
      dayCraftStore
        .getState()
        .days.find((d: any) => d.key === dayCraftStore.getState().selectedDayKey);

    expect(getActiveDay()?.isToday).toBe(true);
    dayCraftStore.getState().shiftDay(1);
    expect(getActiveDay()?.isToday).toBe(false);
    dayCraftStore.getState().shiftDay(-2);
    expect(getActiveDay()?.isToday).toBe(false);
    dayCraftStore.getState().jumpToToday();
    expect(getActiveDay()?.isToday).toBe(true);
  });

  it('T3-13: F08 DayStrip + F09 Empty-Day classification differentiates Today, Future, and Past', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const getActiveDay = () =>
      dayCraftStore
        .getState()
        .days.find((d: any) => d.key === dayCraftStore.getState().selectedDayKey);

    expect(getActiveDay()?.isToday).toBe(true);
    dayCraftStore.getState().shiftDay(5);
    expect({ isToday: getActiveDay()?.isToday, isPast: getActiveDay()?.isPast }).toEqual({
      isToday: false,
      isPast: false,
    });
    dayCraftStore.getState().jumpToToday();
    dayCraftStore.getState().shiftDay(-2);
    expect({ isToday: getActiveDay()?.isToday, isPast: getActiveDay()?.isPast }).toEqual({
      isToday: false,
      isPast: true,
    });
  });

  it('T3-14: F16 Theme Store + F18 Storage Persistence survives full app hydration', async () => {
    const { dayCraftStore, themeStore } = await setupIsolatedStores();
    themeStore.getState().setTheme('aizome');
    expect(themeStore.getState().themeName).toBe('aizome');

    themeStore.setState({ themeName: 'granate' });
    await dayCraftStore.getState().hydrateFromSQLite().then(() => themeStore.getState().hydrateTheme());

    expect(themeStore.getState().themeName).toBe('aizome');
  });

  it('T3-15: F16 Kuro-Zen Themes + F17 Tailwind Tokens keep valid CSS vars & WCAG AA across all 6', async () => {
    const themesMod = await loadContractModule<any>('constants/themes');
    const twConfig = readProjectFile('tailwind.config.js');

    for (const name of LOCKED_THEME_ORDER) {
      const def = themesMod.THEMES[name];
      const cssVars = themesMod.themeCssVars(def);
      for (const varKey of Object.keys(cssVars)) {
        const tokenName = varKey.replace(/^--c-/, '');
        expect(twConfig).toContain(`"${tokenName}"`);
      }
      expect(contrastRatio(def.colors.ink, def.colors.canvas)).toBeGreaterThanOrEqual(7.0);
    }
  });

  it('T3-16: F01/F07 Store Mutations + F18 Sync Outbox queue entries on CRUD', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    await dayCraftStore.getState().hydrateFromSQLite();

    await dayCraftStore.getState().submitSmartIntake('Tarea con outbox hoy a las 13:00');
    const syncMod = await loadContractModule<any>('services/sync/syncEngine');
    expect(syncMod).toBeDefined();

    const state = dayCraftStore.getState();
    expect(state.syncState).toBeDefined();
    expect(typeof state.triggerSync).toBe('function');
    expect(state.syncState.pendingCount).toBeGreaterThanOrEqual(1);
  });

  it('T3-17: F18 MCP Server create_event + Store Repository hydration share unified data', async () => {
    const mcpMod = await loadContractModule<any>('services/mcp');
    const repo = await getTestRepository();

    const server = mcpMod.createDayCraftMcpServer
      ? mcpMod.createDayCraftMcpServer(repo)
      : new mcpMod.DayCraftMcpServer(repo);

    await server.callTool('create_event', {
      dayKey: '2026-11-17',
      title: 'Bloque creado desde Claude MCP',
      startQ: 44,
      quarters: 2,
      type: 'task',
    });

    const snap = await repo.getSnapshot();
    expect(snap.events.some((e: any) => e.title === 'Bloque creado desde Claude MCP')).toBe(true);
  });

  it('T3-18: F18 MCP smart_intake + F03 Parser + F13 search_notes work end-to-end', async () => {
    const mcpMod = await loadContractModule<any>('services/mcp');
    const repo = await getTestRepository();

    const server = mcpMod.createDayCraftMcpServer
      ? mcpMod.createDayCraftMcpServer(repo)
      : new mcpMod.DayCraftMcpServer(repo);

    await server.callTool('smart_intake', {
      text: 'Idea: Motor de búsqueda semántica local en SQLite',
    });

    const found = await server.callTool('search_notes', { query: 'semántica' });
    expect(JSON.stringify(found)).toContain('semántica');
  });

  it('T3-19: F01 Smart Intake question + F14 Desktop Cockpit switches desktopSideTab to "ai"', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    expect(dayCraftStore.getState().desktopSideTab).toBe('agenda');

    await dayCraftStore.getState().submitSmartIntake('¿Cuál es mi resumen de hoy?');
    expect(dayCraftStore.getState().desktopSideTab).toBe('ai');
  });

  it('T3-20: F18 Legacy v9 KV Migration + F08 normalizeLegacyEvents + F11 Daily Rollover', async () => {
    const { storage, dayCraftStore } = await setupIsolatedStores();
    const themeMod = await loadContractModule<any>('constants/theme');
    const yesterday = themeMod.getDateKeyWithOffset(-1);

    storage.setItem(
      'daycraft_events_v9',
      JSON.stringify([
        { id: 'leg-1', dayKey: '27', title: 'Legacy Block', startQ: 40, quarters: 2, type: 'task' },
      ])
    );
    storage.setItem(
      'daycraft_pending_v9',
      JSON.stringify([
        { id: 'leg-p1', title: 'Legacy Pending', completed: false, isFromYesterday: false, rolloverDays: 0, createdAt: 'Ayer' },
      ])
    );
    storage.setItem('daycraft_last_opened_date_v9', JSON.stringify(yesterday));

    await dayCraftStore.getState().hydrateFromSQLite();

    const state = dayCraftStore.getState();
    expect(state.events.find((e: any) => e.id === 'leg-1')?.dayKey).toBe(themeMod.getTodayKey());
    const legPending = state.pendingTasks.find((p: any) => p.id === 'leg-p1');
    expect(legPending?.isFromYesterday).toBe(true);
    expect(legPending?.rolloverDays).toBeGreaterThanOrEqual(1);
  });
});
