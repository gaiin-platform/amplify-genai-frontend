import { afterEach, describe, expect, it, vi } from 'vitest';

const getFileDownloadUrl = vi.fn();

vi.mock('@/services/fileService', () => ({
  getFileDownloadUrl: (...args: any[]) => getFileDownloadUrl(...args),
}));

afterEach(async () => {
  getFileDownloadUrl.mockReset();
  const { resetLibraryPreviewCache } = await import('@/components/NewUI/shared/libraryPreview');
  resetLibraryPreviewCache();
  vi.restoreAllMocks();
});

describe('libraryPreview', () => {
  it('shares concurrent image preview requests', async () => {
    let resolveDownload!: (response: Response) => void;
    const downloadPromise = new Promise<Response>((resolve) => { resolveDownload = resolve; });
    getFileDownloadUrl.mockResolvedValue({ success: true, downloadUrl: 'https://signed/image' });
    vi.stubGlobal('fetch', vi.fn(() => downloadPromise));
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:image'), revokeObjectURL: vi.fn() });
    vi.stubGlobal('window', { atob: (value: string) => value });

    const { loadLibraryPreview } = await import('@/components/NewUI/shared/libraryPreview');
    const first = loadLibraryPreview({ key: 's3://image-key', kind: 'image', mime: 'image/png' });
    const second = loadLibraryPreview({ key: 'image-key', kind: 'image', mime: 'image/png' });

    expect(first).toBe(second);
    resolveDownload(new Response('aGVsbG8=', { headers: { 'content-type': 'image/png' } }));
    await expect(first).resolves.toMatchObject({ kind: 'image', objectUrl: 'blob:image' });
    expect(getFileDownloadUrl).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('loads a PDF as a revocable object URL', async () => {
    getFileDownloadUrl.mockResolvedValue({ success: true, downloadUrl: 'https://signed/report.pdf' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('%PDF-1.7', { headers: { 'content-type': 'application/pdf' } })));
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:pdf'), revokeObjectURL: vi.fn() });

    const { loadLibraryPreview } = await import('@/components/NewUI/shared/libraryPreview');
    await expect(loadLibraryPreview({ key: 'report.pdf', kind: 'pdf', mime: 'application/pdf' })).resolves.toMatchObject({
      kind: 'pdf',
      objectUrl: 'blob:pdf',
    });
  });

  it('returns full text so the modal does not fetch it again', async () => {
    getFileDownloadUrl.mockResolvedValue({ success: true, downloadUrl: 'https://signed/text' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('hello\nworld')));

    const { loadLibraryPreview } = await import('@/components/NewUI/shared/libraryPreview');
    await expect(loadLibraryPreview({ key: 'text-key', kind: 'text', mime: 'text/plain' })).resolves.toMatchObject({
      kind: 'text',
      fullText: 'hello\nworld',
      bodyPreview: 'hello\nworld',
      lineCount: 2,
    });
  });

  it('allows a failed request to retry', async () => {
    getFileDownloadUrl
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce({ success: true, downloadUrl: 'https://signed/text' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('retry works')));

    const { loadLibraryPreview } = await import('@/components/NewUI/shared/libraryPreview');
    await expect(loadLibraryPreview({ key: 'retry-key', kind: 'text' })).rejects.toThrow('temporary failure');
    await expect(loadLibraryPreview({ key: 'retry-key', kind: 'text' })).resolves.toMatchObject({ fullText: 'retry works' });
    expect(getFileDownloadUrl).toHaveBeenCalledTimes(2);
  });

  it('revokes cached image URLs when released', async () => {
    getFileDownloadUrl.mockResolvedValue({ success: true, downloadUrl: 'https://signed/image' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('aGVsbG8=', { headers: { 'content-type': 'image/png' } })));
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:image'), revokeObjectURL });
    vi.stubGlobal('window', { atob: (value: string) => value });

    const { loadLibraryPreview, releaseLibraryPreview } = await import('@/components/NewUI/shared/libraryPreview');
    await loadLibraryPreview({ key: 'image-key', kind: 'image', mime: 'image/png' });
    releaseLibraryPreview({ key: 'image-key', kind: 'image', mime: 'image/png' });
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:image');
  });
});
