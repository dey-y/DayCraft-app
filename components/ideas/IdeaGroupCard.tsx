import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { IdeaGroup, IdeaItemData } from '@/services/db/sqlite';
import { NotionIcon } from '@/components/ui/NotionIcon';
import { IdeaItem } from './IdeaItem';
import { useTheme } from '@/store/useThemeStore';

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
  const { colors } = useTheme();
  const iconColor =
    group.accentColor === 'indigo'
      ? colors.accentSoft
      : group.accentColor === 'emerald'
      ? colors.ok
      : colors.warm;

  const iconBgClass =
    group.accentColor === 'indigo'
      ? 'bg-accent/10 border-accent/25'
      : group.accentColor === 'emerald'
      ? 'bg-ok/10 border-ok/25'
      : 'bg-warm/10 border-warm/25';

  return (
    <View className="bg-raised border border-line rounded-2xl p-3.5 gap-3">
      <View className="flex-row items-center justify-between pb-2.5 border-b border-line">
        <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
          <View
            className={`w-8 h-8 rounded-xl border items-center justify-center flex-shrink-0 ${iconBgClass}`}
          >
            <NotionIcon name={group.icon} size={15} color={iconColor} />
          </View>
          <View className="flex-1 min-w-0">
            <View className="flex-row items-center gap-1.5">
              <Text numberOfLines={1} className="font-bold text-sm text-ink">
                {group.title}
              </Text>
              <View className="w-1.5 h-1.5 rounded-full bg-ok" />
            </View>
            <Text numberOfLines={1} className="text-xs text-muted mt-0.5">
              {group.items.length}{' '}
              {group.items.length === 1 ? 'nota .md' : 'notas .md'} ·{' '}
              {group.subtitle}
            </Text>
          </View>
        </View>

        {onCreateIdeaInGroup ? (
          <Pressable
            onPress={() => onCreateIdeaInGroup(group.id)}
            hitSlop={6}
            className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-line active:border-ink flex-shrink-0"
          >
            <NotionIcon name="plus" size={12} color={colors.ink} />
            <Text className="text-xs font-mono font-semibold text-ink">
              Nueva .md
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View className="gap-2.5 pl-2.5 border-l-2 border-line ml-1">
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
