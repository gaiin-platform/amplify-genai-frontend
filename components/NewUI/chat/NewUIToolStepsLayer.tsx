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
 *        • SAVED  — `message.data.state.agentLog` (shared/toolSteps#stepsFromAgentLog).
 *                   Authoritative: it carries errors and result counts, and it is
 *                   what a reloaded conversation shows. Wins over LIVE once present.
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
import { describeToolStep } from '@/components/NewUI/shared/toolStepLabels';
import {
  ParsedToolCall,
  ToolStep,
  advanceLiveSteps,
  isAwaitingAnswer,
  parseLegacyToolStatus,
  plainErrorMessage,
  stepsFromAgentLog,
} from '@/components/NewUI/shared/toolSteps';
import { MessageToolSteps } from './ToolStepViews';

// ─── Saved steps (cached) ────────────────────────────────────────────────────

/** Decompressing + parsing an agent log is not free; key on the stored value itself. */
const savedStepsCache = new WeakMap<object, ToolStep[]>();

const savedSteps = (message: Message | undefined): ToolStep[] => {
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
}

const SlotView: React.FC<SlotViewProps> = ({ slot, message, live, analysis, isLiveSlot }) => {
  const saved = savedSteps(message);
  const steps = saved.length > 0 ? saved : live.key === slot.key ? live.steps : [];

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
      const wanted = (isLast && streamingRef.current) || savedSteps(entry.message).length > 0;
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
  const lastHasLog = savedSteps(messages[lastIndex]).length > 0;
  useEffect(() => {
    const t = setTimeout(scan, SCAN_THROTTLE_MS);
    return () => clearTimeout(t);
  }, [messages.length, messageIsStreaming, lastHasLog, scan]);

  // ── Screen-reader announcement ─────────────────────────────────────────────
  const announcement = useMemo(() => {
    if (!liveKey) return '';
    const current = messages[lastIndex];
    const saved = savedSteps(current);
    const steps = saved.length > 0 ? saved : live.key === liveKey ? live.steps : [];
    const failed = steps.find((s) => s.status === 'error');
    if (failed) return announceError(failed);
    const running = [...steps].reverse().find((s) => s.status === 'running');
    if (running) return describeToolStep(running.tool, running.args).running;
    const waiting = isAwaitingAnswer({
      isLive: true,
      steps,
      contentEmpty: typeof current?.content !== 'string' || current.content.trim() === '',
      hasVisibleStatus: analysis.hasVisibleStatus,
      showingReasoning: analysis.hasReasoning,
    });
    return waiting ? 'Thinking…' : '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveKey, live, messages.length, lastHasLog, analysis]);

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
          />,
          slot.host,
          slot.key,
        ),
      )}
    </>
  );
};

export default NewUIToolStepsLayer;
