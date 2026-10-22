import { describe, expect, it } from 'vitest';
import {
  TOOL_STEP_CONFIG,
  describeToolStep,
  parseMcpToolName,
  friendlyFolder,
  humanizeToolLabel,
  isHiddenTool,
} from '@/components/NewUI/shared/toolStepLabels';
import {
  advanceLiveSteps,
  describeStep,
  formatParamRows,
  groupTitle,
  isAwaitingAnswer,
  isMcpStep,
  mcpServersUsed,
  stepsFromMcpRuns,
  stepsFromMcpToolResults,
  summarizeMcpResult,
  withRunningMcpSteps,
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


// ─── MCP tool calls ──────────────────────────────────────────────────────────

const FULL = 'mcp_mcp_1767629390657_b1c2812d7_search_issues';

describe('parseMcpToolName / describeToolStep for MCP', () => {
  it('splits the server id from the tool name', () => {
    expect(parseMcpToolName(FULL)).toEqual({ serverId: 'mcp_1767629390657_b1c2812d7', toolName: 'search_issues' });
    expect(parseMcpToolName('mcp_srv_do_thing')).toEqual({ serverId: 'srv', toolName: 'do_thing' });
    expect(parseMcpToolName('microsoftListMessages')).toBeNull();
    expect(parseMcpToolName('mcp_x')).toBeNull();
    expect(parseMcpToolName(undefined as unknown as string)).toBeNull();
  });

  it('never shows the raw prefixed name for a live MCP call', () => {
    const d = describeToolStep(FULL);
    expect(d.category).toBe('mcp');
    expect(d.running).toBe('Calling Search issues…');
    expect(d.done).toBe('Search issues');
    expect(`${d.running} ${d.done}`).not.toContain('1767629390657');
  });
});

describe('parseLegacyToolStatus for MCP', () => {
  it('reads the server-side status', () => {
    expect(parseLegacyToolStatus({ summary: `Executing MCP tool: ${FULL}...`, message: '' })).toEqual({ tool: FULL, args: {} });
  });
  it('reads the browser-side status', () => {
    expect(parseLegacyToolStatus({ summary: 'Executing MCP Tool', message: `Running ${FULL}...` })).toEqual({ tool: FULL, args: {} });
  });
  it('ignores look-alikes', () => {
    expect(parseLegacyToolStatus({ summary: 'MCP tools enabled (server-side)', message: '' })).toBeNull();
    expect(parseLegacyToolStatus({ summary: `MCP tool ${FULL} completed`, message: '' })).toBeNull();
    expect(parseLegacyToolStatus({ summary: 'Executing MCP Tool', message: 'something else' })).toBeNull();
  });
  it('accumulates a live MCP call as one running step', () => {
    const call = { tool: FULL, args: {} };
    const a = advanceLiveSteps([], call);
    expect(a).toHaveLength(1);
    expect(a[0].status).toBe('running');
    expect(advanceLiveSteps(a, call)).toBe(a);
  });
});

describe('stepsFromMcpRuns (backend-run calls)', () => {
  const run = (over: Record<string, unknown> = {}) => ({
    id: 'call_1',
    ok: true,
    tool: 'search_issues',
    serverName: 'GitHub',
    args: { query: 'is:open', limit: 5 },
    result: 'Found some',
    ms: 412,
    ...over,
  });

  it('builds a done step with server, args, result and duration', () => {
    const [s] = stepsFromMcpRuns({ mcpRuns: [run()] });
    expect(s.status).toBe('done');
    expect(s.args).toEqual({ query: 'is:open', limit: 5 });
    expect(s.mcp).toEqual({ toolName: 'search_issues', serverName: 'GitHub', result: 'Found some', ms: 412 });
    expect(isMcpStep(s)).toBe(true);
    expect(describeStep(s)).toMatchObject({ category: 'mcp', running: 'Calling Search issues on GitHub…', done: 'Search issues (GitHub)' });
  });

  it('labels without a server when none is known', () => {
    const [s] = stepsFromMcpRuns({ mcpRuns: [run({ serverName: undefined })] });
    expect(describeStep(s).done).toBe('Search issues');
  });

  it('marks a failed call as an error with the raw reason only in errorDetail/mcp.error', () => {
    const [s] = stepsFromMcpRuns({ mcpRuns: [run({ ok: false, result: undefined, error: 'HTTP 401 Unauthorized' })] });
    expect(s.status).toBe('error');
    expect(s.errorDetail).toBe('HTTP 401 Unauthorized');
    expect(s.mcp?.error).toBe('HTTP 401 Unauthorized');
    expect(plainErrorMessage(s)).toEqual({ text: "Search issues didn't work. Open this step for details.", linkToConnectors: false });
    expect(plainErrorMessage(s).text).not.toContain('401');
  });

  it('treats anything not explicitly ok as failed', () => {
    expect(stepsFromMcpRuns({ mcpRuns: [run({ ok: undefined })] })[0].status).toBe('error');
  });

  it('keeps order and several calls, with unique ids even when an id is missing', () => {
    const steps = stepsFromMcpRuns({ mcpRuns: [run({ id: 'a' }), run({ id: '', tool: 'b' }), run({ id: undefined, tool: 'c' })] });
    expect(steps.map((s) => s.mcp?.toolName)).toEqual(['search_issues', 'b', 'c']);
    expect(new Set(steps.map((s) => s.id)).size).toBe(3);
  });

  it('carries truncation flags, media notes and drops unusable media', () => {
    const [s] = stepsFromMcpRuns({
      mcpRuns: [
        run({
          truncated: { args: true, result: true, bogus: true },
          media: [{ kind: 'image', mimeType: 'image/png' }, null, { kind: 'resource', uri: 'file:///a.csv' }, { kind: 'weird' }],
        }),
      ],
    });
    expect(s.mcp?.truncated).toEqual({ args: true, result: true });
    expect(s.mcp?.media).toEqual([{ kind: 'image', mimeType: 'image/png' }, { kind: 'resource', uri: 'file:///a.csv' }, { kind: 'other' }]);
  });

  it('skips malformed records and non-array state instead of throwing', () => {
    const steps = stepsFromMcpRuns({ mcpRuns: [null, 'x', {}, { id: 'a' }, { tool: '  ' }, { tool: 5 }, run({ args: 'not json{', ms: 'fast' })] });
    expect(steps).toHaveLength(1);
    expect(steps[0].args).toEqual({});
    expect(steps[0].mcp?.ms).toBeUndefined();
    expect(stepsFromMcpRuns(undefined)).toEqual([]);
    expect(stepsFromMcpRuns({})).toEqual([]);
    expect(stepsFromMcpRuns({ mcpRuns: 'nope' })).toEqual([]);
  });

  it('adds a "N results" summary only when the result is clearly a list', () => {
    expect(stepsFromMcpRuns({ mcpRuns: [run({ result: '[{"a":1},{"a":2},{"a":3}]' })] })[0].resultSummary).toBe('3 results');
    expect(stepsFromMcpRuns({ mcpRuns: [run({ result: 'Found 3 things' })] })[0].resultSummary).toBeUndefined();
    expect(stepsFromMcpRuns({ mcpRuns: [run({ ok: false, error: 'x', result: '[1,2]' })] })[0].resultSummary).toBeUndefined();
  });
});

describe('summarizeMcpResult', () => {
  it('counts a JSON list or a results/items list; says nothing otherwise', () => {
    expect(summarizeMcpResult('[1]')).toBe('1 result');
    expect(summarizeMcpResult('[]')).toBe('No results');
    expect(summarizeMcpResult('{"results":[1,2]}')).toBe('2 results');
    expect(summarizeMcpResult('{"items":[1]}')).toBe('1 result');
    expect(summarizeMcpResult('{"data":[1,2]}')).toBeUndefined();
    expect(summarizeMcpResult('{"count": 3}')).toBeUndefined();
    expect(summarizeMcpResult('[1, 2, ')).toBeUndefined(); // cut short by the backend cap
    expect(summarizeMcpResult('plain text')).toBeUndefined();
    expect(summarizeMcpResult(undefined)).toBeUndefined();
  });
});

describe('stepsFromMcpToolResults (browser-run calls)', () => {
  const result = (over: Record<string, unknown> = {}) => ({
    toolName: 'search_issues',
    serverName: 'GitHub',
    content: [{ type: 'text', text: 'Found some' }],
    isError: false,
    ...over,
  });
  const call = (id: string, args: unknown) => ({ id, type: 'function', function: { name: FULL, arguments: args } });
  const message = (results: unknown[], calls?: unknown[]) => ({ role: 'assistant', content: '', tool_calls: calls, data: { mcpToolResults: results } });

  it('pairs each result with its call arguments (JSON string) in order', () => {
    const steps = stepsFromMcpToolResults(
      message([result(), result({ toolName: 'get_issue' })], [call('c1', '{"query":"x"}'), call('c2', '{"number":7}')]),
    );
    expect(steps).toHaveLength(2);
    expect(steps[0].args).toEqual({ query: 'x' });
    expect(steps[1].args).toEqual({ number: 7 });
    expect(steps[0].id).toBe('mcp-res-c1');
    expect(steps[0].mcp).toMatchObject({ toolName: 'search_issues', serverName: 'GitHub', result: 'Found some' });
  });

  it('attaches no arguments when the call list does not line up, or the JSON is broken', () => {
    expect(stepsFromMcpToolResults(message([result()], [call('a', '{}'), call('b', '{}')]))[0].args).toEqual({});
    expect(stepsFromMcpToolResults(message([result()], [call('a', '{oops')]))[0].args).toEqual({});
    expect(stepsFromMcpToolResults(message([result()], [call('a', '[1,2]')]))[0].args).toEqual({});
    expect(stepsFromMcpToolResults(message([result()]))[0].args).toEqual({});
  });

  it('accepts already-parsed object arguments', () => {
    expect(stepsFromMcpToolResults(message([result()], [call('a', { q: 1 })]))[0].args).toEqual({ q: 1 });
  });

  it('shows an error result as a failed step, and reads the bare name from a thrown error', () => {
    const [s] = stepsFromMcpToolResults(
      message([{ toolName: FULL, content: [{ type: 'text', text: 'Error: Failed to parse JSON arguments' }], isError: true }]),
    );
    expect(s.status).toBe('error');
    expect(s.mcp?.toolName).toBe('search_issues');
    expect(s.mcp?.serverName).toBeUndefined();
    expect(s.mcp?.error).toBe('Error: Failed to parse JSON arguments');
    expect(s.mcp?.result).toBeUndefined();
    expect(s.errorDetail).toContain('Failed to parse');
  });

  it('describes non-text parts and keeps only a few safe raster images', () => {
    const png = { type: 'image', mimeType: 'image/png', data: 'AAAA' };
    const [s] = stepsFromMcpToolResults(
      message([
        result({
          content: [
            { type: 'text', text: 'chart' },
            { type: 'resource', uri: 'file:///r.csv' },
            png,
            { type: 'image', mimeType: 'image/svg+xml', data: '<svg onload=alert(1)/>' },
            { type: 'image', mimeType: 'image/png' },
            { type: 'image', mimeType: 'image/jpeg', data: 'BBBB' },
            { type: 'image', mimeType: 'image/gif', data: 'CCCC' },
            { type: 'image', mimeType: 'image/webp', data: 'DDDD' },
          ],
        }),
      ]),
    );
    expect(s.mcp?.images).toEqual([
      { mimeType: 'image/png', data: 'AAAA' },
      { mimeType: 'image/jpeg', data: 'BBBB' },
      { mimeType: 'image/gif', data: 'CCCC' },
    ]);
    expect(s.mcp?.media?.some((m) => m.kind === 'resource' && m.uri === 'file:///r.csv')).toBe(true);
    expect(s.mcp?.media).toHaveLength(5); // described parts are capped
    // The media list describes parts; it never carries a payload.
    expect(JSON.stringify(s.mcp?.media)).not.toContain('AAAA');
  });

  it('cuts a long result and says so', () => {
    const [s] = stepsFromMcpToolResults(message([result({ content: [{ type: 'text', text: 'x'.repeat(9000) }] })]));
    expect(s.mcp?.result).toHaveLength(4000);
    expect(s.mcp?.truncated).toEqual({ result: true });
  });

  it('uses executionTime as the duration', () => {
    expect(stepsFromMcpToolResults(message([result({ executionTime: 250 })]))[0].mcp?.ms).toBe(250);
    expect(stepsFromMcpToolResults(message([result({ executionTime: 'x' })]))[0].mcp?.ms).toBeUndefined();
  });

  it('survives malformed input of every kind', () => {
    for (const bad of [undefined, null, 'x', 5, {}, { data: {} }, { data: { mcpToolResults: 'nope' } }, { data: { mcpToolResults: [] } }]) {
      expect(stepsFromMcpToolResults(bad)).toEqual([]);
    }
    const steps = stepsFromMcpToolResults(message([null, 'x', {}, { toolName: 5 }, { toolName: '  ' }, result({ content: 'not an array' })]));
    expect(steps).toHaveLength(1);
    expect(steps[0].mcp?.result).toBeUndefined();
  });

  it('is the same after a save/reload round trip (JSON)', () => {
    const m = message([result()], [call('c1', '{"query":"x"}')]);
    expect(stepsFromMcpToolResults(JSON.parse(JSON.stringify(m)))).toEqual(stepsFromMcpToolResults(m));
  });
});

describe('MCP in groups', () => {
  const mcp = (serverName?: string, tool = 't'): ToolStep => ({
    id: `m-${tool}-${serverName}`,
    tool: `mcp:${tool}`,
    status: 'done',
    args: {},
    mcp: { toolName: tool, serverName },
  });
  const step = (tool: string): ToolStep => ({ id: tool, tool, status: 'done', args: {} });

  it('names the servers, alongside connectors', () => {
    expect(groupTitle([mcp('GitHub'), mcp('GitHub', 'u')])).toBe('Used GitHub · 2 steps');
    expect(groupTitle([mcp('GitHub'), step('microsoftListMessages'), mcp('Linear')])).toBe('Used Outlook, GitHub and Linear · 3 steps');
    expect(groupTitle([mcp('github'), mcp('GitHub')])).toBe('Used github · 2 steps');
  });

  it('falls back to "Used MCP tools" without server names, and counts failures', () => {
    expect(groupTitle([mcp(), mcp(undefined, 'u')])).toBe('Used MCP tools · 2 steps');
    expect(groupTitle([mcp(), { ...mcp(undefined, 'u'), status: 'error' }])).toBe('Used MCP tools · 2 steps · 1 failed');
    expect(groupTitle([mcp(), step('exec_code')])).toBe('Used tools · 2 steps');
  });

  it('lists servers in first-use order', () => {
    expect(mcpServersUsed([mcp('B'), mcp('A'), mcp('b')])).toEqual(['B', 'A']);
  });
});

describe('withRunningMcpSteps', () => {
  const saved = (n: number): ToolStep[] =>
    Array.from({ length: n }, (_, i) => ({ id: `s${i}`, tool: `mcp:t${i}`, status: 'done' as const, args: {}, mcp: { toolName: `t${i}` } }));
  const live = (statuses: Array<'running' | 'done'>): ToolStep[] =>
    statuses.map((status, i) => ({ id: `l${i}`, tool: `mcp_mcp_1767629390657_b1c2812d7_t${i}`, status, args: {} }));

  it('adds a call that is still running after the saved ones', () => {
    const out = withRunningMcpSteps(saved(1), live(['done', 'running']));
    expect(out).toHaveLength(2);
    expect(out[1].status).toBe('running');
  });
  it('does not duplicate a call whose record already arrived', () => {
    const s = saved(1);
    expect(withRunningMcpSteps(s, live(['running']))).toBe(s);
  });
  it('ignores live steps that are not running, and non-MCP live steps', () => {
    const s = saved(1);
    expect(withRunningMcpSteps(s, live(['done', 'done']))).toBe(s);
    expect(withRunningMcpSteps(s, [{ id: 'x', tool: 'microsoftListMessages', status: 'running', args: {} }])).toBe(s);
  });
});

describe('a message that used a connector and an MCP tool', () => {
  it('describes both in one ordered list', () => {
    const connector = stepsFromAgentLog([
      { role: 'assistant', content: { tool: 'microsoftListMessages', args: {} } },
      { role: 'environment', content: { tool: 'microsoftListMessages', tool_executed: true, result: { data: [1, 2] } } },
    ]);
    const mcp = stepsFromMcpRuns({ mcpRuns: [{ id: 'a', ok: true, tool: 'search_issues', serverName: 'GitHub' }] });
    const all = [...connector, ...mcp];
    expect(groupTitle(all)).toBe('Used Outlook and GitHub · 2 steps');
    expect(describeStep(all[0]).connector).toBe('microsoft_outlook');
    expect(describeStep(all[1]).category).toBe('mcp');
  });
});
