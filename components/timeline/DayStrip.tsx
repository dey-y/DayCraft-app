import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useDayCraftStore, doesEventApplyToDay } from '@/store/useDayCraftStore';
import { LAYOUT } from '@/constants/theme';
import { NotionIcon } from '@/components/ui/NotionIcon';
import { useTheme } from '@/store/useThemeStore';

/**
 * DayStrip — Tira Horizontal Infinita de Días con Tarjetas Compactas (LUN · 27 · OCT)
 * - Rellena el 100% de la barra sin dejar huecos muertos.
 * - Muestra separadores visuales de mes cuando termina el mes actual y empieza el siguiente (ej. NOV, DIC).
 * - Soporta scroll infinito hacia adelante: al acercarse al final, genera dinámicamente el siguiente mes.
 */
export const DayStrip: React.FC = () => {
  const { colors } = useTheme();
  const days = useDayCraftStore((s) => s.days);
  const selectedDayKey = useDayCraftStore((s) => s.selectedDayKey);
  const setSelectedDayKey = useDayCraftStore((s) => s.setSelectedDayKey);
  const shiftDay = useDayCraftStore((s) => s.shiftDay);
  const extendFutureDays = useDayCraftStore((s) => s.extendFutureDays);
  const events = useDayCraftStore((s) => s.events);

  const { width } = useWindowDimensions();
  const isDesktop = width >= LAYOUT.desktopBreakpoint;
  const scrollRef = useRef<ScrollView>(null);
  const cardWidth = isDesktop ? 76 : 62;

  // Auto-scroll suave para mantener centrado el día activo al cambiar con botones o "Hoy"
  useEffect(() => {
    const idx = days.findIndex((d) => d.key === selectedDayKey);
    if (idx === -1) return;
    const offset = Math.max(0, (idx - 2) * (cardWidth + 8));
    const timer = setTimeout(() => {
      if (Platform.OS === 'web') {
        const node = (scrollRef.current as any)?.getScrollableNode?.() || scrollRef.current;
        if (node?.scrollTo) {
          node.scrollTo({ left: offset, behavior: 'smooth' });
        } else {
          scrollRef.current?.scrollTo({ x: offset, animated: true });
        }
      } else {
        scrollRef.current?.scrollTo({ x: offset, animated: true });
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [selectedDayKey, cardWidth]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const distanceFromEnd =
      contentSize.width - (layoutMeasurement.width + contentOffset.x);
    if (distanceFromEnd < 320) {
      extendFutureDays(30);
    }
  };

  return (
    <View className="w-full bg-header border border-line-subtle px-2 py-1.5 rounded-2xl flex-row items-center gap-2">
      {/* Botón Anterior */}
      <Pressable
        onPress={() => shiftDay(-1)}
        className="w-8 h-9 rounded-xl bg-card border border-line items-center justify-center active:border-ink flex-shrink-0"
      >
        <NotionIcon name="chevron-left" size={14} color={colors.muted} />
      </Pressable>

      {/* Tira Horizontal Deslizable Continua (Pastillas / Pills estilo Kuro-Zen) */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={32}
        contentContainerStyle={{
          gap: 6,
          paddingHorizontal: 2,
          alignItems: 'center',
        }}
        className="flex-1"
      >
        {days.map((d, index) => {
          const isSelected = d.key === selectedDayKey;
          const dayEventsCount = events.filter((ev) =>
            doesEventApplyToDay(ev, d)
          ).length;
          const hasEvents = dayEventsCount > 0;
          const showMonthDivider = d.isFirstOfMonth && index > 0;

          return (
            <React.Fragment key={d.isoDate}>
              {/* Separador de Mes compacto */}
              {showMonthDivider ? (
                <View className="px-2.5 py-1 rounded-lg bg-accent/10 border border-accent/25 items-center justify-center flex-shrink-0">
                  <Text className="text-[10px] font-mono font-bold uppercase tracking-widest text-accent-soft">
                    {d.monthShort}
                  </Text>
                </View>
              ) : null}

              {/* Pastilla del Día */}
              <Pressable
                onPress={() => setSelectedDayKey(d.key)}
                className={`px-3.5 py-2 rounded-xl border flex-row items-center gap-1.5 flex-shrink-0 active:opacity-85 ${
                  isSelected
                    ? 'bg-accent/20 border-accent'
                    : d.isToday
                    ? 'bg-raised border-accent/40'
                    : 'bg-card border-line-subtle'
                }`}
              >
                <Text
                  className={`text-xs ${
                    isSelected
                      ? 'font-bold text-ink'
                      : d.isToday
                      ? 'font-bold text-accent-soft'
                      : 'font-semibold text-muted'
                  }`}
                >
                  {d.isToday ? `HOY ${d.dayNum}` : `${d.dayName} ${d.dayNum}`}
                </Text>

                {hasEvents ? (
                  <View
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSelected ? 'bg-accent-soft' : 'bg-accent/70'
                    }`}
                  />
                ) : null}
              </Pressable>
            </React.Fragment>
          );
        })}
      </ScrollView>

      {/* Botón Siguiente (Avanza 1 día) */}
      <Pressable
        onPress={() => shiftDay(1)}
        className="w-8 h-9 rounded-xl bg-card border border-line items-center justify-center active:border-ink flex-shrink-0"
      >
        <NotionIcon name="chevron-right" size={14} color={colors.muted} />
      </Pressable>
    </View>
  );
};
