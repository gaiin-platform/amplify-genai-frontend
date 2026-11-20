/**
 * handleFile must tell its caller when a file will never become usable. Before
 * onUploadFailed existed, a failed upload left the attachment looking like it was
 * still uploading (and its pre-issued S3 key looking sendable), so a message could
 * reference an object that was never written to S3.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const addFile = vi.fn();
const checkContentReady = vi.fn();

vi.mock('@/services/fileService', () => ({
  addFile: (...args: unknown[]) => addFile(...args),
  checkContentReady: (...args: unknown[]) => checkContentReady(...args),
  deleteFile: vi.fn(),
}));
vi.mock('@/utils/app/files', () => ({ extractSensitivityLabel: vi.fn(async () => null) }));
vi.mock('@/components/Chat/JsPDF', () => ({}));

const file = { name: 'image.png', type: 'image/png', size: 10 } as File;

const run = async (onUploadFailed?: (doc: unknown, message: string) => void) => {
  const { handleFile } = await import('@/components/Chat/AttachFile');
  const events: string[] = [];
  await handleFile(
    file,
    () => events.push('attach'),
    (_doc: unknown, p: number) => events.push(`progress:${p}`),
    () => events.push('key'),
    () => events.push('metadata'),
    () => events.push('abort-registered'),
    true,
    undefined,
    false,
    {},
    [],
    undefined,
    onUploadFailed,
  );
  return events;
};

describe('handleFile onUploadFailed', () => {
  beforeEach(() => {
    addFile.mockReset();
    checkContentReady.mockReset();
    // The upload-error modal is dispatched on window; node has none.
    (globalThis as any).window = { dispatchEvent: vi.fn() };
    (globalThis as any).CustomEvent = class { constructor(public type: string, public init?: unknown) {} };
  });

  it('reports a failure when the S3 upload rejects, and never reports completion', async () => {
    addFile.mockResolvedValue({
      key: 'user/image.png',
      // lazy: only rejects once handleFile awaits it
      response: { then: (_: unknown, reject: (e: Error) => void) => reject(new Error('network down')) },
      metadataUrl: 'https://example.test/m.json',
      abortController: new AbortController(),
    });
    const failed = vi.fn();
    const events = await run(failed);
    expect(failed).toHaveBeenCalledTimes(1);
    expect(failed.mock.calls[0][0]).toMatchObject({ name: 'image.png' });
    expect(events).not.toContain('progress:100');
  });

  it('reports a failure when backend processing never succeeds', async () => {
    addFile.mockResolvedValue({
      key: 'user/image.png',
      response: Promise.resolve(),
      metadataUrl: 'https://example.test/m.json',
      abortController: new AbortController(),
    });
    checkContentReady.mockResolvedValue({ success: false });
    const failed = vi.fn();
    const events = await run(failed);
    expect(failed).toHaveBeenCalledTimes(1);
    expect(events).not.toContain('progress:100');
  });

  it('does not report a failure when the user aborts the upload', async () => {
    addFile.mockRejectedValue(new Error('Abort'));
    const failed = vi.fn();
    await run(failed);
    expect(failed).not.toHaveBeenCalled();
  });

  it('does not report a failure on success', async () => {
    addFile.mockResolvedValue({
      key: 'user/image.png',
      response: Promise.resolve(),
      metadataUrl: 'https://example.test/m.json',
      abortController: new AbortController(),
    });
    checkContentReady.mockResolvedValue({ success: true, metadata: { isImage: true } });
    const failed = vi.fn();
    const events = await run(failed);
    expect(failed).not.toHaveBeenCalled();
    expect(events.at(-1)).toBe('progress:100');
  });
});
