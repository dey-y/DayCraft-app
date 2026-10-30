import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, Platform } from 'react-native';
import {
  useDayCraftStore,
  formatQuarterToTime,
  formatQuartersToDuration,
  SlotPickerTarget,
} from '@/store/useDayCraftStore';
import { EventCard } from './EventCard';
import { TimeSlot } from './TimeSlot';
import { NotionIcon } from '@/components/ui/NotionIcon';

interface Rail24hProps {
  onRequestSlotPicker?: (target: SlotPickerTarget) => void;
}

/**
 * Rail24h — Timeline 24h Heroico con Raíl Físico Continuo y Snapping por cuartos de hora (15m).
 * - En reposo: 100% limpio sin rectángulos punteados.
 * - Incluye mensajes empáticos contextuales cuando el día está despejado (Hoy / Futuro / Pasado).
 * - Soporta Tapping directo en móvil y Drag-to-block por cuartos de hora en Web.
 */
export const Rail24h: React.FC<Rail24hProps> = ({ onRequestSlotPicker }) => {
  const selectedDayKey = useDayCraftStore((s) => s.selectedDayKey);
  const days = useDayCraftStore((s) => s.days);
  const allEvents = useDayCraftStore((s) => s.events);
  const removeTimelineEvent = useDayCraftStore((s) => s.removeTimelineEvent);
  const openSlotPicker = useDayCraftStore((s) => s.openSlotPicker);

  const scrollRef = useRef<ScrollView>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStartQ, setDragStartQ] = useState<number | null>(null);
  const [dragCurrentQ, setDragCurrentQ] = useState<number | null>(null);

  const activeDay = days.find((d) => d.key === selectedDayKey) || days[2];
  const dayEvents = allEvents.filter((e) => e.dayKey === selectedDayKey);

  // Auto-scroll inicial hacia las 09:00 o el primer evento del día
  useEffect(() => {
    const firstHour =
      dayEvents.length > 0 ? Math.floor(dayEvents[0].startQ / 4) : 9;
    const targetY = Math.max(0, (firstHour - 1) * 84);
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: targetY, animated: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedDayKey]);

  // Finalizar arrastre en Web para crear bloque con rango de 15m
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleMouseUp = () => {
      if (!isDragging || dragStartQ === null || dragCurrentQ === null) return;
      const minQ = Math.min(dragStartQ, dragCurrentQ);
      const maxQ = Math.max(dragStartQ, dragCurrentQ);
      const quarters = maxQ - minQ + 1;

      setIsDragging(false);
      setDragStartQ(null);
      setDragCurrentQ(null);

      const target: SlotPickerTarget = {
        type: 'direct_hour',
        title: `Bloque (${formatQuartersToDuration(quarters)})`,
        defaultStartQ: minQ,
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

  const handleSelectQuarter = (q: number) => {
    const target: SlotPickerTarget = {
      type: 'direct_hour',
      title: 'Trabajo enfocado',
      defaultStartQ: q,
    };
    if (onRequestSlotPicker) {
      onRequestSlotPicker(target);
    } else {
      openSlotPicker(target);
    }
  };

  const minDragQ =
    isDragging && dragStartQ !== null && dragCurrentQ !== null
      ? Math.min(dragStartQ, dragCurrentQ)
      : -1;
  const maxDragQ =
    isDragging && dragStartQ !== null && dragCurrentQ !== null
      ? Math.max(dragStartQ, dragCurrentQ)
      : -1;

  const dragRangeLabel =
    minDragQ >= 0
      ? `${formatQuarterToTime(minDragQ)} — ${formatQuarterToTime(
          maxDragQ + 1
        )} (${formatQuartersToDuration(maxDragQ - minDragQ + 1)})`
      : '';

  return (
    <View className="flex-1 bg-[#161922] border border-[#2d3345] rounded-2xl overflow-hidden">
      {/* Mensaje Empático Contextual si el día no tiene bloques agendados */}
      {dayEvents.length === 0 ? (
        <View className="mx-3.5 mt-3 p-3 rounded-xl bg-[#1f2430]/80 border border-[#2d3345] flex-row items-center justify-between gap-2">
          <View className="flex-row items-center gap-2.5 flex-1">
            <View className="w-7 h-7 rounded-lg bg-[#161922] border border-[#2d3345] items-center justify-center">
              <NotionIcon
                name={
                  activeDay.isToday
                    ? 'cup'
                    : activeDay.isPast
                    ? 'check-circle'
                    : 'clock'
                }
                size={14}
                color={
                  activeDay.isToday
                    ? '#34d399'
                    : activeDay.isPast
                    ? '#8b949e'
                    : '#818cf8'
                }
              />
            </View>
            <Text className="text-xs text-[#e6edf3] flex-1 leading-snug">
              {activeDay.isToday
                ? 'Parece que hoy no tienes nada con horario, ¡tómate un descanso o toca cualquier hora para agendar!'
                : activeDay.isPast
                ? 'Día concluido. Jornada pasada sin bloques pendientes.'
                : 'Día despejado. No tienes tareas ni recordatorios para esta fecha.'}
            </Text>
          </View>
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        className="flex-1 px-3 py-3"
        showsVerticalScrollIndicator={false}
      >
        <View className="relative pb-6">
          {/* Raíl vertical físico continuo e ininterrumpido */}
          <View
            style={{
              position: 'absolute',
              left: 59,
              top: 12,
              bottom: 12,
              width: 2,
              backgroundColor: '#2d3345',
            }}
          />

          {Array.from({ length: 24 }, (_, h) => {
            const hourStr = `${String(h).padStart(2, '0')}:00`;
            const hourEvents = dayEvents.filter(
              (e) => Math.floor(e.startQ / 4) === h
            );
            const hasEvent = hourEvents.length > 0;
            const isCurrentHourOnToday = Boolean(activeDay.isToday && h === 11);

            return (
              <View
                key={h}
                className="flex-row items-start gap-3 py-1.5 relative"
              >
                {/* Columna de Hora (00:00 a 23:00) */}
                <Pressable
                  onPress={() => handleSelectQuarter(h * 4)}
                  className="w-12 items-end pt-1 flex-shrink-0"
                >
                  <Text className="font-mono text-[11px] font-medium text-[#8b949e]">
                    {hourStr}
                  </Text>
                </Pressable>

                {/* Nodo Circular Centrado en el Raíl Físico */}
                <View className="w-4 items-center justify-center pt-1.5 z-10 flex-shrink-0">
                  <View
                    className={`w-2.5 h-2.5 rounded-full border-2 ${
                      hasEvent
                        ? 'bg-indigo-500 border-white'
                        : 'bg-[#161922] border-[#4b5563]'
                    }`}
                  />
                  {/* Punto Vivo de Hora Actual en el Raíl (11:45 Hoy) */}
                  {isCurrentHourOnToday ? (
                    <View
                      style={{ position: 'absolute', top: 26 }}
                      className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-white"
                    />
                  ) : null}
                </View>

                {/* Área de Bloques o Sub-ranuras limpias de 15 minutos */}
                <View className="flex-1 min-w-0">
                  {hasEvent ? (
                    <View className="gap-2">
                      {hourEvents.map((ev) => (
                        <EventCard
                          key={ev.id}
                          event={ev}
                          onRemove={removeTimelineEvent}
                        />
                      ))}
                    </View>
                  ) : (
                    <View className="rounded-xl overflow-hidden border border-transparent">
                      {[0, 1, 2, 3].map((subQ) => {
                        const q = h * 4 + subQ;
                        const isSelected = q >= minDragQ && q <= maxDragQ;
                        return (
                          <TimeSlot
                            key={q}
                            quarterIndex={q}
                            isSelectedInDrag={isSelected}
                            isDragStart={q === minDragQ}
                            dragRangeLabel={dragRangeLabel}
                            onSelectQuarter={handleSelectQuarter}
                            onDragStartQuarter={(startQ) => {
                              setIsDragging(true);
                              setDragStartQ(startQ);
                              setDragCurrentQ(startQ);
                            }}
                            onDragEnterQuarter={(enterQ) => {
                              if (isDragging) {
                                setDragCurrentQ(enterQ);
                              }
                            }}
                          />
                        );
                      })}
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};
