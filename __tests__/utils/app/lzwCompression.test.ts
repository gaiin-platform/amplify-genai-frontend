import { describe, expect, it } from 'vitest';
import { lzwCompress, lzwUncompress } from '@/utils/app/lzwCompression';
import vectors from './fixtures/lzw_vectors.json';

const roundTrip = (text: string) => lzwUncompress(lzwCompress(text));

describe('lzw text round trip', () => {
  // These all used to fail (or silently change the text) because tags for U+0100..U+0FFF were written with
  // 3 hex digits and read back as 4, and a typed "U+0041" was read as a tag.
  it.each([
    ['ascii', 'hello world'],
    ['latin-1', 'café ñandú ÿ'],
    ['polish', 'zażółć gęślą jaźń'],
    ['turkish', 'İstanbul şğı'],
    ['cyrillic', 'Привет мир, как дела?'],
    ['greek', 'Γειά σου Κόσμε'],
    ['hebrew', 'שלום עולם'],
    ['arabic', 'مرحبا بالعالم'],
    ['devanagari', 'नमस्ते दुनिया'],
    ['thai', 'สวัสดีชาวโลก'],
    ['cjk', '你好，世界'],
    ['emoji', 'hi 😀 there 👍🏽'],
    ['tag-like text', 'the tag U+0041 is literal'],
    ['tag-like text, lowercase', 'also u+0041 and u+00e9'],
    ['U+ at the end', 'ends with U+'],
    ['two literal tags', 'U+U+0041U+'],
    ['3-digit char followed by hex letters', 'ā' + 'abc' + 'ł' + 'deadbeef'],
    ['json with non-latin text', JSON.stringify({ name: 'Привет', messages: [{ role: 'user', content: 'Zażółć U+0022 "quoted"' }] })],
  ])('%s', (_name, text) => {
    expect(roundTrip(text)).toBe(text);
  });

  it('survives a large non-latin document', () => {
    const text = 'Привет мир U+0041 — zażółć 😀 '.repeat(20000);
    expect(roundTrip(text)).toBe(text);
  });
});

describe('lzw wire format (shared with the backend)', () => {
  it.each(vectors.map((v, i) => [i, v] as const))('vector %i compresses to the same codes as the backend', (_i, v) => {
    expect(lzwCompress(v.text)).toEqual(v.codes);
  });

  it.each(vectors.map((v, i) => [i, v] as const))('vector %i is read back from the backend codes', (_i, v) => {
    expect(lzwUncompress(v.codes)).toBe(v.text);
  });

  it('still reads data written by the old encoder (unpadded 3 digit tags)', () => {
    // "а " (Cyrillic a + space) as the old encoder wrote it: U+430 followed by a space
    const legacy = Array.from('U+430 ').map((c) => c.charCodeAt(0));
    expect(lzwUncompress(legacy)).toBe('а ');
  });

  it('returns an empty string for empty input instead of failing', () => {
    expect(lzwUncompress([])).toBe('');
    expect(lzwCompress('')).toEqual([]);
  });
});
