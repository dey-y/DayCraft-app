import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { PendingTask } from '@/services/db/sqlite';
import { NotionIcon } from '@/components/ui/NotionIcon';
import { useTheme } from '@/store/useThemeStore';

interface PendingItemProps {
  task: PendingTask;
  onToggle: (id: string) => void;
  onAssignTime: (task: PendingTask) => void;
}

/**
 * PendingItem — Tarea de hoy sin hora fija
 * Incluye checkbox táctil, etiqueta `[ De ayer ]` en una sola línea (`flex-shrink-0`)
 * y botón rápido `[ Fijar hora ]` para 1-Tap Time-Blocking.
 */
export const PendingItem: React.FC<PendingItemProps> = ({
  task,
  onToggle,
  onAssignTime,
}) => {
  const { colors } = useTheme();
  return (
    <View
      className={`bg-raised border border-line rounded-xl p-3 flex-row items-center justify-between gap-2.5 ${
        task.completed ? 'opacity-50' : ''
      }`}
    >
      <Pressable
        onPress={() => onToggle(task.id)}
        className="flex-row items-center gap-2.5 flex-1 min-w-0"
      >
        <View
          className={`w-4 h-4 rounded border items-center justify-center flex-shrink-0 ${
            task.completed
              ? 'bg-ink border-ink'
              : 'bg-card border-line'
          }`}
        >
          {task.completed ? (
            <NotionIcon name="check" size={11} color={colors.canvas} strokeWidth={2.5} />
          ) : null}
        </View>

        <View className="flex-row items-center gap-2 flex-1 min-w-0">
          <Text
            numberOfLines={1}
            className={`text-xs font-medium flex-shrink ${
              task.completed ? 'line-through text-muted' : 'text-ink'
            }`}
          >
            {task.title}
          </Text>

          {task.isFromYesterday ? (
            <View className="px-2 py-0.5 rounded-full bg-warm/10 border border-warm/25 flex-shrink-0">
              <Text
                numberOfLines={1}
                className="text-[9px] font-mono font-semibold text-warm"
              >
                De ayer
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      <Pressable
        onPress={() => onAssignTime(task)}
        className="flex-row items-center gap-1 px-2.5 py-1 rounded-lg bg-card border border-line active:border-ink flex-shrink-0"
      >
        <NotionIcon name="clock" size={11} color={colors.muted} />
        <Text className="text-[10px] font-medium text-muted">Fijar hora</Text>
      </Pressable>
    </View>
  );
};
