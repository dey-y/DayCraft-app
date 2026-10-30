import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { TimelineEvent } from '@/services/db/sqlite';
import { formatQuarterToTime } from '@/store/useDayCraftStore';
import { NotionIcon } from '@/components/ui/NotionIcon';

interface EventCardProps {
  event: TimelineEvent;
  compact?: boolean;
  onRemove?: (id: string) => void;
}

/**
 * EventCard — Bloque ligero y translúcido estilo Google Calendar / Linear.
 * - El texto y la hora siempre aparecen pegados arriba al principio (`items-start justify-start`), nunca flotando en mitad del bloque.
 * - Fondo translúcido sutil (`bg-indigo-500/12`) que deja respirar la cuadrícula de horas por debajo sin formar un "ladrillo" pesado cuando dura 2h+.
 */
export const EventCard: React.FC<EventCardProps> = ({
  event,
  compact = false,
  onRemove,
}) => {
  const startStr = formatQuarterToTime(event.startQ);
  const endStr = formatQuarterToTime(event.startQ + event.quarters);
  const isReminder = event.type === 'reminder';
  const hasRecurrence =
    event.recurrence && event.recurrence.frequency !== 'none';

  return (
    <View
      className={`w-full h-full border border-l-[3px] rounded-xl px-3 ${
        compact ? 'py-1' : 'py-2'
      } ${
        isReminder
          ? 'bg-sky-500/10 border-sky-500/25 border-l-sky-400'
          : 'bg-indigo-500/12 border-indigo-500/25 border-l-indigo-400'
      } flex-row items-start justify-between gap-2 overflow-hidden`}
    >
      <View className="flex-1 min-w-0 flex-row items-center gap-2 flex-wrap">
        <Text
          numberOfLines={1}
          className="font-semibold text-xs text-white flex-shrink"
        >
          {event.title}
        </Text>

        <Text
          numberOfLines={1}
          className={`font-mono text-[10px] ${
            isReminder ? 'text-sky-300' : 'text-indigo-300'
          }`}
        >
          {startStr} – {endStr}
          {hasRecurrence ? ' · ↻' : ''}
        </Text>
      </View>

      {onRemove ? (
        <Pressable
          onPress={() => onRemove(event.id)}
          hitSlop={8}
          className="p-0.5 rounded-md active:bg-[#161922]/60 flex-shrink-0"
        >
          <NotionIcon name="close" size={11} color="#8b949e" />
        </Pressable>
      ) : null}
    </View>
  );
};
