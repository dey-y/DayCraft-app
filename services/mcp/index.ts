/**
 * DayCraft AI — Headless Model Context Protocol (MCP) Server
 * Operates directly over `DayCraftRepository` with ZERO `react-native` or `expo-*` imports.
 */

import { getTodayKey } from '@/constants/theme';
import { processSmartIntake } from '@/services/ai/geminiClient';
import type {
  DayCraftRepository,
  IdeaItemData,
  PendingTask,
  TimelineEvent,
} from '@/types/daycraft';

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export interface McpResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface McpResourceResult {
  contents: Array<{ uri: string; mimeType: string; text: string }>;
  isError?: boolean;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'list_events',
    description: 'Lista los bloques de tiempo y recordatorios del Timeline 24h.',
    inputSchema: {
      type: 'object',
      properties: {
        dayKey: { type: 'string', description: 'Fecha ISO YYYY-MM-DD (opcional)' },
      },
    },
  },
  {
    name: 'create_event',
    description: 'Crea un nuevo bloque de tiempo o recordatorio en el Timeline 24h.',
    inputSchema: {
      type: 'object',
      properties: {
        dayKey: { type: 'string' },
        title: { type: 'string' },
        startQ: { type: 'integer', minimum: 0, maximum: 95 },
        quarters: { type: 'integer', minimum: 1, maximum: 96 },
        type: { type: 'string', enum: ['task', 'reminder'] },
        desc: { type: 'string' },
        tag: { type: 'string' },
      },
      required: ['title', 'startQ'],
    },
  },
  {
    name: 'update_event',
    description: 'Actualiza un bloque existente en el Timeline 24h.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        dayKey: { type: 'string' },
        startQ: { type: 'integer', minimum: 0, maximum: 95 },
        quarters: { type: 'integer', minimum: 1, maximum: 96 },
        type: { type: 'string', enum: ['task', 'reminder'] },
        desc: { type: 'string' },
        completed: { type: 'boolean' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_event',
    description: 'Elimina un bloque del Timeline 24h por ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_pending',
    description: 'Lista las tareas pendientes sin hora fija.',
    inputSchema: {
      type: 'object',
      properties: {
        includeArchived: { type: 'boolean' },
      },
    },
  },
  {
    name: 'add_pending',
    description: 'Añade una nueva tarea pendiente sin hora fija.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
      },
      required: ['title'],
    },
  },
  {
    name: 'complete_pending',
    description: 'Marca una tarea pendiente como completada o pendiente.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        completed: { type: 'boolean' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_ideas',
    description: 'Lista las ideas del Cajón de Ideas.',
    inputSchema: {
      type: 'object',
      properties: {
        groupId: { type: 'string' },
      },
    },
  },
  {
    name: 'create_idea',
    description: 'Crea una nueva idea/nota Markdown en un grupo del Cajón de Ideas.',
    inputSchema: {
      type: 'object',
      properties: {
        groupId: { type: 'string' },
        title: { type: 'string' },
        desc: { type: 'string' },
        markdownContent: { type: 'string' },
      },
      required: ['title'],
    },
  },
  {
    name: 'search_notes',
    description: 'Busca notas e ideas por texto en título, descripción o Markdown.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    },
  },
  {
    name: 'smart_intake',
    description: 'Procesa una entrada en lenguaje natural con el parser Smart Intake y persiste las acciones.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        dayKey: { type: 'string' },
      },
      required: ['text'],
    },
  },
  {
    name: 'get_daily_briefing',
    description: 'Obtiene el resumen diario de eventos, pendientes, alertas e ideas.',
    inputSchema: {
      type: 'object',
      properties: {
        dayKey: { type: 'string' },
      },
    },
  },
];

const MCP_RESOURCES: McpResourceDefinition[] = [
  {
    uri: 'daycraft://timeline/today',
    name: 'Today Timeline',
    description: 'Bloques y recordatorios agendados para hoy.',
    mimeType: 'application/json',
  },
  {
    uri: 'daycraft://pending',
    name: 'Pending Tasks',
    description: 'Lista de tareas pendientes sin hora fija.',
    mimeType: 'application/json',
  },
  {
    uri: 'daycraft://ideas/groups',
    name: 'Idea Groups',
    description: 'Carpetas de proyectos e ideas con notas Markdown.',
    mimeType: 'application/json',
  },
];

function okJson(data: unknown): McpToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    isError: false,
  };
}

function errResult(message: string): McpToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

let mcpCounter = 0;
function nextMcpId(prefix: string): string {
  mcpCounter += 1;
  return `${prefix}-mcp-${Date.now()}-${mcpCounter}`;
}

export class DayCraftMcpServer {
  private readonly repository: DayCraftRepository;

  constructor(repository: DayCraftRepository) {
    this.repository = repository;
  }

  async listTools(): Promise<{ tools: McpToolDefinition[] }> {
    return { tools: MCP_TOOLS };
  }

  async listResources(): Promise<{ resources: McpResourceDefinition[] }> {
    return { resources: MCP_RESOURCES };
  }

  async readResource(uri: string): Promise<McpResourceResult> {
    try {
      if (uri === 'daycraft://timeline/today') {
        const today = getTodayKey();
        const events = await this.repository.listEvents({ dayKey: today });
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({ dayKey: today, events }, null, 2),
            },
          ],
        };
      }

      if (uri === 'daycraft://pending') {
        const pendingTasks = await this.repository.listPendingTasks();
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({ pendingTasks }, null, 2),
            },
          ],
        };
      }

      if (uri === 'daycraft://ideas/groups') {
        const ideaGroups = await this.repository.listIdeaGroups();
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({ ideaGroups }, null, 2),
            },
          ],
        };
      }

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ error: `Unknown resource: ${uri}` }),
          },
        ],
        isError: true,
      };
    } catch (err) {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              error: err instanceof Error ? err.message : 'Failed to read resource',
            }),
          },
        ],
        isError: true,
      };
    }
  }

  async callTool(
    name: string,
    rawArgs: Record<string, unknown> = {}
  ): Promise<McpToolResult> {
    const args = rawArgs && typeof rawArgs === 'object' ? rawArgs : {};

    try {
      switch (name) {
        case 'list_events': {
          const dayKey =
            typeof args.dayKey === 'string' && args.dayKey.trim()
              ? args.dayKey.trim()
              : undefined;
          const events = await this.repository.listEvents({ dayKey });
          return okJson({ events });
        }

        case 'create_event': {
          const title = typeof args.title === 'string' ? args.title.trim() : '';
          const startQ = args.startQ;
          const quarters = args.quarters === undefined ? 2 : args.quarters;

          if (!title) return errResult('Invalid args: title is required');
          if (
            typeof startQ !== 'number' ||
            !Number.isInteger(startQ) ||
            startQ < 0 ||
            startQ > 95
          ) {
            return errResult('Invalid args: startQ must be an integer between 0 and 95');
          }
          if (
            typeof quarters !== 'number' ||
            !Number.isInteger(quarters) ||
            quarters < 1 ||
            quarters > 96
          ) {
            return errResult('Invalid args: quarters must be an integer >= 1');
          }

          const event: TimelineEvent = {
            id: nextMcpId('ev'),
            dayKey:
              typeof args.dayKey === 'string' && args.dayKey.trim()
                ? args.dayKey.trim()
                : getTodayKey(),
            title,
            desc: typeof args.desc === 'string' ? args.desc : undefined,
            startQ,
            quarters,
            type: args.type === 'reminder' ? 'reminder' : 'task',
            tag: typeof args.tag === 'string' ? args.tag : 'MCP',
          };
          const created = await this.repository.upsertEvent(event);
          return okJson({ event: created });
        }

        case 'update_event': {
          const id = typeof args.id === 'string' ? args.id.trim() : '';
          if (!id) return errResult('Invalid args: id is required');

          const existing = await this.repository.getEventById(id);
          if (!existing) return errResult(`Event not found: ${id}`);

          if (
            args.startQ !== undefined &&
            (typeof args.startQ !== 'number' ||
              !Number.isInteger(args.startQ) ||
              args.startQ < 0 ||
              args.startQ > 95)
          ) {
            return errResult('Invalid args: startQ must be an integer between 0 and 95');
          }
          if (
            args.quarters !== undefined &&
            (typeof args.quarters !== 'number' ||
              !Number.isInteger(args.quarters) ||
              args.quarters < 1 ||
              args.quarters > 96)
          ) {
            return errResult('Invalid args: quarters must be an integer >= 1');
          }

          const updated: TimelineEvent = {
            ...existing,
            title:
              typeof args.title === 'string' && args.title.trim()
                ? args.title.trim()
                : existing.title,
            dayKey:
              typeof args.dayKey === 'string' && args.dayKey.trim()
                ? args.dayKey.trim()
                : existing.dayKey,
            startQ:
              typeof args.startQ === 'number' ? args.startQ : existing.startQ,
            quarters:
              typeof args.quarters === 'number' ? args.quarters : existing.quarters,
            type:
              args.type === 'reminder' || args.type === 'task'
                ? args.type
                : existing.type,
            desc: typeof args.desc === 'string' ? args.desc : existing.desc,
            completed:
              typeof args.completed === 'boolean'
                ? args.completed
                : existing.completed,
          };

          const saved = await this.repository.upsertEvent(updated);
          return okJson({ event: saved });
        }

        case 'delete_event': {
          const id = typeof args.id === 'string' ? args.id.trim() : '';
          if (!id) return errResult('Invalid args: id is required');
          await this.repository.deleteEvent(id);
          return okJson({ deleted: true, id });
        }

        case 'list_pending': {
          const includeArchived = Boolean(args.includeArchived);
          const pendingTasks = await this.repository.listPendingTasks({
            includeArchived,
          });
          return okJson({ pendingTasks });
        }

        case 'add_pending': {
          const title = typeof args.title === 'string' ? args.title.trim() : '';
          if (!title) return errResult('Invalid args: title is required');

          const task: PendingTask = {
            id: nextMcpId('pending'),
            title,
            completed: false,
            isFromYesterday: false,
            rolloverDays: 0,
            createdAt: 'Hoy',
          };
          const saved = await this.repository.upsertPendingTask(task);
          return okJson({ task: saved });
        }

        case 'complete_pending': {
          const id = typeof args.id === 'string' ? args.id.trim() : '';
          if (!id) return errResult('Invalid args: id is required');

          const existing = await this.repository.getPendingTaskById(id);
          if (!existing) return errResult(`Pending task not found: ${id}`);

          const saved = await this.repository.upsertPendingTask({
            ...existing,
            completed:
              typeof args.completed === 'boolean' ? args.completed : true,
          });
          return okJson({ task: saved });
        }

        case 'list_ideas': {
          const groupId =
            typeof args.groupId === 'string' && args.groupId.trim()
              ? args.groupId.trim()
              : undefined;
          const ideas = await this.repository.listIdeas({ groupId });
          return okJson({ ideas });
        }

        case 'create_idea': {
          const title = typeof args.title === 'string' ? args.title.trim() : '';
          if (!title) return errResult('Invalid args: title is required');

          const groups = await this.repository.listIdeaGroups();
          const requestedGroupId =
            typeof args.groupId === 'string' && args.groupId.trim()
              ? args.groupId.trim()
              : 'grp-sparks';

          let targetGroup = groups.find((g) => g.id === requestedGroupId);
          if (!targetGroup) {
            targetGroup = groups[0];
          }
          if (!targetGroup) {
            targetGroup = await this.repository.upsertIdeaGroup({
              id: requestedGroupId,
              title: 'Chispazos Libres',
              subtitle: 'Ideas rápidas',
              icon: 'sparkle',
              accentColor: 'amber',
              items: [],
            });
          }

          const desc =
            typeof args.desc === 'string' && args.desc.trim()
              ? args.desc.trim()
              : 'Capturada desde MCP';
          const markdownContent =
            typeof args.markdownContent === 'string' && args.markdownContent.trim()
              ? args.markdownContent
              : `# ${title}\n\n${desc}\n`;

          const idea: IdeaItemData = {
            id: nextMcpId('idea'),
            groupId: targetGroup.id,
            title,
            desc,
            markdownContent,
            createdAtLabel: 'Ahora',
            daysInactive: 0,
            suggestedAction: `Explorar: ${title}`,
          };

          const saved = await this.repository.upsertIdea(idea);
          return okJson({ idea: saved });
        }

        case 'search_notes': {
          const query = typeof args.query === 'string' ? args.query.trim() : '';
          if (!query) return errResult('Invalid args: query is required');
          const matches = await this.repository.searchIdeas(query);
          return okJson({ matches });
        }

        case 'smart_intake': {
          const text = typeof args.text === 'string' ? args.text.trim() : '';
          if (!text) return errResult('Invalid args: text is required');
          const dayKey =
            typeof args.dayKey === 'string' && args.dayKey.trim()
              ? args.dayKey.trim()
              : getTodayKey();

          const snapshot = await this.repository.getSnapshot();
          const batch = await processSmartIntake(text, dayKey, {
            useCloudAI: false,
            ideaGroups: snapshot.ideaGroups,
            existingEvents: snapshot.events,
            existingPending: snapshot.pendingTasks,
          });

          const created: Array<Record<string, unknown>> = [];
          for (const item of batch.items) {
            if (item.kind === 'event' || item.kind === 'reminder') {
              const ev = await this.repository.upsertEvent({
                id: nextMcpId('ev'),
                dayKey: item.dayKey || dayKey,
                title: item.title,
                desc: item.desc,
                startQ: item.startQ ?? 48,
                quarters: item.quarters ?? 2,
                type: item.kind === 'reminder' ? 'reminder' : 'task',
                tag: item.kind === 'reminder' ? 'Recordatorio' : 'MCP Smart Intake',
              });
              created.push({ kind: item.kind, entity: ev });
            } else if (item.kind === 'pending') {
              const task = await this.repository.upsertPendingTask({
                id: nextMcpId('pending'),
                title: item.title,
                completed: false,
                isFromYesterday: false,
                rolloverDays: 0,
                createdAt: 'Hoy',
              });
              created.push({ kind: 'pending', entity: task });
            } else if (item.kind === 'idea') {
              const groups = await this.repository.listIdeaGroups();
              const targetGroupId =
                groups.find((g) => g.id === item.ideaGroupId)?.id ||
                groups[0]?.id ||
                'grp-sparks';
              if (groups.length === 0) {
                await this.repository.upsertIdeaGroup({
                  id: targetGroupId,
                  title: 'Chispazos Libres',
                  subtitle: 'Ideas rápidas',
                  icon: 'sparkle',
                  accentColor: 'amber',
                  items: [],
                });
              }
              const idea = await this.repository.upsertIdea({
                id: nextMcpId('idea'),
                groupId: targetGroupId,
                title: item.title,
                desc: item.desc || 'Capturada vía MCP Smart Intake',
                markdownContent: `# ${item.title}\n\n${item.desc || ''}\n`,
                createdAtLabel: 'Ahora',
                daysInactive: 0,
              });
              created.push({ kind: 'idea', entity: idea });
            }
          }

          return okJson({ batch, created });
        }

        case 'get_daily_briefing': {
          const dayKey =
            typeof args.dayKey === 'string' && args.dayKey.trim()
              ? args.dayKey.trim()
              : getTodayKey();
          const snapshot = await this.repository.getSnapshot();
          const todayEvents = snapshot.events.filter((e) => e.dayKey === dayKey);
          const openPending = snapshot.pendingTasks.filter((p) => !p.completed);
          return okJson({
            dayKey,
            eventsCount: todayEvents.length,
            events: todayEvents,
            openPendingCount: openPending.length,
            pendingTasks: openPending,
            alertsCount: snapshot.alerts.length,
            alerts: snapshot.alerts,
            ideaGroupsCount: snapshot.ideaGroups.length,
          });
        }

        default:
          return errResult(`Unknown tool: ${name}`);
      }
    } catch (err) {
      return errResult(
        err instanceof Error ? err.message : 'Unexpected MCP tool error'
      );
    }
  }

  async handleJsonRpc(
    rawOrObj: string | Record<string, unknown>
  ): Promise<JsonRpcResponse> {
    let req: Record<string, unknown>;
    if (typeof rawOrObj === 'string') {
      try {
        req = JSON.parse(rawOrObj) as Record<string, unknown>;
      } catch {
        return {
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: 'Parse error' },
        };
      }
    } else if (rawOrObj && typeof rawOrObj === 'object') {
      req = rawOrObj;
    } else {
      return {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32600, message: 'Invalid Request' },
      };
    }

    const id =
      typeof req.id === 'string' || typeof req.id === 'number' ? req.id : null;
    const method = typeof req.method === 'string' ? req.method : '';
    const params =
      req.params && typeof req.params === 'object'
        ? (req.params as Record<string, unknown>)
        : {};

    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {}, resources: {} },
            serverInfo: { name: 'daycraft-mcp-server', version: '1.0.0' },
          },
        };
      case 'ping':
        return { jsonrpc: '2.0', id, result: {} };
      case 'tools/list':
        return { jsonrpc: '2.0', id, result: await this.listTools() };
      case 'tools/call': {
        const name = typeof params.name === 'string' ? params.name : '';
        const toolArgs =
          params.arguments && typeof params.arguments === 'object'
            ? (params.arguments as Record<string, unknown>)
            : {};
        return {
          jsonrpc: '2.0',
          id,
          result: await this.callTool(name, toolArgs),
        };
      }
      case 'resources/list':
        return { jsonrpc: '2.0', id, result: await this.listResources() };
      case 'resources/read': {
        const uri = typeof params.uri === 'string' ? params.uri : '';
        return { jsonrpc: '2.0', id, result: await this.readResource(uri) };
      }
      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        };
    }
  }
}

export function createDayCraftMcpServer(
  repository: DayCraftRepository
): DayCraftMcpServer {
  return new DayCraftMcpServer(repository);
}
