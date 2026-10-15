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
  describeToolStep,
  isHiddenTool,
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

/** "Used Outlook · 2 steps" (+ " · 1 failed"). */
export const groupTitle = (steps: ToolStep[]): string => {
  const names = connectorsUsed(steps).map((c) => CONNECTOR_NAMES[c]);
  const subject = names.length
    ? `Used ${joinNames(names)}`
    : steps.length > 0 && steps.every((s) => s.tool === 'exec_code')
      ? 'Ran code'
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
