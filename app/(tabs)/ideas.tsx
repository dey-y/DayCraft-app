import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useDayCraftStore } from '@/store/useDayCraftStore';
import { IdeaGroup } from '@/services/db/sqlite';
import { LAYOUT } from '@/constants/theme';
import { NotionIcon } from '@/components/ui/NotionIcon';
import { IdeaGroupCard } from '@/components/ideas/IdeaGroupCard';
import { useTheme } from '@/store/useThemeStore';

const PROJECT_ICON_OPTIONS: {
  key: IdeaGroup['icon'];
  label: string;
}[] = [
  { key: 'folder', label: 'Carpeta' },
  { key: 'smartphone', label: 'App / Tech' },
  { key: 'lightbulb', label: 'Idea' },
  { key: 'sparkle', label: 'Chispazo' },
  { key: 'cup', label: 'Hábito' },
];

const PROJECT_ACCENT_OPTIONS: {
  key: IdeaGroup['accentColor'];
  label: string;
}[] = [
  { key: 'indigo', label: 'Acento Foco' },
  { key: 'emerald', label: 'Verde Vivo' },
  { key: 'amber', label: 'Cálido Zen' },
];

/**
 * Tab 2: Cajón de Ideas Auto-Agrupado por IA + Notas Markdown (.md)
 * - Al tocar cualquier idea se abre el Editor/Visor Markdown (.md) con descarga directa,
 *   movimiento entre carpetas de proyecto y eliminación.
 * - Permite crear nuevas carpetas/grupos de proyecto personalizados y nuevas notas `.md`.
 */
export default function IdeasScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= LAYOUT.desktopBreakpoint;

  const ideaGroups = useDayCraftStore((s) => s.ideaGroups);
  const openSlotPicker = useDayCraftStore((s) => s.openSlotPicker);
  const setActiveIdeaId = useDayCraftStore((s) => s.setActiveIdeaId);
  const addIdeaToGroup = useDayCraftStore((s) => s.addIdeaToGroup);
  const addIdeaGroup = useDayCraftStore((s) => s.addIdeaGroup);
  const removeIdea = useDayCraftStore((s) => s.removeIdea);

  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');
  const [projectSubtitle, setProjectSubtitle] = useState('');
  const [projectIcon, setProjectIcon] = useState<IdeaGroup['icon']>('folder');
  const [projectAccent, setProjectAccent] =
    useState<IdeaGroup['accentColor']>('indigo');

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

  const handleCreateProjectGroup = () => {
    const cleanTitle = projectTitle.trim();
    if (!cleanTitle) return;
    addIdeaGroup({
      title: cleanTitle,
      subtitle: projectSubtitle.trim() || 'Notas .md auto-clasificadas por IA',
      icon: projectIcon,
      accentColor: projectAccent,
    });
    setProjectTitle('');
    setProjectSubtitle('');
    setProjectIcon('folder');
    setProjectAccent('indigo');
    setNewProjectModalOpen(false);
  };

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.canvas }}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: isDesktop ? 32 : 24,
          gap: 14,
        }}
      >
        {/* Cabecera del Cajón de Ideas */}
        <View className="flex-row items-center justify-between gap-2 flex-wrap">
          <View className="flex-1 min-w-[200px] mr-2">
            <View className="flex-row items-center gap-2">
              <NotionIcon name="folder" size={16} color={colors.warm} />
              <Text className="font-bold text-sm text-ink">Cajón de Ideas</Text>
              <View className="px-2 py-0.5 rounded-full bg-ok/10 border border-ok/25">
                <Text className="text-[11px] font-mono text-ok">
                  Notas .md + Auto-IA
                </Text>
              </View>
            </View>
            <Text className="text-xs text-muted mt-0.5">
              Toca cualquier tarjeta para editar/mover su archivo .md o crea carpetas de proyecto
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => setNewProjectModalOpen(true)}
              className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl bg-raised border border-line active:border-ink"
            >
              <NotionIcon name="folder" size={13} color={colors.accentSoft} />
              <Text className="text-xs font-bold text-ink">Nuevo Proyecto</Text>
            </Pressable>

            <Pressable
              onPress={() =>
                handleCreateNewMarkdownNote(ideaGroups[0]?.id || 'grp-app')
              }
              className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl bg-ink active:opacity-85"
            >
              <NotionIcon name="plus" size={12} color={colors.canvas} />
              <Text className="text-xs font-bold text-canvas">
                Nueva Nota .md
              </Text>
            </Pressable>
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
              onOpenMarkdown={(idea) => setActiveIdeaId(idea.id)}
              onCreateIdeaInGroup={handleCreateNewMarkdownNote}
              onDeleteIdea={removeIdea}
            />
          ))}
        </View>
      </ScrollView>

      {/* Modal para Crear Nueva Carpeta / Grupo de Proyecto */}
      <Modal
        visible={newProjectModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNewProjectModalOpen(false)}
      >
        <View className="flex-1 bg-canvas/85 justify-center items-center p-4">
          <View className="bg-card border border-line rounded-3xl p-5 w-full max-w-md gap-4 shadow-2xl">
            <View className="flex-row items-center justify-between pb-2 border-b border-line-subtle">
              <View className="flex-row items-center gap-2">
                <NotionIcon name="folder" size={16} color={colors.accentSoft} />
                <Text className="font-bold text-sm text-ink">
                  Nueva Carpeta de Proyecto
                </Text>
              </View>
              <Pressable
                onPress={() => setNewProjectModalOpen(false)}
                hitSlop={10}
                className="w-8 h-8 rounded-full bg-raised items-center justify-center"
              >
                <NotionIcon name="close" size={13} color={colors.muted} />
              </Pressable>
            </View>

            <View className="gap-1.5">
              <Text className="text-xs uppercase tracking-wider font-bold text-muted">
                Nombre del Proyecto
              </Text>
              <TextInput
                value={projectTitle}
                onChangeText={setProjectTitle}
                autoFocus
                placeholder="Ej. Proyecto: Finanzas Personales"
                placeholderTextColor={colors.muted}
                onSubmitEditing={handleCreateProjectGroup}
                className="bg-canvas border border-line rounded-xl px-3.5 py-2.5 text-sm font-semibold text-ink"
              />
            </View>

            <View className="gap-1.5">
              <Text className="text-xs uppercase tracking-wider font-bold text-muted">
                Subtítulo / Contexto para Auto-IA
              </Text>
              <TextInput
                value={projectSubtitle}
                onChangeText={setProjectSubtitle}
                placeholder="Ej. Inversiones, ahorro y presupuestos"
                placeholderTextColor={colors.muted}
                className="bg-canvas border border-line rounded-xl px-3.5 py-2 text-xs text-ink"
              />
            </View>

            {/* Selector de Icono Notion */}
            <View className="gap-1.5">
              <Text className="text-xs uppercase tracking-wider font-bold text-muted">
                Icono Vectorial Notion
              </Text>
              <View className="flex-row flex-wrap gap-1.5">
                {PROJECT_ICON_OPTIONS.map((opt) => {
                  const isSel = projectIcon === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => setProjectIcon(opt.key)}
                      className={`flex-row items-center gap-1.5 px-3 py-2 rounded-xl border ${
                        isSel
                          ? 'bg-accent/20 border-accent'
                          : 'bg-raised border-line'
                      }`}
                    >
                      <NotionIcon
                        name={opt.key}
                        size={13}
                        color={isSel ? colors.accentSoft : colors.muted}
                      />
                      <Text
                        className={`text-xs font-semibold ${
                          isSel ? 'text-ink' : 'text-muted'
                        }`}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Selector de Acento Semántico */}
            <View className="gap-1.5">
              <Text className="text-xs uppercase tracking-wider font-bold text-muted">
                Acento Semántico Kuro-Zen
              </Text>
              <View className="flex-row gap-2">
                {PROJECT_ACCENT_OPTIONS.map((opt) => {
                  const isSel = projectAccent === opt.key;
                  const dotColor =
                    opt.key === 'indigo'
                      ? colors.accentSoft
                      : opt.key === 'emerald'
                      ? colors.ok
                      : colors.warm;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => setProjectAccent(opt.key)}
                      className={`flex-1 flex-row items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border ${
                        isSel
                          ? 'bg-accent/20 border-accent'
                          : 'bg-raised border-line'
                      }`}
                    >
                      <View
                        style={{ backgroundColor: dotColor }}
                        className="w-2.5 h-2.5 rounded-full"
                      />
                      <Text
                        className={`text-xs font-semibold ${
                          isSel ? 'text-ink' : 'text-muted'
                        }`}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="flex-row items-center justify-end gap-2 pt-2 border-t border-line-subtle">
              <Pressable
                onPress={() => setNewProjectModalOpen(false)}
                className="px-4 py-2.5 rounded-xl active:opacity-75"
              >
                <Text className="text-sm font-medium text-muted">Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleCreateProjectGroup}
                className="px-5 py-2.5 rounded-xl bg-ink active:opacity-85"
              >
                <Text className="text-sm font-bold text-canvas">
                  Crear Proyecto
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
