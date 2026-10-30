import React from 'react';
import { View, Text, ScrollView, useWindowDimensions } from 'react-native';
import { useDayCraftStore } from '@/store/useDayCraftStore';
import { LAYOUT } from '@/constants/theme';
import { NotionIcon } from '@/components/ui/NotionIcon';

/**
 * Tab 1: Asistente IA (Feed Conversacional y Tarjetas de Clasificación Estructurada)
 */
export default function ChatScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= LAYOUT.desktopBreakpoint;

  const chatMessages = useDayCraftStore((s) => s.chatMessages);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#0d1117' }}
      contentContainerStyle={{
        padding: 16,
        paddingBottom: isDesktop ? 32 : 96,
        gap: 14,
      }}
    >
      {/* Encabezado del Feed IA */}
      <View className="p-3 rounded-2xl bg-[#161922] border border-[#262b3a] flex-row items-center justify-between">
        <View className="flex-row items-center gap-2.5">
          <View className="w-7 h-7 rounded-xl bg-indigo-500/15 border border-indigo-500/30 items-center justify-center">
            <NotionIcon name="sparkle" size={14} color="#818cf8" />
          </View>
          <View>
            <Text className="font-bold text-xs text-white">
              Cerebro IA Gemini · Smart Intake
            </Text>
            <Text className="text-[10px] text-[#8b949e]">
              Separa automáticamente bloques, recordatorios, pendientes e ideas
            </Text>
          </View>
        </View>
        <View className="px-2 py-0.5 rounded-full bg-[#1f2430] border border-[#2d3345]">
          <Text className="text-[9px] font-mono text-emerald-400">Listo</Text>
        </View>
      </View>

      {/* Mensajes del Chat */}
      <View className="gap-3">
        {chatMessages.map((msg) => {
          const isUser = msg.role === 'user';

          if (isUser) {
            return (
              <View key={msg.id} className="flex-row justify-end">
                <View className="bg-white px-3.5 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%]">
                  <Text className="text-xs font-medium text-black leading-relaxed">
                    "{msg.text}"
                  </Text>
                </View>
              </View>
            );
          }

          return (
            <View key={msg.id} className="flex-row items-start gap-2.5">
              <View className="w-7 h-7 rounded-full bg-[#1f2430] border border-[#2d3345] items-center justify-center flex-shrink-0 mt-0.5">
                <NotionIcon name="sparkle" size={13} color="#ffffff" />
              </View>

              <View className="bg-[#1f2430] border border-[#2d3345] p-3 rounded-2xl rounded-tl-sm flex-1 max-w-[88%] gap-2">
                <Text className="text-xs text-[#e6edf3] leading-relaxed">
                  {msg.text}
                </Text>

                {msg.classifiedItems && msg.classifiedItems.length > 0 ? (
                  <View className="gap-2 pt-1">
                    {msg.classifiedItems.map((item, idx) => {
                      const isReminder = item.type === 'reminder';
                      const isEvent = item.type === 'event';
                      const isIdea = item.type === 'idea';

                      const accentText = isReminder
                        ? 'text-sky-400'
                        : isEvent
                        ? 'text-indigo-400'
                        : isIdea
                        ? 'text-amber-400'
                        : 'text-[#8b949e]';

                      const labelType = isReminder
                        ? 'Recordatorio Puntual'
                        : isEvent
                        ? 'Bloque en Timeline'
                        : isIdea
                        ? 'Cajón de Ideas'
                        : 'Pendiente de Hoy (Sin hora)';

                      return (
                        <View
                          key={`${msg.id}-item-${idx}`}
                          className="bg-[#161922] border border-[#2d3345] rounded-xl p-2.5 gap-1"
                        >
                          <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center gap-1.5">
                              <NotionIcon
                                name={
                                  isIdea
                                    ? 'lightbulb'
                                    : isReminder
                                    ? 'reminder'
                                    : 'clock'
                                }
                                size={12}
                                color={
                                  isReminder
                                    ? '#38bdf8'
                                    : isEvent
                                    ? '#818cf8'
                                    : isIdea
                                    ? '#fbbf24'
                                    : '#8b949e'
                                }
                              />
                              <Text className={`text-[10px] font-bold ${accentText}`}>
                                {labelType}
                              </Text>
                            </View>
                            <Text className={`text-[10px] font-mono ${accentText}`}>
                              {item.meta}
                            </Text>
                          </View>

                          <Text className="font-semibold text-xs text-white">
                            {item.title}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
