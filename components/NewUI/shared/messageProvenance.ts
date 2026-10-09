/**
 * messageProvenance — "what produced this answer?" for one assistant reply.
 *
 * Reads only what the transcript already carries, so it works on any saved chat:
 *   • reply `data.state`     — streamed by the backend: `currentAssistant`,
 *                              `activeSkills`, `sources.webSearch`, `codeInterpreter`,
 *                              `mcpToolCalls`, `agentLog` (actions actually run)
 *   • reply `data.mcpToolResults`
 *   • preceding user message — `configuredTools` (connector actions attached to the
 *                              turn), `data.dataSources`, `data.assistant`
 *   • reply `data.newUiMeta` — the model/effort, stamped by NewUIMessageActionsLayer
 *                              when the reply was generated (the backend does not
 *                              stream the model back, and the conversation's model
 *                              can change between turns). Replies that predate the
 *                              stamp have no model — never guess from the
 *                              conversation's *current* model.
 *
 * No React, no service imports. The agent-log reader is injected so tests don't
 * pull in `utils/app/agent`.
 */
import { isPlaceholderAssistantName } from './assistantIdentity';

/** `message.data` key holding the stamped generation metadata. */
export const MESSAGE_META_KEY = 'newUiMeta';

export interface MessageMetaStamp {
  model: { id: string; name: string };
  reasoningLevel?: string;
}

export interface MessageProvenance {
  timestamp?: string;
  model?: MessageMetaStamp['model'];
  reasoningLevel?: string;
  assistant?: string;
  webSearch: boolean;
  codeInterpreter: boolean;
  skills: string[];
  /** Connector actions attached to the turn (the user message's configuredTools). */
  connectorActionsAttached: string[];
  /** Actions the agent actually executed, from the reply's agent log. */
  actionsUsed: string[];
  /** MCP tools called, as "server · tool". */
  mcpTools: string[];
  files: string[];
}

type AnyMessage = { role?: string; data?: any; configuredTools?: any[]; timestamp?: string } | undefined | null;

/** Build the stamp from the conversation at generation time. Null when no model is known. */
export const buildMessageMetaStamp = (conversation: any): MessageMetaStamp | null => {
  const model = conversation?.model;
  if (!model || typeof model.id !== 'string') return null;
  const level = conversation?.data?.reasoningLevel;
  return {
    model: {
      id: model.id,
      name: typeof model.name === 'string' && model.name ? model.name : model.id,
    },
    ...(typeof level === 'string' && level ? { reasoningLevel: level } : {}),
  };
};

/** "sendEmail" / "read_email" → "Send email" / "Read email". */
export const humanizeToolName = (raw: string): string => {
  const spaced = raw
    .replace(/[_\-.]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  if (!spaced) return raw;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
};

const uniq = (items: string[]): string[] => Array.from(new Set(items.filter(Boolean)));

/** Agent-log tool names that are internal plumbing, not something the user ran. */
const IGNORED_AGENT_TOOLS = new Set(['think', 'terminate', 'finish', 'final_answer']);

const agentToolNames = (agentLog: any): string[] => {
  const entries = agentLog?.data?.result;
  if (!Array.isArray(entries)) return [];
  const names: string[] = [];
  for (const entry of entries) {
    if (entry?.role !== 'assistant') continue;
    const tool = entry?.content?.tool;
    if (typeof tool !== 'string' || !tool || IGNORED_AGENT_TOOLS.has(tool)) continue;
    names.push(tool === 'exec_code' ? 'Code execution' : humanizeToolName(tool));
  }
  return uniq(names);
};

export interface ProvenanceInput {
  /** The assistant reply. */
  message: AnyMessage;
  /** The user message that prompted it (nearest preceding), if any. */
  userMessage?: AnyMessage;
  /** Injected `utils/app/agent#getAgentLog` (decompresses the stored log). */
  readAgentLog?: (message: any) => any;
}

export const getMessageProvenance = ({
  message,
  userMessage,
  readAgentLog,
}: ProvenanceInput): MessageProvenance => {
  const state = message?.data?.state ?? {};
  const stamp = message?.data?.[MESSAGE_META_KEY] as Partial<MessageMetaStamp> | undefined;

  const model =
    stamp?.model && typeof stamp.model.name === 'string' && stamp.model.name ? stamp.model : undefined;

  // Assistant: the streamed state wins (it is what actually answered); fall back to
  // the stamp the user message carries. Placeholder names mean "no assistant".
  const streamedName: string | undefined = state.currentAssistant;
  const userStamp = userMessage?.data?.assistant?.definition;
  let assistant: string | undefined;
  if (typeof streamedName === 'string' && !isPlaceholderAssistantName(streamedName, state.currentAssistantId)) {
    assistant = streamedName;
  } else if (userStamp?.name && !isPlaceholderAssistantName(userStamp.name, userStamp.assistantId)) {
    assistant = userStamp.name;
  }

  const sources = state.sources ?? {};
  const webSearch = Array.isArray(sources.webSearch?.sources)
    ? sources.webSearch.sources.length > 0
    : Boolean(sources.webSearch);

  const codeInterpreter = Boolean(
    state.codeInterpreter?.codeInterpreterRecordId || state.codeInterpreter?.content,
  );

  const skills = uniq(
    (Array.isArray(state.activeSkills) ? state.activeSkills : []).map((s: any) =>
      typeof s === 'string' ? s : s?.name,
    ),
  );

  let actionsUsed: string[] = [];
  if (readAgentLog && state.agentLog) {
    try {
      actionsUsed = agentToolNames(readAgentLog(message));
    } catch {
      actionsUsed = [];
    }
  }

  // An attached action that also ran is already listed under what was used; keep
  // this list to the ones that were merely attached so nothing appears twice.
  const usedLower = new Set(actionsUsed.map((a) => a.toLowerCase()));
  const connectorActionsAttached = uniq(
    (Array.isArray(userMessage?.configuredTools) ? userMessage!.configuredTools! : []).map((t: any) =>
      typeof t?.name === 'string' ? humanizeToolName(t.name) : '',
    ),
  ).filter((a) => !usedLower.has(a.toLowerCase()));

  const mcpResults: any[] = Array.isArray(message?.data?.mcpToolResults) ? message!.data.mcpToolResults : [];
  const mcpCalls: any[] = Array.isArray(state.mcpToolCalls) ? state.mcpToolCalls : [];
  const mcpTools = uniq([
    ...mcpResults.map((r) =>
      r?.toolName ? `${r.serverName ? `${r.serverName} · ` : ''}${humanizeToolName(String(r.toolName))}` : '',
    ),
    ...mcpCalls.map((c) => (c?.function?.name ? humanizeToolName(String(c.function.name)) : '')),
  ]);

  const files = uniq(
    (Array.isArray(userMessage?.data?.dataSources) ? userMessage!.data.dataSources : []).map((d: any) =>
      typeof d?.name === 'string' ? d.name : '',
    ),
  );

  return {
    timestamp: message?.timestamp,
    model,
    reasoningLevel: typeof stamp?.reasoningLevel === 'string' ? stamp.reasoningLevel : undefined,
    assistant,
    webSearch,
    codeInterpreter,
    skills,
    connectorActionsAttached,
    actionsUsed,
    mcpTools,
    files,
  };
};

/** Tools and features that took part in the reply, in display order. */
export const usedToolsAndFeatures = (p: MessageProvenance): string[] =>
  uniq([
    ...(p.webSearch ? ['Web search'] : []),
    ...(p.codeInterpreter ? ['Code interpreter'] : []),
    ...p.skills.map((s) => `Skill: ${s}`),
    ...p.actionsUsed,
    ...p.mcpTools,
  ]);

/** "Connector actions attached" — or "Also attached" when some already appear as used. */
export const attachedLabel = (p: MessageProvenance): string =>
  p.actionsUsed.length > 0 ? 'Also attached' : 'Connector actions attached';

/** "Model · High effort", or '' when the model wasn't recorded. */
export const modelSummary = (p: MessageProvenance): string => {
  if (!p.model) return '';
  const effort = p.reasoningLevel
    ? `${p.reasoningLevel.charAt(0).toUpperCase()}${p.reasoningLevel.slice(1)} effort`
    : '';
  return [p.model.name, effort].filter(Boolean).join(' · ');
};

/** Long lists (a composite connector can attach a dozen ops) stay readable. */
export const capList = (items: string[], max = 8): string[] =>
  items.length <= max ? items : [...items.slice(0, max), `+${items.length - max} more`];

const escapeMd = (s: string): string => s.replace(/([\\`*\[\]<>])/g, '\\$1');

/**
 * One blockquote line for the markdown / Word download, or '' when there is
 * nothing worth saying (so replies with no details gain no empty quote). Each
 * fact appears once; unrecorded facts are omitted rather than printed as
 * "Not recorded" on every old reply.
 */
export const formatProvenanceMarkdown = (p: MessageProvenance): string => {
  const list = (items: string[]) => capList(items).map(escapeMd).join(', ');
  const used = usedToolsAndFeatures(p);
  const parts = [
    formatExactTimestamp(p.timestamp),
    escapeMd(modelSummary(p)),
    p.assistant ? `Assistant: ${escapeMd(p.assistant)}` : '',
    used.length ? `Used: ${list(used)}` : '',
    p.connectorActionsAttached.length ? `${attachedLabel(p)}: ${list(p.connectorActionsAttached)}` : '',
    p.files.length ? `Files: ${list(p.files)}` : '',
  ].filter(Boolean);
  return parts.length ? `> ${parts.join(' · ')}` : '';
};

/** Local timestamp to the minute, with the zone — for the info panel. */
export const formatExactTimestamp = (iso: string | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
};
