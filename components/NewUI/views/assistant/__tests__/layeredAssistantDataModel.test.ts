import { describe, it, expect } from 'vitest';
import { LayeredAssistant, createLayeredAssistant } from '@/types/layeredAssistant';
import {
    LayeredSettings,
    buildLayeredForSave,
    readLayeredSettings,
    setEnforcedModel,
    setLayeredAnalysis,
    setLayeredTracking,
} from '../layeredAssistantDataModel';

const base = (over: Partial<LayeredAssistant> = {}): LayeredAssistant => ({ ...createLayeredAssistant('LA'), ...over });
const settings = (over: Partial<LayeredSettings> = {}): LayeredSettings => ({
    isPublished: false, enforceModel: false, model: undefined,
    trackConversations: false, supportConvAnalysis: false, analysisCategories: [], ...over,
});

describe('readLayeredSettings', () => {
    it('reads top-level values', () => {
        const s = readLayeredSettings(base({ isPublished: true, model: 'gpt', trackConversations: true, analysisCategories: ['a'] }));
        expect(s).toMatchObject({ isPublished: true, enforceModel: true, model: 'gpt', trackConversations: true, analysisCategories: ['a'] });
    });
    it('falls back to values stored in data', () => {
        const s = readLayeredSettings(base({ data: { isPublished: true, supportConvAnalysis: true, model: 'm' } }));
        expect(s).toMatchObject({ isPublished: true, supportConvAnalysis: true, enforceModel: true, model: 'm' });
    });
    it('prefers the top level over data, and defaults safely', () => {
        expect(readLayeredSettings(base({ isPublished: false, data: { isPublished: true } })).isPublished).toBe(false);
        expect(readLayeredSettings(undefined)).toMatchObject({ isPublished: false, enforceModel: false, analysisCategories: [] });
        expect(readLayeredSettings(base({ analysisCategories: 'nope' as any })).analysisCategories).toEqual([]);
    });
});

describe('tracking and analysis', () => {
    it('analysis on forces tracking on', () => {
        expect(setLayeredAnalysis(settings(), true)).toMatchObject({ supportConvAnalysis: true, trackConversations: true });
    });
    it('tracking off also turns analysis off', () => {
        const on = setLayeredAnalysis(settings(), true);
        expect(setLayeredTracking(on, false)).toMatchObject({ trackConversations: false, supportConvAnalysis: false });
    });
    it('tracking on leaves analysis alone', () => {
        expect(setLayeredTracking(settings({ supportConvAnalysis: false }), true)).toMatchObject({ trackConversations: true, supportConvAnalysis: false });
    });
});

describe('setEnforcedModel', () => {
    it('clears the model when turned off and seeds a fallback when turned on', () => {
        expect(setEnforcedModel(settings({ enforceModel: true, model: 'x' }), false)).toMatchObject({ enforceModel: false, model: undefined });
        expect(setEnforcedModel(settings(), true, 'fallback')).toMatchObject({ enforceModel: true, model: 'fallback' });
        expect(setEnforcedModel(settings({ model: 'kept' }), true, 'fallback').model).toBe('kept');
    });
});

describe('buildLayeredForSave — the full DATA_FIELDS set', () => {
    it('group: always writes publish, tracking, analysis and categories', () => {
        const out = buildLayeredForSave({
            la: base(), settings: settings({ isPublished: true, trackConversations: true }),
            isGroup: true, groupSupportsAnalysis: true, astIcon: undefined, now: 'T',
        });
        expect(out).toMatchObject({ isPublished: true, trackConversations: true, supportConvAnalysis: false, analysisCategories: [], updatedAt: 'T' });
        expect('model' in out).toBe(false);
    });
    it('group: analysis implies tracking even if the tracking flag is stale', () => {
        const out = buildLayeredForSave({
            la: base(), settings: settings({ supportConvAnalysis: true, trackConversations: false }),
            isGroup: true, groupSupportsAnalysis: true, astIcon: undefined,
        });
        expect(out.trackConversations).toBe(true);
    });
    it('group without approval keeps what was stored instead of clearing it', () => {
        const out = buildLayeredForSave({
            la: base({ trackConversations: true, supportConvAnalysis: true, analysisCategories: ['x'] }),
            settings: settings({ isPublished: true }), isGroup: true, groupSupportsAnalysis: false, astIcon: undefined,
        });
        expect(out).toMatchObject({ trackConversations: true, supportConvAnalysis: true, analysisCategories: ['x'], isPublished: true });
    });
    it('turning enforcement off also clears a stale data.model returned by the list endpoint', () => {
        const la = base({ model: 'm', data: { model: 'm', isPublished: true, trackConversations: true } });
        const out = buildLayeredForSave({ la, settings: settings({ enforceModel: false }), isGroup: true, groupSupportsAnalysis: true, astIcon: undefined });
        expect(out.data).not.toHaveProperty('model');
        expect(out.data).not.toHaveProperty('isPublished');
        expect(out.data).not.toHaveProperty('trackConversations');
        expect('model' in out).toBe(false);
    });
    it('never leaves a stale settings copy in data, even for a personal layered assistant', () => {
        const out = buildLayeredForSave({ la: base({ data: { model: 'm', other: 1 } }), settings: settings(), isGroup: false, groupSupportsAnalysis: false, astIcon: undefined });
        expect(out.data).toEqual({ other: 1 });
    });
    it('writes the enforced model only when enforcing', () => {
        const on = buildLayeredForSave({ la: base(), settings: settings({ enforceModel: true, model: 'gpt' }), isGroup: true, groupSupportsAnalysis: true, astIcon: undefined });
        expect(on.model).toBe('gpt');
        const off = buildLayeredForSave({ la: base({ model: 'old' }), settings: settings(), isGroup: true, groupSupportsAnalysis: true, astIcon: undefined });
        expect('model' in off).toBe(false);
    });
    it('keeps other data keys, sets the icon, and removes it when cleared', () => {
        const withIcon = buildLayeredForSave({ la: base({ data: { other: 1 } }), settings: settings(), isGroup: false, groupSupportsAnalysis: false, astIcon: { id: 'i' } });
        expect(withIcon.data).toEqual({ other: 1, astIcon: { id: 'i' } });
        const cleared = buildLayeredForSave({ la: withIcon, settings: settings(), isGroup: false, groupSupportsAnalysis: false, astIcon: undefined });
        expect(cleared.data).toEqual({ other: 1 });
    });
    it('personal: leaves the group-only fields alone', () => {
        const out = buildLayeredForSave({ la: base(), settings: settings({ isPublished: true }), isGroup: false, groupSupportsAnalysis: false, astIcon: undefined });
        expect('isPublished' in out).toBe(false);
    });
    it('does not mutate its input', () => {
        const la = base({ data: { a: 1 } });
        buildLayeredForSave({ la, settings: settings(), isGroup: true, groupSupportsAnalysis: true, astIcon: { id: 'i' } });
        expect(la.data).toEqual({ a: 1 });
    });
});
