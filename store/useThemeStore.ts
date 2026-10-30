import { create } from 'zustand';
import {
  DEFAULT_THEME,
  THEMES,
  ThemeColors,
  ThemeDefinition,
  ThemeName,
} from '@/constants/themes';
import { loadPersistedState, savePersistedState } from '@/services/db/sqlite';

const THEME_KEY = 'theme_v1';

interface ThemeState {
  themeName: ThemeName;
  setTheme: (name: ThemeName) => void;
  /** Debe llamarse tras `initDatabase()` (lo hace el layout raíz tras hidratar el store principal). */
  hydrateTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  themeName: DEFAULT_THEME,
  setTheme: (name) => {
    if (!THEMES[name]) return;
    set({ themeName: name });
    void savePersistedState(THEME_KEY, name);
  },
  hydrateTheme: async () => {
    const saved = await loadPersistedState<ThemeName>(THEME_KEY);
    if (saved && THEMES[saved]) set({ themeName: saved });
  },
}));

/** Tema activo + colores hex (para props nativas: iconos, SVG, StyleSheet). */
export function useTheme(): {
  theme: ThemeDefinition;
  colors: ThemeColors;
  isDark: boolean;
} {
  const themeName = useThemeStore((s) => s.themeName);
  const theme = THEMES[themeName] ?? THEMES[DEFAULT_THEME];
  return { theme, colors: theme.colors, isDark: theme.isDark };
}
