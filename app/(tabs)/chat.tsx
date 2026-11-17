import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useDayCraftStore } from '@/store/useDayCraftStore';
import { LAYOUT } from '@/constants/theme';
import { NotionIcon } from '@/components/ui/NotionIcon';
import { useTheme } from '@/store/useThemeStore';

/**
 * Tab 1: Asistente IA (Feed Conversacional, Tarjetas de Clasificación Estructurada
 * y Configuración discreta de Motor IA: Gemini 2.0 Flash Cloud vs Parser NLP Local Offline).
 */
export default function ChatScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= LAYOUT.desktopBreakpoint;

  const chatMessages = useDayCraftStore((s) => s.chatMessages);
  const geminiApiKey = useDayCraftStore((s) => s.geminiApiKey);
  const useCloudAI = useDayCraftStore((s) => s.useCloudAI);
  const setGeminiConfig = useDayCraftStore((s) => s.setGeminiConfig);
  const showToast = useDayCraftStore((s) => s.showToast);

  const [configOpen, setConfigOpen] = useState(false);
  const [draftKey, setDraftKey] = useState(geminiApiKey);
  const [draftUseCloud, setDraftUseCloud] = useState(useCloudAI);

  useEffect(() => {
    setDraftKey(geminiApiKey);
    setDraftUseCloud(useCloudAI);
  }, [geminiApiKey, useCloudAI]);

  const isGeminiCloudActive = Boolean(geminiApiKey.trim()) && useCloudAI;

  const handleSaveConfig = () => {
    const cleanedKey = draftKey.trim();
    const shouldEnableCloud = draftUseCloud && Boolean(cleanedKey);
    setGeminiConfig({
      apiKey: cleanedKey,
      useCloudAI: shouldEnableCloud,
    });
    setConfigOpen(false);
    showToast({
      title: shouldEnableCloud
        ? 'Motor Gemini 2.0 Flash activo'
        : 'Motor NLP Local Offline activo',
      description: shouldEnableCloud
        ? 'API Key guardada en SQLite local'
        : 'Clasificación determinista de 0ms sin conexión',
    });
  };

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.canvas }}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: isDesktop ? 32 : 24,
          gap: 14,
        }}
      >
        {/* Encabezado del Feed IA + Botón Discreto de Configuración de Motor */}
        <View className="p-3 rounded-2xl bg-card border border-line-subtle flex-row items-center justify-between gap-2">
          <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
            <View className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/30 items-center justify-center flex-shrink-0">
              <NotionIcon name="sparkle" size={15} color={colors.accentSoft} />
            </View>
            <View className="flex-1 min-w-0">
              <Text numberOfLines={1} className="font-bold text-sm text-ink">
                Cerebro IA Gemini · Smart Intake
              </Text>
              <Text numberOfLines={1} className="text-xs text-muted">
                {isGeminiCloudActive
                  ? 'Motor activo: Gemini 2.0 Flash (Cloud JSON)'
                  : 'Motor activo: Parser NLP Local (100% Offline · 0ms)'}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => setConfigOpen(true)}
            className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-raised border border-line active:border-ink flex-shrink-0"
          >
            <NotionIcon
              name="key"
              size={12}
              color={isGeminiCloudActive ? colors.ok : colors.accentSoft}
            />
            <Text className="text-xs font-mono font-semibold text-ink">
              {isGeminiCloudActive ? 'Gemini Cloud' : 'NLP Local'}
            </Text>
          </Pressable>
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

      {/* Modal Discreto de Configuración de IA (Gemini Flash Cloud vs Parser NLP Local) */}
      <Modal
        visible={configOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setConfigOpen(false)}
      >
        <View className="flex-1 bg-canvas/85 justify-center items-center p-4">
          <View className="bg-card border border-line rounded-3xl p-5 w-full max-w-md gap-4 shadow-2xl">
            <View className="flex-row items-center justify-between pb-2 border-b border-line-subtle">
              <View className="flex-row items-center gap-2">
                <NotionIcon name="key" size={16} color={colors.accentSoft} />
                <Text className="font-bold text-sm text-ink">
                  Motor de Inteligencia Artificial
                </Text>
              </View>
              <Pressable
                onPress={() => setConfigOpen(false)}
                hitSlop={10}
                className="w-8 h-8 rounded-full bg-raised items-center justify-center"
              >
                <NotionIcon name="close" size={13} color={colors.muted} />
              </Pressable>
            </View>

            {/* Selector de Modo: Gemini Cloud vs Parser NLP Local */}
            <View className="gap-1.5">
              <Text className="text-xs uppercase tracking-wider font-bold text-muted">
                Modo de Clasificación
              </Text>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => setDraftUseCloud(false)}
                  className={`flex-1 p-3 rounded-xl border gap-1 ${
                    !draftUseCloud
                      ? 'bg-accent/20 border-accent'
                      : 'bg-raised border-line'
                  }`}
                >
                  <View className="flex-row items-center gap-1.5">
                    <NotionIcon
                      name="zap"
                      size={13}
                      color={!draftUseCloud ? colors.accentSoft : colors.muted}
                    />
                    <Text className="text-xs font-bold text-ink">
                      NLP Local Offline
                    </Text>
                  </View>
                  <Text className="text-[11px] text-muted">
                    Instantáneo (0ms) sin conexión
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setDraftUseCloud(true)}
                  className={`flex-1 p-3 rounded-xl border gap-1 ${
                    draftUseCloud
                      ? 'bg-accent/20 border-accent'
                      : 'bg-raised border-line'
                  }`}
                >
                  <View className="flex-row items-center gap-1.5">
                    <NotionIcon
                      name="sparkle"
                      size={13}
                      color={draftUseCloud ? colors.accentSoft : colors.muted}
                    />
                    <Text className="text-xs font-bold text-ink">
                      Gemini 2.0 Flash
                    </Text>
                  </View>
                  <Text className="text-[11px] text-muted">
                    Extracción JSON en la nube
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Input para GEMINI_API_KEY */}
            <View className="gap-1.5">
              <Text className="text-xs uppercase tracking-wider font-bold text-muted">
                GEMINI_API_KEY (Opcional · Guardada en SQLite)
              </Text>
              <TextInput
                value={draftKey}
                onChangeText={(v) => {
                  setDraftKey(v);
                  if (v.trim().length > 0) setDraftUseCloud(true);
                }}
                placeholder="AIzaSy..."
                placeholderTextColor={colors.muted}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                className="bg-canvas border border-line rounded-xl px-3.5 py-2.5 text-sm font-mono text-ink"
              />
              <Text className="text-[11px] text-muted leading-relaxed">
                Tu clave se almacena exclusivamente en tu base de datos local SQLite. Si se deja vacía o no hay red, DayCraft usa automáticamente el Parser NLP Local.
              </Text>
            </View>

            <View className="flex-row items-center justify-between pt-2 border-t border-line-subtle">
              {draftKey.trim().length > 0 ? (
                <Pressable
                  onPress={() => {
                    setDraftKey('');
                    setDraftUseCloud(false);
                  }}
                  className="px-3 py-2 rounded-xl bg-raised border border-line"
                >
                  <Text className="text-xs font-medium text-muted">
                    Limpiar clave
                  </Text>
                </Pressable>
              ) : (
                <View />
              )}

              <View className="flex-row items-center gap-2">
                <Pressable
                  onPress={() => setConfigOpen(false)}
                  className="px-4 py-2.5 rounded-xl active:opacity-75"
                >
                  <Text className="text-sm font-medium text-muted">
                    Cancelar
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveConfig}
                  className="px-5 py-2.5 rounded-xl bg-ink active:opacity-85"
                >
                  <Text className="text-sm font-bold text-canvas">
                    Guardar
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
