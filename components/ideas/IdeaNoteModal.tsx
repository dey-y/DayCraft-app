import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useDayCraftStore } from '@/store/useDayCraftStore';
import { NotionIcon } from '@/components/ui/NotionIcon';
import { useTheme } from '@/store/useThemeStore';

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <Text
          key={`code-${idx}`}
          className="font-mono text-xs bg-raised text-accent-soft px-1.5 py-0.5 rounded"
        >
          {part.slice(1, -1)}
        </Text>
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <Text key={`bold-${idx}`} className="font-bold text-ink">
          {part.slice(2, -2)}
        </Text>
      );
    }
    return <React.Fragment key={`txt-${idx}`}>{part}</React.Fragment>;
  });
}

/**
 * IdeaNoteModal — Editor y Visor de Documentos Markdown (.md) para el Cajón de Ideas
 * - Soporta modo Edición y modo Vista Previa rica (encabezados `#`, checklists `- [ ]`/`- [x]` interactivos, negrita, código y listas) con transición Reanimated v4.
 * - Exportación multiplataforma a disco `.md` (`Blob` en Web, `expo-file-system` + `expo-sharing` en iOS/Android).
 * - Truncado limpio de nombres de archivo largos (`numberOfLines={1}`, `ellipsizeMode="tail"`).
 */
export const IdeaNoteModal: React.FC = () => {
  const { colors } = useTheme();
  const activeIdeaId = useDayCraftStore((s) => s.activeIdeaId);
  const setActiveIdeaId = useDayCraftStore((s) => s.setActiveIdeaId);
  const ideaGroups = useDayCraftStore((s) => s.ideaGroups);
  const updateIdeaMarkdown = useDayCraftStore((s) => s.updateIdeaMarkdown);
  const removeIdea = useDayCraftStore((s) => s.removeIdea);
  const moveIdeaToGroup = useDayCraftStore((s) => s.moveIdeaToGroup);
  const openSlotPicker = useDayCraftStore((s) => s.openSlotPicker);
  const showToast = useDayCraftStore((s) => s.showToast);

  let foundIdea = null as
    | (typeof ideaGroups)[number]['items'][number]
    | null;
  let foundGroupId = 'grp-sparks';
  let foundGroupTitle = 'Chispazos Libres';

  for (const grp of ideaGroups) {
    const match = grp.items.find((it) => it.id === activeIdeaId);
    if (match) {
      foundIdea = match;
      foundGroupId = grp.id;
      foundGroupTitle = grp.title;
      break;
    }
  }

  const [title, setTitle] = useState('');
  const [markdownBody, setMarkdownBody] = useState('');
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    if (!foundIdea) return;
    setTitle(foundIdea.title);
    setMarkdownBody(
      foundIdea.markdownContent ||
        `# ${foundIdea.title}\n\n${foundIdea.desc}\n\n## Notas y Desarrollo\n- [ ] Definir siguientes pasos\n`
    );
    setPreviewMode(false);
  }, [activeIdeaId]);

  if (!activeIdeaId || !foundIdea) return null;

  const slugFilename =
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'nota-daycraft';

  const handleToggleChecklistLine = (lineIndex: number) => {
    const lines = markdownBody.split('\n');
    const target = lines[lineIndex];
    if (target === undefined) return;
    const match = target.match(/^(\s*[-*]\s+)\[([ xX])\](.*)$/);
    if (!match) return;
    const nextState = match[2].toLowerCase() === 'x' ? ' ' : 'x';
    lines[lineIndex] = `${match[1]}[${nextState}]${match[3]}`;
    setMarkdownBody(lines.join('\n'));
  };

  const handleSave = () => {
    const lines = markdownBody
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));
    const summaryDesc =
      lines[0]?.replace(/^[-*]\s+(\[[ xX]\]\s+)?/, '') || foundIdea!.desc;

    updateIdeaMarkdown(foundIdea!.id, {
      title: title.trim() || foundIdea!.title,
      desc: summaryDesc,
      markdownContent: markdownBody,
    });
    setActiveIdeaId(null);
  };

  const handleDownloadMdFile = async () => {
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
    const filename = `${slugFilename}.md`;

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([fullMdDocument], {
        type: 'text/markdown;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      try {
        const mdFile = new File(Paths.cache, filename);
        mdFile.write(fullMdDocument);
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(mdFile.uri, {
            mimeType: 'text/markdown',
            dialogTitle: `Exportar ${filename}`,
          });
        }
      } catch {
        // Fallback toast still notifies user gracefully
      }
    }

    showToast({
      title: 'Archivo .md exportado',
      description: `Exportado como "${filename}"`,
    });
  };

  const renderMarkdownPreview = () => {
    const lines = markdownBody.split('\n');
    return (
      <Animated.View
        entering={FadeIn.duration(160)}
        className="bg-canvas border border-line rounded-2xl p-4 gap-1.5"
        style={{ minHeight: 220 }}
      >
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (trimmed.length === 0) {
            return <View key={`sp-${idx}`} className="h-2" />;
          }

          if (trimmed.startsWith('### ')) {
            return (
              <Text key={`h3-${idx}`} className="text-sm font-bold text-accent-soft mt-1.5">
                {renderInlineMarkdown(trimmed.slice(4))}
              </Text>
            );
          }

          if (trimmed.startsWith('## ')) {
            return (
              <Text key={`h2-${idx}`} className="text-base font-bold text-ink mt-2">
                {renderInlineMarkdown(trimmed.slice(3))}
              </Text>
            );
          }

          if (trimmed.startsWith('# ')) {
            return (
              <Text key={`h1-${idx}`} className="text-lg font-bold text-ink">
                {renderInlineMarkdown(trimmed.slice(2))}
              </Text>
            );
          }

          const checklistMatch = line.match(/^\s*[-*]\s+\[([ xX])\]\s*(.*)$/);
          if (checklistMatch) {
            const checked = checklistMatch[1].toLowerCase() === 'x';
            const content = checklistMatch[2];
            return (
              <Pressable
                key={`chk-${idx}`}
                onPress={() => handleToggleChecklistLine(idx)}
                className="flex-row items-center gap-2.5 min-h-[44px] py-1 px-2 rounded-xl bg-card/60 border border-line-subtle active:border-ink"
              >
                <View
                  className={`w-5 h-5 rounded-md border items-center justify-center flex-shrink-0 ${
                    checked ? 'bg-ok border-ok' : 'bg-canvas border-line'
                  }`}
                >
                  {checked ? (
                    <NotionIcon name="check" size={12} color={colors.canvas} strokeWidth={2.4} />
                  ) : null}
                </View>
                <Text
                  className={`text-sm flex-1 leading-snug ${
                    checked ? 'text-muted line-through' : 'text-ink'
                  }`}
                >
                  {renderInlineMarkdown(content)}
                </Text>
              </Pressable>
            );
          }

          const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
          if (bulletMatch) {
            return (
              <View key={`li-${idx}`} className="flex-row items-start gap-2 pl-2">
                <Text className="text-sm font-bold text-accent-soft">•</Text>
                <Text className="text-sm text-ink flex-1 leading-relaxed">
                  {renderInlineMarkdown(bulletMatch[1])}
                </Text>
              </View>
            );
          }

          return (
            <Text key={`p-${idx}`} className="text-sm text-ink leading-relaxed">
              {renderInlineMarkdown(line)}
            </Text>
          );
        })}
      </Animated.View>
    );
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
      className="bg-canvas/85 justify-center items-center p-4"
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
              className="flex-row items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl bg-raised border border-line active:border-ink flex-shrink-0"
            >
              <NotionIcon name="folder" size={13} color={colors.ok} />
              <Text className="text-xs font-mono font-bold text-ok">.md</Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveIdeaId(null)}
              hitSlop={10}
              className="w-11 h-11 rounded-full bg-raised items-center justify-center flex-shrink-0"
            >
              <NotionIcon name="close" size={14} color={colors.muted} />
            </Pressable>
          </View>
        </View>

        {/* Cuerpo Editable / Vista Previa del Documento Markdown */}
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
              className="text-base font-bold text-ink bg-raised border border-line rounded-xl px-3.5 py-2.5 min-h-[44px]"
            />
          </View>

          {/* Selector de Carpeta / Proyecto para mover la idea */}
          <View className="gap-1.5">
            <Text className="text-xs uppercase tracking-wider font-bold text-muted">
              Carpeta de Proyecto (Mover a otro grupo)
            </Text>
            <View className="flex-row flex-wrap gap-1.5">
              {ideaGroups.map((grp) => {
                const isCurrent = grp.id === foundGroupId;
                return (
                  <Pressable
                    key={grp.id}
                    onPress={() => moveIdeaToGroup(foundIdea!.id, grp.id)}
                    className={`flex-row items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl border ${
                      isCurrent
                        ? 'bg-accent/20 border-accent'
                        : 'bg-raised border-line active:border-ink'
                    }`}
                  >
                    <NotionIcon
                      name={grp.icon}
                      size={12}
                      color={isCurrent ? colors.accentSoft : colors.muted}
                    />
                    <Text
                      className={`text-xs font-semibold ${
                        isCurrent ? 'text-ink' : 'text-muted'
                      }`}
                    >
                      {grp.title.replace(/^Proyecto:\s*/i, '')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="gap-2">
            <View className="flex-row items-center justify-between gap-2 flex-wrap">
              <Text className="text-xs uppercase tracking-wider font-bold text-muted">
                Contenido Markdown (.md)
              </Text>

              <View className="flex-row items-center gap-1 bg-raised p-1 rounded-xl border border-line">
                <Pressable
                  onPress={() => setPreviewMode(false)}
                  className={`px-3 py-1.5 min-h-[44px] justify-center rounded-lg ${
                    !previewMode ? 'bg-card border border-line' : ''
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      !previewMode ? 'text-ink' : 'text-muted'
                    }`}
                  >
                    Editar
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setPreviewMode(true)}
                  className={`px-3 py-1.5 min-h-[44px] justify-center rounded-lg ${
                    previewMode ? 'bg-accent/20 border border-accent' : ''
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      previewMode ? 'text-accent-soft' : 'text-muted'
                    }`}
                  >
                    Vista Previa
                  </Text>
                </Pressable>
              </View>
            </View>

            {previewMode ? (
              renderMarkdownPreview()
            ) : (
              <Animated.View entering={FadeIn.duration(160)}>
                <TextInput
                  value={markdownBody}
                  onChangeText={setMarkdownBody}
                  multiline
                  textAlignVertical="top"
                  placeholder="Escribe tus notas en Markdown..."
                  placeholderTextColor={colors.muted}
                  style={{ minHeight: 220 }}
                  className="bg-canvas border border-line rounded-2xl p-4 text-sm font-mono text-ink leading-relaxed"
                />
              </Animated.View>
            )}
          </View>
        </ScrollView>

        {/* Pie de Acciones adaptativo para móvil */}
        <View className="px-4 py-3 bg-header border-t border-line-subtle flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <View className="flex-row items-center gap-2">
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
              className="flex-1 sm:flex-initial flex-row items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl bg-raised border border-line active:border-ink"
            >
              <NotionIcon name="clock" size={13} color={colors.accentSoft} />
              <Text className="text-xs font-semibold text-accent-soft">
                Agendar en Timeline
              </Text>
            </Pressable>

            <Pressable
              onPress={() => removeIdea(foundIdea!.id)}
              className="flex-row items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl bg-raised border border-line active:border-ink"
            >
              <NotionIcon name="trash" size={13} color={colors.now} />
              <Text className="text-xs font-semibold text-now">Eliminar</Text>
            </Pressable>
          </View>

          <View className="flex-row items-center justify-end gap-2">
            <Pressable
              onPress={() => setActiveIdeaId(null)}
              className="px-4 py-2.5 min-h-[44px] justify-center rounded-xl active:opacity-75"
            >
              <Text className="text-sm font-medium text-muted">Cancelar</Text>
            </Pressable>

            <Pressable
              onPress={handleSave}
              className="px-5 py-2.5 min-h-[44px] justify-center rounded-xl bg-ink active:opacity-85"
            >
              <Text className="text-sm font-bold text-canvas">Guardar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
};
