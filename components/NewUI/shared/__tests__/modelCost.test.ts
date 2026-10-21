import { describe, expect, it } from 'vitest';
import { getModelCostTier } from '../modelCost';

describe('getModelCostTier', () => {
  it('is low when both input and output are cheap', () => {
    expect(getModelCostTier({ inputTokenCost: 0.0005, outputTokenCost: 0.002 })).toBe('low');
  });

  it('is moderate at the upper boundary of each band', () => {
    expect(getModelCostTier({ inputTokenCost: 0.001, outputTokenCost: 0.001 })).toBe('moderate');
    expect(getModelCostTier({ inputTokenCost: 0.0005, outputTokenCost: 0.02 })).toBe('moderate');
    expect(getModelCostTier({ inputTokenCost: 0.01, outputTokenCost: 0.005 })).toBe('moderate');
  });

  it('is high when either side exceeds its band', () => {
    expect(getModelCostTier({ inputTokenCost: 0.011, outputTokenCost: 0.001 })).toBe('high');
    expect(getModelCostTier({ inputTokenCost: 0.0005, outputTokenCost: 0.021 })).toBe('high');
  });

  it('lets the higher side dominate', () => {
    expect(getModelCostTier({ inputTokenCost: 0.0001, outputTokenCost: 0.05 })).toBe('high');
  });

  it('is unknown (null) when no price is configured', () => {
    expect(getModelCostTier({ inputTokenCost: 0, outputTokenCost: 0 })).toBeNull();
    expect(getModelCostTier({})).toBeNull();
    expect(getModelCostTier(null)).toBeNull();
    expect(getModelCostTier(undefined)).toBeNull();
  });

  it('still tiers a model with only one side priced', () => {
    expect(getModelCostTier({ inputTokenCost: 0, outputTokenCost: 0.05 })).toBe('high');
    expect(getModelCostTier({ inputTokenCost: 0.0005 })).toBe('low');
  });

  it('accepts numeric strings and rejects garbage (§17)', () => {
    expect(getModelCostTier({ inputTokenCost: '0.003', outputTokenCost: '0.004' } as any)).toBe('moderate');
    expect(getModelCostTier({ inputTokenCost: 'abc', outputTokenCost: NaN } as any)).toBeNull();
    expect(getModelCostTier({ inputTokenCost: -1, outputTokenCost: Infinity } as any)).toBeNull();
  });
});
