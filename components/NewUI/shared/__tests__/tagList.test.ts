import { describe, it, expect } from 'vitest';
import { addTags, removeTag } from '../tagList';

describe('addTags', () => {
    it('splits on commas, trims, and drops blanks and case-insensitive duplicates', () => {
        expect(addTags(['Billing'], ' billing, Refunds ,, Support')).toEqual(['Billing', 'Refunds', 'Support']);
    });
    it('caps the number of tags and the length of each', () => {
        expect(addTags(['a', 'b'], 'c, d', { maxTags: 3 })).toEqual(['a', 'b', 'c']);
        expect(addTags([], 'abcdef', { maxLength: 3 })).toEqual(['abc']);
    });
    it('does not mutate its input', () => {
        const current = ['a'];
        addTags(current, 'b');
        expect(current).toEqual(['a']);
    });
});

describe('removeTag', () => {
    it('removes exactly the given tag', () => {
        expect(removeTag(['a', 'b'], 'a')).toEqual(['b']);
    });
});
