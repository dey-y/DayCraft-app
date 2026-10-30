import React from 'react';
import { View, Text } from 'react-native';
import { NotionIcon } from '@/components/ui/NotionIcon';

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
  return (
    <View className="py-8 px-4 bg-[#1f2430]/70 border border-dashed border-[#2d3345] rounded-2xl items-center gap-2.5">
      <View className="w-11 h-11 rounded-full bg-emerald-500/10 border border-emerald-500/25 items-center justify-center">
        <NotionIcon name="check-circle" size={22} color="#34d399" />
      </View>
      <Text className="font-bold text-sm text-white text-center">{title}</Text>
      <Text className="text-xs text-[#8b949e] text-center leading-relaxed max-w-xs">
        {subtitle}
      </Text>
    </View>
  );
};
