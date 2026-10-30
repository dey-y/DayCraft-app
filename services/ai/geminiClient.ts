/**
 * Servicio de Inteligencia Artificial — Google Gemini API + Parser Local Determinista
 * Modo Dual Inteligente:
 * 1. Si existe `EXPO_PUBLIC_GEMINI_API_KEY`, realiza extracción estructurada JSON con Gemini 2.0 Flash.
 * 2. Si no hay API Key o el usuario está 100% Offline, ejecuta el motor NLP local instantáneo.
 */

export type IntakeIntentKind = 'question' | 'event' | 'reminder' | 'idea' | 'pending';

export interface ParsedIntakeAction {
  kind: IntakeIntentKind;
  title: string;
  desc?: string;
  dayKey?: string;        // '27' (Hoy), '28' (Miércoles), '30' (Viernes), etc.
  startQ?: number;        // Cuarto de hora (0..95)
  quarters?: number;      // Duración en bloques de 15m (default 2 = 30m)
  ideaGroupId?: string;   // 'grp-app' | 'grp-nutrition' | 'grp-sparks'
  aiReply: string;
}

const DAY_KEYWORDS: Record<string, { key: string; label: string }> = {
  hoy: { key: '27', label: 'Hoy (Martes 27)' },
  martes: { key: '27', label: 'Martes 27' },
  mañana: { key: '28', label: 'Mañana (Miércoles 28)' },
  miercoles: { key: '28', label: 'Miércoles 28' },
  miércoles: { key: '28', label: 'Miércoles 28' },
  jueves: { key: '29', label: 'Jueves 29' },
  viernes: { key: '30', label: 'Viernes 30' },
  sabado: { key: '31', label: 'Sábado 31' },
  sábado: { key: '31', label: 'Sábado 31' },
  domingo: { key: '01', label: 'Domingo 1' },
};

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
    .replace(/^(recuérdame|recuerdame|agendar|agenda|añadir|anadir|idea:|idea|proyecto:|tengo que|hoy tengo que|cuando pueda)\s+/i, '')
    .replace(/\s+(hoy|cuando pueda hoy|cuando pueda)$/i, '')
    .trim();

  if (!cleaned) cleaned = raw.trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Parser Local Determinista (0ms latencia, 100% Offline)
 */
export function parseIntakeLocally(rawText: string, activeDayKey = '27'): ParsedIntakeAction {
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
        'He revisado tu jornada de hoy: tienes 1 bloque agendado a las 11:30h ("Revisar informe de gastos") y toda la tarde despejada desde las 12:00h para avanzar sin estrés.',
    };
  }

  // 2. ¿Es una Idea para el Cajón de Ideas?
  if (
    lower.startsWith('idea') ||
    lower.includes('ocurrencia') ||
    lower.includes('proyecto') ||
    lower.includes('app ') ||
    lower.includes('receta') ||
    lower.includes('automatizar')
  ) {
    let groupId = 'grp-sparks';
    let groupName = 'Chispazos Libres';
    if (lower.includes('app') || lower.includes('móvil') || lower.includes('movil') || lower.includes('código') || lower.includes('ui')) {
      groupId = 'grp-app';
      groupName = 'Proyecto: Mi App Móvil';
    } else if (lower.includes('receta') || lower.includes('comida') || lower.includes('nutrición') || lower.includes('nevera') || lower.includes('despensa')) {
      groupId = 'grp-nutrition';
      groupName = 'Cocina & Nutrición';
    }

    const title = cleanTaskTitle(text);
    return {
      kind: 'idea',
      title,
      desc: 'Capturada desde Smart Intake y auto-agrupada por temática.',
      ideaGroupId: groupId,
      aiReply: `He guardado la idea "${title}" dentro de la carpeta "${groupName}".`,
    };
  }

  // Detectar día mencionado
  let targetDayKey = activeDayKey;
  let targetDayLabel = 'Hoy';
  for (const [kw, info] of Object.entries(DAY_KEYWORDS)) {
    if (lower.includes(kw)) {
      targetDayKey = info.key;
      targetDayLabel = info.label;
      break;
    }
  }

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
        .replace(/(?:el\s+)?(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|hoy|mañana)/gi, '')
        .replace(/(?:a las\s+|las\s+)\d{1,2}(?::\d{2})?\s*(?:h|hs|horas)?/gi, '')
    );

    return {
      kind: isReminder ? 'reminder' : 'event',
      title: title || cleanTaskTitle(text),
      desc: isReminder ? 'Recordatorio puntual fijado por IA' : 'Bloque enfocado fijado por Smart Intake',
      dayKey: targetDayKey,
      startQ: extractedTime.startQ,
      quarters: 2, // 30 min por defecto
      aiReply: `He agendado "${title}" en el Timeline del ${targetDayLabel} a las ${extractedTime.timeStr}.`,
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
 * Cliente Inteligente: Intenta usar Google Gemini API si `EXPO_PUBLIC_GEMINI_API_KEY` está definida,
 * y cae de forma transparente al parser local determinista si no hay clave o falla la red.
 */
export async function processSmartIntake(
  rawText: string,
  activeDayKey = '27'
): Promise<ParsedIntakeAction> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    return parseIntakeLocally(rawText, activeDayKey);
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Eres el motor de DayCraft AI. Clasifica esta entrada del usuario en JSON estricto con las propiedades:
                  kind ("pending" | "event" | "reminder" | "idea" | "question"),
                  title (string corto y limpio),
                  dayKey ("27" para hoy martes, "28" miércoles, "29" jueves, "30" viernes, "31" sábado, "01" domingo),
                  startQ (número 0..95 representando cuartos de hora desde 00:00 si hay hora explícita, ej 11:30 = 46),
                  quarters (duración en cuartos de 15m, default 2),
                  ideaGroupId ("grp-app" | "grp-nutrition" | "grp-sparks"),
                  aiReply (respuesta breve y empática en español).
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
      return parseIntakeLocally(rawText, activeDayKey);
    }

    const json = await response.json();
    const contentText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!contentText) {
      return parseIntakeLocally(rawText, activeDayKey);
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
    return parseIntakeLocally(rawText, activeDayKey);
  }
}
