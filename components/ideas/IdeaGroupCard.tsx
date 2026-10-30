import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { IdeaGroup, IdeaItemData } from '@/services/db/sqlite';
import { NotionIcon } from '@/components/ui/NotionIcon';
import { IdeaItem } from './IdeaItem';

interface IdeaGroupCardProps {
  group: IdeaGroup;
  onScheduleIdea: (idea: IdeaItemData) => void;
  onOpenMarkdown?: (idea: IdeaItemData) => void;
  onCreateIdeaInGroup?: (groupId: string) => void;
}

/**
 * IdeaGroupCard — Carpeta de Proyecto Auto-Agrupada por IA
 * Agrupa notas `.md` relacionadas con iconografía Notion Icons y botón para añadir nota directa.
 */
export const IdeaGroupCard: React.FC<IdeaGroupCardProps> = ({
  group,
  onScheduleIdea,
  onOpenMarkdown,
  onCreateIdeaInGroup,
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
              {group.items.length === 1 ? 'nota .md' : 'notas .md'} ·{' '}
              {group.subtitle}
            </Text>
          </View>
        </View>

        {onCreateIdeaInGroup ? (
          <Pressable
            onPress={() => onCreateIdeaInGroup(group.id)}
            className="flex-row items-center gap-1 px-2.5 py-1 rounded-lg bg-[#161922] border border-[#2d3345] active:border-white flex-shrink-0"
          >
            <NotionIcon name="plus" size={11} color="#e6edf3" />
            <Text className="text-[10px] font-mono font-semibold text-[#e6edf3]">
              Nueva .md
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View className="gap-2.5 pl-2.5 border-l-2 border-[#2d3345] ml-1">
        {group.items.map((item) => (
          <IdeaItem
            key={item.id}
            idea={item}
            onScheduleStep={onScheduleIdea}
            onOpenMarkdown={onOpenMarkdown}
          />
        ))}
      </View>
    </View>
  );
};
