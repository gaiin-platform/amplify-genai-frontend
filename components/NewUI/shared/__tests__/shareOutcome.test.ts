import { describe, expect, it } from 'vitest';
import {
    interpretShareResult,
    joinEmails,
    noneSignedInMessage,
    partialSignedInMessage,
} from '../shareOutcome';

const emails = ['Ann@x.com', 'bob@x.com', 'cy@x.com'];
const sentAs = ['ann', 'bob@x.com', 'cy'];

describe('interpretShareResult', () => {
    it('full success when nothing is invalid (or an older backend sends no list)', () => {
        for (const r of [{ success: true, invalidUsers: [] }, { success: true }]) {
            expect(interpretShareResult(r, emails, sentAs)).toEqual({
                status: 'all',
                reached: emails,
                notSignedIn: [],
            });
        }
    });

    it('partial: maps invalid usernames AND raw emails back to the typed addresses, case-insensitively', () => {
        const out = interpretShareResult({ success: true, invalidUsers: ['ANN', 'bob@x.com'] }, emails, sentAs);
        expect(out.status).toBe('partial');
        expect(out.notSignedIn).toEqual(['Ann@x.com', 'bob@x.com']);
        expect(out.reached).toEqual(['cy@x.com']);
    });

    it('none: failure listing every recipient as invalid', () => {
        const out = interpretShareResult(
            { success: false, message: 'No valid users to share with.', invalidUsers: ['ann', 'bob@x.com', 'cy'] },
            emails,
            sentAs,
        );
        expect(out).toEqual({ status: 'none', reached: [], notSignedIn: emails });
    });

    it('none: older backend that only sends the message', () => {
        const out = interpretShareResult({ success: false, message: 'No valid users to share with.' }, emails, sentAs);
        expect(out.status).toBe('none');
        expect(out.notSignedIn).toEqual(emails);
    });

    it('failed: any other failure stays generic', () => {
        expect(interpretShareResult({ success: false, message: 'Error sharing: boom' }, emails, sentAs).status).toBe('failed');
        expect(interpretShareResult(undefined, emails, sentAs).status).toBe('failed');
    });

    it('ignores junk in invalidUsers', () => {
        const out = interpretShareResult({ success: true, invalidUsers: [null, 5, {}, ''] }, emails, sentAs);
        expect(out.status).toBe('all');
    });
});

describe('messages', () => {
    it('joins addresses in plain English', () => {
        expect(joinEmails(['a'])).toBe('a');
        expect(joinEmails(['a', 'b'])).toBe('a and b');
        expect(joinEmails(['a', 'b', 'c'])).toBe('a, b and c');
    });
    it('agrees in number', () => {
        expect(noneSignedInMessage(['a@x.com'])).toContain('a@x.com hasn’t signed in');
        expect(noneSignedInMessage(['a@x.com', 'b@x.com'])).toContain('a@x.com and b@x.com haven’t signed in');
        expect(partialSignedInMessage(['a@x.com'])).toBe('Not shared with a@x.com — they haven’t signed in to Amplify yet.');
    });
});
