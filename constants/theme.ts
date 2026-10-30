/**
 * DayCraft AI - Design System Constants (v9.0 Clean Monocromo)
 * Paleta oscura monocroma estricta e invariantes de layout.
 */

export const COLORS = {
  background: '#0d1117',      // Fondo principal
  header: '#12151d',          // Cabecera / Panel intermedio
  card: '#161922',            // Tarjetas y paneles
  accent: '#1f2430',          // Acentos / Hover / Superficies activas
  border: '#2d3345',          // Bordes principales
  borderSubtle: '#262b3a',    // Bordes secundarios / divisores
  textPrimary: '#e6edf3',     // Texto principal
  textWhite: '#ffffff',       // Blanco puro para énfasis
  textMuted: '#8b949e',       // Texto secundario / etiquetas
  indigo: '#6366f1',          // Acento primario de Time-Blocking
  indigoLight: '#818cf8',
  emerald: '#34d399',         // Estado vivo / completado / sync
  amber: '#fbbf24',           // Rollover "De ayer" / Ideas
  sky: '#38bdf8',             // Recordatorios puntuales
  rose: '#f43f5e',            // Hora actual en el raíl
} as const;

export const LAYOUT = {
  hourHeightMobile: 56,       // Altura por hora en móvil (4 cuartos de 14px)
  hourHeightDesktop: 84,      // Altura por hora en web/desktop (4 cuartos de 21px)
  quarterMinutes: 15,
  quartersPerDay: 96,         // 24h * 4 cuartos de hora
  toastDurationMs: 4200,      // Duración efímera del Toast flotante (4.2s)
  maxRolloverDays: 3,         // Regla Antiestrés de los 3 días
  desktopBreakpoint: 900,     // Breakpoint para alternar entre 4 Tabs (Móvil) y Cockpit 3 Paneles (Web)
} as const;

export interface DayInfo {
  key: string;
  dayName: string;
  dayNum: string;
  fullTitle: string;
  isToday?: boolean;
  isPast?: boolean;
}

export const INITIAL_DAYS: DayInfo[] = [
  { key: '25', dayName: 'DOM', dayNum: '25', fullTitle: 'Domingo 25 de Octubre', isPast: true },
  { key: '26', dayName: 'LUN', dayNum: '26', fullTitle: 'Lunes 26 de Octubre', isPast: true },
  { key: '27', dayName: 'MAR', dayNum: '27', fullTitle: 'Martes 27 de Octubre (Hoy)', isToday: true },
  { key: '28', dayName: 'MIÉ', dayNum: '28', fullTitle: 'Miércoles 28 de Octubre' },
  { key: '29', dayName: 'JUE', dayNum: '29', fullTitle: 'Jueves 29 de Octubre' },
  { key: '30', dayName: 'VIE', dayNum: '30', fullTitle: 'Viernes 30 de Octubre' },
  { key: '31', dayName: 'SÁB', dayNum: '31', fullTitle: 'Sábado 31 de Octubre' },
  { key: '01', dayName: 'DOM', dayNum: '01', fullTitle: 'Domingo 1 de Noviembre' },
];

export const SMART_SLOTS_PRESETS = [
  { startTime: '12:00', endTime: '12:30', label: 'Tras reunión actual', startQ: 48, quarters: 2 },
  { startTime: '16:00', endTime: '16:30', label: 'Tarde libre', startQ: 64, quarters: 2 },
  { startTime: '19:00', endTime: '19:30', label: 'Fin de jornada', startQ: 76, quarters: 2 },
] as const;
