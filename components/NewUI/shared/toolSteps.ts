/**
 * toolSteps — the structured model behind the chat's tool-call rows.
 *
 * The chat used to show a tool call as one preformatted string
 * ("Calling: X\n   with:\n      key: JSON…"). The structured pieces only exist
 * in two places, and this module reads both:
 *
 *   1. LIVE — `utils/app/agent#handleAgentRun` flattens the model's tool call
 *      into `status.summary` / `status.message` while the agent runs, and keeps
 *      only the LATEST call (each poll replaces the previous). We parse that
 *      string back (`parseLegacyToolStatus`) and accumulate distinct calls into
 *      a list (`advanceLiveSteps`). A live step cannot know it failed — the
 *      stream carries no result — so a step is marked done when the next one
 *      starts or the run ends.
 *   2. SAVED — when the run finishes the full log is stored on the message as
 *      `data.state.agentLog` (assistant entries carry `{tool, args}`, the
 *      following environment entries carry `{tool, tool_executed, result|error}`).
 *      `stepsFromAgentLog` rebuilds authoritative steps, including errors and
 *      result counts. This is also what a reloaded conversation renders.
 *
 * No React imports.
 */

import {
  CONNECTOR_NAMES,
  ConnectorId,
  ToolStepDescription,
  describeToolStep,
  humanizeMcpToolName,
  isHiddenTool,
  parseMcpToolName,
} from './toolStepLabels';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToolStepStatus = 'running' | 'done' | 'error';

export interface ToolStep {
  /** Stable per position, so a live row and its saved counterpart reconcile. */
  id: string;
  tool: string;
  status: ToolStepStatus;
  args: Record<string, unknown>;
  /** Short muted tail on a finished row: "12 messages". Absent when unknown. */
  resultSummary?: string;
  /** Raw failure text — shown only inside the expandable details. */
  errorDetail?: string;
  /** The model's own short summary of what the step did ("Calculated monthly revenue"); replaces the generic done label. */
  title?: string;
  /** What a code run did: when present, the expanded row shows this instead of raw parameters. */
  detail?: CodeRunDetail;
  /** An MCP tool call: the server, what came back, and anything that isn't text. */
  mcp?: McpStepDetail;
}

/** The expandable body of an MCP step (the arguments are the step's own `args`). */
export interface McpStepDetail {
  /** The server's own tool name, e.g. "search_issues". */
  toolName: string;
  serverName?: string;
  result?: string;
  error?: string;
  /** Non-text parts, described without their payload. */
  media?: Array<{ kind: 'image' | 'resource' | 'other'; mimeType?: string; uri?: string }>;
  /** Images already stored on the message (client-side path), shown in the expanded row. */
  images?: Array<{ mimeType: string; data: string }>;
  /** Milliseconds the call took, when known. */
  ms?: number;
  /** Which parts were cut short, so the UI can say so. */
  truncated?: { args?: boolean; result?: boolean; error?: boolean };
}

/** The expandable body of a code-interpreter step. */
export interface CodeRunDetail {
  code: string;
  /** What the code printed. */
  output?: string;
  /** The Python error, when the run failed. */
  error?: string;
  files?: Array<{ name: string; type?: string }>;
  /** Which parts the backend cut short, so the UI can say so. */
  truncated?: { code?: boolean; stdout?: boolean; error?: boolean };
}

export interface ParsedToolCall {
  tool: string;
  args: Record<string, unknown>;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

// ─── Live: parse the legacy status string ────────────────────────────────────

/** `    key: <JSON>` — six spaces, exactly as `handleAgentRun` writes them. */
const ARG_LINE = /^ {6}(\S[^\n]*?): (.*)$/;

/**
 * Recover `{tool, args}` from a status written by `handleAgentRun`.
 *
 *   "Calling: X"            + details lines  → { tool: 'X', args }
 *   "Executing code..."     + ```python…```  → { tool: 'exec_code', args: { code } }
 *   "Hold on..."                             → { tool: 'terminate' }   (hidden)
 *
 * Anything else (the random "Thinking..." words, prose, other statuses) is not
 * a tool call → null.
 */
export const parseLegacyToolStatus = (
  status: { summary?: unknown; message?: unknown } | null | undefined,
): ParsedToolCall | null => {
  const summary = typeof status?.summary === 'string' ? status.summary : '';
  const message = typeof status?.message === 'string' ? status.message : '';

  const calling = summary.match(/^Calling:\s*(\S+)/);
  if (calling) {
    const args: Record<string, unknown> = {};
    for (const line of message.split('\n')) {
      const m = line.match(ARG_LINE);
      if (!m) continue;
      try {
        args[m[1]] = JSON.parse(m[2]);
      } catch {
        args[m[1]] = m[2];
      }
    }
    return { tool: calling[1], args };
  }

  if (summary === 'Executing code...') {
    const code = message.match(/```python\n\n([\s\S]*?)\n\n```/);
    return { tool: 'exec_code', args: code ? { code: code[1] } : {} };
  }

  if (summary === 'Hold on...') return { tool: 'terminate', args: {} };

  // MCP, server-side: toolLoop sends "Executing MCP tool: <full name>..." (no arguments).
  const mcpServerSide = summary.match(/^Executing MCP tool:\s*(\S+?)\.{3}$/);
  if (mcpServerSide) return { tool: mcpServerSide[1], args: {} };

  // MCP, browser-side: summary "Executing MCP Tool", message "Running <full name>...".
  if (summary === 'Executing MCP Tool') {
    const running = message.match(/^Running\s+(\S+?)\.{3}$/);
    if (running) return { tool: running[1], args: {} };
  }

  return null;
};

const sameCall = (step: ToolStep, call: ParsedToolCall): boolean =>
  step.tool === call.tool && JSON.stringify(step.args) === JSON.stringify(call.args);

/**
 * Fold one poll's tool call into the running list.
 *
 * - The same call repeated (every poll re-sends the latest) changes nothing, and
 *   returns the SAME array so React can bail out.
 * - A different call closes whatever was running and starts a new running step.
 * - A hidden tool (terminate…) closes the running step without adding a row.
 * - `finished` closes everything.
 */
export const advanceLiveSteps = (
  prev: ToolStep[],
  call: ParsedToolCall | null,
  finished = false,
): ToolStep[] => {
  let next = prev;
  const closeRunning = () => {
    if (next.some((s) => s.status === 'running')) {
      next = next.map((s) => (s.status === 'running' ? { ...s, status: 'done' as const } : s));
    }
  };

  if (call) {
    if (isHiddenTool(call.tool)) {
      closeRunning();
    } else {
      const last = next[next.length - 1];
      if (!(last && last.status === 'running' && sameCall(last, call))) {
        closeRunning();
        next = [...next, { id: `s${next.length}`, tool: call.tool, status: 'running', args: call.args }];
      }
    }
  }
  if (finished) closeRunning();
  return next;
};

// ─── Saved: rebuild from agentLog ────────────────────────────────────────────

/** First array found in a tool result, looking through the usual wrappers. */
const findList = (value: unknown, depth = 0): unknown[] | null => {
  if (Array.isArray(value)) return value;
  if (depth > 2 || !isRecord(value)) return null;
  for (const key of ['data', 'result', 'value', 'items', 'messages', 'events', 'results']) {
    const found = findList(value[key], depth + 1);
    if (found) return found;
  }
  return null;
};

/**
 * "12 messages" — only for tools whose config names a unit AND whose result
 * holds a list. Anything uncertain returns undefined: no summary beats a wrong one.
 */
export const summarizeResult = (tool: string, result: unknown): string | undefined => {
  const unit = describeToolStep(tool).unit;
  if (!unit) return undefined;
  const list = findList(result);
  if (!list) return undefined;
  if (list.length === 0) return `No ${unit[1]}`;
  return `${list.length} ${list.length === 1 ? unit[0] : unit[1]}`;
};

const errorTextOf = (content: Record<string, unknown>): string => {
  const candidates = [
    content.error,
    isRecord(content.result) ? content.result.error : undefined,
    isRecord(content.result) ? content.result.message : undefined,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
};

const didFail = (content: Record<string, unknown>): boolean =>
  content.tool_executed === false ||
  (typeof content.error === 'string' && content.error.trim() !== '') ||
  (isRecord(content.result) && content.result.success === false);

/**
 * Steps from a decompressed agent log (`getAgentLog(message)`).
 * Accepts `{data:{result:[…]}}`, `{result:[…]}` or the bare array.
 */
export const stepsFromAgentLog = (agentLog: unknown): ToolStep[] => {
  const entries: unknown = Array.isArray(agentLog)
    ? agentLog
    : isRecord(agentLog)
      ? (isRecord(agentLog.data) ? agentLog.data.result : undefined) ?? agentLog.result
      : undefined;
  if (!Array.isArray(entries)) return [];

  const steps: ToolStep[] = [];
  let pending: ToolStep | null = null;

  for (const entry of entries) {
    if (!isRecord(entry) || !isRecord(entry.content)) continue;
    const content = entry.content;

    if (entry.role === 'assistant' && typeof content.tool === 'string') {
      pending = null;
      if (isHiddenTool(content.tool)) continue;
      const step: ToolStep = {
        id: `s${steps.length}`,
        tool: content.tool,
        // The run is over: a call with no recorded outcome is treated as complete.
        status: 'done',
        args: isRecord(content.args) ? content.args : {},
      };
      steps.push(step);
      pending = step;
      continue;
    }

    if (entry.role === 'environment' && pending && (content.tool === undefined || content.tool === pending.tool)) {
      if (didFail(content)) {
        pending.status = 'error';
        const detail = errorTextOf(content);
        if (detail) pending.errorDetail = detail;
      } else {
        pending.resultSummary = summarizeResult(pending.tool, content.result);
      }
      pending = null;
    }
  }
  return steps;
};

// ─── Saved: rebuild from code-interpreter runs ───────────────────────────────

/** More than the backend ever sends (it loops at most a handful of times) — a guard, not a limit users meet. */
const MAX_INTERPRETER_RUNS = 20;

const asString = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v : undefined);

/** "2 files created" — only what we can state for certain; no output and no files says nothing. */
const summarizeRun = (files: number, hasOutput: boolean): string | undefined => {
  if (files > 0) return `${files} ${files === 1 ? 'file' : 'files'} created`;
  return hasOutput ? 'Printed output' : undefined;
};

/**
 * Steps from `message.data.state.codeInterpreter` — the per-execution `runs` the backend streams
 * (amplify-lambda-js `buildRunRecord`). One step per run, in order. Anything malformed is skipped:
 * a half-understood record must never take the message down or claim something untrue.
 */
export const stepsFromInterpreterRuns = (codeInterpreterState: unknown): ToolStep[] => {
  const runs = isRecord(codeInterpreterState) ? codeInterpreterState.runs : undefined;
  if (!Array.isArray(runs)) return [];

  const steps: ToolStep[] = [];
  for (const run of runs.slice(0, MAX_INTERPRETER_RUNS)) {
    if (!isRecord(run) || typeof run.id !== 'string' || typeof run.code !== 'string') continue;

    const output = asString(run.stdout);
    const error = asString(run.error);
    const files = Array.isArray(run.files)
      ? run.files
          .filter((f): f is Record<string, unknown> => isRecord(f) && typeof f.name === 'string')
          .map((f) => ({ name: f.name as string, type: typeof f.type === 'string' ? f.type : undefined }))
      : [];
    const t = isRecord(run.truncated) ? run.truncated : {};
    const truncated = {
      ...(t.code === true ? { code: true } : {}),
      ...(t.stdout === true ? { stdout: true } : {}),
      ...(t.error === true ? { error: true } : {}),
    };
    const failed = run.ok !== true;
    const title = asString(run.description);

    steps.push({
      id: `ci-${run.id}`,
      tool: 'exec_code',
      status: failed ? 'error' : 'done',
      args: {},
      ...(title ? { title: title.trim() } : {}),
      ...(!failed ? { resultSummary: summarizeRun(files.length, !!output) } : {}),
      ...(failed && error ? { errorDetail: error } : {}),
      detail: {
        code: run.code,
        ...(output ? { output } : {}),
        ...(error ? { error } : {}),
        ...(files.length ? { files } : {}),
        ...(Object.keys(truncated).length ? { truncated } : {}),
      },
    });
  }
  return steps;
};

// ─── MCP tool calls ──────────────────────────────────────────────────────────

/** More than any one answer makes (the browser loop stops at 10 rounds) — a guard, not a limit users meet. */
const MAX_MCP_STEPS = 40;
const MCP_RESULT_CAP = 4000;
const MCP_ERROR_CAP = 2000;
const MAX_MCP_IMAGES = 3;
const MAX_MCP_MEDIA = 5;
/** Raster formats only: an SVG data URI is markup, so it is never rendered. */
const SAFE_IMAGE_TYPES: ReadonlySet<string> = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

const clipText = (text: string, max: number): { text: string; cut: boolean } =>
  text.length > max ? { text: text.slice(0, max), cut: true } : { text, cut: false };

/** `mcp:` can never parse as a real `mcp_<server>_<tool>` name, so a converted step is never mistaken for a live one. */
const mcpToolId = (toolName: string): string => `mcp:${toolName}`;

/** Is this step an MCP call — converted from saved data, or a live one still carrying its full `mcp_…` name? */
export const isMcpStep = (step: Pick<ToolStep, 'tool' | 'mcp'>): boolean =>
  !!step.mcp || (typeof step.tool === 'string' && step.tool.startsWith('mcp_'));

/** Tool arguments as an object: JSON text or an object, anything else (or unparseable) is "no arguments". */
const parseArgs = (raw: unknown): Record<string, unknown> => {
  if (isRecord(raw)) return raw;
  if (typeof raw !== 'string' || raw.trim() === '') return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

/** "3 results" — only when the text is a JSON list (or an object whose `results`/`items` is one). Else nothing. */
export const summarizeMcpResult = (text: string | undefined): string | undefined => {
  if (!text) return undefined;
  const t = text.trim();
  if (!t.startsWith('[') && !t.startsWith('{')) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(t);
  } catch {
    return undefined;
  }
  const list = Array.isArray(value)
    ? value
    : isRecord(value)
      ? (Array.isArray(value.results) ? value.results : Array.isArray(value.items) ? value.items : null)
      : null;
  if (!list) return undefined;
  if (list.length === 0) return 'No results';
  return `${list.length} ${list.length === 1 ? 'result' : 'results'}`;
};

const asMedia = (raw: unknown): McpStepDetail['media'] => {
  if (!Array.isArray(raw)) return undefined;
  const media: NonNullable<McpStepDetail['media']> = [];
  for (const m of raw) {
    if (!isRecord(m) || media.length >= MAX_MCP_MEDIA) continue;
    const kind = m.kind === 'image' || m.kind === 'resource' ? m.kind : 'other';
    media.push({
      kind,
      ...(asString(m.mimeType) ? { mimeType: m.mimeType as string } : {}),
      ...(asString(m.uri) ? { uri: m.uri as string } : {}),
    });
  }
  return media.length ? media : undefined;
};

/**
 * Steps from `message.data.state.mcpRuns` — the per-call records the backend streams for MCP tools it ran
 * itself (amplify-lambda-js `buildMcpRunRecord`: `{id, ok, tool, serverName?, args?, result?, error?, media?,
 * ms?, truncated?}`). One step per record, in order; malformed records are skipped.
 */
export const stepsFromMcpRuns = (state: unknown): ToolStep[] => {
  const runs = isRecord(state) ? state.mcpRuns : undefined;
  if (!Array.isArray(runs)) return [];

  const steps: ToolStep[] = [];
  runs.slice(0, MAX_MCP_STEPS).forEach((run, index) => {
    if (!isRecord(run) || typeof run.tool !== 'string' || run.tool.trim() === '') return;

    const result = asString(run.result);
    const error = asString(run.error);
    const failed = run.ok !== true;
    const t = isRecord(run.truncated) ? run.truncated : {};
    const truncated = {
      ...(t.args === true ? { args: true } : {}),
      ...(t.result === true ? { result: true } : {}),
      ...(t.error === true ? { error: true } : {}),
    };
    const serverName = asString(run.serverName);
    const media = asMedia(run.media);
    const summary = failed ? undefined : summarizeMcpResult(result);

    steps.push({
      id: `mcp-run-${typeof run.id === 'string' && run.id ? run.id : index}`,
      tool: mcpToolId(run.tool),
      status: failed ? 'error' : 'done',
      args: parseArgs(run.args),
      ...(summary ? { resultSummary: summary } : {}),
      ...(failed && error ? { errorDetail: error } : {}),
      mcp: {
        toolName: run.tool,
        ...(serverName ? { serverName } : {}),
        ...(result ? { result } : {}),
        ...(error ? { error } : {}),
        ...(media ? { media } : {}),
        ...(typeof run.ms === 'number' && Number.isFinite(run.ms) && run.ms >= 0 ? { ms: run.ms } : {}),
        ...(Object.keys(truncated).length ? { truncated } : {}),
      },
    });
  });
  return steps;
};

/**
 * Steps from a message the BROWSER executed MCP tools for. After a client-side round the send hook keeps
 * the results on an assistant message as `data.mcpToolResults: [{toolName, serverName?, content:
 * MCPToolContent[], isError?, executionTime?}]`, and the calls (with their JSON-string arguments) in the
 * message's own `tool_calls` — both in call order. Arguments are only attached when the two lists line up.
 */
export const stepsFromMcpToolResults = (message: unknown): ToolStep[] => {
  const data = isRecord(message) && isRecord(message.data) ? message.data : null;
  const results = data?.mcpToolResults;
  if (!Array.isArray(results) || results.length === 0) return [];
  const rawCalls = isRecord(message) ? message.tool_calls : undefined;
  const calls = Array.isArray(rawCalls) && rawCalls.length === results.length ? rawCalls : [];

  const steps: ToolStep[] = [];
  results.slice(0, MAX_MCP_STEPS).forEach((r, index) => {
    if (!isRecord(r) || typeof r.toolName !== 'string' || r.toolName.trim() === '') return;
    const call = isRecord(calls[index]) ? (calls[index] as Record<string, unknown>) : null;
    const fn = call && isRecord(call.function) ? call.function : null;

    // A thrown error records the full `mcp_<server>_<tool>` name; a normal result already has the bare tool name.
    const toolName = parseMcpToolName(r.toolName)?.toolName ?? r.toolName;
    const serverName = asString(r.serverName);
    const failed = r.isError === true;

    const parts = Array.isArray(r.content) ? r.content.filter(isRecord) : [];
    const text = parts
      .filter((p) => p.type === 'text' && typeof p.text === 'string')
      .map((p) => p.text as string)
      .join('\n');
    const clipped = clipText(text, failed ? MCP_ERROR_CAP : MCP_RESULT_CAP);
    const nonText = parts.filter((p) => p.type !== 'text');
    const media = asMedia(
      nonText.map((p) => ({
        kind: p.type === 'image' || p.type === 'resource' ? p.type : 'other',
        mimeType: p.mimeType,
        uri: p.uri,
      })),
    );
    const images = nonText
      .filter(
        (p) =>
          p.type === 'image' &&
          typeof p.data === 'string' &&
          p.data !== '' &&
          typeof p.mimeType === 'string' &&
          SAFE_IMAGE_TYPES.has(p.mimeType.toLowerCase()),
      )
      .slice(0, MAX_MCP_IMAGES)
      .map((p) => ({ mimeType: (p.mimeType as string).toLowerCase(), data: p.data as string }));
    const summary = failed ? undefined : summarizeMcpResult(clipped.text);
    const callId = call && typeof call.id === 'string' && call.id ? call.id : '';

    steps.push({
      id: `mcp-res-${callId || index}`,
      tool: mcpToolId(toolName),
      status: failed ? 'error' : 'done',
      args: parseArgs(fn?.arguments),
      ...(summary ? { resultSummary: summary } : {}),
      ...(failed && clipped.text ? { errorDetail: clipped.text } : {}),
      mcp: {
        toolName,
        ...(serverName ? { serverName } : {}),
        ...(!failed && clipped.text ? { result: clipped.text } : {}),
        ...(failed && clipped.text ? { error: clipped.text } : {}),
        ...(media ? { media } : {}),
        ...(images.length ? { images } : {}),
        ...(typeof r.executionTime === 'number' && Number.isFinite(r.executionTime) && r.executionTime >= 0
          ? { ms: r.executionTime }
          : {}),
        ...(clipped.cut ? { truncated: failed ? { error: true } : { result: true } } : {}),
      },
    });
  });
  return steps;
};

/**
 * While an MCP call runs the saved list has no row for it yet (a record is streamed only when a call
 * FINISHES). Append the live MCP steps beyond the ones already saved, if they are still running.
 */
export const withRunningMcpSteps = (saved: ToolStep[], live: ToolStep[]): ToolStep[] => {
  const savedCount = saved.filter(isMcpStep).length;
  const liveMcp = live.filter(isMcpStep);
  const extra = liveMcp.slice(savedCount).filter((s) => s.status === 'running');
  return extra.length ? [...saved, ...extra.map((s, i) => ({ ...s, id: `live-mcp-${savedCount + i}` }))] : saved;
};

/**
 * Description of a step as the chat shows it. MCP steps carry their own server name, which
 * `describeToolStep` cannot know:  "Calling Search issues on GitHub…" → "Search issues (GitHub)".
 */
export const describeStep = (
  step: ToolStep,
  opts: { now?: Date; timeZone?: string; locale?: string } = {},
): ToolStepDescription => {
  if (!step.mcp) return describeToolStep(step.tool, step.args, opts);
  const name = humanizeMcpToolName(step.mcp.toolName);
  const server = step.mcp.serverName;
  return {
    tool: step.tool,
    category: 'mcp',
    running: server ? `Calling ${name} on ${server}…` : `Calling ${name}…`,
    done: server ? `${name} (${server})` : name,
    known: false,
  };
};

// ─── Grouping & copy ─────────────────────────────────────────────────────────

const joinNames = (names: string[]): string => {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
};

/** Connector names touched by these steps, in first-use order. */
export const connectorsUsed = (steps: ToolStep[]): ConnectorId[] => {
  const seen: ConnectorId[] = [];
  for (const s of steps) {
    const c = describeToolStep(s.tool).connector;
    if (c && !seen.includes(c)) seen.push(c);
  }
  return seen;
};

/** MCP server names touched by these steps, in first-use order (case-insensitive de-duplication). */
export const mcpServersUsed = (steps: ToolStep[]): string[] => {
  const seen = new Map<string, string>();
  for (const s of steps) {
    const name = s.mcp?.serverName;
    if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  }
  return Array.from(seen.values());
};

/** "Used Outlook · 2 steps" (+ " · 1 failed"). */
export const groupTitle = (steps: ToolStep[]): string => {
  const names = [...connectorsUsed(steps).map((c) => CONNECTOR_NAMES[c]), ...mcpServersUsed(steps)];
  const subject = names.length
    ? `Used ${joinNames(names)}`
    : steps.length > 0 && steps.every((s) => s.tool === 'exec_code')
      ? 'Ran code'
      : steps.length > 0 && steps.every(isMcpStep)
        ? 'Used MCP tools'
        : 'Used tools';
  const n = steps.length;
  const failed = steps.filter((s) => s.status === 'error').length;
  return `${subject} · ${n} ${n === 1 ? 'step' : 'steps'}${failed ? ` · ${failed} failed` : ''}`;
};

export interface StepErrorMessage {
  text: string;
  /** Show a link to Settings → Connectors. */
  linkToConnectors: boolean;
}

const AUTH_ERROR = /token|auth|unauthori[sz]ed|forbidden|\b40[13]\b|not connected|expired|credential|sign.?in|consent/i;

/** Plain-language failure line for the main row; the raw text stays in the details. */
export const plainErrorMessage = (step: ToolStep): StepErrorMessage => {
  const { connectorName } = describeToolStep(step.tool);
  // A code-interpreter run (it carries its code/output); the agent loop's exec_code keeps the generic line.
  if (step.detail) return { text: 'The code hit an error.', linkToConnectors: false };
  // An MCP call: the raw reason stays in the expanded view; the row says it in plain words.
  if (step.mcp) {
    return { text: `${humanizeMcpToolName(step.mcp.toolName)} didn't work. Open this step for details.`, linkToConnectors: false };
  }
  if (!connectorName) return { text: "This step didn't finish.", linkToConnectors: false };
  if (step.errorDetail && AUTH_ERROR.test(step.errorDetail)) {
    return { text: `Couldn't sign in to ${connectorName}. Reconnect it in`, linkToConnectors: true };
  }
  return { text: `Couldn't reach ${connectorName}. Check your connection in`, linkToConnectors: true };
};

/** Parameters as display rows: strings stay bare, everything else is compact JSON. */
export const formatParamRows = (args: Record<string, unknown>): Array<{ key: string; value: string }> =>
  Object.entries(args).map(([key, value]) => ({
    key,
    value: typeof value === 'string' ? value : (JSON.stringify(value) ?? String(value)),
  }));

/**
 * Is the step area the only thing telling the user the answer is still coming?
 *
 * The classic "● Thinking…" card is hidden while the step rows own the area, and
 * ConversationViewShell's own fallback dot stands down whenever a status is
 * visible (it assumes that card is showing). So in the gap between "last tool
 * finished" and "first answer token" — typically the "Finalizing response…"
 * status — neither would show, and the reply looks finished. This is that case:
 * we are rendering steps, none is still running, the model is not already shown
 * as reasoning, the reply is still empty, and a status says work is in flight.
 */
export const isAwaitingAnswer = (opts: {
  isLive: boolean;
  steps: ToolStep[];
  contentEmpty: boolean;
  hasVisibleStatus: boolean;
  showingReasoning: boolean;
}): boolean =>
  opts.isLive &&
  opts.steps.length > 0 &&
  !opts.steps.some((s) => s.status === 'running') &&
  opts.contentEmpty &&
  opts.hasVisibleStatus &&
  !opts.showingReasoning;
