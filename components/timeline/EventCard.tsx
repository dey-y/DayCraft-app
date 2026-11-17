import React, { useRef } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { TimelineEvent } from '@/services/db/sqlite';
import { formatQuarterToTime } from '@/store/useDayCraftStore';
import { NotionIcon } from '@/components/ui/NotionIcon';
import { useTheme } from '@/store/useThemeStore';

interface EventCardProps {
  event: TimelineEvent;
  compact?: boolean;
  onEdit?: (event: TimelineEvent) => void;
  onToggleComplete?: (id: string) => void;
  onRemove?: (id: string) => void;
}

/**
 * EventCard — Bloque ligero y translúcido estilo Google Calendar / Linear.
 * - El título y la hora SIEMPRE se sitúan estrictamente arriba a la izquierda (`alignItems: flex-start`, `justifyContent: flex-start`).
 * - Tocar la tarjeta abre `slot-picker.tsx` en modo edición (`type: 'edit_event'`).
 * - Incluye toggle rápido de completado con microinteracción elástica y botón de eliminar con Deshacer.
 */
export const EventCard: React.FC<EventCardProps> = ({
  event,
  compact = false,
  onEdit,
  onToggleComplete,
  onRemove,
}) => {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const startStr = formatQuarterToTime(event.startQ);
  const endStr = formatQuarterToTime(event.startQ + event.quarters);
  const isReminder = event.type === 'reminder';
  const isCompleted = Boolean(event.completed);
  const hasRecurrence =
    event.recurrence && event.recurrence.frequency !== 'none';

  const handleToggleComplete = (e: any) => {
    e?.stopPropagation?.();
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 140,
        useNativeDriver: true,
      }),
    ]).start();
    onToggleComplete?.(event.id);
  };

  return (
    <Pressable
      onPress={() => onEdit?.(event)}
      style={{
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        opacity: isCompleted ? 0.65 : 1,
      }}
      className={`w-full h-full border border-line-subtle/80 border-l-[3.5px] rounded-xl ${
        compact ? 'px-2.5 py-1' : 'px-3 pt-2 pb-1.5'
      } ${
        isCompleted
          ? 'bg-raised/60 border-l-ok'
          : isReminder
          ? 'bg-info/15 border-l-info'
          : 'bg-card border-l-accent'
      } flex-row items-start justify-between gap-2 overflow-hidden shadow-sm active:border-line`}
    >
      {/* Toggle rápido de completado + Columna de título y descripción estrictamente anclada arriba */}
      <View
        style={{
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
        }}
        className="flex-1 min-w-0 flex-row items-start gap-2"
      >
        {onToggleComplete ? (
          <Pressable
            onPress={handleToggleComplete}
            hitSlop={10}
            className="mt-0.5 flex-shrink-0"
          >
            <Animated.View
              style={{ transform: [{ scale: scaleAnim }] }}
              className={`w-4 h-4 rounded-md border items-center justify-center ${
                isCompleted
                  ? 'bg-ok border-ok'
                  : 'bg-canvas/70 border-line'
              }`}
            >
              {isCompleted ? (
                <NotionIcon name="check" size={10} color={colors.canvas} strokeWidth={2.4} />
              ) : null}
            </Animated.View>
          </Pressable>
        ) : null}

        <View
          style={{
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
          }}
          className="flex-1 min-w-0 justify-start"
        >
          <View
            style={{ alignItems: 'center' }}
            className="flex-row items-center gap-1.5"
          >
            <Text
              numberOfLines={1}
              style={{ textAlign: 'left' }}
              className={`font-bold text-xs sm:text-sm flex-shrink ${
                isCompleted ? 'text-muted line-through' : 'text-ink'
              }`}
            >
              {event.title}
            </Text>
            {hasRecurrence ? (
              <NotionIcon name="repeat" size={11} color={colors.muted} />
            ) : null}
          </View>

          {!compact && event.desc ? (
            <Text
              numberOfLines={1}
              style={{ textAlign: 'left' }}
              className={`text-[11px] mt-0.5 ${
                isCompleted ? 'text-muted/70 line-through' : 'text-muted'
              }`}
            >
              {event.desc}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Cápsula de horas e icono de eliminar: también anclada arriba */}
      <View
        style={{ alignItems: 'flex-start' }}
        className="flex-row items-center gap-1.5 flex-shrink-0 mt-0.5"
      >
        <View className="px-2 py-0.5 rounded-md bg-raised border border-line-subtle">
          <Text
            className={`font-mono text-xs font-semibold ${
              isCompleted
                ? 'text-ok'
                : isReminder
                ? 'text-info'
                : 'text-accent-soft'
            }`}
          >
            {startStr} – {endStr}
          </Text>
        </View>

        {onRemove ? (
          <Pressable
            onPress={(e) => {
              e?.stopPropagation?.();
              onRemove(event.id);
            }}
            hitSlop={12}
            className="p-1 rounded-md active:bg-raised flex-shrink-0"
          >
            <NotionIcon name="close" size={12} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
};
