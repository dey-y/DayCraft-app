import React from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useDayCraftStore, doesEventApplyToDay } from '@/store/useDayCraftStore';
import { LAYOUT } from '@/constants/theme';
import { DayStrip } from '@/components/timeline/DayStrip';
import { Rail24h } from '@/components/timeline/Rail24h';
import { NotionIcon } from '@/components/ui/NotionIcon';
import { useTheme } from '@/store/useThemeStore';

/**
 * Tab 4 (Index Heroico): Timeline 24h + DayStrip Infinito Multimes
 * - Incluye barra superior limpia con el título completo del día, indicador de mes/año,
 *   píldora rápida de pendientes y botón de salto rápido al Mes Siguiente o Hoy.
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

  const activeDay =
    days.find((d) => d.key === selectedDayKey) || days[7] || days[0];
  const dayEventsCount = events.filter((e) =>
    activeDay ? doesEventApplyToDay(e, activeDay) : e.dayKey === selectedDayKey
  ).length;
  const pendingCount = pendingTasks.filter((t) => !t.completed).length;

  // Buscar el primer día del próximo mes para permitir saltar directo si se desea
  const nextMonthFirstDay = days.find(
    (d) => d.isFirstOfMonth && d.monthShort !== activeDay?.monthShort
  );

  return (
    <View
      style={{ paddingBottom: isDesktop ? 16 : 60 }}
      className="flex-1 bg-canvas px-4 pt-3 gap-3"
    >
      {/* Cabecera Superior del Lienzo (Estilo Cockpit v9) */}
      <View className="bg-header border border-line-subtle rounded-2xl px-3.5 py-2.5 flex-row items-center justify-between gap-2">
        <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
          <View
            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              activeDay?.isToday ? 'bg-ok' : 'bg-accent'
            }`}
          />
          <Text
            numberOfLines={1}
            className="font-bold text-xs sm:text-sm text-ink flex-shrink"
          >
            {activeDay?.fullTitle}
          </Text>

          <View className="px-2 py-0.5 rounded-full bg-raised border border-line flex-shrink-0">
            <Text className="text-xs font-mono text-muted">
              {dayEventsCount === 0
                ? 'Día despejado'
                : `${dayEventsCount} ${
                    dayEventsCount === 1 ? 'bloque' : 'bloques'
                  }`}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-1.5 flex-shrink-0">
          {!isDesktop && pendingCount > 0 ? (
            <Pressable
              onPress={() => router.push('/pending')}
              className="px-3 py-1.5 rounded-lg bg-warm/15 border border-warm/30 flex-row items-center gap-1 active:opacity-80"
            >
              <Text className="text-xs font-semibold text-warm">
                {pendingCount} pend. →
              </Text>
            </Pressable>
          ) : null}

          {nextMonthFirstDay && isDesktop ? (
            <Pressable
              onPress={() => setSelectedDayKey(nextMonthFirstDay.key)}
              className="px-3 py-1.5 rounded-lg bg-card border border-line flex-row items-center gap-1.5 active:border-ink"
            >
              <NotionIcon name="calendar" size={12} color={colors.accentSoft} />
              <Text className="text-xs font-mono font-semibold text-accent-soft">
                Ir a {nextMonthFirstDay.monthShort}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => setSelectedDayKey('27')}
            className={`px-3 py-1.5 rounded-lg border active:opacity-80 ${
              activeDay?.isToday
                ? 'bg-accent/20 border-accent'
                : 'bg-raised border-line'
            }`}
          >
            <Text className="text-xs font-bold text-ink">Hoy</Text>
          </Pressable>
        </View>
      </View>

      {/* Tira Horizontal Deslizable Multimes */}
      <DayStrip />

      {/* Raíl Físico Continuo de 24 Horas */}
      <Rail24h />
    </View>
  );
}
