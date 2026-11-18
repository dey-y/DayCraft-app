import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDateKeyWithOffset, getTodayKey } from '@/constants/theme';
import {
  SEED_ALERTS,
  SEED_CHAT,
  SEED_EVENTS,
  SEED_IDEA_GROUPS,
  SEED_PENDING,
  isReactNativeRuntime,
  isWebRuntime,
  normalizeLegacyEvents,
} from '@/services/db/sqlite';
import { evaluateDailyRollover } from '@/services/rollover/rolloverEngine';
import { useThemeStore } from '@/store/useThemeStore';
import type {
  DayCraftSnapshot,
  PendingTask,
  SyncState,
  TimelineEvent,
} from '@/types/daycraft';

const ROOT = path.resolve(__dirname, '../../..');

describe('M1 Contracts & Pure-Node Imports', () => {
  afterEach(() => {
    vi.unstubAllGlobals?.();
  });

  it('keeps types/daycraft.ts and M1 core services free of react-native and expo-* imports', () => {
    const pureFiles = [
      'types/daycraft.ts',
      'services/db/migrations.ts',
      'services/rollover/rolloverEngine.ts',
    ];
    for (const rel of pureFiles) {
      const content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      expect(content).not.toMatch(/from\s+['"]react-native['"]/);
      expect(content).not.toMatch(/from\s+['"]expo-/);
      expect(content).not.toMatch(/require\(['"]react-native['"]\)/);
    }

    const sqliteContent = fs.readFileSync(
      path.join(ROOT, 'services/db/sqlite.ts'),
      'utf8'
    );
    expect(sqliteContent).not.toMatch(/from\s+['"]react-native['"]/);
    expect(sqliteContent).not.toMatch(/import\s+.*from\s+['"]expo-/);
  });

  it('imports domain, persistence, rollover, and theme store cleanly in pure Node', () => {
    expect(SEED_EVENTS.length).toBeGreaterThan(0);
    expect(typeof evaluateDailyRollover).toBe('function');
    expect(useThemeStore.getState().themeName).toBe('granate');
    expect(isWebRuntime()).toBe(false);
    expect(isReactNativeRuntime()).toBe(false);
  });

  it('validates SEED_* structural invariants', () => {
    const isoRe = /^\d{4}-\d{2}-\d{2}$/;

    for (const ev of SEED_EVENTS) {
      expect(ev.id).toBeTruthy();
      expect(ev.dayKey).toMatch(isoRe);
      expect(ev.startQ).toBeGreaterThanOrEqual(0);
      expect(ev.startQ).toBeLessThanOrEqual(95);
      expect(ev.quarters).toBeGreaterThanOrEqual(1);
    }

    for (const task of SEED_PENDING) {
      expect(task.id).toBeTruthy();
      expect(task.title.length).toBeGreaterThan(0);
      expect(task.rolloverDays).toBeGreaterThanOrEqual(0);
    }

    for (const group of SEED_IDEA_GROUPS) {
      expect(group.id).toBeTruthy();
      for (const item of group.items) {
        expect(item.groupId).toBe(group.id);
        expect(item.title.length).toBeGreaterThan(0);
      }
    }

    expect(SEED_CHAT.length).toBeGreaterThan(0);
    expect(SEED_ALERTS.length).toBeGreaterThan(0);
  });

  it('normalizes legacy 2-digit event dayKeys and preserves ISO keys', () => {
    const today = getTodayKey();
    const plus1 = getDateKeyWithOffset(1);
    const plus2 = getDateKeyWithOffset(2);
    const plus3 = getDateKeyWithOffset(3);

    const legacy: TimelineEvent[] = [
      { id: '1', dayKey: '27', title: 'A', startQ: 40, quarters: 2, type: 'task' },
      { id: '2', dayKey: '28', title: 'B', startQ: 44, quarters: 2, type: 'reminder' },
      { id: '3', dayKey: '29', title: 'C', startQ: 48, quarters: 2, type: 'task' },
      { id: '4', dayKey: '30', title: 'D', startQ: 52, quarters: 4, type: 'task' },
      { id: '5', dayKey: '09', title: 'E', startQ: 56, quarters: 1, type: 'task' },
      {
        id: '6',
        dayKey: '2026-12-25',
        title: 'F',
        startQ: 60,
        quarters: 2,
        type: 'task',
      },
    ];

    const normalized = normalizeLegacyEvents(legacy);
    expect(normalized.map((e) => e.dayKey)).toEqual([
      today,
      plus1,
      plus2,
      plus3,
      today,
      '2026-12-25',
    ]);
    expect(normalizeLegacyEvents([])).toEqual([]);
  });

  it('supports optional sync/lifecycle metadata on entities and snapshot contracts', () => {
    const task: PendingTask = {
      id: 'p-meta',
      title: 'Con metadatos',
      completed: false,
      isFromYesterday: false,
      rolloverDays: 0,
      createdAt: 'Hoy',
      archived: false,
      updatedAt: '2026-11-17T10:00:00.000Z',
      deletedAt: null,
      syncStatus: 'pending',
      version: 2,
    };

    const syncState: SyncState = {
      status: 'synced',
      pendingCount: 0,
      lastSyncedAt: '2026-11-17T10:00:00.000Z',
      lastError: null,
    };

    const snapshot: DayCraftSnapshot = {
      events: SEED_EVENTS,
      pendingTasks: [task],
      ideaGroups: SEED_IDEA_GROUPS,
      chatMessages: SEED_CHAT,
      alerts: SEED_ALERTS,
      lastOpenedDate: getTodayKey(),
      geminiConfig: { apiKey: '', useCloudAI: false },
      seedInitialized: true,
    };

    expect(syncState.status).toBe('synced');
    expect(snapshot.pendingTasks[0].archived).toBe(false);
    expect(snapshot.pendingTasks[0].version).toBe(2);
  });
});
