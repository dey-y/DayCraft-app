import React, { useEffect } from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { useDayCraftStore } from '@/store/useDayCraftStore';
import { LAYOUT } from '@/constants/theme';
import { NotionIcon } from './NotionIcon';

/**
 * FloatingToast — Fricción Cero (Principio Innegociable v9)
 * Al capturar una tarea desde el calendario, muestra un Toast flotante efímero de 4.2 segundos
 * ("✨ Añadido a Pendientes [Fijar hora] [Deshacer]") sin forzar cambio brusco de pantalla.
 */
export const FloatingToast: React.FC = () => {
  const activeToast = useDayCraftStore((s) => s.activeToast);
  const hideToast = useDayCraftStore((s) => s.hideToast);
  const { width } = useWindowDimensions();
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
    <View
      style={{
        position: 'absolute',
        bottom: isDesktop ? 24 : 132,
        right: isDesktop ? 24 : 16,
        left: isDesktop ? undefined : 16,
        minWidth: isDesktop ? 340 : undefined,
        maxWidth: isDesktop ? 440 : undefined,
        zIndex: 100,
      }}
      className="bg-[#161922] border border-[#2d3345] border-l-4 border-l-emerald-400 rounded-2xl p-3.5 shadow-2xl flex-row items-center justify-between gap-3"
    >
      <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
        <View className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 items-center justify-center flex-shrink-0">
          <NotionIcon name="sparkle" size={13} color="#34d399" />
        </View>
        <View className="flex-1 min-w-0">
          <Text numberOfLines={1} className="text-xs font-bold text-white">
            {activeToast.title}
          </Text>
          <Text numberOfLines={1} className="text-[11px] text-[#8b949e] mt-0.5">
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
            className="bg-white px-2.5 py-1.5 rounded-lg active:opacity-80"
          >
            <Text className="text-[10px] font-bold text-black">
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
            className="bg-[#1f2430] border border-[#2d3345] px-2.5 py-1.5 rounded-lg active:border-white"
          >
            <Text className="text-[10px] font-semibold text-[#e6edf3]">
              {activeToast.undoActionLabel}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={hideToast}
          className="p-1 rounded-lg active:bg-[#1f2430]"
          hitSlop={8}
        >
          <NotionIcon name="close" size={13} color="#8b949e" />
        </Pressable>
      </View>
    </View>
  );
};
