/**
 * Tests for shared/libraryAttachment — the intake for files that are ALREADY in
 * the user's library (already uploaded to S3).
 *
 * The bug this module fixes: AttachMenu's "Add from library" row called
 * `fileInputRef.current.click()` on the landing page and clicked the old UI's
 * hidden `#viewFiles` button in the docked composer. Both opened the local file
 * picker (or nothing at all) instead of the library, so there was no way to
 * attach an already-uploaded file from the composer.
 *
 * The two behaviours that must hold for a library file:
 *   1. Its AttachedDocument carries a `key` — every send path filters on
 *      `!!doc.key`, so a keyless document renders a card that never reaches the
 *      backend. `id` may arrive `s3://`-prefixed; the key must be bare.
 *   2. Its rail card is `ready` (no upload to wait for) but `pending` on
 *      preview, because `doc.data` is null and createUIAttachmentFromDoc would
 *      otherwise resolve a permanent 'unsupported'.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// getFileDownloadUrl is the only network call in the module — stub it so the
// hydration paths can be driven deterministically.
const getFileDownloadUrl = vi.fn();
vi.mock('@/services/fileService', () => ({
  getFileDownloadUrl: (...args: any[]) => getFileDownloadUrl(...args),
}));

import {
  createLibraryUIAttachment,
  hydrateLibraryAttachmentPreview,
  libraryFileToAttachedDocument,
} from '@/components/NewUI/shared/libraryAttachment';
import type { UIAttachment } from '@/components/NewUI/shared/attachmentTypes';
import type { AttachedDocument } from '@/types/attacheddocument';

beforeEach(() => {
  getFileDownloadUrl.mockReset();
});

// ─── libraryFileToAttachedDocument ────────────────────────────────────────────

describe('libraryFileToAttachedDocument', () => {
  it('uses the record id as the S3 key', () => {
    const doc = libraryFileToAttachedDocument({
      id: 'user@vu/2024/report.pdf',
      name: 'report.pdf',
      type: 'application/pdf',
    });
    expect(doc?.key).toBe('user@vu/2024/report.pdf');
  });

  it('strips an s3:// prefix so the send path does not double-prefix it', () => {
    // handleSend does `d.key.includes('://') ? d.key : 's3://' + d.key`, so a
    // key that still carries the scheme would be sent as-is while every other
    // attachment is normalised — extractKey is what keeps them consistent.
    const doc = libraryFileToAttachedDocument({
      id: 's3://user@vu/2024/report.pdf',
      name: 'report.pdf',
      type: 'application/pdf',
    });
    expect(doc?.key).toBe('user@vu/2024/report.pdf');
  });

  it('prefers an explicit key over the id', () => {
    const doc = libraryFileToAttachedDocument({
      id: 'row-id-not-a-key',
      key: 'user@vu/actual/key.csv',
      name: 'key.csv',
      type: 'text/csv',
    });
    expect(doc?.key).toBe('user@vu/actual/key.csv');
  });

  it('returns null when no key can be derived', () => {
    // A keyless library document would render a card that silently never
    // reaches the backend — refuse it instead.
    expect(libraryFileToAttachedDocument({ id: '', name: 'ghost.txt' })).toBeNull();
  });

  it('keeps data null so nothing tries to re-upload local bytes', () => {
    const doc = libraryFileToAttachedDocument({ id: 'k/a.pdf', name: 'a.pdf', type: 'application/pdf' });
    expect(doc?.data).toBeNull();
  });

  it('falls back to a MIME type derived from the filename', () => {
    const doc = libraryFileToAttachedDocument({ id: 'k/notes.csv', name: 'notes.csv' });
    expect(doc?.type).toBeTruthy();
    expect(doc?.type).not.toBe('');
  });

  it('preserves the picker metadata verbatim', () => {
    const doc = libraryFileToAttachedDocument({
      id: 'k/a.pdf',
      name: 'a.pdf',
      type: 'application/pdf',
      metadata: { totalTokens: 42, tags: ['q3'] },
    });
    expect(doc?.metadata).toEqual({ totalTokens: 42, tags: ['q3'] });
  });

  it('defaults metadata to an empty object rather than undefined', () => {
    const doc = libraryFileToAttachedDocument({ id: 'k/a.pdf', name: 'a.pdf' });
    expect(doc?.metadata).toEqual({});
  });

  it('carries a known size onto both size and raw.size', () => {
    const doc = libraryFileToAttachedDocument({ id: 'k/a.pdf', name: 'a.pdf', size: 2048 });
    expect(doc?.size).toBe(2048);
    expect(doc?.raw).toEqual({ size: 2048 });
  });
});

// ─── createLibraryUIAttachment ────────────────────────────────────────────────

describe('createLibraryUIAttachment', () => {
  const doc: AttachedDocument = {
    id: 'k/photo.png',
    name: 'photo.png',
    type: 'image/png',
    raw: { size: 100 },
    data: null,
    key: 'k/photo.png',
  };

  it('marks the card ready — a library file has no upload to wait for', () => {
    expect(createLibraryUIAttachment(doc).status).toBe('ready');
  });

  it('overrides previewState to pending instead of unsupported', () => {
    // createUIAttachmentFromDoc infers 'unsupported' for data=null. Leaving that
    // in place is the original attachment-preview bug.
    expect(createLibraryUIAttachment(doc).previewState).toBe('pending');
  });

  it('keeps the document id as the card id so removal matches both stores', () => {
    expect(createLibraryUIAttachment(doc).id).toBe('k/photo.png');
  });
});

// ─── hydrateLibraryAttachmentPreview ──────────────────────────────────────────

/** Minimal rail stub: one card, patched by the module under test. */
function makeRail(attachment: Partial<UIAttachment> & { id: string }) {
  let card = { bytes: 0, previewState: 'pending', ...attachment } as UIAttachment;
  return {
    get card() {
      return card;
    },
    patch: (id: string, update: (a: UIAttachment) => UIAttachment) => {
      if (id === card.id) card = update(card);
    },
  };
}

describe('hydrateLibraryAttachmentPreview', () => {
  const textDoc: AttachedDocument = {
    id: 'k/notes.md',
    name: 'notes.md',
    type: 'text/markdown',
    raw: '',
    data: null,
    key: 'k/notes.md',
  };

  it('fills body preview, full text and line count for a text file', async () => {
    getFileDownloadUrl.mockResolvedValue({ success: true, downloadUrl: 'https://x/y' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => 'line one\nline two',
    }));
    const rail = makeRail({ id: textDoc.id });

    await hydrateLibraryAttachmentPreview(textDoc, { patch: rail.patch });

    expect(rail.card.previewState).toBe('available');
    expect(rail.card.fullText).toBe('line one\nline two');
    expect(rail.card.lineCount).toBe(2);
    expect(rail.card.bytes).toBe(17);
  });

  it('does not clobber a size the card already knew', async () => {
    getFileDownloadUrl.mockResolvedValue({ success: true, downloadUrl: 'https://x/y' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => 'abc' }));
    const rail = makeRail({ id: textDoc.id, bytes: 999 });

    await hydrateLibraryAttachmentPreview(textDoc, { patch: rail.patch });

    expect(rail.card.bytes).toBe(999);
  });

  it('marks a text file too-large past the line ceiling', async () => {
    getFileDownloadUrl.mockResolvedValue({ success: true, downloadUrl: 'https://x/y' });
    const huge = 'x\n'.repeat(8_001);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => huge }));
    const rail = makeRail({ id: textDoc.id });

    await hydrateLibraryAttachmentPreview(textDoc, { patch: rail.patch });

    expect(rail.card.previewState).toBe('too-large');
  });

  it('marks an unpreviewable binary as unsupported', async () => {
    getFileDownloadUrl.mockResolvedValue({ success: true, downloadUrl: 'https://x/y' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => '' }));
    const pdf: AttachedDocument = { ...textDoc, id: 'k/a.pdf', name: 'a.pdf', type: 'application/pdf', key: 'k/a.pdf' };
    const rail = makeRail({ id: pdf.id });

    await hydrateLibraryAttachmentPreview(pdf, { patch: rail.patch });

    expect(rail.card.previewState).toBe('unsupported');
  });

  it('reports failed — never throws — when the download URL cannot be resolved', async () => {
    getFileDownloadUrl.mockResolvedValue({ success: false });
    const rail = makeRail({ id: textDoc.id });

    await expect(
      hydrateLibraryAttachmentPreview(textDoc, { patch: rail.patch }),
    ).resolves.toBeUndefined();
    expect(rail.card.previewState).toBe('failed');
  });

  it('reports failed on a non-OK preview response', async () => {
    getFileDownloadUrl.mockResolvedValue({ success: true, downloadUrl: 'https://x/y' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    const rail = makeRail({ id: textDoc.id });

    await hydrateLibraryAttachmentPreview(textDoc, { patch: rail.patch });

    expect(rail.card.previewState).toBe('failed');
  });

  it('reports failed without a network call when the document has no key', async () => {
    const rail = makeRail({ id: 'no-key' });

    await hydrateLibraryAttachmentPreview(
      { id: 'no-key', name: 'a.md', type: 'text/markdown', raw: '', data: null },
      { patch: rail.patch },
    );

    expect(getFileDownloadUrl).not.toHaveBeenCalled();
    expect(rail.card.previewState).toBe('failed');
  });
});
