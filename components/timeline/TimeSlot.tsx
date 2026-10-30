import React, { useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { formatQuarterToTime } from '@/store/useDayCraftStore';

interface TimeSlotProps {
  quarterIndex: number; // 0..95
  isSelectedInDrag?: boolean;
  isDragStart?: boolean;
  dragRangeLabel?: string;
  onSelectQuarter: (q: number) => void;
  onDragStartQuarter?: (q: number) => void;
  onDragEnterQuarter?: (q: number) => void;
}

/**
 * TimeSlot (15m) — Sub-ranura de cuarto de hora 100% limpia en reposo (Auditoría v9).
 * Cero cajas punteadas invasivas: las guías `:00`, `:15`, `:30`, `:45` solo aparecen al interactuar.
 */
export const TimeSlot: React.FC<TimeSlotProps> = ({
  quarterIndex,
  isSelectedInDrag = false,
  isDragStart = false,
  dragRangeLabel,
  onSelectQuarter,
  onDragStartQuarter,
  onDragEnterQuarter,
}) => {
  const [hovered, setHovered] = useState(false);
  const minVal = (quarterIndex % 4) * 15;
  const minLabel = minVal === 0 ? '00' : String(minVal);
  const qTime = formatQuarterToTime(quarterIndex);

  const webMouseProps =
    Platform.OS === 'web'
      ? {
          onMouseDown: () => onDragStartQuarter?.(quarterIndex),
          onMouseEnter: () => {
            setHovered(true);
            onDragEnterQuarter?.(quarterIndex);
          },
          onMouseLeave: () => setHovered(false),
        }
      : {};

  return (
    <Pressable
      onPress={() => onSelectQuarter(quarterIndex)}
      {...(webMouseProps as object)}
      className={`h-[20px] px-2.5 flex-row items-center justify-between rounded-md ${
        isSelectedInDrag
          ? 'bg-accent/35 border-l-4 border-l-accent'
          : hovered
          ? 'bg-raised'
          : 'bg-transparent'
      }`}
    >
      {isSelectedInDrag ? (
        isDragStart ? (
          <View className="flex-row items-center justify-between flex-1">
            <Text className="text-[10px] font-mono font-bold text-ink">
              {dragRangeLabel || qTime}
            </Text>
            <View className="px-1.5 py-0.5 rounded bg-accent/30">
              <Text className="text-[9px] font-bold text-ink">
                Suelta para agendar
              </Text>
            </View>
          </View>
        ) : (
          <Text className="text-[9px] font-mono text-accent-soft">
            ↕ +15 min seleccionado...
          </Text>
        )
      ) : (
        <>
          <View
            style={{ opacity: hovered ? 1 : 0 }}
            className="flex-row items-center gap-1.5"
          >
            <Text className="text-[10px] font-mono font-bold text-accent-soft">
              {qTime}
            </Text>
            <Text className="text-[10px] text-muted">+ Agendar bloque</Text>
          </View>

          <Text
            style={{ opacity: hovered ? 0.65 : 0 }}
            className="text-[9px] font-mono text-muted"
          >
            :{minLabel}
          </Text>
        </>
      )}
    </Pressable>
  );
};
