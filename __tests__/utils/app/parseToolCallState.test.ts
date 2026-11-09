import { describe, expect, it, vi } from 'vitest';

import { parseToolCallState } from '@/utils/app/agent';

describe('parseToolCallState', () => {
  const call = { tool: 'read_email', args: { top: 5 } };

  it('parses a bare JSON tool call', () => {
    expect(parseToolCallState(JSON.stringify(call))).toEqual(call);
  });

  it('parses a call inside a markdown code fence', () => {
    expect(parseToolCallState('```json\n' + JSON.stringify(call) + '\n```')).toEqual(call);
  });

  it('parses a call surrounded by prose', () => {
    expect(parseToolCallState(`I'll check your inbox.\n${JSON.stringify(call)}\nDone.`)).toEqual(call);
  });

  it.each(['1. Check the inbox', '-', 'plain prose', '{not json}', '{"no":"tool"}', '', 42, null, undefined])(
    'returns null (without throwing or logging) for %p',
    (raw) => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(parseToolCallState(raw)).toBeNull();
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    },
  );
});
