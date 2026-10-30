import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Platform,
  useWindowDimensions,
} from 'react-native';
import {
  useDayCraftStore,
  formatQuarterToTime,
  formatQuartersToDuration,
  doesEventApplyToDay,
  SlotPickerTarget,
} from '@/store/useDayCraftStore';
import { LAYOUT } from '@/constants/theme';
import { EventCard } from './EventCard';
import { NotionIcon } from '@/components/ui/NotionIcon';
import { useTheme } from '@/store/useThemeStore';

interface Rail24hProps {
  onRequestSlotPicker?: (target: SlotPickerTarget) => void;
}

/**
 * Rail24h — Timeline 24h estilo Google Calendar (100% Limpio + Snapping por Cuartos de Hora 15m).
 * - Cero textos repetitivos en horas vacías: únicamente las 24 líneas horarias y una línea tenue de media hora (:30).
 * - Los eventos y el bloque en creación ("Ghost Preview Block") se posicionan con coordenadas absolutas
 *   exactas (`top = startQ * quarterHeight`, `height = quarters * quarterHeight`), pudiendo abarcar
 *   cualquier rango de 15m, 30m, 45m, 1h15m o cruzar varias horas igual que en Google Calendar.
 * - Incluye la línea roja horizontal en vivo de la hora actual con su nodo circular en el borde izquierdo.
 */
export const Rail24h: React.FC<Rail24hProps> = ({ onRequestSlotPicker }) => {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= LAYOUT.desktopBreakpoint;

  const selectedDayKey = useDayCraftStore((s) => s.selectedDayKey);
  const days = useDayCraftStore((s) => s.days);
  const allEvents = useDayCraftStore((s) => s.events);
  const removeTimelineEvent = useDayCraftStore((s) => s.removeTimelineEvent);
  const openSlotPicker = useDayCraftStore((s) => s.openSlotPicker);

  const scrollRef = useRef<ScrollView>(null);
  const gridContainerRef = useRef<View>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartClientY = useRef<number | null>(null);
  const touchStartClientX = useRef<number | null>(null);
  const touchStartQ = useRef<number | null>(null);
  const isTouchDragging = useRef<boolean>(false);

  // Dimensiones exactas de la cuadrícula estilo Google Calendar (más compacta para que 2h no se vea gigante)
  const quarterHeight = isDesktop ? 14 : 13; // 15 min = 14px (1 hora = 56px en desktop, 52px en móvil)
  const hourHeight = quarterHeight * 4;
  const totalCanvasHeight = 24 * hourHeight;
  const hourColumnWidth = isDesktop ? 62 : 48;

  const [isDragging, setIsDragging] = useState(false);
  const [dragStartQ, setDragStartQ] = useState<number | null>(null);
  const [dragCurrentQ, setDragCurrentQ] = useState<number | null>(null);
  const [hoverQuarter, setHoverQuarter] = useState<number | null>(null);

  const activeDay =
    days.find((d) => d.key === selectedDayKey) || days[7] || days[0];
  const dayEvents = allEvents.filter((e) =>
    activeDay ? doesEventApplyToDay(e, activeDay) : e.dayKey === selectedDayKey
  );

  // Auto-scroll inicial hacia las 09:00 o el primer evento del día
  useEffect(() => {
    const firstHour =
      dayEvents.length > 0 ? Math.floor(dayEvents[0].startQ / 4) : 9;
    const targetY = Math.max(0, (firstHour - 1) * hourHeight);
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: targetY, animated: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [selectedDayKey, hourHeight]);

  // Finalizar arrastre en Web para abrir el creador con el rango exacto seleccionado
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleMouseUp = () => {
      if (!isDragging || dragStartQ === null || dragCurrentQ === null) return;
      const minQ = Math.min(dragStartQ, dragCurrentQ);
      const maxQ = Math.max(dragStartQ, dragCurrentQ);
      // Si fue un clic simple sin arrastrar (minQ === maxQ), por defecto damos 2 cuartos (30 min) como Google Calendar
      const quarters = minQ === maxQ ? 2 : maxQ - minQ + 1;

      setIsDragging(false);
      setDragStartQ(null);
      setDragCurrentQ(null);

      const target: SlotPickerTarget = {
        type: 'direct_hour',
        title: '',
        defaultStartQ: minQ,
        defaultQuarters: quarters,
      };
      if (onRequestSlotPicker) {
        onRequestSlotPicker(target);
      } else {
        openSlotPicker(target);
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, [isDragging, dragStartQ, dragCurrentQ, onRequestSlotPicker, openSlotPicker]);

  // Prevenir que el navegador haga scroll táctil mientras se está estirando un bloque con long-press
  useEffect(() => {
    if (Platform.OS !== 'web' || !isDragging) return;

    const preventTouchScroll = (e: TouchEvent) => {
      if (e.cancelable) {
        e.preventDefault();
      }
    };

    window.addEventListener('touchmove', preventTouchScroll, { passive: false });
    return () => {
      window.removeEventListener('touchmove', preventTouchScroll);
    };
  }, [isDragging]);

  const handleTouchStart = (e: any) => {
    const touch = e.touches?.[0] || e.nativeEvent?.touches?.[0];
    if (!touch) return;

    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    touchStartClientY.current = touch.clientY;
    touchStartClientX.current = touch.clientX;
    isTouchDragging.current = false;

    const targetElement = e.currentTarget || e.target;
    const rect = targetElement?.getBoundingClientRect ? targetElement.getBoundingClientRect() : null;
    if (rect) {
      const relY = touch.clientY - rect.top;
      const q = Math.floor(Math.max(0, Math.min(95, relY / quarterHeight)));
      touchStartQ.current = q;

      // Long Press de 280ms para activar modo arrastre sin pelear con el scroll vertical
      longPressTimer.current = setTimeout(() => {
        isTouchDragging.current = true;
        setIsDragging(true);
        setDragStartQ(q);
        setDragCurrentQ(q);
        if (typeof window !== 'undefined' && window.navigator && 'vibrate' in window.navigator) {
          try { window.navigator.vibrate(25); } catch {}
        }
      }, 280);
    }
  };

  const handleTouchMove = (e: any) => {
    if (touchStartQ.current === null) return;
    const touch = e.touches?.[0] || e.nativeEvent?.touches?.[0];
    if (!touch) return;

    // Si el usuario no ha completado el long-press y mueve el dedo, cancelamos: ESTÁ HACIENDO SCROLL
    if (!isTouchDragging.current) {
      const deltaY = touchStartClientY.current !== null ? Math.abs(touch.clientY - touchStartClientY.current) : 0;
      const deltaX = touchStartClientX.current !== null ? Math.abs(touch.clientX - touchStartClientX.current) : 0;
      if (deltaY > 8 || deltaX > 8) {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }
      return;
    }

    // Si ya se activó el long-press, ahora sí estiramos el bloque fantasma
    const targetElement = (gridContainerRef.current as any) || e.currentTarget || e.target;
    const rect = targetElement?.getBoundingClientRect ? targetElement.getBoundingClientRect() : null;
    if (rect) {
      const relY = touch.clientY - rect.top;
      const currentQ = Math.floor(Math.max(0, Math.min(95, relY / quarterHeight)));
      setDragCurrentQ(currentQ);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (isTouchDragging.current && dragStartQ !== null && dragCurrentQ !== null) {
      const minQ = Math.min(dragStartQ, dragCurrentQ);
      const maxQ = Math.max(dragStartQ, dragCurrentQ);
      const quarters = minQ === maxQ ? 2 : maxQ - minQ + 1;

      setIsDragging(false);
      setDragStartQ(null);
      setDragCurrentQ(null);
      isTouchDragging.current = false;
      touchStartQ.current = null;
      touchStartClientY.current = null;
      touchStartClientX.current = null;

      const target: SlotPickerTarget = {
        type: 'direct_hour',
        title: '',
        defaultStartQ: minQ,
        defaultQuarters: quarters,
      };
      if (onRequestSlotPicker) {
        onRequestSlotPicker(target);
      } else {
        openSlotPicker(target);
      }
    } else {
      isTouchDragging.current = false;
      touchStartQ.current = null;
      touchStartClientY.current = null;
      touchStartClientX.current = null;
    }
  };

  const handleTapQuarter = (q: number) => {
    if (isDragging) return;
    const target: SlotPickerTarget = {
      type: 'direct_hour',
      title: '',
      defaultStartQ: q,
      defaultQuarters: 2,
    };
    if (onRequestSlotPicker) {
      onRequestSlotPicker(target);
    } else {
      openSlotPicker(target);
    }
  };

  // Cálculo del bloque fantasma (Ghost Event) durante el arrastre o el hover
  const minDragQ =
    isDragging && dragStartQ !== null && dragCurrentQ !== null
      ? Math.min(dragStartQ, dragCurrentQ)
      : null;
  const maxDragQ =
    isDragging && dragStartQ !== null && dragCurrentQ !== null
      ? Math.max(dragStartQ, dragCurrentQ)
      : null;

  const ghostStartQ = minDragQ !== null ? minDragQ : null;
  const ghostQuarters =
    minDragQ !== null && maxDragQ !== null
      ? minDragQ === maxDragQ
        ? 2
        : maxDragQ - minDragQ + 1
      : 0;

  return (
    <View className="flex-1 bg-card border border-line-subtle rounded-2xl overflow-hidden">
      {/* Banner sutil superior cuando el día está libre */}
      {dayEvents.length === 0 ? (
        <View className="px-4 py-2.5 bg-header border-b border-line-subtle flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <NotionIcon
              name={activeDay?.isToday ? 'cup' : 'clock'}
              size={14}
              color={activeDay?.isToday ? colors.ok : colors.accentSoft}
            />
            <Text className="text-xs text-muted">
              {activeDay?.isToday
                ? 'Día despejado · Haz clic o arrastra sobre cualquier cuarto de hora en la cuadrícula para crear un bloque.'
                : `Sin bloques para el ${activeDay?.dayNum} ${activeDay?.monthShort} · Haz clic o arrastra en la rejilla para agendar.`}
            </Text>
          </View>
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        scrollEnabled={!isDragging}
        className="flex-1"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{ height: totalCanvasHeight + 24 }}
          className="relative w-full pt-3"
        >
          {/* 1. LÍNEAS HORIZONTALES DE LAS 24 HORAS + ETIQUETAS DE HORA */}
          {Array.from({ length: 24 }, (_, h) => {
            const topPos = h * hourHeight + 12;
            const hourStr = `${String(h).padStart(2, '0')}:00`;

            return (
              <View
                key={`hour-row-${h}`}
                style={{
                  position: 'absolute',
                  top: topPos,
                  left: 0,
                  right: 0,
                  height: hourHeight,
                }}
                pointerEvents="none"
                className="flex-row"
              >
                {/* Columna Izquierda: Etiqueta HH:00 estilo Google Calendar */}
                <View
                  style={{ width: hourColumnWidth }}
                  className="items-end pr-3 -mt-2"
                >
                  <Text className="font-mono text-xs font-medium text-muted">
                    {hourStr}
                  </Text>
                </View>

                {/* Columna Derecha: Línea de hora en punto y sub-línea sutil de :30 */}
                <View className="flex-1 border-t border-line-subtle">
                  <View
                    style={{ marginTop: hourHeight / 2 }}
                    className="border-t border-line-subtle/35 border-dashed"
                  />
                </View>
              </View>
            );
          })}

          {/* 2. EJE VERTICAL CONTINUO (BORDE IZQUIERDO DE LA REJILLA DE TIEMPO) */}
          <View
            style={{
              position: 'absolute',
              left: hourColumnWidth,
              top: 0,
              bottom: 0,
              width: 1,
              backgroundColor: colors.lineSubtle,
            }}
            pointerEvents="none"
          />

          {/* 3. CAPA INTERACTIVA DE 96 CUARTOS DE HORA (SNAPPING DE 15 MINUTOS) */}
          <View
            ref={gridContainerRef}
            {...(Platform.OS === 'web'
              ? {
                  onTouchStart: handleTouchStart,
                  onTouchMove: handleTouchMove,
                  onTouchEnd: handleTouchEnd,
                }
              : {})}
            style={{
              position: 'absolute',
              top: 12,
              left: hourColumnWidth + 1,
              right: 0,
              height: totalCanvasHeight,
              touchAction: (isDragging ? 'none' : 'pan-y') as any,
            }}
          >
            {Array.from({ length: 96 }, (_, q) => {
              const isHovered = hoverQuarter === q && !isDragging;
              const webEvents =
                Platform.OS === 'web'
                  ? {
                      onMouseDown: (e: { button?: number; preventDefault?: () => void }) => {
                        if (e.button !== undefined && e.button !== 0) return;
                        e.preventDefault?.();
                        setIsDragging(true);
                        setDragStartQ(q);
                        setDragCurrentQ(q);
                      },
                      onMouseEnter: () => {
                        setHoverQuarter(q);
                        if (isDragging) {
                          setDragCurrentQ(q);
                        }
                      },
                      onMouseLeave: () => {
                        if (hoverQuarter === q) setHoverQuarter(null);
                      },
                    }
                  : {};

              return (
                <Pressable
                  key={`q-hit-${q}`}
                  onPress={() => handleTapQuarter(q)}
                  {...(webEvents as object)}
                  style={{ height: quarterHeight }}
                  className="w-full"
                >
                  {/* Indicador ultra-sutil al pasar el ratón por un cuarto de hora libre */}
                  {isHovered ? (
                    <View className="flex-1 bg-accent/10 border-l-2 border-l-accent/60 px-2.5 justify-center">
                      <Text className="text-xs font-mono text-accent-soft/90">
                        {formatQuarterToTime(q)}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}

            {/* 4. BLOQUE FANTASMA EN VIVO (GHOST EVENT PREVIEW) AL HACER CLIC O ARRASTRAR */}
            {ghostStartQ !== null && ghostQuarters > 0 ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: ghostStartQ * quarterHeight + 1,
                  left: 8,
                  right: 16,
                  height: Math.max(quarterHeight - 2, ghostQuarters * quarterHeight - 2),
                  zIndex: 30,
                }}
                className="bg-accent/20 border border-accent/60 border-l-[3px] border-l-accent rounded-xl px-3 py-1.5 items-start justify-start overflow-hidden"
              >
                <Text className="text-xs font-mono font-bold text-accent-soft">
                  {formatQuarterToTime(ghostStartQ)} –{' '}
                  {formatQuarterToTime(ghostStartQ + ghostQuarters)}
                </Text>
              </View>
            ) : null}

            {/* 5. EVENTOS AGENDADOS POSICIONADOS PROPORCIONALMENTE EN LA ESCALA DE 24H */}
            {dayEvents.map((ev) => {
              const topPx = ev.startQ * quarterHeight + 1;
              const heightPx = Math.max(
                quarterHeight * 2 - 2,
                ev.quarters * quarterHeight - 2
              );

              return (
                <View
                  key={ev.id}
                  style={{
                    position: 'absolute',
                    top: topPx,
                    left: 8,
                    right: 16,
                    height: heightPx,
                    zIndex: 20,
                  }}
                >
                  <EventCard
                    event={ev}
                    compact={ev.quarters <= 2}
                    onRemove={removeTimelineEvent}
                  />
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};
