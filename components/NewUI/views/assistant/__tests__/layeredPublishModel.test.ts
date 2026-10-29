import { describe, it, expect } from 'vitest';
import { PUBLIC_ACCESS, PublishState, isAccessChanged, isCurrentPath, publishBlocker, shouldCallAddPath } from '../layeredPublishModel';

const state = (over: Partial<PublishState> = {}): PublishState => ({
    path: '', savedPath: '', available: false, checking: false, error: '',
    accessData: PUBLIC_ACCESS, originalAccessData: PUBLIC_ACCESS, ...over,
});

describe('isAccessChanged', () => {
    it('is false for equal access regardless of order', () => {
        const a = { isPublic: false, accessTo: { amplifyGroups: ['g1', 'g2'], users: ['u1'] } };
        const b = { isPublic: false, accessTo: { amplifyGroups: ['g2', 'g1'], users: ['u1'] } };
        expect(isAccessChanged(a, b)).toBe(false);
    });
    it('detects visibility, user and group changes', () => {
        expect(isAccessChanged(PUBLIC_ACCESS, { ...PUBLIC_ACCESS, isPublic: false })).toBe(true);
        expect(isAccessChanged(PUBLIC_ACCESS, { isPublic: true, accessTo: { amplifyGroups: [], users: ['u'] } })).toBe(true);
        expect(isAccessChanged(PUBLIC_ACCESS, { isPublic: true, accessTo: { amplifyGroups: ['g'], users: [] } })).toBe(true);
    });
    it('treats null on one side as a change and on both as none', () => {
        expect(isAccessChanged(null, null)).toBe(false);
        expect(isAccessChanged(null, PUBLIC_ACCESS)).toBe(true);
    });
});

describe('isCurrentPath', () => {
    it('matches case-insensitively and ignores whitespace', () => {
        expect(isCurrentPath({ path: ' My-Path ', savedPath: 'my-path' })).toBe(true);
        expect(isCurrentPath({ path: 'other', savedPath: 'my-path' })).toBe(false);
        expect(isCurrentPath({ path: '', savedPath: '' })).toBe(false);
    });
});

describe('publishBlocker', () => {
    it('allows leaving the path empty', () => {
        expect(publishBlocker(state(), { isGroup: false })).toBeNull();
    });
    it('blocks while checking, on an error, and when the path is unavailable', () => {
        expect(publishBlocker(state({ path: 'new-one', checking: true }), { isGroup: false })).toMatch(/Still checking/);
        expect(publishBlocker(state({ path: 'new-one', error: 'Path is already in use by another assistant' }), { isGroup: false })).toMatch(/already in use/);
        expect(publishBlocker(state({ path: 'new-one' }), { isGroup: false })).toMatch(/Choose an available link/);
    });
    it('allows an available path and the already-saved path without re-checking', () => {
        expect(publishBlocker(state({ path: 'new-one', available: true }), { isGroup: false })).toBeNull();
        expect(publishBlocker(state({ path: 'Saved', savedPath: 'saved' }), { isGroup: false })).toBeNull();
    });
    it('requires someone to have access when restricted (personal only)', () => {
        const restricted = state({ path: 'x-path', available: true, accessData: { isPublic: false, accessTo: { amplifyGroups: [], users: [] } } });
        expect(publishBlocker(restricted, { isGroup: false })).toMatch(/Add at least one/);
        expect(publishBlocker(restricted, { isGroup: true })).toBeNull();
        const withUser = { ...restricted, accessData: { isPublic: false, accessTo: { amplifyGroups: [], users: ['u'] } } };
        expect(publishBlocker(withUser, { isGroup: false })).toBeNull();
    });
});

describe('shouldCallAddPath', () => {
    it('is false with no path or an unusable one', () => {
        expect(shouldCallAddPath(state())).toBe(false);
        expect(shouldCallAddPath(state({ path: 'new-one', available: false }))).toBe(false);
    });
    it('is true for a new available path', () => {
        expect(shouldCallAddPath(state({ path: 'new-one', available: true }))).toBe(true);
    });
    it('is false for an unchanged saved path with unchanged access, true when access changed', () => {
        expect(shouldCallAddPath(state({ path: 'saved', savedPath: 'saved' }))).toBe(false);
        expect(shouldCallAddPath(state({ path: 'saved', savedPath: 'saved', accessData: { isPublic: false, accessTo: { amplifyGroups: [], users: ['u'] } } }))).toBe(true);
    });
});
