import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDayCraftStore } from '@/store/useDayCraftStore';
import { LAYOUT } from '@/constants/theme';
import { NotionIcon, NotionIconName } from '@/components/ui/NotionIcon';
import { SmartIntakeBar } from '@/components/intake/SmartIntakeBar';
import { BellDropdown } from '@/components/ui/BellDropdown';
import { ThemePickerButton } from '@/components/ui/ThemePicker';
import { PendingItem } from '@/components/pending/PendingItem';
import { EmptyCelebration } from '@/components/pending/EmptyCelebration';
import { GlobalSearchModal, QuickSettingsModal } from '@/components/ui/GlobalSearchModal';
import { useTheme } from '@/store/useThemeStore';

/**
 * Layout Adaptativo — 2 Zonas Equilibradas (Escritorio) + 4 Tabs (Móvil)
 * - En Escritorio (>= 900px): Cabecera minimalista + 2 Zonas limpias:
 *   1) Panel único izquierdo (`w-[340px]`): Pendientes / Asistente IA + Smart Intake en su base.
 *   2) Lienzo principal amplio (`flex-1`): Timeline 24h o Ideas .md.
 *   (Proyectos accesibles como cajón deslizante con `Ctrl+B`, sin 3ª columna fija).
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = width >= LAYOUT.desktopBreakpoint;
  const pathname = usePathname();
  const router = useRouter();

  const sidebarOpen = useDayCraftStore((s) => s.sidebarOpen);
  const toggleSidebar = useDayCraftStore((s) => s.toggleSidebar);
  const bellDropdownOpen = useDayCraftStore((s) => s.bellDropdownOpen);
  const setBellDropdownOpen = useDayCraftStore((s) => s.setBellDropdownOpen);
  const alerts = useDayCraftStore((s) => s.alerts);
  const pendingTasks = useDayCraftStore((s) => s.pendingTasks);
  const togglePendingTask = useDayCraftStore((s) => s.togglePendingTask);
  const simulateAllPendingDone = useDayCraftStore((s) => s.simulateAllPendingDone);
  const openSlotPicker = useDayCraftStore((s) => s.openSlotPicker);
  const ideaGroups = useDayCraftStore((s) => s.ideaGroups);
  const desktopSideTab = useDayCraftStore((s) => s.desktopSideTab);
  const setDesktopSideTab = useDayCraftStore((s) => s.setDesktopSideTab);
  const chatMessages = useDayCraftStore((s) => s.chatMessages);
  const setActiveIdeaGroupId = useDayCraftStore((s) => s.setActiveIdeaGroupId);

  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [quickSettingsOpen, setQuickSettingsOpen] = useState(false);

  const pendingIncompleteCount = pendingTasks.filter((t) => !t.completed).length;
  const isOnChatScreen = pathname.includes('/chat');
  const isOnTimeline =
    pathname === '/' ||
    pathname === '/index' ||
    (!pathname.includes('/chat') &&
      !pathname.includes('/ideas') &&
      !pathname.includes('/pending'));

  // Atajos globales en Web: Ctrl+B (Sidebar), Ctrl+K (Buscador), Escape (Cerrar overlays)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setBellDropdownOpen(false);
        setSearchModalOpen(false);
        setQuickSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar, setBellDropdownOpen]);

  const getMobileHeaderTitle = () => {
    if (pathname.includes('/chat')) return 'Asistente IA';
    if (pathname.includes('/ideas')) return 'Cajón de Ideas';
    if (pathname.includes('/pending')) return 'Pendientes';
    return 'DayCraft';
  };

  // ==================== VISTA ESCRITORIO: 2 ZONAS EQUILIBRADAS ====================
  if (isDesktop) {
    return (
      <View className="flex-1 bg-canvas">
        {/* 1. CABECERA LIMPIA */}
        <View className="h-14 border-b border-line-subtle/70 bg-canvas px-5 flex-row items-center justify-between z-30">
          {/* Izquierda: Toggle Sidebar (Ctrl+B) + Marca */}
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={toggleSidebar}
              accessibilityRole="button"
              accessibilityLabel="Alternar barra lateral"
              hitSlop={6}
              className="min-w-[44px] min-h-[44px] rounded-xl items-center justify-center active:bg-raised"
            >
              <NotionIcon
                name="menu"
                size={18}
                color={sidebarOpen ? colors.ink : colors.muted}
              />
            </Pressable>

            <Pressable
              onPress={() => router.push('/')}
              className="flex-row items-center gap-2.5 min-h-[44px]"
            >
              <View className="w-7 h-7 rounded-lg bg-ink items-center justify-center">
                <NotionIcon name="zap" size={14} color={colors.canvas} />
              </View>
              <Text className="font-bold text-sm text-ink tracking-tight">
                DayCraft
              </Text>
            </Pressable>
          </View>

          {/* Centro: Selector Limpio de Vista Principal (Calendario vs Ideas .md) */}
          <View className="flex-row items-center bg-card border border-line-subtle rounded-xl p-1 gap-1">
            <Pressable
              onPress={() => router.push('/')}
              className={`min-h-[36px] px-4 rounded-lg flex-row items-center gap-1.5 ${
                isOnTimeline ? 'bg-raised' : ''
              }`}
            >
              <NotionIcon
                name="clock"
                size={14}
                color={isOnTimeline ? colors.ink : colors.muted}
              />
              <Text
                className={`text-xs font-semibold ${
                  isOnTimeline ? 'text-ink' : 'text-muted'
                }`}
              >
                Calendario
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/ideas')}
              className={`min-h-[36px] px-4 rounded-lg flex-row items-center gap-1.5 ${
                pathname.includes('/ideas') ? 'bg-raised' : ''
              }`}
            >
              <NotionIcon
                name="lightbulb"
                size={14}
                color={pathname.includes('/ideas') ? colors.ink : colors.muted}
              />
              <Text
                className={`text-xs font-semibold ${
                  pathname.includes('/ideas') ? 'text-ink' : 'text-muted'
                }`}
              >
                Ideas .md
              </Text>
            </Pressable>
          </View>

          {/* Derecha: Buscar (Ctrl+K), Tema, Campana y Ajustes */}
          <View className="flex-row items-center gap-1.5">
            <Pressable
              onPress={() => setSearchModalOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Buscar (Ctrl+K)"
              className="min-h-[44px] px-3 rounded-xl flex-row items-center gap-2 active:bg-raised"
            >
              <NotionIcon name="search" size={16} color={colors.muted} />
              <Text className="text-xs font-mono text-muted">Ctrl+K</Text>
            </Pressable>

            <ThemePickerButton />

            <Pressable
              onPress={() => setBellDropdownOpen(!bellDropdownOpen)}
              accessibilityRole="button"
              accessibilityLabel="Abrir avisos"
              hitSlop={6}
              className="min-w-[44px] min-h-[44px] px-2 rounded-xl flex-row items-center justify-center gap-1 active:bg-raised"
            >
              <NotionIcon name="bell" size={17} color={colors.ink} />
              {alerts.length > 0 ? (
                <View className="w-2 h-2 rounded-full bg-warm" />
              ) : null}
            </Pressable>

            <Pressable
              onPress={() => setQuickSettingsOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Ajustes y sincronización"
              hitSlop={6}
              className="min-w-[44px] min-h-[44px] items-center justify-center"
            >
              <View className="w-8 h-8 rounded-full bg-raised border border-line items-center justify-center">
                <Text className="font-bold text-xs text-ink">D</Text>
              </View>
            </Pressable>
          </View>
        </View>

        <BellDropdown />

        {/* 2. CUERPO CON BARRA LATERAL + PANEL PENDIENTES/IA + TIMELINE */}
        <View className="flex-1 flex-row overflow-hidden">
          {/* BARRA LATERAL IZQUIERDA (COLAPSABLE CON Ctrl+B) */}
          {sidebarOpen ? (
            <View className="w-56 border-r border-line-subtle/70 bg-card/40 p-3.5 justify-between">
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ gap: 20 }}
              >
                <View>
                  <Text className="text-xs uppercase tracking-wider text-muted font-bold px-2 mb-2">
                    Vistas
                  </Text>
                  <View className="gap-1">
                    {(
                      [
                        {
                          label: 'Timeline 24h',
                          href: '/',
                          icon: 'clock' as NotionIconName,
                          active: isOnTimeline,
                        },
                        {
                          label: 'Pendientes',
                          href: '/pending',
                          icon: 'checkbox-checked' as NotionIconName,
                          active: pathname.includes('/pending'),
                          badge: pendingIncompleteCount,
                        },
                        {
                          label: 'Ideas .md',
                          href: '/ideas',
                          icon: 'lightbulb' as NotionIconName,
                          active: pathname.includes('/ideas'),
                          badge: ideaGroups.reduce((acc, g) => acc + g.items.length, 0),
                        },
                        {
                          label: 'Asistente IA',
                          href: '/chat',
                          icon: 'sparkle' as NotionIconName,
                          active: pathname.includes('/chat'),
                        },
                      ] as const
                    ).map((navItem) => (
                      <Pressable
                        key={navItem.href}
                        onPress={() => router.push(navItem.href)}
                        className={`min-h-[40px] flex-row items-center justify-between px-3 rounded-xl ${
                          navItem.active ? 'bg-raised' : 'active:bg-raised/60'
                        }`}
                      >
                        <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
                          <NotionIcon
                            name={navItem.icon}
                            size={15}
                            color={navItem.active ? colors.accentSoft : colors.muted}
                          />
                          <Text
                            numberOfLines={1}
                            className={`text-xs ${
                              navItem.active ? 'text-ink font-semibold' : 'text-muted'
                            }`}
                          >
                            {navItem.label}
                          </Text>
                        </View>
                        {'badge' in navItem && navItem.badge ? (
                          <Text className="text-xs font-mono text-muted">
                            {navItem.badge}
                          </Text>
                        ) : null}
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View>
                  <Text className="text-xs uppercase tracking-wider text-muted font-bold px-2 mb-2">
                    Proyectos
                  </Text>
                  <View className="gap-1">
                    {ideaGroups.map((grp) => (
                      <Pressable
                        key={grp.id}
                        onPress={() => {
                          setActiveIdeaGroupId(grp.id);
                          router.push('/ideas');
                        }}
                        className="min-h-[40px] px-3 py-2 rounded-xl active:bg-raised flex-row items-center justify-between"
                      >
                        <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
                          <NotionIcon
                            name={grp.icon}
                            size={14}
                            color={
                              grp.accentColor === 'indigo'
                                ? colors.accentSoft
                                : grp.accentColor === 'emerald'
                                ? colors.ok
                                : colors.warm
                            }
                          />
                          <Text
                            numberOfLines={1}
                            className="text-xs font-medium text-ink flex-1"
                          >
                            {grp.title.replace('Proyecto: ', '')}
                          </Text>
                        </View>
                        <Text className="text-xs font-mono text-muted">
                          {grp.items.length}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </ScrollView>

              <Text className="text-xs text-muted px-2">Ctrl+B para ocultar</Text>
            </View>
          ) : null}

          {/* ZONA 1: PANEL ÚNICO DE PENDIENTES / ASISTENTE IA + SMART INTAKE */}
          <View className="w-[320px] border-r border-line-subtle/70 bg-card/30 p-3.5 justify-between">
            <View className="flex-1 min-h-0">
              {/* Switch limpio Pendientes / Asistente IA */}
              <View className="bg-card p-1 rounded-xl border border-line-subtle/70 flex-row items-center gap-1 mb-3.5">
                <Pressable
                  onPress={() => setDesktopSideTab('agenda')}
                  className={`flex-1 min-h-[38px] flex-row items-center justify-center gap-1.5 rounded-lg ${
                    desktopSideTab === 'agenda' ? 'bg-raised' : ''
                  }`}
                >
                  <NotionIcon
                    name="checkbox-checked"
                    size={14}
                    color={desktopSideTab === 'agenda' ? colors.ink : colors.muted}
                  />
                  <Text
                    className={`text-xs font-semibold ${
                      desktopSideTab === 'agenda' ? 'text-ink' : 'text-muted'
                    }`}
                  >
                    Pendientes
                  </Text>
                  {pendingIncompleteCount > 0 ? (
                    <View className="px-1.5 py-0.5 rounded-full bg-accent/15">
                      <Text className="text-xs font-mono font-bold text-accent-soft">
                        {pendingIncompleteCount}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>

                <Pressable
                  onPress={() => setDesktopSideTab('ai')}
                  className={`flex-1 min-h-[38px] flex-row items-center justify-center gap-1.5 rounded-lg ${
                    desktopSideTab === 'ai' ? 'bg-raised' : ''
                  }`}
                >
                  <NotionIcon
                    name="sparkle"
                    size={14}
                    color={desktopSideTab === 'ai' ? colors.accentSoft : colors.muted}
                  />
                  <Text
                    className={`text-xs font-semibold ${
                      desktopSideTab === 'ai' ? 'text-ink' : 'text-muted'
                    }`}
                  >
                    Asistente IA
                  </Text>
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                className="flex-1"
                contentContainerStyle={{ gap: 10, paddingBottom: 14 }}
              >
                {desktopSideTab === 'agenda' ? (
                  <>
                    <View className="flex-row items-center justify-between px-1 pb-1">
                      <Text className="text-xs font-semibold text-muted">
                        Sin hora fija
                      </Text>
                      <Pressable
                        onPress={simulateAllPendingDone}
                        className="px-2 py-1 rounded-lg active:bg-raised"
                      >
                        <Text className="text-xs text-muted">Todo hecho</Text>
                      </Pressable>
                    </View>

                    {pendingIncompleteCount === 0 ? (
                      <EmptyCelebration />
                    ) : (
                      pendingTasks.map((task) => (
                        <PendingItem
                          key={task.id}
                          task={task}
                          onToggle={togglePendingTask}
                          onAssignTime={(t) =>
                            openSlotPicker({
                              type: 'pending',
                              id: t.id,
                              title: t.title,
                            })
                          }
                        />
                      ))
                    )}
                  </>
                ) : (
                  <>
                    <View className="flex-row items-center justify-between px-1 pb-1">
                      <Text className="text-xs font-semibold text-muted">
                        Conversación
                      </Text>
                      <Pressable
                        onPress={() => router.push('/chat')}
                        className="px-2 py-1 rounded-lg active:bg-raised"
                      >
                        <Text className="text-xs text-accent-soft">
                          Ver completo →
                        </Text>
                      </Pressable>
                    </View>

                    {chatMessages.slice(-6).map((m) => (
                      <View
                        key={m.id}
                        className={`p-3 rounded-2xl ${
                          m.role === 'user'
                            ? 'bg-ink self-end max-w-[90%]'
                            : 'bg-card border border-line-subtle self-start max-w-[92%]'
                        }`}
                      >
                        <Text
                          className={`text-xs leading-relaxed ${
                            m.role === 'user'
                              ? 'text-canvas font-medium'
                              : 'text-ink'
                          }`}
                        >
                          {m.text}
                        </Text>
                      </View>
                    ))}
                  </>
                )}
              </ScrollView>
            </View>

            {/* Smart Intake anclado cómodamente en la base del panel */}
            <SmartIntakeBar
              compact
              isOnChatScreen={isOnChatScreen || desktopSideTab === 'ai'}
            />
          </View>

          {/* ZONA 2: LIENZO PRINCIPAL AMPLIO (TIMELINE 24H O IDEAS .MD) */}
          <View className="flex-1 bg-canvas">
            <Tabs
              screenOptions={{
                headerShown: false,
                tabBarStyle: { display: 'none' },
              }}
            >
              <Tabs.Screen name="index" />
              <Tabs.Screen name="pending" />
              <Tabs.Screen name="ideas" />
              <Tabs.Screen name="chat" />
            </Tabs>
          </View>
        </View>

        <GlobalSearchModal
          visible={searchModalOpen}
          onClose={() => setSearchModalOpen(false)}
        />
        <QuickSettingsModal
          visible={quickSettingsOpen}
          onClose={() => setQuickSettingsOpen(false)}
        />
      </View>
    );
  }

  // ==================== VISTA MÓVIL (LIMPIA Y AIREADA) ====================
  return (
    <View className="flex-1 bg-canvas">
      {/* Mobile Top App Bar Minimalista */}
      <View className="px-4 py-2.5 border-b border-line-subtle/70 bg-canvas flex-row items-center justify-between z-20">
        <Text className="font-bold text-base text-ink tracking-tight">
          {getMobileHeaderTitle()}
        </Text>

        <View className="flex-row items-center gap-1">
          <Pressable
            onPress={() => setSearchModalOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Buscar"
            hitSlop={6}
            className="min-w-[44px] min-h-[44px] rounded-full items-center justify-center active:bg-raised"
          >
            <NotionIcon name="search" size={18} color={colors.ink} />
          </Pressable>
          <ThemePickerButton />
          <Pressable
            onPress={() => setQuickSettingsOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Ajustes y estado"
            hitSlop={6}
            className="min-w-[44px] min-h-[44px] rounded-full items-center justify-center"
          >
            <View className="w-7 h-7 rounded-full bg-raised border border-line items-center justify-center">
              <Text className="font-bold text-xs text-ink">D</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => setBellDropdownOpen(!bellDropdownOpen)}
            accessibilityRole="button"
            accessibilityLabel="Abrir avisos"
            hitSlop={6}
            className="min-w-[44px] min-h-[44px] rounded-full items-center justify-center active:bg-raised relative"
          >
            <NotionIcon name="bell" size={18} color={colors.ink} />
            {alerts.length > 0 ? (
              <View
                style={{ position: 'absolute', top: 8, right: 8 }}
                className="w-2 h-2 rounded-full bg-warm"
              />
            ) : null}
          </Pressable>
        </View>
      </View>

      <BellDropdown />

      {/* Cuerpo de las 4 Pestañas */}
      <View className="flex-1 min-h-0">
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: { display: 'none' },
          }}
        >
          <Tabs.Screen name="chat" />
          <Tabs.Screen name="ideas" />
          <Tabs.Screen name="pending" />
          <Tabs.Screen name="index" />
        </Tabs>
      </View>

      {/* Punto de Entrada Universal Único */}
      <SmartIntakeBar isOnChatScreen={isOnChatScreen} />

      {/* Barra de Navegación Inferior Móvil Custom (Cero recorte de letras) */}
      <View
        style={{
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.lineSubtle,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom + 6, 12),
        }}
        className="flex-row items-center justify-around px-2"
      >
        {(
          [
            {
              key: 'chat',
              label: 'Asistente',
              href: '/chat',
              icon: 'chat' as NotionIconName,
              active: pathname.includes('/chat'),
              badge: 0,
            },
            {
              key: 'ideas',
              label: 'Ideas',
              href: '/ideas',
              icon: 'lightbulb' as NotionIconName,
              active: pathname.includes('/ideas'),
              badge: 0,
            },
            {
              key: 'pending',
              label: 'Pendientes',
              href: '/pending',
              icon: 'checkbox-checked' as NotionIconName,
              active: pathname.includes('/pending'),
              badge: pendingIncompleteCount,
            },
            {
              key: 'index',
              label: 'Timeline',
              href: '/',
              icon: 'clock' as NotionIconName,
              active: isOnTimeline,
              badge: 0,
            },
          ] as const
        ).map((tab) => {
          const tintColor = tab.active ? colors.ink : colors.muted;
          return (
            <Pressable
              key={tab.key}
              onPress={() => router.push(tab.href)}
              className="min-h-[44px] flex-1 items-center justify-center py-1"
            >
              <View className="h-6 items-center justify-center relative px-2">
                <NotionIcon name={tab.icon} size={18} color={tintColor} />
                {tab.badge > 0 ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -6,
                      backgroundColor: colors.ink,
                      minWidth: 18,
                      height: 18,
                    }}
                    className="rounded-full px-1 items-center justify-center"
                  >
                    <Text
                      allowFontScaling={false}
                      style={{ color: colors.canvas, fontSize: 12, lineHeight: 14 }}
                      className="font-bold"
                    >
                      {tab.badge}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={{
                  color: tintColor,
                  fontSize: 12,
                  lineHeight: 16,
                  marginTop: 2,
                }}
                className={tab.active ? 'font-bold' : 'font-semibold'}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <GlobalSearchModal
        visible={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
      />
      <QuickSettingsModal
        visible={quickSettingsOpen}
        onClose={() => setQuickSettingsOpen(false)}
      />
    </View>
  );
}
