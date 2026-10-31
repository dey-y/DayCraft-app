import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { TimelineEvent } from '@/services/db/sqlite';
import { formatQuarterToTime } from '@/store/useDayCraftStore';
import { NotionIcon } from '@/components/ui/NotionIcon';
import { useTheme } from '@/store/useThemeStore';

interface EventCardProps {
  event: TimelineEvent;
  compact?: boolean;
  onRemove?: (id: string) => void;
}

/**
 * EventCard — Bloque ligero y translúcido estilo Google Calendar / Linear.
 * - El texto y la hora siempre aparecen pegados arriba al principio (`items-start justify-start`), nunca flotando en mitad del bloque.
 * - Fondo translúcido sutil (`bg-accent/10`) que deja respirar la cuadrícula de horas por debajo sin formar un "ladrillo" pesado cuando dura 2h+.
 */
export const EventCard: React.FC<EventCardProps> = ({
  event,
  compact = false,
  onRemove,
}) => {
  const { colors } = useTheme();
  const startStr = formatQuarterToTime(event.startQ);
  const endStr = formatQuarterToTime(event.startQ + event.quarters);
  const isReminder = event.type === 'reminder';
  const hasRecurrence =
    event.recurrence && event.recurrence.frequency !== 'none';

  return (
    <View
      className={`w-full h-full border border-line-subtle/80 border-l-[3.5px] rounded-xl px-3 pt-2 pb-1.5 ${
        isReminder
          ? 'bg-info/15 border-l-info'
          : 'bg-card border-l-accent'
      } flex-row items-start justify-between gap-2 overflow-hidden shadow-sm`}
    >
      <View className="flex-1 min-w-0 justify-start">
        <View className="flex-row items-center gap-1.5">
          <Text
            numberOfLines={1}
            className="font-bold text-xs sm:text-sm text-ink flex-shrink"
          >
            {event.title}
          </Text>
          {hasRecurrence ? (
            <Text className="text-[10px] text-muted font-mono">↻</Text>
          ) : null}
        </View>

        {!compact && event.desc ? (
          <Text numberOfLines={1} className="text-[11px] text-muted mt-0.5">
            {event.desc}
          </Text>
        ) : null}
      </View>

      <View className="flex-row items-center gap-1.5 flex-shrink-0 mt-0.5">
        <View className="px-2 py-0.5 rounded-md bg-raised border border-line-subtle">
          <Text
            className={`font-mono text-xs font-semibold ${
              isReminder ? 'text-info' : 'text-accent-soft'
            }`}
          >
            {startStr} – {endStr}
          </Text>
        </View>

        {onRemove ? (
          <Pressable
            onPress={() => onRemove(event.id)}
            hitSlop={12}
            className="p-1 rounded-md active:bg-raised flex-shrink-0"
          >
            <NotionIcon name="close" size={12} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};
