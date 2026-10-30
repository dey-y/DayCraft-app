import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { IdeaItemData } from '@/services/db/sqlite';
import { NotionIcon } from '@/components/ui/NotionIcon';
import { useTheme } from '@/store/useThemeStore';

interface IdeaItemProps {
  idea: IdeaItemData;
  onScheduleStep: (idea: IdeaItemData) => void;
  onOpenMarkdown?: (idea: IdeaItemData) => void;
}

/**
 * IdeaItem — Tarjeta individual de una idea vinculada a un proyecto temático
 * - Al tocar la tarjeta se abre el Editor/Visor Markdown (`.md`).
 * - El botón `[ Agendar paso ]` la convierte en un bloque en el Timeline 24h en 1 toque.
 */
export const IdeaItem: React.FC<IdeaItemProps> = ({
  idea,
  onScheduleStep,
  onOpenMarkdown,
}) => {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => onOpenMarkdown?.(idea)}
      className="bg-card border border-line active:border-ink rounded-xl p-3 gap-1.5"
    >
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-row items-center gap-1.5 flex-1 min-w-0">
          <Text
            numberOfLines={1}
            className="font-semibold text-sm text-ink flex-shrink"
          >
            {idea.title}
          </Text>
          <View className="px-1.5 py-0.5 rounded bg-raised border border-line flex-shrink-0">
            <Text className="text-[10px] font-mono font-semibold text-accent-soft">.md</Text>
          </View>
        </View>
        <Text className="text-[11px] font-mono text-muted flex-shrink-0">
          {idea.createdAtLabel}
        </Text>
      </View>

      <Text numberOfLines={2} className="text-xs text-muted leading-relaxed">
        {idea.desc}
      </Text>

      <View className="flex-row items-center justify-between pt-2 mt-0.5 border-t border-line-subtle">
        <Text
          numberOfLines={1}
          className="text-xs text-accent-soft/80 flex-1 mr-2"
        >
          Abrir nota .md o agendar paso →
        </Text>

        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            onScheduleStep(idea);
          }}
          className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink active:opacity-85 flex-shrink-0"
        >
          <NotionIcon name="clock" size={12} color={colors.canvas} />
          <Text className="text-xs font-bold text-canvas">Agendar paso</Text>
        </Pressable>
      </View>
    </Pressable>
  );
};
