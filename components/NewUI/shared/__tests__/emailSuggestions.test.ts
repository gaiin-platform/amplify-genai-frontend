import { describe, expect, it } from 'vitest';
import {
    recipientsForDisplay,
    resolveEmailForUsername,
    resolveUsernameForEmail,
} from '../emailSuggestions';

const UUID_A = '4488a448-60f1-7015-9d03-0b67b9fdf5ce';
const UUID_B = '1111aaaa-2222-3333-4444-555566667777';
const UUID_C = '99999999-8888-7777-6666-555555555555';

const users = { [UUID_A]: 'Ann@x.com', [UUID_B]: 'bob@x.com' };

describe('resolveEmailForUsername', () => {
    it('maps a stored username (Cognito id) to its address', () => {
        expect(resolveEmailForUsername(UUID_A, users)).toBe('Ann@x.com');
    });

    it('matches the username case-insensitively', () => {
        expect(resolveEmailForUsername(UUID_A.toUpperCase(), users)).toBe('Ann@x.com');
    });

    it('returns an address that is already an address', () => {
        expect(resolveEmailForUsername('cy@x.com', users)).toBe('cy@x.com');
        expect(resolveEmailForUsername('cy@x.com', null)).toBe('cy@x.com');
    });

    it('returns "" for an unmapped id, so a raw UUID is never shown', () => {
        expect(resolveEmailForUsername(UUID_C, users)).toBe('');
        expect(resolveEmailForUsername(UUID_C, undefined)).toBe('');
    });

    it('ignores a map value that is itself a raw UUID', () => {
        expect(resolveEmailForUsername(UUID_C, { [UUID_C]: UUID_C })).toBe('');
    });

    it('returns "" for empty or non-string input', () => {
        expect(resolveEmailForUsername('', users)).toBe('');
        expect(resolveEmailForUsername('   ', users)).toBe('');
        expect(resolveEmailForUsername(undefined as unknown as string, users)).toBe('');
    });

    it('round-trips with resolveUsernameForEmail', () => {
        const username = resolveUsernameForEmail('bob@x.com', users);
        expect(username).toBe(UUID_B);
        expect(resolveEmailForUsername(username, users)).toBe('bob@x.com');
    });
});

describe('recipientsForDisplay', () => {
    it('lists resolved addresses', () => {
        expect(recipientsForDisplay([UUID_A, UUID_B], users)).toEqual(['Ann@x.com', 'bob@x.com']);
    });

    it('counts unresolved ids instead of showing them', () => {
        expect(recipientsForDisplay([UUID_A, UUID_C], users)).toEqual(['Ann@x.com', '1 more']);
        expect(recipientsForDisplay([UUID_C], users)).toEqual(['1 person']);
        expect(recipientsForDisplay([UUID_C, '99999999-0000-0000-0000-000000000000'], users)).toEqual(['2 people']);
    });

    it('works before the user map has loaded', () => {
        expect(recipientsForDisplay([UUID_A], undefined)).toEqual(['1 person']);
        expect(recipientsForDisplay(['cy@x.com'], undefined)).toEqual(['cy@x.com']);
    });

    it('handles a missing list', () => {
        expect(recipientsForDisplay(undefined, users)).toEqual([]);
        expect(recipientsForDisplay([], users)).toEqual([]);
    });
});
