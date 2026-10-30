import React from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useDayCraftStore } from '@/store/useDayCraftStore';
import { LAYOUT } from '@/constants/theme';
import { DayStrip } from '@/components/timeline/DayStrip';
import { Rail24h } from '@/components/timeline/Rail24h';

/**
 * Tab 4 (Index Heroico): Timeline 24h + DayStrip
 * - En móvil incluye la píldora rápida `N pendientes →` y botón `Hoy`.
 * - En escritorio aprovecha todo el lienzo central con snapping de 15 minutos.
 */
export default function TimelineScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= LAYOUT.desktopBreakpoint;

  const days = useDayCraftStore((s) => s.days);
  const selectedDayKey = useDayCraftStore((s) => s.selectedDayKey);
  const setSelectedDayKey = useDayCraftStore((s) => s.setSelectedDayKey);
  const events = useDayCraftStore((s) => s.events);
  const pendingTasks = useDayCraftStore((s) => s.pendingTasks);

  const activeDay = days.find((d) => d.key === selectedDayKey) || days[2];
  const dayEventsCount = events.filter((e) => e.dayKey === selectedDayKey).length;
  const pendingCount = pendingTasks.filter((t) => !t.completed).length;

  return (
    <View
      style={{ paddingBottom: isDesktop ? 16 : 74 }}
      className="flex-1 bg-[#0d1117] px-4 pt-3 gap-3"
    >
      {/* Tira Deslizable de Días */}
      <DayStrip />

      {/* Cabecera del Día Activo en el Timeline */}
      <View className="flex-row items-center justify-between px-1">
        <View className="flex-row items-center gap-2 flex-1 min-w-0">
          <View className="w-2 h-2 rounded-full bg-emerald-400" />
          <Text numberOfLines={1} className="font-bold text-xs text-white flex-shrink">
            {activeDay.fullTitle}
          </Text>
          <View className="px-2 py-0.5 rounded-md bg-[#1f2430] border border-[#2d3345]">
            <Text className="text-[10px] font-mono text-[#8b949e]">
              {dayEventsCount} {dayEventsCount === 1 ? 'bloque' : 'bloques'}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-1.5 flex-shrink-0">
          {!isDesktop && pendingCount > 0 ? (
            <Pressable
              onPress={() => router.push('/pending')}
              className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 flex-row items-center gap-1"
            >
              <Text className="text-[10px] font-semibold text-amber-400">
                {pendingCount} {pendingCount === 1 ? 'pendiente' : 'pendientes'} →
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => setSelectedDayKey('27')}
            className="px-2.5 py-1 rounded-lg bg-[#1f2430] border border-[#2d3345] active:bg-white"
          >
            <Text className="text-[10px] font-bold text-white">Hoy</Text>
          </Pressable>
        </View>
      </View>

      {/* Raíl Físico Continuo de 24 Horas */}
      <Rail24h />
    </View>
  );
}
