/**
 * NewUIAgentLog
 *
 * A saved agent log (the data behind the old "Reasoning / Actions" disclosure) rendered as the same
 * step rows the chat uses — label, status, and an expandable parameters / Result panel with Raw and
 * Raw log. Used where a log is shown outside a chat message (Scheduled Tasks → run logs →
 * Execution Details), where NewUIToolStepsLayer has no message to attach to.
 *
 * Presentation only: it reads `result` as given and never writes or reshapes it.
 *
 * The classic "Reasoning / Actions" disclosure is never rendered here. When the log has no visible
 * tool steps (e.g. only a final `terminate` message) the final message is shown as plain text, or
 * nothing when there is none.
 */

import React, { useMemo } from 'react';
import { finalMessageFromAgentLog, stepsFromAgentLog } from '@/components/NewUI/shared/toolSteps';
import { MessageToolSteps } from './ToolStepViews';

interface NewUIAgentLogProps {
  /** The log's entries: `[{ role, content }, …]` (the `result` of `{ data: { result } }`). */
  result: unknown;
  /**
   * When the run happened. Date-relative labels ("today's messages") are worded against this, not
   * against the moment the log is opened.
   */
  executedAt?: string | number | Date;
}

const toDate = (value: NewUIAgentLogProps['executedAt']): Date | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

export const NewUIAgentLog: React.FC<NewUIAgentLogProps> = ({ result, executedAt }) => {
  const log = useMemo(() => ({ data: { result } }), [result]);
  const steps = useMemo(() => stepsFromAgentLog(log), [log]);
  const finalMessage = useMemo(() => finalMessageFromAgentLog(log), [log]);
  const now = useMemo(() => toDate(executedAt), [executedAt]);

  if (steps.length === 0) {
    return finalMessage ? (
      <div className="whitespace-pre-wrap break-words" data-nui-agentlog-final="true">
        {finalMessage}
      </div>
    ) : null;
  }
  return <MessageToolSteps steps={steps} rawLog={log} now={now} />;
};

export default NewUIAgentLog;
