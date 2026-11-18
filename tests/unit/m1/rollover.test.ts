import { describe, expect, it } from 'vitest';
import { SEED_ALERTS, SEED_IDEA_GROUPS } from '@/services/db/sqlite';
import {
  STALE_IDEA_DAYS_THRESHOLD,
  computeElapsedDays,
  evaluateDailyRollover,
  evaluateStaleIdeas,
  movePendingToIdeaGroups,
} from '@/services/rollover/rolloverEngine';
import type { AppAlert, IdeaGroup, PendingTask } from '@/types/daycraft';

function makeTask(overrides: Partial<PendingTask> = {}): PendingTask {
  return {
    id: 'p-1',
    title: 'Enviar presupuesto',
    completed: false,
    isFromYesterday: false,
    rolloverDays: 0,
    createdAt: 'Hoy',
    ...overrides,
  };
}

describe('M1 Rollover Engine & 10-Day Stale Idea Evaluator', () => {
  describe('computeElapsedDays (UTC / DST-safe)', () => {
    it('computes 0 for same day and accurate positive deltas across months, years, and leap years', () => {
      expect(computeElapsedDays('2026-11-17', '2026-11-17')).toBe(0);
      expect(computeElapsedDays('2026-11-16', '2026-11-17')).toBe(1);
      expect(computeElapsedDays('2025-12-30', '2026-01-02')).toBe(3);
      expect(computeElapsedDays('2024-02-28', '2024-03-01')).toBe(2); // leap year
      expect(computeElapsedDays('2026-02-28', '2026-03-01')).toBe(1); // non-leap year
    });

    it('handles DST spring-forward and fall-back transitions without off-by-one drift', () => {
      // Europe/Madrid DST spring-forward: 2026-03-29
      expect(computeElapsedDays('2026-03-28', '2026-03-29')).toBe(1);
      // US DST spring-forward: 2026-03-08
      expect(computeElapsedDays('2026-03-07', '2026-03-09')).toBe(2);
      // Europe/Madrid DST fall-back: 2026-10-25
      expect(computeElapsedDays('2026-10-24', '2026-10-26')).toBe(2);
    });

    it('clamps reverse clocks and invalid or missing dates to 0', () => {
      expect(computeElapsedDays('2026-11-20', '2026-11-17')).toBe(0);
      expect(computeElapsedDays(null, '2026-11-17')).toBe(0);
      expect(computeElapsedDays(undefined, '2026-11-17')).toBe(0);
      expect(computeElapsedDays('', '2026-11-17')).toBe(0);
      expect(computeElapsedDays('2026-02-30', '2026-03-02')).toBe(0);
      expect(computeElapsedDays('bad-date', '2026-11-17')).toBe(0);
    });
  });

  describe('evaluateDailyRollover (1-arg legacy & multi-day)', () => {
    it('preserves 1-arg backward compatibility (+1 day, ignores completed, triggers 3-day rule)', () => {
      const tasks: PendingTask[] = [
        makeTask({ id: 'p-1', rolloverDays: 0 }),
        makeTask({ id: 'p-2', rolloverDays: 2 }),
        makeTask({ id: 'p-done', rolloverDays: 1, completed: true }),
      ];

      const res = evaluateDailyRollover(tasks);
      expect(res.elapsedDays).toBe(1);
      expect(res.updatedTasks[0]).toMatchObject({
        id: 'p-1',
        isFromYesterday: true,
        rolloverDays: 1,
      });
      expect(res.updatedTasks[1]).toMatchObject({
        id: 'p-2',
        isFromYesterday: true,
        rolloverDays: 3,
      });
      expect(res.updatedTasks[2]).toMatchObject({
        id: 'p-done',
        completed: true,
        rolloverDays: 1,
      });
      expect(res.threeDayRuleTriggered.map((t) => t.id)).toEqual(['p-2']);
      expect(res.generatedAlerts.map((a) => a.id)).toEqual([
        'alert-roll-p-1',
        'alert-3d-p-2',
      ]);
    });

    it('jumps rolloverDays accurately across multi-day absence and skips completed/archived/deleted tasks', () => {
      const tasks: PendingTask[] = [
        makeTask({ id: 'p-active', rolloverDays: 0 }),
        makeTask({ id: 'p-arch', rolloverDays: 1, archived: true }),
        makeTask({
          id: 'p-del',
          rolloverDays: 1,
          deletedAt: '2026-11-14T10:00:00.000Z',
        }),
      ];

      const res = evaluateDailyRollover(tasks, {
        lastOpenedDate: '2026-11-14',
        todayKey: '2026-11-17',
      });

      expect(res.elapsedDays).toBe(3);
      expect(res.updatedTasks[0].rolloverDays).toBe(3);
      expect(res.updatedTasks[0].isFromYesterday).toBe(true);
      expect(res.updatedTasks[1].rolloverDays).toBe(1);
      expect(res.updatedTasks[2].rolloverDays).toBe(1);
      expect(res.threeDayRuleTriggered.map((t) => t.id)).toEqual(['p-active']);
      expect(res.generatedAlerts.map((a) => a.id)).toEqual(['alert-3d-p-active']);
    });

    it('does not increment tasks when elapsedDays is 0', () => {
      const tasks = [makeTask({ id: 'p-0', rolloverDays: 1 })];
      const res = evaluateDailyRollover(tasks, {
        lastOpenedDate: '2026-11-17',
        todayKey: '2026-11-17',
      });
      expect(res.elapsedDays).toBe(0);
      expect(res.updatedTasks[0].rolloverDays).toBe(1);
      expect(res.threeDayRuleTriggered).toHaveLength(0);
      expect(res.generatedAlerts).toHaveLength(0);
    });
  });

  describe('evaluateStaleIdeas (10-day threshold) & Alert Deduplication', () => {
    const sampleGroups: IdeaGroup[] = [
      {
        id: 'grp-1',
        title: 'Ideas',
        subtitle: 'Test',
        icon: 'sparkle',
        accentColor: 'amber',
        items: [
          {
            id: 'idea-9',
            groupId: 'grp-1',
            title: 'Casi inactiva',
            desc: '9 días',
            createdAtLabel: 'Hace 9 días',
            daysInactive: 9,
          },
          {
            id: 'idea-10',
            groupId: 'grp-1',
            title: 'Justo 10 días',
            desc: '10 días',
            createdAtLabel: 'Hace 10 días',
            daysInactive: 10,
          },
          {
            id: 'idea-del',
            groupId: 'grp-1',
            title: 'Eliminada',
            desc: 'Borrada',
            createdAtLabel: 'Hace 20 días',
            daysInactive: 20,
            deletedAt: '2026-11-10T00:00:00.000Z',
          },
        ],
      },
    ];

    it('triggers inactive_idea alert at daysInactive >= 10 and ignores soft-deleted ideas', () => {
      expect(STALE_IDEA_DAYS_THRESHOLD).toBe(10);

      const day0 = evaluateStaleIdeas(sampleGroups, { elapsedDays: 0 });
      expect(day0.staleIdeas.map((i) => i.id)).toEqual(['idea-10']);
      expect(day0.generatedAlerts.map((a) => a.id)).toEqual([
        'alert-stale-idea-10',
      ]);

      const day1 = evaluateStaleIdeas(sampleGroups, { elapsedDays: 1 });
      expect(day1.staleIdeas.map((i) => i.id)).toEqual(['idea-9', 'idea-10']);
      expect(day1.updatedIdeaGroups[0].items[0].daysInactive).toBe(10);
      expect(day1.updatedIdeaGroups[0].items[1].daysInactive).toBe(11);
      expect(day1.generatedAlerts.map((a) => a.relatedId)).toEqual([
        'idea-9',
        'idea-10',
      ]);
    });

    it('deduplicates alerts by (type, relatedId), upgrades alert-roll to alert-3d, and respects SEED_ALERTS', () => {
      const tasks = [
        makeTask({ id: 'p-1', rolloverDays: 2 }),
        makeTask({ id: 'p-done', rolloverDays: 2, completed: true }),
      ];
      const existingAlerts: AppAlert[] = [
        {
          id: 'alert-roll-p-1',
          type: 'rollover',
          title: '"Enviar presupuesto"',
          subtitle: 'Old tier',
          badgeText: 'De ayer · 2/3',
          relatedId: 'p-1',
        },
        {
          id: 'alert-roll-p-done',
          type: 'rollover',
          title: '"Completada"',
          subtitle: 'Should be pruned',
          badgeText: 'De ayer · 2/3',
          relatedId: 'p-done',
        },
        ...SEED_ALERTS.filter((a) => a.type === 'inactive_idea'),
      ];

      const res = evaluateDailyRollover(tasks, {
        lastOpenedDate: '2026-11-16',
        todayKey: '2026-11-17',
        ideaGroups: SEED_IDEA_GROUPS,
        existingAlerts,
      });

      // alert-roll-p-1 upgraded to alert-3d-p-1 without leaving duplicate alert-roll-p-1
      expect(res.generatedAlerts.map((a) => a.id)).toEqual(['alert-3d-p-1']);
      expect(res.mergedAlerts?.map((a) => a.id)).toEqual([
        'alert-3d-p-1',
        'alert-2', // idea-5 alert from SEED_ALERTS preserved without adding alert-stale-idea-5
      ]);

      // Re-running with mergedAlerts when alert-3d-p-1 already exists emits 0 duplicate alerts
      const rerun = evaluateDailyRollover(res.updatedTasks, {
        lastOpenedDate: '2026-11-16',
        todayKey: '2026-11-17',
        ideaGroups: res.updatedIdeaGroups,
        existingAlerts: res.mergedAlerts,
      });
      expect(rerun.generatedAlerts).toEqual([]);
      expect(rerun.mergedAlerts?.map((a) => a.id)).toEqual([
        'alert-3d-p-1',
        'alert-2',
      ]);
    });
  });

  describe('movePendingToIdeaGroups', () => {
    it('creates grp-sparks when absent, prepends idea with markdownContent, and generates unique IDs', () => {
      const t1 = makeTask({ id: 'p-a', title: 'Aprender Rust', rolloverDays: 3 });
      const t2 = makeTask({ id: 'p-b', title: 'Diseñar logo', rolloverDays: 4 });

      const g1 = movePendingToIdeaGroups(t1, []);
      expect(g1).toHaveLength(1);
      expect(g1[0].id).toBe('grp-sparks');
      expect(g1[0].items[0].title).toBe('Aprender Rust');
      expect(g1[0].items[0].markdownContent).toContain('# Aprender Rust');

      const g2 = movePendingToIdeaGroups(t2, g1);
      expect(g2).toHaveLength(1);
      expect(g2[0].items).toHaveLength(2);
      expect(g2[0].items[0].title).toBe('Diseñar logo');
      expect(g2[0].items[0].id).not.toBe(g2[0].items[1].id);
    });
  });

  describe('M1 Remediation Regression Tests (NaN Guard & Soft-Deleted Idea Alert Pruning)', () => {
    it('guards non-finite elapsedDays (NaN / Infinity) by falling back to 0', () => {
      const tasks = [makeTask({ id: 'p-nan', rolloverDays: 1 })];

      const resNaN = evaluateDailyRollover(tasks, { elapsedDays: Number.NaN });
      expect(resNaN.elapsedDays).toBe(0);
      expect(resNaN.updatedTasks[0].rolloverDays).toBe(1);

      const resInf = evaluateDailyRollover(tasks, {
        elapsedDays: Number.POSITIVE_INFINITY,
      });
      expect(resInf.elapsedDays).toBe(0);
      expect(resInf.updatedTasks[0].rolloverDays).toBe(1);

      const staleRes = evaluateStaleIdeas(SEED_IDEA_GROUPS, {
        elapsedDays: Number.NaN,
      });
      expect(staleRes.updatedIdeaGroups[0].items[0].daysInactive).toBe(
        SEED_IDEA_GROUPS[0].items[0].daysInactive
      );
    });

    it('prunes inactive_idea alerts for soft-deleted ideas and soft-deleted groups when ideaGroups is supplied', () => {
      const groups: IdeaGroup[] = [
        {
          id: 'grp-active',
          title: 'Active Group',
          subtitle: 'Test',
          icon: 'folder',
          accentColor: 'indigo',
          items: [
            {
              id: 'idea-keep',
              groupId: 'grp-active',
              title: 'Keep me',
              desc: 'Active',
              createdAtLabel: 'Hace 12 días',
              daysInactive: 12,
            },
            {
              id: 'idea-soft-del',
              groupId: 'grp-active',
              title: 'Deleted idea',
              desc: 'Soft deleted',
              createdAtLabel: 'Hace 15 días',
              daysInactive: 15,
              deletedAt: '2026-11-16T00:00:00.000Z',
            },
          ],
        },
        {
          id: 'grp-deleted',
          title: 'Deleted Group',
          subtitle: 'Test',
          icon: 'folder',
          accentColor: 'amber',
          deletedAt: '2026-11-16T00:00:00.000Z',
          items: [
            {
              id: 'idea-in-del-grp',
              groupId: 'grp-deleted',
              title: 'Inside deleted group',
              desc: 'Hidden',
              createdAtLabel: 'Hace 20 días',
              daysInactive: 20,
            },
          ],
        },
      ];

      const existingAlerts: AppAlert[] = [
        {
          id: 'alert-stale-idea-keep',
          type: 'inactive_idea',
          title: '"Keep me"',
          subtitle: 'Keep',
          badgeText: '12 días inactiva',
          relatedId: 'idea-keep',
        },
        {
          id: 'alert-stale-idea-soft-del',
          type: 'inactive_idea',
          title: '"Deleted idea"',
          subtitle: 'Should prune',
          badgeText: '15 días inactiva',
          relatedId: 'idea-soft-del',
        },
        {
          id: 'alert-stale-idea-in-del-grp',
          type: 'inactive_idea',
          title: '"Inside deleted group"',
          subtitle: 'Should prune',
          badgeText: '20 días inactiva',
          relatedId: 'idea-in-del-grp',
        },
      ];

      const res = evaluateDailyRollover([], {
        elapsedDays: 0,
        ideaGroups: groups,
        existingAlerts,
      });

      expect(res.mergedAlerts?.map((a) => a.id)).toEqual([
        'alert-stale-idea-keep',
      ]);
    });
  });
});
