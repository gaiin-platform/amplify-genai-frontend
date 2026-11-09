/**
 * Tests for components/NewUI/shared/emailSuggestions.ts — the recipient
 * autocomplete vocabulary shared by the New UI share modal.
 *
 * The fixtures deliberately reproduce the real `amplifyUsers` payload rather
 * than an idealised one: `home.tsx` substitutes the *key* when a user has no
 * mapped email, so raw UUIDs appear as values, and some keys are addresses.
 */

import { describe, it, expect } from 'vitest';
import {
    buildEmailPool,
    isRawUUID,
    looksLikeEmail,
    normalizeEmailPool,
    rankEmailSuggestions,
    resolveUsernameForEmail,
    splitEmailList,
} from '@/components/NewUI/shared/emailSuggestions';

const UUID = '3f4b8c2e-11aa-4bb9-9c8d-77e6f0a1b2c3';

const users: Record<string, string> = {
    'ada.lovelace': 'ada.lovelace@example.edu',
    'grace.hopper': 'grace.hopper@example.edu',
    'alan.turing': 'alan.turing@example.edu',
    [UUID]: UUID, // user with no mapped email — must never be suggested
    'kat@example.edu': 'kat@example.edu', // key is the address itself
};

describe('isRawUUID', () => {
    it('detects bare UUIDs and rejects addresses', () => {
        expect(isRawUUID(UUID)).toBe(true);
        expect(isRawUUID(`  ${UUID}  `)).toBe(true);
        expect(isRawUUID('ada.lovelace@example.edu')).toBe(false);
        expect(isRawUUID(undefined)).toBe(false);
    });
});

describe('buildEmailPool', () => {
    it('drops raw UUID values so internal ids are never shown', () => {
        expect(buildEmailPool(users)).not.toContain(UUID);
    });

    it('excludes already-chosen recipients case-insensitively', () => {
        const pool = buildEmailPool(users, ['ADA.LOVELACE@example.edu']);
        expect(pool).not.toContain('ada.lovelace@example.edu');
        expect(pool).toContain('grace.hopper@example.edu');
    });

    it('de-duplicates and sorts for a stable dropdown order', () => {
        const pool = buildEmailPool({ a: 'b@x.com', b: 'B@x.com', c: 'a@x.com' });
        expect(pool).toEqual(['a@x.com', 'b@x.com']);
    });

    it('returns an empty pool when the map has not loaded yet', () => {
        expect(buildEmailPool(null)).toEqual([]);
        expect(buildEmailPool(undefined)).toEqual([]);
    });
});

describe('normalizeEmailPool', () => {
    // The two assistant call sites pass Object.values(amplifyUsers) as an array,
    // so the array entry point needs the same UUID/dupe/exclude guarantees.
    it('applies the same filtering to a plain array of addresses', () => {
        const pool = normalizeEmailPool(
            [UUID, 'b@x.com', 'B@x.com', ' a@x.com ', '', 'me@x.com'],
            ['ME@x.com'],
        );
        expect(pool).toEqual(['a@x.com', 'b@x.com']);
    });

    it('ignores non-string entries rather than throwing', () => {
        expect(normalizeEmailPool(['a@x.com', undefined, 42, null])).toEqual([
            'a@x.com',
        ]);
    });
});

describe('rankEmailSuggestions', () => {
    const pool = buildEmailPool(users);

    it('puts prefix matches ahead of substring matches', () => {
        const pool2 = ['zoe.ada@example.edu', 'ada.lovelace@example.edu'];
        expect(rankEmailSuggestions(pool2, 'ada')).toEqual([
            'ada.lovelace@example.edu',
            'zoe.ada@example.edu',
        ]);
    });

    it('matches on a last name in the middle of the address', () => {
        expect(rankEmailSuggestions(pool, 'hopper')).toEqual([
            'grace.hopper@example.edu',
        ]);
    });

    it('is case-insensitive and tolerates surrounding whitespace', () => {
        expect(rankEmailSuggestions(pool, '  TUR ')).toEqual([
            'alan.turing@example.edu',
        ]);
    });

    it('returns the head of the pool for an empty query and honours the limit', () => {
        expect(rankEmailSuggestions(pool, '', 2)).toEqual(pool.slice(0, 2));
        expect(rankEmailSuggestions(pool, 'example', 1)).toHaveLength(1);
        expect(rankEmailSuggestions(pool, 'example', 0)).toEqual([]);
    });

    it('returns nothing for a query no address contains', () => {
        expect(rankEmailSuggestions(pool, 'zzzz')).toEqual([]);
    });
});

describe('resolveUsernameForEmail', () => {
    it('maps an address back to the username the share API expects', () => {
        expect(resolveUsernameForEmail('alan.turing@example.edu', users)).toBe(
            'alan.turing',
        );
    });

    it('matches regardless of case, which a strict === lookup missed', () => {
        expect(resolveUsernameForEmail('Alan.Turing@Example.edu', users)).toBe(
            'alan.turing',
        );
    });

    it('falls back to the address when the user is not in the map', () => {
        expect(resolveUsernameForEmail('outside@other.org', users)).toBe(
            'outside@other.org',
        );
        expect(resolveUsernameForEmail('outside@other.org', null)).toBe(
            'outside@other.org',
        );
    });
});

describe('splitEmailList', () => {
    it('splits a pasted recipient list on commas, semicolons and whitespace', () => {
        expect(
            splitEmailList('a@x.com, b@x.com;c@x.com\n d@x.com'),
        ).toEqual(['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com']);
    });

    it('returns a single token unchanged and handles empty input', () => {
        expect(splitEmailList('a@x.com')).toEqual(['a@x.com']);
        expect(splitEmailList('   ')).toEqual([]);
        expect(splitEmailList('')).toEqual([]);
    });
});

describe('looksLikeEmail', () => {
    it('accepts an address and rejects fragments', () => {
        expect(looksLikeEmail('a@x.com')).toBe(true);
        expect(looksLikeEmail(' a@x.com ')).toBe(true);
        expect(looksLikeEmail('ada')).toBe(false);
        expect(looksLikeEmail('a@')).toBe(false);
        expect(looksLikeEmail('a@b@c')).toBe(false);
    });
});
