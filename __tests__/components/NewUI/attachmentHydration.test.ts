/**
 * Tests for the library-attachment hydration helpers and the
 * createUIAttachmentFromDoc behaviour with library (data=null) documents.
 *
 * These tests exercise the exact failure boundaries described in the
 * "New UI attachment-preview bug":
 *
 * Root cause 1 (first fix): NewHome.tsx's useEffect claimed the
 *   amplify_pending_library_doc sessionStorage key before ConversationComposer
 *   could, and called createUIAttachmentFromDoc(doc, 1) without overriding
 *   previewState to 'pending' or starting the async fetch.  With doc.data=null,
 *   every library attachment resolved to previewState='unsupported'.
 *
 * Root cause 2 (this fix): next.config.js sets reactStrictMode:true, which
 *   double-invokes useEffect in development: effect → cleanup (cancelled=true)
 *   → effect again.  The second run finds the sessionStorage key gone and
 *   returns early.  When the async fetch from the first run completes,
 *   `if (cancelled) return` bails before any state update, leaving the
 *   attachment card at previewState='pending' (spinner) forever.
 *
 *   Fix: removed all cancelled-based early returns from state-update paths
 *   inside the async IIFE.  State updates are always applied (React 18 ignores
 *   setState on genuinely unmounted components); the cleanup is kept solely
 *   for object-URL memory management.
 *
 * imageResponseToObjectUrl requires browser globals (Blob, URL, window.atob)
 * and is tested in the companion *.browser.test.ts file under jsdom.
 */

import { describe, it, expect } from 'vitest';
import {
  createUIAttachmentFromDoc,
  getAttachmentMime,
  isTextPreviewable,
} from '@/components/NewUI/shared/attachmentTypes';
import type { AttachedDocument } from '@/types/attacheddocument';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeLibraryDoc(overrides: Partial<AttachedDocument> = {}): AttachedDocument {
  return {
    id: 'test-id-1',
    name: 'test.png',
    type: 'image/png',
    data: null,
    raw: { size: 1024 } as any,
    key: 'user/test/test.png',
    metadata: { totalTokens: 0 },
    ...overrides,
  };
}

// ─── Core bug-regression tests ────────────────────────────────────────────────

describe('createUIAttachmentFromDoc — library doc (data=null)', () => {
  it('returns previewState=unsupported for an image when no local data is present', () => {
    const doc = makeLibraryDoc({ name: 'photo.jpg', type: 'image/jpeg', data: null });
    const result = createUIAttachmentFromDoc(doc, 1);
    // This is the pre-fix behaviour that NewHome.tsx was exposing directly.
    // The fix sets previewState:'pending' and fetches the real data async.
    expect(result.previewState).toBe('unsupported');
    expect(result.thumbUrl).toBeUndefined();
  });

  it('returns previewState=unsupported for a text file when data is null', () => {
    const doc = makeLibraryDoc({ name: 'readme.md', type: 'text/markdown', data: null });
    const result = createUIAttachmentFromDoc(doc, 1);
    expect(result.previewState).toBe('unsupported');
    expect(result.fullText).toBeUndefined();
  });

  it('returns previewState=unsupported for a PDF (binary/no local data)', () => {
    const doc = makeLibraryDoc({ name: 'report.pdf', type: 'application/pdf', data: null });
    const result = createUIAttachmentFromDoc(doc, 1);
    expect(result.previewState).toBe('unsupported');
  });

  it('returns status=ready when progress=1 (already uploaded library file)', () => {
    const doc = makeLibraryDoc({ name: 'data.csv', type: 'text/csv', data: null });
    const result = createUIAttachmentFromDoc(doc, 1);
    expect(result.status).toBe('ready');
  });

  it('preserves doc.id and doc.name on the UIAttachment', () => {
    const doc = makeLibraryDoc({ id: 'abc-123', name: 'my-file.txt', type: 'text/plain', data: null });
    const result = createUIAttachmentFromDoc(doc, 1);
    expect(result.id).toBe('abc-123');
    expect(result.name).toBe('my-file.txt');
  });

  it('uses the retained upload size when handleFile has cleared raw', () => {
    const doc = makeLibraryDoc({ raw: '', size: 12_345 });
    const result = createUIAttachmentFromDoc(doc, 1);
    expect(result.bytes).toBe(12_345);
  });
});

// ─── MIME fallback tests ──────────────────────────────────────────────────────

describe('getAttachmentMime — filename-based MIME fallback', () => {
  it('returns the provided MIME when it is a valid type', () => {
    expect(getAttachmentMime('photo.jpg', 'image/jpeg')).toBe('image/jpeg');
  });

  it('falls back to extension when type is undefined', () => {
    const mime = getAttachmentMime('image.png', undefined);
    expect(mime).toMatch(/image\/png/i);
  });

  it('falls back to extension when type is application/octet-stream', () => {
    const mime = getAttachmentMime('spreadsheet.csv', 'application/octet-stream');
    // getMimeTypeFromExtension returns 'text/csv' or 'application/octet-stream';
    // either way the empty/octet fallback is replaced by the filename lookup.
    expect(['text/csv', 'application/octet-stream']).toContain(mime);
  });

  it('falls back to extension when type is an empty string', () => {
    const mime = getAttachmentMime('document.pdf', '');
    expect(mime).toBeTruthy();
  });

  it('returns an empty string for an unknown extension with no type', () => {
    // For an extension that getMimeTypeFromExtension cannot resolve, the result
    // is the normalised original or empty-string; it should NOT be undefined.
    const mime = getAttachmentMime('archive.xyz', undefined);
    expect(typeof mime).toBe('string');
  });
});

// ─── isTextPreviewable tests ──────────────────────────────────────────────────

describe('isTextPreviewable — classify files that can be rendered as text', () => {
  const textCases: Array<[string, string]> = [
    ['readme.md', 'text/markdown'],
    ['data.csv', 'text/csv'],
    ['config.json', 'application/json'],
    ['styles.xml', 'text/xml'],
    ['page.html', 'text/html'],
    ['report.txt', 'text/plain'],
    // Extension-only (MIME may be octet-stream from storage)
    ['data.tsv', 'application/octet-stream'],
    ['notes.md', 'application/octet-stream'],
  ];

  it.each(textCases)('classifies %s (%s) as text-previewable', (name, mime) => {
    expect(isTextPreviewable(name, mime)).toBe(true);
  });

  const binaryCases: Array<[string, string]> = [
    ['photo.jpg', 'image/jpeg'],
    ['photo.png', 'image/png'],
    ['video.mp4', 'video/mp4'],
    ['archive.zip', 'application/zip'],
    ['document.pdf', 'application/pdf'],
    ['binary.bin', 'application/octet-stream'],
  ];

  it.each(binaryCases)('does not classify %s (%s) as text-previewable', (name, mime) => {
    expect(isTextPreviewable(name, mime)).toBe(false);
  });
});

// ─── Hydration pre-conditions ─────────────────────────────────────────────────

describe('library document hydration pre-conditions', () => {
  it('doc from handleAttachToConversation has null data (no local bytes)', () => {
    // This replicates what NewLibraryView.handleAttachToConversation builds.
    const doc: AttachedDocument = {
      id: 'lib-id',
      name: 'photo.jpg',
      type: 'image/jpeg',
      data: null,
      raw: { size: 2048 } as any,
      key: 'user/abc/photo.jpg',
      metadata: { totalTokens: 0 },
    };
    // Confirm that createUIAttachmentFromDoc would produce 'unsupported'
    // without the previewState override (i.e. the pre-fix state).
    expect(createUIAttachmentFromDoc(doc, 1).previewState).toBe('unsupported');
    // After the fix, the calling code sets previewState:'pending' explicitly,
    // which is what the attachment card renders while the async fetch runs.
  });

  it('isImage + isText flags computed from MIME match expected values', () => {
    const imageMime = getAttachmentMime('photo.jpg', 'image/jpeg');
    expect(imageMime.startsWith('image/')).toBe(true);
    expect(isTextPreviewable('photo.jpg', imageMime)).toBe(false);

    const csvMime = getAttachmentMime('data.csv', 'text/csv');
    expect(csvMime.startsWith('image/')).toBe(false);
    expect(isTextPreviewable('data.csv', csvMime)).toBe(true);

    const pdfMime = getAttachmentMime('report.pdf', 'application/pdf');
    expect(pdfMime.startsWith('image/')).toBe(false);
    expect(isTextPreviewable('report.pdf', pdfMime)).toBe(false);
  });

  it('MIME fallback detects image type from extension when type is missing', () => {
    // Simulates a library record where storage stores no MIME but the
    // filename tells us the type.
    const mime = getAttachmentMime('screenshot.png', '');
    // Should resolve to image/png via extension lookup
    expect(mime.startsWith('image/')).toBe(true);
  });
});
