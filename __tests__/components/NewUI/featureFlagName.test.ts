import { describe, expect, it } from 'vitest';
import { normalizeFeatureFlagName } from '@/components/NewUI/shared/featureFlagName';

describe('normalizeFeatureFlagName', () => {
  it.each([
    ['New UI', 'newUi'],
    ['new ui', 'newUi'],
    ['New Ui', 'newUi'],
    ['newUi', 'newUi'],
    ['newUI', 'newUi'],
    ['NEWUI', 'newUi'],
    ['NEW UI', 'newUi'],
    ['New  UI', 'newUi'],
    ['Prompt Optimizer', 'promptOptimizer'],
    ['API Keys', 'apiKeys'],
    ['  spaced   out  ', 'spacedOut'],
    ['promptOptimizer', 'promptOptimizer'],
    ['mtdCost', 'mtdCost'],
    ['Notebook', 'notebook'],
    ['', ''],
    ['   ', ''],
  ])('%j → %j', (input, expected) => {
    expect(normalizeFeatureFlagName(input)).toBe(expected);
  });
});
