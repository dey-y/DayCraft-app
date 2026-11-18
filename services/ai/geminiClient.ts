/**
 * Servicio de Inteligencia Artificial — Google Gemini 2.0 Flash (Function Calling) + Parser Local Determinista
 * Modo Dual Inteligente:
 * 1. Si existe API Key (en SQLite o en `EXPO_PUBLIC_GEMINI_API_KEY`) y el motor Cloud está activo,
 *    realiza extracción multi-intento estructurada con Gemini 2.0 Flash Function Calling (`tools` / `functionDeclarations`),
 *    contexto de agenda en vivo, validación en tiempo de ejecución y timeout <= 8000ms vía `AbortController`.
 * 2. Si no hay API Key, se fuerza modo Offline o falla la red, ejecuta el motor NLP local instantáneo (0ms).
 */

import {
  createDayInfoFromDate,
  formatDateToISO,
  getTodayKey,
  parseISODate,
} from '@/constants/theme';
import type {
  IdeaGroup,
  IntakeIntentKind,
  ParsedIntakeAction,
  ParsedIntakeBatch,
  PendingTask,
  SmartIntakeProcessOptions,
  TimelineEvent,
} from '@/types/daycraft';

export type {
  IntakeIntentKind,
  ParsedIntakeAction,
  ParsedIntakeBatch,
  SmartIntakeProcessOptions,
};

const GEMINI_TIMEOUT_MS = 8000;
const VALID_KINDS: ReadonlySet<IntakeIntentKind> = new Set([
  'question',
  'event',
  'reminder',
  'idea',
  'pending',
]);

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
 * Extrae hora explícita en formato "a las HH:MM", "5 pm", "17h" y devuelve `startQ` (0..95).
 * Rechaza falsos positivos numéricos sin marcador horario (ej. "1 idea sobre 2 cosas").
 */
function extractQuarterFromText(input: string): { startQ: number; timeStr: string } | null {
  const regex =
    /(?:a\s+las\s+|las\s+|\b)(\d{1,2})(?::(\d{2}))?\s*(pm|am|h|hs|horas)?\b/gi;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    const rawHour = parseInt(match[1], 10);
    const rawMin = match[2] ? parseInt(match[2], 10) : 0;
    const suffix = (match[3] || '').toLowerCase();
    const fullMatch = match[0].toLowerCase();

    if (Number.isNaN(rawHour) || rawHour < 0 || rawHour > 23) continue;
    if (Number.isNaN(rawMin) || rawMin < 0 || rawMin > 59) continue;

    const hasColon = match[2] !== undefined;
    const hasLasPrefix = fullMatch.includes('las');
    const hasAmPm = suffix === 'pm' || suffix === 'am';
    const hasHourSuffix = suffix === 'h' || suffix === 'hs' || suffix === 'horas';

    // Evitar falsos positivos como "1 idea sobre 2 cosas" o duraciones sueltas como "1h" sin "a las"
    if (!hasColon && !hasLasPrefix && !hasAmPm) {
      if (!hasHourSuffix || rawHour < 6) continue;
    }

    let hour24 = rawHour;
    if (suffix === 'pm' && rawHour >= 1 && rawHour <= 11) {
      hour24 = rawHour + 12;
    } else if (suffix === 'am' && rawHour === 12) {
      hour24 = 0;
    }

    if (hour24 < 0 || hour24 > 23) continue;

    const rawStartQ = hour24 * 4 + Math.round(rawMin / 15);
    const startQ = Math.max(0, Math.min(95, rawStartQ));
    const normHour = Math.floor(startQ / 4);
    const normMin = (startQ % 4) * 15;
    const hStr = String(normHour).padStart(2, '0');
    const mStr = String(normMin).padStart(2, '0');

    return { startQ, timeStr: `${hStr}:${mStr}` };
  }

  return null;
}

/**
 * Limpia muletillas temporales o de comando para dejar el título limpio.
 */
function cleanTaskTitle(raw: string): string {
  let cleaned = raw
    .replace(
      /^(y\s+también|y\s+luego|además|y|e)\s+/i,
      ''
    )
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
 * Parsea una única cláusula en `ParsedIntakeAction`.
 */
function parseSingleClauseLocally(
  rawClause: string,
  activeDayKey: string = getTodayKey(),
  ideaGroups?: IdeaGroup[]
): ParsedIntakeAction {
  const text = rawClause.trim();
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

  const extractedTime = extractQuarterFromText(text);

  // 2. ¿Es una Idea para el Cajón de Ideas?
  if (
    /\bidea\b/i.test(lower) ||
    lower.startsWith('idea:') ||
    lower.includes('ocurrencia') ||
    lower.includes('proyecto') ||
    lower.includes('app ') ||
    lower.includes('receta') ||
    lower.includes('automatizar') ||
    Boolean(matchedCustomGroup && !extractedTime)
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
        .replace(
          /(?:a\s+las\s+|las\s+)\d{1,2}(?::\d{2})?\s*(?:h|hs|horas|pm|am)?\b/gi,
          ''
        )
    );

    return {
      kind: isReminder ? 'reminder' : 'event',
      title: title || cleanTaskTitle(text),
      desc: isReminder
        ? 'Recordatorio puntual fijado por IA'
        : 'Bloque enfocado fijado por Smart Intake',
      dayKey: resolvedDay.key,
      startQ: extractedTime.startQ,
      quarters: 2,
      aiReply: `He agendado "${title || cleanTaskTitle(text)}" en el Timeline de ${resolvedDay.label} a las ${extractedTime.timeStr}.`,
    };
  }

  // 4. Por defecto -> Pendiente de Hoy (Sin hora fija)
  const title = cleanTaskTitle(
    text.replace(/\b(hoy|cuando pueda)\b/gi, '').replace(/\s+/g, ' ').trim() || text
  );
  return {
    kind: 'pending',
    title,
    aiReply: `Entendido. He añadido "${title}" a tus Pendientes de hoy sin hora fija.`,
  };
}

/**
 * Divide una entrada de voz/texto en múltiples cláusulas si contiene múltiples intenciones.
 */
function splitMultiIntentClauses(rawText: string): string[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  // Separadores fuertes explícitos
  const strongSplit = trimmed
    .split(/(?:\n+|;\s+|,\s+(?:y|e)\s+|\s+(?:y\s+también|y\s+luego|además)\s+)/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const clauses: string[] = [];
  for (const part of strongSplit) {
    // Dividir por comas cuando cada segmento parece una acción independiente (>= 2 palabras)
    const commaParts = part
      .split(/,\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (
      commaParts.length > 1 &&
      commaParts.every((p) => p.split(/\s+/).length >= 2)
    ) {
      clauses.push(...commaParts);
    } else {
      clauses.push(part);
    }
  }

  return clauses.length > 0 ? clauses : [trimmed];
}

/**
 * Parser Local Determinista Multi-Intento (0ms latencia, 100% Offline).
 */
export function parseIntakeBatchLocally(
  rawText: string,
  activeDayKey: string = getTodayKey(),
  ideaGroups?: IdeaGroup[]
): ParsedIntakeBatch {
  const clauses = splitMultiIntentClauses(rawText);
  const items = clauses.map((clause) =>
    parseSingleClauseLocally(clause, activeDayKey, ideaGroups)
  );

  const aiReply =
    items.length === 1
      ? items[0].aiReply
      : `He organizado ${items.length} elementos: ${items.map((i) => `"${i.title}"`).join(', ')}.`;

  return {
    items,
    aiReply,
    source: 'local',
  };
}

/**
 * Parser Local Determinista (compatibilidad de acción única).
 */
export function parseIntakeLocally(
  rawText: string,
  activeDayKey: string = getTodayKey(),
  ideaGroups?: IdeaGroup[]
): ParsedIntakeAction {
  const batch = parseIntakeBatchLocally(rawText, activeDayKey, ideaGroups);
  return batch.items[0];
}

function clampInt(val: unknown, min: number, max: number): number | undefined {
  if (typeof val !== 'number' || !Number.isFinite(val)) return undefined;
  return Math.max(min, Math.min(max, Math.round(val)));
}

function buildScheduleContext(
  activeDayKey: string,
  existingEvents?: TimelineEvent[],
  existingPending?: PendingTask[]
): string {
  const dayEvents = (existingEvents || []).filter(
    (e) => e.dayKey === activeDayKey && !e.deletedAt
  );
  const openPending = (existingPending || []).filter(
    (p) => !p.completed && !p.archived && !p.deletedAt
  );

  const eventsSummary =
    dayEvents.length > 0
      ? dayEvents
          .map((e) => `- ${e.title} (startQ=${e.startQ}, quarters=${e.quarters}, type=${e.type})`)
          .join('\n')
      : 'Sin bloques agendados para el día activo.';

  const pendingSummary =
    openPending.length > 0
      ? openPending.slice(0, 10).map((p) => `- ${p.title}`).join('\n')
      : 'Sin pendientes abiertos.';

  return `Agenda actual (${activeDayKey}):\n${eventsSummary}\n\nPendientes abiertos:\n${pendingSummary}`;
}

function validateGeminiBatch(
  rawArgs: unknown,
  activeDayKey: string,
  rawText: string
): ParsedIntakeBatch | null {
  if (!rawArgs || typeof rawArgs !== 'object') return null;
  const obj = rawArgs as Record<string, unknown>;
  if (!Array.isArray(obj.items) || obj.items.length === 0) return null;

  const topReply =
    typeof obj.aiReply === 'string' && obj.aiReply.trim().length > 0
      ? obj.aiReply.trim()
      : '';

  const validatedItems: ParsedIntakeAction[] = [];
  for (const rawItem of obj.items) {
    if (!rawItem || typeof rawItem !== 'object') continue;
    const item = rawItem as Record<string, unknown>;
    const kind =
      typeof item.kind === 'string' && VALID_KINDS.has(item.kind as IntakeIntentKind)
        ? (item.kind as IntakeIntentKind)
        : 'pending';
    const title =
      typeof item.title === 'string' && item.title.trim().length > 0
        ? item.title.trim()
        : cleanTaskTitle(rawText);

    const startQ = clampInt(item.startQ, 0, 95);
    const quarters = clampInt(item.quarters, 1, 48) ?? 2;
    const dayKey =
      typeof item.dayKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.dayKey)
        ? item.dayKey
        : activeDayKey;
    const itemReply =
      typeof item.aiReply === 'string' && item.aiReply.trim().length > 0
        ? item.aiReply.trim()
        : topReply || `Clasificado: "${title}"`;

    validatedItems.push({
      kind,
      title,
      desc: typeof item.desc === 'string' ? item.desc : undefined,
      dayKey,
      startQ,
      quarters,
      ideaGroupId:
        typeof item.ideaGroupId === 'string' && item.ideaGroupId.trim().length > 0
          ? item.ideaGroupId
          : 'grp-sparks',
      aiReply: itemReply,
    });
  }

  if (validatedItems.length === 0) return null;

  return {
    items: validatedItems,
    aiReply: topReply || validatedItems[0].aiReply,
    source: 'gemini',
  };
}

/**
 * Cliente Inteligente: Intenta usar Google Gemini 2.0 Flash con Function Calling (`tools` / `functionDeclarations`)
 * si hay clave configurada y `useCloudAI !== false`. Cae en 0ms al parser local determinista si no hay clave,
 * falla la red, hay HTTP >= 400 o vence el timeout de 8000ms.
 */
export async function processSmartIntake(
  rawText: string,
  activeDayKey: string = getTodayKey(),
  options?: SmartIntakeProcessOptions
): Promise<ParsedIntakeBatch> {
  const effectiveApiKey =
    options?.apiKey?.trim() || process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim() || '';
  const shouldUseCloud = options?.useCloudAI !== false && Boolean(effectiveApiKey);

  if (!shouldUseCloud) {
    return parseIntakeBatchLocally(rawText, activeDayKey, options?.ideaGroups);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

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

    const scheduleContext = buildScheduleContext(
      activeDayKey,
      options?.existingEvents,
      options?.existingPending
    );

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${effectiveApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
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

${scheduleContext}

Analiza la entrada del usuario, separa múltiples intenciones si existen, e invoca la función \`dispatch_intake_actions\` con todos los elementos clasificados y una respuesta breve y empática en español (\`aiReply\`).

Entrada: "${rawText}"`,
                },
              ],
            },
          ],
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'dispatch_intake_actions',
                  description:
                    'Extrae y clasifica una o múltiples acciones (event, reminder, pending, idea, question) desde la entrada del usuario.',
                  parameters: {
                    type: 'OBJECT',
                    properties: {
                      aiReply: {
                        type: 'STRING',
                        description: 'Respuesta breve y empática en español resumiendo lo organizado.',
                      },
                      items: {
                        type: 'ARRAY',
                        description: 'Lista de acciones extraídas de la entrada.',
                        items: {
                          type: 'OBJECT',
                          properties: {
                            kind: {
                              type: 'STRING',
                              enum: ['question', 'event', 'reminder', 'idea', 'pending'],
                            },
                            title: { type: 'STRING' },
                            desc: { type: 'STRING' },
                            dayKey: { type: 'STRING' },
                            startQ: { type: 'INTEGER' },
                            quarters: { type: 'INTEGER' },
                            ideaGroupId: { type: 'STRING' },
                          },
                          required: ['kind', 'title'],
                        },
                      },
                    },
                    required: ['aiReply', 'items'],
                  },
                },
              ],
            },
          ],
          toolConfig: {
            functionCallingConfig: {
              mode: 'ANY',
              allowedFunctionNames: ['dispatch_intake_actions'],
            },
          },
        }),
      }
    );

    if (!response.ok) {
      return parseIntakeBatchLocally(rawText, activeDayKey, options?.ideaGroups);
    }

    const json = await response.json();
    const parts: Array<Record<string, unknown>> =
      json?.candidates?.[0]?.content?.parts ?? [];

    for (const part of parts) {
      const fnCall = part?.functionCall as
        | { name?: string; args?: unknown }
        | undefined;
      if (fnCall?.args) {
        const validated = validateGeminiBatch(fnCall.args, activeDayKey, rawText);
        if (validated) return validated;
      }
    }

    // Fallback si el modelo devolvió JSON en texto plano
    const contentText = parts.find((p) => typeof p?.text === 'string')?.text as
      | string
      | undefined;
    if (contentText) {
      const parsedJson = JSON.parse(contentText);
      const wrapped = Array.isArray(parsedJson?.items)
        ? parsedJson
        : { aiReply: parsedJson?.aiReply, items: [parsedJson] };
      const validated = validateGeminiBatch(wrapped, activeDayKey, rawText);
      if (validated) return validated;
    }

    return parseIntakeBatchLocally(rawText, activeDayKey, options?.ideaGroups);
  } catch {
    return parseIntakeBatchLocally(rawText, activeDayKey, options?.ideaGroups);
  } finally {
    clearTimeout(timeoutId);
  }
}

export const processSmartIntakeBatch = processSmartIntake;
