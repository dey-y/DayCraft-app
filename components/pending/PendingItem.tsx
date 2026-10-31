import React, { useRef } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { PendingTask } from '@/services/db/sqlite';
import { NotionIcon } from '@/components/ui/NotionIcon';
import { useTheme } from '@/store/useThemeStore';

interface PendingItemProps {
  task: PendingTask;
  onToggle: (id: string) => void;
  onAssignTime: (task: PendingTask) => void;
}

/**
 * PendingItem — Tarea de hoy sin hora fija con microinteracciones:
 * - Checkbox táctil con micro-rebote elástico al marcar/desmarcar.
 * - Transición de opacidad y tachado suave.
 * - Botón táctil [ Fijar hora ] con micro-escala para 1-Tap Time-Blocking.
 */
export const PendingItem: React.FC<PendingItemProps> = ({
  task,
  onToggle,
  onAssignTime,
}) => {
  const { colors } = useTheme();
  const checkScale = useRef(new Animated.Value(1)).current;

  const handleToggle = () => {
    // Microinteracción: rebote elástico del checkbox
    Animated.sequence([
      Animated.timing(checkScale, {
        toValue: 0.78,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.spring(checkScale, {
        toValue: 1,
        friction: 4,
        tension: 180,
        useNativeDriver: true,
      }),
    ]).start();

    onToggle(task.id);
  };

  return (
    <View
      className={`bg-raised border border-line rounded-xl p-3 flex-row items-center justify-between gap-2.5 transition-all ${
        task.completed ? 'opacity-55' : 'opacity-100'
      }`}
    >
      <Pressable
        onPress={handleToggle}
        className="flex-row items-center gap-2.5 flex-1 min-w-0"
      >
        <Animated.View
          style={{ transform: [{ scale: checkScale }] }}
          className={`w-5 h-5 rounded-md border items-center justify-center flex-shrink-0 transition-colors ${
            task.completed
              ? 'bg-ink border-ink'
              : 'bg-card border-line active:border-ink'
          }`}
        >
          {task.completed ? (
            <NotionIcon name="check" size={12} color={colors.canvas} strokeWidth={2.5} />
          ) : null}
        </Animated.View>

        <View className="flex-row items-center gap-2 flex-1 min-w-0">
          <Text
            numberOfLines={1}
            className={`text-sm font-medium flex-shrink ${
              task.completed ? 'line-through text-muted' : 'text-ink'
            }`}
          >
            {task.title}
          </Text>

          {task.isFromYesterday ? (
            <View className="px-2 py-0.5 rounded-full bg-warm/15 border border-warm/30 flex-shrink-0">
              <Text
                numberOfLines={1}
                className="text-[11px] font-mono font-semibold text-warm"
              >
                De ayer
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      <Pressable
        onPress={() => onAssignTime(task)}
        hitSlop={6}
        className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-line active:border-ink active:scale-95 transition-transform flex-shrink-0"
      >
        <NotionIcon name="clock" size={12} color={colors.muted} />
        <Text className="text-xs font-medium text-muted">Fijar hora</Text>
      </Pressable>
    </View>
  );
};
