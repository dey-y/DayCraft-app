/**
 * DayCraft AI — Motor Antiestrés de Rollover Diario e Ideas Inactivas (10+ días).
 * Pure TypeScript (zero `react-native` or `expo-*` imports).
 */

import { getTodayKey, LAYOUT } from '@/constants/theme';
import type {
  AppAlert,
  IdeaGroup,
  IdeaItemData,
  PendingTask,
  RolloverEvaluationResult,
} from '@/types/daycraft';

export type { RolloverEvaluationResult };

export const STALE_IDEA_DAYS_THRESHOLD = 10;

const MS_PER_DAY = 86_400_000;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface EvaluateRolloverOptions {
  lastOpenedDate?: string | null;
  todayKey?: string;
  elapsedDays?: number;
  ideaGroups?: IdeaGroup[];
  existingAlerts?: AppAlert[];
  staleThresholdDays?: number;
}

export interface StaleIdeasEvaluationResult {
  updatedIdeaGroups: IdeaGroup[];
  staleIdeas: IdeaItemData[];
  generatedAlerts: AppAlert[];
}

function parseISODateToUTCMs(isoKey: string | null | undefined): number | null {
  if (!isoKey || typeof isoKey !== 'string') return null;
  const match = ISO_DATE_RE.exec(isoKey.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const utcMs = Date.UTC(year, month - 1, day);
  const check = new Date(utcMs);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() + 1 !== month ||
    check.getUTCDate() !== day
  ) {
    return null;
  }

  return utcMs;
}

/**
 * Calcula los días calendario transcurridos entre `lastOpenedDate` y `todayKey` en UTC
 * (inmune a cambios de horario DST y desbordamientos de calendario).
 */
export function computeElapsedDays(
  lastOpenedDate: string | null | undefined,
  todayKey: string
): number {
  const lastMs = parseISODateToUTCMs(lastOpenedDate);
  const todayMs = parseISODateToUTCMs(todayKey);
  if (lastMs === null || todayMs === null) return 0;

  const diffDays = Math.round((todayMs - lastMs) / MS_PER_DAY);
  return diffDays > 0 ? diffDays : 0;
}

function alertEntityKey(alert: AppAlert): string {
  return alert.relatedId ? `${alert.type}:${alert.relatedId}` : `id:${alert.id}`;
}

function deduplicateAlerts(alerts: AppAlert[]): AppAlert[] {
  const seen = new Set<string>();
  const out: AppAlert[] = [];
  for (const alert of alerts) {
    const key = alertEntityKey(alert);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(alert);
  }
  return out;
}

/**
 * Evalúa ideas inactivas (>= 10 días por defecto), envejece `daysInactive` según `elapsedDays`
 * y genera alertas `inactive_idea` deduplicadas por `(type, relatedId)`.
 */
export function evaluateStaleIdeas(
  ideaGroups: IdeaGroup[],
  options?: {
    elapsedDays?: number;
    existingAlerts?: AppAlert[];
    staleThresholdDays?: number;
  }
): StaleIdeasEvaluationResult {
  const rawElapsed = options?.elapsedDays ?? 0;
  const elapsedDays = Number.isFinite(rawElapsed)
    ? Math.max(0, Math.floor(rawElapsed))
    : 0;
  const threshold =
    options?.staleThresholdDays !== undefined &&
    Number.isFinite(options.staleThresholdDays)
      ? options.staleThresholdDays
      : STALE_IDEA_DAYS_THRESHOLD;

  const existingKeys = new Set<string>(
    (options?.existingAlerts ?? [])
      .filter((a) => a.type === 'inactive_idea')
      .map(alertEntityKey)
  );

  const staleIdeas: IdeaItemData[] = [];
  const generatedAlerts: AppAlert[] = [];

  const updatedIdeaGroups = ideaGroups.map((group) => {
    if (group.deletedAt) {
      return group;
    }

    const updatedItems = group.items.map((item) => {
      if (item.deletedAt) {
        return item;
      }

      const nextDaysInactive = (item.daysInactive || 0) + elapsedDays;
      const updatedItem: IdeaItemData =
        nextDaysInactive === item.daysInactive
          ? { ...item }
          : { ...item, daysInactive: nextDaysInactive };

      if (nextDaysInactive >= threshold) {
        staleIdeas.push(updatedItem);
        const alert: AppAlert = {
          id: `alert-stale-${item.id}`,
          type: 'inactive_idea',
          title: `"${item.title}"`,
          subtitle: `Lleva ${nextDaysInactive} días en el cajón sin tocarse. ¿La retomamos hoy o la archivamos?`,
          badgeText: `${nextDaysInactive} días inactiva`,
          relatedId: item.id,
        };

        const key = alertEntityKey(alert);
        if (!existingKeys.has(key)) {
          existingKeys.add(key);
          generatedAlerts.push(alert);
        }
      }

      return updatedItem;
    });

    return {
      ...group,
      items: updatedItems,
    };
  });

  return {
    updatedIdeaGroups,
    staleIdeas,
    generatedAlerts,
  };
}

/**
 * Motor Antiestrés de Rollover ("De ayer" + Regla de los 3 Días + Ideas Inactivas 10d).
 * Mantiene compatibilidad total con llamadas de 1 argumento (`evaluateDailyRollover(tasks)`),
 * asumiendo `elapsedDays = 1` cuando no se pasan `options`.
 */
export function evaluateDailyRollover(
  tasks: PendingTask[],
  options?: EvaluateRolloverOptions
): RolloverEvaluationResult {
  let elapsedDays: number;
  if (options === undefined) {
    elapsedDays = 1;
  } else if (options.elapsedDays !== undefined) {
    elapsedDays = Number.isFinite(options.elapsedDays)
      ? Math.max(0, Math.floor(options.elapsedDays))
      : 0;
  } else {
    elapsedDays = computeElapsedDays(
      options.lastOpenedDate,
      options.todayKey ?? getTodayKey()
    );
  }

  const existingAlerts = options?.existingAlerts ?? [];
  const existingRolloverByTask = new Map<string, AppAlert>();
  for (const alert of existingAlerts) {
    if (alert.type === 'rollover' && alert.relatedId) {
      existingRolloverByTask.set(alert.relatedId, alert);
    }
  }

  const updatedTasks: PendingTask[] = [];
  const threeDayRuleTriggered: PendingTask[] = [];
  const rolloverAlerts: AppAlert[] = [];
  const upgradedRolloverKeys = new Set<string>();

  if (elapsedDays === 0) {
    for (const task of tasks) {
      updatedTasks.push({ ...task });
    }
  } else {
    for (const task of tasks) {
      if (task.completed || task.archived || task.deletedAt) {
        updatedTasks.push(task);
        continue;
      }

      const nextRolloverCount = (task.rolloverDays || 0) + elapsedDays;
      const rolledTask: PendingTask = {
        ...task,
        isFromYesterday: true,
        rolloverDays: nextRolloverCount,
      };

      updatedTasks.push(rolledTask);

      if (nextRolloverCount >= LAYOUT.maxRolloverDays) {
        threeDayRuleTriggered.push(rolledTask);
        const alert3d: AppAlert = {
          id: `alert-3d-${task.id}`,
          type: 'rollover',
          title: `"${task.title}" (${nextRolloverCount} días aplazada)`,
          subtitle:
            'Regla de los 3 días: ¿La movemos al Cajón de Ideas para quitar presión o la archivamos?',
          badgeText: `${nextRolloverCount}/${LAYOUT.maxRolloverDays} días · Antiestrés`,
          relatedId: task.id,
        };

        const existing = existingRolloverByTask.get(task.id);
        if (!existing || existing.id !== alert3d.id) {
          rolloverAlerts.push(alert3d);
          upgradedRolloverKeys.add(alertEntityKey(alert3d));
        }
      } else {
        const alertRoll: AppAlert = {
          id: `alert-roll-${task.id}`,
          type: 'rollover',
          title: `"${task.title}"`,
          subtitle: `Pasó automáticamente a tus pendientes de hoy (${nextRolloverCount}/${LAYOUT.maxRolloverDays} días).`,
          badgeText: `De ayer · ${nextRolloverCount}/${LAYOUT.maxRolloverDays}`,
          relatedId: task.id,
        };

        if (!existingRolloverByTask.has(task.id)) {
          rolloverAlerts.push(alertRoll);
        }
      }
    }
  }

  const staleResult = options?.ideaGroups
    ? evaluateStaleIdeas(options.ideaGroups, {
        elapsedDays,
        existingAlerts,
        staleThresholdDays: options.staleThresholdDays,
      })
    : undefined;

  const generatedAlerts = deduplicateAlerts([
    ...rolloverAlerts,
    ...(staleResult?.generatedAlerts ?? []),
  ]);

  const inactiveTaskIds = new Set(
    updatedTasks
      .filter((t) => t.completed || t.archived || Boolean(t.deletedAt))
      .map((t) => t.id)
  );
  let activeIdeaIds: Set<string> | null = null;
  if (options?.ideaGroups) {
    activeIdeaIds = new Set<string>();
    for (const group of options.ideaGroups) {
      if (group.deletedAt) continue;
      for (const item of group.items) {
        if (!item.deletedAt) {
          activeIdeaIds.add(item.id);
        }
      }
    }
  }
  const generatedKeys = new Set(generatedAlerts.map(alertEntityKey));

  const remainingExisting = existingAlerts.filter((alert) => {
    if (alert.deletedAt) return false;
    if (
      alert.type === 'rollover' &&
      alert.relatedId &&
      inactiveTaskIds.has(alert.relatedId)
    ) {
      return false;
    }
    if (
      activeIdeaIds !== null &&
      alert.type === 'inactive_idea' &&
      alert.relatedId &&
      !activeIdeaIds.has(alert.relatedId)
    ) {
      return false;
    }
    const key = alertEntityKey(alert);
    if (upgradedRolloverKeys.has(key) || generatedKeys.has(key)) {
      return false;
    }
    return true;
  });

  const mergedAlerts = deduplicateAlerts([
    ...generatedAlerts,
    ...remainingExisting,
  ]);

  return {
    updatedTasks,
    threeDayRuleTriggered,
    generatedAlerts,
    elapsedDays,
    staleIdeasTriggered: staleResult?.staleIdeas,
    updatedIdeaGroups: staleResult?.updatedIdeaGroups,
    mergedAlerts,
  };
}

let ideaConversionCounter = 0;

/**
 * Convierte un pendiente estancado (>= 3 días) en una idea dentro de "Chispazos Libres"
 * liberando la lista de pendientes de hoy, con ID único y contenido Markdown listo para editar.
 */
export function movePendingToIdeaGroups(
  task: PendingTask,
  groups: IdeaGroup[]
): IdeaGroup[] {
  const targetGroupId = 'grp-sparks';
  ideaConversionCounter += 1;
  const newIdea: IdeaItemData = {
    id: `idea-from-pending-${Date.now()}-${ideaConversionCounter}`,
    groupId: targetGroupId,
    title: task.title,
    desc: 'Movida desde Pendientes mediante la Regla Antiestrés de los 3 días.',
    markdownContent: `# ${task.title}\n\n> Rescatada desde Pendientes tras ${task.rolloverDays || 3} días de aplazamiento.\n\n## Próximo micro-paso\n- [ ] Definir primer paso de 15 minutos para retomarla sin presión\n`,
    createdAtLabel: 'Recién rescatada',
    daysInactive: 0,
    suggestedAction: `Agendar 15m para: ${task.title}`,
  };

  const exists = groups.some((g) => g.id === targetGroupId);
  if (!exists) {
    return [
      ...groups,
      {
        id: targetGroupId,
        title: 'Chispazos Libres',
        subtitle: 'Pendientes de convertir en proyecto',
        icon: 'sparkle',
        accentColor: 'amber',
        items: [newIdea],
      },
    ];
  }

  return groups.map((g) =>
    g.id === targetGroupId ? { ...g, items: [newIdea, ...g.items] } : g
  );
}
