import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { useDayCraftStore } from '@/store/useDayCraftStore';
import { NotionIcon } from '@/components/ui/NotionIcon';
import { useTheme } from '@/store/useThemeStore';

/**
 * IdeaNoteModal — Editor y Visor de Documentos Markdown (.md) para el Cajón de Ideas
 * - Permite editar el contenido completo de la nota en formato Markdown (.md) estilo Notion / Obsidian.
 * - Genera automáticamente el archivo `.md` con Frontmatter YAML y permite descargarlo a disco en 1 clic.
 */
export const IdeaNoteModal: React.FC = () => {
  const { colors } = useTheme();
  const activeIdeaId = useDayCraftStore((s) => s.activeIdeaId);
  const setActiveIdeaId = useDayCraftStore((s) => s.setActiveIdeaId);
  const ideaGroups = useDayCraftStore((s) => s.ideaGroups);
  const updateIdeaMarkdown = useDayCraftStore((s) => s.updateIdeaMarkdown);
  const openSlotPicker = useDayCraftStore((s) => s.openSlotPicker);
  const showToast = useDayCraftStore((s) => s.showToast);

  // Localizar la idea activa y su carpeta de proyecto
  let foundIdea = null as
    | (typeof ideaGroups)[number]['items'][number]
    | null;
  let foundGroupTitle = 'Chispazos Libres';

  for (const grp of ideaGroups) {
    const match = grp.items.find((it) => it.id === activeIdeaId);
    if (match) {
      foundIdea = match;
      foundGroupTitle = grp.title;
      break;
    }
  }

  const [title, setTitle] = useState('');
  const [markdownBody, setMarkdownBody] = useState('');

  useEffect(() => {
    if (!foundIdea) return;
    setTitle(foundIdea.title);
    setMarkdownBody(
      foundIdea.markdownContent ||
        `# ${foundIdea.title}\n\n${foundIdea.desc}\n\n## Notas y Desarrollo\n- [ ] Definir siguientes pasos\n`
    );
  }, [activeIdeaId]);

  if (!activeIdeaId || !foundIdea) return null;

  const slugFilename =
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'nota-daycraft';

  const handleSave = () => {
    const lines = markdownBody
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));
    const summaryDesc =
      lines[0]?.replace(/^[-*]\s+(\[[ x]\]\s+)?/, '') || foundIdea!.desc;

    updateIdeaMarkdown(foundIdea!.id, {
      title: title.trim() || foundIdea!.title,
      desc: summaryDesc,
      markdownContent: markdownBody,
    });
    setActiveIdeaId(null);
  };

  const handleDownloadMdFile = () => {
    const frontmatter = [
      '---',
      `title: "${title.replace(/"/g, '\\"')}"`,
      `project: "${foundGroupTitle}"`,
      `updated: "${new Date().toISOString().slice(0, 10)}"`,
      `source: "DayCraft AI"`,
      '---',
      '',
    ].join('\n');

    const fullMdDocument = `${frontmatter}${markdownBody}`;

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([fullMdDocument], {
        type: 'text/markdown;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slugFilename}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    showToast({
      title: 'Archivo .md exportado',
      description: `Descargado como "${slugFilename}.md"`,
    });
  };

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 96,
      }}
      className="bg-black/80 justify-center items-center p-4"
    >
      <View className="bg-card border border-line rounded-3xl w-full max-w-2xl max-h-[88%] overflow-hidden shadow-2xl">
        {/* Cabecera estilo Editor Notion / Obsidian */}
        <View className="px-4 py-3 bg-header border-b border-line-subtle flex-row items-center justify-between gap-2">
          <View className="flex-row items-center gap-2 flex-1 min-w-0 mr-1">
            <View className="px-2.5 py-1 rounded-md bg-raised border border-line flex-shrink min-w-0 max-w-[140px] sm:max-w-[220px]">
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                className="text-xs font-mono font-medium text-accent-soft"
              >
                {slugFilename}.md
              </Text>
            </View>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              className="text-xs text-muted flex-shrink min-w-0"
            >
              {foundGroupTitle}
            </Text>
          </View>

          <View className="flex-row items-center gap-2 flex-shrink-0">
            <Pressable
              onPress={handleDownloadMdFile}
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-raised border border-line active:border-ink flex-shrink-0"
            >
              <NotionIcon name="folder" size={13} color={colors.ok} />
              <Text className="text-xs font-mono font-bold text-ok">
                .md
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveIdeaId(null)}
              hitSlop={10}
              className="w-8 h-8 rounded-full bg-raised items-center justify-center flex-shrink-0"
            >
              <NotionIcon name="close" size={13} color={colors.muted} />
            </Pressable>
          </View>
        </View>

        {/* Cuerpo Editable del Documento Markdown */}
        <ScrollView
          className="p-5"
          contentContainerStyle={{ gap: 14 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-1.5">
            <Text className="text-xs uppercase tracking-wider font-bold text-muted">
              Título de la Nota
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Título de la idea..."
              placeholderTextColor={colors.muted}
              className="text-base font-bold text-ink bg-raised border border-line rounded-xl px-3.5 py-2.5"
            />
          </View>

          <View className="gap-1.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs uppercase tracking-wider font-bold text-muted">
                Contenido Markdown (.md)
              </Text>
              <Text className="text-xs font-mono text-muted">
                Soporta # Títulos, - [ ] Checklists, `código`
              </Text>
            </View>

            <TextInput
              value={markdownBody}
              onChangeText={setMarkdownBody}
              multiline
              textAlignVertical="top"
              placeholder="Escribe tus notas en Markdown..."
              placeholderTextColor={colors.muted}
              style={{ minHeight: 240 }}
              className="bg-canvas border border-line rounded-2xl p-4 text-sm font-mono text-ink leading-relaxed"
            />
          </View>
        </ScrollView>

        {/* Pie de Acciones adaptativo para móvil */}
        <View className="px-4 py-3 bg-header border-t border-line-subtle flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <Pressable
            onPress={() => {
              const targetTitle = title.trim() || foundIdea!.title;
              setActiveIdeaId(null);
              openSlotPicker({
                type: 'idea',
                id: foundIdea!.id,
                title: targetTitle,
              });
            }}
            className="flex-row items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-raised border border-line active:border-ink"
          >
            <NotionIcon name="clock" size={13} color={colors.accentSoft} />
            <Text className="text-xs font-semibold text-accent-soft">
              Agendar en Timeline
            </Text>
          </Pressable>

          <View className="flex-row items-center justify-end gap-2">
            <Pressable
              onPress={() => setActiveIdeaId(null)}
              className="px-4 py-2.5 rounded-xl active:opacity-75"
            >
              <Text className="text-sm font-medium text-muted">
                Cancelar
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSave}
              className="px-5 py-2.5 rounded-xl bg-ink active:opacity-85"
            >
              <Text className="text-sm font-bold text-canvas">
                Guardar
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
};
