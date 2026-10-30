import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { IdeaItemData } from '@/services/db/sqlite';
import { NotionIcon } from '@/components/ui/NotionIcon';

interface IdeaItemProps {
  idea: IdeaItemData;
  onScheduleStep: (idea: IdeaItemData) => void;
}

/**
 * IdeaItem — Tarjeta individual de una idea vinculada a un proyecto temático
 * Permite convertir la idea en un bloque de acción en el Timeline 24h con 1 toque.
 */
export const IdeaItem: React.FC<IdeaItemProps> = ({ idea, onScheduleStep }) => {
  return (
    <View className="bg-[#161922] border border-[#2d3345] rounded-xl p-3 gap-1.5">
      <View className="flex-row items-start justify-between gap-2">
        <Text className="font-semibold text-xs text-white flex-1 leading-snug">
          {idea.title}
        </Text>
        <Text className="text-[9px] font-mono text-[#8b949e] flex-shrink-0">
          {idea.createdAtLabel}
        </Text>
      </View>

      <Text className="text-[11px] text-[#8b949e] leading-relaxed">
        {idea.desc}
      </Text>

      <View className="flex-row items-center justify-between pt-2 mt-0.5 border-t border-[#262b3a]">
        <Text numberOfLines={1} className="text-[10px] text-indigo-300/80 flex-1 mr-2">
          {idea.suggestedAction ? `IA: ${idea.suggestedAction}` : 'Lista para agendar'}
        </Text>

        <Pressable
          onPress={() => onScheduleStep(idea)}
          className="flex-row items-center gap-1 px-2.5 py-1 rounded-lg bg-white active:opacity-85 flex-shrink-0"
        >
          <NotionIcon name="clock" size={11} color="#000000" />
          <Text className="text-[10px] font-bold text-black">Agendar paso</Text>
        </Pressable>
      </View>
    </View>
  );
};
