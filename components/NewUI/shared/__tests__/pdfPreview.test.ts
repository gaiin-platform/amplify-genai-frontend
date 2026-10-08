import { afterEach, describe, expect, it, vi } from 'vitest';

const getFileDownloadUrl = vi.fn();
vi.mock('@/services/fileService', () => ({
  getFileDownloadUrl: (...args: any[]) => getFileDownloadUrl(...args),
}));

const originalURL = globalThis.URL;

afterEach(() => {
  getFileDownloadUrl.mockReset();
  vi.restoreAllMocks();
  vi.stubGlobal('URL', originalURL);
});

describe('New UI PDF preview support', () => {
  it('creates a PDF preview URL for a prebuilt local PDF URL', async () => {
    const { createUIAttachmentFromDoc } = await import('@/components/NewUI/shared/attachmentTypes');
    const attachment = createUIAttachmentFromDoc({
      id: 'local-pdf',
      name: 'report.pdf',
      type: 'application/pdf',
      raw: '',
      data: null,
      size: 42,
    }, 1, 'blob:local-pdf');

    expect(attachment.previewUrl).toBe('blob:local-pdf');
    expect(attachment.previewState).toBe('available');
    expect(attachment.kind).toBe('file');
  });

  it('keeps data-less PDFs unsupported without a local preview URL', async () => {
    const { createUIAttachmentFromDoc } = await import('@/components/NewUI/shared/attachmentTypes');
    const attachment = createUIAttachmentFromDoc({
      id: 'library-pdf',
      name: 'report.pdf',
      type: 'application/pdf',
      raw: '',
      data: null,
    }, 1);

    expect(attachment.previewUrl).toBeUndefined();
    expect(attachment.previewState).toBe('unsupported');
  });

  it('decodes a raw PDF response for a library-owned chat preview', async () => {
    getFileDownloadUrl.mockResolvedValue({ success: true, downloadUrl: 'https://signed/report.pdf' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('%PDF-1.7', { headers: { 'content-type': 'application/pdf' } }),
    ));
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:pdf'), revokeObjectURL: vi.fn() });

    const { fetchLibraryPdfPreview } = await import('@/components/NewUI/shared/libraryPreview');
    await expect(fetchLibraryPdfPreview({
      key: 's3://user/report.pdf',
      mime: 'application/pdf',
      groupId: 'group-1',
    })).resolves.toMatchObject({ objectUrl: 'blob:pdf', bytes: 8 });
    expect(getFileDownloadUrl).toHaveBeenCalledWith('user/report.pdf', 'group-1');
  });

  it('decodes a JSON/base64 PDF response', async () => {
    const pdfBase64 = 'JVBERi0xLjc=';
    getFileDownloadUrl.mockResolvedValue({ success: true, downloadUrl: 'https://signed/report.pdf' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: pdfBase64 }), { headers: { 'content-type': 'application/json' } }),
    ));
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:encoded'), revokeObjectURL: vi.fn() });
    vi.stubGlobal('window', { atob: (value: string) => value === pdfBase64 ? '%PDF-1.7' : value });

    const { fetchLibraryPdfPreview } = await import('@/components/NewUI/shared/libraryPreview');
    await expect(fetchLibraryPdfPreview({ key: 'report.pdf', mime: 'application/pdf' })).resolves.toMatchObject({
      objectUrl: 'blob:encoded',
      bytes: 8,
    });
  });
});
