import { describe, expect, it } from 'vitest';
import {
  getTruncation,
  isLengthStopReason,
  reportsLengthStop,
  truncationCopy,
} from '../responseTruncation';

const reply = (content: string, state?: Record<string, unknown>) => ({
  role: 'assistant' as const,
  content,
  data: state ? { state } : undefined,
});
const last = { isLast: true, isStreaming: false };

describe('isLengthStopReason', () => {
  it.each(['length', 'max_tokens', 'max_output_tokens', 'MAX_TOKENS', ' length '])('%s', (v) => {
    expect(isLengthStopReason(v)).toBe(true);
  });
  it.each(['stop', 'end_turn', 'tool_calls', '', null, undefined, 3])('not %s', (v) => {
    expect(isLengthStopReason(v)).toBe(false);
  });
});

describe('getTruncation', () => {
  it('reports a cut-off when the backend says the limit was hit and text exists', () => {
    const t = getTruncation(reply('Partial answer', { stopReason: 'max_tokens' }), last);
    expect(t).toEqual({ kind: 'cut-off', reported: true, reasoned: false });
  });

  it('reports no-answer when the limit was hit and there is no text', () => {
    const t = getTruncation(reply('  ', { finish_reason: 'length', reasoning: [1] }), last);
    expect(t).toEqual({ kind: 'no-answer', reported: true, reasoned: true });
  });

  it('infers no-answer from reasoning with no text, only for the latest reply', () => {
    const state = { reasoning: ['x'] };
    expect(getTruncation(reply('', state), last)).toEqual({ kind: 'no-answer', reported: false, reasoned: true });
    expect(getTruncation(reply('', state), { isLast: false, isStreaming: false })).toBeNull();
  });

  it('does not guess about a normal or merely abrupt reply', () => {
    expect(getTruncation(reply('A complete answer.'), last)).toBeNull();
    expect(getTruncation(reply('Ends mid-sen'), last)).toBeNull();
    expect(getTruncation(reply('', undefined), last)).toBeNull(); // empty, no reasoning
    expect(getTruncation(reply('ok', { stopReason: 'end_turn' }), last)).toBeNull();
  });

  it('never classifies a streaming reply or a user message', () => {
    expect(getTruncation(reply('', { reasoning: ['x'] }), { isLast: true, isStreaming: true })).toBeNull();
    expect(getTruncation({ role: 'user', content: '', data: undefined }, last)).toBeNull();
    expect(getTruncation(undefined, last)).toBeNull();
  });

  it('tolerates malformed state', () => {
    expect(reportsLengthStop({ data: { state: 'oops' } })).toBe(false);
    expect(reportsLengthStop({ data: null })).toBe(false);
  });
});

describe('truncationCopy', () => {
  it('offers Continue only when there is text to continue from', () => {
    expect(truncationCopy({ kind: 'cut-off', reported: true, reasoned: false })).toEqual({
      message: 'Response was cut off because it reached the length limit.',
      continueLabel: 'Continue',
    });
    expect(truncationCopy({ kind: 'no-answer', reported: true, reasoned: true }).continueLabel).toBeUndefined();
  });

  it('is definitive about reasoning only when the stop was reported', () => {
    expect(truncationCopy({ kind: 'no-answer', reported: true, reasoned: true }).message).toMatch(/reasoning used up/);
    expect(truncationCopy({ kind: 'no-answer', reported: false, reasoned: true }).message).toMatch(/may have used up/);
  });
});
