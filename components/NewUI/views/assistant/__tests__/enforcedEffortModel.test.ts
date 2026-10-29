import { describe, it, expect } from 'vitest';
import { buildThinkingFields, readEnforcedEffort } from '../enforcedEffortModel';

describe('readEnforcedEffort', () => {
    it('shows the stored level only when it is enforced', () => {
        expect(readEnforcedEffort({ enforceThinkingLevel: true, thinkingLevel: 'high' })).toBe('high');
        expect(readEnforcedEffort({ enforceThinkingLevel: false, thinkingLevel: 'high' })).toBe('off');
        expect(readEnforcedEffort({ thinkingLevel: 'high' })).toBe('off');
    });
    it('ignores junk and missing data', () => {
        expect(readEnforcedEffort({ enforceThinkingLevel: true, thinkingLevel: 'extreme' })).toBe('off');
        expect(readEnforcedEffort(undefined)).toBe('off');
        expect(readEnforcedEffort(null)).toBe('off');
    });
});

describe('buildThinkingFields', () => {
    it('drops both keys’ effect when the model is not enforced, even if a level was stored (the stale-level bug)', () => {
        const out = buildThinkingFields({ enforceModel: false, effort: 'high', existing: { enforceThinkingLevel: true, thinkingLevel: 'high' } });
        expect(out).toEqual({ enforceThinkingLevel: false });
        expect('thinkingLevel' in out).toBe(false);
    });
    it('enforces the picked level when the model is enforced', () => {
        expect(buildThinkingFields({ enforceModel: true, effort: 'medium' })).toEqual({ enforceThinkingLevel: true, thinkingLevel: 'medium' });
    });
    it('treats "off" as not enforced', () => {
        expect(buildThinkingFields({ enforceModel: true, effort: 'off' })).toEqual({ enforceThinkingLevel: false });
    });
    it('keeps a legacy enforced-off level until the user picks another', () => {
        const existing = { enforceThinkingLevel: true, thinkingLevel: 'off' };
        expect(buildThinkingFields({ enforceModel: true, effort: 'off', existing })).toEqual({ enforceThinkingLevel: true, thinkingLevel: 'off' });
        expect(buildThinkingFields({ enforceModel: true, effort: 'low', existing })).toEqual({ enforceThinkingLevel: true, thinkingLevel: 'low' });
        expect(buildThinkingFields({ enforceModel: false, effort: 'off', existing })).toEqual({ enforceThinkingLevel: false });
    });
});
