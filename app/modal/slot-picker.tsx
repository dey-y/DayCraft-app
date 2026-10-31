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
import { useTheme } from '@/store/useThemeStore';

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
  const { colors } = useTheme();
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
      <Text className="text-xs uppercase tracking-wider font-bold text-muted">
        Repetición
      </Text>
      <View className="flex-row flex-wrap gap-1.5">
        {FREQUENCY_OPTIONS.map((opt) => {
          const isSel = frequency === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => setFrequency(opt.key)}
              className={`px-3 py-2 rounded-lg border ${
                isSel
                  ? 'bg-accent/20 border-accent'
                  : 'bg-raised border-line'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  isSel ? 'text-ink' : 'text-muted'
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
                className={`w-10 h-10 rounded-xl border items-center justify-center ${
                  active
                    ? 'bg-ink border-ink'
                    : 'bg-canvas border-line'
                }`}
              >
                <Text
                  className={`text-xs font-mono font-bold ${
                    active ? 'text-canvas' : 'text-muted'
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
        <View className="px-3 py-2 rounded-xl bg-canvas border border-line-subtle">
          <Text className="text-xs text-accent-soft font-mono">
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
      <View className="bg-card border border-line rounded-2xl p-4 gap-3.5 w-full max-w-sm self-center shadow-2xl">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <NotionIcon name="clock" size={15} color={colors.accentSoft} />
            <Text className="font-mono font-bold text-sm text-accent-soft">
              {startStr} – {endStr}
            </Text>
          </View>

          <Pressable
            onPress={handleClose}
            hitSlop={10}
            className="w-8 h-8 rounded-full bg-raised items-center justify-center"
          >
            <NotionIcon name="close" size={13} color={colors.muted} />
          </Pressable>
        </View>

        <TextInput
          value={customTitle}
          onChangeText={setCustomTitle}
          autoFocus
          placeholder="Añade un título y pulsa Enter..."
          placeholderTextColor={colors.muted}
          onSubmitEditing={() => handleSelectSlot(startQ, quarters)}
          className="bg-canvas border border-line rounded-xl px-3.5 py-2.5 text-sm text-ink"
        />

        {renderRecurrenceSelector()}

        <View className="flex-row items-center justify-end gap-2 pt-1">
          <Pressable
            onPress={handleClose}
            className="px-4 py-2.5 rounded-lg active:opacity-70"
          >
            <Text className="text-sm font-medium text-muted">Cancelar</Text>
          </Pressable>

          <Pressable
            onPress={() => handleSelectSlot(startQ, quarters)}
            className="px-4 py-2.5 rounded-xl bg-ink active:opacity-85 active:scale-95 transition-transform"
          >
            <Text className="text-sm font-bold text-canvas">Guardar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ==================== MODO B: 1-TAP TIME BLOCKING DESDE PENDIENTES / IDEAS ====================
  return (
    <View className="bg-card border border-line rounded-3xl p-5 gap-3.5 w-full max-w-sm self-center shadow-2xl">
      <View className="flex-row items-center justify-between pb-2 border-b border-line-subtle">
        <View className="flex-row items-center gap-2 flex-1 min-w-0">
          <NotionIcon name="clock" size={16} color={colors.accentSoft} />
          <Text numberOfLines={1} className="font-bold text-sm text-ink flex-1">
            Agendar: "{customTitle}"
          </Text>
        </View>
        <Pressable
          onPress={handleClose}
          hitSlop={10}
          className="w-8 h-8 rounded-full bg-raised items-center justify-center"
        >
          <NotionIcon name="close" size={13} color={colors.muted} />
        </Pressable>
      </View>

      {renderRecurrenceSelector()}

      <Text className="text-sm text-muted">
        Elige un hueco libre de hoy en 1 toque:
      </Text>

      <View className="flex-row flex-wrap gap-2">
        {SMART_SLOTS_PRESETS.map((slot) => (
          <Pressable
            key={slot.startTime}
            onPress={() => handleSelectSlot(slot.startQ, 2)}
            style={{ width: '48%' }}
            className="p-3.5 rounded-xl bg-raised border border-line active:border-ink active:scale-95 transition-transform"
          >
            <Text className="font-mono font-bold text-sm text-accent-soft">
              {slot.startTime}
            </Text>
            <Text numberOfLines={1} className="text-xs text-muted mt-0.5">
              {slot.label}
            </Text>
          </Pressable>
        ))}

        <Pressable
          onPress={() => setShowCustomInput((v) => !v)}
          style={{ width: '48%' }}
          className="p-3.5 rounded-xl bg-raised border border-dashed border-line active:border-ink active:scale-95 transition-transform"
        >
          <Text className="font-mono font-bold text-sm text-ink">Manual</Text>
          <Text className="text-xs text-muted mt-0.5">Elegir HH:MM</Text>
        </Pressable>
      </View>

      {showCustomInput ? (
        <View className="flex-row items-center gap-2 pt-1">
          <TextInput
            value={customHourStr}
            onChangeText={setCustomHourStr}
            placeholder="15:30"
            placeholderTextColor={colors.muted}
            className="flex-1 bg-raised border border-line rounded-xl px-3 py-2 text-sm font-mono text-ink"
          />
          <Pressable
            onPress={handleApplyCustomTime}
            className="px-4 py-2.5 rounded-xl bg-ink active:opacity-85"
          >
            <Text className="text-sm font-bold text-canvas">Fijar</Text>
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
