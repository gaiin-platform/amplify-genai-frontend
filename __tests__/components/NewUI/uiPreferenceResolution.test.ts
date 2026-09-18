/**
 * Tests for the rule that decides whether the first-run UI popup is allowed to show.
 *
 * The bug this guards: home.tsx renders <UIPreferenceBanner> whenever its
 * `uiPreference` state is null, and that state starts null on *every* load —
 * fetchSettings() fills it in asynchronously. A returning user therefore saw the
 * popup paint immediately and then get torn down the instant the server answered,
 * which looked like the popup "closing and launching the new UI by itself" before
 * any selection was made. The banner now resolves both stores first and only asks
 * when neither holds a choice.
 */
import { describe, it, expect } from 'vitest';
import {
    resolveStoredUIPreference,
    readUIPreferenceOverride,
    urlWithoutUIPreferenceParam,
} from '@/components/NewUI/shared/uiPreferenceResolution';

describe('resolveStoredUIPreference', () => {
    it('asks only when neither store holds a choice (genuine first run)', () => {
        expect(resolveStoredUIPreference(null, null)).toBe('ask');
        expect(resolveStoredUIPreference(null, undefined)).toBe('ask');
    });

    it('never asks when the server has a stored choice — the popup-flash bug', () => {
        expect(resolveStoredUIPreference(null, 'new')).toBe('new');
        expect(resolveStoredUIPreference(null, 'classic')).toBe('classic');
    });

    it('never asks when only localStorage has a choice (offline / failed fetch)', () => {
        expect(resolveStoredUIPreference('new', null)).toBe('new');
        expect(resolveStoredUIPreference('classic', null)).toBe('classic');
    });

    it('lets the server win a disagreement, matching home.tsx fetchSettings roaming', () => {
        expect(resolveStoredUIPreference('classic', 'new')).toBe('new');
        expect(resolveStoredUIPreference('new', 'classic')).toBe('classic');
    });

    it('ignores junk server values rather than treating them as a choice', () => {
        // The value comes off a network payload, so it is not guaranteed to be a
        // valid preference — a truthy garbage string must not silently pick a UI.
        expect(resolveStoredUIPreference(null, '')).toBe('ask');
        expect(resolveStoredUIPreference(null, 'NEW')).toBe('ask');
        expect(resolveStoredUIPreference(null, true)).toBe('ask');
        expect(resolveStoredUIPreference(null, {})).toBe('ask');
        expect(resolveStoredUIPreference(null, 'newui')).toBe('ask');
    });

    it('falls back to a valid local choice when the server value is junk', () => {
        expect(resolveStoredUIPreference('classic', 'bogus')).toBe('classic');
    });
});

describe('readUIPreferenceOverride', () => {
    it('recognises the reset escape hatch', () => {
        expect(readUIPreferenceOverride('?uiPreference=reset')).toBe('reset');
        expect(readUIPreferenceOverride('?foo=1&uiPreference=reset')).toBe('reset');
    });

    it('ignores everything else, so a normal load never wipes a stored choice', () => {
        expect(readUIPreferenceOverride('')).toBeNull();
        expect(readUIPreferenceOverride('?uiPreference=new')).toBeNull();
        expect(readUIPreferenceOverride('?uiPreference=ask')).toBeNull();
        expect(readUIPreferenceOverride('?uiPreference=')).toBeNull();
        expect(readUIPreferenceOverride('?resetUiPreference=reset')).toBeNull();
    });
});

describe('urlWithoutUIPreferenceParam', () => {
    it('strips only the reset param, so the reload is an ordinary load', () => {
        expect(urlWithoutUIPreferenceParam('https://x.test/?uiPreference=reset')).toBe('/');
        expect(urlWithoutUIPreferenceParam('https://x.test/chat?uiPreference=reset&a=1')).toBe(
            '/chat?a=1',
        );
    });

    it('keeps path and hash intact', () => {
        expect(urlWithoutUIPreferenceParam('https://x.test/a/b?uiPreference=reset#frag')).toBe(
            '/a/b#frag',
        );
    });

    it('is a no-op on a URL that never had the param', () => {
        expect(urlWithoutUIPreferenceParam('https://x.test/a?b=2')).toBe('/a?b=2');
    });
});
