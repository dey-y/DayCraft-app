import { create } from 'zustand';
import {
  TimelineEvent,
  EventRecurrenceRule,
  PendingTask,
  IdeaGroup,
  IdeaItemData,
  ChatMessage,
  AppAlert,
  SEED_EVENTS,
  SEED_PENDING,
  SEED_IDEA_GROUPS,
  SEED_CHAT,
  SEED_ALERTS,
  normalizeLegacyEvents,
  initDatabase,
  loadPersistedState,
  savePersistedState,
} from '@/services/db/sqlite';
import {
  INITIAL_DAYS,
  DayInfo,
  createDayInfoFromDate,
  getTodayKey,
} from '@/constants/theme';
import { evaluateDailyRollover, movePendingToIdeaGroups } from '@/services/rollover/rolloverEngine';
import { processSmartIntake } from '@/services/ai/geminiClient';

export interface ToastPayload {
  id: string;
  title: string;
  description: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  undoActionLabel?: string;
  onUndoAction?: () => void;
}

export interface SlotPickerTarget {
  type: 'pending' | 'idea' | 'direct_hour' | 'edit_event';
  id?: string;
  title: string;
  desc?: string;
  eventType?: 'task' | 'reminder';
  defaultStartQ?: number;
  defaultQuarters?: number;
  recurrence?: EventRecurrenceRule;
}

export interface PersistedGeminiConfig {
  apiKey: string;
  useCloudAI: boolean;
}

interface DayCraftState {
  // Navegación y Layout
  days: DayInfo[];
  selectedDayKey: string;
  lastOpenedDate: string;
  sidebarOpen: boolean;
  bellDropdownOpen: boolean;
  desktopSideTab: 'agenda' | 'ai';

  // Configuración IA Gemini
  geminiApiKey: string;
  useCloudAI: boolean;

  // Datos de Dominio
  events: TimelineEvent[];
  pendingTasks: PendingTask[];
  ideaGroups: IdeaGroup[];
  chatMessages: ChatMessage[];
  alerts: AppAlert[];

  // Modales y Feedback Efímero (Toast)
  activeToast: ToastPayload | null;
  slotPickerTarget: SlotPickerTarget | null;
  activeIdeaId: string | null; // Idea abierta en el Editor/Visor Markdown (.md)
  isHydrated: boolean;

  // Acciones de Calendario y Layout
  hydrateFromSQLite: () => Promise<void>;
  setSelectedDayKey: (dayKey: string) => void;
  jumpToToday: () => void;
  shiftDay: (delta: number) => void;
  extendFutureDays: (extraDays?: number) => void;
  toggleSidebar: () => void;
  setBellDropdownOpen: (open: boolean) => void;
  setDesktopSideTab: (tab: 'agenda' | 'ai') => void;
  setActiveIdeaId: (ideaId: string | null) => void;

  // Configuración IA
  setGeminiConfig: (updates: Partial<PersistedGeminiConfig>) => void;

  // Toast Flotante Efímero
  showToast: (payload: Omit<ToastPayload, 'id'>) => void;
  hideToast: () => void;

  // Modal 1-Tap Time Blocking & Edición Completa
  openSlotPicker: (target: SlotPickerTarget) => void;
  closeSlotPicker: () => void;
  assignSlotFromPicker: (
    startQ: number,
    quarters?: number,
    customTitle?: string,
    recurrence?: EventRecurrenceRule,
    extra?: { desc?: string; eventType?: 'task' | 'reminder' }
  ) => void;

  // Timeline 24h (Snapping 15 min)
  addTimelineEvent: (event: Omit<TimelineEvent, 'id'>) => TimelineEvent;
  updateTimelineEvent: (
    id: string,
    updates: Partial<Omit<TimelineEvent, 'id'>>
  ) => void;
  toggleTimelineEventCompleted: (id: string) => void;
  removeTimelineEvent: (id: string, withUndoToast?: boolean) => void;

  // Pendientes & Rollover Antiestrés
  addPendingTask: (title: string) => PendingTask;
  togglePendingTask: (id: string) => void;
  removePendingTask: (id: string) => void;
  simulateAllPendingDone: () => void;
  triggerRolloverSimulation: () => void;
  convertStalePendingToIdea: (pendingId: string) => void;

  // Cajón de Ideas y Proyectos (.md)
  addIdeaGroup: (group: {
    title: string;
    subtitle: string;
    icon: IdeaGroup['icon'];
    accentColor: IdeaGroup['accentColor'];
  }) => IdeaGroup;
  addIdeaToGroup: (groupId: string, title: string, desc?: string) => void;
  updateIdeaMarkdown: (
    ideaId: string,
    updates: { title: string; desc: string; markdownContent: string }
  ) => void;
  removeIdea: (ideaId: string) => void;
  moveIdeaToGroup: (ideaId: string, targetGroupId: string) => void;
  dismissAlert: (alertId: string) => void;

  // Smart Intake Omnidireccional (Voz + Texto)
  submitSmartIntake: (
    rawText: string,
    options?: {
      isOnChatScreen?: boolean;
      onOpenSlotPicker?: (target: SlotPickerTarget) => void;
    }
  ) => Promise<void>;
}

export function formatQuarterToTime(q: number): string {
  const clamped = Math.max(0, Math.min(96, q));
  if (clamped === 96) return '24:00';
  const h = Math.floor(clamped / 4);
  const m = (clamped % 4) * 15;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatQuartersToDuration(quarters: number): string {
  const mins = quarters * 15;
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

/**
 * Determina si un evento (puntual o recurrente) aplica en un día específico (`DayInfo`).
 */
export function doesEventApplyToDay(event: TimelineEvent, day: DayInfo): boolean {
  if (event.dayKey === day.key || event.dayKey === day.isoDate) return true;
  if (!event.recurrence || event.recurrence.frequency === 'none') return false;

  if (event.recurrence.frequency === 'daily') {
    return true;
  }
  if (event.recurrence.frequency === 'weekly') {
    return Boolean(event.recurrence.daysOfWeek?.includes(day.dayName));
  }
  if (event.recurrence.frequency === 'monthly') {
    return event.recurrence.dayNumOfMonth === day.dayNum;
  }
  return false;
}

export const useDayCraftStore = create<DayCraftState>((set, get) => ({
  days: INITIAL_DAYS,
  selectedDayKey: getTodayKey(),
  lastOpenedDate: getTodayKey(),
  sidebarOpen: true,
  bellDropdownOpen: false,
  desktopSideTab: 'agenda',

  geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || '',
  useCloudAI: Boolean(process.env.EXPO_PUBLIC_GEMINI_API_KEY),

  events: SEED_EVENTS,
  pendingTasks: SEED_PENDING,
  ideaGroups: SEED_IDEA_GROUPS,
  chatMessages: SEED_CHAT,
  alerts: SEED_ALERTS,

  activeToast: null,
  slotPickerTarget: null,
  activeIdeaId: null,
  isHydrated: false,

  hydrateFromSQLite: async () => {
    await initDatabase();
    const todayKey = getTodayKey();

    const [
      savedEvents,
      savedPending,
      savedIdeas,
      savedChat,
      savedAlerts,
      savedLastOpenedDate,
      savedGeminiConfig,
    ] = await Promise.all([
      loadPersistedState<TimelineEvent[]>('events_v9'),
      loadPersistedState<PendingTask[]>('pending_v9'),
      loadPersistedState<IdeaGroup[]>('ideas_v9'),
      loadPersistedState<ChatMessage[]>('chat_v9'),
      loadPersistedState<AppAlert[]>('alerts_v9'),
      loadPersistedState<string>('last_opened_date_v9'),
      loadPersistedState<PersistedGeminiConfig>('gemini_config_v9'),
    ]);

    const normalizedEvents =
      savedEvents && savedEvents.length > 0
        ? normalizeLegacyEvents(savedEvents)
        : SEED_EVENTS;

    let finalPending = savedPending ? savedPending : SEED_PENDING;
    let finalAlerts = savedAlerts ? savedAlerts : SEED_ALERTS;

    // Motor Automático de Rollover Diario al abrir la app en un nuevo día real
    if (savedLastOpenedDate && savedLastOpenedDate !== todayKey) {
      const rolloverResult = evaluateDailyRollover(finalPending);
      finalPending = rolloverResult.updatedTasks;
      finalAlerts = [
        ...rolloverResult.generatedAlerts,
        ...finalAlerts.filter((a) => a.type === 'inactive_idea'),
      ];
      await Promise.all([
        savePersistedState('pending_v9', finalPending),
        savePersistedState('alerts_v9', finalAlerts),
      ]);
    }

    await savePersistedState('last_opened_date_v9', todayKey);
    if (savedEvents && savedEvents.some((e) => e.dayKey.length <= 2)) {
      await savePersistedState('events_v9', normalizedEvents);
    }

    const envKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
    const hydratedKey = savedGeminiConfig?.apiKey ?? envKey;
    const hydratedUseCloud =
      savedGeminiConfig?.useCloudAI !== undefined
        ? savedGeminiConfig.useCloudAI
        : Boolean(hydratedKey);

    set({
      selectedDayKey: todayKey,
      lastOpenedDate: todayKey,
      events: normalizedEvents,
      pendingTasks: finalPending,
      ideaGroups: savedIdeas && savedIdeas.length > 0 ? savedIdeas : SEED_IDEA_GROUPS,
      chatMessages: savedChat && savedChat.length > 0 ? savedChat : SEED_CHAT,
      alerts: finalAlerts,
      geminiApiKey: hydratedKey,
      useCloudAI: hydratedUseCloud,
      isHydrated: true,
    });
  },

  setSelectedDayKey: (dayKey) => set({ selectedDayKey: dayKey }),

  jumpToToday: () => {
    const todayKey = getTodayKey();
    set({ selectedDayKey: todayKey });
  },

  shiftDay: (delta) => {
    const { days, selectedDayKey } = get();
    const idx = days.findIndex((d) => d.key === selectedDayKey);
    if (idx === -1) return;
    if (idx + delta >= days.length - 5) {
      get().extendFutureDays(30);
    }
    const updatedDays = get().days;
    const nextIdx = Math.max(0, Math.min(updatedDays.length - 1, idx + delta));
    set({ selectedDayKey: updatedDays[nextIdx].key });
  },

  extendFutureDays: (extraDays = 30) => {
    const { days } = get();
    if (days.length === 0) return;
    const lastDay = days[days.length - 1];
    const [y, m, d] = lastDay.isoDate.split('-').map(Number);
    const additional: DayInfo[] = [];
    const now = new Date();
    for (let i = 1; i <= extraDays; i++) {
      const nextDate = new Date(y, m - 1, d + i, 12, 0, 0);
      additional.push(createDayInfoFromDate(nextDate, now));
    }
    set({ days: [...days, ...additional] });
  },

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setBellDropdownOpen: (open) => set({ bellDropdownOpen: open }),
  setDesktopSideTab: (tab) => set({ desktopSideTab: tab }),
  setActiveIdeaId: (ideaId) => set({ activeIdeaId: ideaId }),

  setGeminiConfig: (updates) => {
    set((state) => {
      const nextKey = updates.apiKey !== undefined ? updates.apiKey : state.geminiApiKey;
      const nextUseCloud =
        updates.useCloudAI !== undefined ? updates.useCloudAI : state.useCloudAI;
      const config: PersistedGeminiConfig = {
        apiKey: nextKey,
        useCloudAI: nextUseCloud,
      };
      savePersistedState('gemini_config_v9', config);
      return {
        geminiApiKey: nextKey,
        useCloudAI: nextUseCloud,
      };
    });
  },

  showToast: (payload) => {
    set({
      activeToast: {
        ...payload,
        id: `toast-${Date.now()}`,
      },
    });
  },

  hideToast: () => set({ activeToast: null }),

  openSlotPicker: (target) => set({ slotPickerTarget: target }),
  closeSlotPicker: () => set({ slotPickerTarget: null }),

  assignSlotFromPicker: (startQ, quarters = 2, customTitle, recurrence, extra) => {
    const { slotPickerTarget, selectedDayKey, pendingTasks } = get();
    const title = customTitle?.trim() || slotPickerTarget?.title || 'Bloque enfocado';
    const dayKey = selectedDayKey || getTodayKey();

    // Si estamos editando un bloque existente en el Timeline 24h
    if (slotPickerTarget?.type === 'edit_event' && slotPickerTarget.id) {
      const targetId = slotPickerTarget.id;
      const prevEvent = get().events.find((e) => e.id === targetId);
      const nextType = extra?.eventType || slotPickerTarget.eventType || prevEvent?.type || 'task';
      const nextDesc =
        extra?.desc !== undefined
          ? extra.desc
          : slotPickerTarget.desc !== undefined
          ? slotPickerTarget.desc
          : prevEvent?.desc;

      get().updateTimelineEvent(targetId, {
        title,
        desc: nextDesc,
        startQ,
        quarters,
        type: nextType,
        recurrence: recurrence && recurrence.frequency !== 'none' ? recurrence : undefined,
      });

      set({ slotPickerTarget: null });
      return;
    }

    const nextType = extra?.eventType || slotPickerTarget?.eventType || 'task';
    const nextDesc =
      extra?.desc !== undefined && extra.desc.trim().length > 0
        ? extra.desc.trim()
        : slotPickerTarget?.type === 'pending'
        ? 'Fijado desde Pendientes de hoy'
        : slotPickerTarget?.type === 'idea'
        ? 'Paso agendado desde Cajón de Ideas'
        : nextType === 'reminder'
        ? 'Recordatorio puntual en Timeline'
        : 'Bloque enfocado en Timeline';

    const createdEvent = get().addTimelineEvent({
      dayKey,
      title,
      desc: nextDesc,
      startQ,
      quarters,
      type: nextType,
      tag:
        slotPickerTarget?.type === 'idea'
          ? 'Idea en acción'
          : nextType === 'reminder'
          ? 'Recordatorio'
          : 'Enfoque',
      recurrence:
        recurrence && recurrence.frequency !== 'none' ? recurrence : undefined,
    });

    // Si provenía de un pendiente sin hora, lo removemos de Pendientes
    let removedPending: PendingTask | undefined;
    if (slotPickerTarget?.type === 'pending' && slotPickerTarget.id) {
      removedPending = pendingTasks.find((p) => p.id === slotPickerTarget.id);
      get().removePendingTask(slotPickerTarget.id);
    }

    set({ slotPickerTarget: null });

    const startTimeStr = formatQuarterToTime(startQ);
    get().showToast({
      title: 'Fijado en Timeline 24h',
      description: `"${title}" a las ${startTimeStr}`,
      undoActionLabel: 'Deshacer',
      onUndoAction: () => {
        get().removeTimelineEvent(createdEvent.id, false);
        if (removedPending) {
          set((s) => {
            const restored = [removedPending!, ...s.pendingTasks];
            savePersistedState('pending_v9', restored);
            return { pendingTasks: restored };
          });
        }
      },
    });
  },

  addTimelineEvent: (eventData) => {
    const newEvent: TimelineEvent = {
      ...eventData,
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    set((state) => {
      const updated = [...state.events, newEvent].sort((a, b) => a.startQ - b.startQ);
      savePersistedState('events_v9', updated);
      return { events: updated };
    });
    return newEvent;
  },

  updateTimelineEvent: (id, updates) => {
    const prevEvent = get().events.find((e) => e.id === id);
    if (!prevEvent) return;

    set((state) => {
      const updated = state.events
        .map((e) => (e.id === id ? { ...e, ...updates } : e))
        .sort((a, b) => a.startQ - b.startQ);
      savePersistedState('events_v9', updated);
      return { events: updated };
    });

    const nextTitle = updates.title || prevEvent.title;
    const nextStartQ = updates.startQ !== undefined ? updates.startQ : prevEvent.startQ;
    get().showToast({
      title: 'Bloque actualizado',
      description: `"${nextTitle}" (${formatQuarterToTime(nextStartQ)})`,
      undoActionLabel: 'Deshacer',
      onUndoAction: () => {
        set((state) => {
          const reverted = state.events
            .map((e) => (e.id === id ? prevEvent : e))
            .sort((a, b) => a.startQ - b.startQ);
          savePersistedState('events_v9', reverted);
          return { events: reverted };
        });
      },
    });
  },

  toggleTimelineEventCompleted: (id) => {
    const ev = get().events.find((e) => e.id === id);
    if (!ev) return;
    const nextCompleted = !ev.completed;

    set((state) => {
      const updated = state.events.map((e) =>
        e.id === id ? { ...e, completed: nextCompleted } : e
      );
      savePersistedState('events_v9', updated);
      return { events: updated };
    });

    if (nextCompleted) {
      get().showToast({
        title: 'Bloque completado',
        description: `"${ev.title}"`,
        undoActionLabel: 'Deshacer',
        onUndoAction: () => {
          set((state) => {
            const reverted = state.events.map((e) =>
              e.id === id ? { ...e, completed: false } : e
            );
            savePersistedState('events_v9', reverted);
            return { events: reverted };
          });
        },
      });
    }
  },

  removeTimelineEvent: (id, withUndoToast = true) => {
    const target = get().events.find((e) => e.id === id);
    set((state) => {
      const updated = state.events.filter((e) => e.id !== id);
      savePersistedState('events_v9', updated);
      return { events: updated };
    });

    if (withUndoToast && target) {
      get().showToast({
        title: 'Bloque eliminado',
        description: `"${target.title}"`,
        undoActionLabel: 'Deshacer',
        onUndoAction: () => {
          set((state) => {
            const restored = [...state.events, target].sort((a, b) => a.startQ - b.startQ);
            savePersistedState('events_v9', restored);
            return { events: restored };
          });
        },
      });
    }
  },

  addPendingTask: (title) => {
    const newTask: PendingTask = {
      id: `pending-${Date.now()}`,
      title,
      completed: false,
      isFromYesterday: false,
      rolloverDays: 0,
      createdAt: 'Hoy',
    };
    set((state) => {
      const updated = [newTask, ...state.pendingTasks];
      savePersistedState('pending_v9', updated);
      return { pendingTasks: updated };
    });
    return newTask;
  },

  togglePendingTask: (id) => {
    const task = get().pendingTasks.find((t) => t.id === id);
    if (!task) return;
    const nextCompleted = !task.completed;

    set((state) => {
      const updated = state.pendingTasks.map((t) =>
        t.id === id ? { ...t, completed: nextCompleted } : t
      );
      savePersistedState('pending_v9', updated);
      return { pendingTasks: updated };
    });

    if (nextCompleted) {
      get().showToast({
        title: 'Pendiente completado',
        description: `"${task.title}"`,
        undoActionLabel: 'Deshacer',
        onUndoAction: () => {
          set((state) => {
            const reverted = state.pendingTasks.map((t) =>
              t.id === id ? { ...t, completed: false } : t
            );
            savePersistedState('pending_v9', reverted);
            return { pendingTasks: reverted };
          });
        },
      });
    }
  },

  removePendingTask: (id) => {
    set((state) => {
      const updated = state.pendingTasks.filter((t) => t.id !== id);
      savePersistedState('pending_v9', updated);
      return { pendingTasks: updated };
    });
  },

  simulateAllPendingDone: () => {
    const { pendingTasks } = get();
    const allCompleted = pendingTasks.length > 0 && pendingTasks.every((t) => t.completed);
    set((state) => {
      const updated = state.pendingTasks.map((t) => ({
        ...t,
        completed: !allCompleted,
      }));
      savePersistedState('pending_v9', updated);
      return { pendingTasks: updated };
    });
  },

  triggerRolloverSimulation: () => {
    const { pendingTasks, alerts } = get();
    const result = evaluateDailyRollover(pendingTasks);
    const nextAlerts = [
      ...result.generatedAlerts,
      ...alerts.filter((a) => a.type === 'inactive_idea'),
    ];
    savePersistedState('pending_v9', result.updatedTasks);
    savePersistedState('alerts_v9', nextAlerts);
    set({
      pendingTasks: result.updatedTasks,
      alerts: nextAlerts,
    });
  },

  convertStalePendingToIdea: (pendingId) => {
    const { pendingTasks, ideaGroups, alerts } = get();
    const target = pendingTasks.find((t) => t.id === pendingId);
    if (!target) return;

    const updatedGroups = movePendingToIdeaGroups(target, ideaGroups);
    const updatedPending = pendingTasks.filter((t) => t.id !== pendingId);
    const updatedAlerts = alerts.filter((a) => a.relatedId !== pendingId);

    savePersistedState('ideas_v9', updatedGroups);
    savePersistedState('pending_v9', updatedPending);
    savePersistedState('alerts_v9', updatedAlerts);

    set({
      ideaGroups: updatedGroups,
      pendingTasks: updatedPending,
      alerts: updatedAlerts,
    });

    get().showToast({
      title: 'Movido al Cajón de Ideas',
      description: `"${target.title}" libre de presión`,
    });
  },

  addIdeaGroup: ({ title, subtitle, icon, accentColor }) => {
    const newGroup: IdeaGroup = {
      id: `grp-${Date.now()}`,
      title: title.trim() || 'Nuevo Proyecto',
      subtitle: subtitle.trim() || 'Notas y recursos del proyecto',
      icon,
      accentColor,
      items: [],
    };
    set((state) => {
      const updated = [newGroup, ...state.ideaGroups];
      savePersistedState('ideas_v9', updated);
      return { ideaGroups: updated };
    });
    get().showToast({
      title: 'Proyecto creado',
      description: `"${newGroup.title}" listo en el Cajón de Ideas`,
    });
    return newGroup;
  },

  addIdeaToGroup: (groupId, title, desc = 'Idea capturada con IA y auto-agrupada.') => {
    const newId = `idea-${Date.now()}`;
    const defaultMd = `# ${title}\n\n${desc}\n\n## Pasos Siguientes\n- [ ] Definir primer bloque de enfoque en el Timeline 24h\n- [ ] Anotar recursos y referencias\n`;
    set((state) => {
      const targetExists = state.ideaGroups.some((g) => g.id === groupId);
      const effectiveGroupId = targetExists
        ? groupId
        : state.ideaGroups[0]?.id || 'grp-sparks';

      const newIdea: IdeaItemData = {
        id: newId,
        groupId: effectiveGroupId,
        title,
        desc,
        markdownContent: defaultMd,
        createdAtLabel: 'Ahora',
        daysInactive: 0,
        suggestedAction: `Explorar: ${title}`,
      };
      const updated = state.ideaGroups.map((g) =>
        g.id === effectiveGroupId ? { ...g, items: [newIdea, ...g.items] } : g
      );
      savePersistedState('ideas_v9', updated);
      return { ideaGroups: updated };
    });
  },

  updateIdeaMarkdown: (ideaId, updates) => {
    set((state) => {
      const updatedGroups = state.ideaGroups.map((group) => ({
        ...group,
        items: group.items.map((item) =>
          item.id === ideaId
            ? {
                ...item,
                title: updates.title,
                desc: updates.desc,
                markdownContent: updates.markdownContent,
                createdAtLabel: 'Editado ahora',
              }
            : item
        ),
      }));
      savePersistedState('ideas_v9', updatedGroups);
      return { ideaGroups: updatedGroups };
    });
    get().showToast({
      title: 'Nota .md guardada',
      description: `"${updates.title}" actualizada en SQLite`,
    });
  },

  removeIdea: (ideaId) => {
    const { ideaGroups } = get();
    let removedIdea: IdeaItemData | null = null;
    let sourceGroupId: string | null = null;

    for (const grp of ideaGroups) {
      const found = grp.items.find((it) => it.id === ideaId);
      if (found) {
        removedIdea = found;
        sourceGroupId = grp.id;
        break;
      }
    }

    if (!removedIdea || !sourceGroupId) return;

    set((state) => {
      const updatedGroups = state.ideaGroups.map((g) =>
        g.id === sourceGroupId
          ? { ...g, items: g.items.filter((it) => it.id !== ideaId) }
          : g
      );
      savePersistedState('ideas_v9', updatedGroups);
      return {
        ideaGroups: updatedGroups,
        activeIdeaId: state.activeIdeaId === ideaId ? null : state.activeIdeaId,
      };
    });

    const backupIdea = removedIdea;
    const backupGroupId = sourceGroupId;
    get().showToast({
      title: 'Nota .md eliminada',
      description: `"${backupIdea.title}"`,
      undoActionLabel: 'Deshacer',
      onUndoAction: () => {
        set((state) => {
          const restored = state.ideaGroups.map((g) =>
            g.id === backupGroupId ? { ...g, items: [backupIdea, ...g.items] } : g
          );
          savePersistedState('ideas_v9', restored);
          return { ideaGroups: restored };
        });
      },
    });
  },

  moveIdeaToGroup: (ideaId, targetGroupId) => {
    const { ideaGroups } = get();
    let ideaToMove: IdeaItemData | null = null;
    let currentGroupId: string | null = null;

    for (const grp of ideaGroups) {
      const found = grp.items.find((it) => it.id === ideaId);
      if (found) {
        ideaToMove = found;
        currentGroupId = grp.id;
        break;
      }
    }

    if (!ideaToMove || !currentGroupId || currentGroupId === targetGroupId) return;
    const targetGroup = ideaGroups.find((g) => g.id === targetGroupId);
    if (!targetGroup) return;

    const updatedIdea: IdeaItemData = {
      ...ideaToMove,
      groupId: targetGroupId,
    };

    set((state) => {
      const updatedGroups = state.ideaGroups.map((g) => {
        if (g.id === currentGroupId) {
          return { ...g, items: g.items.filter((it) => it.id !== ideaId) };
        }
        if (g.id === targetGroupId) {
          return { ...g, items: [updatedIdea, ...g.items] };
        }
        return g;
      });
      savePersistedState('ideas_v9', updatedGroups);
      return { ideaGroups: updatedGroups };
    });

    get().showToast({
      title: 'Idea movida de proyecto',
      description: `Ahora en "${targetGroup.title}"`,
    });
  },

  dismissAlert: (alertId) => {
    set((state) => {
      const updated = state.alerts.filter((a) => a.id !== alertId);
      savePersistedState('alerts_v9', updated);
      return { alerts: updated };
    });
  },

  submitSmartIntake: async (rawText, options) => {
    const trimmed = rawText.trim();
    if (!trimmed) return;

    const { selectedDayKey, geminiApiKey, useCloudAI, ideaGroups } = get();
    const nowTime = new Date().toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const userMsg: ChatMessage = {
      id: `msg-u-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: nowTime,
    };

    set((state) => {
      const updatedChat = [...state.chatMessages, userMsg];
      savePersistedState('chat_v9', updatedChat);
      return { chatMessages: updatedChat };
    });

    const parsed = await processSmartIntake(trimmed, selectedDayKey, {
      apiKey: geminiApiKey,
      useCloudAI,
      ideaGroups,
    });

    let classifiedBadge: ChatMessage['classifiedItems'] = undefined;

    if (parsed.kind === 'pending') {
      const createdTask = get().addPendingTask(parsed.title);
      classifiedBadge = [
        {
          type: 'pending',
          title: parsed.title,
          meta: 'Para hoy (Sin hora fija)',
        },
      ];

      if (!options?.isOnChatScreen) {
        get().showToast({
          title: 'Añadido a Pendientes',
          description: `"${parsed.title}"`,
          primaryActionLabel: 'Fijar hora',
          onPrimaryAction: () => {
            const target: SlotPickerTarget = {
              type: 'pending',
              id: createdTask.id,
              title: createdTask.title,
            };
            if (options?.onOpenSlotPicker) {
              options.onOpenSlotPicker(target);
            } else {
              get().openSlotPicker(target);
            }
          },
          undoActionLabel: 'Deshacer',
          onUndoAction: () => {
            get().removePendingTask(createdTask.id);
          },
        });
      }
    } else if (parsed.kind === 'event' || parsed.kind === 'reminder') {
      const startQ = parsed.startQ ?? 48; // 12:00 fallback
      const quarters = parsed.quarters ?? 2;
      const dayKey = parsed.dayKey || selectedDayKey;
      const createdEv = get().addTimelineEvent({
        dayKey,
        title: parsed.title,
        desc: parsed.desc,
        startQ,
        quarters,
        type: parsed.kind === 'reminder' ? 'reminder' : 'task',
        tag: parsed.kind === 'reminder' ? 'Recordatorio' : 'IA Smart Intake',
      });

      // Si el evento se agendó en otro día, saltamos suavemente o mostramos la fecha
      const matchedDay = get().days.find((d) => d.key === dayKey);
      const dayLabel = matchedDay
        ? matchedDay.isToday
          ? 'Hoy'
          : `${matchedDay.dayName} ${matchedDay.dayNum}`
        : dayKey;

      const timeLabel = formatQuarterToTime(startQ);
      classifiedBadge = [
        {
          type: parsed.kind,
          title: parsed.title,
          meta: `${dayLabel} · ${timeLabel}`,
        },
      ];

      if (!options?.isOnChatScreen) {
        get().showToast({
          title: parsed.kind === 'reminder' ? 'Recordatorio Fijado' : 'Agendado en Timeline',
          description: `"${parsed.title}" (${dayLabel} · ${timeLabel})`,
          undoActionLabel: 'Deshacer',
          onUndoAction: () => {
            get().removeTimelineEvent(createdEv.id, false);
          },
        });
      }
    } else if (parsed.kind === 'idea') {
      const groupId = parsed.ideaGroupId || 'grp-sparks';
      get().addIdeaToGroup(groupId, parsed.title, parsed.desc);
      const targetGroup = get().ideaGroups.find((g) => g.id === groupId);
      classifiedBadge = [
        {
          type: 'idea',
          title: parsed.title,
          meta: targetGroup ? targetGroup.title : 'Cajón de Ideas (Auto-IA)',
        },
      ];

      if (!options?.isOnChatScreen) {
        get().showToast({
          title: 'Guardado en Cajón de Ideas',
          description: `"${parsed.title}"`,
          primaryActionLabel: 'Fijar hora',
          onPrimaryAction: () => {
            get().openSlotPicker({
              type: 'idea',
              title: parsed.title,
            });
          },
        });
      }
    } else if (parsed.kind === 'question') {
      // Si es una pregunta en desktop, abrimos el tab de IA automáticamente
      set({ desktopSideTab: 'ai' });
      if (!options?.isOnChatScreen) {
        get().showToast({
          title: 'Asistente IA Gemini',
          description: parsed.aiReply,
        });
      }
    }

    const aiMsg: ChatMessage = {
      id: `msg-a-${Date.now() + 1}`,
      role: 'assistant',
      text: parsed.aiReply,
      timestamp: nowTime,
      classifiedItems: classifiedBadge,
    };

    set((state) => {
      const updatedChat = [...state.chatMessages, aiMsg];
      savePersistedState('chat_v9', updatedChat);
      return { chatMessages: updatedChat };
    });
  },
}));
