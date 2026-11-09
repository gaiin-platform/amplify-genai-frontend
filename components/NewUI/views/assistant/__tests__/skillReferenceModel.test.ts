import { describe, it, expect } from 'vitest';
import { backfillSkillNames, newSkillReference } from '../skillReferenceModel';

describe('newSkillReference', () => {
    it('stores the name when known and omits the key when not', () => {
        expect(newSkillReference('s1', 'Brand voice')).toEqual({ skillId: 's1', isRequired: true, name: 'Brand voice' });
        expect('name' in newSkillReference('s1')).toBe(false);
    });
});

describe('backfillSkillNames', () => {
    const names = new Map<string, string | undefined>([['a', 'Alpha'], ['b', 'Beta'], ['c', undefined]]);

    it('fills only the missing names it knows, keeping the rest untouched', () => {
        const refs = [
            { skillId: 'a', isRequired: true },
            { skillId: 'b', isRequired: false, name: 'Custom label' },
            { skillId: 'c', isRequired: true },
            { skillId: 'zzz', isRequired: true },
        ];
        expect(backfillSkillNames(refs, names)).toEqual([
            { skillId: 'a', isRequired: true, name: 'Alpha' },
            { skillId: 'b', isRequired: false, name: 'Custom label' },
            { skillId: 'c', isRequired: true },
            { skillId: 'zzz', isRequired: true },
        ]);
    });

    it('returns the same array when nothing changed, so an effect on it cannot loop', () => {
        const refs = [{ skillId: 'b', isRequired: true, name: 'Beta' }, { skillId: 'zzz', isRequired: true }];
        expect(backfillSkillNames(refs, names)).toBe(refs);
        const filled = backfillSkillNames([{ skillId: 'a', isRequired: true }], names);
        expect(backfillSkillNames(filled, names)).toBe(filled);
    });
});
