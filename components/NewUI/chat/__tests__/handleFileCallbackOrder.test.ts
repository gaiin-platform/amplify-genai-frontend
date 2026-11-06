/**
 * Pins the AttachFile#handleFile callback contract ConversationComposer relies on:
 * onSetKey fires as soon as the presigned URL exists — BEFORE the S3 PUT and the
 * metadata poll finish — and onUploadProgress(100) is the only completion signal.
 * Treating onSetKey as "ready" sent follow-up prompts with unprocessed documents.
 */
import { describe, expect, it, vi } from 'vitest';

let resolveUpload: () => void = () => {};
let resolveReady: (value: unknown) => void = () => {};

vi.mock('@/services/fileService', () => ({
  addFile: vi.fn(async () => ({
    key: 'user/doc.pdf',
    response: new Promise<void>((r) => { resolveUpload = r; }),
    metadataUrl: 'https://example.test/doc.pdf.metadata.json',
    statusUrl: null,
    contentUrl: null,
    abortController: new AbortController(),
  })),
  checkContentReady: vi.fn(() => new Promise((r) => { resolveReady = r; })),
  deleteFile: vi.fn(),
}));
vi.mock('@/utils/app/files', () => ({ extractSensitivityLabel: vi.fn(async () => null) }));
vi.mock('@/components/Chat/JsPDF', () => ({}));

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('handleFile callback order', () => {
  it('reports the key before processing completes, and completion only via progress 100', async () => {
    const { handleFile } = await import('@/components/Chat/AttachFile');
    const events: string[] = [];
    const file = { name: 'doc.pdf', type: 'application/pdf', size: 10 } as File;

    const done = handleFile(
      file,
      () => events.push('attach'),
      (_doc: unknown, p: number) => events.push(`progress:${p}`),
      () => events.push('key'),
      () => events.push('metadata'),
      () => events.push('abort-registered'),
      true,
      undefined,
      true,
    );

    await flush();
    expect(events).toContain('key');
    expect(events).not.toContain('progress:100');

    resolveUpload();
    await flush();
    expect(events).not.toContain('progress:100');

    resolveReady({ success: true, metadata: { totalItems: 3 } });
    await done;
    expect(events.indexOf('key')).toBeLessThan(events.indexOf('progress:100'));
    expect(events.at(-1)).toBe('progress:100');
  });
});
