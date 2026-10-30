import { create } from 'zustand';
import {
  TimelineEvent,
  PendingTask,
  IdeaGroup,
  ChatMessage,
  AppAlert,
  SEED_EVENTS,
  SEED_PENDING,
  SEED_IDEA_GROUPS,
  SEED_CHAT,
  SEED_ALERTS,
  initDatabase,
  loadPersistedState,
  savePersistedState,
} from '@/services/db/sqlite';
import { INITIAL_DAYS, DayInfo } from '@/constants/theme';
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
  type: 'pending' | 'idea' | 'direct_hour';
  id?: string;
  title: string;
  defaultStartQ?: number;
}

interface DayCraftState {
  // Navegación y Layout
  days: DayInfo[];
  selectedDayKey: string;
  sidebarOpen: boolean;
  bellDropdownOpen: boolean;
  desktopSideTab: 'agenda' | 'ai';

  // Datos de Dominio
  events: TimelineEvent[];
  pendingTasks: PendingTask[];
  ideaGroups: IdeaGroup[];
  chatMessages: ChatMessage[];
  alerts: AppAlert[];

  // Modales y Feedback Efímero (Toast)
  activeToast: ToastPayload | null;
  slotPickerTarget: SlotPickerTarget | null;
  isHydrated: boolean;

  // Acciones
  hydrateFromSQLite: () => Promise<void>;
  setSelectedDayKey: (dayKey: string) => void;
  shiftDay: (delta: number) => void;
  toggleSidebar: () => void;
  setBellDropdownOpen: (open: boolean) => void;
  setDesktopSideTab: (tab: 'agenda' | 'ai') => void;

  // Toast Flotante Efímero
  showToast: (payload: Omit<ToastPayload, 'id'>) => void;
  hideToast: () => void;

  // Modal 1-Tap Time Blocking
  openSlotPicker: (target: SlotPickerTarget) => void;
  closeSlotPicker: () => void;
  assignSlotFromPicker: (startQ: number, quarters?: number, customTitle?: string) => void;

  // Timeline 24h (Snapping 15 min)
  addTimelineEvent: (event: Omit<TimelineEvent, 'id'>) => TimelineEvent;
  removeTimelineEvent: (id: string) => void;

  // Pendientes & Rollover Antiestrés
  addPendingTask: (title: string) => PendingTask;
  togglePendingTask: (id: string) => void;
  removePendingTask: (id: string) => void;
  simulateAllPendingDone: () => void;
  triggerRolloverSimulation: () => void;
  convertStalePendingToIdea: (pendingId: string) => void;

  // Cajón de Ideas
  addIdeaToGroup: (groupId: string, title: string, desc?: string) => void;
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

export const useDayCraftStore = create<DayCraftState>((set, get) => ({
  days: INITIAL_DAYS,
  selectedDayKey: '27',
  sidebarOpen: true,
  bellDropdownOpen: false,
  desktopSideTab: 'agenda',

  events: SEED_EVENTS,
  pendingTasks: SEED_PENDING,
  ideaGroups: SEED_IDEA_GROUPS,
  chatMessages: SEED_CHAT,
  alerts: SEED_ALERTS,

  activeToast: null,
  slotPickerTarget: null,
  isHydrated: false,

  hydrateFromSQLite: async () => {
    await initDatabase();
    const [savedEvents, savedPending, savedIdeas, savedChat] = await Promise.all([
      loadPersistedState<TimelineEvent[]>('events_v9'),
      loadPersistedState<PendingTask[]>('pending_v9'),
      loadPersistedState<IdeaGroup[]>('ideas_v9'),
      loadPersistedState<ChatMessage[]>('chat_v9'),
    ]);

    set({
      events: savedEvents && savedEvents.length > 0 ? savedEvents : SEED_EVENTS,
      pendingTasks: savedPending ? savedPending : SEED_PENDING,
      ideaGroups: savedIdeas && savedIdeas.length > 0 ? savedIdeas : SEED_IDEA_GROUPS,
      chatMessages: savedChat && savedChat.length > 0 ? savedChat : SEED_CHAT,
      isHydrated: true,
    });
  },

  setSelectedDayKey: (dayKey) => set({ selectedDayKey: dayKey }),

  shiftDay: (delta) => {
    const { days, selectedDayKey } = get();
    const idx = days.findIndex((d) => d.key === selectedDayKey);
    if (idx === -1) return;
    const nextIdx = Math.max(0, Math.min(days.length - 1, idx + delta));
    set({ selectedDayKey: days[nextIdx].key });
  },

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setBellDropdownOpen: (open) => set({ bellDropdownOpen: open }),
  setDesktopSideTab: (tab) => set({ desktopSideTab: tab }),

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

  assignSlotFromPicker: (startQ, quarters = 2, customTitle) => {
    const { slotPickerTarget, selectedDayKey, pendingTasks } = get();
    const title = customTitle || slotPickerTarget?.title || 'Bloque enfocado';
    const dayKey = selectedDayKey || '27';

    const createdEvent = get().addTimelineEvent({
      dayKey,
      title,
      desc:
        slotPickerTarget?.type === 'pending'
          ? 'Fijado desde Pendientes de hoy'
          : slotPickerTarget?.type === 'idea'
          ? 'Paso agendado desde Cajón de Ideas'
          : 'Bloque enfocado en Timeline',
      startQ,
      quarters,
      type: 'task',
      tag: slotPickerTarget?.type === 'idea' ? 'Idea en acción' : 'Enfoque',
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
        get().removeTimelineEvent(createdEvent.id);
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

  removeTimelineEvent: (id) => {
    set((state) => {
      const updated = state.events.filter((e) => e.id !== id);
      savePersistedState('events_v9', updated);
      return { events: updated };
    });
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
    savePersistedState('pending_v9', result.updatedTasks);
    set({
      pendingTasks: result.updatedTasks,
      alerts: [...result.generatedAlerts, ...alerts.filter((a) => a.type === 'inactive_idea')],
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

  addIdeaToGroup: (groupId, title, desc = 'Idea capturada con IA y auto-agrupada.') => {
    set((state) => {
      const newIdea = {
        id: `idea-${Date.now()}`,
        groupId,
        title,
        desc,
        createdAtLabel: 'Ahora',
        daysInactive: 0,
        suggestedAction: `Explorar: ${title}`,
      };
      const updated = state.ideaGroups.map((g) =>
        g.id === groupId ? { ...g, items: [newIdea, ...g.items] } : g
      );
      savePersistedState('ideas_v9', updated);
      return { ideaGroups: updated };
    });
  },

  dismissAlert: (alertId) => {
    set((state) => ({
      alerts: state.alerts.filter((a) => a.id !== alertId),
    }));
  },

  submitSmartIntake: async (rawText, options) => {
    const trimmed = rawText.trim();
    if (!trimmed) return;

    const { selectedDayKey } = get();
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

    const parsed = await processSmartIntake(trimmed, selectedDayKey);

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
          title: '✨ Añadido a Pendientes',
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

      const timeLabel = formatQuarterToTime(startQ);
      classifiedBadge = [
        {
          type: parsed.kind,
          title: parsed.title,
          meta: `Día ${dayKey} · ${timeLabel}`,
        },
      ];

      if (!options?.isOnChatScreen) {
        get().showToast({
          title: parsed.kind === 'reminder' ? '✨ Recordatorio Fijado' : '✨ Agendado en Timeline',
          description: `"${parsed.title}" (${timeLabel})`,
          undoActionLabel: 'Deshacer',
          onUndoAction: () => {
            get().removeTimelineEvent(createdEv.id);
          },
        });
      }
    } else if (parsed.kind === 'idea') {
      const groupId = parsed.ideaGroupId || 'grp-sparks';
      get().addIdeaToGroup(groupId, parsed.title, parsed.desc);
      classifiedBadge = [
        {
          type: 'idea',
          title: parsed.title,
          meta: 'Cajón de Ideas (Auto-IA)',
        },
      ];

      if (!options?.isOnChatScreen) {
        get().showToast({
          title: '✨ Guardado en Cajón de Ideas',
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
