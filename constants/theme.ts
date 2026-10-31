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
  key: string;                // Fecha ISO corta p.ej. '2026-10-27' (o alias '27', '28', '30' para retrocompatibilidad)
  isoDate: string;            // 'YYYY-MM-DD'
  dayName: string;            // 'LUN', 'MAR', 'MIÉ'...
  dayNum: string;             // '27', '01'...
  monthShort: string;         // 'OCT', 'NOV', 'DIC'...
  monthFull: string;          // 'Octubre', 'Noviembre'...
  year: number;
  fullTitle: string;          // 'Martes 27 de Octubre 2026 (Hoy)'
  isToday?: boolean;
  isPast?: boolean;
  isFirstOfMonth?: boolean;   // true cuando es día 01 de un nuevo mes
}

const DAY_NAMES_SHORT = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const DAY_NAMES_FULL = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];
const MONTH_NAMES_SHORT = [
  'ENE',
  'FEB',
  'MAR',
  'ABR',
  'MAY',
  'JUN',
  'JUL',
  'AGO',
  'SEP',
  'OCT',
  'NOV',
  'DIC',
];
const MONTH_NAMES_FULL = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

// Fecha ancla base "Hoy": Martes 27 de Octubre 2026 (coherente con los datos semilla del proyecto)
const TODAY_ANCHOR = new Date(2026, 9, 27, 12, 0, 0);

export function createDayInfoFromDate(date: Date): DayInfo {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const dow = date.getDay();

  const isoDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const isToday =
    y === TODAY_ANCHOR.getFullYear() &&
    m === TODAY_ANCHOR.getMonth() &&
    d === TODAY_ANCHOR.getDate();

  const anchorMidnight = new Date(
    TODAY_ANCHOR.getFullYear(),
    TODAY_ANCHOR.getMonth(),
    TODAY_ANCHOR.getDate()
  ).getTime();
  const currentMidnight = new Date(y, m, d).getTime();
  const isPast = currentMidnight < anchorMidnight;

  // Para mantener compatibilidad directa con eventos semilla en Octubre 2026 ('27', '28', '30')
  const key = y === 2026 && m === 9 ? String(d).padStart(2, '0') : isoDate;

  const dayName = DAY_NAMES_SHORT[dow];
  const dayNum = String(d).padStart(2, '0');
  const monthShort = MONTH_NAMES_SHORT[m];
  const monthFull = MONTH_NAMES_FULL[m];
  const fullTitle = `${DAY_NAMES_FULL[dow]} ${d} de ${monthFull} ${y}${
    isToday ? ' (Hoy)' : ''
  }`;

  return {
    key,
    isoDate,
    dayName,
    dayNum,
    monthShort,
    monthFull,
    year: y,
    fullTitle,
    isToday,
    isPast,
    isFirstOfMonth: d === 1,
  };
}

/**
 * Genera un rango continuo de días desde `startOffset` hasta `endOffset` respecto al día de Hoy,
 * abarcando un año completo (365+ días) para permitir scroll multimes libre y continuo.
 */
export function generateDaysRange(startOffset = -14, endOffset = 365): DayInfo[] {
  const list: DayInfo[] = [];
  for (let offset = startOffset; offset <= endOffset; offset++) {
    const dt = new Date(
      TODAY_ANCHOR.getFullYear(),
      TODAY_ANCHOR.getMonth(),
      TODAY_ANCHOR.getDate() + offset,
      12,
      0,
      0
    );
    list.push(createDayInfoFromDate(dt));
  }
  return list;
}

export const INITIAL_DAYS: DayInfo[] = generateDaysRange(-14, 365);

export const SMART_SLOTS_PRESETS = [
  { startTime: '12:00', endTime: '12:30', label: 'Tras reunión actual', startQ: 48, quarters: 2 },
  { startTime: '16:00', endTime: '16:30', label: 'Tarde libre', startQ: 64, quarters: 2 },
  { startTime: '19:00', endTime: '19:30', label: 'Fin de jornada', startQ: 76, quarters: 2 },
] as const;
