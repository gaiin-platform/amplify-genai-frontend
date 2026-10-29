import { describe, it, expect } from 'vitest';
import { checkSlugSystemTerms, cleanSlug, validateSlug } from '../assistantPathRules';

describe('validateSlug', () => {
    it('accepts a well-formed path', () => {
        expect(validateSlug('my-helper-2')).toBe('');
    });
    it('rejects blank, wrong characters, too short and too long', () => {
        expect(validateSlug('  ')).toMatch(/required/);
        expect(validateSlug('My_Helper')).toMatch(/lowercase/);
        expect(validateSlug('ab')).toMatch(/Minimum 3/);
        expect(validateSlug('a'.repeat(41))).toMatch(/Maximum 40/);
    });
});

describe('checkSlugSystemTerms', () => {
    it('blocks reserved words alone or at either end of the path', () => {
        expect(checkSlugSystemTerms('admin')).toMatch(/"admin"/);
        expect(checkSlugSystemTerms('admin-tools')).toMatch(/"admin"/);
        expect(checkSlugSystemTerms('my-billing')).toMatch(/"billing"/);
    });
    it('allows a reserved word inside another word or in the middle', () => {
        expect(checkSlugSystemTerms('administration')).toBe('');
        expect(checkSlugSystemTerms('my-admin-help')).toBe('');
        expect(checkSlugSystemTerms('helper')).toBe('');
    });
});

describe('cleanSlug', () => {
    it('lower-cases, strips invalid characters and caps the length', () => {
        expect(cleanSlug('My Helper!_9')).toBe('myhelper9');
        expect(cleanSlug('a'.repeat(60))).toHaveLength(40);
    });
});
