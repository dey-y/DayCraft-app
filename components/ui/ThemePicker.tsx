import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, Text, View, ScrollView } from 'react-native';
import { vars } from 'nativewind';
import { THEMES, THEME_ORDER, ThemeName, themeCssVars } from '@/constants/themes';
import { useTheme, useThemeStore } from '@/store/useThemeStore';
import { NotionIcon } from '@/components/ui/NotionIcon';

/**
 * ThemePickerButton — Menú visual para alternar cómodamente entre las 6 paletas Kuro-Zen:
 * - Granate (Enji)
 * - Murasaki (Murasaki)
 * - Sumi (Sumi-e)
 * - Índigo (Aizome)
 * - Bosque (Koke)
 * - Nieve (Shiro)
 *
 * Muestra tarjetas táctiles con previsualización de 3 tonos, kanji, descripción y selección viva.
 * Con ScrollView responsivo para garantizar que ningún texto quede cortado en pantallas pequeñas o móviles.
 */
export const ThemePickerButton: React.FC = () => {
  const { theme, colors } = useTheme();
  const setTheme = useThemeStore((s) => s.setTheme);
  const [open, setOpen] = useState(false);
  const themeStyle = React.useMemo(() => vars(themeCssVars(theme)), [theme]);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );

  const choose = (name: ThemeName) => {
    setTheme(name);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 420);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Cambiar tema de color"
        hitSlop={8}
        className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl bg-card border border-line-subtle flex-row items-center justify-center gap-2 active:border-ink"
      >
        <View
          style={{ backgroundColor: colors.accent }}
          className="w-3.5 h-3.5 rounded-full border border-line"
        />
        <Text className="text-xs font-medium text-ink hidden sm:flex">
          {theme.label}
        </Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          onPress={() => setOpen(false)}
          style={themeStyle}
          className="flex-1 bg-canvas/80 items-center justify-center p-3 sm:p-4"
        >
          {/* Tarjeta Modal con ScrollView para asegurar que nunca se corte abajo */}
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ maxHeight: '90%' }}
            className="w-full max-w-md bg-card border border-line rounded-2xl p-4 sm:p-5 shadow-2xl flex-col"
          >
            {/* Cabecera */}
            <View className="flex-row items-center justify-between pb-3 border-b border-line-subtle flex-shrink-0">
              <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
                <View
                  style={{ backgroundColor: colors.accent }}
                  className="w-7 h-7 rounded-lg items-center justify-center flex-shrink-0"
                >
                  <NotionIcon name="sparkle" size={14} color={colors.onAccent} />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-sm font-bold text-ink">
                    Atmósferas Japandi
                  </Text>
                  <Text className="text-xs text-muted">
                    6 paletas balanceadas con contraste WCAG garantizado
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => setOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Cerrar selector de tema"
                hitSlop={8}
                className="min-w-[44px] min-h-[44px] rounded-full bg-raised items-center justify-center active:bg-line flex-shrink-0"
              >
                <NotionIcon name="close" size={14} color={colors.muted} />
              </Pressable>
            </View>

            {/* Contenido scrolleable para móviles */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 12 }}
            >
              <View className="flex-row flex-wrap gap-2.5 justify-between">
                {THEME_ORDER.map((name) => {
                  const t = THEMES[name];
                  const selected = t.name === theme.name;

                  return (
                    <Pressable
                      key={name}
                      onPress={() => choose(name)}
                      style={{ width: '48%', minHeight: 105 }}
                      className={`p-3 rounded-xl border flex-col justify-between gap-1.5 active:scale-[0.98] ${
                        selected
                          ? 'bg-accent/15 border-accent'
                          : 'bg-raised/70 border-line-subtle'
                      }`}
                    >
                      {/* Fila superior: Nombre, Kanji y Badge */}
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-baseline gap-1.5 flex-1 min-w-0">
                          <Text
                            numberOfLines={1}
                            style={{ lineHeight: 16 }}
                            className={`text-xs font-bold ${
                              selected ? 'text-ink' : 'text-ink/90'
                            }`}
                          >
                            {t.label}
                          </Text>
                          <Text
                            style={{ lineHeight: 16 }}
                            className="text-xs font-mono text-muted"
                          >
                            {t.kanji}
                          </Text>
                        </View>

                        {selected ? (
                          <View className="w-4 h-4 rounded-full bg-accent items-center justify-center flex-shrink-0">
                            <NotionIcon name="check" size={10} color={t.colors.onAccent} strokeWidth={2.5} />
                          </View>
                        ) : null}
                      </View>

                      {/* Descripción con line-height amplio para no cortar letras con descendente */}
                      <Text
                        numberOfLines={2}
                        style={{ fontSize: 12, lineHeight: 16 }}
                        className="text-muted"
                      >
                        {t.description}
                      </Text>

                      {/* Muestrario de los 3 tonos característicos */}
                      <View className="flex-row items-center gap-1.5 pt-0.5">
                        <View
                          style={{ backgroundColor: t.colors.canvas }}
                          className="w-3.5 h-3.5 rounded-full border border-line"
                        />
                        <View
                          style={{ backgroundColor: t.colors.card }}
                          className="w-3.5 h-3.5 rounded-full border border-line"
                        />
                        <View
                          style={{ backgroundColor: t.colors.accent }}
                          className="w-3.5 h-3.5 rounded-full border border-line"
                        />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {/* Pie de confirmación siempre visible y sin cortes */}
            <View className="pt-2.5 border-t border-line-subtle flex-row items-center justify-between gap-2 flex-shrink-0">
              <Text style={{ fontSize: 12, lineHeight: 16 }} className="text-muted flex-1 min-w-0">
                Tema activo: <Text className="font-bold text-accent-soft">{theme.label} ({theme.kanji})</Text>
              </Text>
              <Text style={{ fontSize: 12, lineHeight: 16 }} className="font-mono text-muted flex-shrink-0">
                SQLite
              </Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};
