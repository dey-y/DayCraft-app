import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useDayCraftStore, formatQuarterToTime } from '@/store/useDayCraftStore';
import {
  RecurrenceFrequency,
  EventRecurrenceRule,
} from '@/services/db/sqlite';
import { SMART_SLOTS_PRESETS } from '@/constants/theme';
import { NotionIcon } from '@/components/ui/NotionIcon';

interface SlotPickerSheetContentProps {
  onClose?: () => void;
}

const WEEK_DAYS_SELECTOR = [
  { key: 'LUN', short: 'L' },
  { key: 'MAR', short: 'M' },
  { key: 'MIÉ', short: 'X' },
  { key: 'JUE', short: 'J' },
  { key: 'VIE', short: 'V' },
  { key: 'SÁB', short: 'S' },
  { key: 'DOM', short: 'D' },
] as const;

const FREQUENCY_OPTIONS: { key: RecurrenceFrequency; label: string }[] = [
  { key: 'none', label: 'No se repite' },
  { key: 'daily', label: 'Cada día' },
  { key: 'weekly', label: 'Semanal' },
  { key: 'monthly', label: 'Mensual' },
];

/**
 * SlotPickerSheetContent — Popover de creación de bloques en el Timeline 24h
 * Incluye selector de repetición (`No se repite`, `Cada día`, `Semanal [L M X J V S D]`, `Mensual`).
 */
export const SlotPickerSheetContent: React.FC<SlotPickerSheetContentProps> = ({
  onClose,
}) => {
  const slotPickerTarget = useDayCraftStore((s) => s.slotPickerTarget);
  const assignSlotFromPicker = useDayCraftStore((s) => s.assignSlotFromPicker);
  const closeSlotPicker = useDayCraftStore((s) => s.closeSlotPicker);
  const days = useDayCraftStore((s) => s.days);
  const selectedDayKey = useDayCraftStore((s) => s.selectedDayKey);

  const activeDay =
    days.find((d) => d.key === selectedDayKey) || days[7] || days[0];

  const [customTitle, setCustomTitle] = useState(
    slotPickerTarget?.title || ''
  );
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('none');
  const [selectedWeekDays, setSelectedWeekDays] = useState<string[]>([
    activeDay?.dayName || 'MAR',
  ]);
  const [customHourStr, setCustomHourStr] = useState('15:30');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const quarters = slotPickerTarget?.defaultQuarters || 2;
  const isDirectFromCalendar =
    slotPickerTarget?.type === 'direct_hour' &&
    typeof slotPickerTarget?.defaultStartQ === 'number';

  useEffect(() => {
    setCustomTitle(slotPickerTarget?.title || '');
    setFrequency('none');
    setSelectedWeekDays([activeDay?.dayName || 'MAR']);
    if (typeof slotPickerTarget?.defaultStartQ === 'number') {
      setCustomHourStr(formatQuarterToTime(slotPickerTarget.defaultStartQ));
    }
  }, [slotPickerTarget, activeDay?.dayName]);

  const toggleWeekDay = (dayKey: string) => {
    setSelectedWeekDays((prev) => {
      if (prev.includes(dayKey)) {
        return prev.length > 1 ? prev.filter((d) => d !== dayKey) : prev;
      }
      return [...prev, dayKey];
    });
  };

  const buildRecurrenceRule = (): EventRecurrenceRule | undefined => {
    if (frequency === 'none') return undefined;
    if (frequency === 'daily') {
      return { frequency: 'daily' };
    }
    if (frequency === 'weekly') {
      return {
        frequency: 'weekly',
        daysOfWeek: selectedWeekDays,
      };
    }
    if (frequency === 'monthly') {
      return {
        frequency: 'monthly',
        dayNumOfMonth: activeDay?.dayNum || '27',
      };
    }
    return undefined;
  };

  const handleClose = () => {
    closeSlotPicker();
    onClose?.();
  };

  const handleSelectSlot = (startQ: number, qCount = quarters) => {
    assignSlotFromPicker(
      startQ,
      qCount,
      customTitle.trim() || 'Bloque enfocado',
      buildRecurrenceRule()
    );
    onClose?.();
  };

  const handleApplyCustomTime = () => {
    const parts = customHourStr.trim().split(':');
    const h = parseInt(parts[0] || '15', 10);
    const m = parseInt(parts[1] || '0', 10);
    const clampedH = isNaN(h) ? 15 : Math.max(0, Math.min(23, h));
    const qOffset = isNaN(m) ? 0 : Math.round(m / 15) % 4;
    const startQ = clampedH * 4 + qOffset;
    handleSelectSlot(startQ, 2);
  };

  const renderRecurrenceSelector = () => (
    <View className="gap-2">
      <Text className="text-[10px] uppercase tracking-wider font-bold text-[#8b949e]">
        Repetición
      </Text>
      <View className="flex-row flex-wrap gap-1.5">
        {FREQUENCY_OPTIONS.map((opt) => {
          const isSel = frequency === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => setFrequency(opt.key)}
              className={`px-2.5 py-1.5 rounded-lg border ${
                isSel
                  ? 'bg-indigo-600 border-indigo-400'
                  : 'bg-[#1f2430] border-[#2d3345]'
              }`}
            >
              <Text
                className={`text-[11px] font-semibold ${
                  isSel ? 'text-white' : 'text-[#8b949e]'
                }`}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Selector de días de la semana (L M X J V S D) cuando elige Semanal */}
      {frequency === 'weekly' ? (
        <View className="flex-row items-center justify-between pt-1">
          {WEEK_DAYS_SELECTOR.map((wd) => {
            const active = selectedWeekDays.includes(wd.key);
            return (
              <Pressable
                key={wd.key}
                onPress={() => toggleWeekDay(wd.key)}
                className={`w-9 h-9 rounded-xl border items-center justify-center ${
                  active
                    ? 'bg-white border-white'
                    : 'bg-[#0d1117] border-[#2d3345]'
                }`}
              >
                <Text
                  className={`text-xs font-mono font-bold ${
                    active ? 'text-black' : 'text-[#8b949e]'
                  }`}
                >
                  {wd.short}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* Confirmación del día del mes cuando elige Mensual */}
      {frequency === 'monthly' ? (
        <View className="px-3 py-2 rounded-xl bg-[#0d1117] border border-[#262b3a]">
          <Text className="text-[11px] text-indigo-300 font-mono">
            Se repetirá el día {Number(activeDay?.dayNum || 27)} de cada mes
          </Text>
        </View>
      ) : null}
    </View>
  );

  // ==================== MODO A: POPUP AL CREAR EN EL CALENDARIO ====================
  if (isDirectFromCalendar) {
    const startQ = slotPickerTarget!.defaultStartQ!;
    const startStr = formatQuarterToTime(startQ);
    const endStr = formatQuarterToTime(startQ + quarters);

    return (
      <View className="bg-[#161922] border border-[#2d3345] rounded-2xl p-4 gap-3.5 w-full max-w-sm self-center shadow-2xl">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <NotionIcon name="clock" size={14} color="#818cf8" />
            <Text className="font-mono font-bold text-xs text-indigo-400">
              {startStr} – {endStr}
            </Text>
          </View>

          <Pressable
            onPress={handleClose}
            hitSlop={8}
            className="w-6 h-6 rounded-full bg-[#1f2430] items-center justify-center"
          >
            <NotionIcon name="close" size={12} color="#8b949e" />
          </Pressable>
        </View>

        <TextInput
          value={customTitle}
          onChangeText={setCustomTitle}
          autoFocus
          placeholder="Añade un título y pulsa Enter..."
          placeholderTextColor="#8b949e"
          onSubmitEditing={() => handleSelectSlot(startQ, quarters)}
          className="bg-[#0d1117] border border-[#2d3345] rounded-xl px-3.5 py-2.5 text-xs text-white"
        />

        {renderRecurrenceSelector()}

        <View className="flex-row items-center justify-end gap-2 pt-1">
          <Pressable
            onPress={handleClose}
            className="px-3 py-1.5 rounded-lg"
          >
            <Text className="text-xs font-medium text-[#8b949e]">Cancelar</Text>
          </Pressable>

          <Pressable
            onPress={() => handleSelectSlot(startQ, quarters)}
            className="px-4 py-1.5 rounded-xl bg-white active:opacity-85"
          >
            <Text className="text-xs font-bold text-black">Guardar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ==================== MODO B: 1-TAP TIME BLOCKING DESDE PENDIENTES / IDEAS ====================
  return (
    <View className="bg-[#161922] border border-[#2d3345] rounded-3xl p-5 gap-3.5 w-full max-w-sm self-center shadow-2xl">
      <View className="flex-row items-center justify-between pb-2 border-b border-[#262b3a]">
        <View className="flex-row items-center gap-2 flex-1 min-w-0">
          <NotionIcon name="clock" size={15} color="#818cf8" />
          <Text numberOfLines={1} className="font-bold text-xs text-white flex-1">
            Agendar: "{customTitle}"
          </Text>
        </View>
        <Pressable
          onPress={handleClose}
          className="w-6 h-6 rounded-full bg-[#1f2430] items-center justify-center"
        >
          <NotionIcon name="close" size={12} color="#8b949e" />
        </Pressable>
      </View>

      {renderRecurrenceSelector()}

      <Text className="text-xs text-[#8b949e]">
        Elige un hueco libre de hoy en 1 toque:
      </Text>

      <View className="flex-row flex-wrap gap-2">
        {SMART_SLOTS_PRESETS.map((slot) => (
          <Pressable
            key={slot.startTime}
            onPress={() => handleSelectSlot(slot.startQ, 2)}
            style={{ width: '48%' }}
            className="p-3 rounded-xl bg-[#1f2430] border border-[#2d3345] active:border-white"
          >
            <Text className="font-mono font-bold text-xs text-indigo-400">
              {slot.startTime}
            </Text>
            <Text numberOfLines={1} className="text-[10px] text-[#8b949e] mt-0.5">
              {slot.label}
            </Text>
          </Pressable>
        ))}

        <Pressable
          onPress={() => setShowCustomInput((v) => !v)}
          style={{ width: '48%' }}
          className="p-3 rounded-xl bg-[#1f2430] border border-dashed border-[#2d3345] active:border-white"
        >
          <Text className="font-mono font-bold text-xs text-white">Manual</Text>
          <Text className="text-[10px] text-[#8b949e] mt-0.5">Elegir HH:MM</Text>
        </Pressable>
      </View>

      {showCustomInput ? (
        <View className="flex-row items-center gap-2 pt-1">
          <TextInput
            value={customHourStr}
            onChangeText={setCustomHourStr}
            placeholder="15:30"
            placeholderTextColor="#8b949e"
            className="flex-1 bg-[#1f2430] border border-[#2d3345] rounded-xl px-3 py-2 text-xs font-mono text-white"
          />
          <Pressable
            onPress={handleApplyCustomTime}
            className="px-3.5 py-2 rounded-xl bg-white"
          >
            <Text className="text-xs font-bold text-black">Fijar</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};

export default function SlotPickerModalScreen() {
  const router = useRouter();
  return (
    <View className="flex-1 bg-black/75 justify-end sm:justify-center p-4">
      <SlotPickerSheetContent
        onClose={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/');
          }
        }}
      />
    </View>
  );
}
