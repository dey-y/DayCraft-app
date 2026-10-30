import { PendingTask, IdeaGroup, AppAlert } from '../db/sqlite';
import { LAYOUT } from '@/constants/theme';

export interface RolloverEvaluationResult {
  updatedTasks: PendingTask[];
  threeDayRuleTriggered: PendingTask[];
  generatedAlerts: AppAlert[];
}

/**
 * Motor Antiestrés de Rollover ("De ayer" + Regla de los 3 Días)
 * - Las tareas sin hora no completadas pasan al día siguiente con `isFromYesterday = true`.
 * - Si una tarea acumula >= 3 días de aplazamiento consecutivo, se activa la propuesta
 *   no intrusiva para moverla al Cajón de Ideas o archivarla sin culpa.
 */
export function evaluateDailyRollover(tasks: PendingTask[]): RolloverEvaluationResult {
  const updatedTasks: PendingTask[] = [];
  const threeDayRuleTriggered: PendingTask[] = [];
  const generatedAlerts: AppAlert[] = [];

  for (const task of tasks) {
    if (task.completed) {
      updatedTasks.push(task);
      continue;
    }

    const nextRolloverCount = task.rolloverDays + 1;
    const rolledTask: PendingTask = {
      ...task,
      isFromYesterday: true,
      rolloverDays: nextRolloverCount,
    };

    updatedTasks.push(rolledTask);

    if (nextRolloverCount >= LAYOUT.maxRolloverDays) {
      threeDayRuleTriggered.push(rolledTask);
      generatedAlerts.push({
        id: `alert-3d-${task.id}`,
        type: 'rollover',
        title: `"${task.title}" (3 días aplazada)`,
        subtitle: 'Regla de los 3 días: ¿La movemos al Cajón de Ideas para quitar presión o la archivamos?',
        badgeText: '3/3 días · Antiestrés',
        relatedId: task.id,
      });
    } else {
      generatedAlerts.push({
        id: `alert-roll-${task.id}`,
        type: 'rollover',
        title: `"${task.title}"`,
        subtitle: `Pasó automáticamente a tus pendientes de hoy (${nextRolloverCount}/${LAYOUT.maxRolloverDays} días).`,
        badgeText: `De ayer · ${nextRolloverCount}/${LAYOUT.maxRolloverDays}`,
        relatedId: task.id,
      });
    }
  }

  return {
    updatedTasks,
    threeDayRuleTriggered,
    generatedAlerts,
  };
}

/**
 * Convierte un pendiente estancado (>= 3 días) en una idea dentro de "Chispazos Libres"
 * liberando la lista de pendientes de hoy.
 */
export function movePendingToIdeaGroups(
  task: PendingTask,
  groups: IdeaGroup[]
): IdeaGroup[] {
  const targetGroupId = 'grp-sparks';
  const newIdea = {
    id: `idea-from-pending-${Date.now()}`,
    groupId: targetGroupId,
    title: task.title,
    desc: 'Movida desde Pendientes mediante la Regla Antiestrés de los 3 días.',
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
