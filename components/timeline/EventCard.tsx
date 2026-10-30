import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { TimelineEvent } from '@/services/db/sqlite';
import { formatQuarterToTime, formatQuartersToDuration } from '@/store/useDayCraftStore';
import { NotionIcon } from '@/components/ui/NotionIcon';

interface EventCardProps {
  event: TimelineEvent;
  onRemove?: (id: string) => void;
}

/**
 * EventCard — Tarjeta proporcional de bloque de trabajo o recordatorio puntual en el Timeline 24h.
 */
export const EventCard: React.FC<EventCardProps> = ({ event, onRemove }) => {
  const startStr = formatQuarterToTime(event.startQ);
  const endStr = formatQuarterToTime(event.startQ + event.quarters);
  const durationLabel = formatQuartersToDuration(event.quarters);
  const isReminder = event.type === 'reminder';

  return (
    <View
      className={`w-full bg-[#1f2430] border border-[#2d3345] border-l-4 ${
        isReminder ? 'border-l-sky-400' : 'border-l-indigo-500'
      } rounded-xl p-3 flex-row items-start justify-between gap-2`}
    >
      <View className="flex-1 min-w-0">
        <View className="flex-row items-center gap-2 flex-wrap mb-1">
          <View className="flex-row items-center gap-1">
            <NotionIcon
              name={isReminder ? 'reminder' : 'clock'}
              size={12}
              color={isReminder ? '#38bdf8' : '#818cf8'}
            />
            <Text
              className={`font-mono font-bold text-xs ${
                isReminder ? 'text-sky-400' : 'text-indigo-400'
              }`}
            >
              {startStr} — {endStr}
            </Text>
          </View>

          <View
            className={`px-1.5 py-0.5 rounded ${
              isReminder ? 'bg-sky-500/15' : 'bg-indigo-500/15'
            }`}
          >
            <Text
              className={`text-[9px] font-mono font-bold ${
                isReminder ? 'text-sky-300' : 'text-indigo-300'
              }`}
            >
              {isReminder ? 'Aviso' : durationLabel}
            </Text>
          </View>

          {event.tag ? (
            <View className="px-2 py-0.5 rounded-full bg-[#161922] border border-[#262b3a]">
              <Text className="text-[9px] font-medium text-[#8b949e]">
                {event.tag}
              </Text>
            </View>
          ) : null}
        </View>

        <Text numberOfLines={1} className="font-bold text-xs text-white">
          {event.title}
        </Text>

        {event.desc ? (
          <Text numberOfLines={2} className="text-[11px] text-[#8b949e] mt-0.5">
            {event.desc}
          </Text>
        ) : null}
      </View>

      <View className="flex-row items-center gap-1.5 flex-shrink-0">
        <View
          className={`px-2 py-0.5 rounded border ${
            isReminder
              ? 'bg-sky-500/15 border-sky-500/30'
              : 'bg-indigo-500/15 border-indigo-500/30'
          }`}
        >
          <Text
            className={`text-[9px] font-mono ${
              isReminder ? 'text-sky-300' : 'text-indigo-300'
            }`}
          >
            {isReminder ? 'Puntual' : 'Agendada'}
          </Text>
        </View>
        {onRemove ? (
          <Pressable
            onPress={() => onRemove(event.id)}
            hitSlop={8}
            className="p-1 rounded-lg active:bg-[#161922]"
          >
            <NotionIcon name="close" size={12} color="#8b949e" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};
