import React from 'react';
import { View, Text, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { useDayCraftStore } from '@/store/useDayCraftStore';
import { LAYOUT } from '@/constants/theme';
import { NotionIcon } from '@/components/ui/NotionIcon';
import { PendingItem } from '@/components/pending/PendingItem';
import { EmptyCelebration } from '@/components/pending/EmptyCelebration';
import { useTheme } from '@/store/useThemeStore';

/**
 * Tab 3: Pendientes de Hoy (Sin hora fija) & Rollover Antiestrés
 * - Cero inputs duplicados: confía 100% en el Smart Intake único.
 * - Incluye pastilla `[ De ayer ]`, botón `[ Fijar hora ]` y simulador de Rollover / Todo Hecho.
 */
export default function PendingScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= LAYOUT.desktopBreakpoint;

  const pendingTasks = useDayCraftStore((s) => s.pendingTasks);
  const togglePendingTask = useDayCraftStore((s) => s.togglePendingTask);
  const openSlotPicker = useDayCraftStore((s) => s.openSlotPicker);
  const simulateAllPendingDone = useDayCraftStore((s) => s.simulateAllPendingDone);
  const triggerRolloverSimulation = useDayCraftStore((s) => s.triggerRolloverSimulation);

  const incompleteCount = pendingTasks.filter((t) => !t.completed).length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={{
        padding: 16,
        paddingBottom: isDesktop ? 32 : 24,
        gap: 14,
      }}
    >
      {/* Cabecera */}
      <View className="flex-row items-center justify-between">
        <View>
          <View className="flex-row items-center gap-2">
            <NotionIcon name="checkbox-checked" size={16} color={colors.accentSoft} />
            <Text className="font-bold text-sm text-ink">Pendientes de Hoy</Text>
          </View>
          <Text className="text-[11px] text-muted mt-0.5">
            Cosas para hacer hoy sin hora fija asignada
          </Text>
        </View>

        <View className="px-2.5 py-1 rounded-full bg-raised border border-line">
          <Text className="text-xs font-mono text-muted">
            {incompleteCount} {incompleteCount === 1 ? 'cosa' : 'cosas'}
          </Text>
        </View>
      </View>

      {/* Indicador de Punto de Entrada Único (Cero Redundancia de Inputs) */}
      <View className="p-3 rounded-xl bg-card border border-line-subtle flex-row items-center justify-between">
        <View className="flex-row items-center gap-2 flex-1">
          <NotionIcon name="mic" size={14} color={colors.accentSoft} />
          <Text className="text-xs text-muted flex-1">
            Dicta o escribe en la barra Smart Intake para añadir pendientes
          </Text>
        </View>
        <Text className="font-mono text-xs text-muted">Smart Intake</Text>
      </View>

      {/* Lista de Pendientes o Empty State Motivador */}
      {incompleteCount === 0 ? (
        <EmptyCelebration />
      ) : (
        <View className="gap-2.5">
          {pendingTasks.map((task) => (
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
          ))}
        </View>
      )}

      {/* Acciones de prueba de Reglas de Negocio (Todo Hecho & Rollover 3 días) */}
      <View className="flex-row gap-2 pt-2">
        <Pressable
          onPress={simulateAllPendingDone}
          className="flex-1 py-2 px-3 rounded-xl border border-dashed border-line items-center active:border-ink"
        >
          <Text className="text-xs text-muted font-medium">
            Simular: Todo Hecho / Restaurar
          </Text>
        </Pressable>

        <Pressable
          onPress={triggerRolloverSimulation}
          className="flex-1 py-2 px-3 rounded-xl border border-dashed border-warm/30 items-center active:border-warm"
        >
          <Text className="text-xs text-warm font-medium">
            Simular: Rollover (+1 día)
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
