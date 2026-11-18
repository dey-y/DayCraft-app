import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { NotionIcon } from '@/components/ui/NotionIcon';
import { useDayCraftStore, SlotPickerTarget } from '@/store/useDayCraftStore';
import { useTheme } from '@/store/useThemeStore';

interface SmartIntakeBarProps {
  isOnChatScreen?: boolean;
  compact?: boolean;
  onOpenSlotPicker?: (target: SlotPickerTarget) => void;
}

const VOICE_FALLBACK_SAMPLES = [
  'Comprar bombillas LED cuando pueda hoy',
  'Reunión de arquitectura el viernes a las 10:00',
  'Idea: Añadir widget de pantalla de bloqueo para móvil',
  'Recuérdame mañana a las 18:30 revisar presupuesto',
];

/**
 * SmartIntakeBar — Punto de Entrada Universal Único (Principio Innegociable v9)
 * Barra omnidireccional de texto + dictado por voz real en Web (`SpeechRecognition` / `webkitSpeechRecognition` es-ES)
 * con transcripción en vivo, feedback no bloqueante durante el análisis y fallback limpio en nativo/navegadores sin soporte.
 */
export const SmartIntakeBar: React.FC<SmartIntakeBarProps> = ({
  isOnChatScreen = false,
  compact = false,
  onOpenSlotPicker,
}) => {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [sampleIdx, setSampleIdx] = useState(0);

  const submitSmartIntake = useDayCraftStore((s) => s.submitSmartIntake);
  const showToast = useDayCraftStore((s) => s.showToast);

  const recognitionRef = useRef<any>(null);
  const latestTranscriptRef = useRef<string>('');
  const hasSubmittedVoiceRef = useRef<boolean>(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort?.();
        } catch {}
      }
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
      }
    };
  }, []);

  const dispatchIntake = async (utterance: string) => {
    setIsSubmitting(true);
    try {
      await submitSmartIntake(utterance, { isOnChatScreen, onOpenSlotPicker });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    const val = text.trim();
    if (!val) return;
    setText('');
    setLiveTranscript('');
    await dispatchIntake(val);
  };

  const runIntelligentFallback = (reason?: string) => {
    const chosenSample =
      VOICE_FALLBACK_SAMPLES[sampleIdx % VOICE_FALLBACK_SAMPLES.length];
    setSampleIdx((i) => i + 1);
    setIsRecording(true);
    setLiveTranscript(chosenSample);

    if (reason) {
      showToast({
        title: 'Dictado demostrativo activo',
        description: reason,
      });
    }

    fallbackTimerRef.current = setTimeout(async () => {
      setIsRecording(false);
      setLiveTranscript('');
      setText('');
      await dispatchIntake(chosenSample);
    }, 900);
  };

  const handleToggleVoiceDictation = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          setIsRecording(false);
        }
      } else {
        setIsRecording(false);
      }
      return;
    }

    const SpeechRecognitionCtor =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? (window as any).SpeechRecognition ||
          (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionCtor) {
      runIntelligentFallback(
        Platform.OS === 'web'
          ? 'Tu navegador no soporta Web Speech API · usando muestra inteligente'
          : 'Dictado nativo en modo demostración · usando muestra inteligente'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognitionRef.current = recognition;
      latestTranscriptRef.current = '';
      hasSubmittedVoiceRef.current = false;

      recognition.lang = 'es-ES';
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsRecording(true);
        setLiveTranscript('');
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let finalStr = '';
        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          const transcriptChunk = res[0]?.transcript || '';
          if (res.isFinal) {
            finalStr += transcriptChunk;
          } else {
            interim += transcriptChunk;
          }
        }
        const combined = (finalStr || interim).trim();
        latestTranscriptRef.current = combined;
        setLiveTranscript(combined);
        setText(combined);
      };

      recognition.onerror = (event: any) => {
        const errCode = event?.error || 'unknown';
        recognitionRef.current = null;
        setIsRecording(false);
        setLiveTranscript('');

        if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
          runIntelligentFallback(
            'Permiso de micrófono denegado · usando entrada inteligente de respaldo'
          );
        } else if (errCode !== 'aborted' && errCode !== 'no-speech') {
          runIntelligentFallback(
            'Micrófono no disponible · usando entrada inteligente de respaldo'
          );
        }
      };

      recognition.onend = async () => {
        recognitionRef.current = null;
        setIsRecording(false);
        const captured = latestTranscriptRef.current.trim();
        if (captured && !hasSubmittedVoiceRef.current) {
          hasSubmittedVoiceRef.current = true;
          latestTranscriptRef.current = '';
          setLiveTranscript('');
          setText('');
          await dispatchIntake(captured);
        } else {
          setLiveTranscript('');
        }
      };

      recognition.start();
    } catch {
      runIntelligentFallback(
        'Reconocimiento de voz no disponible · usando muestra inteligente'
      );
    }
  };

  const displayedValue = isRecording
    ? liveTranscript
      ? liveTranscript
      : 'Escuchando en vivo (es-ES)... habla ahora'
    : text;

  return (
    <View
      className={`${
        compact
          ? 'pt-2.5 border-t border-line-subtle'
          : 'px-3.5 py-2.5 border-t border-line-subtle bg-card'
      }`}
    >
      <View className="flex-row items-center gap-2">
        <View
          className={`flex-1 min-h-[44px] bg-raised border rounded-full px-4 py-1.5 flex-row items-center gap-2 ${
            isRecording ? 'border-now' : 'border-line'
          }`}
        >
          {isRecording ? (
            <View className="w-2 h-2 rounded-full bg-now flex-shrink-0" />
          ) : isSubmitting ? (
            <ActivityIndicator size="small" color={colors.accentSoft} />
          ) : null}

          <TextInput
            value={displayedValue}
            onChangeText={setText}
            editable={!isRecording}
            placeholder="Háblame o escribe una idea, tarea o recordatorio..."
            placeholderTextColor={colors.muted}
            onSubmitEditing={handleSubmit}
            returnKeyType="send"
            style={{ lineHeight: 18, paddingVertical: 2 }}
            className={`flex-1 text-sm outline-none ${
              isRecording ? 'text-accent-soft font-medium' : 'text-ink'
            }`}
          />
          {text.trim().length > 0 && !isRecording ? (
            <Pressable
              onPress={handleSubmit}
              accessibilityRole="button"
              accessibilityLabel="Enviar entrada"
              className="min-w-[44px] min-h-[44px] -mr-2 rounded-full items-center justify-center active:scale-95"
              hitSlop={6}
            >
              <NotionIcon name="send" size={16} color={colors.ink} />
            </Pressable>
          ) : null}
        </View>

        <Pressable
          onPress={handleToggleVoiceDictation}
          accessibilityRole="button"
          accessibilityLabel={isRecording ? 'Detener dictado' : 'Dictar por voz'}
          hitSlop={6}
          className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-full items-center justify-center flex-shrink-0 ${
            isRecording
              ? 'bg-now/20 border border-now'
              : 'bg-ink active:opacity-85'
          }`}
        >
          <NotionIcon
            name="mic"
            size={18}
            color={isRecording ? colors.now : colors.canvas}
          />
        </Pressable>
      </View>

      {compact ? (
        <Text className="text-xs text-muted text-center mt-1.5">
          {isRecording
            ? 'Transcribiendo voz en vivo (es-ES) · Pulsa el micro para enviar ya'
            : isSubmitting
            ? 'Clasificando entrada con IA...'
            : 'Gemini clasifica en Tarea con Horario, Pendiente o Idea.'}
        </Text>
      ) : null}
    </View>
  );
};
