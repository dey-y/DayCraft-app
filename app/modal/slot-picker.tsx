import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useDayCraftStore, formatQuarterToTime } from '@/store/useDayCraftStore';
import { SMART_SLOTS_PRESETS } from '@/constants/theme';
import { NotionIcon } from '@/components/ui/NotionIcon';

interface SlotPickerSheetContentProps {
  onClose?: () => void;
}

export const SlotPickerSheetContent: React.FC<SlotPickerSheetContentProps> = ({
  onClose,
}) => {
  const slotPickerTarget = useDayCraftStore((s) => s.slotPickerTarget);
  const assignSlotFromPicker = useDayCraftStore((s) => s.assignSlotFromPicker);
  const closeSlotPicker = useDayCraftStore((s) => s.closeSlotPicker);

  const [customTitle, setCustomTitle] = useState(
    slotPickerTarget?.title || 'Bloque enfocado'
  );
  const [customHourStr, setCustomHourStr] = useState('15:30');
  const [showCustomInput, setShowCustomInput] = useState(false);

  useEffect(() => {
    if (slotPickerTarget?.title) {
      setCustomTitle(slotPickerTarget.title);
    }
    if (typeof slotPickerTarget?.defaultStartQ === 'number') {
      setCustomHourStr(formatQuarterToTime(slotPickerTarget.defaultStartQ));
    }
  }, [slotPickerTarget]);

  const handleClose = () => {
    closeSlotPicker();
    onClose?.();
  };

  const handleSelectSlot = (startQ: number, quarters = 2) => {
    assignSlotFromPicker(startQ, quarters, customTitle.trim() || 'Bloque enfocado');
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

  return (
    <View className="bg-[#161922] border border-[#2d3345] rounded-3xl p-5 gap-4 w-full max-w-sm self-center shadow-2xl">
      <View className="flex-row items-center justify-between pb-2.5 border-b border-[#262b3a]">
        <View className="flex-row items-center gap-2 flex-1 min-w-0">
          <NotionIcon name="clock" size={16} color="#818cf8" />
          <Text numberOfLines={1} className="font-bold text-xs text-white flex-1">
            1-Tap Time Blocking
          </Text>
        </View>
        <Pressable
          onPress={handleClose}
          className="w-6 h-6 rounded-full bg-[#1f2430] items-center justify-center"
        >
          <NotionIcon name="close" size={12} color="#8b949e" />
        </Pressable>
      </View>

      <View className="gap-1.5">
        <Text className="text-[10px] uppercase tracking-wider font-bold text-[#8b949e]">
          Título del Bloque
        </Text>
        <TextInput
          value={customTitle}
          onChangeText={setCustomTitle}
          placeholder="Nombre de la tarea o bloque..."
          placeholderTextColor="#8b949e"
          className="bg-[#1f2430] border border-[#2d3345] rounded-xl px-3 py-2 text-xs text-white"
        />
      </View>

      {typeof slotPickerTarget?.defaultStartQ === 'number' ? (
        <Pressable
          onPress={() => handleSelectSlot(slotPickerTarget.defaultStartQ!, 2)}
          className="p-3 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex-row items-center justify-between active:opacity-85"
        >
          <View>
            <Text className="font-mono font-bold text-xs text-indigo-300">
              Agendar a las {formatQuarterToTime(slotPickerTarget.defaultStartQ)}
            </Text>
            <Text className="text-[10px] text-[#8b949e]">
              Hora seleccionada en el raíl (30 min)
            </Text>
          </View>
          <View className="px-2.5 py-1 rounded-lg bg-white">
            <Text className="text-[10px] font-bold text-black">Confirmar</Text>
          </View>
        </Pressable>
      ) : null}

      <Text className="text-xs text-[#8b949e]">
        O elige un hueco inteligente libre de hoy en 1 toque:
      </Text>

      <View className="flex-row flex-wrap gap-2.5">
        {SMART_SLOTS_PRESETS.map((slot) => (
          <Pressable
            key={slot.startTime}
            onPress={() => handleSelectSlot(slot.startQ, slot.quarters)}
            style={{ width: '47%' }}
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
          style={{ width: '47%' }}
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

/**
 * Ruta Modal Expo Router: `/modal/slot-picker`
 */
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
