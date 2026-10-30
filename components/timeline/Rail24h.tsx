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
  const { width } = useWindowDimensions();
  const isDesktop = width >= LAYOUT.desktopBreakpoint;

  const selectedDayKey = useDayCraftStore((s) => s.selectedDayKey);
  const days = useDayCraftStore((s) => s.days);
  const allEvents = useDayCraftStore((s) => s.events);
  const removeTimelineEvent = useDayCraftStore((s) => s.removeTimelineEvent);
  const openSlotPicker = useDayCraftStore((s) => s.openSlotPicker);

  const scrollRef = useRef<ScrollView>(null);

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
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [isDragging, dragStartQ, dragCurrentQ, onRequestSlotPicker, openSlotPicker]);

  const handleTapQuarter = (q: number) => {
    if (Platform.OS === 'web') return; // En web lo gestiona el mouseDown/mouseUp de arrastre
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
    <View className="flex-1 bg-[#161922] border border-[#262b3a] rounded-2xl overflow-hidden">
      {/* Banner sutil superior cuando el día está libre */}
      {dayEvents.length === 0 ? (
        <View className="px-4 py-2.5 bg-[#12151d] border-b border-[#262b3a] flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <NotionIcon
              name={activeDay?.isToday ? 'cup' : 'clock'}
              size={14}
              color={activeDay?.isToday ? '#34d399' : '#818cf8'}
            />
            <Text className="text-xs text-[#8b949e]">
              {activeDay?.isToday
                ? 'Día despejado · Haz clic o arrastra sobre cualquier cuarto de hora en la cuadrícula para crear un bloque.'
                : `Sin bloques para el ${activeDay?.dayNum} ${activeDay?.monthShort} · Haz clic o arrastra en la rejilla para agendar.`}
            </Text>
          </View>
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
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
                  <Text className="font-mono text-[11px] font-medium text-[#8b949e]">
                    {hourStr}
                  </Text>
                </View>

                {/* Columna Derecha: Línea de hora en punto y sub-línea sutil de :30 */}
                <View className="flex-1 border-t border-[#262b3a]">
                  <View
                    style={{ marginTop: hourHeight / 2 }}
                    className="border-t border-[#262b3a]/35 border-dashed"
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
              backgroundColor: '#262b3a',
            }}
            pointerEvents="none"
          />

          {/* 3. CAPA INTERACTIVA DE 96 CUARTOS DE HORA (SNAPPING DE 15 MINUTOS) */}
          <View
            style={{
              position: 'absolute',
              top: 12,
              left: hourColumnWidth + 1,
              right: 0,
              height: totalCanvasHeight,
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
                    <View className="flex-1 bg-indigo-500/10 border-l-2 border-l-indigo-400/60 px-2.5 justify-center">
                      <Text className="text-[10px] font-mono text-indigo-300/90">
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
                className="bg-indigo-500/20 border border-indigo-400/60 border-l-[3px] border-l-indigo-400 rounded-xl px-3 py-1.5 items-start justify-start overflow-hidden"
              >
                <Text className="text-[11px] font-mono font-bold text-indigo-200">
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
