import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// next/image needs the Next runtime; the brand icon only matters as an <img>.
vi.mock('next/image', () => ({
  default: (props: any) => React.createElement('img', { src: props.src, alt: props.alt, 'data-testid': 'brand-icon' }),
}));

import {
  CodeRunDetails,
  MessageToolSteps,
  ThinkingRow,
  ToolStepDetails,
  ToolStepGroup,
  ToolStepRow,
} from '@/components/NewUI/chat/ToolStepViews';
import type { ToolStep } from '@/components/NewUI/shared/toolSteps';

const step = (over: Partial<ToolStep> = {}): ToolStep => ({
  id: 's0',
  tool: 'microsoftListMessages',
  status: 'done',
  args: { folder_id: 'Inbox', top: 100 },
  ...over,
});

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe('ToolStepRow', () => {
  it('renders a running step as a friendly label with a spinner, collapsed, with no raw syntax', () => {
    const out = html(<ToolStepRow step={step({ status: 'running' })} />);
    expect(out).toContain('Searching your inbox…');
    expect(out).toContain('nui-step-spinner');
    expect(out).toContain('nui-step-static-dot'); // CSS swaps it in under reduced motion
    expect(out).toContain('In progress');
    expect(out).toMatch(/<button[^>]*aria-expanded="false"/);
    expect(out).not.toMatch(/Calling:|microsoftListMessages|folder_id|top|nui-step-details/);
  });

  it('uses the connector brand icon when there is one, a generic icon otherwise', () => {
    expect(html(<ToolStepRow step={step()} />)).toContain('/logos/integrations/microsoft-outlook.svg');
    const generic = html(<ToolStepRow step={step({ tool: 'someCustomTool' })} />);
    expect(generic).not.toContain('brand-icon');
    expect(generic).toContain('nui-step-icon');
  });

  it('shows a done step with a muted check and the result summary when known', () => {
    const out = html(<ToolStepRow step={step({ resultSummary: '12 messages' })} />);
    expect(out).toContain('Searched your inbox');
    expect(out).toContain('nui-step-summary');
    expect(out).toContain(' · 12 messages');
    expect(out).toContain('data-status="done"');
    expect(html(<ToolStepRow step={step()} />)).not.toContain('nui-step-summary');
  });

  it('humanises an unmapped tool', () => {
    const out = html(<ToolStepRow step={step({ tool: 'microsoftBrandNewThing', status: 'running' })} />);
    expect(out).toContain('Brand new thing…');
    expect(out).not.toContain('microsoftBrandNewThing');
  });

  it('puts a plain-language error in the row and keeps the raw text out of it', () => {
    const out = html(
      <ToolStepRow step={step({ status: 'error', errorDetail: 'HTTPSConnectionPool(host=graph.microsoft.com): Max retries' })} />,
    );
    expect(out).toContain("Couldn&#x27;t reach Outlook. Check your connection in");
    expect(out).toContain('Settings → Connectors');
    expect(out).toContain('Failed');
    expect(out).toContain('data-status="error"');
    expect(out).not.toContain('HTTPSConnectionPool'); // only inside the expandable details
    // the link is its own button, never nested in the toggle
    expect(out.match(/<button/g)).toHaveLength(2);
  });

  it('labels a failed step without claiming success', () => {
    const out = html(<ToolStepRow step={step({ status: 'error' })} />);
    expect(out).toContain('Searching your inbox');
    expect(out).not.toContain('Searched your inbox');
  });
});

describe('ToolStepDetails', () => {
  const args = { folder_id: 'Inbox', filter_query: 'receivedDateTime ge 2026-10-15T05:00:00Z', include_body: false, top: 100, skip: 0 };

  it('lays parameters out as alternating key / value cells of one grid, in order', () => {
    const out = html(<ToolStepDetails args={args} />);
    const cells = Array.from(out.matchAll(/<(dt|dd)>([^<]*)<\/\1>/g)).map((m) => [m[1], m[2]]);
    expect(cells).toEqual([
      ['dt', 'folder_id'], ['dd', 'Inbox'],
      ['dt', 'filter_query'], ['dd', 'receivedDateTime ge 2026-10-15T05:00:00Z'],
      ['dt', 'include_body'], ['dd', 'false'],
      ['dt', 'top'], ['dd', '100'],
      ['dt', 'skip'], ['dd', '0'],
    ]);
    // one <dl>, no per-row wrapper that would give each row its own column widths
    expect(out.match(/<dl/g)).toHaveLength(1);
    expect(out).not.toContain('nui-step-param"');
  });

  it('has a labelled copy button when there are parameters, and none when there are not', () => {
    const out = html(<ToolStepDetails args={args} />);
    expect(out).toMatch(/<button[^>]*class="nui-step-copy"[^>]*aria-label="Copy parameters as JSON"/);
    const empty = html(<ToolStepDetails args={{}} />);
    expect(empty).not.toContain('nui-step-copy');
    expect(empty).toContain('No parameters');
  });

  it('keeps raw error text in the panel', () => {
    expect(html(<ToolStepDetails args={{}} errorDetail="boom" />)).toContain('boom');
  });
});

describe('ToolStepGroup', () => {
  const running = [
    step({ id: 's0', status: 'done', resultSummary: '3 messages' }),
    step({ id: 's1', tool: 'microsoftGetMessageDetails', status: 'running', args: { id: 'x' } }),
  ];
  const settled = [
    step({ id: 's0' }),
    step({ id: 's1', tool: 'microsoftGetMessageDetails', args: { id: 'x' } }),
  ];

  it('is open while a step runs: header shows the current activity and every row is listed', () => {
    const out = html(<ToolStepGroup steps={running} />);
    expect(out).toMatch(/nui-group-head[^>]*aria-expanded="true"|aria-expanded="true"[^>]*nui-group-head/);
    expect(out).toContain('Opening an email…');
    expect(out).toContain('nui-group-body');
    expect(out).toContain('Searched your inbox');
    // one spinner (the running row's), not two
    expect(out.match(/<svg class="nui-step-spinner"/g)).toHaveLength(1);
  });

  it('collapses to a single summary line once nothing is running', () => {
    const out = html(<ToolStepGroup steps={settled} />);
    expect(out).toContain('Used Outlook · 2 steps');
    expect(out).toMatch(/aria-expanded="false"/);
    expect(out).not.toContain('nui-group-body');
    expect(out).not.toContain('Searched your inbox');
  });

  it('counts failures in the summary', () => {
    const out = html(<ToolStepGroup steps={[step({ id: 'a' }), step({ id: 'b', status: 'error' })]} />);
    expect(out).toContain('Used Outlook · 2 steps · 1 failed');
  });
});

describe('ThinkingRow', () => {
  it('is a plain label (no toggle) when there is no reasoning text', () => {
    const out = html(<ThinkingRow active />);
    expect(out).toContain('Thinking…');
    expect(out).not.toContain('<button');
    expect(out).toContain('data-active="true"');
  });

  it('is a collapsed, labelled toggle when there is reasoning to reveal', () => {
    const out = html(
      <ThinkingRow active={false}>
        <p>why</p>
      </ThinkingRow>,
    );
    expect(out).toMatch(/<button[^>]*aria-expanded="false"/);
    expect(out).toContain('nui-disclosure-chevron');
    expect(out).not.toContain('why'); // collapsed by default
    expect(out).not.toContain('nui-step-icon'); // visually distinct from tool steps
  });
});

describe('MessageToolSteps', () => {
  it('renders one step as a bare row, several as a group, and thinking above both', () => {
    const one = html(<MessageToolSteps steps={[step()]} />);
    expect(one).toContain('nui-step-line');
    expect(one).not.toContain('nui-group-head');

    const many = html(<MessageToolSteps steps={[step({ id: 'a' }), step({ id: 'b' })]} thinking={{ active: true }} />);
    expect(many).toContain('nui-group-head');
    expect(many.indexOf('nui-thinking')).toBeLessThan(many.indexOf('nui-group-head'));
  });

  it('shows a quiet "Thinking…" row AFTER the steps while the answer is pending', () => {
    const waiting = html(<MessageToolSteps steps={[step()]} awaitingAnswer />);
    expect(waiting).toContain('Thinking…');
    expect(waiting).toContain('data-active="true"');
    expect(waiting.indexOf('nui-step-line')).toBeLessThan(waiting.indexOf('nui-thinking'));
    expect(waiting).toContain('data-awaiting="true"'); // the container's spacing switches on this
    expect(html(<MessageToolSteps steps={[step()]} />)).not.toContain('Thinking…');
  });

  it('renders nothing but the root for no steps and no thinking', () => {
    expect(html(<MessageToolSteps steps={[]} />)).toBe('<div class="nui-ts-root" data-awaiting="false"></div>');
  });
});

describe('code interpreter steps', () => {
  const codeStep = (over: Partial<ToolStep> = {}): ToolStep => ({
    id: 'ci-1',
    tool: 'exec_code',
    status: 'done',
    args: {},
    detail: { code: 'print(1)' },
    ...over,
  });

  it('names a finished run by the model\'s description, with the summary after it', () => {
    const out = html(<ToolStepRow step={codeStep({ title: 'Calculated monthly revenue', resultSummary: '2 files created' })} />);
    expect(out).toContain('Calculated monthly revenue');
    expect(out).toContain('· 2 files created');
    expect(out).not.toContain('Ran code');
  });

  it('falls back to "Ran code" without a description, and never shows a title while running', () => {
    expect(html(<ToolStepRow step={codeStep()} />)).toContain('Ran code');
    const running = html(<ToolStepRow step={codeStep({ status: 'running', title: 'Calculated monthly revenue' })} />);
    expect(running).toContain('Running code…');
    expect(running).not.toContain('Calculated monthly revenue');
  });

  it('says the code hit an error, without the Python error in the collapsed row', () => {
    const out = html(<ToolStepRow step={codeStep({ status: 'error', errorDetail: 'ZeroDivisionError' })} />);
    expect(out).toContain('The code hit an error.');
    expect(out).not.toContain('ZeroDivisionError');
    expect(out).not.toContain('Settings → Connectors');
  });
});

describe('CodeRunDetails', () => {
  it('shows the code with a labelled copy button, and nothing for empty sections', () => {
    const out = html(<CodeRunDetails detail={{ code: 'print("hi")' }} />);
    expect(out).toContain('Code');
    expect(out).toContain('print(&quot;hi&quot;)');
    expect(out).toContain('aria-label="Copy code"');
    expect(out).not.toContain('Output');
    expect(out).not.toContain('Error');
    expect(out).not.toContain('Files created');
  });

  it('shows output, error and files when present, with the error in its own tone', () => {
    const out = html(
      <CodeRunDetails
        detail={{
          code: 'x',
          output: '42',
          error: 'NameError: y',
          files: [{ name: 'a.csv' }, { name: 'b.png' }],
        }}
      />,
    );
    expect(out).toContain('Output');
    expect(out).toContain('42');
    expect(out).toContain('data-tone="error"');
    expect(out).toContain('NameError: y');
    expect(out).toContain('Files created');
    expect(out).toContain('<li>a.csv</li>');
    expect(out).toContain('<li>b.png</li>');
  });

  it('uses the singular heading for one file, and says when something was shortened', () => {
    const out = html(
      <CodeRunDetails detail={{ code: 'x', output: 'y', files: [{ name: 'a.csv' }], truncated: { code: true, stdout: true } }} />,
    );
    expect(out).toContain('File created');
    expect(out).not.toContain('Files created');
    expect(out).toContain('Code shortened');
    expect(out).toContain('Output shortened');
  });

  it('renders code as text, never as markup', () => {
    const out = html(<CodeRunDetails detail={{ code: '<script>alert(1)</script>' }} />);
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
  });
});
