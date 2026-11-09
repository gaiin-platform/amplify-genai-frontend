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

  it('with no tool steps, shows only the final message — never the classic Reasoning / Actions card', () => {
    const onlyTerminate = [
      { role: 'user', content: 'summarize my inbox' },
      { role: 'assistant', content: { tool: 'think', args: { thought: 'private reasoning' } } },
      { role: 'assistant', content: { tool: 'terminate', args: { message: 'Nothing new today.' } } },
      { role: 'environment', content: { total_token_cost: 0.01 } },
    ];
    const out = html(<NewUIAgentLog result={onlyTerminate} />);
    expect(out).toContain('Nothing new today.');
    expect(out).not.toMatch(/Reasoning \/ Actions|User Prompt|Total Token Cost|private reasoning|summarize my inbox/);
  });

  it('renders nothing when there are no tool steps and no final message, and for junk', () => {
    const noMessage = [{ role: 'assistant', content: { tool: 'terminate', args: {} } }];
    expect(html(<NewUIAgentLog result={noMessage} />)).toBe('');
    expect(html(<NewUIAgentLog result={'plain text'} />)).toBe('');
    expect(html(<NewUIAgentLog result={undefined} />)).toBe('');
  });
});
