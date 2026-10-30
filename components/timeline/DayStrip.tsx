import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useDayCraftStore } from '@/store/useDayCraftStore';

/**
 * DayStrip — Tira horizontal interactiva de días con puntos indicadores de carga de trabajo.
 */
export const DayStrip: React.FC = () => {
  const days = useDayCraftStore((s) => s.days);
  const selectedDayKey = useDayCraftStore((s) => s.selectedDayKey);
  const setSelectedDayKey = useDayCraftStore((s) => s.setSelectedDayKey);
  const shiftDay = useDayCraftStore((s) => s.shiftDay);
  const events = useDayCraftStore((s) => s.events);

  return (
    <View className="bg-[#161922] border border-[#2d3345] p-2 rounded-2xl flex-row items-center gap-1.5">
      <Pressable
        onPress={() => shiftDay(-1)}
        className="w-7 h-7 rounded-lg bg-[#0d1117] border border-[#262b3a] items-center justify-center active:border-white"
      >
        <Text className="text-xs font-bold text-[#8b949e]">‹</Text>
      </Pressable>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingHorizontal: 2 }}
        className="flex-1"
      >
        {days.map((d) => {
          const isSelected = d.key === selectedDayKey;
          const hasEvents = events.some((ev) => ev.dayKey === d.key);

          return (
            <Pressable
              key={d.key}
              onPress={() => setSelectedDayKey(d.key)}
              className={`px-3 py-1.5 rounded-xl flex-col items-center justify-center min-w-[46px] border ${
                isSelected
                  ? 'bg-white border-white'
                  : d.isToday
                  ? 'bg-[#1f2430] border-indigo-500/40'
                  : 'bg-[#0d1117] border-[#262b3a]'
              }`}
            >
              <Text
                className={`text-[9px] uppercase font-bold tracking-wider ${
                  isSelected
                    ? 'text-black'
                    : d.isToday
                    ? 'text-indigo-400'
                    : 'text-[#8b949e]'
                }`}
              >
                {d.dayName}
              </Text>
              <Text
                className={`text-xs font-mono font-bold mt-0.5 ${
                  isSelected ? 'text-black' : 'text-white'
                }`}
              >
                {d.dayNum}
              </Text>
              <View
                className={`w-1.5 h-1.5 rounded-full mt-1 ${
                  d.isToday
                    ? isSelected
                      ? 'bg-emerald-600'
                      : 'bg-emerald-400'
                    : hasEvents
                    ? isSelected
                      ? 'bg-black'
                      : 'bg-indigo-400'
                    : 'bg-transparent'
                }`}
              />
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable
        onPress={() => shiftDay(1)}
        className="w-7 h-7 rounded-lg bg-[#0d1117] border border-[#262b3a] items-center justify-center active:border-white"
      >
        <Text className="text-xs font-bold text-[#8b949e]">›</Text>
      </Pressable>
    </View>
  );
};
