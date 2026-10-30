import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useDayCraftStore } from '@/store/useDayCraftStore';
import { NotionIcon } from './NotionIcon';

interface BellDropdownProps {
  onScheduleIdea?: (ideaTitle: string) => void;
}

/**
 * Campana No Intrusiva (Principio v3-v9):
 * Cero banners invasivos en pantalla. Avisos discretos para Rollover de ayer,
 * Regla de los 3 días e Ideas inactivas (+10 días).
 */
export const BellDropdown: React.FC<BellDropdownProps> = ({ onScheduleIdea }) => {
  const bellDropdownOpen = useDayCraftStore((s) => s.bellDropdownOpen);
  const setBellDropdownOpen = useDayCraftStore((s) => s.setBellDropdownOpen);
  const alerts = useDayCraftStore((s) => s.alerts);
  const dismissAlert = useDayCraftStore((s) => s.dismissAlert);
  const convertStalePendingToIdea = useDayCraftStore((s) => s.convertStalePendingToIdea);
  const openSlotPicker = useDayCraftStore((s) => s.openSlotPicker);

  if (!bellDropdownOpen) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: 52,
        right: 16,
        width: 310,
        zIndex: 90,
      }}
      className="bg-[#161922] border border-[#2d3345] rounded-2xl p-3.5 shadow-2xl gap-2.5"
    >
      <View className="flex-row items-center justify-between pb-2 border-b border-[#262b3a]">
        <View className="flex-row items-center gap-1.5">
          <NotionIcon name="bell" size={14} color="#ffffff" />
          <Text className="text-xs font-bold text-white">
            Avisos de DayCraft ({alerts.length})
          </Text>
        </View>
        <Pressable
          onPress={() => setBellDropdownOpen(false)}
          className="p-1 rounded-lg active:bg-[#1f2430]"
        >
          <NotionIcon name="close" size={13} color="#8b949e" />
        </Pressable>
      </View>

      {alerts.length === 0 ? (
        <View className="py-5 items-center">
          <NotionIcon name="check-circle" size={22} color="#34d399" />
          <Text className="text-xs text-[#8b949e] mt-2 text-center">
            Sin avisos pendientes. Todo al día.
          </Text>
        </View>
      ) : (
        alerts.map((alert) => {
          const isRollover = alert.type === 'rollover';
          return (
            <View
              key={alert.id}
              className="p-3 rounded-xl bg-[#1f2430] border border-[#2d3345] gap-1.5"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <NotionIcon
                    name={isRollover ? 'clock' : 'lightbulb'}
                    size={13}
                    color={isRollover ? '#fbbf24' : '#818cf8'}
                  />
                  <Text
                    className={`text-[10px] font-bold uppercase ${
                      isRollover ? 'text-amber-400' : 'text-indigo-400'
                    }`}
                  >
                    {isRollover ? 'Rollover Antiestrés' : 'Idea en el Cajón'}
                  </Text>
                </View>
                <Text className="text-[10px] font-mono text-[#8b949e]">
                  {alert.badgeText}
                </Text>
              </View>

              <Text className="text-xs font-semibold text-white">{alert.title}</Text>
              <Text className="text-[11px] text-[#8b949e] leading-snug">
                {alert.subtitle}
              </Text>

              <View className="flex-row items-center gap-2 pt-1">
                {isRollover ? (
                  <>
                    <Pressable
                      onPress={() => dismissAlert(alert.id)}
                      className="px-2.5 py-1 rounded-lg bg-white"
                    >
                      <Text className="text-[10px] font-bold text-black">
                        Mantener hoy
                      </Text>
                    </Pressable>
                    {alert.relatedId ? (
                      <Pressable
                        onPress={() => convertStalePendingToIdea(alert.relatedId!)}
                        className="px-2.5 py-1 rounded-lg bg-[#161922] border border-[#2d3345]"
                      >
                        <Text className="text-[10px] font-medium text-amber-400">
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
                      className="px-2.5 py-1 rounded-lg bg-white"
                    >
                      <Text className="text-[10px] font-bold text-black">
                        Retomar (Fijar hora)
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => dismissAlert(alert.id)}
                      className="px-2 py-1"
                    >
                      <Text className="text-[10px] text-[#8b949e]">Archivar</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          );
        })
      )}
    </View>
  );
};
