import React, { useEffect } from 'react';
import { View, Text, Pressable, Platform, useWindowDimensions } from 'react-native';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { useDayCraftStore } from '@/store/useDayCraftStore';
import { LAYOUT } from '@/constants/theme';
import { NotionIcon, NotionIconName } from '@/components/ui/NotionIcon';
import { SmartIntakeBar } from '@/components/intake/SmartIntakeBar';
import { BellDropdown } from '@/components/ui/BellDropdown';
import { PendingItem } from '@/components/pending/PendingItem';
import { EmptyCelebration } from '@/components/pending/EmptyCelebration';

/**
 * Layout Adaptativo de Pestañas (Móvil 4 Pestañas / Web Desktop Cockpit 3 Columnas v9)
 * - En Móvil (< 900px): Top App Bar con Campana + Contenido de Pestaña + Smart Intake Único + Bottom Nav 4 Tabs.
 * - En Web/Desktop (>= 900px): Header Superior + Sidebar Colapsable (`Ctrl+B`) + Panel Multifunción (Agenda Hoy / Asistente IA) + Lienzo Principal.
 */
export default function TabsLayout() {
  const { width } = useWindowDimensions();
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
      <View className="flex-1 bg-[#0d1117]">
        {/* 1. HEADER SUPERIOR */}
        <View className="h-14 border-b border-[#262b3a] bg-[#12151d] px-4 flex-row items-center justify-between z-30">
          <View className="flex-row items-center gap-2.5">
            <Pressable
              onPress={toggleSidebar}
              className="p-2 rounded-xl bg-[#161922] border border-[#262b3a] active:border-white"
            >
              <NotionIcon name="menu" size={15} color="#8b949e" />
            </Pressable>

            <View className="w-8 h-8 rounded-xl bg-white items-center justify-center">
              <NotionIcon name="zap" size={16} color="#000000" />
            </View>

            <View>
              <View className="flex-row items-center gap-2">
                <Text className="font-bold text-sm text-white">DayCraft AI</Text>
                <View className="px-2 py-0.5 rounded-full bg-[#1f2430] border border-[#2d3345]">
                  <Text className="text-[10px] font-mono text-[#8b949e]">
                    v9.0 Clean
                  </Text>
                </View>
              </View>
              <Text className="text-[10px] text-[#8b949e]">
                Sin fricción · Time-blocking 24h & IA Gemini
              </Text>
            </View>
          </View>

          {/* Acciones Derecha Header */}
          <View className="flex-row items-center gap-3">
            <View className="flex-row items-center gap-2 px-2.5 py-1 rounded-lg bg-[#161922] border border-[#262b3a]">
              <NotionIcon name="sparkle" size={13} color="#818cf8" />
              <Text className="text-xs text-[#8b949e]">Foco hoy:</Text>
              <Text className="text-xs font-mono font-bold text-white">
                {todayEvents.length * 30}m
              </Text>
            </View>

            <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <View className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <Text className="text-[11px] font-mono text-emerald-400">
                Offline SQLite
              </Text>
            </View>

            {/* Campana No Intrusiva */}
            <Pressable
              onPress={() => setBellDropdownOpen(!bellDropdownOpen)}
              className="p-2 rounded-xl bg-[#161922] border border-[#262b3a] flex-row items-center gap-1.5"
            >
              <NotionIcon name="bell" size={15} color="#e6edf3" />
              {alerts.length > 0 ? (
                <View className="px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30">
                  <Text className="text-[10px] font-mono font-bold text-amber-300">
                    {alerts.length}
                  </Text>
                </View>
              ) : null}
            </Pressable>

            <View className="w-8 h-8 rounded-full bg-[#1f2430] border border-[#2d3345] items-center justify-center">
              <Text className="font-bold text-xs text-white">D</Text>
            </View>
          </View>
        </View>

        <BellDropdown />

        {/* 2. CUERPO DE 3 PANELES */}
        <View className="flex-1 flex-row overflow-hidden">
          {/* PANEL 1: SIDEBAR COLAPSABLE (Ctrl+B) */}
          {sidebarOpen ? (
            <View className="w-56 border-r border-[#262b3a] bg-[#161922] p-3 justify-between">
              <View className="gap-4">
                <View>
                  <Text className="text-[10px] uppercase tracking-wider text-[#8b949e] font-bold px-2 mb-1.5">
                    Vistas Principales
                  </Text>
                  <View className="gap-1">
                    {(
                      [
                        {
                          label: 'Día (Timeline 24h)',
                          href: '/',
                          icon: 'clock' as NotionIconName,
                          active: pathname === '/' || pathname === '/index',
                          badge: 'Heroico',
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
                        className={`flex-row items-center justify-between px-2.5 py-2 rounded-xl ${
                          navItem.active ? 'bg-[#1f2430]' : 'bg-transparent'
                        }`}
                      >
                        <View className="flex-row items-center gap-2">
                          <NotionIcon
                            name={navItem.icon}
                            size={15}
                            color={navItem.active ? '#818cf8' : '#8b949e'}
                          />
                          <Text
                            className={`text-xs font-medium ${
                              navItem.active ? 'text-white font-semibold' : 'text-[#8b949e]'
                            }`}
                          >
                            {navItem.label}
                          </Text>
                        </View>
                        {navItem.badge ? (
                          <View className="px-1.5 py-0.5 rounded bg-[#0d1117] border border-[#2d3345]">
                            <Text className="text-[9px] font-mono text-[#8b949e]">
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
                  <View className="flex-row items-center justify-between px-2 mb-1.5">
                    <Text className="text-[10px] uppercase tracking-wider text-[#8b949e] font-bold">
                      Proyectos
                    </Text>
                    <Text className="text-[9px] font-mono text-emerald-400">
                      Auto-IA
                    </Text>
                  </View>

                  <View className="gap-1.5">
                    {ideaGroups.map((grp) => (
                      <Pressable
                        key={grp.id}
                        onPress={() => router.push('/ideas')}
                        className="p-2.5 rounded-xl bg-[#1f2430]/70 border border-[#2d3345] active:border-white"
                      >
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center gap-2 flex-1 min-w-0">
                            <NotionIcon
                              name={grp.icon}
                              size={14}
                              color={
                                grp.accentColor === 'indigo'
                                  ? '#818cf8'
                                  : grp.accentColor === 'emerald'
                                  ? '#34d399'
                                  : '#fbbf24'
                              }
                            />
                            <Text
                              numberOfLines={1}
                              className="font-bold text-xs text-white flex-1"
                            >
                              {grp.title.replace('Proyecto: ', '')}
                            </Text>
                          </View>
                          <Text className="text-[10px] font-mono text-[#8b949e]">
                            {grp.items.length}
                          </Text>
                        </View>
                        <Text
                          numberOfLines={1}
                          className="text-[10px] text-[#8b949e] mt-1"
                        >
                          {grp.subtitle}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              <View className="pt-3 border-t border-[#262b3a] flex-row items-center justify-between px-1">
                <Text className="text-[10px] text-[#8b949e]">Ctrl+B Sidebar</Text>
                <Text className="text-[10px] font-mono text-emerald-400">
                  Notion Icons
                </Text>
              </View>
            </View>
          ) : null}

          {/* PANEL 2: PANEL MULTIFUNCIÓN (AGENDA HOY + ASISTENTE IA) */}
          <View className="w-[330px] border-r border-[#262b3a] bg-[#12151d] p-3.5 justify-between">
            <View className="flex-1 min-h-0">
              {/* Switch Segmentado: Agenda Hoy vs Asistente IA */}
              <View className="bg-[#161922] p-1 rounded-xl border border-[#262b3a] flex-row items-center gap-1 mb-3">
                <Pressable
                  onPress={() => setDesktopSideTab('agenda')}
                  className={`flex-1 flex-row items-center justify-center gap-1.5 py-1.5 rounded-lg ${
                    desktopSideTab === 'agenda'
                      ? 'bg-[#1f2430] border border-[#2d3345]'
                      : ''
                  }`}
                >
                  <NotionIcon name="calendar" size={13} color="#34d399" />
                  <Text
                    className={`text-xs font-semibold ${
                      desktopSideTab === 'agenda' ? 'text-white' : 'text-[#8b949e]'
                    }`}
                  >
                    Agenda Hoy
                  </Text>
                  <View className="px-1.5 py-0.5 rounded bg-[#161922]">
                    <Text className="text-[10px] font-mono text-[#8b949e]">
                      {pendingIncompleteCount}
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => setDesktopSideTab('ai')}
                  className={`flex-1 flex-row items-center justify-center gap-1.5 py-1.5 rounded-lg ${
                    desktopSideTab === 'ai'
                      ? 'bg-[#1f2430] border border-[#2d3345]'
                      : ''
                  }`}
                >
                  <NotionIcon name="sparkle" size={13} color="#818cf8" />
                  <Text
                    className={`text-xs font-semibold ${
                      desktopSideTab === 'ai' ? 'text-white' : 'text-[#8b949e]'
                    }`}
                  >
                    Asistente IA
                  </Text>
                  <View className="w-2 h-2 rounded-full bg-indigo-400" />
                </Pressable>
              </View>

              {desktopSideTab === 'agenda' ? (
                <View className="flex-1 gap-3">
                  {/* Cápsula Compacta de Foco (Cero Duplicidad con el Timeline Central) */}
                  <View className="bg-[#161922] border border-indigo-500/30 rounded-xl p-3 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
                      <View className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 items-center justify-center">
                        <NotionIcon name="clock" size={14} color="#818cf8" />
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text className="font-bold text-xs text-white">
                          {todayEvents.length}{' '}
                          {todayEvents.length === 1
                            ? 'bloque hoy'
                            : 'bloques hoy'}
                        </Text>
                        <Text
                          numberOfLines={1}
                          className="text-[10px] text-emerald-400 mt-0.5"
                        >
                          Tarde libre disponible
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={() => {
                        setSelectedDayKey('27');
                        router.push('/');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#1f2430] border border-[#2d3345]"
                    >
                      <Text className="text-[10px] font-semibold text-white">
                        Ver
                      </Text>
                    </Pressable>
                  </View>

                  {/* Cabecera Pendientes */}
                  <View className="flex-row items-center justify-between px-1">
                    <View className="flex-row items-center gap-1.5">
                      <NotionIcon name="reminder" size={13} color="#fbbf24" />
                      <Text className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                        Pendientes sin hora
                      </Text>
                    </View>
                    <Pressable onPress={simulateAllPendingDone}>
                      <Text className="text-[10px] text-[#8b949e] underline">
                        Simular Todo Hecho
                      </Text>
                    </Pressable>
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
                </View>
              ) : (
                <View className="flex-1 gap-2.5">
                  <View className="p-3 rounded-xl bg-[#1f2430] border border-[#2d3345] gap-1.5">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs font-bold text-white">
                        Briefing de Jornada
                      </Text>
                      <Text className="text-[10px] font-mono text-emerald-400">
                        Activo
                      </Text>
                    </View>
                    <Text className="text-xs text-[#8b949e] leading-relaxed">
                      Tienes {todayEvents.length} bloque agendado hoy y{' '}
                      {pendingIncompleteCount} pendientes sin hora fija.
                    </Text>
                  </View>

                  {chatMessages.slice(-3).map((m) => (
                    <View
                      key={m.id}
                      className={`p-2.5 rounded-xl border ${
                        m.role === 'user'
                          ? 'bg-white border-white self-end'
                          : 'bg-[#161922] border-[#2d3345]'
                      }`}
                    >
                      <Text
                        className={`text-xs ${
                          m.role === 'user'
                            ? 'text-black font-medium'
                            : 'text-[#e6edf3]'
                        }`}
                      >
                        {m.text}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Punto de Entrada Universal Único en el pie del panel */}
            <SmartIntakeBar compact isOnChatScreen={isOnChatScreen} />
          </View>

          {/* PANEL 3: LIENZO PRINCIPAL EXPANDIDO */}
          <View className="flex-1 bg-[#0d1117]">
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
    <View className="flex-1 bg-[#0d1117]">
      {/* Mobile Top App Bar */}
      <View className="px-4 py-3 border-b border-[#262b3a] bg-[#161922] flex-row items-center justify-between z-20">
        <View className="flex-row items-center gap-2.5">
          <View className="w-7 h-7 rounded-lg bg-[#1f2430] border border-[#2d3345] items-center justify-center">
            <NotionIcon name="zap" size={14} color="#ffffff" />
          </View>
          <Text className="font-bold text-sm text-white">
            {getMobileHeaderTitle()}
          </Text>
        </View>

        <Pressable
          onPress={() => setBellDropdownOpen(!bellDropdownOpen)}
          className="p-1.5 rounded-full active:bg-[#1f2430] relative"
        >
          <NotionIcon name="bell" size={18} color="#e6edf3" />
          {alerts.length > 0 ? (
            <View
              style={{ position: 'absolute', top: 0, right: 0 }}
              className="w-4 h-4 rounded-full bg-white items-center justify-center"
            >
              <Text className="text-[9px] font-bold text-black">
                {alerts.length}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <BellDropdown />

      {/* Cuerpo de las 4 Pestañas con Barra de Entrada Universal siempre accesible */}
      <View className="flex-1">
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: '#161922',
              borderTopColor: '#262b3a',
              height: 58,
              paddingBottom: 6,
              paddingTop: 6,
            },
            tabBarActiveTintColor: '#ffffff',
            tabBarInactiveTintColor: '#8b949e',
            tabBarLabelStyle: {
              fontSize: 10,
              fontWeight: '600',
            },
          }}
        >
          {/* Tab 1: Asistente IA */}
          <Tabs.Screen
            name="chat"
            options={{
              title: 'Asistente',
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
              tabBarBadge:
                pendingIncompleteCount > 0 ? pendingIncompleteCount : undefined,
              tabBarBadgeStyle: {
                backgroundColor: '#ffffff',
                color: '#000000',
                fontSize: 9,
                fontWeight: 'bold',
              },
              tabBarIcon: ({ color }) => (
                <NotionIcon name="checkbox-checked" size={17} color={color} />
              ),
            }}
          />

          {/* Tab 4: Timeline 24h (Pantalla inicial heroica) */}
          <Tabs.Screen
            name="index"
            options={{
              title: 'Timeline 24h',
              tabBarIcon: ({ color }) => (
                <NotionIcon name="clock" size={17} color={color} />
              ),
            }}
          />
        </Tabs>
      </View>

      {/* Punto de Entrada Universal Único sobre la barra de navegación móvil */}
      <View style={{ position: 'absolute', bottom: 58, left: 0, right: 0 }}>
        <SmartIntakeBar isOnChatScreen={isOnChatScreen} />
      </View>
    </View>
  );
}
