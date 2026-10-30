/**
 * Tests for "Download as Word" on a single reply: which replies are exportable, the
 * payload the converter receives, and the shared polling helper's outcomes.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildWordExportOptions,
  buildWordExportPayload,
  canExportAsWord,
} from '@/components/NewUI/shared/messageWordExport';
import { waitForConvertedFile } from '@/services/downloadService';

const msg = (role: string, content: string) => ({ role, content }) as any;

describe('canExportAsWord', () => {
  it('accepts an assistant reply with text', () => {
    expect(canExportAsWord(msg('assistant', 'hello'))).toBe(true);
  });
  it('rejects empty, whitespace-only, user and missing messages', () => {
    expect(canExportAsWord(msg('assistant', ''))).toBe(false);
    expect(canExportAsWord(msg('assistant', '  \n '))).toBe(false);
    expect(canExportAsWord(msg('user', 'hi'))).toBe(false);
    expect(canExportAsWord(undefined)).toBe(false);
  });
});

describe('buildWordExportPayload / options', () => {
  it('sends only the chosen message, normalising a missing folderId', () => {
    const m = msg('assistant', 'answer');
    const payload = buildWordExportPayload({ id: 'c1', name: 'Chat', messages: [msg('user', 'q'), m] } as any, m);
    expect(payload.version).toBe(4);
    expect(payload.history).toHaveLength(1);
    expect(payload.history[0].messages).toEqual([m]);
    expect((payload.history[0] as any).folderId).toBeNull();
  });
  it('requests docx without the conversation name', () => {
    const o = buildWordExportOptions();
    expect(o.format).toBe('docx');
    expect(o.includeConversationName).toBe(false);
  });
});

describe('waitForConvertedFile', () => {
  afterEach(() => vi.unstubAllGlobals());
  const res = (ok: boolean, text = '') => ({ ok, text: async () => text }) as any;

  it('resolves ready once the file exists', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(res(false)).mockResolvedValueOnce(res(true)));
    expect(await waitForConvertedFile('u', undefined, { intervalMs: 0 })).toEqual({ status: 'ready' });
  });
  it('reports the converter error marker with paths stripped', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (u: string) =>
      u === 'err' ? res(true, 'pandoc failed at /tmp/abc/file.md\nstack') : res(false)));
    const out = await waitForConvertedFile('u', 'err', { intervalMs: 0 });
    expect(out).toEqual({ status: 'failed', reason: 'pandoc failed at' });
  });
  it('times out after maxTries', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(false)));
    expect(await waitForConvertedFile('u', undefined, { maxTries: 3, intervalMs: 0 })).toEqual({ status: 'timeout' });
  });
  it('reports unreachable on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await waitForConvertedFile('u', undefined, { intervalMs: 0 })).toEqual({ status: 'unreachable' });
  });
  it('stops when asked', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    expect(await waitForConvertedFile('u', undefined, { shouldStop: () => true })).toEqual({ status: 'stopped' });
    expect(f).not.toHaveBeenCalled();
  });
});
