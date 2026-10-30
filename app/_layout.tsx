import React, { useEffect, useMemo } from 'react';
import { Platform, View } from 'react-native';
import { vars } from 'nativewind';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useDayCraftStore } from '@/store/useDayCraftStore';
import { FloatingToast } from '@/components/ui/FloatingToast';
import { IdeaNoteModal } from '@/components/ideas/IdeaNoteModal';
import { SlotPickerSheetContent } from './modal/slot-picker';
import '../global.css';
import { useTheme, useThemeStore } from '@/store/useThemeStore';
import { themeCssVars } from '@/constants/themes';

/**
 * Root Layout Global (_layout.tsx)
 * - Hidrata automáticamente la base de datos SQLite Offline (`expo-sqlite`).
 * - Monta el Toast Flotante Efímero y el Bottom Sheet de 1-Tap Time Blocking en raíz.
 */
export default function RootLayout() {
  const { theme, colors, isDark } = useTheme();
  const hydrateTheme = useThemeStore((s) => s.hydrateTheme);
  const hydrateFromSQLite = useDayCraftStore((s) => s.hydrateFromSQLite);
  const slotPickerTarget = useDayCraftStore((s) => s.slotPickerTarget);

  // Tras abrir la base de datos (la abre hydrateFromSQLite) se recupera el tema guardado.
  useEffect(() => {
    hydrateFromSQLite().then(hydrateTheme);
  }, [hydrateFromSQLite, hydrateTheme]);

  const cssVars = useMemo(() => themeCssVars(theme), [theme]);
  const themeStyle = useMemo(() => vars(cssVars), [cssVars]);

  // En web los Modal/portales viven fuera del árbol raíz: publicamos las variables en <html>.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const root = document.documentElement;
    Object.entries(cssVars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.style.colorScheme = isDark ? 'dark' : 'light';
  }, [cssVars, isDark]);

  return (
    <View style={[{ flex: 1 }, themeStyle]}>
    <SafeAreaProvider>
      <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'left', 'right']}>
        <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.canvas} />

        <View className="flex-1 bg-canvas">
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.canvas },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="modal/slot-picker"
              options={{
                presentation: 'transparentModal',
                animation: 'fade',
                headerShown: false,
              }}
            />
          </Stack>

          {/* Overlay Global de 1-Tap Time-Blocking cuando se invoca desde cualquier pantalla */}
          {slotPickerTarget ? (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 95,
              }}
              className="bg-black/75 justify-end sm:justify-center p-4"
            >
              <SlotPickerSheetContent />
            </View>
          ) : null}

          {/* Visor y Editor de Notas Markdown (.md) */}
          <IdeaNoteModal />

          {/* Toast Flotante Efímero Global (4.2s) */}
          <FloatingToast />
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
    </View>
  );
}
