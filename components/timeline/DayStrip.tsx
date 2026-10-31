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
 * DayStrip — Tira Horizontal de Días Multimes (Estilo Kuro-Zen / Japandi)
 * - Navegación fluida por días y meses continuos (scroll infinito con extensiones dinámicas de 60 días).
 * - Flechas `<` y `>` que avanzan/retroceden el día y deslizan físicamente la tira.
 * - Soporte completo en Web para rueda de ratón (scroll vertical convertido a horizontal) y arrastre con ratón (drag-to-scroll).
 * - Separadores visuales sutiles entre meses (`NOV`, `DIC`, `ENE`).
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
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  // Obtiene el elemento HTMLDivElement real subyacente en React Native Web
  const getDomScrollElement = (): HTMLElement | null => {
    if (Platform.OS !== 'web' || !scrollRef.current) return null;
    const anyRef = scrollRef.current as any;
    const node =
      anyRef.getScrollableNode?.() ||
      anyRef._scrollNodeRef ||
      anyRef._nativeRef ||
      anyRef;
    return node instanceof HTMLElement ? node : null;
  };

  // Función de scroll centrada que funciona tanto en Web como en móvil nativo
  const scrollToDay = (idx: number, animated = true) => {
    if (idx < 0) return;
    const targetOffset = Math.max(0, idx * 88 - (isDesktop ? 220 : 100));

    // Llamada nativa React Native
    scrollRef.current?.scrollTo({ x: targetOffset, y: 0, animated });

    // Llamada nativa Web DOM sin verse afectada por el polyfill de React Native Web
    if (Platform.OS === 'web') {
      const el = getDomScrollElement();
      if (el) {
        if (typeof HTMLElement.prototype.scrollTo === 'function') {
          try {
            (HTMLElement.prototype.scrollTo as any).call(el, {
              left: targetOffset,
              top: 0,
              behavior: animated ? 'smooth' : 'auto',
            });
          } catch {
            el.scrollLeft = targetOffset;
          }
        } else {
          el.scrollLeft = targetOffset;
        }
      }
    }
  };

  // Auto-scroll para centrar el día seleccionado
  useEffect(() => {
    const idx = days.findIndex((d) => d.key === selectedDayKey);
    if (idx === -1) return;
    const timer = setTimeout(() => {
      scrollToDay(idx, true);
    }, 40);
    return () => clearTimeout(timer);
  }, [selectedDayKey, isDesktop]);

  // Soporte de rueda de ratón, drag-to-scroll y scroll infinito en escritorio Web
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = getDomScrollElement();
    if (!el) return;

    // 1. Rueda de ratón: desplazamiento horizontal suave
    const handleWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta !== 0) {
        e.preventDefault();
        el.scrollLeft += delta;
      }
    };

    // 2. Drag-to-scroll con ratón (hacer clic y arrastrar para mover libremente los días)
    let isDragging = false;
    let startX = 0;
    let scrollStart = 0;
    let hasMoved = false;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      isDragging = true;
      hasMoved = false;
      startX = e.pageX;
      scrollStart = el.scrollLeft;
      el.style.cursor = 'grabbing';
      el.style.userSelect = 'none';
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.pageX - startX;
      if (Math.abs(dx) > 4) {
        hasMoved = true;
      }
      el.scrollLeft = scrollStart - dx;
    };

    const handleMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        el.style.cursor = 'grab';
        el.style.removeProperty('user-select');
      }
    };

    const handleClickCapture = (e: MouseEvent) => {
      if (hasMoved) {
        e.stopPropagation();
        e.preventDefault();
        hasMoved = false;
      }
    };

    // 3. Scroll infinito: cargar dinámicamente futuros meses
    const handleScrollWeb = () => {
      if (el.scrollWidth - (el.scrollLeft + el.clientWidth) < 600) {
        extendFutureDays(60);
      }
    };

    el.style.cursor = 'grab';
    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    el.addEventListener('click', handleClickCapture, true);
    el.addEventListener('scroll', handleScrollWeb, { passive: true });

    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      el.removeEventListener('click', handleClickCapture, true);
      el.removeEventListener('scroll', handleScrollWeb);
    };
  }, [days.length, extendFutureDays]);

  // Manejador de scroll nativo para móviles (iOS / Android)
  const handleScrollNative = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const distanceFromEnd =
      contentSize.width - (layoutMeasurement.width + contentOffset.x);
    if (distanceFromEnd < 600) {
      extendFutureDays(60);
    }
  };

  const handleScrollRight = () => {
    const currentIdx = days.findIndex((d) => d.key === selectedDayKey);
    const safeIdx = currentIdx === -1 ? 0 : currentIdx;
    if (safeIdx >= days.length - 10) {
      extendFutureDays(60);
    }
    const nextIdx = Math.min(days.length - 1, safeIdx + 1);
    shiftDay(1);
    scrollToDay(nextIdx, true);
  };

  const handleScrollLeft = () => {
    const currentIdx = days.findIndex((d) => d.key === selectedDayKey);
    const safeIdx = currentIdx === -1 ? 0 : currentIdx;
    const prevIdx = Math.max(0, safeIdx - 1);
    shiftDay(-1);
    scrollToDay(prevIdx, true);
  };

  return (
    <View className="w-full bg-header border border-line-subtle px-2 py-1.5 rounded-2xl flex-row items-center gap-2">
      {/* Botón Anterior (Retrocede 1 día y desliza la tira) */}
      <Pressable
        onPress={handleScrollLeft}
        hitSlop={8}
        className="w-8 h-9 rounded-xl bg-card border border-line items-center justify-center active:border-ink flex-shrink-0"
      >
        <NotionIcon name="chevron-left" size={14} color={colors.muted} />
      </Pressable>

      {/* Tira Horizontal Deslizable Continua (Pastillas estilo Kuro-Zen) */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={handleScrollNative}
        scrollEventThrottle={32}
        style={{ flex: 1, minWidth: 0 }}
        contentContainerStyle={{
          gap: 6,
          paddingHorizontal: 2,
          alignItems: 'center',
        }}
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
                onPress={() => {
                  setSelectedDayKey(d.key);
                  scrollToDay(index, true);
                }}
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

      {/* Botón Siguiente (Avanza 1 día y desliza la tira) */}
      <Pressable
        onPress={handleScrollRight}
        hitSlop={8}
        className="w-8 h-9 rounded-xl bg-card border border-line items-center justify-center active:border-ink flex-shrink-0"
      >
        <NotionIcon name="chevron-right" size={14} color={colors.muted} />
      </Pressable>
    </View>
  );
};
