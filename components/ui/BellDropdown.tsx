import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useDayCraftStore } from '@/store/useDayCraftStore';
import { NotionIcon } from './NotionIcon';
import { useTheme } from '@/store/useThemeStore';

interface BellDropdownProps {
  onScheduleIdea?: (ideaTitle: string) => void;
}

/**
 * Campana No Intrusiva (Principio v3-v9):
 * Cero banners invasivos en pantalla. Avisos discretos para Rollover de ayer,
 * Regla de los 3 días e Ideas inactivas (+10 días).
 */
export const BellDropdown: React.FC<BellDropdownProps> = ({ onScheduleIdea }) => {
  const { colors } = useTheme();
  const bellDropdownOpen = useDayCraftStore((s) => s.bellDropdownOpen);
  const setBellDropdownOpen = useDayCraftStore((s) => s.setBellDropdownOpen);
  const alerts = useDayCraftStore((s) => s.alerts);
  const dismissAlert = useDayCraftStore((s) => s.dismissAlert);
  const convertStalePendingToIdea = useDayCraftStore((s) => s.convertStalePendingToIdea);
  const openSlotPicker = useDayCraftStore((s) => s.openSlotPicker);

  if (!bellDropdownOpen) return null;

  return (
    <>
      <Pressable
        onPress={() => setBellDropdownOpen(false)}
        accessibilityRole="button"
        accessibilityLabel="Cerrar avisos"
        style={{ zIndex: 85 }}
        className="absolute inset-0"
      />
      <View
        style={{
          position: 'absolute',
          top: 52,
          right: 16,
          width: 310,
          zIndex: 90,
        }}
        className="bg-card border border-line rounded-2xl p-3.5 shadow-2xl gap-2.5"
      >
        <View className="flex-row items-center justify-between pb-2 border-b border-line-subtle">
          <View className="flex-row items-center gap-1.5">
            <NotionIcon name="bell" size={14} color={colors.ink} />
            <Text className="text-xs font-bold text-ink">
              Avisos de DayCraft ({alerts.length})
            </Text>
          </View>
          <Pressable
            onPress={() => setBellDropdownOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Cerrar panel de avisos"
            hitSlop={8}
            className="min-w-[44px] min-h-[44px] rounded-lg items-center justify-center active:bg-raised"
          >
            <NotionIcon name="close" size={14} color={colors.muted} />
          </Pressable>
        </View>

        {alerts.length === 0 ? (
          <View className="py-5 items-center">
            <NotionIcon name="check-circle" size={22} color={colors.ok} />
            <Text className="text-xs text-muted mt-2 text-center">
              Sin avisos pendientes. Todo al día.
            </Text>
          </View>
        ) : (
          alerts.map((alert) => {
            const isRollover = alert.type === 'rollover';
            return (
              <View
                key={alert.id}
                className="p-3 rounded-xl bg-raised border border-line gap-1.5"
              >
                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-row items-center gap-1.5 flex-1 min-w-0">
                    <NotionIcon
                      name={isRollover ? 'clock' : 'lightbulb'}
                      size={13}
                      color={isRollover ? colors.warm : colors.accentSoft}
                    />
                    <Text
                      numberOfLines={1}
                      className={`text-xs font-bold uppercase ${
                        isRollover ? 'text-warm' : 'text-accent-soft'
                      }`}
                    >
                      {isRollover ? 'Rollover Antiestrés' : 'Idea en el Cajón'}
                    </Text>
                  </View>
                  <Text className="text-xs font-mono text-muted flex-shrink-0">
                    {alert.badgeText}
                  </Text>
                </View>

                <Text className="text-xs font-semibold text-ink">{alert.title}</Text>
                <Text className="text-xs text-muted leading-snug">
                  {alert.subtitle}
                </Text>

                <View className="flex-row flex-wrap items-center gap-2 pt-1">
                  {isRollover ? (
                    <>
                      <Pressable
                        onPress={() => dismissAlert(alert.id)}
                        hitSlop={4}
                        className="min-h-[44px] px-3 rounded-lg bg-ink items-center justify-center"
                      >
                        <Text className="text-xs font-bold text-canvas">
                          Mantener hoy
                        </Text>
                      </Pressable>
                      {alert.relatedId ? (
                        <Pressable
                          onPress={() => convertStalePendingToIdea(alert.relatedId!)}
                          hitSlop={4}
                          className="min-h-[44px] px-3 rounded-lg bg-card border border-line items-center justify-center"
                        >
                          <Text className="text-xs font-medium text-warm">
                            Mover a Ideas
                          </Text>
                        </Pressable>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <Pressable
                        onPress={() => {
                          setBellDropdownOpen(false);
                          const cleanTitle = alert.title.replace(/"/g, '');
                          if (onScheduleIdea) {
                            onScheduleIdea(cleanTitle);
                          } else {
                            openSlotPicker({
                              type: 'idea',
                              title: cleanTitle,
                            });
                          }
                          dismissAlert(alert.id);
                        }}
                        hitSlop={4}
                        className="min-h-[44px] px-3 rounded-lg bg-ink items-center justify-center"
                      >
                        <Text className="text-xs font-bold text-canvas">
                          Retomar (Fijar hora)
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => dismissAlert(alert.id)}
                        hitSlop={4}
                        className="min-h-[44px] px-3 rounded-lg items-center justify-center"
                      >
                        <Text className="text-xs text-muted">Archivar</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>
    </>
  );
};
