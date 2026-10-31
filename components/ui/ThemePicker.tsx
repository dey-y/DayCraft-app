import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { vars } from 'nativewind';
import { THEMES, THEME_ORDER, ThemeName, themeCssVars } from '@/constants/themes';
import { useTheme, useThemeStore } from '@/store/useThemeStore';

/**
 * ThemePickerButton — Selector de tema Kuro-Zen en 1 toque.
 * - Botón discreto (un punto del color de acento actual) que abre un popover con los 5 temas.
 * - Al elegir, el tema se aplica en vivo (se ve detrás del velo suave) y se guarda en SQLite.
 * - El popover se cierra solo a los ~550 ms para que el cambio se sienta fluido, no "modal".
 */
export const ThemePickerButton: React.FC = () => {
  const { theme, colors } = useTheme();
  const setTheme = useThemeStore((s) => s.setTheme);
  const [open, setOpen] = useState(false);
  // Un Modal nativo vive en otra raíz de vistas: le pasamos las variables del tema explícitamente.
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
    closeTimer.current = setTimeout(() => setOpen(false), 550);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Cambiar tema de color"
        hitSlop={8}
        className="w-9 h-9 rounded-xl bg-card border border-line-subtle items-center justify-center active:border-ink"
      >
        <View
          style={{ backgroundColor: colors.accent }}
          className="w-4 h-4 rounded-full border border-line"
        />
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
          className="flex-1 bg-black/30 items-end pt-16 pr-3 pl-3"
        >
          {/* Evita que un toque dentro de la tarjeta cierre el popover */}
          <Pressable
            onPress={() => undefined}
            className="w-full max-w-[340px] bg-card border border-line rounded-2xl p-4"
          >
            <Text className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-3">
              Atmósfera
            </Text>

            <View className="flex-row justify-between items-center">
              {THEME_ORDER.map((name) => {
                const t = THEMES[name];
                const selected = t.name === theme.name;
                return (
                  <Pressable
                    key={name}
                    onPress={() => choose(name)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${t.label} (${t.kanji})`}
                    className="items-center gap-1 w-[46px]"
                  >
                    {/* Muestra del tema con SUS propios colores (no los del tema activo) */}
                    <View
                      style={{
                        backgroundColor: t.colors.canvas,
                        borderColor: selected ? t.colors.accent : t.colors.line,
                        borderWidth: selected ? 2 : 1,
                      }}
                      className="w-10 h-10 rounded-full items-center justify-center"
                    >
                      <View
                        style={{ backgroundColor: t.colors.card, borderColor: t.colors.line }}
                        className="w-6 h-6 rounded-full border items-center justify-center"
                      >
                        <View
                          style={{ backgroundColor: t.colors.accent }}
                          className="w-2.5 h-2.5 rounded-full"
                        />
                      </View>
                    </View>
                    <Text
                      numberOfLines={1}
                      className={`text-[11px] ${
                        selected ? 'text-ink font-semibold' : 'text-muted'
                      }`}
                    >
                      {t.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View className="mt-3 pt-3 border-t border-line-subtle">
              <Text className="text-xs text-ink font-medium">
                {theme.kanji}
              </Text>
              <Text className="text-xs text-muted mt-0.5">{theme.description}</Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};
