import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useDayCraftStore } from '@/store/useDayCraftStore';
import { useTheme } from '@/store/useThemeStore';
import { NotionIcon } from '@/components/ui/NotionIcon';
import { getTodayKey } from '@/constants/theme';
import type { SyncStatusKind } from '@/types/daycraft';

function formatQuarterTime(startQ: number): string {
  const totalMinutes = startQ * 15;
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const mm = String(totalMinutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function getSyncStatusMeta(status: SyncStatusKind): {
  label: string;
  toneClass: string;
  dotClass: string;
} {
  switch (status) {
    case 'syncing':
      return {
        label: 'Sincronizando...',
        toneClass: 'text-accent-soft',
        dotClass: 'bg-accent-soft',
      };
    case 'synced':
      return {
        label: 'Sincronizado',
        toneClass: 'text-ok',
        dotClass: 'bg-ok',
      };
    case 'error':
      return {
        label: 'Error Sync',
        toneClass: 'text-warm',
        dotClass: 'bg-warm',
      };
    case 'offline':
    default:
      return {
        label: 'Offline SQLite',
        toneClass: 'text-muted',
        dotClass: 'bg-ok',
      };
  }
}

interface GlobalSearchModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * GlobalSearchModal — Omni Search (Ctrl+K) across Timeline Events, Pending Tasks, and .md Ideas.
 * Uses only Kuro-Zen semantic tokens, >= 12px typography, and >= 44px touch targets.
 */
export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  visible,
  onClose,
}) => {
  const { colors } = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');

  const events = useDayCraftStore((s) => s.events);
  const pendingTasks = useDayCraftStore((s) => s.pendingTasks);
  const ideaGroups = useDayCraftStore((s) => s.ideaGroups);
  const setSelectedDayKey = useDayCraftStore((s) => s.setSelectedDayKey);
  const setActiveIdeaId = useDayCraftStore((s) => s.setActiveIdeaId);
  const togglePendingTask = useDayCraftStore((s) => s.togglePendingTask);
  const openSlotPicker = useDayCraftStore((s) => s.openSlotPicker);

  useEffect(() => {
    if (!visible) {
      setQuery('');
    }
  }, [visible]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible, onClose]);

  const normalizedQuery = query.trim().toLowerCase();

  const matchedEvents = useMemo(() => {
    const list = normalizedQuery
      ? events.filter(
          (ev) =>
            ev.title.toLowerCase().includes(normalizedQuery) ||
            (ev.desc && ev.desc.toLowerCase().includes(normalizedQuery)) ||
            ev.dayKey.toLowerCase().includes(normalizedQuery)
        )
      : events;
    return list.slice(0, 6);
  }, [events, normalizedQuery]);

  const matchedPending = useMemo(() => {
    const list = normalizedQuery
      ? pendingTasks.filter((t) =>
          t.title.toLowerCase().includes(normalizedQuery)
        )
      : pendingTasks;
    return list.slice(0, 6);
  }, [pendingTasks, normalizedQuery]);

  const matchedIdeas = useMemo(() => {
    const flatIdeas = ideaGroups.flatMap((grp) =>
      grp.items.map((item) => ({
        item,
        groupTitle: grp.title.replace('Proyecto: ', ''),
      }))
    );
    const list = normalizedQuery
      ? flatIdeas.filter(
          ({ item, groupTitle }) =>
            item.title.toLowerCase().includes(normalizedQuery) ||
            item.desc.toLowerCase().includes(normalizedQuery) ||
            (item.markdownContent ?? '').toLowerCase().includes(normalizedQuery) ||
            groupTitle.toLowerCase().includes(normalizedQuery)
        )
      : flatIdeas;
    return list.slice(0, 6);
  }, [ideaGroups, normalizedQuery]);

  const totalMatches =
    matchedEvents.length + matchedPending.length + matchedIdeas.length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        className="flex-1 bg-canvas/85 justify-start items-center p-4 pt-14"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="bg-card border border-line rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl max-h-[82%]"
        >
          {/* Search Input Header */}
          <View className="flex-row items-center gap-2.5 px-4 py-3 border-b border-line-subtle bg-header">
            <NotionIcon name="search" size={16} color={colors.accentSoft} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              autoFocus
              placeholder="Buscar eventos, pendientes o notas .md..."
              placeholderTextColor={colors.muted}
              className="flex-1 text-sm font-medium text-ink min-h-[44px]"
            />
            {query.length > 0 ? (
              <Pressable
                onPress={() => setQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Limpiar búsqueda"
                className="min-w-[44px] min-h-[44px] items-center justify-center rounded-xl bg-raised border border-line"
              >
                <NotionIcon name="close" size={14} color={colors.muted} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cerrar buscador"
              className="min-w-[44px] min-h-[44px] px-3 items-center justify-center rounded-xl bg-raised border border-line"
            >
              <Text className="text-xs font-mono text-muted">Esc</Text>
            </Pressable>
          </View>

          {/* Quick Jump Shortcuts */}
          <View className="flex-row flex-wrap items-center gap-2 px-4 py-2.5 border-b border-line-subtle bg-card">
            <Pressable
              onPress={() => {
                setSelectedDayKey(getTodayKey());
                onClose();
                router.push('/');
              }}
              className="min-h-[44px] px-3 rounded-xl bg-raised border border-line flex-row items-center gap-1.5"
            >
              <NotionIcon name="clock" size={13} color={colors.accentSoft} />
              <Text className="text-xs font-semibold text-ink">Ir a Hoy</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                onClose();
                router.push('/pending');
              }}
              className="min-h-[44px] px-3 rounded-xl bg-raised border border-line flex-row items-center gap-1.5"
            >
              <NotionIcon name="checkbox-checked" size={13} color={colors.warm} />
              <Text className="text-xs font-semibold text-ink">Pendientes</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                onClose();
                router.push('/ideas');
              }}
              className="min-h-[44px] px-3 rounded-xl bg-raised border border-line flex-row items-center gap-1.5"
            >
              <NotionIcon name="lightbulb" size={13} color={colors.ok} />
              <Text className="text-xs font-semibold text-ink">Ideas .md</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                onClose();
                router.push('/chat');
              }}
              className="min-h-[44px] px-3 rounded-xl bg-raised border border-line flex-row items-center gap-1.5"
            >
              <NotionIcon name="chat" size={13} color={colors.accentSoft} />
              <Text className="text-xs font-semibold text-ink">Asistente IA</Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 16, gap: 16 }}
          >
            {totalMatches === 0 ? (
              <View className="py-8 items-center justify-center gap-2">
                <NotionIcon name="search" size={22} color={colors.muted} />
                <Text className="text-sm font-semibold text-ink">
                  Sin resultados para &ldquo;{query}&rdquo;
                </Text>
                <Text className="text-xs text-muted text-center">
                  Prueba con otro término de evento, pendiente o nota Markdown.
                </Text>
              </View>
            ) : null}

            {/* Eventos / Timeline */}
            {matchedEvents.length > 0 ? (
              <View className="gap-2">
                <Text className="text-xs uppercase tracking-wider font-bold text-muted px-1">
                  Eventos / Timeline ({matchedEvents.length})
                </Text>
                {matchedEvents.map((ev) => (
                  <Pressable
                    key={ev.id}
                    onPress={() => {
                      setSelectedDayKey(ev.dayKey);
                      onClose();
                      router.push('/');
                    }}
                    className="min-h-[44px] p-3 rounded-xl bg-raised border border-line flex-row items-center justify-between gap-3 active:border-ink"
                  >
                    <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
                      <NotionIcon name="calendar" size={15} color={colors.accentSoft} />
                      <View className="flex-1 min-w-0">
                        <Text
                          numberOfLines={1}
                          className="text-sm font-semibold text-ink"
                        >
                          {ev.title}
                        </Text>
                        <Text
                          numberOfLines={1}
                          className="text-xs font-mono text-muted"
                        >
                          {ev.dayKey} · {formatQuarterTime(ev.startQ)}
                        </Text>
                      </View>
                    </View>
                    <NotionIcon name="chevron-right" size={14} color={colors.muted} />
                  </Pressable>
                ))}
              </View>
            ) : null}

            {/* Pendientes */}
            {matchedPending.length > 0 ? (
              <View className="gap-2">
                <Text className="text-xs uppercase tracking-wider font-bold text-muted px-1">
                  Pendientes ({matchedPending.length})
                </Text>
                {matchedPending.map((task) => (
                  <View
                    key={task.id}
                    className="p-2.5 rounded-xl bg-raised border border-line flex-row items-center justify-between gap-2"
                  >
                    <Pressable
                      onPress={() => {
                        onClose();
                        router.push('/pending');
                      }}
                      className="min-h-[44px] flex-1 min-w-0 flex-row items-center gap-2.5 px-1"
                    >
                      <NotionIcon
                        name={task.completed ? 'check-circle' : 'reminder'}
                        size={15}
                        color={task.completed ? colors.ok : colors.warm}
                      />
                      <Text
                        numberOfLines={1}
                        className={`text-sm font-medium flex-1 ${
                          task.completed ? 'line-through text-muted' : 'text-ink'
                        }`}
                      >
                        {task.title}
                      </Text>
                    </Pressable>

                    <View className="flex-row items-center gap-1.5 flex-shrink-0">
                      <Pressable
                        onPress={() => togglePendingTask(task.id)}
                        accessibilityRole="button"
                        accessibilityLabel={
                          task.completed ? 'Marcar pendiente' : 'Completar pendiente'
                        }
                        className="min-w-[44px] min-h-[44px] px-2.5 rounded-lg bg-card border border-line items-center justify-center"
                      >
                        <NotionIcon
                          name="check"
                          size={14}
                          color={task.completed ? colors.ok : colors.muted}
                        />
                      </Pressable>

                      <Pressable
                        onPress={() => {
                          onClose();
                          openSlotPicker({
                            type: 'pending',
                            id: task.id,
                            title: task.title,
                          });
                        }}
                        className="min-h-[44px] px-3 rounded-lg bg-card border border-line flex-row items-center gap-1.5"
                      >
                        <NotionIcon name="clock" size={13} color={colors.muted} />
                        <Text className="text-xs font-medium text-ink">
                          Fijar hora
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Notas .md / Ideas */}
            {matchedIdeas.length > 0 ? (
              <View className="gap-2">
                <Text className="text-xs uppercase tracking-wider font-bold text-muted px-1">
                  Notas .md / Ideas ({matchedIdeas.length})
                </Text>
                {matchedIdeas.map(({ item, groupTitle }) => (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      setActiveIdeaId(item.id);
                      onClose();
                      router.push('/ideas');
                    }}
                    className="min-h-[44px] p-3 rounded-xl bg-raised border border-line flex-row items-center justify-between gap-3 active:border-ink"
                  >
                    <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
                      <NotionIcon name="lightbulb" size={15} color={colors.ok} />
                      <View className="flex-1 min-w-0">
                        <Text
                          numberOfLines={1}
                          className="text-sm font-semibold text-ink"
                        >
                          {item.title}
                        </Text>
                        <Text
                          numberOfLines={1}
                          className="text-xs text-muted"
                        >
                          {groupTitle} · Archivo .md
                        </Text>
                      </View>
                    </View>
                    <View className="px-2 py-0.5 rounded bg-card border border-line">
                      <Text className="text-xs font-mono text-muted">.md</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

interface QuickSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * QuickSettingsModal — Ajustes & Estado (Sync Local-First + Gemini API Key).
 * Accessible from the Header Avatar `D` or Sync status actions.
 */
export const QuickSettingsModal: React.FC<QuickSettingsModalProps> = ({
  visible,
  onClose,
}) => {
  const { colors } = useTheme();
  const router = useRouter();

  const syncState = useDayCraftStore((s) => s.syncState);
  const triggerSync = useDayCraftStore((s) => s.triggerSync);
  const geminiApiKey = useDayCraftStore((s) => s.geminiApiKey);
  const useCloudAI = useDayCraftStore((s) => s.useCloudAI);
  const setGeminiConfig = useDayCraftStore((s) => s.setGeminiConfig);
  const showToast = useDayCraftStore((s) => s.showToast);

  const [draftKey, setDraftKey] = useState(geminiApiKey);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (visible) {
      setDraftKey(geminiApiKey);
    }
  }, [visible, geminiApiKey]);

  const syncMeta = getSyncStatusMeta(syncState.status);

  const handleTriggerSync = async () => {
    await triggerSync();
    const latest = useDayCraftStore.getState().syncState;
    const latestMeta = getSyncStatusMeta(latest.status);
    showToast({
      title: `Sync: ${latestMeta.label}`,
      description:
        latest.lastError ||
        (latest.pendingCount > 0
          ? `${latest.pendingCount} cambios en cola local`
          : 'Base de datos SQLite al día'),
    });
  };

  const handleSaveGeminiKey = () => {
    const cleanKey = draftKey.trim();
    setGeminiConfig({
      apiKey: cleanKey,
      useCloudAI: cleanKey.length > 0 ? true : useCloudAI,
    });
    showToast({
      title: 'Configuración Gemini guardada',
      description: cleanKey
        ? 'Clave API actualizada en SQLite local'
        : 'Clave API eliminada; usando motor local si corresponde',
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        className="flex-1 bg-canvas/85 justify-center items-center p-4"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="bg-card border border-line rounded-3xl p-5 w-full max-w-md gap-4 shadow-2xl"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between pb-3 border-b border-line-subtle">
            <View className="flex-row items-center gap-2.5">
              <View className="w-9 h-9 rounded-full bg-raised border border-line items-center justify-center">
                <Text className="font-bold text-sm text-ink">D</Text>
              </View>
              <View>
                <Text className="font-bold text-sm text-ink">
                  Ajustes & Estado
                </Text>
                <Text className="text-xs text-muted">
                  Sincronización SQLite & Gemini IA
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cerrar ajustes"
              className="min-w-[44px] min-h-[44px] rounded-full bg-raised border border-line items-center justify-center"
            >
              <NotionIcon name="close" size={14} color={colors.muted} />
            </Pressable>
          </View>

          {/* Sync Status Card */}
          <View className="p-3.5 rounded-2xl bg-raised border border-line gap-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <View className={`w-2 h-2 rounded-full ${syncMeta.dotClass}`} />
                <Text className={`text-xs font-mono font-bold ${syncMeta.toneClass}`}>
                  {syncMeta.label}
                </Text>
              </View>
              <Text className="text-xs font-mono text-muted">
                Pendientes: {syncState.pendingCount}
              </Text>
            </View>

            {syncState.lastSyncedAt ? (
              <Text className="text-xs text-muted">
                Última sync: {new Date(syncState.lastSyncedAt).toLocaleTimeString()}
              </Text>
            ) : null}

            {syncState.lastError ? (
              <Text className="text-xs text-warm">{syncState.lastError}</Text>
            ) : null}

            <Pressable
              onPress={handleTriggerSync}
              className="min-h-[44px] px-3.5 rounded-xl bg-card border border-line flex-row items-center justify-center gap-2 active:border-ink"
            >
              <NotionIcon name="repeat" size={14} color={colors.accentSoft} />
              <Text className="text-xs font-bold text-ink">
                Sincronizar ahora
              </Text>
            </Pressable>
          </View>

          {/* Gemini AI Config */}
          <View className="p-3.5 rounded-2xl bg-raised border border-line gap-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <NotionIcon name="key" size={14} color={colors.accentSoft} />
                <Text className="text-xs font-bold uppercase tracking-wider text-ink">
                  Gemini API Key
                </Text>
              </View>

              <Pressable
                onPress={() => setGeminiConfig({ useCloudAI: !useCloudAI })}
                className={`min-h-[44px] px-3 rounded-xl border items-center justify-center ${
                  useCloudAI
                    ? 'bg-ok/15 border-ok/30'
                    : 'bg-card border-line'
                }`}
              >
                <Text
                  className={`text-xs font-mono font-semibold ${
                    useCloudAI ? 'text-ok' : 'text-muted'
                  }`}
                >
                  {useCloudAI ? 'Cloud IA: ON' : 'Cloud IA: OFF'}
                </Text>
              </Pressable>
            </View>

            <View className="flex-row items-center gap-2">
              <TextInput
                value={draftKey}
                onChangeText={setDraftKey}
                secureTextEntry={!showKey}
                placeholder="AIzaSy..."
                placeholderTextColor={colors.muted}
                className="flex-1 min-h-[44px] bg-canvas border border-line rounded-xl px-3 text-xs font-mono text-ink"
              />
              <Pressable
                onPress={() => setShowKey((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel={showKey ? 'Ocultar clave' : 'Mostrar clave'}
                className="min-w-[44px] min-h-[44px] px-3 rounded-xl bg-card border border-line items-center justify-center"
              >
                <Text className="text-xs font-semibold text-muted">
                  {showKey ? 'Ocultar' : 'Ver'}
                </Text>
              </Pressable>
            </View>

            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={handleSaveGeminiKey}
                className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-ink items-center justify-center active:opacity-85"
              >
                <Text className="text-xs font-bold text-canvas">
                  Guardar Clave
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  onClose();
                  router.push('/chat');
                }}
                className="min-h-[44px] px-3.5 rounded-xl bg-card border border-line flex-row items-center justify-center gap-1.5 active:border-ink"
              >
                <NotionIcon name="chat" size={14} color={colors.accentSoft} />
                <Text className="text-xs font-semibold text-ink">
                  Ir al Chat
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
