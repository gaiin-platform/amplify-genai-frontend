import { describe, expect, it } from 'vitest';
import type { Model } from '@/types/model';
import {
  computeMaxOutputTokens,
  computeOutputBudget,
  DEFAULT_PROFILE,
  maxTokensForRequest,
  resolveEffectiveEffort,
  type EffortLevel,
} from '../outputTokenBudget';

const model = (outputTokenLimit: number, supportsReasoning = true, id = 'm'): Model =>
  ({ id, name: id, outputTokenLimit, supportsReasoning }) as Model;

const EFFORTS: EffortLevel[] = ['off', 'low', 'medium', 'high'];

describe('computeMaxOutputTokens', () => {
  it.each([
    // limit, off, low, medium, high
    [4_096, [4_096, 4_096, 4_096, 4_096]],
    [8_192, [8_192, 8_192, 8_192, 8_192]],
    [16_384, [16_384, 16_384, 16_384, 16_384]],
    [32_768, [16_384, 20_480, 24_576, 32_768]],
    [64_000, [32_000, 32_000, 32_000, 32_768]],
    [128_000, [64_000, 64_000, 64_000, 64_000]],
  ])('limit %i → off/low/medium/high', (limit, expected) => {
    expect(EFFORTS.map((e) => computeMaxOutputTokens(model(limit), e))).toEqual(expected);
  });

  it('never exceeds the model limit and never drops below half of it (the old default)', () => {
    for (const limit of [1_000, 4_096, 12_345, 64_000, 200_000]) {
      for (const e of EFFORTS) {
        const t = computeMaxOutputTokens(model(limit), e);
        expect(t).toBeLessThanOrEqual(limit);
        expect(t).toBeGreaterThanOrEqual(Math.floor(limit / 2));
      }
    }
  });

  it('is monotonic in effort', () => {
    for (const limit of [4_096, 8_192, 32_768, 64_000]) {
      const v = EFFORTS.map((e) => computeMaxOutputTokens(model(limit), e));
      expect([...v].sort((a, b) => a - b)).toEqual(v);
    }
  });

  it('always leaves the answer room, even when the model limit is small', () => {
    for (const limit of [2_048, 4_096, 8_192, 16_384, 32_768]) {
      for (const e of EFFORTS) {
        const b = computeOutputBudget(model(limit), e);
        expect(b.total - b.reasoning).toBeGreaterThanOrEqual(b.answerFloor);
        expect(b.answerFloor).toBe(Math.min(DEFAULT_PROFILE.response, Math.ceil(limit / 2)));
      }
    }
  });

  it('reserves nothing for reasoning when effort is off or the model cannot reason', () => {
    expect(computeOutputBudget(model(32_768), 'off').reasoning).toBe(0);
    expect(computeOutputBudget(model(32_768, false), 'high').reasoning).toBe(0);
    expect(computeMaxOutputTokens(model(32_768, false), 'high')).toBe(
      computeMaxOutputTokens(model(32_768, true), 'off'),
    );
  });

  it('falls back to a sane limit when the model reports none', () => {
    expect(computeMaxOutputTokens(model(0), 'high')).toBe(4_096);
    expect(computeMaxOutputTokens(model(Number.NaN), 'low')).toBe(4_096);
  });
});

describe('resolveEffectiveEffort', () => {
  it('uses the conversation effort, defaulting to medium', () => {
    expect(resolveEffectiveEffort('high')).toBe('high');
    expect(resolveEffectiveEffort(undefined)).toBe('medium');
    expect(resolveEffectiveEffort('bogus')).toBe('medium');
  });

  it("lets an assistant's enforced thinking level win (mirrors useChatSendService)", () => {
    expect(resolveEffectiveEffort('low', { enforceThinkingLevel: true, thinkingLevel: 'high' })).toBe('high');
    expect(resolveEffectiveEffort('high', { enforceThinkingLevel: true, thinkingLevel: 'off' })).toBe('off');
  });

  it('ignores thinkingLevel when it is not enforced', () => {
    expect(resolveEffectiveEffort('low', { enforceThinkingLevel: false, thinkingLevel: 'high' })).toBe('low');
  });
});

describe('maxTokensForRequest', () => {
  const small = model(8_192, true, 'small');
  const big = model(64_000, true, 'big');
  const available = { small, big };

  it('returns undefined with no model', () => {
    expect(maxTokensForRequest({ model: undefined })).toBeUndefined();
  });

  it("sizes against an assistant's enforced model, not the conversation's", () => {
    const viaEnforced = maxTokensForRequest({
      model: big,
      conversationEffort: 'high',
      assistantData: { model: 'small' },
      availableModels: available,
    });
    expect(viaEnforced).toBe(computeMaxOutputTokens(small, 'high'));
  });

  it("uses the enforced thinking level, not the conversation's", () => {
    const enforcedHigh = maxTokensForRequest({
      model: model(32_768),
      conversationEffort: 'off',
      assistantData: { enforceThinkingLevel: true, thinkingLevel: 'high' },
    });
    expect(enforcedHigh).toBe(32_768);
  });

  it('falls back to the conversation model when the enforced one is unavailable', () => {
    expect(
      maxTokensForRequest({ model: big, assistantData: { model: 'gone' }, availableModels: available }),
    ).toBe(computeMaxOutputTokens(big, 'medium'));
  });
});
