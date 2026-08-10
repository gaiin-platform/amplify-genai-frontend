/**
 * Shared types and helpers for the new-UI attachment rail.
 *
 * UIAttachment is the UI representation of an attached file, image, or pasted
 * text block. It wraps or mirrors an AttachedDocument for the upload pipeline
 * but carries extra visual/preview state that is purely frontend.
 *
 * Key spec refs:
 *   §2   card variants (image, file, paste)
 *   §6   paste capture — 4,000-character rule
 *   §7   preview overlay
 *   §8   unavailable-preview states
 *   §10  data shapes
 */

import { AttachedDocument } from '@/types/attacheddocument';

export type UIAttachmentKind = 'image' | 'file' | 'paste';
export type UIAttachmentStatus = 'uploading' | 'ready' | 'failed';

/** Server-computed (or locally inferred) preview availability state. */
export type UIAttachmentPreviewState =
  | 'available'
  | 'too-large'
  | 'unsupported'
  | 'pending'
  | 'failed';

export interface UIAttachment {
  id: string;
  kind: UIAttachmentKind;
  status: UIAttachmentStatus;

  /** Filename for file/image, derived title for paste (see derivePasteTitle). */
  name: string;
  /** Badge text — uppercase ext (CSV, PDF …). null for images (self-identifying). */
  ext: string | null;
  bytes: number;
  mime: string;

  // kind-specific
  thumbUrl?: string;            // image — object-URL or base64 data-URL
  bodyPreview?: string;         // paste — first ~400 chars shown on card
  lineCount?: number;           // text-ish — drives meta line in preview
  dimensions?: { w: number; h: number }; // image

  // preview
  previewState: UIAttachmentPreviewState;
  /** Third meta-slot in preview header: caveat shown only when relevant. */
  caveat?: string;

  progress?: number;  // 0..1 while uploading; undefined = indeterminate
  error?: string;     // §4.5 failure reason

  // underlying data
  doc?: AttachedDocument; // for file / image
  fullText?: string;      // for paste (full captured text)
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * 4,000 characters is roughly 60 lines — past this point, pasted content stops
 * reading as part of the sentence the user is writing and starts being a
 * document they're handing over.  Make it a single named constant, not a
 * literal at the call site.  (Spec §6.2)
 */
export const PASTE_AS_FILE_THRESHOLD = 4_000;

// Preview thresholds (spec §8)
const TOO_LARGE_TEXT_BYTES = 2 * 1024 * 1024;    // 2 MB
const TOO_LARGE_TEXT_LINES = 8_000;
const TOO_LARGE_IMAGE_BYTES = 12 * 1024 * 1024;  // 12 MB

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive a display title from raw pasted text (spec §6.1). */
export function derivePasteTitle(text: string): string {
  // 1. Leading Markdown H1 or H2
  const heading = text.match(/^#{1,2}\s+(.+)/m);
  if (heading) return heading[1].trim().slice(0, 60);
  // 2. First non-empty line
  const firstLine = text.split('\n').find((l) => l.trim());
  if (firstLine) return firstLine.trim().slice(0, 60);
  return 'Pasted text';
}

/** Format raw bytes to human-readable string (spec §7.2). */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_024 * 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / (1_024 * 1_024)).toFixed(2)} MB`;
}

/** Extract badge text from filename and MIME. Returns null for images. */
export function getExtBadge(filename: string, mime: string): string | null {
  if (mime.startsWith('image/')) return null;
  const ext = filename.split('.').pop();
  return ext ? ext.toUpperCase() : null;
}

/**
 * Build a UIAttachment from an AttachedDocument after handleFile completes.
 * previewState is computed locally; in production it should come from the server.
 *
 * @param prebuiltThumbUrl - Pass a pre-generated object-URL for images. The raw File
 *   object is NOT preserved on AttachedDocument (doc.raw is set to "" by handleFile),
 *   so the caller must generate the object-URL from the File BEFORE calling handleFile
 *   and pass it here. The caller is responsible for revoking it when the attachment
 *   is removed.
 */
export function createUIAttachmentFromDoc(
  doc: AttachedDocument,
  progress = 0,
  prebuiltThumbUrl?: string,
): UIAttachment {
  const mime = doc.type || '';
  const isImage = mime.startsWith('image/');
  const ext = getExtBadge(doc.name, mime);

  // Full text for text-ish files
  const fullText =
    !isImage && typeof doc.data === 'string' ? doc.data : undefined;
  const bodyPreview = fullText?.slice(0, 400);
  const lineCount = fullText ? fullText.split('\n').length : undefined;

  // Thumbnail for images — use caller-supplied URL first, fall back to doc.data base64
  let thumbUrl: string | undefined = prebuiltThumbUrl;
  if (isImage && !thumbUrl) {
    if (typeof doc.data === 'string' && doc.data.startsWith('data:')) {
      thumbUrl = doc.data;
    }
  }

  const bytes: number = (doc.raw as any)?.size ?? 0;

  // Local preview-state inference (spec §8)
  let previewState: UIAttachmentPreviewState = 'available';
  if (isImage) {
    if (bytes > TOO_LARGE_IMAGE_BYTES) previewState = 'too-large';
    else if (!thumbUrl) previewState = 'unsupported';
  } else if (fullText) {
    if (bytes > TOO_LARGE_TEXT_BYTES || (lineCount ?? 0) > TOO_LARGE_TEXT_LINES) {
      previewState = 'too-large';
    }
  } else {
    // Binary or unrecognised type — can't preview
    previewState = 'unsupported';
  }

  const pasted = mime === 'text/pasted';

  return {
    id: doc.id,
    kind: pasted ? 'paste' : isImage ? 'image' : 'file',
    status: progress >= 1 ? 'ready' : 'uploading',
    name: doc.name,
    ext: pasted ? null : ext,
    bytes,
    mime,
    thumbUrl,
    bodyPreview: pasted ? (typeof doc.data === 'string' ? doc.data.slice(0, 400) : undefined) : bodyPreview,
    fullText: pasted ? (typeof doc.data === 'string' ? doc.data : undefined) : fullText,
    lineCount,
    previewState,
    progress,
    doc,
  };
}

/** Build a UIAttachment for a large paste (spec §6). */
export function createPasteAttachment(text: string): UIAttachment {
  const id = Math.random().toString(36).slice(2);
  const name = derivePasteTitle(text);
  const bytes = new TextEncoder().encode(text).byteLength;
  const lineCount = text.split('\n').length;

  let previewState: UIAttachmentPreviewState = 'available';
  if (bytes > TOO_LARGE_TEXT_BYTES || lineCount > TOO_LARGE_TEXT_LINES) {
    previewState = 'too-large';
  }

  return {
    id,
    kind: 'paste',
    status: 'ready',
    name,
    ext: null,
    bytes,
    mime: 'text/plain',
    bodyPreview: text.slice(0, 400),
    fullText: text,
    lineCount,
    previewState,
    caveat: 'Formatting may be inconsistent from source',
  };
}
