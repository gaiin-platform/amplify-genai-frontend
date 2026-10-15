/**
 * ToolStepViews — presentational pieces for the chat's tool-call status.
 *
 *   ToolStepRow        one line per call: icon · label (· result) · status · chevron;
 *                      expands to the raw parameters (and raw error text).
 *   ToolStepGroup      several calls stacked under one header; collapses to
 *                      "Used Outlook · 2 steps" once nothing is running.
 *   ThinkingRow        model reasoning — deliberately NOT styled like a tool step.
 *   MessageToolSteps   the composition a message gets.
 *
 * Pure props → markup (no context, no portals, no DOM scanning) so it renders
 * to static markup in tests. Styling lives in styles/conversation-view.css
 * under the `nui-step*` / `nui-thinking*` classes, token-based for light/dark.
 *
 * Accessibility: every toggle is a <button> with aria-expanded; decorative icons
 * are aria-hidden and each status carries visually-hidden text. Live
 * announcements are NOT made here — NewUIToolStepsLayer owns one persistent
 * aria-live region, because a region that mounts together with its first text
 * is often not announced.
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import {
  IconAddressBook,
  IconAlertTriangle,
  IconCalendar,
  IconChecklist,
  IconCheck,
  IconCode,
  IconCopy,
  IconFile,
  IconFileText,
  IconMail,
  IconMessages,
  IconNotes,
  IconTable,
  IconTool,
  IconUsers,
  IconWorld,
} from '@tabler/icons-react';
import { DisclosureChevron } from '@/components/NewUI/shared/DisclosureChevron';
import { integrationIcon } from '@/components/NewUI/shared/integrationIcon';
import {
  ToolCategory,
  ToolStepDescription,
  describeToolStep,
} from '@/components/NewUI/shared/toolStepLabels';
import {
  ToolStep,
  formatParamRows,
  groupTitle,
  plainErrorMessage,
} from '@/components/NewUI/shared/toolSteps';

// ─── Icons ───────────────────────────────────────────────────────────────────

const CATEGORY_ICON: Record<ToolCategory, React.ComponentType<{ size?: number; stroke?: number }>> = {
  mail: IconMail,
  calendar: IconCalendar,
  file: IconFile,
  site: IconWorld,
  spreadsheet: IconTable,
  document: IconFileText,
  notes: IconNotes,
  tasks: IconChecklist,
  chat: IconMessages,
  contacts: IconAddressBook,
  people: IconUsers,
  code: IconCode,
  generic: IconTool,
};

/** The connector's brand icon when we have one, else a generic icon for the category. */
const StepIcon: React.FC<{ desc: Pick<ToolStepDescription, 'connector' | 'category'> }> = ({ desc }) => {
  const Fallback = CATEGORY_ICON[desc.category] ?? IconTool;
  return (
    <span className="nui-step-icon" aria-hidden="true">
      {desc.connector ? integrationIcon(desc.connector, 16) : <Fallback size={16} stroke={1.75} />}
    </span>
  );
};

// ─── Status indicator ────────────────────────────────────────────────────────

const STATUS_TEXT: Record<ToolStep['status'], string> = {
  running: 'In progress',
  done: 'Done',
  error: 'Failed',
};

/**
 * Running: a small rotating arc — or, under prefers-reduced-motion, a static dot
 * (CSS swaps the two; neither rotates or pulses). Done: muted check.
 * Error: warning icon.
 */
const StatusIndicator: React.FC<{ status: ToolStep['status'] }> = ({ status }) => (
  <span className="nui-step-status" data-status={status}>
    {status === 'running' && (
      <>
        <svg className="nui-step-spinner" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <circle
            cx="7"
            cy="7"
            r="5.25"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="24.7 8.3"
          />
        </svg>
        <span className="nui-step-static-dot" aria-hidden="true" />
      </>
    )}
    {status === 'done' && <IconCheck size={14} stroke={2} aria-hidden="true" />}
    {status === 'error' && <IconAlertTriangle size={14} stroke={2} aria-hidden="true" />}
    <span className="sr-only">{STATUS_TEXT[status]}</span>
  </span>
);

// ─── Labels ──────────────────────────────────────────────────────────────────

const stepLabel = (step: ToolStep, desc: ToolStepDescription): string => {
  if (step.status === 'running') return desc.running;
  if (step.status === 'error') return desc.running.replace(/…$/, '');
  return desc.done;
};

const openConnectorsSettings = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('openNewUISettingsSection', { detail: { section: 'connectors' } }));
};

// ─── Truncation tooltip ──────────────────────────────────────────────────────

/**
 * The label only truncates when it genuinely exceeds the column (no max-width or
 * character cap anywhere). When it does, the full text is offered as a tooltip;
 * `title` is left off otherwise so a fitting label doesn't grow a pointless one.
 */
function useTruncationTitle(fullText: string) {
  const ref = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setTruncated(el.scrollWidth > el.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fullText]);

  return { ref, title: truncated ? fullText : undefined };
}

// ─── Details panel ───────────────────────────────────────────────────────────

interface ToolStepDetailsProps {
  id?: string;
  args: Record<string, unknown>;
  errorDetail?: string;
}

/**
 * Raw parameters as a two-column grid (muted keys, primary values, one shared
 * left edge for every value) with a copy-as-JSON button in the top-right corner.
 */
export const ToolStepDetails: React.FC<ToolStepDetailsProps> = ({ id, args, errorDetail }) => {
  const params = formatParamRows(args);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(args, null, 2));
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (insecure context / denied) — nothing useful to show */
    }
  };

  return (
    <div id={id} className="nui-step-details">
      {params.length > 0 ? (
        <>
          <button
            type="button"
            className="nui-step-copy"
            onClick={copy}
            aria-label={copied ? 'Parameters copied' : 'Copy parameters as JSON'}
            title={copied ? 'Copied' : 'Copy parameters as JSON'}
          >
            {copied ? <IconCheck size={14} stroke={2} aria-hidden="true" /> : <IconCopy size={14} stroke={1.75} aria-hidden="true" />}
          </button>
          <dl className="nui-step-params">
            {params.map(({ key, value }) => (
              <React.Fragment key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </React.Fragment>
            ))}
          </dl>
        </>
      ) : (
        <div className="nui-step-params-empty">No parameters</div>
      )}
      {errorDetail && (
        <div className="nui-step-raw-error">
          <div className="nui-step-raw-error-title">Error details</div>
          <div className="nui-step-raw-error-text">{errorDetail}</div>
        </div>
      )}
    </div>
  );
};

// ─── One step ────────────────────────────────────────────────────────────────

interface ToolStepRowProps {
  step: ToolStep;
  /** Reference time for "today's…" copy; defaults to render time. */
  now?: Date;
  /** Override for tests; defaults to opening Settings → Connectors. */
  onOpenConnectors?: () => void;
}

export const ToolStepRow: React.FC<ToolStepRowProps> = ({ step, now, onOpenConnectors = openConnectorsSettings }) => {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const desc = describeToolStep(step.tool, step.args, { now });
  const label = stepLabel(step, desc);
  const error = step.status === 'error' ? plainErrorMessage(step) : null;
  const fullText = step.status === 'done' && step.resultSummary ? `${label} · ${step.resultSummary}` : label;
  const { ref: textRef, title } = useTruncationTitle(fullText);

  return (
    <div className="nui-step" data-status={step.status}>
      <button
        type="button"
        className="nui-step-line"
        aria-expanded={open}
        aria-controls={open ? detailsId : undefined}
        title={title}
        onClick={() => setOpen((v) => !v)}
      >
        <StepIcon desc={desc} />
        <span className="nui-step-text" ref={textRef}>
          <span className="nui-step-label">{label}</span>
          {step.status === 'done' && step.resultSummary && (
            <span className="nui-step-summary"> · {step.resultSummary}</span>
          )}
        </span>
        <StatusIndicator status={step.status} />
        <DisclosureChevron open={open} size={12} />
      </button>

      {error && (
        <div className="nui-step-error">
          {error.text}
          {error.linkToConnectors && (
            <>
              {' '}
              <button type="button" className="nui-step-link" onClick={onOpenConnectors}>
                Settings → Connectors
              </button>
              .
            </>
          )}
        </div>
      )}

      {open && <ToolStepDetails id={detailsId} args={step.args} errorDetail={step.errorDetail} />}
    </div>
  );
};

// ─── A group of steps ────────────────────────────────────────────────────────

interface ToolStepGroupProps {
  steps: ToolStep[];
  now?: Date;
  onOpenConnectors?: () => void;
}

export const ToolStepGroup: React.FC<ToolStepGroupProps> = ({ steps, now, onOpenConnectors }) => {
  // null = the user hasn't touched it: open while something runs, closed once it's all settled.
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const bodyId = useId();

  const running = [...steps].reverse().find((s) => s.status === 'running');
  const open = userOpen ?? !!running;

  const headDesc = describeToolStep((running ?? steps[0]).tool, (running ?? steps[0]).args, { now });
  const connectors = new Set(steps.map((s) => describeToolStep(s.tool).connector).filter(Boolean));
  const headIcon: Pick<ToolStepDescription, 'connector' | 'category'> =
    connectors.size === 1 ? headDesc : { connector: undefined, category: 'generic' };

  const headText = running ? headDesc.running : groupTitle(steps);
  const { ref: headTextRef, title: headTitle } = useTruncationTitle(headText);

  return (
    <div className="nui-steps" data-open={open ? 'true' : 'false'}>
      <button
        type="button"
        className="nui-step-line nui-group-head"
        aria-expanded={open}
        aria-controls={open ? bodyId : undefined}
        title={headTitle}
        onClick={() => setUserOpen(!open)}
      >
        <StepIcon desc={headIcon} />
        <span className="nui-step-text" ref={headTextRef}>
          <span className="nui-step-label">{headText}</span>
        </span>
        {/* While open, the running row below carries the spinner — don't show two. */}
        {running && !open && <StatusIndicator status="running" />}
        <DisclosureChevron open={open} size={12} />
      </button>

      {open && (
        <div id={bodyId} className="nui-group-body">
          {steps.map((s) => (
            <ToolStepRow key={s.id} step={s} now={now} onOpenConnectors={onOpenConnectors} />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Model reasoning ─────────────────────────────────────────────────────────

interface ThinkingRowProps {
  /** Pulses while the model is still reasoning. */
  active: boolean;
  /** Present when there is reasoning text to reveal; absent → a plain label, no toggle. */
  children?: React.ReactNode;
}

export const ThinkingRow: React.FC<ThinkingRowProps> = ({ active, children }) => {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const hasBody = !!children;

  const inner = (
    <>
      <span className="nui-thinking-dot" aria-hidden="true" />
      <span className="nui-thinking-label">Thinking…</span>
    </>
  );

  return (
    <div className="nui-thinking" data-active={active ? 'true' : 'false'}>
      {hasBody ? (
        <button
          type="button"
          className="nui-thinking-line"
          aria-expanded={open}
          aria-controls={open ? bodyId : undefined}
          onClick={() => setOpen((v) => !v)}
        >
          {inner}
          <DisclosureChevron open={open} size={12} />
        </button>
      ) : (
        <div className="nui-thinking-line">{inner}</div>
      )}
      {hasBody && open && (
        <div id={bodyId} className="nui-thinking-body">
          {children}
        </div>
      )}
    </div>
  );
};

// ─── What a message shows ────────────────────────────────────────────────────

interface MessageToolStepsProps {
  steps: ToolStep[];
  /** Model reasoning to show above the steps (live only). */
  thinking?: { active: boolean; body?: React.ReactNode } | null;
  /** All steps are done but the answer hasn't started: a quiet "Thinking…" after the steps. */
  awaitingAnswer?: boolean;
  now?: Date;
  onOpenConnectors?: () => void;
}

export const MessageToolSteps: React.FC<MessageToolStepsProps> = ({
  steps,
  thinking,
  awaitingAnswer = false,
  now,
  onOpenConnectors,
}) => (
  <div className="nui-ts-root">
    {thinking && <ThinkingRow active={thinking.active}>{thinking.body}</ThinkingRow>}
    {steps.length === 1 && <ToolStepRow step={steps[0]} now={now} onOpenConnectors={onOpenConnectors} />}
    {steps.length > 1 && <ToolStepGroup steps={steps} now={now} onOpenConnectors={onOpenConnectors} />}
    {awaitingAnswer && <ThinkingRow active />}
  </div>
);
