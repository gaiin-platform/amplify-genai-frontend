import { describe, expect, it } from 'vitest';

import { getPodcastFailureMessage } from '@/components/Notebook/podcastFailure';

describe('getPodcastFailureMessage', () => {
    it('explains content that is too large and what to do about it', () => {
        const msg = getPodcastFailureMessage(
            'content_too_long',
            'Processing failed. Please try again or contact support if the problem persists.',
        );
        expect(msg).toMatch(/larger than the AI model/i);
        expect(msg).toMatch(/summaries/i);
        // Must not just echo the generic server text.
        expect(msg).not.toMatch(/contact support/i);
    });

    it('warns that a plain retry will not help for oversized content', () => {
        expect(getPodcastFailureMessage('content_too_long')).toMatch(/fail again/i);
    });

    it.each(['rate_limited', 'unavailable'])('has a specific message for %s', (code) => {
        const msg = getPodcastFailureMessage(code, 'generic');
        expect(msg).not.toBe('generic');
        expect(msg.length).toBeGreaterThan(10);
    });

    it('falls back to the server message for unknown or missing codes', () => {
        expect(getPodcastFailureMessage('unknown', 'server says so')).toBe('server says so');
        expect(getPodcastFailureMessage(undefined, 'server says so')).toBe('server says so');
        expect(getPodcastFailureMessage(null, null)).toMatch(/failed/i);
    });

    it('never resolves an inherited Object.prototype member to a non-string', () => {
        for (const code of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
            expect(typeof getPodcastFailureMessage(code, 'fallback')).toBe('string');
            expect(getPodcastFailureMessage(code, 'fallback')).toBe('fallback');
        }
    });
});
