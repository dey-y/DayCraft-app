import React from 'react';
import { View, Text, ScrollView, useWindowDimensions } from 'react-native';
import { useDayCraftStore } from '@/store/useDayCraftStore';
import { LAYOUT } from '@/constants/theme';
import { NotionIcon } from '@/components/ui/NotionIcon';
import { IdeaGroupCard } from '@/components/ideas/IdeaGroupCard';

/**
 * Tab 2: Cajón de Ideas Auto-Agrupado por IA
 * - Carpetas de proyecto temáticas con iconografía Notion Icons.
 * - Botón directo `[ Agendar paso ]` para llevar cualquier idea al Timeline 24h.
 */
export default function IdeasScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= LAYOUT.desktopBreakpoint;

  const ideaGroups = useDayCraftStore((s) => s.ideaGroups);
  const openSlotPicker = useDayCraftStore((s) => s.openSlotPicker);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#0d1117' }}
      contentContainerStyle={{
        padding: 16,
        paddingBottom: isDesktop ? 32 : 96,
        gap: 14,
      }}
    >
      {/* Cabecera del Cajón de Ideas */}
      <View className="flex-row items-center justify-between">
        <View className="flex-1 mr-2">
          <View className="flex-row items-center gap-2">
            <NotionIcon name="folder" size={16} color="#fbbf24" />
            <Text className="font-bold text-sm text-white">Cajón de Ideas</Text>
            <View className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25">
              <Text className="text-[9px] font-mono text-emerald-400">
                Auto-agrupado por IA
              </Text>
            </View>
          </View>
          <Text className="text-[11px] text-[#8b949e] mt-0.5">
            Tus ocurrencias nunca mueren: conviértelas en bloques de acción en 1 toque
          </Text>
        </View>

        <View className="px-2.5 py-1 rounded-full bg-[#1f2430] border border-[#2d3345]">
          <Text className="text-[10px] font-mono text-[#8b949e]">
            {ideaGroups.length} Grupos
          </Text>
        </View>
      </View>

      {/* Grid adaptativo de Grupos de Proyecto */}
      <View className="gap-3.5">
        {ideaGroups.map((group) => (
          <IdeaGroupCard
            key={group.id}
            group={group}
            onScheduleIdea={(idea) =>
              openSlotPicker({
                type: 'idea',
                id: idea.id,
                title: idea.suggestedAction || idea.title,
              })
            }
          />
        ))}
      </View>
    </ScrollView>
  );
}
