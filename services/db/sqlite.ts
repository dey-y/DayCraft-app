import { Platform } from 'react-native';
import type * as SQLite from 'expo-sqlite';

export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly';

export interface EventRecurrenceRule {
  frequency: RecurrenceFrequency;
  daysOfWeek?: string[]; // ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'] cuando frequency === 'weekly'
  dayNumOfMonth?: string; // '27', '01', etc. cuando frequency === 'monthly'
}

export interface TimelineEvent {
  id: string;
  dayKey: string;         // ej. '27', '28', '30' o fecha ISO '2026-11-03'
  title: string;
  desc?: string;
  startQ: number;         // Cuarto de hora inicial (0..95). Ej: 11:30 = 11*4 + 2 = 46
  quarters: number;       // Duración en cuartos de hora (1 = 15m, 2 = 30m, 6 = 1h30m)
  type: 'task' | 'reminder';
  tag?: string;
  completed?: boolean;
  recurrence?: EventRecurrenceRule;
}

export interface PendingTask {
  id: string;
  title: string;
  completed: boolean;
  isFromYesterday: boolean;
  rolloverDays: number;   // Regla de los 3 días (0..3)
  createdAt: string;
}

export interface IdeaItemData {
  id: string;
  groupId: string;
  title: string;
  desc: string;
  markdownContent?: string; // Documento completo .md editable y exportable
  createdAtLabel: string;
  daysInactive: number;
  suggestedAction?: string;
}

export interface IdeaGroup {
  id: string;
  title: string;
  subtitle: string;
  icon: 'smartphone' | 'cup' | 'sparkle' | 'folder' | 'lightbulb';
  accentColor: 'indigo' | 'emerald' | 'amber';
  items: IdeaItemData[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  classifiedItems?: {
    type: 'event' | 'reminder' | 'pending' | 'idea';
    title: string;
    meta: string;
  }[];
}

export interface AppAlert {
  id: string;
  type: 'rollover' | 'inactive_idea';
  title: string;
  subtitle: string;
  badgeText: string;
  relatedId?: string;
}

// Datos semilla iniciales basados fielmente en los prototipos v9
export const SEED_EVENTS: TimelineEvent[] = [
  {
    id: 'ev-1',
    dayKey: '27',
    title: 'Revisar informe de gastos mensual',
    desc: 'Bloque enfocado con comprobantes',
    startQ: 46, // 11:30
    quarters: 2, // 30 min (11:30 - 12:00)
    type: 'task',
    tag: 'Finanzas',
    completed: false,
  },
  {
    id: 'ev-2',
    dayKey: '28',
    title: 'Llamar al dentista',
    desc: 'Recordatorio puntual de revisión anual',
    startQ: 68, // 17:00
    quarters: 2, // 30 min
    type: 'reminder',
    tag: 'Salud',
    completed: false,
  },
  {
    id: 'ev-3',
    dayKey: '30',
    title: 'Planificar sprint de la app',
    desc: 'Diseño backlog en Expo y NativeWind',
    startQ: 40, // 10:00
    quarters: 6, // 1h 30m (10:00 - 11:30)
    type: 'task',
    tag: 'Mi App Móvil',
    completed: false,
  },
];

export const SEED_PENDING: PendingTask[] = [
  {
    id: 'pending-1',
    title: 'Comprar pilas para el mando',
    completed: false,
    isFromYesterday: true,
    rolloverDays: 1,
    createdAt: 'Ayer',
  },
  {
    id: 'pending-2',
    title: 'Llamar a Carlos por presupuesto',
    completed: false,
    isFromYesterday: false,
    rolloverDays: 0,
    createdAt: 'Hoy',
  },
];

export const SEED_IDEA_GROUPS: IdeaGroup[] = [
  {
    id: 'grp-app',
    title: 'Proyecto: Mi App Móvil',
    subtitle: 'DayCraft con React Native',
    icon: 'smartphone',
    accentColor: 'indigo',
    items: [
      {
        id: 'idea-1',
        groupId: 'grp-app',
        title: 'App sin fricción para organizar el día',
        desc: 'Eliminar la pereza inicial: dictas por voz y la IA separa tareas agendadas, pendientes e ideas.',
        markdownContent: `# App sin fricción para organizar el día\n\n## Objetivo Principal\nEliminar la pereza de rellenar formularios complejos al agendar el día.\n\n## Puntos Clave\n- [x] Captura única omnidireccional (Smart Intake)\n- [x] Clasificación automática por IA (Gemini)\n- [ ] Widget nativo de captura rápida por voz\n\n## Notas Técnicas\nUsar \`expo-sqlite\` para persistencia local y exportación directa a Markdown \`.md\`.`,
        createdAtLabel: 'Hace 2 días',
        daysInactive: 2,
        suggestedAction: 'Definir wireframes entrada por voz',
      },
      {
        id: 'idea-2',
        groupId: 'grp-app',
        title: 'Sincronización Offline con SQLite',
        desc: 'Poder registrar notas y bloques en el metro sin cobertura móvil.',
        markdownContent: `# Sincronización Offline con SQLite\n\n## Arquitectura Local-First\n1. Guardar cada cambio inmediatamente en SQLite (\`daycraft_v9.db\`).\n2. Encolar mutaciones cuando no haya red.\n3. Permitir exportar cualquier idea como archivo \`.md\` independiente.`,
        createdAtLabel: 'Hoy',
        daysInactive: 0,
        suggestedAction: 'Configurar tablas expo-sqlite',
      },
      {
        id: 'idea-3',
        groupId: 'grp-app',
        title: 'Iconografía 100% Notion Icons',
        desc: 'Cero emojis estridentes. Trazos vectoriales limpios (stroke 1.8) en toda la interfaz.',
        markdownContent: `# Iconografía 100% Notion Icons\n\n- Trazo uniforme \`strokeWidth: 1.8\`\n- Paleta monocroma oscura (\`#0d1117\`, \`#161922\`, \`#1f2430\`)\n- Sin iconos multicolores que generen fatiga visual.`,
        createdAtLabel: 'Hace 10m',
        daysInactive: 0,
        suggestedAction: 'Revisar catálogo NotionIcons',
      },
    ],
  },
  {
    id: 'grp-nutrition',
    title: 'Cocina & Nutrición',
    subtitle: 'Ideas de despensa y comidas',
    icon: 'cup',
    accentColor: 'emerald',
    items: [
      {
        id: 'idea-4',
        groupId: 'grp-nutrition',
        title: 'Gestor de despensa semanal con IA',
        desc: 'Sugerir recetas rápidas basadas únicamente en los ingredientes que están por caducar.',
        createdAtLabel: 'Hace 4 días',
        daysInactive: 4,
        suggestedAction: 'Investigar API de escaneo de tickets',
      },
    ],
  },
  {
    id: 'grp-sparks',
    title: 'Chispazos Libres',
    subtitle: 'Pendientes de convertir en proyecto',
    icon: 'sparkle',
    accentColor: 'amber',
    items: [
      {
        id: 'idea-5',
        groupId: 'grp-sparks',
        title: 'Automatizador de presupuestos y facturas',
        desc: 'Descargar PDFs de facturas desde Gmail a Sheets de forma desatendida.',
        createdAtLabel: 'Hace 12 días',
        daysInactive: 12,
        suggestedAction: 'Explorar Automatizador (30m)',
      },
    ],
  },
];

export const SEED_CHAT: ChatMessage[] = [
  {
    id: 'msg-1',
    role: 'assistant',
    text: '¡Hola! Dime lo que tienes en mente: tareas con horario, recordatorios puntuales, pendientes para hoy sin hora fija o ideas para tus proyectos.',
    timestamp: '09:40',
  },
  {
    id: 'msg-2',
    role: 'user',
    text: 'Recuérdame el miércoles a las 17:00 llamar al dentista, y hoy tengo que comprar pilas para el mando',
    timestamp: '09:41',
  },
  {
    id: 'msg-3',
    role: 'assistant',
    text: 'Clasificado exactamente sin fricción:',
    timestamp: '09:41',
    classifiedItems: [
      {
        type: 'reminder',
        title: 'Llamar al dentista',
        meta: 'Miércoles 17:00',
      },
      {
        type: 'pending',
        title: 'Comprar pilas para el mando',
        meta: 'Para hoy (Sin hora)',
      },
    ],
  },
];

export const SEED_ALERTS: AppAlert[] = [
  {
    id: 'alert-1',
    type: 'rollover',
    title: '"Comprar pilas para el mando"',
    subtitle: 'Se movió automáticamente a tus pendientes de hoy (1/3 días).',
    badgeText: 'Ayer · 1/3 días',
    relatedId: 'pending-1',
  },
  {
    id: 'alert-2',
    type: 'inactive_idea',
    title: '"Automatizador de presupuestos"',
    subtitle: 'Lleva 12 días en el cajón sin tocarse. ¿La retomamos hoy a las 16:00 o la archivamos?',
    badgeText: '12 días inactiva',
    relatedId: 'idea-5',
  },
];

let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Inicializa SQLite en dispositivos nativos y persiste cambios de forma transparente.
 * En Web realiza fallback seguro a localStorage para evitar bloqueos de cabeceras WASM COOP/COEP.
 */
export async function initDatabase(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SQLiteModule = require('expo-sqlite') as typeof SQLite;
    dbInstance = await SQLiteModule.openDatabaseAsync('daycraft_v9.db');
    await dbInstance.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS kv_store (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
  } catch (err) {
    console.warn('[DayCraft SQLite] Fallback en memoria activo:', err);
  }
}

export async function savePersistedState(key: string, data: unknown): Promise<void> {
  const serialized = JSON.stringify(data);
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(`daycraft_${key}`, serialized);
      }
    } catch {
      // ignore storage errors
    }
    return;
  }
  if (!dbInstance) return;
  try {
    await dbInstance.runAsync(
      'INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)',
      key,
      serialized
    );
  } catch (err) {
    console.warn('[DayCraft SQLite] Error guardando estado:', err);
  }
}

export async function loadPersistedState<T>(key: string): Promise<T | null> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(`daycraft_${key}`);
        return raw ? (JSON.parse(raw) as T) : null;
      }
    } catch {
      return null;
    }
    return null;
  }
  if (!dbInstance) return null;
  try {
    const row = await dbInstance.getFirstAsync<{ value: string }>(
      'SELECT value FROM kv_store WHERE key = ?',
      key
    );
    return row ? (JSON.parse(row.value) as T) : null;
  } catch {
    return null;
  }
}
