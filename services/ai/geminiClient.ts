/**
 * Servicio de Inteligencia Artificial — Google Gemini API + Parser Local Determinista
 * Modo Dual Inteligente:
 * 1. Si existe API Key (en SQLite o en `EXPO_PUBLIC_GEMINI_API_KEY`) y el motor Cloud está activo,
 *    realiza extracción estructurada JSON con Gemini 2.0 Flash.
 * 2. Si no hay API Key, se fuerza modo Offline o falla la red, ejecuta el motor NLP local instantáneo.
 */

import {
  createDayInfoFromDate,
  formatDateToISO,
  getTodayKey,
  parseISODate,
} from '@/constants/theme';
import { IdeaGroup } from '@/services/db/sqlite';

export type IntakeIntentKind = 'question' | 'event' | 'reminder' | 'idea' | 'pending';

export interface ParsedIntakeAction {
  kind: IntakeIntentKind;
  title: string;
  desc?: string;
  dayKey?: string;        // Clave ISO 'YYYY-MM-DD'
  startQ?: number;        // Cuarto de hora (0..95)
  quarters?: number;      // Duración en bloques de 15m (default 2 = 30m)
  ideaGroupId?: string;   // ID del grupo de proyecto en Cajón de Ideas
  aiReply: string;
}

export interface SmartIntakeProcessOptions {
  apiKey?: string;
  useCloudAI?: boolean;
  ideaGroups?: IdeaGroup[];
}

const WEEKDAY_TARGETS: { pattern: RegExp; targetDow: number }[] = [
  { pattern: /\b(domingo)\b/i, targetDow: 0 },
  { pattern: /\b(lunes)\b/i, targetDow: 1 },
  { pattern: /\b(martes)\b/i, targetDow: 2 },
  { pattern: /\b(miércoles|miercoles)\b/i, targetDow: 3 },
  { pattern: /\b(jueves)\b/i, targetDow: 4 },
  { pattern: /\b(viernes)\b/i, targetDow: 5 },
  { pattern: /\b(sábado|sabado)\b/i, targetDow: 6 },
];

/**
 * Resuelve referencias temporales relativas ("hoy", "mañana", "pasado mañana", "lunes"..."domingo")
 * tomando como referencia la fecha activa (`activeDayKey`) o la fecha actual del sistema.
 */
export function resolveDynamicDayFromText(
  text: string,
  activeDayKey: string = getTodayKey()
): { key: string; label: string } {
  const lower = text.toLowerCase();
  const baseDate = parseISODate(activeDayKey);
  const todayDate = new Date();
  todayDate.setHours(12, 0, 0, 0);

  if (/\bpasado\s+mañana\b/i.test(lower)) {
    const dt = new Date(
      todayDate.getFullYear(),
      todayDate.getMonth(),
      todayDate.getDate() + 2,
      12,
      0,
      0
    );
    const info = createDayInfoFromDate(dt, todayDate);
    return { key: info.key, label: `Pasado mañana (${info.dayName} ${info.dayNum})` };
  }

  if (/\bmañana\b/i.test(lower)) {
    const dt = new Date(
      todayDate.getFullYear(),
      todayDate.getMonth(),
      todayDate.getDate() + 1,
      12,
      0,
      0
    );
    const info = createDayInfoFromDate(dt, todayDate);
    return { key: info.key, label: `Mañana (${info.dayName} ${info.dayNum})` };
  }

  if (/\bhoy\b/i.test(lower)) {
    const info = createDayInfoFromDate(todayDate, todayDate);
    return { key: info.key, label: `Hoy (${info.dayName} ${info.dayNum})` };
  }

  for (const { pattern, targetDow } of WEEKDAY_TARGETS) {
    if (pattern.test(lower)) {
      const currentDow = baseDate.getDay();
      let delta = (targetDow - currentDow + 7) % 7;
      // Si menciona un día de la semana que coincide con hoy pero dice "el próximo", avanza 7 días
      if (delta === 0 && /\b(próximo|proximo|siguiente)\b/i.test(lower)) {
        delta = 7;
      }
      const targetDate = new Date(
        baseDate.getFullYear(),
        baseDate.getMonth(),
        baseDate.getDate() + delta,
        12,
        0,
        0
      );
      const info = createDayInfoFromDate(targetDate, todayDate);
      return {
        key: info.key,
        label: `${info.dayName} ${info.dayNum} ${info.monthShort}`,
      };
    }
  }

  const fallbackInfo = createDayInfoFromDate(baseDate, todayDate);
  return {
    key: fallbackInfo.key,
    label: fallbackInfo.isToday
      ? `Hoy (${fallbackInfo.dayName} ${fallbackInfo.dayNum})`
      : `${fallbackInfo.dayName} ${fallbackInfo.dayNum} ${fallbackInfo.monthShort}`,
  };
}

/**
 * Extrae hora en formato "a las HH:MM" o "HHh" y devuelve `startQ` (0..95)
 */
function extractQuarterFromText(input: string): { startQ: number; timeStr: string } | null {
  const regex = /(?:a las\s+|las\s+|\b)(\d{1,2})(?::(\d{2}))?\s*(?:h|hs|horas|pm|am)?\b/i;
  const match = input.match(regex);
  if (!match) return null;

  const rawHour = parseInt(match[1], 10);
  const rawMin = match[2] ? parseInt(match[2], 10) : 0;
  if (isNaN(rawHour) || rawHour < 0 || rawHour > 23) return null;

  // Evitar falsos positivos como "1 idea" o "2 cosas" si no dice "a las" ni ":00" ni "h"
  const fullMatch = match[0].toLowerCase();
  const hasExplicitTimeMarker =
    fullMatch.includes('las') ||
    fullMatch.includes(':') ||
    fullMatch.includes('h') ||
    fullMatch.includes('pm') ||
    fullMatch.includes('am');

  if (!hasExplicitTimeMarker) return null;

  const quarterOffset = Math.round(rawMin / 15) % 4;
  const startQ = rawHour * 4 + quarterOffset;
  const hStr = String(rawHour).padStart(2, '0');
  const mStr = String(quarterOffset * 15).padStart(2, '0');

  return { startQ, timeStr: `${hStr}:${mStr}` };
}

/**
 * Limpia muletillas temporales o de comando para dejar el título limpio
 */
function cleanTaskTitle(raw: string): string {
  let cleaned = raw
    .replace(
      /^(recuérdame|recuerdame|agendar|agenda|añadir|anadir|idea:|idea|proyecto:|tengo que|hoy tengo que|cuando pueda)\s+/i,
      ''
    )
    .replace(/\s+(hoy|cuando pueda hoy|cuando pueda)$/i, '')
    .trim();

  if (!cleaned) cleaned = raw.trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Clasifica a qué carpeta de proyecto pertenece una idea, reconociendo tanto los grupos por defecto
 * como los nuevos grupos personalizados creados por el usuario.
 */
function matchIdeaGroup(lowerText: string, ideaGroups?: IdeaGroup[]): { id: string; title: string } {
  if (ideaGroups && ideaGroups.length > 0) {
    for (const grp of ideaGroups) {
      const normalizedTitle = grp.title.toLowerCase().replace(/^proyecto:\s*/i, '').trim();
      const words = normalizedTitle
        .split(/\s+/)
        .map((w) => w.replace(/[^a-záéíóúñ0-9]/gi, ''))
        .filter((w) => w.length >= 3);

      if (normalizedTitle && lowerText.includes(normalizedTitle)) {
        return { id: grp.id, title: grp.title };
      }
      for (const word of words) {
        if (lowerText.includes(word)) {
          return { id: grp.id, title: grp.title };
        }
      }
    }
  }

  if (
    lowerText.includes('app') ||
    lowerText.includes('móvil') ||
    lowerText.includes('movil') ||
    lowerText.includes('código') ||
    lowerText.includes('ui')
  ) {
    return { id: 'grp-app', title: 'Proyecto: Mi App Móvil' };
  }
  if (
    lowerText.includes('receta') ||
    lowerText.includes('comida') ||
    lowerText.includes('nutrición') ||
    lowerText.includes('nevera') ||
    lowerText.includes('despensa')
  ) {
    return { id: 'grp-nutrition', title: 'Cocina & Nutrición' };
  }

  const fallbackSparks = ideaGroups?.find((g) => g.id === 'grp-sparks') || ideaGroups?.[0];
  return {
    id: fallbackSparks?.id || 'grp-sparks',
    title: fallbackSparks?.title || 'Chispazos Libres',
  };
}

/**
 * Parser Local Determinista (0ms latencia, 100% Offline)
 */
export function parseIntakeLocally(
  rawText: string,
  activeDayKey: string = getTodayKey(),
  ideaGroups?: IdeaGroup[]
): ParsedIntakeAction {
  const text = rawText.trim();
  const lower = text.toLowerCase();

  // 1. ¿Es una pregunta o consulta al Asistente?
  if (
    text.includes('?') ||
    lower.startsWith('qué ') ||
    lower.startsWith('que ') ||
    lower.startsWith('cómo ') ||
    lower.startsWith('como ') ||
    lower.startsWith('cuánto') ||
    lower.includes('resumen') ||
    lower.includes('briefing')
  ) {
    return {
      kind: 'question',
      title: text,
      aiReply:
        'He revisado tu jornada activa: tienes tu bloque enfocado en el Timeline 24h y la tarde despejada para avanzar sin estrés.',
    };
  }

  // Comprobar si menciona explícitamente el nombre de algún proyecto creado por el usuario
  const matchedCustomGroup = ideaGroups?.find((grp) => {
    const cleanName = grp.title.toLowerCase().replace(/^proyecto:\s*/i, '').trim();
    return cleanName.length >= 3 && lower.includes(cleanName);
  });

  // 2. ¿Es una Idea para el Cajón de Ideas?
  if (
    lower.startsWith('idea') ||
    lower.includes('ocurrencia') ||
    lower.includes('proyecto') ||
    lower.includes('app ') ||
    lower.includes('receta') ||
    lower.includes('automatizar') ||
    Boolean(matchedCustomGroup && !extractQuarterFromText(text))
  ) {
    const matchedGroup = matchIdeaGroup(lower, ideaGroups);
    const title = cleanTaskTitle(text);
    return {
      kind: 'idea',
      title,
      desc: 'Capturada desde Smart Intake y auto-agrupada por temática.',
      ideaGroupId: matchedGroup.id,
      aiReply: `He guardado la idea "${title}" dentro de la carpeta "${matchedGroup.title}".`,
    };
  }

  // Detectar día mencionado dinámicamente respecto a la fecha activa / hoy
  const resolvedDay = resolveDynamicDayFromText(text, activeDayKey);

  // 3. ¿Tiene una hora explícita? -> Evento Time-Blocked o Recordatorio Puntual
  const extractedTime = extractQuarterFromText(text);
  if (extractedTime) {
    const isReminder =
      lower.includes('recuérdame') ||
      lower.includes('recuerdame') ||
      lower.includes('avisar') ||
      lower.includes('llamar') ||
      lower.includes('pastilla') ||
      lower.includes('cita');

    const title = cleanTaskTitle(
      text
        .replace(
          /(?:el\s+)?(?:próximo\s+|proximo\s+)?(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|pasado\s+mañana|mañana|hoy)/gi,
          ''
        )
        .replace(/(?:a las\s+|las\s+)\d{1,2}(?::\d{2})?\s*(?:h|hs|horas|pm|am)?/gi, '')
    );

    return {
      kind: isReminder ? 'reminder' : 'event',
      title: title || cleanTaskTitle(text),
      desc: isReminder
        ? 'Recordatorio puntual fijado por IA'
        : 'Bloque enfocado fijado por Smart Intake',
      dayKey: resolvedDay.key,
      startQ: extractedTime.startQ,
      quarters: 2, // 30 min por defecto
      aiReply: `He agendado "${title || cleanTaskTitle(text)}" en el Timeline de ${resolvedDay.label} a las ${extractedTime.timeStr}.`,
    };
  }

  // 4. Por defecto -> Pendiente de Hoy (Sin hora fija)
  const title = cleanTaskTitle(text);
  return {
    kind: 'pending',
    title,
    aiReply: `Entendido. He añadido "${title}" a tus Pendientes de hoy sin hora fija.`,
  };
}

/**
 * Cliente Inteligente: Intenta usar Google Gemini API si hay clave configurada (en SQLite o en env)
 * y `useCloudAI !== false`. Cae de forma transparente al parser local determinista si no hay clave o falla la red.
 */
export async function processSmartIntake(
  rawText: string,
  activeDayKey: string = getTodayKey(),
  options?: SmartIntakeProcessOptions
): Promise<ParsedIntakeAction> {
  const effectiveApiKey =
    options?.apiKey?.trim() || process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim() || '';
  const shouldUseCloud = options?.useCloudAI !== false && Boolean(effectiveApiKey);

  if (!shouldUseCloud) {
    return parseIntakeLocally(rawText, activeDayKey, options?.ideaGroups);
  }

  try {
    const todayDate = new Date();
    const todayISO = formatDateToISO(todayDate);
    const upcomingCalendarContext: string[] = [];
    for (let i = 0; i <= 7; i++) {
      const dt = new Date(
        todayDate.getFullYear(),
        todayDate.getMonth(),
        todayDate.getDate() + i,
        12,
        0,
        0
      );
      const info = createDayInfoFromDate(dt, todayDate);
      const prefix = i === 0 ? 'HOY' : i === 1 ? 'MAÑANA' : info.dayName;
      upcomingCalendarContext.push(`${prefix} (${info.fullTitle}) => "${info.key}"`);
    }

    const availableGroupsContext =
      options?.ideaGroups && options.ideaGroups.length > 0
        ? options.ideaGroups.map((g) => `"${g.id}" (${g.title}: ${g.subtitle})`).join(', ')
        : '"grp-app" (Proyecto: Mi App Móvil), "grp-nutrition" (Cocina & Nutrición), "grp-sparks" (Chispazos Libres)';

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${effectiveApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Eres el motor de DayCraft AI.
Fecha actual real (Hoy): "${todayISO}".
Día actualmente seleccionado por el usuario: "${activeDayKey}".
Calendario de referencia próximos 7 días:
${upcomingCalendarContext.join('\n')}

Grupos de proyectos disponibles en el Cajón de Ideas:
${availableGroupsContext}

Clasifica esta entrada del usuario en JSON estricto con las propiedades:
- kind ("pending" | "event" | "reminder" | "idea" | "question")
- title (string corto y limpio sin muletillas de hora/día)
- dayKey (string clave ISO "YYYY-MM-DD" resolviendo "hoy", "mañana", "lunes", "viernes", etc. según el calendario de referencia superior; por defecto "${activeDayKey}")
- startQ (número 0..95 representando cuartos de hora desde 00:00 si hay hora explícita, ej 11:30 = 46)
- quarters (duración en cuartos de 15m, default 2)
- ideaGroupId (ID del grupo más afín entre: ${availableGroupsContext})
- aiReply (respuesta breve y empática en español)

Entrada: "${rawText}"`,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      return parseIntakeLocally(rawText, activeDayKey, options?.ideaGroups);
    }

    const json = await response.json();
    const contentText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!contentText) {
      return parseIntakeLocally(rawText, activeDayKey, options?.ideaGroups);
    }

    const parsed = JSON.parse(contentText) as ParsedIntakeAction;
    return {
      kind: parsed.kind || 'pending',
      title: parsed.title || cleanTaskTitle(rawText),
      desc: parsed.desc,
      dayKey: parsed.dayKey || activeDayKey,
      startQ: typeof parsed.startQ === 'number' ? parsed.startQ : undefined,
      quarters: parsed.quarters || 2,
      ideaGroupId: parsed.ideaGroupId || 'grp-sparks',
      aiReply: parsed.aiReply || `Clasificado: "${parsed.title}"`,
    };
  } catch {
    return parseIntakeLocally(rawText, activeDayKey, options?.ideaGroups);
  }
}
