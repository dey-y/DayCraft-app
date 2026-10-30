import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useDayCraftStore } from '@/store/useDayCraftStore';
import { LAYOUT } from '@/constants/theme';
import { NotionIcon } from '@/components/ui/NotionIcon';
import { IdeaGroupCard } from '@/components/ideas/IdeaGroupCard';
import { useTheme } from '@/store/useThemeStore';

/**
 * Tab 2: Cajón de Ideas Auto-Agrupado por IA + Notas Markdown (.md)
 * - Al tocar cualquier idea se abre el Editor/Visor Markdown (.md) con descarga directa.
 * - También permite crear una nueva nota `.md` en cualquier carpeta de proyecto con 1 clic.
 */
export default function IdeasScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= LAYOUT.desktopBreakpoint;

  const ideaGroups = useDayCraftStore((s) => s.ideaGroups);
  const openSlotPicker = useDayCraftStore((s) => s.openSlotPicker);
  const setActiveIdeaId = useDayCraftStore((s) => s.setActiveIdeaId);
  const addIdeaToGroup = useDayCraftStore((s) => s.addIdeaToGroup);

  const handleCreateNewMarkdownNote = (groupId: string) => {
    addIdeaToGroup(
      groupId,
      'Nueva nota de proyecto',
      'Haz clic para editar el documento Markdown (.md) completo.'
    );
    const updatedGroup = useDayCraftStore
      .getState()
      .ideaGroups.find((g) => g.id === groupId);
    if (updatedGroup && updatedGroup.items[0]) {
      setActiveIdeaId(updatedGroup.items[0].id);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
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
            <NotionIcon name="folder" size={16} color={colors.warm} />
            <Text className="font-bold text-sm text-ink">Cajón de Ideas</Text>
            <View className="px-2 py-0.5 rounded-full bg-ok/10 border border-ok/25">
              <Text className="text-[9px] font-mono text-ok">
                Notas .md + Auto-IA
              </Text>
            </View>
          </View>
          <Text className="text-[11px] text-muted mt-0.5">
            Toca cualquier tarjeta para abrir/descargar su archivo .md o dicta en la barra inferior
          </Text>
        </View>

        <Pressable
          onPress={() => handleCreateNewMarkdownNote('grp-app')}
          className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ink active:opacity-85"
        >
          <NotionIcon name="plus" size={12} color={colors.canvas} />
          <Text className="text-xs font-bold text-canvas">Nueva Nota .md</Text>
        </Pressable>
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
            onOpenMarkdown={(idea) => setActiveIdeaId(idea.id)}
            onCreateIdeaInGroup={handleCreateNewMarkdownNote}
          />
        ))}
      </View>
    </ScrollView>
  );
}
