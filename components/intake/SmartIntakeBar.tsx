import React, { useState } from 'react';
import { View, TextInput, Pressable, Text } from 'react-native';
import { NotionIcon } from '@/components/ui/NotionIcon';
import { useDayCraftStore, SlotPickerTarget } from '@/store/useDayCraftStore';
import { useTheme } from '@/store/useThemeStore';

interface SmartIntakeBarProps {
  isOnChatScreen?: boolean;
  compact?: boolean;
  onOpenSlotPicker?: (target: SlotPickerTarget) => void;
}

const VOICE_SAMPLES = [
  'Comprar bombillas LED cuando pueda hoy',
  'Reunión de arquitectura el viernes a las 10:00',
  'Idea: Añadir widget de pantalla de bloqueo para móvil',
  'Recuérdame hoy a las 18:30 revisar presupuesto',
];

/**
 * SmartIntakeBar — Punto de Entrada Universal Único (Principio Innegociable v9)
 * Barra omnidireccional de texto + dictado por voz.
 * Nunca duplica inputs en vistas secundarias; captura sin cambiar de pantalla y lanza Toast efímero.
 */
export const SmartIntakeBar: React.FC<SmartIntakeBarProps> = ({
  isOnChatScreen = false,
  compact = false,
  onOpenSlotPicker,
}) => {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [sampleIdx, setSampleIdx] = useState(0);
  const submitSmartIntake = useDayCraftStore((s) => s.submitSmartIntake);

  const handleSubmit = async () => {
    const val = text.trim();
    if (!val) return;
    setText('');
    await submitSmartIntake(val, { isOnChatScreen, onOpenSlotPicker });
  };

  const handleVoiceSimulate = () => {
    if (isRecording) return;
    setIsRecording(true);
    const chosenSample = VOICE_SAMPLES[sampleIdx % VOICE_SAMPLES.length];
    setSampleIdx((i) => i + 1);

    setTimeout(async () => {
      setIsRecording(false);
      await submitSmartIntake(chosenSample, { isOnChatScreen, onOpenSlotPicker });
    }, 850);
  };

  return (
    <View
      className={`${
        compact
          ? 'pt-2.5 border-t border-line-subtle'
          : 'px-3.5 py-2.5 border-t border-line-subtle bg-card'
      }`}
    >
      <View className="flex-row items-center gap-2">
        <View className="flex-1 bg-raised border border-line rounded-full px-3.5 py-2 flex-row items-center gap-2">
          <TextInput
            value={isRecording ? 'Escuchando dictado por voz...' : text}
            onChangeText={setText}
            editable={!isRecording}
            placeholder="Háblame o escribe una idea, tarea o recordatorio..."
            placeholderTextColor={colors.muted}
            onSubmitEditing={handleSubmit}
            returnKeyType="send"
            className="flex-1 text-xs text-ink py-0.5 outline-none"
          />
          {text.trim().length > 0 && !isRecording ? (
            <Pressable
              onPress={handleSubmit}
              className="p-1 rounded-full active:scale-95"
              hitSlop={8}
            >
              <NotionIcon name="send" size={14} color={colors.ink} />
            </Pressable>
          ) : null}
        </View>

        <Pressable
          onPress={handleVoiceSimulate}
          className={`w-9 h-9 rounded-full items-center justify-center flex-shrink-0 ${
            isRecording
              ? 'bg-now/20 border border-now'
              : 'bg-ink active:opacity-85'
          }`}
        >
          <NotionIcon
            name="mic"
            size={15}
            color={isRecording ? colors.now : colors.canvas}
          />
        </Pressable>
      </View>

      {compact ? (
        <Text className="text-[10px] text-muted text-center mt-1.5">
          Gemini clasifica en Tarea con Horario, Pendiente o Idea.
        </Text>
      ) : null}
    </View>
  );
};
