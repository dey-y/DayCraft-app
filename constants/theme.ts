/**
 * DayCraft AI - Design System Constants (v9.0 Clean Monocromo / Kuro-Zen)
 * Invariantes de layout y generador de calendario dinámico real con claves ISO (YYYY-MM-DD).
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
  key: string;                // Clave ISO 'YYYY-MM-DD'
  isoDate: string;            // 'YYYY-MM-DD'
  dayName: string;            // 'LUN', 'MAR', 'MIÉ'...
  dayNum: string;             // '27', '01'...
  monthShort: string;         // 'OCT', 'NOV', 'DIC'...
  monthFull: string;          // 'Octubre', 'Noviembre'...
  year: number;
  fullTitle: string;          // 'Sábado 31 de Octubre 2026 (Hoy)'
  isToday?: boolean;
  isPast?: boolean;
  isFirstOfMonth?: boolean;   // true cuando es día 01 de un nuevo mes
}

export const DAY_NAMES_SHORT = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'] as const;
export const DAY_NAMES_FULL = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const;
export const MONTH_NAMES_SHORT = [
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
] as const;
export const MONTH_NAMES_FULL = [
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
] as const;

/**
 * Convierte un objeto Date a clave ISO local 'YYYY-MM-DD'.
 */
export function formatDateToISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Devuelve la clave ISO ('YYYY-MM-DD') del día actual real del sistema.
 */
export function getTodayKey(): string {
  return formatDateToISO(new Date());
}

/**
 * Devuelve una clave ISO ('YYYY-MM-DD') desplazada `offsetDays` respecto a una fecha base (por defecto Hoy).
 */
export function getDateKeyWithOffset(offsetDays: number, baseDate: Date = new Date()): string {
  const dt = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate() + offsetDays,
    12,
    0,
    0
  );
  return formatDateToISO(dt);
}

/**
 * Parsea una clave ISO ('YYYY-MM-DD') devolviendo un objeto Date local al mediodía.
 */
export function parseISODate(isoKey: string): Date {
  const parts = isoKey.split('-').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  }
  return new Date();
}

export function createDayInfoFromDate(date: Date, now: Date = new Date()): DayInfo {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const dow = date.getDay();

  const isoDate = formatDateToISO(date);
  const isToday =
    y === now.getFullYear() &&
    m === now.getMonth() &&
    d === now.getDate();

  const todayMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const currentMidnight = new Date(y, m, d).getTime();
  const isPast = currentMidnight < todayMidnight;

  const dayName = DAY_NAMES_SHORT[dow];
  const dayNum = String(d).padStart(2, '0');
  const monthShort = MONTH_NAMES_SHORT[m];
  const monthFull = MONTH_NAMES_FULL[m];
  const fullTitle = `${DAY_NAMES_FULL[dow]} ${d} de ${monthFull} ${y}${
    isToday ? ' (Hoy)' : ''
  }`;

  return {
    key: isoDate,
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
 * Genera dinámicamente 7 días pasados + hoy + 365 días futuros con claves ISO ('YYYY-MM-DD')
 * tomando como referencia la fecha real del sistema (`new Date()`).
 */
export function generateDaysRange(startOffset = -7, endOffset = 365): DayInfo[] {
  const now = new Date();
  const list: DayInfo[] = [];
  for (let offset = startOffset; offset <= endOffset; offset++) {
    const dt = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + offset,
      12,
      0,
      0
    );
    list.push(createDayInfoFromDate(dt, now));
  }
  return list;
}

export const INITIAL_DAYS: DayInfo[] = generateDaysRange(-7, 365);

export const SMART_SLOTS_PRESETS = [
  { startTime: '12:00', endTime: '12:30', label: 'Tras reunión actual', startQ: 48, quarters: 2 },
  { startTime: '16:00', endTime: '16:30', label: 'Tarde libre', startQ: 64, quarters: 2 },
  { startTime: '19:00', endTime: '19:30', label: 'Fin de jornada', startQ: 76, quarters: 2 },
] as const;
