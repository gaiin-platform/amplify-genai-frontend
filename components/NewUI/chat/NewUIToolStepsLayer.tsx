/**
 * NewUIToolStepsLayer
 *
 * Replaces the classic tool-call status ("Calling: microsoftListMessages with:
 * folder_id: …") with compact, human-readable step rows.
 *
 * ── Why a layer ─────────────────────────────────────────────────────────────
 * The status is rendered by Chat/ChatMessage → Status/PromptingStatusDisplay →
 * PromptStatus, and built as a flat string by utils/app/agent#handleAgentRun —
 * all off-limits (NEW_UI_GUIDE §2). So, like NewUISourcesLayer, this layer:
 *
 *   1. Finds each assistant message's `#chatHover` and puts a portal host
 *      (`[data-nui-tools-host]`) at the top of it — where the status sat.
 *   2. Renders `MessageToolSteps` into that host from structured data:
 *        • LIVE   — the HomeContext `status` string, parsed and accumulated into
 *                   a step list (shared/toolSteps#advanceLiveSteps).
 *        • SAVED  — `message.data.state.agentLog` (shared/toolSteps#stepsFromAgentLog)
 *                   plus `message.data.state.codeInterpreter.runs`
 *                   (#stepsFromInterpreterRuns: the code, output and files of each
 *                   sandbox execution). Authoritative: it carries errors and result
 *                   counts, and it is what a reloaded conversation shows. Wins over
 *                   LIVE once present.
 *      MCP tool calls are SAVED too, from two places (both gated on the `mcp` feature flag):
 *        • `data.state.mcpRuns`     — calls the BACKEND ran (#stepsFromMcpRuns)
 *        • `data.mcpToolResults` + `tool_calls` — calls the BROWSER ran, which the send hook
 *          keeps on an intermediate assistant message (#stepsFromMcpToolResults). A call that
 *          is still running is shown from the LIVE status until its record lands.
 *   3. Flags the host `data-takeover="true"` while it has something to show; a
 *      `:has()` rule in conversation-view.css then hides the classic status
 *      wrapper. With nothing to show (e.g. a plain chat before any tool call)
 *      the classic "● Thinking…" row is left alone.
 *
 * The classic "Reasoning / Actions" log (AgentLogBlock) is NOT touched: it also
 * carries generated files and the token-cost line.
 *
 * ── Live region ──────────────────────────────────────────────────────────────
 * One persistent `aria-live="polite"` region (rendered by this component, so it
 * exists before its text changes) announces the current step's friendly label —
 * never raw parameters.
 */

import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import HomeContext from '@/components/Home/home.context';
import { PromptStatusDetails } from '@/components/Status/PromptStatusDetails';
import { Message } from '@/types/chat';
import { Status } from '@/types/workflow';
import { getAgentLog } from '@/utils/app/agent';
import { useStableFeatureFlags } from '@/components/NewUI/shared/useStableFeatureFlags';
import {
  ParsedToolCall,
  ToolStep,
  advanceLiveSteps,
  describeStep,
  isAwaitingAnswer,
  parseLegacyToolStatus,
  plainErrorMessage,
  stepsFromAgentLog,
  stepsFromInterpreterRuns,
  stepsFromMcpRuns,
  stepsFromMcpToolResults,
  withRunningMcpSteps,
} from '@/components/NewUI/shared/toolSteps';
import { MessageToolSteps } from './ToolStepViews';

// ─── Saved steps (cached) ────────────────────────────────────────────────────

/** Decompressing + parsing an agent log is not free; key on the stored value itself. */
const savedStepsCache = new WeakMap<object, ToolStep[]>();

const agentLogSteps = (message: Message | undefined): ToolStep[] => {
  const raw = message?.data?.state?.agentLog;
  if (!raw || typeof raw !== 'object') return [];
  const hit = savedStepsCache.get(raw);
  if (hit) return hit;
  let steps: ToolStep[] = [];
  try {
    steps = stepsFromAgentLog(getAgentLog(message as Message));
  } catch {
    steps = [];
  }
  savedStepsCache.set(raw, steps);
  return steps;
};

/**
 * Code-interpreter runs. While streaming, `deepMerge` appends to the SAME `runs` array in
 * place, so identity alone is not enough to cache on — the length must match too.
 */
const runStepsCache = new WeakMap<object, { length: number; steps: ToolStep[] }>();

const interpreterRunSteps = (message: Message | undefined): ToolStep[] => {
  const runs = message?.data?.state?.codeInterpreter?.runs;
  if (!Array.isArray(runs) || runs.length === 0) return [];
  const hit = runStepsCache.get(runs);
  if (hit && hit.length === runs.length) return hit.steps;
  const steps = stepsFromInterpreterRuns(message?.data?.state?.codeInterpreter);
  runStepsCache.set(runs, { length: runs.length, steps });
  return steps;
};

/** MCP calls the backend ran: `state.mcpRuns` grows in place while streaming, so key on identity AND length. */
const mcpRunStepsCache = new WeakMap<object, { length: number; steps: ToolStep[] }>();

const mcpRunSteps = (message: Message | undefined): ToolStep[] => {
  const runs = message?.data?.state?.mcpRuns;
  if (!Array.isArray(runs) || runs.length === 0) return [];
  const hit = mcpRunStepsCache.get(runs);
  if (hit && hit.length === runs.length) return hit.steps;
  const steps = stepsFromMcpRuns(message?.data?.state);
  mcpRunStepsCache.set(runs, { length: runs.length, steps });
  return steps;
};

/** MCP calls the browser ran: results on `data.mcpToolResults`, arguments on the message's `tool_calls`. */
const mcpResultStepsCache = new WeakMap<object, { length: number; steps: ToolStep[] }>();

const mcpResultSteps = (message: Message | undefined): ToolStep[] => {
  const results = message?.data?.mcpToolResults;
  if (!Array.isArray(results) || results.length === 0) return [];
  const hit = mcpResultStepsCache.get(results);
  if (hit && hit.length === results.length) return hit.steps;
  const steps = stepsFromMcpToolResults(message);
  mcpResultStepsCache.set(results, { length: results.length, steps });
  return steps;
};

/**
 * Everything the message did, in order: agent-loop tool calls, code-interpreter runs, then MCP calls.
 * MCP rows only exist while the `mcp` feature is on, like the classic card they replace.
 */
const savedSteps = (message: Message | undefined, mcpOn: boolean): ToolStep[] => {
  const agent = agentLogSteps(message);
  const runs = interpreterRunSteps(message);
  const mcp = mcpOn ? [...mcpRunSteps(message), ...mcpResultSteps(message)] : [];
  if (runs.length === 0 && mcp.length === 0) return agent;
  return [...agent, ...runs, ...mcp];
};

/**
 * Does every entry of the classic `data.mcpToolResults` card have a row? Only then may the card be
 * hidden — otherwise a result with no row would show nothing at all.
 */
const mcpCardIsCovered = (message: Message | undefined, mcpOn: boolean): boolean => {
  const results = message?.data?.mcpToolResults;
  return mcpOn && Array.isArray(results) && results.length > 0 && mcpResultSteps(message).length === results.length;
};

/** The steps a message shows: saved wins once present; a still-running MCP call is added from LIVE. */
const stepsToShow = (saved: ToolStep[], live: LiveRun, key: string): ToolStep[] => {
  const liveSteps = live.key === key ? live.steps : [];
  return saved.length > 0 ? withRunningMcpSteps(saved, liveSteps) : liveSteps;
};

// ─── Live status analysis ────────────────────────────────────────────────────

interface StatusAnalysis {
  call: ParsedToolCall | null;
  /** Same test as PromptingStatusDisplay's own filter: would the classic card show? */
  hasVisibleStatus: boolean;
  hasReasoning: boolean;
  reasoningActive: boolean;
  reasoningText: string;
}

/** Same grouping rule as PromptingStatusDisplay: reasoning chunks share the id "reasoning". */
const analyzeStatus = (status: Status[] | undefined): StatusAnalysis => {
  let call: ParsedToolCall | null = null;
  let hasVisibleStatus = false;
  let hasReasoning = false;
  let reasoningActive = false;
  let reasoningText = '';
  for (const s of status ?? []) {
    if (!s) continue;
    if (s.inProgress || s.sticky) hasVisibleStatus = true;
    if (s.id === 'reasoning') {
      if (s.inProgress || s.sticky) hasReasoning = true;
      reasoningActive = reasoningActive || !!s.inProgress;
      reasoningText += typeof s.message === 'string' ? s.message : '';
      continue;
    }
    const parsed = parseLegacyToolStatus(s);
    if (parsed) call = parsed;
  }
  return { call, hasVisibleStatus, hasReasoning, reasoningActive, reasoningText };
};

interface LiveRun {
  /** `${conversationId}:${messageIndex}` of the message being generated. */
  key: string | null;
  steps: ToolStep[];
  ended: boolean;
}

const announceError = (step: ToolStep): string => {
  const m = plainErrorMessage(step);
  return m.linkToConnectors ? `${m.text} Settings, Connectors.` : m.text;
};

// ─── Slots ───────────────────────────────────────────────────────────────────

interface Slot {
  key: string;
  host: HTMLElement;
  /** Index into `selectedConversation.messages` — read fresh at render. */
  index: number;
}

const sameSlots = (a: Slot[], b: Slot[]): boolean =>
  a.length === b.length && a.every((s, i) => s.key === b[i].key && s.host === b[i].host && s.index === b[i].index);

interface SlotViewProps {
  slot: Slot;
  message: Message | undefined;
  live: LiveRun;
  analysis: StatusAnalysis;
  isLiveSlot: boolean;
  mcpOn: boolean;
}

const SlotView: React.FC<SlotViewProps> = ({ slot, message, live, analysis, isLiveSlot, mcpOn }) => {
  const steps = stepsToShow(savedSteps(message, mcpOn), live, slot.key);
  const mcpCovered = mcpCardIsCovered(message, mcpOn);

  const showThinking = isLiveSlot && analysis.hasReasoning;
  const takeOver = steps.length > 0 || showThinking;
  const awaitingAnswer = isAwaitingAnswer({
    isLive: isLiveSlot,
    steps,
    contentEmpty: typeof message?.content !== 'string' || message.content.trim() === '',
    hasVisibleStatus: analysis.hasVisibleStatus,
    showingReasoning: showThinking,
  });

  const reasoningStatus = useMemo<Status>(
    () => ({
      id: 'reasoning',
      summary: '',
      message: analysis.reasoningText,
      type: 'info',
      inProgress: analysis.reasoningActive,
    }),
    [analysis.reasoningText, analysis.reasoningActive],
  );

  // Tell the CSS whether to hide the classic status wrapper. Layout effect so
  // the swap happens before paint (no frame with both visible).
  useLayoutEffect(() => {
    slot.host.setAttribute('data-takeover', takeOver ? 'true' : 'false');
    return () => {
      slot.host.setAttribute('data-takeover', 'false');
    };
  }, [slot.host, takeOver]);

  // The classic MCP result card is hidden only while its rows are on screen.
  useLayoutEffect(() => {
    slot.host.setAttribute('data-mcp-takeover', mcpCovered ? 'true' : 'false');
    return () => {
      slot.host.setAttribute('data-mcp-takeover', 'false');
    };
  }, [slot.host, mcpCovered]);

  // While the answer hasn't started, the CSS collapses the (empty) reply block so
  // the "Thinking…" row sits an even distance from the "Reasoning / Actions" block.
  useLayoutEffect(() => {
    slot.host.setAttribute('data-awaiting', awaitingAnswer ? 'true' : 'false');
    return () => {
      slot.host.setAttribute('data-awaiting', 'false');
    };
  }, [slot.host, awaitingAnswer]);

  if (!takeOver) return null;

  return (
    <MessageToolSteps
      steps={steps}
      awaitingAnswer={awaitingAnswer}
      thinking={
        showThinking
          ? {
              active: analysis.reasoningActive,
              body: analysis.reasoningText.trim() ? <PromptStatusDetails status={reasoningStatus} /> : undefined,
            }
          : null
      }
    />
  );
};

// ─── Layer ───────────────────────────────────────────────────────────────────

const SCAN_THROTTLE_MS = 120;

export const NewUIToolStepsLayer: React.FC = () => {
  const {
    state: { selectedConversation, messageIsStreaming, status },
  } = useContext(HomeContext);

  const mcpOn = !!useStableFeatureFlags().mcp;
  const mcpOnRef = useRef(mcpOn);
  mcpOnRef.current = mcpOn;

  const [slots, setSlots] = useState<Slot[]>([]);
  const [live, setLive] = useState<LiveRun>({ key: null, steps: [], ended: true });

  const conversationRef = useRef(selectedConversation);
  conversationRef.current = selectedConversation;
  const streamingRef = useRef(messageIsStreaming);
  streamingRef.current = messageIsStreaming;

  const messages = selectedConversation?.messages ?? [];
  const lastIndex = messages.length - 1;
  const liveKey =
    selectedConversation && messageIsStreaming && messages[lastIndex]?.role === 'assistant'
      ? `${selectedConversation.id}:${lastIndex}`
      : null;

  const analysis = useMemo(() => analyzeStatus(status), [status]);

  // ── Accumulate live steps ──────────────────────────────────────────────────
  // `status` holds only the LATEST call, so the list has to be built up here.
  // Pure updaters (§15): everything is decided from `prev` + render-time values.
  useEffect(() => {
    if (liveKey) {
      setLive((prev) => {
        const sameRun = prev.key === liveKey && !prev.ended;
        const base = sameRun ? prev.steps : [];
        const next = advanceLiveSteps(base, analysis.call);
        return sameRun && next === base ? prev : { key: liveKey, steps: next, ended: false };
      });
    } else {
      setLive((prev) =>
        prev.ended ? prev : { key: prev.key, steps: advanceLiveSteps(prev.steps, null, true), ended: true },
      );
    }
  }, [analysis.call, liveKey]);

  // ── Scan: place a host at the top of each relevant assistant message ───────
  const scan = useCallback(() => {
    if (typeof document === 'undefined') return;
    const container = document.querySelector('.chatcontainer') as HTMLElement | null;
    const conversation = conversationRef.current;
    if (!container || !conversation) return;

    const all = conversation.messages ?? [];
    const rendered = all
      .map((message, index) => ({ message, index }))
      .filter(({ message }) => message.role !== 'tool' && !(message.data && message.data.actionResult));

    const els = Array.from(
      container.querySelectorAll<HTMLElement>(
        '.enhanced-chat-message.user-message, .enhanced-chat-message.assistant-message',
      ),
    );

    const next: Slot[] = [];
    els.forEach((el, i) => {
      const entry = rendered[i];
      if (!entry || entry.message.role !== 'assistant' || !el.classList.contains('assistant-message')) return;

      const isLast = entry.index === all.length - 1;
      const wanted = (isLast && streamingRef.current) || savedSteps(entry.message, mcpOnRef.current).length > 0;
      if (!wanted) return;

      const hover = el.querySelector<HTMLElement>('#chatHover');
      if (!hover) return;

      let host = hover.querySelector<HTMLElement>(':scope > [data-nui-tools-host]');
      if (!host) {
        host = document.createElement('div');
        host.setAttribute('data-nui-tools-host', 'true');
        host.setAttribute('data-takeover', 'false');
        hover.insertBefore(host, hover.firstChild);
      } else if (hover.firstChild !== host) {
        // Another layer prepended above us (the "awaiting answer" dot) — steps come first.
        hover.insertBefore(host, hover.firstChild);
      }
      next.push({ key: `${conversation.id}:${entry.index}`, host, index: entry.index });
    });

    setSlots((prev) => (sameSlots(prev, next) ? prev : next));
  }, []);

  // Throttled (not debounced): during streaming the transcript mutates every few
  // ms, and a debounce would never fire.
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let scanTimer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      if (scanTimer) return;
      scanTimer = setTimeout(() => {
        scanTimer = null;
        scan();
      }, SCAN_THROTTLE_MS);
    };

    const attach = () => {
      const container = document.querySelector('.chatcontainer') as HTMLElement | null;
      if (!container) {
        retryTimer = setTimeout(attach, 200);
        return;
      }
      scan();
      const observer = new MutationObserver((records) => {
        for (const r of records) {
          // Our own portal content changing must not re-trigger a scan.
          if (r.target instanceof HTMLElement && r.target.closest('[data-nui-tools-host]')) continue;
          schedule();
          return;
        }
      });
      observer.observe(container, { childList: true, subtree: true });
      cleanup = () => {
        observer.disconnect();
        container.querySelectorAll('[data-nui-tools-host]').forEach((h) => h.parentElement?.removeChild(h));
      };
    };

    attach();
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (scanTimer) clearTimeout(scanTimer);
      cleanup?.();
    };
  }, [scan]);

  // A new message, a stream starting/stopping, or a log landing changes who needs a host.
  const lastHasLog = savedSteps(messages[lastIndex], mcpOn).length > 0;
  useEffect(() => {
    const t = setTimeout(scan, SCAN_THROTTLE_MS);
    return () => clearTimeout(t);
  }, [messages.length, messageIsStreaming, lastHasLog, mcpOn, scan]);

  // ── Screen-reader announcement ─────────────────────────────────────────────
  const announcement = useMemo(() => {
    if (!liveKey) return '';
    const current = messages[lastIndex];
    const steps = stepsToShow(savedSteps(current, mcpOn), live, liveKey);
    const failed = steps.find((s) => s.status === 'error');
    if (failed) return announceError(failed);
    const running = [...steps].reverse().find((s) => s.status === 'running');
    if (running) return describeStep(running).running;
    const waiting = isAwaitingAnswer({
      isLive: true,
      steps,
      contentEmpty: typeof current?.content !== 'string' || current.content.trim() === '',
      hasVisibleStatus: analysis.hasVisibleStatus,
      showingReasoning: analysis.hasReasoning,
    });
    return waiting ? 'Thinking…' : '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveKey, live, messages.length, lastHasLog, mcpOn, analysis]);

  return (
    <>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      {slots.map((slot) =>
        createPortal(
          <SlotView
            slot={slot}
            message={messages[slot.index]}
            live={live}
            analysis={analysis}
            isLiveSlot={liveKey === slot.key}
            mcpOn={mcpOn}
          />,
          slot.host,
          slot.key,
        ),
      )}
    </>
  );
};

export default NewUIToolStepsLayer;
