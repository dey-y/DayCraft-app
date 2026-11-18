import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import {
  useDayCraftStore,
  formatQuarterToTime,
  formatQuartersToDuration,
  doesEventApplyToDay,
} from '@/store/useDayCraftStore';
import {
  RecurrenceFrequency,
  EventRecurrenceRule,
  TimelineEvent,
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
  { key: 'none', label: 'Ninguna' },
  { key: 'daily', label: 'Diaria' },
  { key: 'weekly', label: 'Semanal' },
  { key: 'monthly', label: 'Mensual' },
];

const DURATION_OPTIONS: { quarters: number; label: string }[] = [
  { quarters: 1, label: '15m' },
  { quarters: 2, label: '30m' },
  { quarters: 3, label: '45m' },
  { quarters: 4, label: '1h' },
  { quarters: 6, label: '1h 30m' },
  { quarters: 8, label: '2h' },
  { quarters: 12, label: '3h' },
];

function parseTimeStringToQuarter(timeStr: string, fallbackQ: number): number {
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0] || '', 10);
  const m = parseInt(parts[1] || '0', 10);
  if (isNaN(h)) return fallbackQ;
  const clampedH = Math.max(0, Math.min(23, h));
  const qOffset = isNaN(m) ? 0 : Math.round(m / 15) % 4;
  return Math.max(0, Math.min(95, clampedH * 4 + qOffset));
}

function getSlotPeriodLabel(startQ: number): string {
  if (startQ < 48) return 'Mañana libre';
  if (startQ < 56) return 'Mediodía libre';
  if (startQ < 76) return 'Tarde libre';
  return 'Noche libre';
}

/**
 * Dynamically suggests up to 4 free timeline slots for the active day,
 * avoiding any occupied quarters from existing events.
 */
function suggestFreeSlots(
  dayEvents: TimelineEvent[],
  durationQuarters: number
): { startQ: number; startTime: string; label: string }[] {
  const busyQuarters = new Array<boolean>(96).fill(false);
  for (const ev of dayEvents) {
    const endQ = Math.min(96, ev.startQ + ev.quarters);
    for (let q = Math.max(0, ev.startQ); q < endQ; q++) {
      busyQuarters[q] = true;
    }
  }

  const isSlotFree = (startQ: number, len: number) => {
    if (startQ < 0 || startQ + len > 96) return false;
    for (let q = startQ; q < startQ + len; q++) {
      if (busyQuarters[q]) return false;
    }
    return true;
  };

  const freeSlots: { startQ: number; startTime: string; label: string }[] = [];
  const usedStartQ = new Set<number>();

  for (const preset of SMART_SLOTS_PRESETS) {
    if (isSlotFree(preset.startQ, durationQuarters)) {
      freeSlots.push({
        startQ: preset.startQ,
        startTime: preset.startTime,
        label: preset.label,
      });
      usedStartQ.add(preset.startQ);
    }
  }

  if (freeSlots.length < 4) {
    for (let q = 32; q <= 88 - durationQuarters; q += 2) {
      if (freeSlots.length >= 4) break;
      if (usedStartQ.has(q)) continue;
      if (isSlotFree(q, durationQuarters)) {
        const overlapsPicked = freeSlots.some(
          (s) => Math.abs(s.startQ - q) < Math.max(2, durationQuarters)
        );
        if (!overlapsPicked) {
          freeSlots.push({
            startQ: q,
            startTime: formatQuarterToTime(q),
            label: getSlotPeriodLabel(q),
          });
          usedStartQ.add(q);
        }
      }
    }
  }

  return freeSlots.slice(0, 4);
}

/**
 * SlotPickerSheetContent — Popover de creación y edición completa de bloques en el Timeline 24h
 * Permite editar:
 * - Título y descripción/nota del bloque.
 * - Tipo de bloque (Tarea de Foco vs Recordatorio Puntual).
 * - Hora de inicio (startQ) y duración en cuartos de hora (15m, 30m, 45m, 1h, 1h 30m, 2h...).
 * - Regla de recurrencia (ninguna, diaria, semanal, mensual).
 */
export const SlotPickerSheetContent: React.FC<SlotPickerSheetContentProps> = ({
  onClose,
}) => {
  const { colors } = useTheme();
  const slotPickerTarget = useDayCraftStore((s) => s.slotPickerTarget);
  const assignSlotFromPicker = useDayCraftStore((s) => s.assignSlotFromPicker);
  const removeTimelineEvent = useDayCraftStore((s) => s.removeTimelineEvent);
  const closeSlotPicker = useDayCraftStore((s) => s.closeSlotPicker);
  const days = useDayCraftStore((s) => s.days);
  const selectedDayKey = useDayCraftStore((s) => s.selectedDayKey);
  const events = useDayCraftStore((s) => s.events);

  const activeDay =
    days.find((d) => d.key === selectedDayKey) ||
    days.find((d) => d.isToday) ||
    days[7] ||
    days[0];

  const dayEvents = useMemo(
    () =>
      events.filter((e) =>
        activeDay ? doesEventApplyToDay(e, activeDay) : e.dayKey === selectedDayKey
      ),
    [events, activeDay, selectedDayKey]
  );

  const [customTitle, setCustomTitle] = useState(slotPickerTarget?.title || '');
  const [customDesc, setCustomDesc] = useState(slotPickerTarget?.desc || '');
  const [blockType, setBlockType] = useState<'task' | 'reminder'>(
    slotPickerTarget?.eventType || 'task'
  );
  const [startQ, setStartQ] = useState<number>(
    slotPickerTarget?.defaultStartQ ?? 48
  );
  const [quarters, setQuarters] = useState<number>(
    slotPickerTarget?.defaultQuarters || 2
  );
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(
    slotPickerTarget?.recurrence?.frequency || 'none'
  );
  const [selectedWeekDays, setSelectedWeekDays] = useState<string[]>(
    slotPickerTarget?.recurrence?.daysOfWeek || [activeDay?.dayName || 'MAR']
  );
  const [customHourStr, setCustomHourStr] = useState('12:00');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const availableSlots = useMemo(
    () => suggestFreeSlots(dayEvents, quarters),
    [dayEvents, quarters]
  );

  const isEditMode = slotPickerTarget?.type === 'edit_event';
  const isDirectFromCalendar =
    slotPickerTarget?.type === 'direct_hour' &&
    typeof slotPickerTarget?.defaultStartQ === 'number';

  useEffect(() => {
    const initialStartQ =
      typeof slotPickerTarget?.defaultStartQ === 'number'
        ? slotPickerTarget.defaultStartQ
        : 48;
    const initialQuarters = slotPickerTarget?.defaultQuarters || 2;

    setCustomTitle(slotPickerTarget?.title || '');
    setCustomDesc(slotPickerTarget?.desc || '');
    setBlockType(slotPickerTarget?.eventType || 'task');
    setStartQ(initialStartQ);
    setQuarters(initialQuarters);
    setFrequency(slotPickerTarget?.recurrence?.frequency || 'none');
    setSelectedWeekDays(
      slotPickerTarget?.recurrence?.daysOfWeek &&
        slotPickerTarget.recurrence.daysOfWeek.length > 0
        ? slotPickerTarget.recurrence.daysOfWeek
        : [activeDay?.dayName || 'MAR']
    );
    setCustomHourStr(formatQuarterToTime(initialStartQ));
  }, [slotPickerTarget, activeDay?.dayName]);

  const toggleWeekDay = (dayKey: string) => {
    setSelectedWeekDays((prev) => {
      if (prev.includes(dayKey)) {
        return prev.length > 1 ? prev.filter((d) => d !== dayKey) : prev;
      }
      return [...prev, dayKey];
    });
  };

  const handleShiftStartQ = (deltaQ: number) => {
    const nextQ = Math.max(0, Math.min(95, startQ + deltaQ));
    setStartQ(nextQ);
    setCustomHourStr(formatQuarterToTime(nextQ));
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
        dayNumOfMonth:
          slotPickerTarget?.recurrence?.dayNumOfMonth ||
          activeDay?.dayNum ||
          '01',
      };
    }
    return undefined;
  };

  const handleClose = () => {
    closeSlotPicker();
    onClose?.();
  };

  const handleSaveSlot = (chosenStartQ = startQ, chosenQuarters = quarters) => {
    const effectiveStartQ = parseTimeStringToQuarter(customHourStr, chosenStartQ);
    assignSlotFromPicker(
      effectiveStartQ,
      chosenQuarters,
      customTitle.trim() || 'Bloque enfocado',
      buildRecurrenceRule(),
      {
        desc: customDesc.trim(),
        eventType: blockType,
      }
    );
    onClose?.();
  };

  const handleDeleteCurrentEvent = () => {
    if (isEditMode && slotPickerTarget?.id) {
      removeTimelineEvent(slotPickerTarget.id, true);
      closeSlotPicker();
      onClose?.();
    }
  };

  const renderBlockTypeSelector = () => (
    <View className="gap-1.5">
      <Text className="text-xs uppercase tracking-wider font-bold text-muted">
        Tipo de Bloque
      </Text>
      <View className="flex-row gap-2">
        <Pressable
          onPress={() => setBlockType('task')}
          className={`flex-1 flex-row items-center justify-center gap-1.5 py-2 px-3 rounded-xl border ${
            blockType === 'task'
              ? 'bg-accent/20 border-accent'
              : 'bg-raised border-line'
          }`}
        >
          <NotionIcon
            name="clock"
            size={13}
            color={blockType === 'task' ? colors.accentSoft : colors.muted}
          />
          <Text
            className={`text-xs font-semibold ${
              blockType === 'task' ? 'text-ink' : 'text-muted'
            }`}
          >
            Tarea de Foco
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setBlockType('reminder')}
          className={`flex-1 flex-row items-center justify-center gap-1.5 py-2 px-3 rounded-xl border ${
            blockType === 'reminder'
              ? 'bg-info/20 border-info'
              : 'bg-raised border-line'
          }`}
        >
          <NotionIcon
            name="reminder"
            size={13}
            color={blockType === 'reminder' ? colors.info : colors.muted}
          />
          <Text
            className={`text-xs font-semibold ${
              blockType === 'reminder' ? 'text-ink' : 'text-muted'
            }`}
          >
            Recordatorio Puntual
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const renderStartAndDurationSelectors = () => {
    const previewStartQ = parseTimeStringToQuarter(customHourStr, startQ);
    const startStr = formatQuarterToTime(previewStartQ);
    const endStr = formatQuarterToTime(previewStartQ + quarters);

    return (
      <View className="gap-3">
        {/* Hora de inicio (startQ) con ajuste cada 15m */}
        <View className="gap-1.5">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs uppercase tracking-wider font-bold text-muted">
              Hora de Inicio
            </Text>
            <Text className="text-xs font-mono font-bold text-accent-soft">
              {startStr} – {endStr} · {formatQuartersToDuration(quarters)}
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => handleShiftStartQ(-1)}
              className="px-3 py-2 min-h-[44px] justify-center rounded-xl bg-raised border border-line active:border-ink"
            >
              <Text className="text-xs font-mono font-bold text-ink">-15m</Text>
            </Pressable>

            <TextInput
              value={customHourStr}
              onChangeText={(val) => {
                setCustomHourStr(val);
                if (/^\d{1,2}:\d{2}$/.test(val.trim())) {
                  setStartQ(parseTimeStringToQuarter(val, startQ));
                }
              }}
              placeholder="11:30"
              placeholderTextColor={colors.muted}
              className="flex-1 min-h-[44px] bg-canvas border border-line rounded-xl px-3 py-2 text-center font-mono font-bold text-sm text-ink"
            />

            <Pressable
              onPress={() => handleShiftStartQ(1)}
              className="px-3 py-2 min-h-[44px] justify-center rounded-xl bg-raised border border-line active:border-ink"
            >
              <Text className="text-xs font-mono font-bold text-ink">+15m</Text>
            </Pressable>
          </View>
        </View>

        {/* Duración en cuartos de hora */}
        <View className="gap-1.5">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs uppercase tracking-wider font-bold text-muted">
              Duración · {formatQuartersToDuration(quarters)}
            </Text>
            <View className="flex-row items-center gap-1.5">
              <Pressable
                onPress={() => setQuarters((q) => Math.max(1, q - 1))}
                className="px-3 py-1.5 min-h-[44px] justify-center rounded-xl bg-raised border border-line active:border-ink"
              >
                <Text className="text-xs font-mono font-bold text-ink">-15m</Text>
              </Pressable>
              <Pressable
                onPress={() => setQuarters((q) => Math.min(48, q + 1))}
                className="px-3 py-1.5 min-h-[44px] justify-center rounded-xl bg-raised border border-line active:border-ink"
              >
                <Text className="text-xs font-mono font-bold text-ink">+15m</Text>
              </Pressable>
            </View>
          </View>
          <View className="flex-row flex-wrap gap-1.5">
            {DURATION_OPTIONS.map((opt) => {
              const isSelected = quarters === opt.quarters;
              return (
                <Pressable
                  key={opt.quarters}
                  onPress={() => setQuarters(opt.quarters)}
                  className={`px-3 py-1.5 rounded-lg border ${
                    isSelected
                      ? 'bg-accent/20 border-accent'
                      : 'bg-raised border-line'
                  }`}
                >
                  <Text
                    className={`text-xs font-mono font-semibold ${
                      isSelected ? 'text-ink' : 'text-muted'
                    }`}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  const renderRecurrenceSelector = () => (
    <View className="gap-2">
      <Text className="text-xs uppercase tracking-wider font-bold text-muted">
        Recurrencia
      </Text>
      <View className="flex-row flex-wrap gap-1.5">
        {FREQUENCY_OPTIONS.map((opt) => {
          const isSel = frequency === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => setFrequency(opt.key)}
              className={`px-3 py-1.5 rounded-lg border ${
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
                className={`w-11 h-11 rounded-xl border items-center justify-center ${
                  active ? 'bg-ink border-ink' : 'bg-canvas border-line'
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
            Se repetirá el día {Number(activeDay?.dayNum || 1)} de cada mes
          </Text>
        </View>
      ) : null}
    </View>
  );

  // ==================== MODO A: CREACIÓN DIRECTA EN EL CALENDARIO O EDICIÓN DE BLOQUE EXISTENTE ====================
  if (isDirectFromCalendar || isEditMode) {
    return (
      <View className="bg-card border border-line rounded-3xl p-4 sm:p-5 gap-3.5 w-full max-w-md self-center shadow-2xl max-h-[90%]">
        <View className="flex-row items-center justify-between pb-2 border-b border-line-subtle">
          <View className="flex-row items-center gap-2">
            <NotionIcon
              name={isEditMode ? 'edit' : 'clock'}
              size={15}
              color={colors.accentSoft}
            />
            <Text className="font-bold text-sm text-ink">
              {isEditMode ? 'Editar bloque del Timeline' : 'Nuevo bloque en Timeline'}
            </Text>
          </View>

          <Pressable
            onPress={handleClose}
            hitSlop={10}
            className="w-11 h-11 rounded-full bg-raised items-center justify-center"
          >
            <NotionIcon name="close" size={14} color={colors.muted} />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 12 }}
        >
          <View className="gap-1.5">
            <Text className="text-xs uppercase tracking-wider font-bold text-muted">
              Título
            </Text>
            <TextInput
              value={customTitle}
              onChangeText={setCustomTitle}
              autoFocus={!isEditMode}
              placeholder="Añade un título para el bloque..."
              placeholderTextColor={colors.muted}
              onSubmitEditing={() => handleSaveSlot(startQ, quarters)}
              className="bg-canvas border border-line rounded-xl px-3.5 py-2.5 text-sm font-semibold text-ink"
            />
          </View>

          <View className="gap-1.5">
            <Text className="text-xs uppercase tracking-wider font-bold text-muted">
              Descripción / Nota
            </Text>
            <TextInput
              value={customDesc}
              onChangeText={setCustomDesc}
              placeholder="Detalles opcionales o enlace..."
              placeholderTextColor={colors.muted}
              className="bg-canvas border border-line rounded-xl px-3.5 py-2 text-xs text-ink"
            />
          </View>

          {renderBlockTypeSelector()}
          {renderStartAndDurationSelectors()}
          {renderRecurrenceSelector()}
        </ScrollView>

        <View className="flex-row items-center justify-between pt-2 border-t border-line-subtle">
          {isEditMode ? (
            <Pressable
              onPress={handleDeleteCurrentEvent}
              className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl bg-raised border border-line active:border-ink"
            >
              <NotionIcon name="trash" size={13} color={colors.now} />
              <Text className="text-xs font-semibold text-now">Eliminar</Text>
            </Pressable>
          ) : (
            <View />
          )}

          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={handleClose}
              className="px-4 py-2.5 rounded-xl active:opacity-70"
            >
              <Text className="text-sm font-medium text-muted">Cancelar</Text>
            </Pressable>

            <Pressable
              onPress={() => handleSaveSlot(startQ, quarters)}
              className="px-4 py-2.5 rounded-xl bg-ink active:opacity-85 active:scale-95 transition-transform"
            >
              <Text className="text-sm font-bold text-canvas">
                {isEditMode ? 'Guardar cambios' : 'Guardar'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // ==================== MODO B: 1-TAP TIME BLOCKING DESDE PENDIENTES / IDEAS ====================
  return (
    <View className="bg-card border border-line rounded-3xl p-5 gap-3.5 w-full max-w-md self-center shadow-2xl max-h-[90%]">
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 }}
      >
        {renderBlockTypeSelector()}

        {/* Selector de Duración */}
        <View className="gap-1.5">
          <Text className="text-xs uppercase tracking-wider font-bold text-muted">
            Duración del bloque
          </Text>
          <View className="flex-row flex-wrap gap-1.5">
            {DURATION_OPTIONS.map((opt) => {
              const isSelected = quarters === opt.quarters;
              return (
                <Pressable
                  key={opt.quarters}
                  onPress={() => setQuarters(opt.quarters)}
                  className={`px-3 py-1.5 rounded-lg border ${
                    isSelected
                      ? 'bg-accent/20 border-accent'
                      : 'bg-raised border-line'
                  }`}
                >
                  <Text
                    className={`text-xs font-mono font-semibold ${
                      isSelected ? 'text-ink' : 'text-muted'
                    }`}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {renderRecurrenceSelector()}

        <Text className="text-sm text-muted">
          Elige un hueco libre de hoy en 1 toque:
        </Text>

        <View className="flex-row flex-wrap gap-2">
          {availableSlots.length === 0 ? (
            <View className="w-full p-3.5 rounded-xl bg-raised border border-line-subtle">
              <Text className="text-xs text-muted">
                Agenda completa para esta duración · Usa Manual para elegir una hora exacta.
              </Text>
            </View>
          ) : (
            availableSlots.map((slot) => (
              <Pressable
                key={slot.startTime}
                onPress={() => {
                  setCustomHourStr(slot.startTime);
                  setStartQ(slot.startQ);
                  assignSlotFromPicker(
                    slot.startQ,
                    quarters,
                    customTitle.trim() || 'Bloque enfocado',
                    buildRecurrenceRule(),
                    {
                      desc: customDesc.trim() || undefined,
                      eventType: blockType,
                    }
                  );
                  onClose?.();
                }}
                style={{ width: '48%' }}
                className="p-3.5 min-h-[44px] rounded-xl bg-raised border border-line active:border-ink active:scale-95 transition-transform"
              >
                <Text className="font-mono font-bold text-sm text-accent-soft">
                  {slot.startTime}
                </Text>
                <Text numberOfLines={1} className="text-xs text-muted mt-0.5">
                  {slot.label}
                </Text>
              </Pressable>
            ))
          )}

          <Pressable
            onPress={() => setShowCustomInput((v) => !v)}
            style={{ width: '48%' }}
            className="p-3.5 min-h-[44px] rounded-xl bg-raised border border-dashed border-line active:border-ink active:scale-95 transition-transform"
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
              onPress={() => {
                const parsedQ = parseTimeStringToQuarter(customHourStr, 62);
                handleSaveSlot(parsedQ, quarters);
              }}
              className="px-4 py-2.5 rounded-xl bg-ink active:opacity-85"
            >
              <Text className="text-sm font-bold text-canvas">Fijar</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

export default function SlotPickerModalScreen() {
  const router = useRouter();
  return (
    <View className="flex-1 bg-canvas/85 justify-end sm:justify-center p-4">
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
