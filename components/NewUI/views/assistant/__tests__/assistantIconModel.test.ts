import { describe, it, expect } from 'vitest';
import { iconKeysToDelete, layeredIconRef, promptIconRef, readIconRef, toStoredIcon, withAstIcon } from '../assistantIconModel';

describe('readIconRef', () => {
    it('reads a stored icon', () => {
        expect(readIconRef({ key: 'k1', type: 'image/png', groupId: 'g', name: 'a.png', raw: null })).toEqual({
            key: 'k1', type: 'image/png', groupId: 'g', name: 'a.png',
        });
    });

    it('falls back to metadata.contentKey like the backend delete path', () => {
        expect(readIconRef({ metadata: { contentKey: 'ck' } })?.key).toBe('ck');
    });

    it.each([undefined, null, 'k', 5, [], {}, { key: '' }, { key: '  ' }, { key: 7 }])('rejects %j', (value) => {
        expect(readIconRef(value)).toBeUndefined();
    });
});

describe('promptIconRef', () => {
    it('finds the icon at the top of data or inside the stored definition', () => {
        expect(promptIconRef({ data: { astIcon: { key: 'a' } } })?.key).toBe('a');
        expect(promptIconRef({ data: { assistant: { definition: { data: { astIcon: { key: 'b' } } } } } })?.key).toBe('b');
    });

    it('is undefined without an icon or data', () => {
        expect(promptIconRef({ data: { assistant: { definition: { data: {} } } } })).toBeUndefined();
        expect(promptIconRef({})).toBeUndefined();
        expect(promptIconRef(null)).toBeUndefined();
    });
});

describe('layeredIconRef', () => {
    it('reads the top level, else data', () => {
        expect(layeredIconRef({ astIcon: { key: 'x' } })?.key).toBe('x');
        expect(layeredIconRef({ data: { astIcon: { key: 'y' } } })?.key).toBe('y');
        expect(layeredIconRef({ name: 'n' })).toBeUndefined();
        expect(layeredIconRef(undefined)).toBeUndefined();
    });
});

describe('toStoredIcon', () => {
    it('keeps identifying fields and drops the file and its bytes', () => {
        const stored = toStoredIcon({ id: 'i', name: 'n.png', type: 'image/png', key: 'k', raw: new Blob(['x']), data: 'AAAA', metadata: { totalTokens: 0 } });
        expect(stored).toEqual({ id: 'i', name: 'n.png', type: 'image/png', key: 'k', raw: null, data: null, metadata: { totalTokens: 0 } });
    });

    it('stamps the group, preferring the explicit one', () => {
        expect(toStoredIcon({ id: 'i', key: 'k' }, 'g1').groupId).toBe('g1');
        expect(toStoredIcon({ id: 'i', key: 'k', groupId: 'g0' }).groupId).toBe('g0');
        expect('groupId' in toStoredIcon({ id: 'i', key: 'k' })).toBe(false);
    });
});

describe('withAstIcon', () => {
    it('sets the icon without touching other keys or the input', () => {
        const data = { a: 1 };
        expect(withAstIcon(data, { key: 'k' })).toEqual({ a: 1, astIcon: { key: 'k' } });
        expect(data).toEqual({ a: 1 });
    });

    it('removes a carried-forward icon when there is none', () => {
        const out = withAstIcon({ a: 1, astIcon: { key: 'old' } }, undefined);
        expect(out).toEqual({ a: 1 });
        expect('astIcon' in out).toBe(false);
    });
});

describe('iconKeysToDelete', () => {
    it('dedupes, drops blanks and spares the icon now in use', () => {
        expect(iconKeysToDelete(['a', 'b', 'a', '', 'c'], 'b')).toEqual(['a', 'c']);
        expect(iconKeysToDelete(['a'], undefined)).toEqual(['a']);
        expect(iconKeysToDelete([], 'x')).toEqual([]);
    });
});
