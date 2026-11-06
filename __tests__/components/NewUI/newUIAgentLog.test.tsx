import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/image', () => ({
  default: (props: any) => React.createElement('img', { src: props.src, alt: props.alt }),
}));

import { NewUIAgentLog } from '@/components/NewUI/chat/NewUIAgentLog';

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

const FILTER = 'receivedDateTime ge 2026-10-15T05:00:00Z and receivedDateTime le 2026-10-15T15:54:03Z';
const result = [
  { role: 'user', content: 'what did I get today?' },
  { role: 'assistant', content: { tool: 'microsoftListMessages', args: { folder_id: 'Inbox', filter_query: FILTER } } },
  { role: 'environment', content: { tool: 'microsoftListMessages', tool_executed: true, result: { data: [{ subject: 'Hi' }, { subject: 'Yo' }] } } },
  { role: 'assistant', content: { tool: 'terminate', args: { message: 'FINAL ANSWER' } } },
  { role: 'environment', content: { total_token_cost: 0.0054 } },
];

describe('NewUIAgentLog', () => {
  it('shows the run as step rows, once, with none of the classic card chrome', () => {
    const out = html(<NewUIAgentLog result={result} />);
    expect(out).toContain('nui-ts-root');
    expect(out).toContain('2 messages');
    expect(out).not.toMatch(/User Prompt|Execute:|Arguments:|Total Token Cost|FINAL ANSWER|what did I get today/);
  });

  it('words date-relative labels against when the run happened', () => {
    const onTheDay = html(<NewUIAgentLog result={result} executedAt="2026-10-15T15:55:00Z" />);
    const later = html(<NewUIAgentLog result={result} executedAt="2026-10-20T15:55:00Z" />);
    expect(onTheDay).toContain("today");
    expect(later).not.toContain("today");
  });

  it('ignores an unreadable run time instead of failing', () => {
    expect(() => html(<NewUIAgentLog result={result} executedAt="not a date" />)).not.toThrow();
  });

  it('renders the fallback when the log has no tool steps, and for junk', () => {
    const fb = <div id="fb">classic</div>;
    const onlyTerminate = [
      { role: 'assistant', content: { tool: 'terminate', args: { message: 'done' } } },
    ];
    expect(html(<NewUIAgentLog result={onlyTerminate} fallback={fb} />)).toContain('classic');
    expect(html(<NewUIAgentLog result={'plain text'} fallback={fb} />)).toContain('classic');
    expect(html(<NewUIAgentLog result={undefined} />)).toBe('');
  });
});
