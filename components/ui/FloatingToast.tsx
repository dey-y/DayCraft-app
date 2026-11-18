import React, { useEffect } from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDayCraftStore } from '@/store/useDayCraftStore';
import { LAYOUT } from '@/constants/theme';
import { NotionIcon } from './NotionIcon';
import { useTheme } from '@/store/useThemeStore';

/**
 * FloatingToast — Fricción Cero (Principio Innegociable v9)
 * Al capturar una tarea desde el calendario, muestra un Toast flotante efímero de 4.2 segundos
 * ("Añadido a Pendientes [Fijar hora] [Deshacer]") sin forzar cambio brusco de pantalla.
 */
export const FloatingToast: React.FC = () => {
  const { colors } = useTheme();
  const activeToast = useDayCraftStore((s) => s.activeToast);
  const hideToast = useDayCraftStore((s) => s.hideToast);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = width >= LAYOUT.desktopBreakpoint;

  useEffect(() => {
    if (!activeToast) return;
    const timer = setTimeout(() => {
      hideToast();
    }, LAYOUT.toastDurationMs);
    return () => clearTimeout(timer);
  }, [activeToast, hideToast]);

  if (!activeToast) return null;

  return (
    <Animated.View
      key={activeToast.id}
      entering={FadeInDown.springify().damping(18).stiffness(220)}
      exiting={FadeOutDown.duration(180)}
      style={{
        position: 'absolute',
        bottom: isDesktop ? 24 : Math.max(insets.bottom + 124, 132),
        right: isDesktop ? 24 : 16,
        left: isDesktop ? undefined : 16,
        minWidth: isDesktop ? 340 : undefined,
        maxWidth: isDesktop ? 440 : undefined,
        zIndex: 100,
      }}
      className="bg-card border border-line border-l-4 border-l-ok rounded-2xl p-3.5 shadow-2xl flex-row items-center justify-between gap-3"
    >
      <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
        <View className="w-6 h-6 rounded-lg bg-ok/10 border border-ok/20 items-center justify-center flex-shrink-0">
          <NotionIcon name="sparkle" size={13} color={colors.ok} />
        </View>
        <View className="flex-1 min-w-0">
          <Text numberOfLines={1} className="text-xs font-bold text-ink">
            {activeToast.title}
          </Text>
          <Text numberOfLines={1} className="text-xs text-muted mt-0.5">
            {activeToast.description}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-1.5 flex-shrink-0">
        {activeToast.primaryActionLabel && activeToast.onPrimaryAction ? (
          <Pressable
            onPress={() => {
              activeToast.onPrimaryAction?.();
              hideToast();
            }}
            hitSlop={6}
            className="min-h-[44px] bg-ink px-3 rounded-lg items-center justify-center active:opacity-80"
          >
            <Text className="text-xs font-bold text-canvas">
              {activeToast.primaryActionLabel}
            </Text>
          </Pressable>
        ) : null}

        {activeToast.undoActionLabel && activeToast.onUndoAction ? (
          <Pressable
            onPress={() => {
              activeToast.onUndoAction?.();
              hideToast();
            }}
            hitSlop={6}
            className="min-h-[44px] bg-raised border border-line px-3 rounded-lg items-center justify-center active:border-ink"
          >
            <Text className="text-xs font-semibold text-ink">
              {activeToast.undoActionLabel}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={hideToast}
          accessibilityRole="button"
          accessibilityLabel="Cerrar notificación"
          className="min-w-[44px] min-h-[44px] rounded-lg items-center justify-center active:bg-raised"
          hitSlop={8}
        >
          <NotionIcon name="close" size={14} color={colors.muted} />
        </Pressable>
      </View>
    </Animated.View>
  );
};
