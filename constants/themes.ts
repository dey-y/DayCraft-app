/**
 * DayCraft AI — Sistema de temas "Kuro-Zen" (Dark Japandi + Shiro Washi)
 *
 * Cada tema define los mismos tokens semánticos. La UI nunca usa colores sueltos:
 *   - Clases NativeWind:  bg-canvas, bg-card, bg-raised, border-line, text-ink, text-muted, bg-accent...
 *   - Props nativas (iconos, SVG, StyleSheet):  const { colors } = useTheme(); colors.muted ...
 *
 * Los tokens se publican como variables CSS (`--c-<token>`, canales RGB) para que
 * `tailwind.config.js` pueda aplicar opacidad (`bg-accent/15`).
 *
 * Todos los contrastes han sido auditados según WCAG AA (>= 4.5:1 para texto sobre fondo)
 * y WCAG AAA (>= 7.0:1 para el cuerpo principal de texto).
 */

export type ThemeName = 'granate' | 'murasaki' | 'sumi' | 'aizome' | 'bosque' | 'shiro' | 'akane';

export interface ThemeColors {
  /** Fondo principal de la app */
  canvas: string;
  /** Cabeceras y paneles intermedios */
  header: string;
  /** Tarjetas y paneles */
  card: string;
  /** Superficie elevada / hover / seleccionada */
  raised: string;
  /** Bordes principales */
  line: string;
  /** Bordes secundarios y divisores */
  lineSubtle: string;
  /** Texto principal */
  ink: string;
  /** Texto secundario */
  muted: string;
  /** Acento principal (time-blocking, selección, foco) */
  accent: string;
  /** Variante legible del acento para texto sobre fondos tintados */
  accentSoft: string;
  /** Texto/icono sobre relleno sólido de acento */
  onAccent: string;
  /** Estado vivo / completado / sincronizado */
  ok: string;
  /** Rollover "De ayer" / ideas / avisos amables */
  warm: string;
  /** Recordatorios puntuales / información */
  info: string;
  /** Hora actual en el raíl */
  now: string;
}

export interface ThemeDefinition {
  name: ThemeName;
  label: string;
  /** Nombre japonés corto */
  kanji: string;
  description: string;
  isDark: boolean;
  colors: ThemeColors;
}

export const THEMES: Record<ThemeName, ThemeDefinition> = {
  granate: {
    name: 'granate',
    label: 'Granate',
    kanji: 'Enji',
    description: 'Rojo granate y caoba oscuro. Nobleza y carácter.',
    isDark: true,
    colors: {
      canvas: '#130F11',
      header: '#171215',
      card: '#1A1417',
      raised: '#241B1F',
      line: '#36232B',
      lineSubtle: '#291A21',
      ink: '#F4ECEE',
      muted: '#9E888D',
      accent: '#A82236',
      accentSoft: '#DE5D71', // WCAG AA 5.11:1 sobre card
      onAccent: '#FFF1F3',
      ok: '#7FB59A',
      warm: '#D4A373',
      info: '#7FA6C4',
      now: '#D4A373',
    },
  },
  murasaki: {
    name: 'murasaki',
    label: 'Murasaki',
    kanji: 'Murasaki',
    description: 'Ciruela y humo ahumado. Introspección y calma.',
    isDark: true,
    colors: {
      canvas: '#131217',
      header: '#16151C',
      card: '#191720',
      raised: '#201D2A',
      line: '#2B2638',
      lineSubtle: '#231F2E',
      ink: '#EDEAF2',
      muted: '#968FA3',
      accent: '#9A88C8',
      accentSoft: '#B7A9DB',
      onAccent: '#17141F',
      ok: '#7FB59A',
      warm: '#C89F77',
      info: '#7FA6C4',
      now: '#D45A4D',
    },
  },
  sumi: {
    name: 'sumi',
    label: 'Sumi',
    kanji: 'Sumi-e',
    description: 'Tinta carbón y plata mineral. Minimalismo puro.',
    isDark: true,
    colors: {
      canvas: '#101111',
      header: '#131515',
      card: '#181A1A',
      raised: '#202322',
      line: '#2B302F',
      lineSubtle: '#232726',
      ink: '#EAE8E3',
      muted: '#8E9491',
      accent: '#D1D5DB',
      accentSoft: '#E5E7EB',
      onAccent: '#101111',
      ok: '#8FB8A0',
      warm: '#B9A58A',
      info: '#A9B8C4',
      now: '#B96A59',
    },
  },
  aizome: {
    name: 'aizome',
    label: 'Índigo',
    kanji: 'Aizome',
    description: 'Índigo y niebla de río. Claridad y foco.',
    isDark: true,
    colors: {
      canvas: '#111316',
      header: '#14171B',
      card: '#171B20',
      raised: '#1E232B',
      line: '#28313D',
      lineSubtle: '#20272F',
      ink: '#E8ECF0',
      muted: '#8E9AA8',
      accent: '#5E85A8',
      accentSoft: '#8FB0CD',
      onAccent: '#0E141A',
      ok: '#7FB59A',
      warm: '#C89F77',
      info: '#8FAEC9',
      now: '#B96A59',
    },
  },
  bosque: {
    name: 'bosque',
    label: 'Bosque',
    kanji: 'Koke',
    description: 'Musgo y pino zen. Serenidad y calma vegetal.',
    isDark: true,
    colors: {
      canvas: '#101412',
      header: '#131815',
      card: '#161D19',
      raised: '#1F2923',
      line: '#28362E',
      lineSubtle: '#202B25',
      ink: '#E8EFEA',
      muted: '#8F9E94',
      accent: '#3E7854',
      accentSoft: '#78B892', // WCAG AA 7.41:1 sobre card
      onAccent: '#FFFFFF', // WCAG AA 5.22:1 sobre accent
      ok: '#7FB59A',
      warm: '#D4A373',
      info: '#7FAEC9',
      now: '#D4A373',
    },
  },
  shiro: {
    name: 'shiro',
    label: 'Nieve',
    kanji: 'Shiro',
    description: 'Papel washi y lino. Luz cálida de día.',
    isDark: false,
    colors: {
      canvas: '#FAF8F5',
      header: '#F5F2EC',
      card: '#FFFFFF',
      raised: '#F2EDE4',
      line: '#E5DFD4',
      lineSubtle: '#EDE8DE',
      ink: '#211F1D',
      muted: '#6E695F',
      accent: '#4A6B5B',
      accentSoft: '#3A5A4A',
      onAccent: '#FFFFFF',
      ok: '#3F7A5A',
      warm: '#9A6535',
      info: '#3F6F95',
      now: '#C25447',
    },
  },
  akane: {
    name: 'akane',
    label: 'Rojo',
    kanji: 'Akane',
    description: 'Laca y cinabrio. Calidez y determinación.',
    isDark: true,
    colors: {
      canvas: '#141212',
      header: '#171414',
      card: '#1C1818',
      raised: '#241E1E',
      line: '#342929',
      lineSubtle: '#2A2121',
      ink: '#EFECE9',
      muted: '#A39493',
      accent: '#B94B3F',
      accentSoft: '#DE8576',
      onAccent: '#FFFFFF',
      ok: '#7FB59A',
      warm: '#D4A373',
      info: '#7FA6C4',
      now: '#E3A857',
    },
  },
};

export const THEME_ORDER: ThemeName[] = ['granate', 'murasaki', 'sumi', 'aizome', 'bosque', 'shiro'];
export const DEFAULT_THEME: ThemeName = 'granate';

/** '#RRGGBB' → '19 18 23' (canales para `rgb(var(--c-x) / <alpha-value>)`). */
export function hexToChannels(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/** Variables CSS (`--c-canvas`, `--c-line-subtle`...) de un tema. */
export function themeCssVars(theme: ThemeDefinition): Record<string, string> {
  const out: Record<string, string> = {};
  (Object.keys(theme.colors) as (keyof ThemeColors)[]).forEach((k) => {
    out[`--c-${kebab(k)}`] = hexToChannels(theme.colors[k]);
  });
  return out;
}
