import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  useWindowDimensions,
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
      scrollRef.current?.scrollTo({ x: offset, animated: true });
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
    <View className="w-full bg-header border border-line-subtle px-2.5 py-2 rounded-2xl flex-row items-center gap-2">
      {/* Botón Anterior */}
      <Pressable
        onPress={() => shiftDay(-1)}
        className="w-8 h-12 rounded-xl bg-card border border-line items-center justify-center active:border-ink flex-shrink-0"
      >
        <NotionIcon name="chevron-left" size={14} color={colors.muted} />
      </Pressable>

      {/* Tira Horizontal Deslizable Continua (Multimes) */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={32}
        contentContainerStyle={{
          gap: 8,
          paddingHorizontal: 4,
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
              {/* Divisor visual cuando cambia de mes (ej. Fin de Octubre -> 01 NOVIEMBRE) */}
              {showMonthDivider ? (
                <View className="h-12 px-2.5 rounded-xl bg-accent/10 border border-accent/25 items-center justify-center flex-shrink-0">
                  <Text className="text-[9px] font-mono font-bold uppercase tracking-widest text-accent-soft">
                    {d.monthFull}
                  </Text>
                  <Text className="text-[9px] font-mono text-muted">
                    {d.year}
                  </Text>
                </View>
              ) : null}

              <Pressable
                onPress={() => setSelectedDayKey(d.key)}
                style={{ width: cardWidth }}
                className={`py-2.5 px-2 rounded-xl border items-center justify-between flex-shrink-0 ${
                  isSelected
                    ? 'bg-accent/20 border-accent'
                    : d.isToday
                    ? 'bg-raised border-accent/50'
                    : 'bg-card border-line-subtle'
                }`}
              >
                {/* Fila Superior: Día de la Semana + Punto de Carga / Hoy */}
                <View className="flex-row items-center justify-center gap-1">
                  <Text
                    className={`text-[11px] uppercase font-bold tracking-wider ${
                      isSelected
                        ? 'text-accent-soft'
                        : d.isToday
                        ? 'text-accent-soft'
                        : 'text-muted'
                    }`}
                  >
                    {d.dayName}
                  </Text>
                  {d.isToday ? (
                    <View
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected ? 'bg-ink' : 'bg-ok'
                      }`}
                    />
                  ) : hasEvents ? (
                    <View
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected ? 'bg-ink' : 'bg-accent'
                      }`}
                    />
                  ) : null}
                </View>

                {/* Número del Día + Mes Abreviado en formato compacto */}
                <View className="flex-row items-baseline justify-center gap-1 my-0.5">
                  <Text
                    className={`font-mono font-bold text-sm ${
                      isSelected ? 'text-ink' : 'text-ink'
                    }`}
                  >
                    {d.dayNum}
                  </Text>
                  <Text
                    className={`text-[10px] font-mono font-semibold uppercase ${
                      isSelected
                        ? 'text-accent-soft'
                        : d.isFirstOfMonth
                        ? 'text-accent-soft'
                        : 'text-muted'
                    }`}
                  >
                    {d.monthShort}
                  </Text>
                </View>

                {/* Sub-etiqueta Inferior: "Hoy", contador de bloques o estado */}
                <Text
                  numberOfLines={1}
                  className={`text-[10.5px] font-medium ${
                    isSelected
                      ? 'text-ink font-semibold'
                      : d.isToday
                      ? 'text-ok font-semibold'
                      : hasEvents
                      ? 'text-accent-soft'
                      : 'text-muted/60'
                  }`}
                >
                  {d.isToday
                    ? 'Hoy'
                    : hasEvents
                    ? `${dayEventsCount} ${dayEventsCount === 1 ? 'blq' : 'blqs'}`
                    : 'Libre'}
                </Text>
              </Pressable>
            </React.Fragment>
          );
        })}
      </ScrollView>

      {/* Botón Siguiente (Avanza 5 días para explorar rápido el mes siguiente) */}
      <Pressable
        onPress={() => shiftDay(isDesktop ? 5 : 1)}
        className="w-8 h-12 rounded-xl bg-card border border-line items-center justify-center active:border-ink flex-shrink-0"
      >
        <NotionIcon name="chevron-right" size={14} color={colors.muted} />
      </Pressable>
    </View>
  );
};
