import React from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useDayCraftStore, doesEventApplyToDay } from '@/store/useDayCraftStore';
import { LAYOUT, getTodayKey } from '@/constants/theme';
import { DayStrip } from '@/components/timeline/DayStrip';
import { Rail24h } from '@/components/timeline/Rail24h';
import { NotionIcon } from '@/components/ui/NotionIcon';
import { useTheme } from '@/store/useThemeStore';

/**
 * Pantalla Principal: Timeline 24h Heroico estilo Notion Calendar / Cron
 * - Sin recuadros ni bordes pesados anidados: la cabecera y la tira de días fluyen
 *   directamente sobre `bg-canvas` dejando que el calendario respire al 100%.
 */
export default function TimelineScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= LAYOUT.desktopBreakpoint;

  const days = useDayCraftStore((s) => s.days);
  const selectedDayKey = useDayCraftStore((s) => s.selectedDayKey);
  const setSelectedDayKey = useDayCraftStore((s) => s.setSelectedDayKey);
  const events = useDayCraftStore((s) => s.events);
  const pendingTasks = useDayCraftStore((s) => s.pendingTasks);

  const todayKey = getTodayKey();
  const activeDay =
    days.find((d) => d.key === selectedDayKey) ||
    days.find((d) => d.key === todayKey) ||
    days[0];
  const dayEventsCount = events.filter((e) =>
    activeDay ? doesEventApplyToDay(e, activeDay) : e.dayKey === selectedDayKey
  ).length;
  const pendingCount = pendingTasks.filter((t) => !t.completed).length;

  const nextMonthFirstDay = days.find(
    (d) => d.isFirstOfMonth && d.monthShort !== activeDay?.monthShort
  );

  return (
    <View
      style={{ paddingBottom: isDesktop ? 12 : 8 }}
      className="flex-1 bg-canvas px-4 sm:px-6 pt-2.5 gap-2"
    >
      {/* Cabecera Aireada del Día (Sin caja ni borde pesado) */}
      <View className="flex-row items-center justify-between gap-2 px-1">
        <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
          <View
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              activeDay?.isToday ? 'bg-ok' : 'bg-accent'
            }`}
          />
          <Text
            numberOfLines={1}
            className="font-bold text-base sm:text-lg text-ink flex-shrink tracking-tight"
          >
            {activeDay?.fullTitle}
          </Text>

          <Text className="text-xs font-mono text-muted flex-shrink-0">
            ·{' '}
            {dayEventsCount === 0
              ? 'Día despejado'
              : `${dayEventsCount} ${
                  dayEventsCount === 1 ? 'bloque' : 'bloques'
                }`}
          </Text>
        </View>

        <View className="flex-row items-center gap-2 flex-shrink-0">
          {!isDesktop && pendingCount > 0 ? (
            <Pressable
              onPress={() => router.push('/pending')}
              className="min-h-[40px] px-3 rounded-xl bg-warm/10 flex-row items-center gap-1"
            >
              <Text className="text-xs font-semibold text-warm">
                {pendingCount} pend. →
              </Text>
            </Pressable>
          ) : null}

          {nextMonthFirstDay && isDesktop ? (
            <Pressable
              onPress={() => setSelectedDayKey(nextMonthFirstDay.key)}
              className="min-h-[40px] px-3 rounded-xl flex-row items-center gap-1.5 active:bg-raised"
            >
              <NotionIcon name="calendar" size={13} color={colors.muted} />
              <Text className="text-xs font-mono font-semibold text-muted">
                {nextMonthFirstDay.monthShort}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => setSelectedDayKey(todayKey)}
            className={`min-h-[40px] px-3.5 rounded-xl justify-center ${
              activeDay?.isToday ? 'bg-accent/15' : 'bg-card border border-line-subtle'
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                activeDay?.isToday ? 'text-accent-soft' : 'text-ink'
              }`}
            >
              Hoy
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Tira Horizontal Minimalista de Días */}
      <DayStrip />

      {/* Lienzo 24h Limpio a Pantalla Completa */}
      <Rail24h />
    </View>
  );
}
