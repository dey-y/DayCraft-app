import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  useDayCraftStore,
  formatQuarterToTime,
  formatQuartersToDuration,
  doesEventApplyToDay,
  SlotPickerTarget,
} from '@/store/useDayCraftStore';
import { TimelineEvent } from '@/services/db/sqlite';
import { LAYOUT } from '@/constants/theme';
import { EventCard } from './EventCard';
import { NotionIcon } from '@/components/ui/NotionIcon';
import { useTheme } from '@/store/useThemeStore';

interface Rail24hProps {
  onRequestSlotPicker?: (target: SlotPickerTarget) => void;
}

interface PositionedEvent {
  event: TimelineEvent;
  colIndex: number;
  totalCols: number;
}

const QUIET_BAND_HEIGHT = 44;
const QUIET_END_QUARTER = 24; // 06:00 = 24 quarters

/**
 * Computes non-overlapping column assignments for concurrent timeline events.
 */
function computeOverlapLayout(events: TimelineEvent[]): PositionedEvent[] {
  if (events.length === 0) return [];
  const sorted = [...events].sort((a, b) =>
    a.startQ !== b.startQ ? a.startQ - b.startQ : b.quarters - a.quarters
  );

  const clusters: TimelineEvent[][] = [];
  let currentCluster: TimelineEvent[] = [];
  let clusterMaxEnd = -1;

  for (const ev of sorted) {
    const evEnd = ev.startQ + ev.quarters;
    if (currentCluster.length === 0 || ev.startQ < clusterMaxEnd) {
      currentCluster.push(ev);
      clusterMaxEnd = Math.max(clusterMaxEnd, evEnd);
    } else {
      clusters.push(currentCluster);
      currentCluster = [ev];
      clusterMaxEnd = evEnd;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const result: PositionedEvent[] = [];
  for (const cluster of clusters) {
    const colEnds: number[] = [];
    const assigned: { event: TimelineEvent; colIndex: number }[] = [];

    for (const ev of cluster) {
      let placedCol = -1;
      for (let c = 0; c < colEnds.length; c++) {
        if (colEnds[c] <= ev.startQ) {
          placedCol = c;
          colEnds[c] = ev.startQ + ev.quarters;
          break;
        }
      }
      if (placedCol === -1) {
        placedCol = colEnds.length;
        colEnds.push(ev.startQ + ev.quarters);
      }
      assigned.push({ event: ev, colIndex: placedCol });
    }

    const totalCols = Math.max(1, colEnds.length);
    for (const item of assigned) {
      result.push({ event: item.event, colIndex: item.colIndex, totalCols });
    }
  }

  return result;
}

function triggerHapticLight() {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

function triggerHapticSelection() {
  if (Platform.OS !== 'web') {
    Haptics.selectionAsync().catch(() => {});
  }
}

/**
 * Rail24h — Timeline 24h estilo Kuro-Zen (Snapping por Cuartos de Hora 15m).
 * - Cero textos repetitivos en horas vacías: únicamente las 24 líneas horarias limpias.
 * - Banda tranquila colapsable 00:00–06:00 ("Ma" espacio negativo) cuando no hay eventos de madrugada.
 * - Gesture Handler + Reanimated v4 + Expo Haptics para tap & long-press drag de 15m en móvil y web.
 * - Columnas de solapamiento automáticas para bloques concurrentes.
 * - NowMarker exclusivo para el día de hoy, alineado con LAYOUT.hourHeightMobile / hourHeightDesktop.
 */
export const Rail24h: React.FC<Rail24hProps> = ({ onRequestSlotPicker }) => {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= LAYOUT.desktopBreakpoint;

  const selectedDayKey = useDayCraftStore((s) => s.selectedDayKey);
  const days = useDayCraftStore((s) => s.days);
  const allEvents = useDayCraftStore((s) => s.events);
  const removeTimelineEvent = useDayCraftStore((s) => s.removeTimelineEvent);
  const toggleTimelineEventCompleted = useDayCraftStore(
    (s) => s.toggleTimelineEventCompleted
  );
  const openSlotPicker = useDayCraftStore((s) => s.openSlotPicker);

  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const gridRef = useRef<React.ComponentRef<typeof View>>(null);

  const hourHeight = isDesktop ? LAYOUT.hourHeightDesktop : LAYOUT.hourHeightMobile;
  const quarterHeight = hourHeight / 4;
  const hourColumnWidth = isDesktop ? 58 : 48;

  const [collapseQuietBand, setCollapseQuietBand] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartQ, setDragStartQ] = useState<number | null>(null);
  const [dragCurrentQ, setDragCurrentQ] = useState<number | null>(null);
  const [hoverQuarter, setHoverQuarter] = useState<number | null>(null);

  const lastDragQRef = useRef<number | null>(null);
  const ghostOpacity = useSharedValue(0);

  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const activeDay =
    days.find((d) => d.key === selectedDayKey) ||
    days.find((d) => d.isToday) ||
    days[7] ||
    days[0];

  const dayEvents = useMemo(
    () =>
      allEvents.filter((e) =>
        activeDay ? doesEventApplyToDay(e, activeDay) : e.dayKey === selectedDayKey
      ),
    [allEvents, activeDay, selectedDayKey]
  );

  const hasEarlyEvents = useMemo(
    () => dayEvents.some((e) => e.startQ < QUIET_END_QUARTER),
    [dayEvents]
  );

  const isQuietCollapsed = collapseQuietBand && !hasEarlyEvents;
  const totalCanvasHeight = isQuietCollapsed
    ? QUIET_BAND_HEIGHT + 18 * hourHeight
    : 24 * hourHeight;

  const positionedEvents = useMemo(
    () => computeOverlapLayout(dayEvents),
    [dayEvents]
  );

  const quarterToTop = useCallback(
    (q: number) => {
      if (!isQuietCollapsed) return q * quarterHeight;
      if (q < QUIET_END_QUARTER) {
        return (q / QUIET_END_QUARTER) * QUIET_BAND_HEIGHT;
      }
      return QUIET_BAND_HEIGHT + (q - QUIET_END_QUARTER) * quarterHeight;
    },
    [isQuietCollapsed, quarterHeight]
  );

  const topToQuarter = useCallback(
    (y: number) => {
      const clampedY = Math.max(0, y);
      if (!isQuietCollapsed) {
        return Math.max(0, Math.min(95, Math.floor(clampedY / quarterHeight)));
      }
      if (clampedY < QUIET_BAND_HEIGHT) {
        return Math.max(
          0,
          Math.min(23, Math.floor((clampedY / QUIET_BAND_HEIGHT) * QUIET_END_QUARTER))
        );
      }
      return Math.max(
        QUIET_END_QUARTER,
        Math.min(
          95,
          QUIET_END_QUARTER +
            Math.floor((clampedY - QUIET_BAND_HEIGHT) / quarterHeight)
        )
      );
    },
    [isQuietCollapsed, quarterHeight]
  );

  // Auto-scroll inicial hacia las 09:00 o el primer evento del día
  useEffect(() => {
    const firstQ = dayEvents.length > 0 ? Math.max(0, dayEvents[0].startQ - 4) : 32;
    const targetY = Math.max(0, quarterToTop(firstQ));
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: targetY, animated: true });
      if (Platform.OS === 'web') {
        const anyRef = scrollRef.current as any;
        const el = anyRef?.getScrollableNode?.() || anyRef?._scrollNodeRef || anyRef;
        if (el && 'scrollTop' in el && el.scrollTop === 0) {
          el.scrollTop = targetY;
        }
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [selectedDayKey, hourHeight, isQuietCollapsed]);

  const dispatchSlotPicker = useCallback(
    (startQ: number, quarters: number) => {
      const target: SlotPickerTarget = {
        type: 'direct_hour',
        title: '',
        defaultStartQ: startQ,
        defaultQuarters: quarters,
      };
      if (onRequestSlotPicker) {
        onRequestSlotPicker(target);
      } else {
        openSlotPicker(target);
      }
    },
    [onRequestSlotPicker, openSlotPicker]
  );

  const getQuarterFromClientY = useCallback(
    (clientY: number | undefined): number | null => {
      if (typeof clientY !== 'number') return null;
      const node = gridRef.current as unknown as {
        getBoundingClientRect?: () => { top: number };
      } | null;
      if (!node || typeof node.getBoundingClientRect !== 'function') return null;
      const rect = node.getBoundingClientRect();
      return topToQuarter(clientY - rect.top);
    },
    [topToQuarter]
  );

  // Arrastre suave en Web con ratón (mousemove + mouseup en window)
  useEffect(() => {
    if (Platform.OS !== 'web' || !isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const q = getQuarterFromClientY(e.clientY);
      if (q !== null && lastDragQRef.current !== q) {
        lastDragQRef.current = q;
        setDragCurrentQ(q);
      }
    };

    const handleMouseUp = () => {
      if (dragStartQ === null || dragCurrentQ === null) return;
      const minQ = Math.min(dragStartQ, dragCurrentQ);
      const maxQ = Math.max(dragStartQ, dragCurrentQ);
      const quarters = minQ === maxQ ? 2 : maxQ - minQ + 1;

      setIsDragging(false);
      setDragStartQ(null);
      setDragCurrentQ(null);
      lastDragQRef.current = null;
      ghostOpacity.value = withTiming(0, { duration: 120 });

      dispatchSlotPicker(minQ, quarters);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    isDragging,
    dragStartQ,
    dragCurrentQ,
    getQuarterFromClientY,
    dispatchSlotPicker,
    ghostOpacity,
  ]);

  const handleGestureDragStart = useCallback(
    (y: number) => {
      const q = topToQuarter(y);
      triggerHapticLight();
      lastDragQRef.current = q;
      setIsDragging(true);
      setDragStartQ(q);
      setDragCurrentQ(q);
      ghostOpacity.value = withTiming(1, { duration: 100 });
    },
    [topToQuarter, ghostOpacity]
  );

  const handleGestureDragUpdate = useCallback(
    (y: number) => {
      const q = topToQuarter(y);
      if (lastDragQRef.current !== q) {
        lastDragQRef.current = q;
        triggerHapticSelection();
        setDragCurrentQ(q);
      }
    },
    [topToQuarter]
  );

  const handleGestureDragEnd = useCallback(() => {
    if (dragStartQ !== null && dragCurrentQ !== null) {
      const minQ = Math.min(dragStartQ, dragCurrentQ);
      const maxQ = Math.max(dragStartQ, dragCurrentQ);
      const quarters = minQ === maxQ ? 2 : maxQ - minQ + 1;
      setIsDragging(false);
      setDragStartQ(null);
      setDragCurrentQ(null);
      lastDragQRef.current = null;
      ghostOpacity.value = withTiming(0, { duration: 120 });
      dispatchSlotPicker(minQ, quarters);
    }
  }, [dragStartQ, dragCurrentQ, dispatchSlotPicker, ghostOpacity]);

  const handleGestureDragCancel = useCallback(() => {
    setIsDragging(false);
    setDragStartQ(null);
    setDragCurrentQ(null);
    lastDragQRef.current = null;
    ghostOpacity.value = withTiming(0, { duration: 100 });
  }, [ghostOpacity]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(Platform.OS !== 'web')
        .activateAfterLongPress(260)
        .onStart((e) => {
          runOnJS(handleGestureDragStart)(e.y);
        })
        .onUpdate((e) => {
          runOnJS(handleGestureDragUpdate)(e.y);
        })
        .onEnd(() => {
          runOnJS(handleGestureDragEnd)();
        })
        .onFinalize((_e, success) => {
          if (!success) {
            runOnJS(handleGestureDragCancel)();
          }
        }),
    [
      handleGestureDragStart,
      handleGestureDragUpdate,
      handleGestureDragEnd,
      handleGestureDragCancel,
    ]
  );

  const handleTapQuarter = (q: number) => {
    if (isDragging) return;
    triggerHapticLight();
    dispatchSlotPicker(q, 2);
  };

  // Cálculo del bloque fantasma (Ghost Event) durante el arrastre
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

  const ghostAnimatedStyle = useAnimatedStyle(() => ({
    opacity: ghostOpacity.value,
  }));

  const emptyDayMessage = activeDay?.isToday
    ? 'Día despejado · Toca o mantén pulsado en la rejilla para crear un bloque con calma.'
    : activeDay?.isPast
    ? `Día pasado sin bloques (${activeDay?.dayNum} ${activeDay?.monthShort}) · El descanso también cuenta.`
    : `Sin bloques para el ${activeDay?.dayNum} ${activeDay?.monthShort} · Toca o arrastra en la rejilla cuando quieras planificar.`;

  const nowQuarterExact = nowMinutes / 15;
  const nowMarkerTop = quarterToTop(nowQuarterExact) - 5;

  return (
    <View className="flex-1 bg-canvas border-t border-line-subtle/60 overflow-hidden">
      {/* Nota empática ultra-discreta cuando el día está libre (sin caja pesada) */}
      {dayEvents.length === 0 ? (
        <View className="px-2 py-1.5 flex-row items-center gap-2">
          <NotionIcon
            name={activeDay?.isToday ? 'cup' : activeDay?.isPast ? 'check' : 'clock'}
            size={12}
            color={
              activeDay?.isToday
                ? colors.ok
                : activeDay?.isPast
                ? colors.muted
                : colors.accentSoft
            }
          />
          <Text numberOfLines={1} className="text-xs text-muted/80 flex-1">
            {emptyDayMessage}
          </Text>
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
          {/* 1. LÍNEAS HORIZONTALES DE LAS 24 HORAS + BANDA TRANQUILA COLAPSABLE 00:00–06:00 */}
          {Array.from({ length: 24 }, (_, h) => {
            if (isQuietCollapsed && h > 0 && h < 6) {
              return null;
            }

            if (isQuietCollapsed && h === 0) {
              return (
                <Pressable
                  key="quiet-band-00-06"
                  onPress={() => {
                    triggerHapticLight();
                    setCollapseQuietBand(false);
                  }}
                  style={{
                    position: 'absolute',
                    top: 12,
                    left: 0,
                    right: 0,
                    height: QUIET_BAND_HEIGHT,
                    zIndex: 25,
                  }}
                  className="flex-row items-center bg-raised/40 border-b border-line-subtle/50 active:bg-raised"
                >
                  <View
                    style={{ width: hourColumnWidth }}
                    className="items-end pr-3"
                  >
                    <Text className="font-mono text-xs font-medium text-muted">
                      00–06
                    </Text>
                  </View>
                  <View className="flex-1 flex-row items-center justify-between px-3">
                    <Text className="text-xs text-muted">
                      00:00–06:00 · Madrugada en calma (Ma)
                    </Text>
                    <Text className="text-xs font-mono font-semibold text-accent-soft">
                      Expandir
                    </Text>
                  </View>
                </Pressable>
              );
            }

            const topPos = isQuietCollapsed
              ? QUIET_BAND_HEIGHT + (h - 6) * hourHeight + 12
              : h * hourHeight + 12;
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
                pointerEvents={h === 0 && !isQuietCollapsed && !hasEarlyEvents ? 'box-none' : 'none'}
                className="flex-row"
              >
                {/* Columna Izquierda: Etiqueta HH:00 */}
                <View
                  style={{ width: hourColumnWidth }}
                  className="items-end pr-3 -mt-2"
                >
                  <Text className="font-mono text-xs font-medium text-muted">
                    {hourStr}
                  </Text>
                </View>

                {/* Columna Derecha: Línea de hora limpia */}
                <View className="flex-1 border-t border-line-subtle/35">
                  {h === 0 && !isQuietCollapsed && !hasEarlyEvents ? (
                    <Pressable
                      onPress={() => setCollapseQuietBand(true)}
                      hitSlop={10}
                      className="self-end mr-3 mt-1 px-2.5 py-1 min-h-[44px] justify-center rounded-lg bg-raised border border-line-subtle"
                    >
                      <Text className="text-xs font-mono text-muted">
                        Colapsar 00:00–06:00
                      </Text>
                    </Pressable>
                  ) : null}
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

          {/* 3. CAPA INTERACTIVA DE 96 CUARTOS DE HORA: WEB MOUSE DRAG + NATIVE GESTURE HANDLER */}
          <GestureDetector gesture={panGesture}>
            <View
              style={{
                position: 'absolute',
                top: 12,
                left: hourColumnWidth + 1,
                right: 0,
                height: totalCanvasHeight,
                touchAction: (isDragging ? 'none' : 'pan-y') as any,
              }}
            >
              {Platform.OS === 'web' ? (
                <View
                  ref={gridRef}
                  {...({
                    onMouseDown: (e: {
                      button?: number;
                      clientY?: number;
                      nativeEvent?: { clientY?: number };
                      preventDefault?: () => void;
                    }) => {
                      if (e.button !== undefined && e.button !== 0) return;
                      const q = getQuarterFromClientY(
                        e.clientY ?? e.nativeEvent?.clientY
                      );
                      if (q === null) return;
                      e.preventDefault?.();
                      lastDragQRef.current = q;
                      setIsDragging(true);
                      setDragStartQ(q);
                      setDragCurrentQ(q);
                      setHoverQuarter(null);
                      ghostOpacity.value = 1;
                    },
                    onMouseMove: (e: {
                      clientY?: number;
                      nativeEvent?: { clientY?: number };
                    }) => {
                      if (isDragging) return;
                      const q = getQuarterFromClientY(
                        e.clientY ?? e.nativeEvent?.clientY
                      );
                      if (q !== null && q !== hoverQuarter) {
                        setHoverQuarter(q);
                      }
                    },
                    onMouseLeave: () => {
                      if (!isDragging) {
                        setHoverQuarter(null);
                      }
                    },
                  } as object)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 10,
                    cursor: isDragging ? 'ns-resize' : 'crosshair',
                  } as any}
                >
                  {hoverQuarter !== null &&
                  !isDragging &&
                  (!isQuietCollapsed || hoverQuarter >= QUIET_END_QUARTER) ? (
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        top: quarterToTop(hoverQuarter),
                        left: 0,
                        right: 0,
                        height: quarterHeight,
                        backgroundColor: `${colors.accent}18`,
                        borderLeftWidth: 2,
                        borderLeftColor: colors.accent,
                        paddingHorizontal: 10,
                        justifyContent: 'center',
                      }}
                    >
                      <View
                        style={{
                          alignSelf: 'flex-start',
                          backgroundColor: colors.raised,
                          borderColor: colors.lineSubtle,
                          borderWidth: 1,
                          borderRadius: 999,
                          paddingHorizontal: 8,
                          paddingVertical: 1,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.accentSoft,
                            fontSize: 12,
                            fontWeight: '600',
                          }}
                          className="font-mono"
                        >
                          {formatQuarterToTime(hoverQuarter)}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : (
                Array.from({ length: 96 }, (_, q) => {
                  if (isQuietCollapsed && q < QUIET_END_QUARTER) {
                    return null;
                  }
                  return (
                    <Pressable
                      key={`q-hit-${q}`}
                      onPress={() => handleTapQuarter(q)}
                      style={{
                        position: 'absolute',
                        top: quarterToTop(q),
                        left: 0,
                        right: 0,
                        height: quarterHeight,
                      }}
                    />
                  );
                })
              )}

              {/* 4. BLOQUE FANTASMA EN VIVO (GHOST EVENT PREVIEW) */}
              {ghostStartQ !== null && ghostQuarters > 0 ? (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    ghostAnimatedStyle,
                    {
                      position: 'absolute',
                      top: quarterToTop(ghostStartQ) + 1,
                      left: 8,
                      right: 16,
                      height: Math.max(
                        quarterHeight - 2,
                        ghostQuarters * quarterHeight - 2
                      ),
                      zIndex: 30,
                      opacity: 1,
                      backgroundColor: `${colors.accent}45`,
                      borderColor: colors.accent,
                      borderWidth: 1.5,
                      borderLeftWidth: 4,
                      borderLeftColor: colors.accentSoft,
                      borderRadius: 12,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      alignItems: 'flex-start',
                      justifyContent: 'flex-start',
                      overflow: 'hidden',
                    },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Text
                      style={{
                        color: colors.ink,
                        fontSize: 12,
                        fontWeight: '700',
                      }}
                      className="font-mono"
                    >
                      {formatQuarterToTime(ghostStartQ)} –{' '}
                      {formatQuarterToTime(ghostStartQ + ghostQuarters)}
                    </Text>
                    <Text
                      style={{
                        color: colors.accentSoft,
                        fontSize: 12,
                        fontWeight: '700',
                      }}
                      className="font-mono"
                    >
                      · {formatQuartersToDuration(ghostQuarters)}
                    </Text>
                  </View>
                </Animated.View>
              ) : null}

              {/* 5. EVENTOS AGENDADOS CON LAYOUT DE COLUMNAS PARA SOLAPAMIENTOS */}
              <View
                pointerEvents="box-none"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 8,
                  right: 16,
                  bottom: 0,
                  zIndex: 20,
                }}
              >
                {positionedEvents.map(({ event: ev, colIndex, totalCols }) => {
                  const topPx = quarterToTop(ev.startQ) + 1;
                  const heightPx = Math.max(
                    quarterHeight * 2 - 2,
                    ev.quarters * quarterHeight - 2
                  );
                  const widthPct = 100 / totalCols;
                  const leftPct = colIndex * widthPct;

                  return (
                    <View
                      key={ev.id}
                      style={{
                        position: 'absolute',
                        top: topPx,
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        height: heightPx,
                        paddingHorizontal: totalCols > 1 ? 2 : 0,
                      }}
                    >
                      <EventCard
                        event={ev}
                        compact={ev.quarters <= 2}
                        onEdit={(targetEv) => {
                          const target: SlotPickerTarget = {
                            type: 'edit_event',
                            id: targetEv.id,
                            title: targetEv.title,
                            desc: targetEv.desc || '',
                            eventType: targetEv.type,
                            defaultStartQ: targetEv.startQ,
                            defaultQuarters: targetEv.quarters,
                            recurrence: targetEv.recurrence,
                          };
                          if (onRequestSlotPicker) {
                            onRequestSlotPicker(target);
                          } else {
                            openSlotPicker(target);
                          }
                        }}
                        onToggleComplete={toggleTimelineEventCompleted}
                        onRemove={(id) => removeTimelineEvent(id, true)}
                      />
                    </View>
                  );
                })}
              </View>

              {/* 6. LÍNEA EN VIVO DE LA HORA ACTUAL (NOW MARKER — SOLO HOY) */}
              {activeDay?.isToday ? (
                <View
                  style={{
                    position: 'absolute',
                    top: nowMarkerTop,
                    left: 0,
                    right: 12,
                    zIndex: 40,
                  }}
                  pointerEvents="none"
                  className="flex-row items-center"
                >
                  <View
                    style={{ width: 10, height: 10 }}
                    className="rounded-full bg-now border-2 border-canvas -ml-1.5 shadow-sm"
                  />
                  <View className="flex-1 h-[2px] bg-now/85" />
                </View>
              ) : null}
            </View>
          </GestureDetector>
        </View>
      </ScrollView>
    </View>
  );
};
