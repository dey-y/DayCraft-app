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
  LOCKED_LAYOUT_CONTRACT,
  LOCKED_MCP_RESOURCES,
  LOCKED_MCP_TOOLS,
  LOCKED_SEMANTIC_TOKENS,
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
  listSourceFiles,
  toRelativePath,
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
// TIER 1 — FEATURE COVERAGE (>= 5 tests per feature across all 18 features)
// ============================================================================

describe('Tier 1 — F01: Universal Smart Intake Bar', () => {
  it('T1-F01-01: routes a timed utterance through Smart Intake into events, chat, and toast', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const initialEventsCount = dayCraftStore.getState().events.length;

    await dayCraftStore.getState().submitSmartIntake('Reunión de arquitectura hoy a las 15:00');

    const state = dayCraftStore.getState();
    expect(state.events.length).toBe(initialEventsCount + 1);
    const created = state.events.find((e: any) =>
      e.title.toLowerCase().includes('arquitectura')
    );
    expect(created).toBeDefined();
    expect(created.startQ).toBe(60); // 15 * 4
    expect(state.chatMessages.slice(-2).map((m: any) => m.role)).toEqual(['user', 'assistant']);
    expect(state.activeToast).not.toBeNull();
  });

  it('T1-F01-02: routes an unscheduled utterance into pendingTasks with [Fijar hora] toast', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const before = dayCraftStore.getState().pendingTasks.length;

    await dayCraftStore.getState().submitSmartIntake('Comprar adaptador USB-C cuando pueda');

    const state = dayCraftStore.getState();
    expect(state.pendingTasks.length).toBe(before + 1);
    expect(state.pendingTasks[0].title).toContain('Comprar adaptador USB-C');
    expect(state.activeToast?.primaryActionLabel).toBe('Fijar hora');
  });

  it('T1-F01-03: routes an idea utterance into ideaGroups and includes itemId in Fijar hora action', async () => {
    const { dayCraftStore } = await setupIsolatedStores();

    await dayCraftStore.getState().submitSmartIntake('Idea: Widget minimalista de captura rápida');

    const state = dayCraftStore.getState();
    const allIdeas = state.ideaGroups.flatMap((g: any) => g.items);
    const created = allIdeas.find((i: any) =>
      i.title.toLowerCase().includes('widget minimalista')
    );
    expect(created).toBeDefined();
    expect(state.activeToast?.primaryActionLabel).toBe('Fijar hora');

    // Triggering primary action must open slot picker linked to the captured idea
    state.activeToast?.onPrimaryAction?.();
    const picker = dayCraftStore.getState().slotPickerTarget;
    expect(picker?.type).toBe('idea');
    expect(picker?.id).toBe(created.id);
  });

  it('T1-F01-04: suppresses redundant floating toast when submitted from Chat screen', async () => {
    const { dayCraftStore } = await setupIsolatedStores();

    await dayCraftStore
      .getState()
      .submitSmartIntake('Revisar facturas de noviembre', { isOnChatScreen: true });

    const state = dayCraftStore.getState();
    expect(state.activeToast).toBeNull();
    expect(state.pendingTasks[0].title).toContain('Revisar facturas');
  });

  it('T1-F01-05: enforces Single Universal Smart Intake (no duplicate TextInput in pending.tsx or ideas.tsx)', () => {
    const pendingSrc = readProjectFile('app/(tabs)/pending.tsx');
    const ideasSrc = readProjectFile('app/(tabs)/ideas.tsx');
    const smartIntakeSrc = readProjectFile('components/intake/SmartIntakeBar.tsx');

    expect(pendingSrc).not.toMatch(/<TextInput\b/);
    expect(ideasSrc).not.toMatch(/newIdeaInput|quickAddInput|addPendingInput/i);
    expect(smartIntakeSrc).toMatch(/<TextInput\b/);
  });
});

describe('Tier 1 — F02: Real Voice Dictation', () => {
  it('T1-F02-01: SmartIntakeBar configures Web Speech API with es-ES and interimResults=true', () => {
    const src = readProjectFile('components/intake/SmartIntakeBar.tsx');
    expect(src).toMatch(/SpeechRecognition/);
    expect(src).toMatch(/webkitSpeechRecognition/);
    expect(src).toMatch(/lang\s*=\s*['"]es-ES['"]/);
    expect(src).toMatch(/interimResults\s*=\s*true/);
  });

  it('T1-F02-02: simulated SpeechRecognition session streams transcript into submitSmartIntake', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const g = globalThis as Record<string, any>;

    let createdInstance: any = null;
    g.window.SpeechRecognition = class {
      lang = '';
      interimResults = false;
      continuous = false;
      maxAlternatives = 1;
      onstart: (() => void) | null = null;
      onresult: ((ev: any) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((ev: any) => void) | null = null;
      constructor() {
        createdInstance = this;
      }
      start() {
        this.onstart?.();
      }
      stop() {
        this.onend?.();
      }
      abort() {}
    };

    const rec = new g.window.SpeechRecognition();
    rec.lang = 'es-ES';
    rec.interimResults = true;
    rec.onresult = async (ev: any) => {
      const txt = ev.results[0][0].transcript;
      if (ev.results[0].isFinal) {
        await dayCraftStore.getState().submitSmartIntake(txt);
      }
    };
    rec.start();
    await rec.onresult({
      results: [{ isFinal: true, 0: { transcript: 'Llamar al médico mañana a las 10:00' } }],
    });

    expect(createdInstance.lang).toBe('es-ES');
    expect(createdInstance.interimResults).toBe(true);
    const created = dayCraftStore
      .getState()
      .events.find((e: any) => e.title.toLowerCase().includes('médico'));
    expect(created).toBeDefined();
    expect(created.startQ).toBe(40);
  });

  it('T1-F02-03: SmartIntakeBar enforces single-submission guard on voice end', () => {
    const src = readProjectFile('components/intake/SmartIntakeBar.tsx');
    expect(src).toMatch(/hasSubmittedVoiceRef/);
    expect(src).toMatch(/recognition\.onend/);
  });

  it('T1-F02-04: unsupported SpeechRecognition triggers non-crashing fallback feedback', () => {
    const src = readProjectFile('components/intake/SmartIntakeBar.tsx');
    expect(src).toMatch(/if\s*\(\s*!SpeechRecognitionCtor\s*\)/);
    expect(src).toMatch(/runIntelligentFallback/);
  });

  it('T1-F02-05: microphone permission denial (not-allowed) degrades gracefully via fallback', () => {
    const src = readProjectFile('components/intake/SmartIntakeBar.tsx');
    expect(src).toMatch(/not-allowed/);
    expect(src).toMatch(/service-not-allowed/);
    expect(src).toMatch(/recognition\.onerror/);
  });
});

describe('Tier 1 — F03: Dual Gemini + Local NLP Parser', () => {
  it('T1-F03-01: local 0ms parser classifies pending, event, reminder, idea, and question accurately', async () => {
    const ai = await loadContractModule<any>('services/ai/geminiClient');

    const p = ai.parseIntakeLocally('Comprar café molido', '2026-11-17');
    const e = ai.parseIntakeLocally('Estudiar TypeScript hoy a las 16:00', '2026-11-17');
    const r = ai.parseIntakeLocally('Recuérdame llamar a Marta a las 11:30', '2026-11-17');
    const i = ai.parseIntakeLocally('Idea: Crear modo lectura zen para notas', '2026-11-17');
    const q = ai.parseIntakeLocally('¿Qué tengo para hoy?', '2026-11-17');

    expect(p.kind).toBe('pending');
    expect(e.kind).toBe('event');
    expect(e.startQ).toBe(64);
    expect(r.kind).toBe('reminder');
    expect(r.startQ).toBe(46);
    expect(i.kind).toBe('idea');
    expect(q.kind).toBe('question');
  });

  it('T1-F03-02: resolveDynamicDayFromText resolves hoy, mañana, pasado mañana, and weekdays to ISO keys', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 17, 12, 0, 0)); // Tuesday 2026-11-17

    const ai = await loadContractModule<any>('services/ai/geminiClient');
    expect(ai.resolveDynamicDayFromText('Reunión hoy', '2026-11-17').key).toBe('2026-11-17');
    expect(ai.resolveDynamicDayFromText('Reunión mañana', '2026-11-17').key).toBe('2026-11-18');
    expect(ai.resolveDynamicDayFromText('Cita pasado mañana', '2026-11-17').key).toBe('2026-11-19');
    expect(ai.resolveDynamicDayFromText('Entrega el viernes', '2026-11-17').key).toBe('2026-11-20');
  });

  it('T1-F03-03: matchIdeaGroup routes ideas to newly created custom project folders', async () => {
    const ai = await loadContractModule<any>('services/ai/geminiClient');
    const customGroups = [
      {
        id: 'grp-finanzas',
        title: 'Proyecto: Finanzas Personales',
        subtitle: 'Ahorro e inversión',
        icon: 'folder',
        accentColor: 'emerald',
        items: [],
      },
    ];

    const parsed = ai.parseIntakeLocally(
      'Idea: Revisar ETFs para Finanzas Personales',
      '2026-11-17',
      customGroups
    );
    expect(parsed.kind).toBe('idea');
    expect(parsed.ideaGroupId).toBe('grp-finanzas');
  });

  it('T1-F03-04: Cloud Gemini mode uses Function Calling / structured JSON and returns source="gemini"', async () => {
    const ai = await loadContractModule<any>('services/ai/geminiClient');
    let capturedBody: any = null;

    restoreFetch = mockGlobalFetch(async (_url, init) => {
      capturedBody = JSON.parse(String(init?.body || '{}'));
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
                        aiReply: 'Agendado con Gemini.',
                        items: [
                          {
                            kind: 'event',
                            title: 'Deep Work Arquitectura',
                            dayKey: '2026-11-17',
                            startQ: 36,
                            quarters: 4,
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

    const result = await ai.processSmartIntake('Deep work a las 09:00 1h', '2026-11-17', {
      apiKey: 'AIzaTestKey123',
      useCloudAI: true,
    });

    expect(capturedBody).not.toBeNull();
    // M2 specifies Gemini Function Calling (`tools` / `functionDeclarations`)
    expect(JSON.stringify(capturedBody)).toMatch(/functionDeclarations|tools/i);
    if ('items' in result) {
      expect(result.source).toBe('gemini');
      expect(result.items[0].title).toBe('Deep Work Arquitectura');
    } else {
      expect(result.title).toBe('Deep Work Arquitectura');
    }
  });

  it('T1-F03-05: supports multi-intent extraction splitting one utterance into multiple items', async () => {
    const ai = await loadContractModule<any>('services/ai/geminiClient');
    const batchFn = ai.processSmartIntakeBatch || ai.parseIntakeBatchLocally || ai.processSmartIntake;
    expect(typeof batchFn).toBe('function');

    const res = await batchFn(
      'Recuérdame mañana a las 17:00 llamar al dentista, y hoy tengo que comprar pilas',
      '2026-11-17',
      { useCloudAI: false }
    );

    const items = Array.isArray(res?.items) ? res.items : [res];
    expect(items.length).toBeGreaterThanOrEqual(2);
    const kinds = items.map((x: any) => x.kind);
    expect(kinds).toContain('reminder');
    expect(kinds).toContain('pending');
  });
});

describe('Tier 1 — F04: AI Settings Modal', () => {
  it('T1-F04-01: setGeminiConfig updates store and persists gemini_config_v9', async () => {
    const { storage, dayCraftStore } = await setupIsolatedStores();

    dayCraftStore.getState().setGeminiConfig({ apiKey: 'AIza-secret-99', useCloudAI: true });

    expect(dayCraftStore.getState().geminiApiKey).toBe('AIza-secret-99');
    expect(dayCraftStore.getState().useCloudAI).toBe(true);
    const raw = storage.getItem('daycraft_gemini_config_v9');
    expect(raw).toContain('AIza-secret-99');
  });

  it('T1-F04-02: hydrateFromSQLite restores saved gemini_config_v9 across restart', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    dayCraftStore.getState().setGeminiConfig({ apiKey: 'AIza-persisted', useCloudAI: true });

    dayCraftStore.setState({ geminiApiKey: '', useCloudAI: false, isHydrated: false });
    await dayCraftStore.getState().hydrateFromSQLite();

    expect(dayCraftStore.getState().geminiApiKey).toBe('AIza-persisted');
    expect(dayCraftStore.getState().useCloudAI).toBe(true);
  });

  it('T1-F04-03: setting useCloudAI=false bypasses Gemini fetch even when apiKey is present', async () => {
    const ai = await loadContractModule<any>('services/ai/geminiClient');
    let fetchCalled = false;
    restoreFetch = mockGlobalFetch(async () => {
      fetchCalled = true;
      return new Response('{}', { status: 200 });
    });

    const res = await ai.processSmartIntake('Comprar cuaderno', '2026-11-17', {
      apiKey: 'AIza-present-key',
      useCloudAI: false,
    });

    expect(fetchCalled).toBe(false);
    const kind = 'items' in res ? res.items[0].kind : res.kind;
    expect(kind).toBe('pending');
  });

  it('T1-F04-04: clearing apiKey reverts engine safely to local NLP mode', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    dayCraftStore.getState().setGeminiConfig({ apiKey: 'AIza-temp', useCloudAI: true });
    dayCraftStore.getState().setGeminiConfig({ apiKey: '', useCloudAI: false });

    expect(dayCraftStore.getState().geminiApiKey).toBe('');
    expect(dayCraftStore.getState().useCloudAI).toBe(false);
  });

  it('T1-F04-05: chat.tsx renders secure API key input and Cloud vs Local NLP toggle', () => {
    const chatSrc = readProjectFile('app/(tabs)/chat.tsx');
    expect(chatSrc).toMatch(/secureTextEntry/);
    expect(chatSrc).toMatch(/setGeminiConfig/);
    expect(chatSrc).toMatch(/Gemini 2\.0 Flash/);
    expect(chatSrc).toMatch(/NLP Local/);
  });
});

describe('Tier 1 — F05: 24h Vertical Timeline Rail (Rail24h)', () => {
  it('T1-F05-01: LAYOUT contract defines 24h timeline geometry and 96 quarters/day', async () => {
    const themeConst = await loadContractModule<any>('constants/theme');
    expect(themeConst.LAYOUT.quartersPerDay).toBe(LOCKED_LAYOUT_CONTRACT.quartersPerDay);
    expect(themeConst.LAYOUT.quarterMinutes).toBe(LOCKED_LAYOUT_CONTRACT.quarterMinutes);
    expect(themeConst.LAYOUT.hourHeightMobile).toBe(LOCKED_LAYOUT_CONTRACT.hourHeightMobile);
    expect(themeConst.LAYOUT.hourHeightDesktop).toBe(LOCKED_LAYOUT_CONTRACT.hourHeightDesktop);
    expect(themeConst.LAYOUT.railPaddingHorizontal).toBe(LOCKED_LAYOUT_CONTRACT.railPaddingHorizontal);
  });

  it('T1-F05-02: Rail24h renders NowMarker exclusively when activeDay?.isToday is true', () => {
    const railSrc = readProjectFile('components/timeline/Rail24h.tsx');
    expect(railSrc).toMatch(/activeDay\?\.isToday\s*\?/);
    expect(railSrc).toMatch(/bg-now/);
  });

  it('T1-F05-03: Rail24h keeps empty hours clean at rest without permanent :30 dashed clutter', () => {
    const railSrc = readProjectFile('components/timeline/Rail24h.tsx');
    expect(railSrc).not.toMatch(/border-dashed/);
    expect(railSrc).toMatch(/Array\.from\(\{\s*length:\s*24\s*\}/);
  });

  it('T1-F05-04: Rail24h supports collapsible 00:00–06:00 early-morning quiet band ("Ma")', () => {
    const railSrc = readProjectFile('components/timeline/Rail24h.tsx');
    expect(railSrc).toMatch(/00:00[\s\S]*06:00|earlyMorning|earlyHours|quietBand|madrugada|collapse/i);
  });

  it('T1-F05-05: doesEventApplyToDay matches exact day, daily, weekly, and monthly recurrences', async () => {
    const storeMod = await loadContractModule<any>('store/useDayCraftStore');
    const themeMod = await loadContractModule<any>('constants/theme');

    const mon = themeMod.createDayInfoFromDate(new Date(2026, 10, 16, 12)); // LUN 16
    const tue = themeMod.createDayInfoFromDate(new Date(2026, 10, 17, 12)); // MAR 17
    const firstDec = themeMod.createDayInfoFromDate(new Date(2026, 11, 1, 12)); // 01 DIC

    expect(
      storeMod.doesEventApplyToDay(
        { id: '1', dayKey: '2026-11-16', title: 'Daily', startQ: 36, quarters: 2, type: 'task', recurrence: { frequency: 'daily' } },
        tue
      )
    ).toBe(true);

    expect(
      storeMod.doesEventApplyToDay(
        { id: '2', dayKey: '2026-11-01', title: 'Weekly', startQ: 36, quarters: 2, type: 'task', recurrence: { frequency: 'weekly', daysOfWeek: ['LUN', 'MIÉ'] } },
        mon
      )
    ).toBe(true);

    expect(
      storeMod.doesEventApplyToDay(
        { id: '3', dayKey: '2026-10-01', title: 'Monthly', startQ: 36, quarters: 2, type: 'task', recurrence: { frequency: 'monthly', dayNumOfMonth: '01' } },
        firstDec
      )
    ).toBe(true);
  });
});

describe('Tier 1 — F06: Interactive 15m Tap & Drag Time-Blocking', () => {
  it('T1-F06-01: Rail24h uses Gesture Handler, Reanimated, and Haptics for cross-platform 15m drag', () => {
    const railSrc = readProjectFile('components/timeline/Rail24h.tsx');
    expect(railSrc).toMatch(/react-native-gesture-handler/);
    expect(railSrc).toMatch(/react-native-reanimated/);
    expect(railSrc).toMatch(/expo-haptics/);
  });

  it('T1-F06-02: tapping an empty quarter opens slotPickerTarget with direct_hour and 30m default', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    dayCraftStore.getState().openSlotPicker({
      type: 'direct_hour',
      title: '',
      defaultStartQ: 56, // 14:00
      defaultQuarters: 2,
    });

    const target = dayCraftStore.getState().slotPickerTarget;
    expect(target?.type).toBe('direct_hour');
    expect(target?.defaultStartQ).toBe(56);
    expect(target?.defaultQuarters).toBe(2);
  });

  it('T1-F06-03: drag-stretch duration math computes exact 15m quarter ranges and formatting', async () => {
    const storeMod = await loadContractModule<any>('store/useDayCraftStore');
    const startQ = 46; // 11:30
    const endQ = 50; // 12:45 inclusive -> 5 quarters (1h 15m)
    const quarters = endQ - startQ + 1;

    expect(storeMod.formatQuarterToTime(startQ)).toBe('11:30');
    expect(storeMod.formatQuarterToTime(startQ + quarters)).toBe('12:45');
    expect(storeMod.formatQuartersToDuration(quarters)).toBe('1h 15m');
  });

  it('T1-F06-04: Rail24h calculates overlap layout columns for concurrent blocks', () => {
    const railSrc = readProjectFile('components/timeline/Rail24h.tsx');
    expect(railSrc).toMatch(/overlap|column|colIndex|totalCols/i);
  });

  it('T1-F06-05: Rail24h disables ScrollView vertical scrolling while dragging is active', () => {
    const railSrc = readProjectFile('components/timeline/Rail24h.tsx');
    expect(railSrc).toMatch(/scrollEnabled=\{\s*!isDragging\s*\}/);
  });
});

describe('Tier 1 — F07: Full Block Editing & Deletion', () => {
  it('T1-F07-01: editing an existing event updates title, desc, type, startQ, quarters, and recurrence', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const ev = dayCraftStore.getState().events[0];

    dayCraftStore.getState().openSlotPicker({
      type: 'edit_event',
      id: ev.id,
      title: ev.title,
      desc: ev.desc,
      eventType: ev.type,
      defaultStartQ: ev.startQ,
      defaultQuarters: ev.quarters,
    });

    dayCraftStore.getState().assignSlotFromPicker(
      40,
      4,
      'Informe trimestral',
      { frequency: 'weekly', daysOfWeek: ['LUN'] },
      { desc: 'Con métricas Q4', eventType: 'reminder' }
    );

    const updated = dayCraftStore.getState().events.find((e: any) => e.id === ev.id);
    expect(updated.title).toBe('Informe trimestral');
    expect(updated.desc).toBe('Con métricas Q4');
    expect(updated.type).toBe('reminder');
    expect(updated.startQ).toBe(40);
    expect(updated.quarters).toBe(4);
    expect(updated.recurrence).toEqual({ frequency: 'weekly', daysOfWeek: ['LUN'] });
  });

  it('T1-F07-02: toggleTimelineEventCompleted toggles completion and emits Undo toast', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const ev = dayCraftStore.getState().events[0];

    dayCraftStore.getState().toggleTimelineEventCompleted(ev.id);
    expect(dayCraftStore.getState().events.find((e: any) => e.id === ev.id)?.completed).toBe(true);
    expect(dayCraftStore.getState().activeToast?.undoActionLabel).toBe('Deshacer');

    dayCraftStore.getState().activeToast?.onUndoAction?.();
    expect(dayCraftStore.getState().events.find((e: any) => e.id === ev.id)?.completed).toBe(false);
  });

  it('T1-F07-03: removeTimelineEvent removes block and Undo restores it sorted by startQ', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const target = dayCraftStore.getState().events[0];

    dayCraftStore.getState().removeTimelineEvent(target.id, true);
    expect(dayCraftStore.getState().events.some((e: any) => e.id === target.id)).toBe(false);

    dayCraftStore.getState().activeToast?.onUndoAction?.();
    expect(dayCraftStore.getState().events.some((e: any) => e.id === target.id)).toBe(true);
  });

  it('T1-F07-04: EventCard enforces top-left alignment and uses Reanimated v4', () => {
    const cardSrc = readProjectFile('components/timeline/EventCard.tsx');
    expect(cardSrc).toMatch(/alignItems:\s*['"]flex-start['"]/);
    expect(cardSrc).toMatch(/justifyContent:\s*['"]flex-start['"]/);
    expect(cardSrc).toMatch(/react-native-reanimated/);
  });

  it('T1-F07-05: slot-picker exposes durations 15m..3h and all 4 recurrence options', () => {
    const modalSrc = readProjectFile('app/modal/slot-picker.tsx');
    for (const label of ['15m', '30m', '45m', '1h', '1h 30m', '2h', '3h']) {
      expect(modalSrc).toContain(label);
    }
    for (const freq of ['none', 'daily', 'weekly', 'monthly']) {
      expect(modalSrc).toContain(`'${freq}'`);
    }
  });
});

describe('Tier 1 — F08: Dynamic ISO Day Strip & Infinite Scroll (DayStrip)', () => {
  it('T1-F08-01: generateDaysRange(-7, 365) produces 373 consecutive ISO YYYY-MM-DD days', async () => {
    const themeConst = await loadContractModule<any>('constants/theme');
    const range = themeConst.generateDaysRange(-7, 365);
    expect(range).toHaveLength(373);
    for (const d of range) {
      expect(d.key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(d.key).toBe(d.isoDate);
    }
    expect(range.filter((d: any) => d.isToday)).toHaveLength(1);
  });

  it('T1-F08-02: jumpToToday resets selectedDayKey to current ISO today key', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const themeConst = await loadContractModule<any>('constants/theme');

    dayCraftStore.getState().setSelectedDayKey(themeConst.getDateKeyWithOffset(10));
    expect(dayCraftStore.getState().selectedDayKey).not.toBe(themeConst.getTodayKey());

    dayCraftStore.getState().jumpToToday();
    expect(dayCraftStore.getState().selectedDayKey).toBe(themeConst.getTodayKey());
  });

  it('T1-F08-03: shiftDay advances and rewinds selectedDayKey accurately', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const themeConst = await loadContractModule<any>('constants/theme');

    dayCraftStore.getState().shiftDay(3);
    expect(dayCraftStore.getState().selectedDayKey).toBe(themeConst.getDateKeyWithOffset(3));
    dayCraftStore.getState().shiftDay(-2);
    expect(dayCraftStore.getState().selectedDayKey).toBe(themeConst.getDateKeyWithOffset(1));
  });

  it('T1-F08-04: extendFutureDays(60) appends 60 consecutive days without duplicates', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const initialLen = dayCraftStore.getState().days.length;

    dayCraftStore.getState().extendFutureDays(60);

    const updated = dayCraftStore.getState().days;
    expect(updated.length).toBe(initialLen + 60);
    const uniqueKeys = new Set(updated.map((d: any) => d.key));
    expect(uniqueKeys.size).toBe(updated.length);
  });

  it('T1-F08-05: DayStrip uses native HTMLElement.prototype.scrollTo and drag/wheel listeners on Web', () => {
    const stripSrc = readProjectFile('components/timeline/DayStrip.tsx');
    expect(stripSrc).toMatch(/HTMLElement\.prototype\.scrollTo/);
    expect(stripSrc).toMatch(/addEventListener\(\s*['"]wheel['"]/);
    expect(stripSrc).toMatch(/extendFutureDays\(\s*60\s*\)/);
  });
});

describe('Tier 1 — F09: Empathetic Empty-Day Messages', () => {
  it('T1-F09-01: createDayInfoFromDate distinguishes Today, Future, and Past flags cleanly', async () => {
    const themeConst = await loadContractModule<any>('constants/theme');
    const now = new Date(2026, 10, 17, 12, 0, 0);

    const today = themeConst.createDayInfoFromDate(new Date(2026, 10, 17, 12), now);
    const future = themeConst.createDayInfoFromDate(new Date(2026, 10, 18, 12), now);
    const past = themeConst.createDayInfoFromDate(new Date(2026, 10, 16, 12), now);

    expect({ isToday: today.isToday, isPast: today.isPast }).toEqual({ isToday: true, isPast: false });
    expect({ isToday: future.isToday, isPast: future.isPast }).toEqual({ isToday: false, isPast: false });
    expect({ isToday: past.isToday, isPast: past.isPast }).toEqual({ isToday: false, isPast: true });
  });

  it('T1-F09-02: Rail24h differentiates empty-day messages across Today, Future, and Past', () => {
    const railSrc = readProjectFile('components/timeline/Rail24h.tsx');
    expect(railSrc).toMatch(/activeDay\?\.isToday/);
    expect(railSrc).toMatch(/activeDay\?\.isPast/);
  });

  it('T1-F09-03: EmptyCelebration renders calm anti-stress completion copy', () => {
    const emptySrc = readProjectFile('components/pending/EmptyCelebration.tsx');
    expect(emptySrc).toMatch(/despejado|al día|sin estrés/i);
  });

  it('T1-F09-04: Timeline screen displays Día despejado badge when day has 0 blocks', () => {
    const indexSrc = readProjectFile('app/(tabs)/index.tsx');
    expect(indexSrc).toContain('Día despejado');
  });

  it('T1-F09-05: adding an event to an empty day flips dayEventsCount from 0 to >=1', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const themeConst = await loadContractModule<any>('constants/theme');
    const storeMod = await loadContractModule<any>('store/useDayCraftStore');
    const futureKey = themeConst.getDateKeyWithOffset(15);

    const dayInfo = dayCraftStore.getState().days.find((d: any) => d.key === futureKey);
    expect(
      dayCraftStore
        .getState()
        .events.filter((e: any) => storeMod.doesEventApplyToDay(e, dayInfo))
    ).toHaveLength(0);

    dayCraftStore.getState().addTimelineEvent({
      dayKey: futureKey,
      title: 'Plan mensual',
      startQ: 40,
      quarters: 2,
      type: 'task',
    });

    expect(
      dayCraftStore
        .getState()
        .events.filter((e: any) => storeMod.doesEventApplyToDay(e, dayInfo))
    ).toHaveLength(1);
  });
});

describe('Tier 1 — F10: Unscheduled Pending Tasks & Smart Slot Picker', () => {
  it('T1-F10-01: addPendingTask prepends unscheduled task with rolloverDays=0', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const task = dayCraftStore.getState().addPendingTask('Enviar contrato');

    expect(task.completed).toBe(false);
    expect(task.isFromYesterday).toBe(false);
    expect(task.rolloverDays).toBe(0);
    expect(dayCraftStore.getState().pendingTasks[0].id).toBe(task.id);
  });

  it('T1-F10-02: togglePendingTask marks task completed and produces Undo toast', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const task = dayCraftStore.getState().pendingTasks[0];

    dayCraftStore.getState().togglePendingTask(task.id);
    expect(
      dayCraftStore.getState().pendingTasks.find((t: any) => t.id === task.id)?.completed
    ).toBe(true);
    expect(dayCraftStore.getState().activeToast?.undoActionLabel).toBe('Deshacer');
  });

  it('T1-F10-03: assigning slot to a pending task moves it onto Timeline and Undo reverses both', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const pending = dayCraftStore.getState().pendingTasks[0];

    dayCraftStore.getState().openSlotPicker({
      type: 'pending',
      id: pending.id,
      title: pending.title,
    });
    dayCraftStore.getState().assignSlotFromPicker(64, 2); // 16:00

    expect(
      dayCraftStore.getState().pendingTasks.some((t: any) => t.id === pending.id)
    ).toBe(false);
    expect(
      dayCraftStore.getState().events.some((e: any) => e.title === pending.title && e.startQ === 64)
    ).toBe(true);

    dayCraftStore.getState().activeToast?.onUndoAction?.();
    expect(
      dayCraftStore.getState().pendingTasks.some((t: any) => t.id === pending.id)
    ).toBe(true);
    expect(
      dayCraftStore.getState().events.some((e: any) => e.title === pending.title && e.startQ === 64)
    ).toBe(false);
  });

  it('T1-F10-04: slot-picker dynamically suggests free slots avoiding occupied timeline blocks', () => {
    const modalSrc = readProjectFile('app/modal/slot-picker.tsx');
    // Must inspect day events to propose free slots dynamically instead of solely static presets
    expect(modalSrc).toMatch(/events/);
    expect(modalSrc).toMatch(/freeSlots|availableSlots|suggestFreeSlots|suggestedSlots|busyQuarters|isSlotFree|occupied/i);
  });

  it('T1-F10-05: PendingItem uses Reanimated and enforces >=44px ergonomic Fijar hora target', () => {
    const pendingItemSrc = readProjectFile('components/pending/PendingItem.tsx');
    expect(pendingItemSrc).toMatch(/react-native-reanimated/);
    expect(pendingItemSrc).toMatch(/min-h-\[44px\]|min-h-11|h-11|minHeight:\s*44|hitSlop=\{\s*1[0-9]|hitSlop=\{\s*\{/);
  });
});

describe('Tier 1 — F11: Anti-Stress Daily Rollover & 3-Day Rule', () => {
  it('T1-F11-01: evaluateDailyRollover promotes unfinished tasks with isFromYesterday=true and skips completed', async () => {
    const rollover = await loadContractModule<any>('services/rollover/rolloverEngine');
    const tasks = [
      { id: 'p1', title: 'Pendiente abierta', completed: false, isFromYesterday: false, rolloverDays: 0, createdAt: 'Ayer' },
      { id: 'p2', title: 'Ya hecha', completed: true, isFromYesterday: false, rolloverDays: 0, createdAt: 'Ayer' },
    ];

    const res = rollover.evaluateDailyRollover(tasks);
    const p1 = res.updatedTasks.find((t: any) => t.id === 'p1');
    const p2 = res.updatedTasks.find((t: any) => t.id === 'p2');

    expect(p1.isFromYesterday).toBe(true);
    expect(p1.rolloverDays).toBe(1);
    expect(p2.isFromYesterday).toBe(false);
    expect(res.generatedAlerts.some((a: any) => a.relatedId === 'p1')).toBe(true);
  });

  it('T1-F11-02: multi-day elapsed gap increments rolloverDays by actual days elapsed', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 17, 10, 0, 0));

    const { storage, dayCraftStore } = await setupIsolatedStores();
    storage.setItem('daycraft_last_opened_date_v9', JSON.stringify('2026-11-14')); // 3 days elapsed
    storage.setItem(
      'daycraft_pending_v9',
      JSON.stringify([
        { id: 'p-elapsed', title: 'Viaje pendiente', completed: false, isFromYesterday: false, rolloverDays: 0, createdAt: 'Hace 3d' },
      ])
    );

    await dayCraftStore.getState().hydrateFromSQLite();
    const rolled = dayCraftStore.getState().pendingTasks.find((t: any) => t.id === 'p-elapsed');
    expect(rolled.rolloverDays).toBeGreaterThanOrEqual(3);
  });

  it('T1-F11-03: reaching 3 rollover days triggers threeDayRuleTriggered and guilt-free rescue alert', async () => {
    const rollover = await loadContractModule<any>('services/rollover/rolloverEngine');
    const tasks = [
      { id: 'p3', title: 'Ordenar escritorio', completed: false, isFromYesterday: true, rolloverDays: 2, createdAt: 'Hace 2d' },
    ];

    const res = rollover.evaluateDailyRollover(tasks);
    expect(res.threeDayRuleTriggered).toHaveLength(1);
    expect(res.generatedAlerts[0].badgeText).toMatch(/3/);
  });

  it('T1-F11-04: convertStalePendingToIdea rescues task into Chispazos Libres and removes pending/alert', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const target = dayCraftStore.getState().pendingTasks[0];

    dayCraftStore.getState().convertStalePendingToIdea(target.id);

    const state = dayCraftStore.getState();
    expect(state.pendingTasks.some((t: any) => t.id === target.id)).toBe(false);
    expect(state.alerts.some((a: any) => a.relatedId === target.id)).toBe(false);
    const sparks = state.ideaGroups.find((g: any) => g.id === 'grp-sparks');
    expect(sparks.items.some((i: any) => i.title === target.title)).toBe(true);
  });

  it('T1-F11-05: 10-day stale ideas generate inactive_idea alerts without duplicating existing ones', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 17, 10, 0, 0));

    const { storage, dayCraftStore } = await setupIsolatedStores();
    storage.setItem('daycraft_last_opened_date_v9', JSON.stringify('2026-11-16'));
    storage.setItem('daycraft_alerts_v9', JSON.stringify([]));
    storage.setItem(
      'daycraft_ideas_v9',
      JSON.stringify([
        {
          id: 'grp-sparks',
          title: 'Chispazos Libres',
          subtitle: '',
          icon: 'sparkle',
          accentColor: 'amber',
          items: [
            {
              id: 'idea-old',
              groupId: 'grp-sparks',
              title: 'Idea dormida',
              desc: 'Sin tocar',
              createdAtLabel: 'Hace 11 días',
              daysInactive: 11,
            },
          ],
        },
      ])
    );

    await dayCraftStore.getState().hydrateFromSQLite();
    const staleAlerts = dayCraftStore
      .getState()
      .alerts.filter((a: any) => a.type === 'inactive_idea' && a.relatedId === 'idea-old');
    expect(staleAlerts).toHaveLength(1);
  });
});

describe('Tier 1 — F12: Non-Intrusive Notification Bell', () => {
  it('T1-F12-01: BellDropdown renders rollover and inactive_idea alerts and empty state when cleared', () => {
    const bellSrc = readProjectFile('components/ui/BellDropdown.tsx');
    expect(bellSrc).toMatch(/Sin avisos pendientes/);
    expect(bellSrc).toMatch(/Rollover Antiestrés/);
    expect(bellSrc).toMatch(/Idea en el Cajón/);
  });

  it('T1-F12-02: BellDropdown closes on outside-click backdrop', () => {
    const bellSrc = readProjectFile('components/ui/BellDropdown.tsx');
    expect(bellSrc).toMatch(/setBellDropdownOpen\(false\)/);
    // Requires full-screen outside-click backdrop overlay when open (NativeWind or style)
    expect(bellSrc).toMatch(/inset-0|position:\s*['"]absolute['"][\s\S]*inset|bottom:\s*0[\s\S]*left:\s*0[\s\S]*right:\s*0/i);
  });

  it('T1-F12-03: dismissing rollover alert removes only that alert from store', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const alertId = dayCraftStore.getState().alerts[0].id;

    dayCraftStore.getState().dismissAlert(alertId);
    expect(dayCraftStore.getState().alerts.some((a: any) => a.id === alertId)).toBe(false);
    expect(dayCraftStore.getState().alerts.length).toBe(1);
  });

  it('T1-F12-04: BellDropdown action buttons satisfy >=44px touch ergonomics', () => {
    const bellSrc = readProjectFile('components/ui/BellDropdown.tsx');
    expect(bellSrc).toMatch(/min-h-\[44px\]|min-h-11|h-11|minHeight:\s*44|hitSlop/);
  });

  it('T1-F12-05: Web Escape key handler in _layout.tsx closes BellDropdown', () => {
    const layoutSrc = readProjectFile('app/(tabs)/_layout.tsx');
    expect(layoutSrc).toMatch(/e\.key\s*===\s*['"]Escape['"]/);
    expect(layoutSrc).toMatch(/setBellDropdownOpen\(false\)/);
  });
});

describe('Tier 1 — F13: Auto-Grouped Ideas Drawer & .md Notes Editor', () => {
  it('T1-F13-01: addIdeaGroup and addIdeaToGroup create project folders and structured .md notes', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const grp = dayCraftStore.getState().addIdeaGroup({
      title: 'Proyecto: Rust CLI',
      subtitle: 'Herramientas de sistema',
      icon: 'folder',
      accentColor: 'indigo',
    });

    dayCraftStore.getState().addIdeaToGroup(grp.id, 'Parser de argumentos', 'Usar clap v4');
    const updatedGrp = dayCraftStore
      .getState()
      .ideaGroups.find((g: any) => g.id === grp.id);

    expect(updatedGrp.items).toHaveLength(1);
    expect(updatedGrp.items[0].markdownContent).toContain('# Parser de argumentos');
    expect(updatedGrp.items[0].markdownContent).toContain('- [ ]');
  });

  it('T1-F13-02: updateIdeaMarkdown updates title, desc, and markdownContent cleanly', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const idea = dayCraftStore.getState().ideaGroups[0].items[0];

    dayCraftStore.getState().updateIdeaMarkdown(idea.id, {
      title: 'Título actualizado .md',
      desc: 'Resumen actualizado',
      markdownContent: '# Título actualizado .md\n\n- [x] Paso 1\n- [ ] Paso 2',
    });

    const refreshed = dayCraftStore
      .getState()
      .ideaGroups[0].items.find((i: any) => i.id === idea.id);
    expect(refreshed.title).toBe('Título actualizado .md');
    expect(refreshed.markdownContent).toContain('- [x] Paso 1');
  });

  it('T1-F13-03: moveIdeaToGroup transfers an idea between project folders without duplication', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const srcGroup = dayCraftStore.getState().ideaGroups[0];
    const dstGroup = dayCraftStore.getState().ideaGroups[1];
    const targetIdea = srcGroup.items[0];

    dayCraftStore.getState().moveIdeaToGroup(targetIdea.id, dstGroup.id);

    const groups = dayCraftStore.getState().ideaGroups;
    expect(groups[0].items.some((i: any) => i.id === targetIdea.id)).toBe(false);
    const moved = groups[1].items.find((i: any) => i.id === targetIdea.id);
    expect(moved).toBeDefined();
    expect(moved.groupId).toBe(dstGroup.id);
  });

  it('T1-F13-04: IdeaNoteModal provides rich Markdown rendered preview with interactive checklists', () => {
    const modalSrc = readProjectFile('components/ideas/IdeaNoteModal.tsx');
    expect(modalSrc).toMatch(/Vista Previa|Preview|renderMarkdown|previewMode/i);
    expect(modalSrc).toMatch(/-\s*\[[ xX]\]|\\\[x\\\]|\\\[ \\\]|checklist/i);
  });

  it('T1-F13-05: IdeaNoteModal supports cross-platform .md disk export and truncates long filenames', () => {
    const modalSrc = readProjectFile('components/ideas/IdeaNoteModal.tsx');
    expect(modalSrc).toMatch(/expo-file-system|expo-sharing/);
    expect(modalSrc).toMatch(/new Blob/);
    expect(modalSrc).toMatch(/numberOfLines=\{1\}/);
    expect(modalSrc).toMatch(/ellipsizeMode=['"]tail['"]/);
  });
});

describe('Tier 1 — F14: Responsive 4-Tab Mobile + 3-Panel Desktop Cockpit', () => {
  it('T1-F14-01: LAYOUT.desktopBreakpoint is 900px', async () => {
    const themeConst = await loadContractModule<any>('constants/theme');
    expect(themeConst.LAYOUT.desktopBreakpoint).toBe(900);
  });

  it('T1-F14-02: _layout.tsx implements Ctrl+B sidebar toggle and omits mini-calendar widget', () => {
    const layoutSrc = readProjectFile('app/(tabs)/_layout.tsx');
    expect(layoutSrc).toMatch(/ctrlKey.*metaKey.*'b'|'b'.*toggleSidebar/s);
    expect(layoutSrc).not.toMatch(/MiniCalendar|mini-calendar/i);
  });

  it('T1-F14-03: Desktop panel toggles Agenda Hoy / Asistente IA and renders compact focus capsule', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    expect(dayCraftStore.getState().desktopSideTab).toBe('agenda');
    dayCraftStore.getState().setDesktopSideTab('ai');
    expect(dayCraftStore.getState().desktopSideTab).toBe('ai');
    dayCraftStore.getState().toggleSidebar();
    expect(dayCraftStore.getState().sidebarOpen).toBe(false);
  });

  it('T1-F14-04: Mobile custom Flexbox nav renders 4 single-word tabs with allowFontScaling={false}', () => {
    const layoutSrc = readProjectFile('app/(tabs)/_layout.tsx');
    for (const label of ['Asistente', 'Ideas', 'Pendientes', 'Timeline']) {
      expect(layoutSrc).toContain(`'${label}'`);
    }
    expect(layoutSrc).toMatch(/allowFontScaling=\{false\}/);
    expect(layoutSrc).toMatch(/useSafeAreaInsets/);
  });

  it('T1-F14-05: SmartIntakeBar sits in normal flex flow above mobile tab bar', () => {
    const layoutSrc = readProjectFile('app/(tabs)/_layout.tsx');
    const smartIntakeIndex = layoutSrc.indexOf('<SmartIntakeBar isOnChatScreen={isOnChatScreen}');
    const tabBarIndex = layoutSrc.indexOf('Barra de Navegación Inferior Móvil');
    expect(smartIntakeIndex).toBeGreaterThan(-1);
    expect(tabBarIndex).toBeGreaterThan(smartIntakeIndex);
  });
});

describe('Tier 1 — F15: Global Floating Toast', () => {
  it('T1-F15-01: showToast sets activeToast with unique ID and hideToast clears it', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    dayCraftStore.getState().showToast({
      title: 'Guardado',
      description: 'Todo listo',
      primaryActionLabel: 'Ver',
      onPrimaryAction: () => {},
    });

    const toast = dayCraftStore.getState().activeToast;
    expect(toast).not.toBeNull();
    expect(toast.id).toMatch(/^toast-/);
    expect(toast.title).toBe('Guardado');

    dayCraftStore.getState().hideToast();
    expect(dayCraftStore.getState().activeToast).toBeNull();
  });

  it('T1-F15-02: LAYOUT.toastDurationMs matches 4200ms specification', async () => {
    const themeConst = await loadContractModule<any>('constants/theme');
    expect(themeConst.LAYOUT.toastDurationMs).toBe(4200);
  });

  it('T1-F15-03: FloatingToast uses Reanimated and safe-area mobile offset', () => {
    const toastSrc = readProjectFile('components/ui/FloatingToast.tsx');
    expect(toastSrc).toMatch(/react-native-reanimated/);
    expect(toastSrc).toMatch(/useSafeAreaInsets/);
  });

  it('T1-F15-04: FloatingToast action buttons meet >=44px touch ergonomics', () => {
    const toastSrc = readProjectFile('components/ui/FloatingToast.tsx');
    expect(toastSrc).toMatch(/min-h-\[44px\]|min-h-11|h-11|minHeight:\s*44|hitSlop/);
  });

  it('T1-F15-05: rapid showToast calls replace activeToast with distinct IDs', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    dayCraftStore.getState().showToast({ title: 'Primero', description: '1' });
    const id1 = dayCraftStore.getState().activeToast.id;
    await new Promise((r) => setTimeout(r, 2));
    dayCraftStore.getState().showToast({ title: 'Segundo', description: '2' });
    const id2 = dayCraftStore.getState().activeToast.id;

    expect(dayCraftStore.getState().activeToast.title).toBe('Segundo');
    expect(id2).not.toBe(id1);
  });
});

describe('Tier 1 — F16: Kuro-Zen 6-Theme Engine & ThemePicker', () => {
  it('T1-F16-01: THEME_ORDER exposes all 6 themes and each defines all 15 semantic tokens', async () => {
    const themesMod = await loadContractModule<any>('constants/themes');
    expect(themesMod.THEME_ORDER).toEqual([...LOCKED_THEME_ORDER]);

    for (const name of LOCKED_THEME_ORDER) {
      const def = themesMod.THEMES[name];
      expect(def).toBeDefined();
      for (const token of LOCKED_SEMANTIC_TOKENS) {
        expect(def.colors[token]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it('T1-F16-02: all 6 Kuro-Zen themes satisfy WCAG AA (>=4.5:1) and ink AAA (>=7.0:1) contrast', async () => {
    const themesMod = await loadContractModule<any>('constants/themes');

    for (const name of LOCKED_THEME_ORDER) {
      const c = themesMod.THEMES[name].colors;
      expect(contrastRatio(c.ink, c.canvas)).toBeGreaterThanOrEqual(7.0);
      expect(contrastRatio(c.ink, c.card)).toBeGreaterThanOrEqual(7.0);
      expect(contrastRatio(c.muted, c.canvas)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c.muted, c.card)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c.accentSoft, c.card)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c.onAccent, c.accent)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('T1-F16-03: useThemeStore persists and hydrates murasaki without resetting to granate', async () => {
    const { themeStore } = await setupIsolatedStores();
    themeStore.getState().setTheme('murasaki');
    expect(themeStore.getState().themeName).toBe('murasaki');

    // Simulate fresh cold restart
    themeStore.setState({ themeName: 'granate' });
    await themeStore.getState().hydrateTheme();

    expect(themeStore.getState().themeName).toBe('murasaki');
  });

  it('T1-F16-04: global.css and app.json are synchronized with Granate Zen (#130F11) instead of #0d1117', () => {
    const globalCss = readProjectFile('global.css');
    const appJson = JSON.parse(readProjectFile('app.json'));

    expect(globalCss).toContain('--c-canvas: 19 15 17;');
    expect(globalCss).toContain('--c-accent-soft: 222 93 113;');
    expect(appJson.expo.splash.backgroundColor.toLowerCase()).toBe('#130f11');
    expect(appJson.expo.android.adaptiveIcon.backgroundColor.toLowerCase()).toBe('#130f11');
  });

  it('T1-F16-05: zero hardcoded color classes or raw hexes leak inside app/ and components/', () => {
    const violations = findHardcodedColorsInUi();
    expect(violations).toEqual([]);
  });

  it('T1-F16-06: shiro is light (isDark=false) while the 5 dark Kuro-Zen themes have isDark=true', async () => {
    const themesMod = await loadContractModule<any>('constants/themes');
    expect(themesMod.THEMES.shiro.isDark).toBe(false);
    for (const darkName of ['granate', 'murasaki', 'sumi', 'aizome', 'bosque']) {
      expect(themesMod.THEMES[darkName].isDark).toBe(true);
    }
  });
});

describe('Tier 1 — F17: Zen Typography & "Ma" Visual Calm', () => {
  it('T1-F17-01: tailwind.config.js, global.css, and _layout.tsx configure Plus Jakarta Sans & JetBrains Mono', () => {
    const tw = readProjectFile('tailwind.config.js');
    const css = readProjectFile('global.css');
    const layout = readProjectFile('app/_layout.tsx');

    expect(tw).toContain('PlusJakartaSans');
    expect(tw).toContain('JetBrainsMono');
    expect(css).toContain('Plus Jakarta Sans');
    expect(css).toContain('JetBrains Mono');
    expect(layout).toContain('PlusJakartaSans_400Regular');
    expect(layout).toContain('JetBrainsMono_400Regular');
  });

  it('T1-F17-02: enforces minimum >=12px font size across all UI files (no 9/10/11px text)', () => {
    const violations = findSub12pxFontsInUi();
    expect(violations).toEqual([]);
  });

  it('T1-F17-03: key interactive components use >=44px touch targets or hitSlop', () => {
    const targets = [
      'components/pending/PendingItem.tsx',
      'components/timeline/DayStrip.tsx',
      'components/ui/ThemePicker.tsx',
      'components/intake/SmartIntakeBar.tsx',
    ];
    for (const file of targets) {
      const src = readProjectFile(file);
      expect(src, `${file} missing ergonomic hit target`).toMatch(
        /min-h-\[44px\]|min-h-11|minHeight:\s*44|h-11|w-11|hitSlop/
      );
    }
  });

  it('T1-F17-04: unused legacy components (Badge.tsx, Button.tsx, TimeSlot.tsx) are removed', () => {
    expect(projectFileExists('components/ui/Badge.tsx')).toBe(false);
    expect(projectFileExists('components/ui/Button.tsx')).toBe(false);
    expect(projectFileExists('components/timeline/TimeSlot.tsx')).toBe(false);
  });

  it('T1-F17-05: UI components contain zero color emojis (Notion Icons SVG only)', () => {
    const violations = findColorEmojisInUi();
    expect(violations).toEqual([]);
  });
});

describe('Tier 1 — F18: SQLite Schema/Migrations, Sync Engine & MCP Server', () => {
  it('T1-F18-01: SQLite migrations module defines versioned relational tables and v9 KV import', async () => {
    const migSrc = readProjectFile('services/db/migrations.ts');
    expect(migSrc).toMatch(/PRAGMA user_version/i);
    for (const table of [
      'events',
      'pending_tasks',
      'idea_groups',
      'ideas',
      'chat_messages',
      'alerts',
      'sync_outbox',
      'app_meta',
      'kv_store',
    ]) {
      expect(migSrc).toContain(table);
    }
  });

  it('T1-F18-02: seed_initialized guard prevents deleted empty data from reverting to SEED_EVENTS', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    await dayCraftStore.getState().hydrateFromSQLite();

    // User deletes all events and all pending tasks
    const eventIds = dayCraftStore.getState().events.map((e: any) => e.id);
    for (const id of eventIds) {
      dayCraftStore.getState().removeTimelineEvent(id, false);
    }
    const pendingIds = dayCraftStore.getState().pendingTasks.map((p: any) => p.id);
    for (const id of pendingIds) {
      dayCraftStore.getState().removePendingTask(id);
    }

    expect(dayCraftStore.getState().events).toHaveLength(0);
    expect(dayCraftStore.getState().pendingTasks).toHaveLength(0);

    // Cold reload must preserve empty arrays instead of resurrecting seeds
    dayCraftStore.setState({ isHydrated: false });
    await dayCraftStore.getState().hydrateFromSQLite();

    expect(dayCraftStore.getState().events).toHaveLength(0);
    expect(dayCraftStore.getState().pendingTasks).toHaveLength(0);
  });

  it('T1-F18-03: SyncEngine queues mutations in sync_outbox and transitions SyncState on push', async () => {
    const syncMod = await loadContractModule<any>('services/sync/syncEngine');
    const repo = await getTestRepository();

    const pushed: any[] = [];
    const transport = {
      push: async (entries: any[]) => {
        pushed.push(...entries);
        return { acceptedIds: entries.map((e) => e.id), serverEvents: [], conflicts: [] };
      },
      pull: async () => ({ events: [], pendingTasks: [], ideaGroups: [], cursor: '1' }),
    };

    const engine = syncMod.createSyncEngine
      ? syncMod.createSyncEngine({ repository: repo, transport })
      : new syncMod.SyncEngine({ repository: repo, transport });

    await repo.enqueueSyncOutbox({
      id: 'out-1',
      entityType: 'pending',
      entityId: 'p-1',
      operation: 'upsert',
      payload: JSON.stringify({ id: 'p-1', title: 'Sync me', completed: false, isFromYesterday: false, rolloverDays: 0, createdAt: 'Hoy' }),
      createdAt: new Date().toISOString(),
      attempts: 0,
    });

    const state = await engine.syncNow();
    expect(pushed.length).toBeGreaterThanOrEqual(1);
    expect(state.status).toBe('synced');
    expect(state.pendingCount).toBe(0);
  });

  it('T1-F18-04: services/mcp/ has zero react-native or expo-* imports', () => {
    const mcpFiles = listSourceFiles('services/mcp');
    expect(mcpFiles.length).toBeGreaterThan(0);

    for (const abs of mcpFiles) {
      const content = readProjectFile(toRelativePath(abs));
      expect(content).not.toMatch(/from\s+['"]react-native['"]/);
      expect(content).not.toMatch(/from\s+['"]expo-/);
    }
  });

  it('T1-F18-05: MCP Server exposes and executes all 12 locked tools', async () => {
    const mcpMod = await loadContractModule<any>('services/mcp');
    const repo = await getTestRepository();

    const server = mcpMod.createDayCraftMcpServer
      ? mcpMod.createDayCraftMcpServer(repo)
      : new mcpMod.DayCraftMcpServer(repo);

    const listed = await server.listTools();
    const toolNames = (listed.tools || listed).map((t: any) => t.name);
    for (const expectedTool of LOCKED_MCP_TOOLS) {
      expect(toolNames).toContain(expectedTool);
    }

    const created = await server.callTool('add_pending', { title: 'MCP test task' });
    expect(created.isError).not.toBe(true);
    const listedPending = await server.callTool('list_pending', {});
    expect(JSON.stringify(listedPending)).toContain('MCP test task');
  });

  it('T1-F18-06: MCP Server exposes and reads all 3 locked daycraft:// resources', async () => {
    const mcpMod = await loadContractModule<any>('services/mcp');
    const repo = await getTestRepository();

    const server = mcpMod.createDayCraftMcpServer
      ? mcpMod.createDayCraftMcpServer(repo)
      : new mcpMod.DayCraftMcpServer(repo);

    const listed = await server.listResources();
    const uris = (listed.resources || listed).map((r: any) => r.uri);
    for (const expectedUri of LOCKED_MCP_RESOURCES) {
      expect(uris).toContain(expectedUri);
      const readRes = await server.readResource(expectedUri);
      expect(readRes).toBeDefined();
    }
  });
});
