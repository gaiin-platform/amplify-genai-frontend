import { describe, expect, it } from 'vitest';
import { findOversizedSystemPrompts, MAX_SYSTEM_PROMPT_BYTES, utf8ByteLength } from '@/components/NewUI/settings/admin/systemPromptBytes';

describe('system prompt UTF-8 byte limits', () => {
  it('accepts ASCII, CJK, and emoji at exactly 16 KiB', () => {
    expect(utf8ByteLength('a'.repeat(16384))).toBe(MAX_SYSTEM_PROMPT_BYTES);
    expect(utf8ByteLength('界'.repeat(5461) + 'a')).toBe(MAX_SYSTEM_PROMPT_BYTES);
    expect(utf8ByteLength('😀'.repeat(4096))).toBe(MAX_SYSTEM_PROMPT_BYTES);
    expect(findOversizedSystemPrompts({ 'ordinaryChat.base': { text: 'a'.repeat(16384) } })).toEqual([]);
  });

  it('identifies prompts just over the limit without dropping entered text', () => {
    const cjk = '界'.repeat(5461) + 'aa';
    const emoji = '😀'.repeat(4096) + 'a';
    expect(utf8ByteLength('a'.repeat(16385))).toBe(16385);
    expect(findOversizedSystemPrompts({
      'ordinaryChat.base': { text: cjk },
      'webSearch.use': { text: emoji },
    })).toEqual([
      { key: 'ordinaryChat.base', bytes: 16385 },
      { key: 'webSearch.use', bytes: 16385 },
    ]);
  });

  it('counts a surrogate pair as one four-byte Unicode code point', () => {
    expect(utf8ByteLength('😀')).toBe(4);
    expect(utf8ByteLength('😀'.repeat(4096))).toBe(16384);
  });
});
