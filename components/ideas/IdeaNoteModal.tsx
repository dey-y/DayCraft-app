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

/**
 * IdeaNoteModal — Editor y Visor de Documentos Markdown (.md) para el Cajón de Ideas
 * - Permite editar el contenido completo de la nota en formato Markdown (.md) estilo Notion / Obsidian.
 * - Genera automáticamente el archivo `.md` con Frontmatter YAML y permite descargarlo a disco en 1 clic.
 */
export const IdeaNoteModal: React.FC = () => {
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
      <View className="bg-[#161922] border border-[#2d3345] rounded-3xl w-full max-w-2xl max-h-[88%] overflow-hidden shadow-2xl">
        {/* Cabecera estilo Editor Notion / Obsidian */}
        <View className="px-5 py-3.5 bg-[#12151d] border-b border-[#262b3a] flex-row items-center justify-between gap-2">
          <View className="flex-row items-center gap-2 flex-1 min-w-0">
            <View className="px-2 py-0.5 rounded-md bg-[#1f2430] border border-[#2d3345]">
              <Text className="text-[10px] font-mono text-indigo-400">
                {slugFilename}.md
              </Text>
            </View>
            <Text
              numberOfLines={1}
              className="text-[11px] text-[#8b949e] flex-shrink"
            >
              {foundGroupTitle}
            </Text>
          </View>

          <View className="flex-row items-center gap-2 flex-shrink-0">
            <Pressable
              onPress={handleDownloadMdFile}
              className="flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#1f2430] border border-[#2d3345] active:border-white"
            >
              <NotionIcon name="folder" size={12} color="#34d399" />
              <Text className="text-[10px] font-mono font-bold text-emerald-400">
                Descargar .md
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveIdeaId(null)}
              className="w-7 h-7 rounded-full bg-[#1f2430] items-center justify-center"
            >
              <NotionIcon name="close" size={13} color="#8b949e" />
            </Pressable>
          </View>
        </View>

        {/* Cuerpo Editable del Documento Markdown */}
        <ScrollView
          className="p-5"
          contentContainerStyle={{ gap: 14 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-1">
            <Text className="text-[10px] uppercase tracking-wider font-bold text-[#8b949e]">
              Título de la Nota
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Título de la idea..."
              placeholderTextColor="#8b949e"
              className="text-base font-bold text-white bg-[#1f2430] border border-[#2d3345] rounded-xl px-3.5 py-2.5"
            />
          </View>

          <View className="gap-1.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-[10px] uppercase tracking-wider font-bold text-[#8b949e]">
                Contenido Markdown (.md)
              </Text>
              <Text className="text-[10px] font-mono text-[#8b949e]">
                Soporta # Títulos, - [ ] Checklists, `código`
              </Text>
            </View>

            <TextInput
              value={markdownBody}
              onChangeText={setMarkdownBody}
              multiline
              textAlignVertical="top"
              placeholder="Escribe tus notas en Markdown..."
              placeholderTextColor="#8b949e"
              style={{ minHeight: 240 }}
              className="bg-[#0d1117] border border-[#2d3345] rounded-2xl p-4 text-xs font-mono text-[#e6edf3] leading-relaxed"
            />
          </View>
        </ScrollView>

        {/* Pie de Acciones */}
        <View className="px-5 py-3.5 bg-[#12151d] border-t border-[#262b3a] flex-row items-center justify-between">
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
            className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1f2430] border border-[#2d3345] active:border-white"
          >
            <NotionIcon name="clock" size={13} color="#818cf8" />
            <Text className="text-xs font-semibold text-indigo-300">
              Agendar bloque en Timeline
            </Text>
          </Pressable>

          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => setActiveIdeaId(null)}
              className="px-3 py-2 rounded-xl"
            >
              <Text className="text-xs font-medium text-[#8b949e]">
                Cancelar
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSave}
              className="px-4 py-2 rounded-xl bg-white active:opacity-85"
            >
              <Text className="text-xs font-bold text-black">
                Guardar Nota .md
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
};
