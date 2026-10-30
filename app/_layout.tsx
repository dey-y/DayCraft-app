import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useDayCraftStore } from '@/store/useDayCraftStore';
import { FloatingToast } from '@/components/ui/FloatingToast';
import { SlotPickerSheetContent } from './modal/slot-picker';
import '../global.css';

/**
 * Root Layout Global (_layout.tsx)
 * - Hidrata automáticamente la base de datos SQLite Offline (`expo-sqlite`).
 * - Monta el Toast Flotante Efímero y el Bottom Sheet de 1-Tap Time Blocking en raíz.
 */
export default function RootLayout() {
  const hydrateFromSQLite = useDayCraftStore((s) => s.hydrateFromSQLite);
  const slotPickerTarget = useDayCraftStore((s) => s.slotPickerTarget);

  useEffect(() => {
    hydrateFromSQLite();
  }, [hydrateFromSQLite]);

  return (
    <SafeAreaProvider>
      <SafeAreaView className="flex-1 bg-[#0d1117]" edges={['top', 'left', 'right']}>
        <StatusBar style="light" backgroundColor="#0d1117" />

        <View className="flex-1 bg-[#0d1117]">
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#0d1117' },
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

          {/* Toast Flotante Efímero Global (4.2s) */}
          <FloatingToast />
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
