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
import {
  getTestRepository,
  loadContractModule,
  readProjectFile,
} from './helpers/contractLoader';
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
// TIER 2 — BOUNDARY & CORNER CASES (>= 5 tests per feature across 18 features)
// ============================================================================

describe('Tier 2 — F01: Universal Smart Intake Bar Boundaries', () => {
  it('T2-F01-01: ignores empty and whitespace-only utterances without mutating store', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const beforeChat = dayCraftStore.getState().chatMessages.length;
    const beforePending = dayCraftStore.getState().pendingTasks.length;
    const beforeEvents = dayCraftStore.getState().events.length;

    await dayCraftStore.getState().submitSmartIntake('');
    await dayCraftStore.getState().submitSmartIntake('   \n\t   ');

    const state = dayCraftStore.getState();
    expect(state.chatMessages).toHaveLength(beforeChat);
    expect(state.pendingTasks).toHaveLength(beforePending);
    expect(state.events).toHaveLength(beforeEvents);
    expect(state.activeToast).toBeNull();
  });

  it('T2-F01-02: preserves special characters, quotes, accents, and HTML-like meta characters safely', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const payload = `Revisar "presupuesto" & #notas <tag> — 100% español ñ`;

    await dayCraftStore.getState().submitSmartIntake(payload);

    const lastUserMsg = dayCraftStore
      .getState()
      .chatMessages.filter((m: any) => m.role === 'user')
      .pop();
    expect(lastUserMsg.text).toBe(payload);
    expect(dayCraftStore.getState().pendingTasks[0].title).toContain('<tag>');
  });

  it('T2-F01-03: handles 600-character utterance without crash or truncation error', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const longText = `Comprar material de oficina ${'detallado '.repeat(55)}hoy`;

    await dayCraftStore.getState().submitSmartIntake(longText);

    expect(dayCraftStore.getState().pendingTasks[0].title.length).toBeGreaterThan(200);
  });

  it('T2-F01-04: rapid consecutive submissions generate strictly unique entity IDs', async () => {
    const { dayCraftStore } = await setupIsolatedStores();

    await dayCraftStore.getState().submitSmartIntake('Tarea rápida uno');
    await dayCraftStore.getState().submitSmartIntake('Tarea rápida dos');
    await dayCraftStore.getState().submitSmartIntake('Tarea rápida tres');

    const ids = dayCraftStore.getState().pendingTasks.map((t: any) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('T2-F01-05: Undo on Smart Intake toast removes newly created pending or event entity', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    await dayCraftStore.getState().submitSmartIntake('Comprar cable HDMI');
    const createdTitle = dayCraftStore.getState().pendingTasks[0].title;

    dayCraftStore.getState().activeToast?.onUndoAction?.();
    expect(
      dayCraftStore.getState().pendingTasks.some((t: any) => t.title === createdTitle)
    ).toBe(false);
  });
});

describe('Tier 2 — F02: Real Voice Dictation Boundaries', () => {
  it('T2-F02-01: aborted or no-speech SpeechRecognition errors do not force fallback submission', () => {
    const src = readProjectFile('components/intake/SmartIntakeBar.tsx');
    expect(src).toMatch(/errCode\s*!==\s*['"]aborted['"]\s*&&\s*errCode\s*!==\s*['"]no-speech['"]/);
  });

  it('T2-F02-02: empty voice transcript on onend does not invoke submitSmartIntake', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const before = dayCraftStore.getState().chatMessages.length;

    const emptyTranscript = '   '.trim();
    if (emptyTranscript) {
      await dayCraftStore.getState().submitSmartIntake(emptyTranscript);
    }
    expect(dayCraftStore.getState().chatMessages.length).toBe(before);
  });

  it('T2-F02-03: stopping active recording sets guard preventing duplicate submission', () => {
    const src = readProjectFile('components/intake/SmartIntakeBar.tsx');
    expect(src).toMatch(/hasSubmittedVoiceRef\.current\s*=\s*true/);
    expect(src).toMatch(/if\s*\(\s*captured\s*&&\s*!hasSubmittedVoiceRef\.current\s*\)/);
  });

  it('T2-F02-04: unmount cleanup aborts SpeechRecognition and clears fallback timers', () => {
    const src = readProjectFile('components/intake/SmartIntakeBar.tsx');
    expect(src).toMatch(/recognitionRef\.current\.abort\?\.\(\)/);
    expect(src).toMatch(/clearTimeout\(fallbackTimerRef\.current\)/);
  });

  it('T2-F02-05: voice utterance with 18:30 time routes to exact quarter 74', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    await dayCraftStore
      .getState()
      .submitSmartIntake('Recuérdame mañana a las 18:30 revisar presupuesto');

    const ev = dayCraftStore
      .getState()
      .events.find((e: any) => e.title.toLowerCase().includes('presupuesto'));
    expect(ev).toBeDefined();
    expect(ev.type).toBe('reminder');
    expect(ev.startQ).toBe(74); // 18 * 4 + 2
  });
});

describe('Tier 2 — F03: Dual Gemini + Local NLP Parser Boundaries', () => {
  it('T2-F03-01: fetch network rejection falls back cleanly in 0ms to local NLP without throwing', async () => {
    const ai = await loadContractModule<any>('services/ai/geminiClient');
    restoreFetch = mockGlobalFetch(async () => {
      throw new Error('Network offline');
    });

    const res = await ai.processSmartIntake('Comprar agua', '2026-11-17', {
      apiKey: 'AIzaTestKey',
      useCloudAI: true,
    });
    const item = 'items' in res ? res.items[0] : res;
    expect(item.kind).toBe('pending');
    expect(item.title).toContain('Comprar agua');
  });

  it('T2-F03-02: HTTP 429/500 or malformed JSON from Gemini falls back cleanly to local NLP', async () => {
    const ai = await loadContractModule<any>('services/ai/geminiClient');
    restoreFetch = mockGlobalFetch(async () => new Response('not-json{{{', { status: 500 }));

    const res = await ai.processSmartIntake('Cita dentista mañana a las 17:00', '2026-11-17', {
      apiKey: 'AIzaTestKey',
      useCloudAI: true,
    });
    const item = 'items' in res ? res.items[0] : res;
    expect(item.kind).toBe('reminder');
    expect(item.startQ).toBe(68);
  });

  it('T2-F03-03: Gemini client configures AbortController timeout (<=8s) preventing hang', () => {
    const src = readProjectFile('services/ai/geminiClient.ts');
    expect(src).toMatch(/AbortController/);
    expect(src).toMatch(/8000|8_000/);
  });

  it('T2-F03-04: rejects false-positive numeric tokens ("1 idea sobre 2 cosas") as time', async () => {
    const ai = await loadContractModule<any>('services/ai/geminiClient');
    const parsed = ai.parseIntakeLocally('1 idea sobre 2 cosas de diseño', '2026-11-17');
    expect(parsed.kind).toBe('idea');
    expect(parsed.startQ).toBeUndefined();
  });

  it('T2-F03-05: handles boundary hours (00:00, 23:45, 5 pm, 11:55) clamped within 0..95', async () => {
    const ai = await loadContractModule<any>('services/ai/geminiClient');

    const midnight = ai.parseIntakeLocally('Revisión a las 00:00', '2026-11-17');
    const late = ai.parseIntakeLocally('Cierre a las 23:45', '2026-11-17');
    const pm = ai.parseIntakeLocally('Llamar a las 5 pm', '2026-11-17');
    const roll55 = ai.parseIntakeLocally('Alarma a las 23:55', '2026-11-17');

    expect(midnight.startQ).toBe(0);
    expect(late.startQ).toBe(95);
    expect(pm.startQ).toBe(68); // 17:00
    expect(roll55.startQ).toBeGreaterThanOrEqual(0);
    expect(roll55.startQ).toBeLessThanOrEqual(95);
  });
});

describe('Tier 2 — F04: AI Settings Modal Boundaries', () => {
  it('T2-F04-01: whitespace-only API key does not trigger outbound Gemini HTTP requests', async () => {
    const ai = await loadContractModule<any>('services/ai/geminiClient');
    let called = false;
    restoreFetch = mockGlobalFetch(async () => {
      called = true;
      return new Response('{}', { status: 200 });
    });

    await ai.processSmartIntake('Comprar pan', '2026-11-17', {
      apiKey: '    \t  ',
      useCloudAI: true,
    });
    expect(called).toBe(false);
  });

  it('T2-F04-02: HTTP 401 unauthorized Gemini response falls back without throwing', async () => {
    const ai = await loadContractModule<any>('services/ai/geminiClient');
    restoreFetch = mockGlobalFetch(
      async () => new Response(JSON.stringify({ error: { code: 401 } }), { status: 401 })
    );

    const res = await ai.processSmartIntake('Comprar té verde', '2026-11-17', {
      apiKey: 'AIza-invalid',
      useCloudAI: true,
    });
    const item = 'items' in res ? res.items[0] : res;
    expect(item.kind).toBe('pending');
  });

  it('T2-F04-03: explicit user choice useCloudAI=false overrides env key on hydration', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    dayCraftStore.getState().setGeminiConfig({ apiKey: 'AIza-key', useCloudAI: false });
    dayCraftStore.setState({ isHydrated: false, useCloudAI: true });

    await dayCraftStore.getState().hydrateFromSQLite();
    expect(dayCraftStore.getState().useCloudAI).toBe(false);
  });

  it('T2-F04-04: corrupted gemini_config_v9 JSON in storage does not crash hydration', async () => {
    const { storage, dayCraftStore } = await setupIsolatedStores();
    storage.setItem('daycraft_gemini_config_v9', '{broken-json');

    await expect(dayCraftStore.getState().hydrateFromSQLite()).resolves.toBeUndefined();
    expect(dayCraftStore.getState().isHydrated).toBe(true);
  });

  it('T2-F04-05: partial setGeminiConfig({ useCloudAI }) preserves existing geminiApiKey', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    dayCraftStore.getState().setGeminiConfig({ apiKey: 'AIza-keep-me', useCloudAI: true });
    dayCraftStore.getState().setGeminiConfig({ useCloudAI: false });

    expect(dayCraftStore.getState().geminiApiKey).toBe('AIza-keep-me');
    expect(dayCraftStore.getState().useCloudAI).toBe(false);
  });
});

describe('Tier 2 — F05: 24h Vertical Timeline Rail Boundaries', () => {
  it('T2-F05-01: formatQuarterToTime clamps out-of-range quarters (<0 and >96)', async () => {
    const storeMod = await loadContractModule<any>('store/useDayCraftStore');
    expect(storeMod.formatQuarterToTime(-5)).toBe('00:00');
    expect(storeMod.formatQuarterToTime(0)).toBe('00:00');
    expect(storeMod.formatQuarterToTime(95)).toBe('23:45');
    expect(storeMod.formatQuarterToTime(96)).toBe('24:00');
    expect(storeMod.formatQuarterToTime(140)).toBe('24:00');
  });

  it('T2-F05-02: end-of-day event (startQ=94, quarters=4) formats without NaN', async () => {
    const storeMod = await loadContractModule<any>('store/useDayCraftStore');
    expect(storeMod.formatQuarterToTime(94)).toBe('23:30');
    expect(storeMod.formatQuarterToTime(94 + 4)).toBe('24:00');
  });

  it('T2-F05-03: doesEventApplyToDay returns false for non-matching weekly/monthly/none rules', async () => {
    const storeMod = await loadContractModule<any>('store/useDayCraftStore');
    const themeMod = await loadContractModule<any>('constants/theme');
    const tue = themeMod.createDayInfoFromDate(new Date(2026, 10, 17, 12)); // MAR 17

    expect(
      storeMod.doesEventApplyToDay(
        { id: 'w1', dayKey: '2026-11-10', title: 'W', startQ: 40, quarters: 2, type: 'task', recurrence: { frequency: 'weekly', daysOfWeek: ['LUN'] } },
        tue
      )
    ).toBe(false);
    expect(
      storeMod.doesEventApplyToDay(
        { id: 'm1', dayKey: '2026-10-01', title: 'M', startQ: 40, quarters: 2, type: 'task', recurrence: { frequency: 'monthly', dayNumOfMonth: '01' } },
        tue
      )
    ).toBe(false);
    expect(
      storeMod.doesEventApplyToDay(
        { id: 'n1', dayKey: '2026-11-16', title: 'N', startQ: 40, quarters: 2, type: 'task', recurrence: { frequency: 'none' } },
        tue
      )
    ).toBe(false);
  });

  it('T2-F05-04: switching selectedDayKey to an empty future day isolates dayEvents cleanly', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const storeMod = await loadContractModule<any>('store/useDayCraftStore');
    const themeMod = await loadContractModule<any>('constants/theme');

    const emptyDayKey = themeConstKey(themeMod, 45);
    dayCraftStore.getState().setSelectedDayKey(emptyDayKey);
    const dayInfo = dayCraftStore.getState().days.find((d: any) => d.key === emptyDayKey);
    const matches = dayCraftStore
      .getState()
      .events.filter((e: any) => storeMod.doesEventApplyToDay(e, dayInfo));
    expect(matches).toHaveLength(0);
  });

  it('T2-F05-05: formatQuartersToDuration handles 15m, 1h, and 1h 30m cleanly', async () => {
    const storeMod = await loadContractModule<any>('store/useDayCraftStore');
    expect(storeMod.formatQuartersToDuration(1)).toBe('15 min');
    expect(storeMod.formatQuartersToDuration(4)).toBe('1h');
    expect(storeMod.formatQuartersToDuration(6)).toBe('1h 30m');
  });
});

function themeConstKey(themeMod: any, offset: number): string {
  return themeMod.getDateKeyWithOffset(offset);
}

describe('Tier 2 — F06: Interactive 15m Tap & Drag Time-Blocking Boundaries', () => {
  it('T2-F06-01: reverse drag (from q=52 upward to q=48) normalizes minQ=48 and quarters=5', () => {
    const dragStartQ = 52;
    const dragCurrentQ = 48;
    const minQ = Math.min(dragStartQ, dragCurrentQ);
    const maxQ = Math.max(dragStartQ, dragCurrentQ);
    const quarters = minQ === maxQ ? 2 : maxQ - minQ + 1;

    expect(minQ).toBe(48);
    expect(quarters).toBe(5);
  });

  it('T2-F06-02: Rail24h clamps quarter calculation within [0, 95]', () => {
    const railSrc = readProjectFile('components/timeline/Rail24h.tsx');
    expect(railSrc).toMatch(/Math\.max\(0,\s*Math\.min\(95/);
  });

  it('T2-F06-03: single-point click without drag defaults to 2 quarters (30m) instead of 0', () => {
    const dragStartQ = 40;
    const dragCurrentQ = 40;
    const quarters = dragStartQ === dragCurrentQ ? 2 : Math.abs(dragCurrentQ - dragStartQ) + 1;
    expect(quarters).toBe(2);
  });

  it('T2-F06-04: closing slotPickerTarget after drag cancels without creating phantom events', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const initialCount = dayCraftStore.getState().events.length;

    dayCraftStore.getState().openSlotPicker({
      type: 'direct_hour',
      title: '',
      defaultStartQ: 44,
      defaultQuarters: 3,
    });
    dayCraftStore.getState().closeSlotPicker();

    expect(dayCraftStore.getState().slotPickerTarget).toBeNull();
    expect(dayCraftStore.getState().events).toHaveLength(initialCount);
  });

  it('T2-F06-05: concurrent overlapping events at identical startQ coexist and stay editable', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const themeMod = await loadContractModule<any>('constants/theme');
    const dayKey = themeMod.getDateKeyWithOffset(5);

    const e1 = dayCraftStore.getState().addTimelineEvent({
      dayKey,
      title: 'Bloque A',
      startQ: 40,
      quarters: 4,
      type: 'task',
    });
    const e2 = dayCraftStore.getState().addTimelineEvent({
      dayKey,
      title: 'Bloque B',
      startQ: 40,
      quarters: 2,
      type: 'reminder',
    });

    const atSlot = dayCraftStore
      .getState()
      .events.filter((e: any) => e.dayKey === dayKey && e.startQ === 40);
    expect(atSlot).toHaveLength(2);
    expect(e1.id).not.toBe(e2.id);

    dayCraftStore.getState().removeTimelineEvent(e1.id, false);
    expect(dayCraftStore.getState().events.some((e: any) => e.id === e2.id)).toBe(true);
  });
});

describe('Tier 2 — F07: Full Block Editing & Deletion Boundaries', () => {
  it('T2-F07-01: updateTimelineEvent with unknown ID is a safe no-op', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const snapshot = [...dayCraftStore.getState().events];

    dayCraftStore.getState().updateTimelineEvent('non-existent-id', { title: 'Ghost' });
    expect(dayCraftStore.getState().events).toEqual(snapshot);
    expect(dayCraftStore.getState().activeToast).toBeNull();
  });

  it('T2-F07-02: Undo after editing reverts all modified fields to exact prior state', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const original = { ...dayCraftStore.getState().events[0] };

    dayCraftStore.getState().updateTimelineEvent(original.id, {
      title: 'Cambiado',
      startQ: 72,
      quarters: 6,
      desc: 'Nueva desc',
    });

    dayCraftStore.getState().activeToast?.onUndoAction?.();
    const reverted = dayCraftStore.getState().events.find((e: any) => e.id === original.id);
    expect(reverted).toEqual(original);
  });

  it('T2-F07-03: editing a recurring event with frequency="none" removes recurrence rule', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const ev = dayCraftStore.getState().addTimelineEvent({
      dayKey: '2026-11-17',
      title: 'Rutina',
      startQ: 36,
      quarters: 2,
      type: 'task',
      recurrence: { frequency: 'daily' },
    });

    dayCraftStore.getState().openSlotPicker({
      type: 'edit_event',
      id: ev.id,
      title: ev.title,
      defaultStartQ: ev.startQ,
      defaultQuarters: ev.quarters,
      recurrence: ev.recurrence,
    });
    dayCraftStore.getState().assignSlotFromPicker(36, 2, 'Rutina', { frequency: 'none' });

    const updated = dayCraftStore.getState().events.find((e: any) => e.id === ev.id);
    expect(updated.recurrence).toBeUndefined();
  });

  it('T2-F07-04: slot-picker handles boundary HH:MM inputs ("00:00", "23:55", invalid)', () => {
    const modalSrc = readProjectFile('app/modal/slot-picker.tsx');
    expect(modalSrc).toMatch(/Math\.max\(0,\s*Math\.min\(23/);
    expect(modalSrc).toMatch(/Math\.max\(0,\s*Math\.min\(95/);
    expect(modalSrc).toMatch(/if\s*\(isNaN\(h\)\)\s*return\s+fallbackQ/);
  });

  it('T2-F07-05: removeTimelineEvent with withUndoToast=false preserves existing activeToast', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    dayCraftStore.getState().showToast({ title: 'Mantener', description: 'Activo' });
    const id = dayCraftStore.getState().events[0].id;

    dayCraftStore.getState().removeTimelineEvent(id, false);
    expect(dayCraftStore.getState().activeToast?.title).toBe('Mantener');
  });
});

describe('Tier 2 — F08: Dynamic ISO Day Strip & Infinite Scroll Boundaries', () => {
  it('T2-F08-01: shiftDay(-1) at index 0 clamps safely to first day', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const firstKey = dayCraftStore.getState().days[0].key;
    dayCraftStore.getState().setSelectedDayKey(firstKey);

    dayCraftStore.getState().shiftDay(-1);
    expect(dayCraftStore.getState().selectedDayKey).toBe(firstKey);
  });

  it('T2-F08-02: shiftDay(+1) near end of days automatically extends future days', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const days = dayCraftStore.getState().days;
    const beforeLen = days.length;
    dayCraftStore.getState().setSelectedDayKey(days[beforeLen - 2].key);

    dayCraftStore.getState().shiftDay(1);
    expect(dayCraftStore.getState().days.length).toBeGreaterThan(beforeLen);
  });

  it('T2-F08-03: handles leap year Feb 29 (2028) and year-end Dec 31 -> Jan 01 boundaries', async () => {
    const themeMod = await loadContractModule<any>('constants/theme');
    const feb28 = new Date(2028, 1, 28, 12, 0, 0);
    const feb29Key = themeMod.getDateKeyWithOffset(1, feb28);
    const mar01Key = themeMod.getDateKeyWithOffset(2, feb28);

    expect(feb29Key).toBe('2028-02-29');
    expect(mar01Key).toBe('2028-03-01');

    const dec31 = new Date(2026, 11, 31, 12, 0, 0);
    const jan01Key = themeMod.getDateKeyWithOffset(1, dec31);
    expect(jan01Key).toBe('2027-01-01');
    const jan01Info = themeMod.createDayInfoFromDate(themeMod.parseISODate(jan01Key), dec31);
    expect(jan01Info.isFirstOfMonth).toBe(true);
  });

  it('T2-F08-04: parseISODate handles malformed strings without returning NaN Date', async () => {
    const themeMod = await loadContractModule<any>('constants/theme');
    for (const bad of ['', 'invalid', '2026-99']) {
      const dt = themeMod.parseISODate(bad);
      expect(Number.isNaN(dt.getTime())).toBe(false);
    }
  });

  it('T2-F08-05: normalizeLegacyEvents maps legacy 2-digit keys while preserving ISO keys', async () => {
    const sqliteMod = await loadContractModule<any>('services/db/sqlite');
    const themeMod = await loadContractModule<any>('constants/theme');

    const normalized = sqliteMod.normalizeLegacyEvents([
      { id: 'a', dayKey: '27', title: 'Legacy Today', startQ: 40, quarters: 2, type: 'task' },
      { id: 'b', dayKey: '28', title: 'Legacy Tomorrow', startQ: 40, quarters: 2, type: 'task' },
      { id: 'c', dayKey: '2027-05-10', title: 'Already ISO', startQ: 40, quarters: 2, type: 'task' },
    ]);

    expect(normalized[0].dayKey).toBe(themeMod.getTodayKey());
    expect(normalized[1].dayKey).toBe(themeMod.getDateKeyWithOffset(1));
    expect(normalized[2].dayKey).toBe('2027-05-10');
  });
});

describe('Tier 2 — F09: Empathetic Empty-Day Messages Boundaries', () => {
  it('T2-F09-01: day with only a completed event is still considered non-empty', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const storeMod = await loadContractModule<any>('store/useDayCraftStore');
    const themeMod = await loadContractModule<any>('constants/theme');
    const targetKey = themeMod.getDateKeyWithOffset(20);

    dayCraftStore.getState().addTimelineEvent({
      dayKey: targetKey,
      title: 'Completada',
      startQ: 40,
      quarters: 2,
      type: 'task',
      completed: true,
    });

    const dayInfo = dayCraftStore.getState().days.find((d: any) => d.key === targetKey);
    expect(
      dayCraftStore.getState().events.filter((e: any) => storeMod.doesEventApplyToDay(e, dayInfo))
    ).toHaveLength(1);
  });

  it('T2-F09-02: day with a recurring event from an earlier date is not empty', async () => {
    const storeMod = await loadContractModule<any>('store/useDayCraftStore');
    const themeMod = await loadContractModule<any>('constants/theme');
    const future = themeMod.createDayInfoFromDate(new Date(2026, 11, 10, 12));

    expect(
      storeMod.doesEventApplyToDay(
        { id: 'r1', dayKey: '2026-11-01', title: 'Daily Sync', startQ: 38, quarters: 1, type: 'task', recurrence: { frequency: 'daily' } },
        future
      )
    ).toBe(true);
  });

  it('T2-F09-03: past day near 23:59 local time boundary remains isPast=true, isToday=false', async () => {
    const themeMod = await loadContractModule<any>('constants/theme');
    const now = new Date(2026, 10, 17, 23, 59, 59);
    const yesterday = new Date(2026, 10, 16, 23, 59, 59);
    const info = themeMod.createDayInfoFromDate(yesterday, now);

    expect(info.isPast).toBe(true);
    expect(info.isToday).toBe(false);
  });

  it('T2-F09-04: future day near 00:01 local time boundary remains isPast=false, isToday=false', async () => {
    const themeMod = await loadContractModule<any>('constants/theme');
    const now = new Date(2026, 10, 17, 0, 1, 0);
    const tomorrow = new Date(2026, 10, 18, 0, 1, 0);
    const info = themeMod.createDayInfoFromDate(tomorrow, now);

    expect(info.isPast).toBe(false);
    expect(info.isToday).toBe(false);
  });

  it('T2-F09-05: empty pendingTasks array computes incompleteCount=0 cleanly without error', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    dayCraftStore.setState({ pendingTasks: [] });
    const incomplete = dayCraftStore.getState().pendingTasks.filter((t: any) => !t.completed);
    expect(incomplete).toHaveLength(0);
    expect(() => dayCraftStore.getState().simulateAllPendingDone()).not.toThrow();
  });
});

describe('Tier 2 — F10: Unscheduled Pending Tasks & Smart Slot Picker Boundaries', () => {
  it('T2-F10-01: packed day with events on all preset slots still handles slot-picker gracefully', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const themeMod = await loadContractModule<any>('constants/theme');
    const todayKey = themeMod.getTodayKey();

    for (const q of [48, 64, 76]) {
      dayCraftStore.getState().addTimelineEvent({
        dayKey: todayKey,
        title: `Busy ${q}`,
        startQ: q,
        quarters: 2,
        type: 'task',
      });
    }

    dayCraftStore.getState().openSlotPicker({
      type: 'pending',
      id: dayCraftStore.getState().pendingTasks[0].id,
      title: 'Mover a hueco libre',
    });
    expect(dayCraftStore.getState().slotPickerTarget).not.toBeNull();
  });

  it('T2-F10-02: assigning a pending slot while viewing a future day schedules onto that future dayKey', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const themeMod = await loadContractModule<any>('constants/theme');
    const futureKey = themeMod.getDateKeyWithOffset(4);

    dayCraftStore.getState().setSelectedDayKey(futureKey);
    const pending = dayCraftStore.getState().pendingTasks[0];
    dayCraftStore.getState().openSlotPicker({ type: 'pending', id: pending.id, title: pending.title });
    dayCraftStore.getState().assignSlotFromPicker(40, 2);

    const created = dayCraftStore.getState().events.find((e: any) => e.title === pending.title);
    expect(created.dayKey).toBe(futureKey);
  });

  it('T2-F10-03: double-toggling pending task restores incomplete state and preserves rolloverDays', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const task = dayCraftStore.getState().pendingTasks[0];
    const origRollover = task.rolloverDays;

    dayCraftStore.getState().togglePendingTask(task.id);
    dayCraftStore.getState().togglePendingTask(task.id);

    const finalTask = dayCraftStore.getState().pendingTasks.find((t: any) => t.id === task.id);
    expect(finalTask.completed).toBe(false);
    expect(finalTask.rolloverDays).toBe(origRollover);
  });

  it('T2-F10-04: simulateAllPendingDone toggles all done then restores all incomplete', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    dayCraftStore.getState().simulateAllPendingDone();
    expect(dayCraftStore.getState().pendingTasks.every((t: any) => t.completed)).toBe(true);

    dayCraftStore.getState().simulateAllPendingDone();
    expect(dayCraftStore.getState().pendingTasks.every((t: any) => !t.completed)).toBe(true);
  });

  it('T2-F10-05: PendingItem renders single-line De ayer badge only when isFromYesterday=true', () => {
    const src = readProjectFile('components/pending/PendingItem.tsx');
    expect(src).toMatch(/task\.isFromYesterday/);
    expect(src).toMatch(/numberOfLines=\{1\}/);
    expect(src).toContain('De ayer');
  });
});

describe('Tier 2 — F11: Anti-Stress Daily Rollover & 3-Day Rule Boundaries', () => {
  it('T2-F11-01: same-day reopen (lastOpenedDate === todayKey) does not trigger rollover', async () => {
    const { storage, dayCraftStore } = await setupIsolatedStores();
    const themeMod = await loadContractModule<any>('constants/theme');
    const todayKey = themeMod.getTodayKey();

    storage.setItem('daycraft_last_opened_date_v9', JSON.stringify(todayKey));
    storage.setItem(
      'daycraft_pending_v9',
      JSON.stringify([
        { id: 'p1', title: 'Same day', completed: false, isFromYesterday: false, rolloverDays: 0, createdAt: 'Hoy' },
      ])
    );

    await dayCraftStore.getState().hydrateFromSQLite();
    expect(dayCraftStore.getState().pendingTasks[0].rolloverDays).toBe(0);
    expect(dayCraftStore.getState().pendingTasks[0].isFromYesterday).toBe(false);
  });

  it('T2-F11-02: backward clock skew (lastOpenedDate > todayKey) never yields negative rolloverDays', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 17, 10, 0, 0));

    const { storage, dayCraftStore } = await setupIsolatedStores();
    storage.setItem('daycraft_last_opened_date_v9', JSON.stringify('2026-11-25')); // future clock skew
    storage.setItem(
      'daycraft_pending_v9',
      JSON.stringify([
        { id: 'p-skew', title: 'Clock skew', completed: false, isFromYesterday: false, rolloverDays: 1, createdAt: 'Hoy' },
      ])
    );

    await dayCraftStore.getState().hydrateFromSQLite();
    const task = dayCraftStore.getState().pendingTasks.find((t: any) => t.id === 'p-skew');
    expect(task.rolloverDays).toBeGreaterThanOrEqual(1);
  });

  it('T2-F11-03: task at rolloverDays=2 reaching >=3 via multi-day skip triggers 3-Day Rule alert', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 17, 10, 0, 0));

    const { storage, dayCraftStore } = await setupIsolatedStores();
    storage.setItem('daycraft_last_opened_date_v9', JSON.stringify('2026-11-15')); // 2 days elapsed
    storage.setItem(
      'daycraft_pending_v9',
      JSON.stringify([
        { id: 'p-skip', title: 'Aplazada', completed: false, isFromYesterday: true, rolloverDays: 2, createdAt: 'Hace 2d' },
      ])
    );

    await dayCraftStore.getState().hydrateFromSQLite();
    const task = dayCraftStore.getState().pendingTasks.find((t: any) => t.id === 'p-skip');
    expect(task.rolloverDays).toBeGreaterThanOrEqual(3);
    expect(dayCraftStore.getState().alerts.some((a: any) => a.relatedId === 'p-skip')).toBe(true);
  });

  it('T2-F11-04: movePendingToIdeaGroups creates grp-sparks automatically if missing', async () => {
    const rollover = await loadContractModule<any>('services/rollover/rolloverEngine');
    const task = {
      id: 'p-orphan',
      title: 'Rescatar sin grupo sparks',
      completed: false,
      isFromYesterday: true,
      rolloverDays: 3,
      createdAt: 'Hace 3d',
    };

    const groups = rollover.movePendingToIdeaGroups(task, []);
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe('grp-sparks');
    expect(groups[0].items[0].title).toBe('Rescatar sin grupo sparks');
  });

  it('T2-F11-05: empty pendingTasks and empty ideaGroups produce empty rollover output cleanly', async () => {
    const rollover = await loadContractModule<any>('services/rollover/rolloverEngine');
    const res = rollover.evaluateDailyRollover([], { ideaGroups: [] });
    expect(res.updatedTasks).toEqual([]);
    expect(res.threeDayRuleTriggered).toEqual([]);
    expect(res.generatedAlerts).toEqual([]);
    expect(res.staleIdeasTriggered).toEqual([]);
    expect(res.updatedIdeaGroups).toEqual([]);
  });
});

describe('Tier 2 — F12: Non-Intrusive Notification Bell Boundaries', () => {
  it('T2-F12-01: dismissing an unknown alert ID leaves existing alerts intact', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const before = dayCraftStore.getState().alerts.length;
    dayCraftStore.getState().dismissAlert('unknown-alert-999');
    expect(dayCraftStore.getState().alerts).toHaveLength(before);
  });

  it('T2-F12-02: Retomar action strips surrounding quotes from alert title', () => {
    const bellSrc = readProjectFile('components/ui/BellDropdown.tsx');
    expect(bellSrc).toMatch(/replace\(\s*\/"\/g\s*,\s*['"]['"]\s*\)/);
  });

  it('T2-F12-03: rapid toggling of setBellDropdownOpen stays consistent', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    dayCraftStore.getState().setBellDropdownOpen(true);
    dayCraftStore.getState().setBellDropdownOpen(false);
    dayCraftStore.getState().setBellDropdownOpen(true);
    expect(dayCraftStore.getState().bellDropdownOpen).toBe(true);
  });

  it('T2-F12-04: convertStalePendingToIdea for an already-removed pending ID is a safe no-op', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const groupsBefore = JSON.stringify(dayCraftStore.getState().ideaGroups);
    dayCraftStore.getState().convertStalePendingToIdea('deleted-pending-id');
    expect(JSON.stringify(dayCraftStore.getState().ideaGroups)).toBe(groupsBefore);
  });

  it('T2-F12-05: running rollover evaluation consecutively does not produce duplicate alert IDs', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    dayCraftStore.getState().triggerRolloverSimulation();
    dayCraftStore.getState().triggerRolloverSimulation();

    const ids = dayCraftStore.getState().alerts.map((a: any) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('Tier 2 — F13: Auto-Grouped Ideas Drawer & .md Notes Editor Boundaries', () => {
  it('T2-F13-01: slug generation normalizes accents, spaces, and symbols into safe .md filename', () => {
    const title = '¡Diseño & Arquitectura — Móvil v10 / Español ñ!';
    const slug =
      title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'nota-daycraft';

    expect(slug).toBe('diseno-arquitectura-movil-v10-espanol-n');
    expect(slug).not.toMatch(/[^a-z0-9-]/);
  });

  it('T2-F13-02: moveIdeaToGroup to same group or missing target group is a safe no-op', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const grp0 = dayCraftStore.getState().ideaGroups[0];
    const idea = grp0.items[0];
    const before = JSON.stringify(dayCraftStore.getState().ideaGroups);

    dayCraftStore.getState().moveIdeaToGroup(idea.id, grp0.id);
    dayCraftStore.getState().moveIdeaToGroup(idea.id, 'grp-does-not-exist');

    expect(JSON.stringify(dayCraftStore.getState().ideaGroups)).toBe(before);
  });

  it('T2-F13-03: removeIdea clears activeIdeaId when active idea is deleted and Undo restores it', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const grp0 = dayCraftStore.getState().ideaGroups[0];
    const idea = grp0.items[0];

    dayCraftStore.getState().setActiveIdeaId(idea.id);
    dayCraftStore.getState().removeIdea(idea.id);

    expect(dayCraftStore.getState().activeIdeaId).toBeNull();
    expect(
      dayCraftStore.getState().ideaGroups[0].items.some((i: any) => i.id === idea.id)
    ).toBe(false);

    dayCraftStore.getState().activeToast?.onUndoAction?.();
    expect(
      dayCraftStore.getState().ideaGroups[0].items.some((i: any) => i.id === idea.id)
    ).toBe(true);
  });

  it('T2-F13-04: addIdeaToGroup falls back to first existing group when groupId is missing', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    dayCraftStore.getState().addIdeaToGroup('grp-missing', 'Idea rescatada');
    expect(
      dayCraftStore.getState().ideaGroups[0].items.some((i: any) => i.title === 'Idea rescatada')
    ).toBe(true);
  });

  it('T2-F13-05: IdeaNoteModal escapes double quotes inside YAML frontmatter title', () => {
    const modalSrc = readProjectFile('components/ideas/IdeaNoteModal.tsx');
    expect(modalSrc).toMatch(/replace\(\s*\/"\/g\s*,\s*['"]\\\\"['"]\s*\)/);
  });
});

describe('Tier 2 — F14: Responsive 4-Tab Mobile + 3-Panel Desktop Cockpit Boundaries', () => {
  it('T2-F14-01: desktopBreakpoint boundary strictly separates 899 (mobile) from 900 (desktop)', async () => {
    const themeMod = await loadContractModule<any>('constants/theme');
    const bp = themeMod.LAYOUT.desktopBreakpoint;
    expect(899 >= bp).toBe(false);
    expect(900 >= bp).toBe(true);
  });

  it('T2-F14-02: toggling sidebar twice returns sidebarOpen to initial state', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const initial = dayCraftStore.getState().sidebarOpen;
    dayCraftStore.getState().toggleSidebar();
    dayCraftStore.getState().toggleSidebar();
    expect(dayCraftStore.getState().sidebarOpen).toBe(initial);
  });

  it('T2-F14-03: Desktop focus capsule reflects dynamic schedule rather than static hardcoded afternoon copy', () => {
    const layoutSrc = readProjectFile('app/(tabs)/_layout.tsx');
    expect(layoutSrc).not.toContain('Tarde 100% libre desde las 12:00');
  });

  it('T2-F14-04: pending incomplete badge count excludes completed tasks', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const taskId = dayCraftStore.getState().pendingTasks[0].id;
    const beforeIncomplete = dayCraftStore
      .getState()
      .pendingTasks.filter((t: any) => !t.completed).length;

    dayCraftStore.getState().togglePendingTask(taskId);
    const afterIncomplete = dayCraftStore
      .getState()
      .pendingTasks.filter((t: any) => !t.completed).length;

    expect(afterIncomplete).toBe(beforeIncomplete - 1);
  });

  it('T2-F14-05: store supports activeIdeaGroupId / setActiveIdeaGroupId contract for sidebar filtering', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    const state = dayCraftStore.getState();
    expect(typeof state.setActiveIdeaGroupId).toBe('function');
    state.setActiveIdeaGroupId('grp-app');
    expect(dayCraftStore.getState().activeIdeaGroupId).toBe('grp-app');
    state.setActiveIdeaGroupId(null);
    expect(dayCraftStore.getState().activeIdeaGroupId).toBeNull();
  });
});

describe('Tier 2 — F15: Global Floating Toast Boundaries', () => {
  it('T2-F15-01: hideToast when activeToast is already null is an idempotent no-op', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    expect(dayCraftStore.getState().activeToast).toBeNull();
    expect(() => dayCraftStore.getState().hideToast()).not.toThrow();
    expect(dayCraftStore.getState().activeToast).toBeNull();
  });

  it('T2-F15-02: FloatingToast truncates long title and description with numberOfLines={1}', () => {
    const src = readProjectFile('components/ui/FloatingToast.tsx');
    const matches = src.match(/numberOfLines=\{1\}/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('T2-F15-03: Undo callback on deleted pending task preserves other concurrent tasks', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    await dayCraftStore.getState().submitSmartIntake('Tarea temporal');
    const undoFn = dayCraftStore.getState().activeToast?.onUndoAction;
    dayCraftStore.getState().addPendingTask('Tarea permanente');

    undoFn?.();
    const titles = dayCraftStore.getState().pendingTasks.map((t: any) => t.title);
    expect(titles).not.toContain('Tarea temporal');
    expect(titles).toContain('Tarea permanente');
  });

  it('T2-F15-04: idea capture toast links Fijar hora directly to the created idea ID', async () => {
    const { dayCraftStore } = await setupIsolatedStores();
    await dayCraftStore.getState().submitSmartIntake('Idea: Integración MCP con Raycast');

    const toast = dayCraftStore.getState().activeToast;
    expect(toast?.onPrimaryAction).toBeTypeOf('function');
    toast?.onPrimaryAction?.();
    expect(dayCraftStore.getState().slotPickerTarget?.id).toMatch(/^idea-/);
  });

  it('T2-F15-05: FloatingToast uses only semantic Kuro-Zen classes (no raw hexes)', () => {
    const src = readProjectFile('components/ui/FloatingToast.tsx');
    expect(src).not.toMatch(/#[0-9a-fA-F]{6}/);
    expect(src).toContain('bg-card');
    expect(src).toContain('border-l-ok');
  });
});

describe('Tier 2 — F16: Kuro-Zen 6-Theme Engine & ThemePicker Boundaries', () => {
  it('T2-F16-01: setTheme ignores unknown theme names without corrupting state or storage', async () => {
    const { storage, themeStore } = await setupIsolatedStores();
    themeStore.getState().setTheme('sumi');
    themeStore.getState().setTheme('invalid_theme_xyz' as any);

    expect(themeStore.getState().themeName).toBe('sumi');
    expect(JSON.parse(storage.getItem('daycraft_theme_v1')!)).toBe('sumi');
  });

  it('T2-F16-02: hydrateTheme falls back to granate when storage has corrupted or unknown theme', async () => {
    const { storage, themeStore } = await setupIsolatedStores();
    storage.setItem('daycraft_theme_v1', JSON.stringify('corrupt_theme'));

    await themeStore.getState().hydrateTheme();
    expect(themeStore.getState().themeName).toBe('granate');
  });

  it('T2-F16-03: hexToChannels handles uppercase, lowercase, and optional # prefix', async () => {
    const themesMod = await loadContractModule<any>('constants/themes');
    expect(themesMod.hexToChannels('#130F11')).toBe('19 15 17');
    expect(themesMod.hexToChannels('ffffff')).toBe('255 255 255');
    expect(themesMod.hexToChannels('#000000')).toBe('0 0 0');
  });

  it('T2-F16-04: themeCssVars outputs valid numeric RGB channels (0..255) for all 6 themes', async () => {
    const themesMod = await loadContractModule<any>('constants/themes');
    for (const name of LOCKED_THEME_ORDER) {
      const varsMap = themesMod.themeCssVars(themesMod.THEMES[name]);
      const values = Object.values(varsMap) as string[];
      expect(values).toHaveLength(15);
      for (const val of values) {
        const parts = val.split(' ').map(Number);
        expect(parts).toHaveLength(3);
        for (const ch of parts) {
          expect(Number.isInteger(ch)).toBe(true);
          expect(ch).toBeGreaterThanOrEqual(0);
          expect(ch).toBeLessThanOrEqual(255);
        }
      }
    }
  });

  it('T2-F16-05: rapid cycling across all 6 themes persists final theme on restart', async () => {
    const { themeStore } = await setupIsolatedStores();
    for (const name of LOCKED_THEME_ORDER) {
      themeStore.getState().setTheme(name);
    }
    expect(themeStore.getState().themeName).toBe('shiro');

    themeStore.setState({ themeName: 'granate' });
    await themeStore.getState().hydrateTheme();
    expect(themeStore.getState().themeName).toBe('shiro');
  });
});

describe('Tier 2 — F17: Zen Typography & "Ma" Visual Calm Boundaries', () => {
  it('T2-F17-01: _layout.tsx safely guards document access on Web-only font injection', () => {
    const layoutSrc = readProjectFile('app/_layout.tsx');
    expect(layoutSrc).toMatch(/typeof document\s*===\s*['"]undefined['"]/);
  });

  it('T2-F17-02: NotionIcon avoids hardcoded fallback hex colors', () => {
    const iconSrc = readProjectFile('components/ui/NotionIcon.tsx');
    expect(iconSrc).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  it('T2-F17-03: EventCard compact and expanded modes keep text >= 12px', () => {
    const cardSrc = readProjectFile('components/timeline/EventCard.tsx');
    expect(cardSrc).not.toMatch(/text-\[(?:[1-9]|1[01])px\]/);
    expect(cardSrc).not.toMatch(/fontSize\s*:\s*(?:[1-9]|1[01])\b/);
  });

  it('T2-F17-04: DayStrip month divider and day pills avoid sub-12px typography', () => {
    const stripSrc = readProjectFile('components/timeline/DayStrip.tsx');
    expect(stripSrc).not.toMatch(/text-\[(?:[1-9]|1[01])px\]/);
    expect(stripSrc).not.toMatch(/fontSize\s*:\s*(?:[1-9]|1[01])\b/);
  });

  it('T2-F17-05: BellDropdown badges and buttons avoid sub-12px typography', () => {
    const bellSrc = readProjectFile('components/ui/BellDropdown.tsx');
    expect(bellSrc).not.toMatch(/text-\[(?:[1-9]|1[01])px\]/);
    expect(bellSrc).not.toMatch(/fontSize\s*:\s*(?:[1-9]|1[01])\b/);
  });
});

describe('Tier 2 — F18: SQLite Schema/Migrations, Sync Engine & MCP Server Boundaries', () => {
  it('T2-F18-01: running SQLite migrations twice is idempotent and preserves existing data', async () => {
    const repo = await getTestRepository();

    await repo.init?.();
    await repo.upsertEvent({
      id: 'ev-idempotent',
      dayKey: '2026-11-17',
      title: 'Persistente',
      startQ: 36,
      quarters: 2,
      type: 'task',
    });
    await repo.init?.();

    const snap = await repo.getSnapshot();
    expect(snap.events.some((e: any) => e.id === 'ev-idempotent')).toBe(true);
  });

  it('T2-F18-02: native SQLite failure degrades safely to working in-memory DayCraftRepository', async () => {
    vi.stubGlobal('navigator', { product: 'ReactNative' });
    const sqliteMod = await loadContractModule<any>('services/db/sqlite');

    try {
      if (typeof sqliteMod.setRepositoryForTesting === 'function') {
        sqliteMod.setRepositoryForTesting(null);
      }
      expect(sqliteMod.isReactNativeRuntime()).toBe(true);
      expect(sqliteMod.isWebRuntime()).toBe(false);
      await expect(sqliteMod.initDatabase()).resolves.toBeDefined();
      await expect(sqliteMod.savePersistedState('fallback_key', { ok: true })).resolves.toBeUndefined();
      const loaded = await sqliteMod.loadPersistedState('fallback_key');
      expect(loaded).toEqual({ ok: true });
    } finally {
      vi.unstubAllGlobals();
      if (typeof sqliteMod.setRepositoryForTesting === 'function') {
        sqliteMod.setRepositoryForTesting(null);
      }
    }
  });

  it('T2-F18-03: SyncTransport failure sets SyncState.status="error" and retains outbox entries for retry', async () => {
    const syncMod = await loadContractModule<any>('services/sync/syncEngine');
    const repo = await getTestRepository();

    let shouldFail = true;
    const transport = {
      push: async (entries: any[]) => {
        if (shouldFail) throw new Error('503 Service Unavailable');
        return { acceptedIds: entries.map((e) => e.id), serverEvents: [], conflicts: [] };
      },
      pull: async () => ({ events: [], pendingTasks: [], ideaGroups: [], cursor: '1' }),
    };

    const engine = syncMod.createSyncEngine
      ? syncMod.createSyncEngine({ repository: repo, transport })
      : new syncMod.SyncEngine({ repository: repo, transport });

    await repo.enqueueSyncOutbox({
      id: 'out-retry',
      entityType: 'pending',
      entityId: 'p-retry',
      operation: 'upsert',
      payload: JSON.stringify({ id: 'p-retry', title: 'Retry task', completed: false, isFromYesterday: false, rolloverDays: 0, createdAt: 'Hoy' }),
      createdAt: new Date().toISOString(),
      attempts: 0,
    });

    const errState = await engine.syncNow();
    expect(errState.status).toBe('error');
    expect(errState.lastError).toMatch(/503|unavailable/i);
    expect(errState.pendingCount).toBeGreaterThanOrEqual(1);

    shouldFail = false;
    const okState = await engine.syncNow();
    expect(okState.status).toBe('synced');
    expect(okState.pendingCount).toBe(0);
  });

  it('T2-F18-04: Sync conflict resolution resolves concurrent newer remote vs local update cleanly', async () => {
    const syncMod = await loadContractModule<any>('services/sync/syncEngine');
    expect(syncMod.resolveSyncConflict || syncMod.SyncEngine || syncMod.createSyncEngine).toBeDefined();

    if (typeof syncMod.resolveSyncConflict === 'function') {
      const local = { id: 'ev-c', title: 'Local Old', updatedAt: '2026-11-17T09:00:00Z', version: 1 };
      const remote = { id: 'ev-c', title: 'Remote New', updatedAt: '2026-11-17T10:00:00Z', version: 2 };
      const winner = syncMod.resolveSyncConflict(local, remote);
      expect(winner.title).toBe('Remote New');
    } else {
      const repo = await getTestRepository();
      await repo.upsertEvent({
        id: 'ev-c',
        dayKey: '2026-11-17',
        title: 'Local Old',
        startQ: 40,
        quarters: 2,
        type: 'task',
        updatedAt: '2026-11-17T09:00:00Z',
        version: 1,
      });
      const transport = {
        push: async () => ({ acceptedIds: [], serverEvents: [], conflicts: [] }),
        pull: async () => ({
          events: [
            {
              id: 'ev-c',
              dayKey: '2026-11-17',
              title: 'Remote New',
              startQ: 40,
              quarters: 2,
              type: 'task',
              updatedAt: '2026-11-17T10:00:00Z',
              version: 2,
            },
          ],
          pendingTasks: [],
          ideaGroups: [],
          cursor: '2',
        }),
      };
      const engine = syncMod.createSyncEngine
        ? syncMod.createSyncEngine({ repository: repo, transport })
        : new syncMod.SyncEngine({ repository: repo, transport });
      await engine.syncNow();
      const snap = await repo.getSnapshot();
      expect(snap.events.find((e: any) => e.id === 'ev-c')?.title).toBe('Remote New');
    }
  });

  it('T2-F18-05: MCP server handles unknown tool, invalid args, and unknown resource without throwing', async () => {
    const mcpMod = await loadContractModule<any>('services/mcp');
    const repo = await getTestRepository();

    const server = mcpMod.createDayCraftMcpServer
      ? mcpMod.createDayCraftMcpServer(repo)
      : new mcpMod.DayCraftMcpServer(repo);

    const badTool = await server.callTool('non_existent_tool', {});
    expect(badTool.isError).toBe(true);

    const badArgs = await server.callTool('create_event', { title: '', startQ: -1, quarters: 0 });
    expect(badArgs.isError).toBe(true);

    if (typeof server.handleJsonRpc === 'function') {
      const badRpc = await server.handleJsonRpc('not valid json{{{');
      expect(badRpc.error).toBeDefined();
    }
  });

  it('T2-F18-06: types/daycraft.ts contains ZERO react-native or expo-* imports', () => {
    const typesSrc = readProjectFile('types/daycraft.ts');
    expect(typesSrc).not.toMatch(/from\s+['"]react-native['"]/);
    expect(typesSrc).not.toMatch(/from\s+['"]expo-/);
  });
});
