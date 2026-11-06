/**
 * NewUIAgentLog
 *
 * A saved agent log (the "Reasoning / Actions" data) rendered as the same step rows the chat uses —
 * label, status, and an expandable parameters / Result panel with Raw and Raw log — instead of the
 * classic AgentLogBlock cards. Used where a log is shown outside a chat message (Scheduled Tasks →
 * run logs → Execution Details), where NewUIToolStepsLayer has no message to attach to.
 *
 * Presentation only: it reads `result` as given and never writes or reshapes it.
 *
 * When the log has no tool steps (e.g. only a final message), `fallback` is rendered instead, so a
 * run never shows less than it did before.
 */

import React, { useMemo } from 'react';
import { stepsFromAgentLog } from '@/components/NewUI/shared/toolSteps';
import { MessageToolSteps } from './ToolStepViews';

interface NewUIAgentLogProps {
  /** The log's entries: `[{ role, content }, …]` (the `result` of `{ data: { result } }`). */
  result: unknown;
  /**
   * When the run happened. Date-relative labels ("today's messages") are worded against this, not
   * against the moment the log is opened.
   */
  executedAt?: string | number | Date;
  /** Shown when the log has no tool steps. */
  fallback?: React.ReactNode;
}

const toDate = (value: NewUIAgentLogProps['executedAt']): Date | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

export const NewUIAgentLog: React.FC<NewUIAgentLogProps> = ({ result, executedAt, fallback = null }) => {
  const log = useMemo(() => ({ data: { result } }), [result]);
  const steps = useMemo(() => stepsFromAgentLog(log), [log]);
  const now = useMemo(() => toDate(executedAt), [executedAt]);

  if (steps.length === 0) return <>{fallback}</>;
  return <MessageToolSteps steps={steps} rawLog={log} now={now} />;
};

export default NewUIAgentLog;
