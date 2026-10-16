/**
 * Guards the self-heal rules for a failed startup `/feature_flags` request: with no
 * cached flag set, `state.featureFlags` stays `{}` all session, which hid the ⊕ menu's
 * files/library/connectors and the account menu's "Switch to classic UI".
 */
import { describe, it, expect } from 'vitest';
import {
    FLAG_RETRY_DELAYS_MS,
    mergeRetriedFlags,
    nextFlagRetryDelay,
} from '@/components/NewUI/shared/featureFlagRetry';

const full = { newUi: true, uploadDocuments: true, integrations: true, smartMessages: true };

describe('nextFlagRetryDelay', () => {
    it('backs off, then reports the budget as spent', () => {
        expect(nextFlagRetryDelay(0)).toBe(FLAG_RETRY_DELAYS_MS[0]);
        expect(nextFlagRetryDelay(FLAG_RETRY_DELAYS_MS.length - 1)).toBe(
            FLAG_RETRY_DELAYS_MS[FLAG_RETRY_DELAYS_MS.length - 1],
        );
        expect(nextFlagRetryDelay(FLAG_RETRY_DELAYS_MS.length)).toBeNull();
        expect(nextFlagRetryDelay(-1)).toBeNull();
    });

    it('never retries faster than the previous attempt', () => {
        for (let i = 1; i < FLAG_RETRY_DELAYS_MS.length; i++) {
            expect(FLAG_RETRY_DELAYS_MS[i]).toBeGreaterThan(FLAG_RETRY_DELAYS_MS[i - 1]);
        }
    });
});

describe('mergeRetriedFlags', () => {
    it('accepts a full server set', () => {
        expect(mergeRetriedFlags(full, {})).toEqual(full);
    });

    it.each([null, undefined, 'oops', [], {}, { smartMessages: false }])(
        'rejects an untrusted payload (%j) so state is never replaced by it',
        (payload) => {
            expect(mergeRetriedFlags(payload, {})).toBeNull();
        },
    );

    it('keeps the startup smartMessages patch already in state', () => {
        expect(mergeRetriedFlags(full, { smartMessages: false })).toEqual({ ...full, smartMessages: false });
    });

    it('does not invent smartMessages when state has none', () => {
        const { smartMessages, ...rest } = full;
        expect(mergeRetriedFlags(rest, {})).toEqual(rest);
    });
});
