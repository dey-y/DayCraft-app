import React from 'react';
import { View, Text } from 'react-native';
import { IdeaGroup, IdeaItemData } from '@/services/db/sqlite';
import { NotionIcon } from '@/components/ui/NotionIcon';
import { IdeaItem } from './IdeaItem';

interface IdeaGroupCardProps {
  group: IdeaGroup;
  onScheduleIdea: (idea: IdeaItemData) => void;
}

/**
 * IdeaGroupCard — Carpeta de Proyecto Auto-Agrupada por IA
 * Agrupa pensamientos relacionados con iconografía Notion Icons y sugerencias de acción.
 */
export const IdeaGroupCard: React.FC<IdeaGroupCardProps> = ({
  group,
  onScheduleIdea,
}) => {
  const iconColor =
    group.accentColor === 'indigo'
      ? '#818cf8'
      : group.accentColor === 'emerald'
      ? '#34d399'
      : '#fbbf24';

  const iconBgClass =
    group.accentColor === 'indigo'
      ? 'bg-indigo-500/10 border-indigo-500/25'
      : group.accentColor === 'emerald'
      ? 'bg-emerald-500/10 border-emerald-500/25'
      : 'bg-amber-500/10 border-amber-500/25';

  return (
    <View className="bg-[#1f2430] border border-[#2d3345] rounded-2xl p-3.5 gap-3">
      <View className="flex-row items-center justify-between pb-2.5 border-b border-[#2d3345]">
        <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
          <View
            className={`w-8 h-8 rounded-xl border items-center justify-center flex-shrink-0 ${iconBgClass}`}
          >
            <NotionIcon name={group.icon} size={15} color={iconColor} />
          </View>
          <View className="flex-1 min-w-0">
            <View className="flex-row items-center gap-1.5">
              <Text numberOfLines={1} className="font-bold text-xs text-white">
                {group.title}
              </Text>
              <View className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </View>
            <Text numberOfLines={1} className="text-[10px] text-[#8b949e] mt-0.5">
              {group.items.length}{' '}
              {group.items.length === 1 ? 'idea vinculada' : 'ideas vinculadas'} ·{' '}
              {group.subtitle}
            </Text>
          </View>
        </View>

        <View className="px-2 py-0.5 rounded-md bg-[#161922] border border-[#2d3345] flex-shrink-0">
          <Text className="text-[9px] font-mono text-[#8b949e]">Auto-IA</Text>
        </View>
      </View>

      <View className="gap-2.5 pl-2.5 border-l-2 border-[#2d3345] ml-1">
        {group.items.map((item) => (
          <IdeaItem key={item.id} idea={item} onScheduleStep={onScheduleIdea} />
        ))}
      </View>
    </View>
  );
};
