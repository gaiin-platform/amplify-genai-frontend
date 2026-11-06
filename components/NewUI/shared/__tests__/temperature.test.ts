import { describe, expect, it } from 'vitest';
import { clampTemperature, DEFAULT_TEMPERATURE, resolveConversationTemperature } from '../temperature';

describe('clampTemperature', () => {
  it('keeps values already in 0–1', () => {
    expect(clampTemperature(0)).toBe(0);
    expect(clampTemperature(0.5)).toBe(0.5);
    expect(clampTemperature(1)).toBe(1);
  });
  it('clamps values outside 0–1 (e.g. an OpenAI/Gemini-style 0–2 value)', () => {
    expect(clampTemperature(1.7)).toBe(1);
    expect(clampTemperature(2)).toBe(1);
    expect(clampTemperature(-1)).toBe(0);
  });
  it('falls back to the default for non-numbers', () => {
    for (const v of [undefined, null, NaN, Infinity, '0.4', {}]) {
      expect(clampTemperature(v)).toBe(DEFAULT_TEMPERATURE);
    }
  });
});

describe('resolveConversationTemperature', () => {
  it('gives a new empty chat the default, whatever it inherited', () => {
    expect(resolveConversationTemperature({ temperature: 0.2, messages: [] })).toBe(DEFAULT_TEMPERATURE);
  });
  it('clamps an existing chat instead of resetting it', () => {
    expect(resolveConversationTemperature({ temperature: 0.3, messages: [{}] })).toBe(0.3);
    expect(resolveConversationTemperature({ temperature: 1.8, messages: [{}] })).toBe(1);
  });
  it('does not mistake a compressed local chat for an empty one (§36)', () => {
    expect(
      resolveConversationTemperature({ temperature: 0.3, messages: [], compressedMessages: [1, 2] }),
    ).toBe(0.3);
  });
  it('treats an unknown message shape as not-empty', () => {
    expect(resolveConversationTemperature({ temperature: 0.3 })).toBe(0.3);
  });
});
