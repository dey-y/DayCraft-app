import React from 'react';
import { View, Text } from 'react-native';
import { NotionIcon } from '@/components/ui/NotionIcon';
import { useTheme } from '@/store/useThemeStore';

interface EmptyCelebrationProps {
  title?: string;
  subtitle?: string;
}

/**
 * EmptyCelebration — Estado vacío motivador y antiestrés (v7-v9)
 */
export const EmptyCelebration: React.FC<EmptyCelebrationProps> = ({
  title = '¡Todo despejado por hoy!',
  subtitle = 'Has completado todos tus recordatorios y tareas pendientes de hoy. Estás 100% al día sin estrés.',
}) => {
  const { colors } = useTheme();
  return (
    <View className="py-8 px-4 bg-raised/70 border border-dashed border-line rounded-2xl items-center gap-2.5">
      <View className="w-11 h-11 rounded-full bg-ok/10 border border-ok/25 items-center justify-center">
        <NotionIcon name="check-circle" size={22} color={colors.ok} />
      </View>
      <Text className="font-bold text-sm text-ink text-center">{title}</Text>
      <Text className="text-xs text-muted text-center leading-relaxed max-w-xs">
        {subtitle}
      </Text>
    </View>
  );
};
