import { describe, expect, it } from 'vitest';

import {
    getSourceActivity,
    getSourceFailureCode,
    getSourceFailureMessage,
    isSourceInFlight,
} from '@/components/Notebook/sourceStatus';

describe('getSourceActivity', () => {
    it.each(['new', 'queued', 'running'])('treats %s as processing', (status) => {
        expect(getSourceActivity({ status })).toBe('processing');
        expect(isSourceInFlight({ status })).toBe(true);
    });

    it.each(['failed', 'error'])('treats %s as failed and not in flight', (status) => {
        expect(getSourceActivity({ status })).toBe('failed');
        expect(isSourceInFlight({ status })).toBe(false);
    });

    it.each([undefined, null, 'completed', 'unknown'])('treats %s as idle', (status) => {
        expect(getSourceActivity({ status })).toBe('idle');
        expect(isSourceInFlight({ status })).toBe(false);
    });
});

describe('getSourceFailureCode', () => {
    it('reads error_code from processing_info', () => {
        expect(getSourceFailureCode({ processing_info: { error_code: 'blocked' } })).toBe(
            'blocked',
        );
    });

    it('ignores missing or non-string codes', () => {
        expect(getSourceFailureCode({})).toBeUndefined();
        expect(getSourceFailureCode({ processing_info: null })).toBeUndefined();
        expect(getSourceFailureCode({ processing_info: { error_code: 42 } })).toBeUndefined();
    });
});

describe('getSourceFailureMessage', () => {
    it('explains a blocked site and tells the user what to do next', () => {
        const msg = getSourceFailureMessage('blocked');
        expect(msg).toMatch(/blocks automated access/i);
        expect(msg).toMatch(/Text source|PDF/);
    });

    it.each(['not_found', 'unreachable', 'empty', 'unknown'])(
        'has a distinct non-empty message for %s',
        (code) => {
            expect(getSourceFailureMessage(code).length).toBeGreaterThan(10);
        },
    );

    it('falls back to the unknown message for missing or unrecognised codes', () => {
        const unknown = getSourceFailureMessage('unknown');
        expect(getSourceFailureMessage(undefined)).toBe(unknown);
        expect(getSourceFailureMessage('something_new')).toBe(unknown);
    });

    it('never resolves an inherited Object.prototype member to a non-string', () => {
        for (const code of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
            expect(typeof getSourceFailureMessage(code)).toBe('string');
            expect(getSourceFailureMessage(code)).toBe(getSourceFailureMessage('unknown'));
        }
    });
});
