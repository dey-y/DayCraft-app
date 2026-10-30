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

/**
 * DayStrip — Tira Horizontal Infinita de Días con Tarjetas Compactas (LUN · 27 · OCT)
 * - Rellena el 100% de la barra sin dejar huecos muertos.
 * - Muestra separadores visuales de mes cuando termina el mes actual y empieza el siguiente (ej. NOV, DIC).
 * - Soporta scroll infinito hacia adelante: al acercarse al final, genera dinámicamente el siguiente mes.
 */
export const DayStrip: React.FC = () => {
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
    <View className="w-full bg-[#12151d] border border-[#262b3a] px-2.5 py-2 rounded-2xl flex-row items-center gap-2">
      {/* Botón Anterior */}
      <Pressable
        onPress={() => shiftDay(-1)}
        className="w-8 h-12 rounded-xl bg-[#161922] border border-[#2d3345] items-center justify-center active:border-white flex-shrink-0"
      >
        <NotionIcon name="chevron-left" size={14} color="#8b949e" />
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
                <View className="h-12 px-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25 items-center justify-center flex-shrink-0">
                  <Text className="text-[9px] font-mono font-bold uppercase tracking-widest text-indigo-400">
                    {d.monthFull}
                  </Text>
                  <Text className="text-[9px] font-mono text-[#8b949e]">
                    {d.year}
                  </Text>
                </View>
              ) : null}

              <Pressable
                onPress={() => setSelectedDayKey(d.key)}
                style={{ width: cardWidth }}
                className={`py-2 px-2 rounded-xl border items-center justify-between flex-shrink-0 ${
                  isSelected
                    ? 'bg-indigo-600 border-indigo-400 shadow-md'
                    : d.isToday
                    ? 'bg-[#1f2430] border-indigo-500/50'
                    : 'bg-[#161922] border-[#262b3a]'
                }`}
              >
                {/* Fila Superior: Día de la Semana + Punto de Carga / Hoy */}
                <View className="flex-row items-center justify-center gap-1">
                  <Text
                    className={`text-[10px] uppercase font-bold tracking-wider ${
                      isSelected
                        ? 'text-indigo-100'
                        : d.isToday
                        ? 'text-indigo-400'
                        : 'text-[#8b949e]'
                    }`}
                  >
                    {d.dayName}
                  </Text>
                  {d.isToday ? (
                    <View
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected ? 'bg-white' : 'bg-emerald-400'
                      }`}
                    />
                  ) : hasEvents ? (
                    <View
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected ? 'bg-white' : 'bg-indigo-400'
                      }`}
                    />
                  ) : null}
                </View>

                {/* Número del Día + Mes Abreviado en formato compacto */}
                <View className="flex-row items-baseline justify-center gap-1 my-0.5">
                  <Text
                    className={`font-mono font-bold ${
                      isDesktop ? 'text-sm' : 'text-xs'
                    } ${isSelected ? 'text-white' : 'text-[#e6edf3]'}`}
                  >
                    {d.dayNum}
                  </Text>
                  <Text
                    className={`text-[9px] font-mono font-semibold uppercase ${
                      isSelected
                        ? 'text-indigo-200'
                        : d.isFirstOfMonth
                        ? 'text-indigo-400'
                        : 'text-[#8b949e]'
                    }`}
                  >
                    {d.monthShort}
                  </Text>
                </View>

                {/* Sub-etiqueta Inferior: "Hoy", contador de bloques o estado */}
                <Text
                  numberOfLines={1}
                  className={`text-[9px] font-medium ${
                    isSelected
                      ? 'text-white'
                      : d.isToday
                      ? 'text-emerald-400'
                      : hasEvents
                      ? 'text-indigo-300'
                      : 'text-[#8b949e]/50'
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
        className="w-8 h-12 rounded-xl bg-[#161922] border border-[#2d3345] items-center justify-center active:border-white flex-shrink-0"
      >
        <NotionIcon name="chevron-right" size={14} color="#8b949e" />
      </Pressable>
    </View>
  );
};
