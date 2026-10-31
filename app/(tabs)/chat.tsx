import React from 'react';
import { View, Text, ScrollView, useWindowDimensions } from 'react-native';
import { useDayCraftStore } from '@/store/useDayCraftStore';
import { LAYOUT } from '@/constants/theme';
import { NotionIcon } from '@/components/ui/NotionIcon';
import { useTheme } from '@/store/useThemeStore';

/**
 * Tab 1: Asistente IA (Feed Conversacional y Tarjetas de Clasificación Estructurada)
 */
export default function ChatScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= LAYOUT.desktopBreakpoint;

  const chatMessages = useDayCraftStore((s) => s.chatMessages);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={{
        padding: 16,
        paddingBottom: isDesktop ? 32 : 24,
        gap: 14,
      }}
    >
      {/* Encabezado del Feed IA */}
      <View className="p-3 rounded-2xl bg-card border border-line-subtle flex-row items-center justify-between">
        <View className="flex-row items-center gap-2.5">
          <View className="w-7 h-7 rounded-xl bg-accent/15 border border-accent/30 items-center justify-center">
            <NotionIcon name="sparkle" size={14} color={colors.accentSoft} />
          </View>
          <View>
            <Text className="font-bold text-sm text-ink">
              Cerebro IA Gemini · Smart Intake
            </Text>
            <Text className="text-xs text-muted">
              Separa automáticamente bloques, recordatorios, pendientes e ideas
            </Text>
          </View>
        </View>
        <View className="px-2.5 py-0.5 rounded-full bg-raised border border-line">
          <Text className="text-[11px] font-mono font-medium text-ok">Listo</Text>
        </View>
      </View>

      {/* Mensajes del Chat */}
      <View className="gap-3">
        {chatMessages.map((msg) => {
          const isUser = msg.role === 'user';

          if (isUser) {
            return (
              <View key={msg.id} className="flex-row justify-end">
                <View className="bg-ink px-4 py-3 rounded-2xl rounded-tr-sm max-w-[85%]">
                  <Text className="text-sm font-medium text-canvas leading-relaxed">
                    "{msg.text}"
                  </Text>
                </View>
              </View>
            );
          }

          return (
            <View key={msg.id} className="flex-row items-start gap-2.5">
              <View className="w-8 h-8 rounded-full bg-raised border border-line items-center justify-center flex-shrink-0 mt-0.5">
                <NotionIcon name="sparkle" size={14} color={colors.ink} />
              </View>

              <View className="bg-raised border border-line p-3.5 rounded-2xl rounded-tl-sm flex-1 max-w-[88%] gap-2.5">
                <Text className="text-sm text-ink leading-relaxed">
                  {msg.text}
                </Text>

                {msg.classifiedItems && msg.classifiedItems.length > 0 ? (
                  <View className="gap-2 pt-1">
                    {msg.classifiedItems.map((item, idx) => {
                      const isReminder = item.type === 'reminder';
                      const isEvent = item.type === 'event';
                      const isIdea = item.type === 'idea';

                      const accentText = isReminder
                        ? 'text-info'
                        : isEvent
                        ? 'text-accent-soft'
                        : isIdea
                        ? 'text-warm'
                        : 'text-muted';

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
                          className="bg-card border border-line rounded-xl p-3 gap-1.5"
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
                                size={13}
                                color={
                                  isReminder
                                    ? colors.info
                                    : isEvent
                                    ? colors.accentSoft
                                    : isIdea
                                    ? colors.warm
                                    : colors.muted
                                }
                              />
                              <Text className={`text-xs font-bold ${accentText}`}>
                                {labelType}
                              </Text>
                            </View>
                            <Text className={`text-xs font-mono ${accentText}`}>
                              {item.meta}
                            </Text>
                          </View>

                          <Text className="font-semibold text-sm text-ink">
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
