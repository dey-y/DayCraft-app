import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { PendingTask } from '@/services/db/sqlite';
import { NotionIcon } from '@/components/ui/NotionIcon';
import { useTheme } from '@/store/useThemeStore';

interface PendingItemProps {
  task: PendingTask;
  onToggle: (id: string) => void;
  onAssignTime: (task: PendingTask) => void;
}

/**
 * PendingItem — Tarea de hoy sin hora fija con microinteracciones Reanimated v4:
 * - Checkbox táctil con micro-rebote elástico al marcar/desmarcar.
 * - Transición de opacidad y tachado suave.
 * - Botón táctil [ Fijar hora ] >= 44px para 1-Tap Time-Blocking.
 */
export const PendingItem: React.FC<PendingItemProps> = ({
  task,
  onToggle,
  onAssignTime,
}) => {
  const { colors } = useTheme();
  const checkScale = useSharedValue(1);

  const animatedCheckStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const handleToggle = () => {
    checkScale.value = withSequence(
      withTiming(0.76, { duration: 85 }),
      withSpring(1, { damping: 10, stiffness: 260 })
    );
    onToggle(task.id);
  };

  return (
    <View
      className={`bg-raised border border-line rounded-xl px-3 py-2 flex-row items-center justify-between gap-2.5 ${
        task.completed ? 'opacity-55' : 'opacity-100'
      }`}
    >
      <Pressable
        onPress={handleToggle}
        hitSlop={6}
        className="min-h-[44px] flex-row items-center gap-2.5 flex-1 min-w-0"
      >
        <Animated.View
          style={animatedCheckStyle}
          className={`w-5 h-5 rounded-md border items-center justify-center flex-shrink-0 ${
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
                className="text-xs font-mono font-semibold text-warm"
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
        className="min-h-[44px] flex-row items-center gap-1.5 px-3 rounded-xl bg-card border border-line active:border-ink active:scale-95 flex-shrink-0 justify-center"
      >
        <NotionIcon name="clock" size={13} color={colors.muted} />
        <Text className="text-xs font-medium text-muted">Fijar hora</Text>
      </Pressable>
    </View>
  );
};
