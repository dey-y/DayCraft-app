import React, { useEffect } from 'react';
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
import { useTheme } from '@/store/useThemeStore';

/**
 * Layout Adaptativo de Pestañas (Móvil 4 Pestañas / Web Desktop Cockpit 3 Columnas v9)
 * - En Móvil (< 900px): Top App Bar con Campana + Contenido de Pestaña + Smart Intake Único + Bottom Nav 4 Tabs.
 * - En Web/Desktop (>= 900px): Header Superior + Sidebar Colapsable (`Ctrl+B`) + Panel Multifunción (Agenda Hoy / Asistente IA) + Lienzo Principal.
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Barra inferior móvil: 68px de contenido (icono + etiqueta holgada con line-height limpio) + área segura del dispositivo.
  // El Smart Intake se ancla a esta misma altura para no solaparse nunca con las etiquetas.
  const mobileTabBarHeight = 68 + insets.bottom;
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
  const simulateAllPendingDone = useDayCraftStore(
    (s) => s.simulateAllPendingDone
  );
  const openSlotPicker = useDayCraftStore((s) => s.openSlotPicker);
  const ideaGroups = useDayCraftStore((s) => s.ideaGroups);
  const desktopSideTab = useDayCraftStore((s) => s.desktopSideTab);
  const setDesktopSideTab = useDayCraftStore((s) => s.setDesktopSideTab);
  const chatMessages = useDayCraftStore((s) => s.chatMessages);
  const events = useDayCraftStore((s) => s.events);
  const setSelectedDayKey = useDayCraftStore((s) => s.setSelectedDayKey);

  const pendingIncompleteCount = pendingTasks.filter((t) => !t.completed).length;
  const todayEvents = events.filter((e) => e.dayKey === '27');
  const isOnChatScreen = pathname.includes('/chat');

  // Listener global Ctrl+B en Web para colapsar/expandir el Sidebar
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
      if (e.key === 'Escape') {
        setBellDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar, setBellDropdownOpen]);

  const getMobileHeaderTitle = () => {
    if (pathname.includes('/chat')) return 'Asistente IA';
    if (pathname.includes('/ideas')) return 'Cajón de Ideas';
    if (pathname.includes('/pending')) return 'Pendientes de Hoy';
    return 'Timeline 24h';
  };

  // ==================== VISTA ESCRITORIO / WEB COCKPIT v9 ====================
  if (isDesktop) {
    return (
      <View className="flex-1 bg-canvas">
        {/* 1. HEADER SUPERIOR */}
        <View className="h-14 border-b border-line-subtle bg-header px-4 flex-row items-center justify-between z-30">
          <View className="flex-row items-center gap-2.5">
            <Pressable
              onPress={toggleSidebar}
              className="p-2 rounded-xl bg-card border border-line-subtle active:border-ink"
            >
              <NotionIcon name="menu" size={15} color={colors.muted} />
            </Pressable>

            <View className="w-8 h-8 rounded-xl bg-ink items-center justify-center">
              <NotionIcon name="zap" size={16} color={colors.canvas} />
            </View>

            <View>
              <View className="flex-row items-center gap-2">
                <Text className="font-bold text-sm text-ink">DayCraft AI</Text>
                <View className="px-2 py-0.5 rounded-full bg-raised border border-line">
                  <Text className="text-[10px] font-mono text-muted">
                    v9.0 Clean
                  </Text>
                </View>
              </View>
              <Text className="text-[10px] text-muted">
                Sin fricción · Time-blocking 24h & IA Gemini
              </Text>
            </View>
          </View>

          {/* Barra Omni de Estado Central */}
          <Pressable
            onPress={() => setDesktopSideTab('ai')}
            className="flex-1 max-w-md mx-6 bg-card border border-line-subtle rounded-xl px-3.5 py-2 flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-2">
              <NotionIcon name="search" size={14} color={colors.muted} />
              <Text className="text-xs text-muted">
                Usa la barra Smart Intake inferior para dictar o agendar...
              </Text>
            </View>
            <View className="px-1.5 py-0.5 rounded bg-raised border border-line">
              <Text className="text-[9px] font-mono text-muted">Ctrl+B</Text>
            </View>
          </Pressable>

          {/* Acciones Derecha Header */}
          <View className="flex-row items-center gap-3">
            <View className="flex-row items-center gap-2 px-2.5 py-1 rounded-lg bg-card border border-line-subtle">
              <NotionIcon name="sparkle" size={13} color={colors.accentSoft} />
              <Text className="text-xs text-muted">Foco hoy:</Text>
              <Text className="text-xs font-mono font-bold text-ink">
                {todayEvents.length * 30}m
              </Text>
            </View>

            <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg bg-ok/10 border border-ok/20">
              <View className="w-1.5 h-1.5 rounded-full bg-ok" />
              <Text className="text-[11px] font-mono text-ok">
                Offline SQLite
              </Text>
            </View>

            {/* Selector de tema Kuro-Zen */}
            <ThemePickerButton />

            {/* Campana No Intrusiva */}
            <Pressable
              onPress={() => setBellDropdownOpen(!bellDropdownOpen)}
              className="p-2 rounded-xl bg-card border border-line-subtle flex-row items-center gap-1.5"
            >
              <NotionIcon name="bell" size={15} color={colors.ink} />
              {alerts.length > 0 ? (
                <View className="px-1.5 py-0.5 rounded-full bg-warm/20 border border-warm/30">
                  <Text className="text-[10px] font-mono font-bold text-warm">
                    {alerts.length}
                  </Text>
                </View>
              ) : null}
            </Pressable>

            <View className="w-8 h-8 rounded-full bg-raised border border-line items-center justify-center">
              <Text className="font-bold text-xs text-ink">D</Text>
            </View>
          </View>
        </View>

        <BellDropdown />

        {/* 2. CUERPO DE 3 PANELES */}
        <View className="flex-1 flex-row overflow-hidden">
          {/* PANEL 1: SIDEBAR COLAPSABLE (Ctrl+B) */}
          {sidebarOpen ? (
            <View className="w-60 border-r border-line-subtle bg-card p-3.5 justify-between">
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ gap: 20 }}
              >
                <View>
                  <Text className="text-[10px] uppercase tracking-wider text-muted font-bold px-2 mb-2">
                    Vistas Principales
                  </Text>
                  <View className="gap-1.5">
                    {(
                      [
                        {
                          label: 'Día (Timeline 24h)',
                          href: '/',
                          icon: 'clock' as NotionIconName,
                          active: pathname === '/' || pathname === '/index',
                          badge: 'Principal',
                        },
                        {
                          label: 'Pendientes de Hoy',
                          href: '/pending',
                          icon: 'checkbox-checked' as NotionIconName,
                          active: pathname.includes('/pending'),
                          badge: String(pendingIncompleteCount),
                        },
                        {
                          label: 'Cajón de Ideas',
                          href: '/ideas',
                          icon: 'lightbulb' as NotionIconName,
                          active: pathname.includes('/ideas'),
                          badge: String(
                            ideaGroups.reduce((acc, g) => acc + g.items.length, 0)
                          ),
                        },
                        {
                          label: 'Asistente IA',
                          href: '/chat',
                          icon: 'chat' as NotionIconName,
                          active: pathname.includes('/chat'),
                          badge: undefined,
                        },
                      ] as const
                    ).map((navItem) => (
                      <Pressable
                        key={navItem.href}
                        onPress={() => router.push(navItem.href)}
                        className={`flex-row items-center justify-between px-3 py-2 rounded-xl border ${
                          navItem.active
                            ? 'bg-raised border-line'
                            : 'bg-transparent border-transparent'
                        }`}
                      >
                        <View className="flex-row items-center gap-2.5">
                          <NotionIcon
                            name={navItem.icon}
                            size={15}
                            color={navItem.active ? colors.accentSoft : colors.muted}
                          />
                          <Text
                            className={`text-xs ${
                              navItem.active
                                ? 'text-ink font-semibold'
                                : 'text-muted font-medium'
                            }`}
                          >
                            {navItem.label}
                          </Text>
                        </View>
                        {navItem.badge ? (
                          <View
                            className={`px-1.5 py-0.5 rounded ${
                              navItem.active
                                ? 'bg-accent/20 border border-accent/30'
                                : 'bg-canvas border border-line'
                            }`}
                          >
                            <Text
                              className={`text-[9px] font-mono ${
                                navItem.active
                                  ? 'text-accent-soft'
                                  : 'text-muted'
                              }`}
                            >
                              {navItem.badge}
                            </Text>
                          </View>
                        ) : null}
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Proyectos Activos Auto-Agrupados */}
                <View>
                  <View className="flex-row items-center justify-between px-2 mb-2">
                    <Text className="text-[10px] uppercase tracking-wider text-muted font-bold">
                      Proyectos Activos
                    </Text>
                    <Text className="text-[9px] font-mono text-ok">
                      Auto-IA
                    </Text>
                  </View>

                  <View className="gap-2">
                    {ideaGroups.map((grp) => (
                      <Pressable
                        key={grp.id}
                        onPress={() => router.push('/ideas')}
                        className="p-2.5 rounded-xl bg-raised/75 border border-line active:border-ink"
                      >
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center gap-2 flex-1 min-w-0">
                            <View className="w-6 h-6 rounded-lg bg-card border border-line items-center justify-center">
                              <NotionIcon
                                name={grp.icon}
                                size={13}
                                color={
                                  grp.accentColor === 'indigo'
                                    ? colors.accentSoft
                                    : grp.accentColor === 'emerald'
                                    ? colors.ok
                                    : colors.warm
                                }
                              />
                            </View>
                            <Text
                              numberOfLines={1}
                              className="font-bold text-xs text-ink flex-1"
                            >
                              {grp.title.replace('Proyecto: ', '')}
                            </Text>
                          </View>
                          <Text className="text-[10px] font-mono text-muted">
                            {grp.items.length} ideas
                          </Text>
                        </View>
                        <Text
                          numberOfLines={1}
                          className="text-[10px] text-muted mt-1"
                        >
                          {grp.subtitle}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </ScrollView>

              <View className="pt-3 border-t border-line-subtle flex-row items-center justify-between px-1">
                <View className="flex-row items-center gap-1.5">
                  <NotionIcon name="zap" size={12} color={colors.muted} />
                  <Text className="text-[10px] text-muted">Notion Icons</Text>
                </View>
                <Text className="text-[10px] font-mono text-ok">
                  Ctrl+B
                </Text>
              </View>
            </View>
          ) : null}

          {/* PANEL 2: PANEL MULTIFUNCIÓN (AGENDA HOY + ASISTENTE IA) */}
          <View className="w-[340px] border-r border-line-subtle bg-header p-3.5 justify-between">
            <View className="flex-1 min-h-0">
              {/* Switch Segmentado: Agenda Hoy vs Asistente IA */}
              <View className="bg-card p-1 rounded-xl border border-line-subtle flex-row items-center gap-1 mb-3">
                <Pressable
                  onPress={() => setDesktopSideTab('agenda')}
                  className={`flex-1 flex-row items-center justify-center gap-1.5 py-1.5 rounded-lg ${
                    desktopSideTab === 'agenda'
                      ? 'bg-raised border border-line'
                      : ''
                  }`}
                >
                  <NotionIcon name="calendar" size={13} color={colors.ok} />
                  <Text
                    className={`text-xs font-semibold ${
                      desktopSideTab === 'agenda' ? 'text-ink' : 'text-muted'
                    }`}
                  >
                    Agenda Hoy
                  </Text>
                  <View className="px-1.5 py-0.5 rounded bg-card">
                    <Text className="text-[10px] font-mono text-muted">
                      {pendingIncompleteCount}
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => setDesktopSideTab('ai')}
                  className={`flex-1 flex-row items-center justify-center gap-1.5 py-1.5 rounded-lg ${
                    desktopSideTab === 'ai'
                      ? 'bg-raised border border-line'
                      : ''
                  }`}
                >
                  <NotionIcon name="sparkle" size={13} color={colors.accentSoft} />
                  <Text
                    className={`text-xs font-semibold ${
                      desktopSideTab === 'ai' ? 'text-ink' : 'text-muted'
                    }`}
                  >
                    Asistente IA
                  </Text>
                  <View className="w-2 h-2 rounded-full bg-accent" />
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                className="flex-1"
                contentContainerStyle={{ gap: 12, paddingBottom: 12 }}
              >
                {desktopSideTab === 'agenda' ? (
                  <>
                    {/*Sub-cabecera Hoy */}
                    <View className="flex-row items-center justify-between pb-2 border-b border-line-subtle">
                      <View className="flex-row items-center gap-2">
                        <View className="w-2 h-2 rounded-full bg-ok" />
                        <Text className="font-bold text-xs uppercase tracking-wider text-ink">
                          Hoy · Martes 27 Oct
                        </Text>
                      </View>
                      <Pressable
                        onPress={simulateAllPendingDone}
                        className="px-2 py-0.5 rounded bg-card border border-line-subtle"
                      >
                        <Text className="text-[10px] text-muted">
                          Simular: Todo Hecho
                        </Text>
                      </Pressable>
                    </View>

                    {/* Cápsula Compacta de Foco (Cero Duplicidad con el Timeline Central) */}
                    <View className="bg-card border border-accent/30 rounded-xl p-3 flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
                        <View className="w-7 h-7 rounded-lg bg-accent/10 border border-accent/20 items-center justify-center">
                          <NotionIcon name="clock" size={14} color={colors.accentSoft} />
                        </View>
                        <View className="flex-1 min-w-0">
                          <Text className="font-bold text-xs text-ink">
                            {todayEvents.length}{' '}
                            {todayEvents.length === 1
                              ? 'bloque agendado'
                              : 'bloques agendados'}
                          </Text>
                          <Text
                            numberOfLines={1}
                            className="text-[10px] text-ok mt-0.5"
                          >
                            Tarde 100% libre desde las 12:00
                          </Text>
                        </View>
                      </View>
                      <Pressable
                        onPress={() => {
                          setSelectedDayKey('27');
                          router.push('/');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-raised border border-line"
                      >
                        <Text className="text-[10px] font-semibold text-ink">
                          Ver
                        </Text>
                      </Pressable>
                    </View>

                    {/* Cabecera Pendientes */}
                    <View className="flex-row items-center justify-between px-1 pt-1">
                      <View className="flex-row items-center gap-1.5">
                        <NotionIcon name="reminder" size={13} color={colors.warm} />
                        <Text className="text-[11px] font-bold uppercase tracking-wider text-warm">
                          Pendientes
                        </Text>
                      </View>
                      <Text className="text-[10px] font-mono text-muted">
                        {pendingIncompleteCount}{' '}
                        {pendingIncompleteCount === 1 ? 'tarea' : 'tareas'}
                      </Text>
                    </View>

                    {/* Lista de Pendientes o Celebración */}
                    <View className="gap-2">
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
                    </View>
                  </>
                ) : (
                  <>
                    <View className="p-3 rounded-xl bg-raised border border-line gap-1.5">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs font-bold text-ink">
                          Briefing de Jornada
                        </Text>
                        <Text className="text-[10px] font-mono text-ok">
                          Activo
                        </Text>
                      </View>
                      <Text className="text-xs text-muted leading-relaxed">
                        Tienes {todayEvents.length} bloque agendado hoy y{' '}
                        {pendingIncompleteCount} pendientes sin hora fija.
                      </Text>
                    </View>

                    {chatMessages.slice(-4).map((m) => (
                      <View
                        key={m.id}
                        className={`p-3 rounded-xl border ${
                          m.role === 'user'
                            ? 'bg-ink border-ink self-end max-w-[90%]'
                            : 'bg-card border-line'
                        }`}
                      >
                        <Text
                          className={`text-xs ${
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

            {/* Punto de Entrada Universal Único en el pie del panel */}
            <SmartIntakeBar compact isOnChatScreen={isOnChatScreen} />
          </View>

          {/* PANEL 3: LIENZO PRINCIPAL EXPANDIDO */}
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
      </View>
    );
  }

  // ==================== VISTA MÓVIL (4 PESTAÑAS + SMART INTAKE ÚNICO) ====================
  return (
    <View className="flex-1 bg-canvas">
      {/* Mobile Top App Bar */}
      <View className="px-4 py-3 border-b border-line-subtle bg-card flex-row items-center justify-between z-20">
        <View className="flex-row items-center gap-2.5">
          <View className="w-7 h-7 rounded-lg bg-raised border border-line items-center justify-center">
            <NotionIcon name="zap" size={14} color={colors.ink} />
          </View>
          <Text className="font-bold text-sm text-ink">
            {getMobileHeaderTitle()}
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
        <ThemePickerButton />
        <Pressable
          onPress={() => setBellDropdownOpen(!bellDropdownOpen)}
          className="p-1.5 rounded-full active:bg-raised relative"
        >
          <NotionIcon name="bell" size={18} color={colors.ink} />
          {alerts.length > 0 ? (
            <View
              style={{ position: 'absolute', top: 0, right: 0 }}
              className="w-4 h-4 rounded-full bg-ink items-center justify-center"
            >
              <Text className="text-[9px] font-bold text-canvas">
                {alerts.length}
              </Text>
            </View>
          ) : null}
        </Pressable>
        </View>
      </View>

      <BellDropdown />

      {/* Cuerpo de las 4 Pestañas con Barra de Entrada Universal siempre accesible */}
      <View className="flex-1">
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: colors.card,
              borderTopColor: colors.lineSubtle,
              height: mobileTabBarHeight,
              paddingTop: 6,
              paddingBottom: Math.max(insets.bottom, 10),
            },
            tabBarItemStyle: { paddingVertical: 2 },
            tabBarActiveTintColor: colors.ink,
            tabBarInactiveTintColor: colors.muted,
            tabBarAllowFontScaling: false,
          }}
        >
          {/* Tab 1: Asistente IA */}
          <Tabs.Screen
            name="chat"
            options={{
              title: 'Asistente',
              tabBarLabel: ({ color, focused }) => (
                <Text
                  numberOfLines={1}
                  style={{
                    color,
                    fontSize: 11,
                    lineHeight: 16,
                    fontWeight: focused ? '700' : '500',
                    textAlign: 'center',
                    marginTop: 2,
                    paddingBottom: 2,
                  }}
                >
                  Asistente
                </Text>
              ),
              tabBarIcon: ({ color }) => (
                <NotionIcon name="chat" size={17} color={color} />
              ),
            }}
          />

          {/* Tab 2: Cajón de Ideas */}
          <Tabs.Screen
            name="ideas"
            options={{
              title: 'Ideas',
              tabBarLabel: ({ color, focused }) => (
                <Text
                  numberOfLines={1}
                  style={{
                    color,
                    fontSize: 11,
                    lineHeight: 16,
                    fontWeight: focused ? '700' : '500',
                    textAlign: 'center',
                    marginTop: 2,
                    paddingBottom: 2,
                  }}
                >
                  Ideas
                </Text>
              ),
              tabBarIcon: ({ color }) => (
                <NotionIcon name="lightbulb" size={17} color={color} />
              ),
            }}
          />

          {/* Tab 3: Pendientes de Hoy */}
          <Tabs.Screen
            name="pending"
            options={{
              title: 'Pendientes',
              tabBarLabel: ({ color, focused }) => (
                <Text
                  numberOfLines={1}
                  style={{
                    color,
                    fontSize: 11,
                    lineHeight: 16,
                    fontWeight: focused ? '700' : '500',
                    textAlign: 'center',
                    marginTop: 2,
                    paddingBottom: 2,
                  }}
                >
                  Pendientes
                </Text>
              ),
              tabBarBadge:
                pendingIncompleteCount > 0 ? pendingIncompleteCount : undefined,
              tabBarBadgeStyle: {
                backgroundColor: colors.ink,
                color: colors.canvas,
                fontSize: 9,
                fontWeight: 'bold',
              },
              tabBarIcon: ({ color }) => (
                <NotionIcon name="checkbox-checked" size={17} color={color} />
              ),
            }}
          />

          {/* Tab 4: Timeline (Pantalla inicial heroica) */}
          <Tabs.Screen
            name="index"
            options={{
              title: 'Timeline',
              tabBarLabel: ({ color, focused }) => (
                <Text
                  numberOfLines={1}
                  style={{
                    color,
                    fontSize: 11,
                    lineHeight: 16,
                    fontWeight: focused ? '700' : '500',
                    textAlign: 'center',
                    marginTop: 2,
                    paddingBottom: 2,
                  }}
                >
                  Timeline
                </Text>
              ),
              tabBarIcon: ({ color }) => (
                <NotionIcon name="clock" size={17} color={color} />
              ),
            }}
          />
        </Tabs>
      </View>

      {/* Punto de Entrada Universal Único sobre la barra de navegación móvil */}
      <View style={{ position: 'absolute', bottom: mobileTabBarHeight, left: 0, right: 0 }}>
        <SmartIntakeBar isOnChatScreen={isOnChatScreen} />
      </View>
    </View>
  );
}
