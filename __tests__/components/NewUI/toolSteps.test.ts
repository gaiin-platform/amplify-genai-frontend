import { describe, expect, it } from 'vitest';
import {
  TOOL_STEP_CONFIG,
  describeToolStep,
  friendlyFolder,
  humanizeToolLabel,
  isHiddenTool,
} from '@/components/NewUI/shared/toolStepLabels';
import {
  advanceLiveSteps,
  formatParamRows,
  groupTitle,
  isAwaitingAnswer,
  parseLegacyToolStatus,
  plainErrorMessage,
  stepsFromAgentLog,
  stepsFromInterpreterRuns,
  summarizeResult,
  ToolStep,
} from '@/components/NewUI/shared/toolSteps';

// 2026-10-15 10:55 in Chicago (CDT, UTC-5)
const NOW = new Date('2026-10-15T15:55:00Z');
const CHI = { now: NOW, timeZone: 'America/Chicago', locale: 'en-US' };

/** The exact text utils/app/agent.ts#handleAgentRun builds for a tool call. */
const legacyStatus = (tool: string, args: Record<string, unknown>) => ({
  summary: `Calling: ${tool}`,
  message: [`Calling: ${tool}`, '   with:', ...Object.entries(args).map(([k, v]) => `      ${k}: ${JSON.stringify(v)}`)].join('\n'),
});

const ISSUE_ARGS = {
  folder_id: 'Inbox',
  filter_query: 'receivedDateTime ge 2026-10-15T05:00:00Z and receivedDateTime le 2026-10-15T15:54:03Z',
  include_body: false,
  top: 100,
};

describe('describeToolStep — labels', () => {
  it('reads the reported inbox call as friendly local-time copy', () => {
    const d = describeToolStep('microsoftListMessages', ISSUE_ARGS, CHI);
    expect(d.running).toBe("Searching Inbox for today's messages…");
    expect(d.done).toBe("Searched Inbox for today's messages");
    expect(d.connectorName).toBe('Outlook');
    expect(d.known).toBe(true);
  });

  it('never leaks ISO strings or parameter syntax', () => {
    const d = describeToolStep('microsoftListMessages', ISSUE_ARGS, CHI);
    expect(`${d.running}${d.done}`).not.toMatch(/T\d\d:|filter|receivedDateTime|folder_id/);
  });

  it('falls back to "your inbox" with no date range', () => {
    const d = describeToolStep('microsoftListMessages', { folder_id: 'Inbox', top: 10 }, CHI);
    expect(d.running).toBe('Searching your inbox…');
    expect(d.done).toBe('Searched your inbox');
  });

  it('names a non-inbox well-known folder and hides opaque folder ids', () => {
    expect(describeToolStep('microsoftListMessages', { folder_id: 'sentitems' }, CHI).running).toBe('Searching Sent Items…');
    expect(friendlyFolder('AAMkAGI2THVSAAA=AAMkAGI2THVSAAA=')).toBeNull();
    expect(describeToolStep('microsoftListMessages', { folder_id: 'AAMkAGI2THVSAAA=AAMkAGI2THVSAAA=' }, CHI).running).toBe('Searching your inbox…');
  });

  it('formats yesterday and multi-day ranges in the user zone', () => {
    const yesterday = describeToolStep(
      'microsoftListMessages',
      { filter_query: 'receivedDateTime ge 2026-10-14T05:00:00Z and receivedDateTime le 2026-10-15T04:59:59Z' },
      CHI,
    );
    expect(yesterday.running).toBe("Searching Inbox for yesterday's messages…");

    const span = describeToolStep(
      'microsoftListMessages',
      { filter_query: 'receivedDateTime ge 2026-10-08T05:00:00Z and receivedDateTime le 2026-10-15T15:54:03Z' },
      CHI,
    );
    expect(span.running).toBe('Searching Inbox for messages from Oct 8 to Oct 15…');
  });

  it('uses the zone, not UTC, to decide what "today" is', () => {
    // 02:00Z on the 16th is still the evening of the 15th in Chicago.
    const late = { now: new Date('2026-10-16T02:00:00Z'), timeZone: 'America/Chicago', locale: 'en-US' };
    const d = describeToolStep('microsoftListMessages', { filter_query: 'receivedDateTime ge 2026-10-15T05:00:00Z' }, late);
    expect(d.running).toBe("Searching Inbox for today's messages…");
  });

  it('describes calendar ranges and search terms', () => {
    const cal = describeToolStep(
      'microsoftGetEventsBetweenDates',
      { start_dt: '2026-10-15T05:00:00Z', end_dt: '2026-10-16T05:00:00Z' },
      CHI,
    );
    expect(cal.running).toBe("Checking your calendar for today's events…");
    expect(cal.connectorName).toBe('Calendar');

    const search = describeToolStep('microsoftSearchMessages', { search_query: 'invoice' }, CHI);
    expect(search.running).toBe('Searching your mail for “invoice”…');
  });

  it('survives garbage arguments', () => {
    expect(() => describeToolStep('microsoftListMessages', { filter_query: 42, folder_id: {} } as any, CHI)).not.toThrow();
    expect(describeToolStep('microsoftGetEventsBetweenDates', { start_dt: 'not a date' }, CHI).running).toBe('Checking your calendar…');
  });

  it('humanises unmapped tools, dropping vendor prefixes', () => {
    expect(describeToolStep('microsoftSomethingNew').running).toBe('Something new…');
    expect(describeToolStep('microsoftSomethingNew').known).toBe(false);
    expect(describeToolStep('googleListDocs').done).toBe('List docs');
    expect(describeToolStep('read_email').done).toBe('Read email');
    expect(humanizeToolLabel('microsoftListMessages')).toBe('List messages');
    expect(humanizeToolLabel('microsoft')).toBe('Microsoft');
  });

  it('does not treat Object.prototype keys as tools', () => {
    expect(describeToolStep('constructor').known).toBe(false);
    expect(describeToolStep('toString').known).toBe(false);
  });

  it('hides agent plumbing tools', () => {
    for (const t of ['think', 'terminate', 'finish', 'final_answer']) expect(isHiddenTool(t)).toBe(true);
    expect(isHiddenTool('microsoftListMessages')).toBe(false);
  });

  it('gives every mapped tool a non-empty label pair and a connector or category', () => {
    for (const [tool, cfg] of Object.entries(TOOL_STEP_CONFIG)) {
      const d = describeToolStep(tool, {}, CHI);
      expect(d.running.endsWith('…'), tool).toBe(true);
      expect(d.done.length, tool).toBeGreaterThan(0);
      expect(cfg.connector || cfg.category !== 'generic', tool).toBeTruthy();
    }
  });
});

describe('parseLegacyToolStatus', () => {
  it('recovers tool and typed args from the string handleAgentRun builds', () => {
    expect(parseLegacyToolStatus(legacyStatus('microsoftListMessages', ISSUE_ARGS))).toEqual({
      tool: 'microsoftListMessages',
      args: ISSUE_ARGS,
    });
  });

  it('handles a call with no args and values containing colons / quotes', () => {
    expect(parseLegacyToolStatus(legacyStatus('microsoftListCalendars', {}))).toEqual({ tool: 'microsoftListCalendars', args: {} });
    const args = { subject: 'Re: "Q3" plan: draft', ids: ['a', 'b'], nested: { x: 1 } };
    expect(parseLegacyToolStatus(legacyStatus('microsoftCreateDraft', args))?.args).toEqual(args);
  });

  it('recognises code execution and terminate', () => {
    expect(
      parseLegacyToolStatus({ summary: 'Executing code...', message: '```python\n\nprint(1)\n\n```' }),
    ).toEqual({ tool: 'exec_code', args: { code: 'print(1)' } });
    expect(parseLegacyToolStatus({ summary: 'Hold on...', message: '' })?.tool).toBe('terminate');
  });

  it('ignores everything that is not a tool call', () => {
    expect(parseLegacyToolStatus({ summary: 'Contemplating...', message: '' })).toBeNull();
    expect(parseLegacyToolStatus({ summary: 'Thinking Details:', message: 'reasoning…' })).toBeNull();
    expect(parseLegacyToolStatus(undefined)).toBeNull();
    expect(parseLegacyToolStatus({ summary: 3 as any, message: null as any })).toBeNull();
  });
});

describe('advanceLiveSteps', () => {
  const call = (tool: string, args: Record<string, unknown> = {}) => ({ tool, args });

  it('starts a running step, and repeated polls of the same call change nothing', () => {
    const one = advanceLiveSteps([], call('microsoftListMessages', { top: 5 }));
    expect(one).toHaveLength(1);
    expect(one[0]).toMatchObject({ id: 's0', status: 'running', tool: 'microsoftListMessages' });
    expect(advanceLiveSteps(one, call('microsoftListMessages', { top: 5 }))).toBe(one);
  });

  it('closes the previous step when a different call arrives', () => {
    let steps = advanceLiveSteps([], call('microsoftListMessages'));
    steps = advanceLiveSteps(steps, call('microsoftGetMessageDetails', { id: '1' }));
    expect(steps.map((s) => [s.id, s.status])).toEqual([['s0', 'done'], ['s1', 'running']]);
  });

  it('treats the same tool with different args as a new step', () => {
    let steps = advanceLiveSteps([], call('microsoftGetMessageDetails', { id: '1' }));
    steps = advanceLiveSteps(steps, call('microsoftGetMessageDetails', { id: '2' }));
    expect(steps).toHaveLength(2);
  });

  it('terminate closes without adding a row; finished closes everything', () => {
    let steps = advanceLiveSteps([], call('microsoftListMessages'));
    expect(advanceLiveSteps(steps, call('terminate'))).toEqual([{ ...steps[0], status: 'done' }]);
    expect(advanceLiveSteps(steps, null, true)[0].status).toBe('done');
  });

  it('returns the same array when there is nothing to do', () => {
    const steps = advanceLiveSteps([], call('microsoftListMessages'));
    expect(advanceLiveSteps(steps, null)).toBe(steps);
    expect(advanceLiveSteps([], null)).toEqual([]);
  });
});

describe('stepsFromAgentLog', () => {
  const log = (entries: unknown[]) => ({ data: { result: entries } });

  it('pairs each call with its outcome and counts list results', () => {
    const steps = stepsFromAgentLog(
      log([
        { role: 'user', content: 'what did I get today?' },
        { role: 'assistant', content: { tool: 'microsoftListMessages', args: ISSUE_ARGS } },
        { role: 'environment', content: { tool: 'microsoftListMessages', tool_executed: true, result: { success: true, data: new Array(12).fill({}) } } },
        { role: 'assistant', content: { tool: 'microsoftListCalendars', args: {} } },
        { role: 'environment', content: { tool: 'microsoftListCalendars', tool_executed: true, result: [{}] } },
        { role: 'assistant', content: { tool: 'terminate', args: { message: 'done' } } },
        { role: 'environment', content: { total_token_cost: 0.1 } },
      ]),
    );
    expect(steps).toEqual([
      { id: 's0', tool: 'microsoftListMessages', status: 'done', args: ISSUE_ARGS, resultSummary: '12 messages' },
      { id: 's1', tool: 'microsoftListCalendars', status: 'done', args: {}, resultSummary: '1 calendar' },
    ]);
  });

  it('marks failures, keeping the raw text for the details only', () => {
    const steps = stepsFromAgentLog(
      log([
        { role: 'assistant', content: { tool: 'microsoftListMessages', args: {} } },
        { role: 'environment', content: { tool: 'microsoftListMessages', tool_executed: false, error: 'HTTPSConnectionPool: timeout' } },
        { role: 'assistant', content: { tool: 'microsoftSendDraft', args: {} } },
        { role: 'environment', content: { tool: 'microsoftSendDraft', tool_executed: true, result: { success: false, error: '401 Unauthorized' } } },
      ]),
    );
    expect(steps.map((s) => s.status)).toEqual(['error', 'error']);
    expect(steps[0].errorDetail).toBe('HTTPSConnectionPool: timeout');
    expect(steps[1].errorDetail).toBe('401 Unauthorized');
    expect(plainErrorMessage(steps[0])).toEqual({ text: "Couldn't reach Outlook. Check your connection in", linkToConnectors: true });
    expect(plainErrorMessage(steps[1]).text).toMatch(/Couldn't sign in to Outlook/);
  });

  it('gives no summary when the count is not readily available', () => {
    expect(summarizeResult('microsoftGetMessageDetails', [{}, {}])).toBeUndefined(); // no unit
    expect(summarizeResult('microsoftListMessages', { success: true })).toBeUndefined(); // no list
    expect(summarizeResult('microsoftListMessages', [])).toBe('No messages');
  });

  it('treats a call with no recorded outcome as done, and tolerates junk', () => {
    const steps = stepsFromAgentLog(log([{ role: 'assistant', content: { tool: 'microsoftListMessages', args: {} } }]));
    expect(steps[0].status).toBe('done');
    expect(stepsFromAgentLog(undefined)).toEqual([]);
    expect(stepsFromAgentLog({})).toEqual([]);
    expect(stepsFromAgentLog(log([null, 'x', { role: 'assistant', content: 'plain text' }]))).toEqual([]);
  });

  it('accepts the bare-array shape', () => {
    expect(stepsFromAgentLog([{ role: 'assistant', content: { tool: 'exec_code', args: { code: 'x=1' } } }])).toHaveLength(1);
  });
});

describe('grouping and copy', () => {
  const step = (tool: string, status: ToolStep['status'] = 'done'): ToolStep => ({ id: tool, tool, status, args: {} });

  it('summarises by connector and step count', () => {
    expect(groupTitle([step('microsoftListMessages'), step('microsoftGetMessageDetails')])).toBe('Used Outlook · 2 steps');
    expect(groupTitle([step('microsoftListMessages')])).toBe('Used Outlook · 1 step');
    expect(groupTitle([step('microsoftListMessages'), step('microsoftListCalendars')])).toBe('Used Outlook and Calendar · 2 steps');
    expect(groupTitle([step('exec_code')])).toBe('Ran code · 1 step');
    expect(groupTitle([step('someOtherTool'), step('another')])).toBe('Used tools · 2 steps');
    expect(groupTitle([step('microsoftListMessages'), step('microsoftSendDraft', 'error')])).toBe('Used Outlook · 2 steps · 1 failed');
  });

  it('gives non-connector failures a generic line with no connectors link', () => {
    expect(plainErrorMessage(step('exec_code', 'error'))).toEqual({ text: "This step didn't finish.", linkToConnectors: false });
  });

  it('renders parameters as key/value rows', () => {
    expect(formatParamRows({ folder_id: 'Inbox', top: 100, include_body: false, ids: ['a'] })).toEqual([
      { key: 'folder_id', value: 'Inbox' },
      { key: 'top', value: '100' },
      { key: 'include_body', value: 'false' },
      { key: 'ids', value: '["a"]' },
    ]);
  });
});

describe('isAwaitingAnswer', () => {
  const done: ToolStep = { id: 's0', tool: 'microsoftListMessages', status: 'done', args: {} };
  const base = { isLive: true, steps: [done], contentEmpty: true, hasVisibleStatus: true, showingReasoning: false };

  it('is true in the gap after the last tool finished and before the first answer token', () => {
    expect(isAwaitingAnswer(base)).toBe(true);
  });

  it('is false while a step is still running (it has its own spinner)', () => {
    expect(isAwaitingAnswer({ ...base, steps: [{ ...done, status: 'running' }] })).toBe(false);
  });

  it('is false once answer text exists, or the message is not live', () => {
    expect(isAwaitingAnswer({ ...base, contentEmpty: false })).toBe(false);
    expect(isAwaitingAnswer({ ...base, isLive: false })).toBe(false);
  });

  it('is false when no status is visible (the shell shows its own dot then) or reasoning is already shown', () => {
    expect(isAwaitingAnswer({ ...base, hasVisibleStatus: false })).toBe(false);
    expect(isAwaitingAnswer({ ...base, showingReasoning: true })).toBe(false);
  });

  it('is false with no steps (the classic Thinking row is still visible then)', () => {
    expect(isAwaitingAnswer({ ...base, steps: [] })).toBe(false);
  });
});

describe('stepsFromInterpreterRuns', () => {
  const run = (over: Record<string, unknown> = {}) => ({ id: 'call_1', ok: true, code: 'print(1)', ...over });

  it('turns each run into an exec_code step, in order, with the model\'s description as the title', () => {
    const steps = stepsFromInterpreterRuns({
      runs: [
        run({ description: 'Calculated monthly revenue', stdout: '42\n' }),
        run({ id: 'call_2', description: 'Charted sales', files: [{ name: 'sales.png', type: 'image/png' }] }),
      ],
    });
    expect(steps.map((s) => [s.id, s.tool, s.status, s.title])).toEqual([
      ['ci-call_1', 'exec_code', 'done', 'Calculated monthly revenue'],
      ['ci-call_2', 'exec_code', 'done', 'Charted sales'],
    ]);
    expect(steps[0].detail).toEqual({ code: 'print(1)', output: '42\n' });
    expect(steps[1].detail?.files).toEqual([{ name: 'sales.png', type: 'image/png' }]);
  });

  it('summarises only what is certain: files created, else printed output, else nothing', () => {
    const [files, one, printed, nothing] = stepsFromInterpreterRuns({
      runs: [
        run({ id: 'a', files: [{ name: 'a.csv' }, { name: 'b.csv' }] }),
        run({ id: 'b', files: [{ name: 'a.csv' }] }),
        run({ id: 'c', stdout: 'hi' }),
        run({ id: 'd' }),
      ],
    });
    expect(files.resultSummary).toBe('2 files created');
    expect(one.resultSummary).toBe('1 file created');
    expect(printed.resultSummary).toBe('Printed output');
    expect(nothing.resultSummary).toBeUndefined();
  });

  it('marks a failed run as an error and keeps the Python error out of the summary', () => {
    const [s] = stepsFromInterpreterRuns({ runs: [run({ ok: false, code: '1/0', error: 'ZeroDivisionError: division by zero' })] });
    expect(s.status).toBe('error');
    expect(s.resultSummary).toBeUndefined();
    expect(s.errorDetail).toBe('ZeroDivisionError: division by zero');
    expect(s.detail?.error).toBe('ZeroDivisionError: division by zero');
    expect(plainErrorMessage(s)).toEqual({ text: 'The code hit an error.', linkToConnectors: false });
    // the agent loop's exec_code (no detail) keeps its generic line
    expect(plainErrorMessage({ ...s, detail: undefined })).toEqual({ text: "This step didn't finish.", linkToConnectors: false });
  });

  it('treats anything not explicitly ok as failed', () => {
    expect(stepsFromInterpreterRuns({ runs: [run({ ok: undefined })] })[0].status).toBe('error');
  });

  it('carries truncation flags and ignores blank descriptions', () => {
    const [s] = stepsFromInterpreterRuns({ runs: [run({ description: '   ', truncated: { stdout: true, bogus: true } })] });
    expect(s.title).toBeUndefined();
    expect(s.detail?.truncated).toEqual({ stdout: true });
  });

  it('skips malformed runs and files instead of throwing', () => {
    const steps = stepsFromInterpreterRuns({
      runs: [null, 'x', {}, { id: 1, code: 'x' }, { id: 'no-code' }, run({ id: 'good', files: [null, { name: 5 }, { name: 'ok.txt' }] })],
    });
    expect(steps).toHaveLength(1);
    expect(steps[0].detail?.files).toEqual([{ name: 'ok.txt', type: undefined }]);
  });

  it('returns no steps for missing or non-array state', () => {
    expect(stepsFromInterpreterRuns(undefined)).toEqual([]);
    expect(stepsFromInterpreterRuns({})).toEqual([]);
    expect(stepsFromInterpreterRuns({ runs: 'nope' })).toEqual([]);
    expect(stepsFromInterpreterRuns({ error: 'session', content: [] })).toEqual([]);
  });

  it('titles a group of only code runs "Ran code"', () => {
    const steps = stepsFromInterpreterRuns({ runs: [run({ id: 'a' }), run({ id: 'b' })] });
    expect(groupTitle(steps)).toBe('Ran code · 2 steps');
  });
});
