/**
 * The face of a PDF attachment card: a static first-page thumbnail, never an
 * embedded viewer.
 *
 *   loading  → skeleton (first page is being fetched / rendered)
 *   ready    → page 1 scaled to the card's width, cropped from the top, with a
 *              "PDF · N pages" chip (and the file name when `showName`)
 *   failed   → a plain file card: PDF icon, "PDF · size" and the name — used
 *              for encrypted, corrupt, oversized or unreachable files alike
 *
 * One component for all three surfaces so they cannot drift apart: the
 * composer's `AttachmentCard`, and the sent / reloaded transcript card (via
 * `chat/NewUITranscriptPdfThumbnail`). It fills its positioned parent and is
 * `aria-hidden` (the card's own label names the file). It has no click handler:
 * clicks bubble to the card, which opens `AttachmentPreview` — the one place
 * the browser's native PDF viewer is allowed.
 */
import React, { useEffect, useRef, useState } from 'react';
import { IconFileTypePdf } from '@tabler/icons-react';

import { fetchLibraryPdfBytes } from './libraryPreview';
import {
  MAX_THUMBNAIL_BYTES,
  PdfThumbnail,
  PdfThumbnailFailure,
  classifyPdfError,
  loadPdfThumbnail,
} from './pdfThumbnail';
import { formatBytes } from './attachmentTypes';

/** Where the PDF's bytes come from. `null` ⇒ nothing to render, show the file card. */
export type PdfThumbSource =
  /** A stored file, fetched through a signed URL (sent / reloaded messages). */
  | { kind: 'library'; key: string; groupId?: string }
  /** An in-memory URL the caller owns (composer: the local file's blob URL). */
  | { kind: 'url'; url: string }
  | null;

export function pdfSourceId(source: NonNullable<PdfThumbSource>): string {
  return source.kind === 'library'
    ? `lib:${source.groupId ?? ''}:${source.key.replace(/^s3:\/\//, '')}`
    : `url:${source.url}`;
}

async function fetchSourceBytes(source: NonNullable<PdfThumbSource>): Promise<Uint8Array> {
  if (source.kind === 'library') {
    return fetchLibraryPdfBytes({ key: source.key, groupId: source.groupId });
  }
  const response = await fetch(source.url);
  if (!response.ok) throw new Error(`PDF request failed: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

type State =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; thumb: PdfThumbnail }
  | { status: 'failed'; reason: PdfThumbnailFailure };

interface Props {
  source: PdfThumbSource;
  name: string;
  /** File size, for the fallback line and the too-large guard. */
  bytes?: number;
  /** Card footprint in CSS px — sizes the render, not the layout. */
  width: number;
  height: number;
  /** The source is not known yet (e.g. a library file still downloading). */
  pending?: boolean;
  /** Draw the file name here. Off when the host card already labels itself. */
  showName?: boolean;
}

const chipStyle: React.CSSProperties = {
  position: 'absolute',
  top: 8,
  left: 8,
  maxWidth: 'calc(100% - 16px)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '3px 7px',
  borderRadius: 6,
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: '0.04em',
  lineHeight: 1,
  whiteSpace: 'nowrap',
  color: 'var(--text-secondary)',
  background: 'color-mix(in srgb, var(--bg-app) 90%, transparent)',
  border: '1px solid var(--border-subtle)',
};

export const PdfThumbnailFace: React.FC<Props> = ({
  source,
  name,
  bytes,
  width,
  height,
  pending = false,
  showName = false,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<State>({ status: 'idle' });

  const sourceId = source ? pdfSourceId(source) : null;
  const tooLarge = typeof bytes === 'number' && bytes > MAX_THUMBNAIL_BYTES;

  // Only work once the card is near the viewport — a long chat can hold many PDFs.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!source || !sourceId || tooLarge) {
      setState({ status: 'idle' });
      return;
    }
    if (!visible) return;
    // Per-request flag (not a mounted ref): a superseded or unmounted request
    // is discarded either way, and StrictMode's remount cannot latch it off.
    let cancelled = false;
    setState({ status: 'loading' });
    loadPdfThumbnail(sourceId, () => fetchSourceBytes(source), {
      cardWidth: width,
      cardHeight: height,
      devicePixelRatio: typeof window === 'undefined' ? 1 : window.devicePixelRatio,
    })
      .then((thumb) => {
        if (!cancelled) setState({ status: 'ready', thumb });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: 'failed', reason: classifyPdfError(error) });
      });
    return () => {
      cancelled = true;
    };
    // `source` is identified by `sourceId`; a fresh object each render must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId, visible, tooLarge, width, height]);

  // Nothing to render (no source / too large) and nothing on the way → file card.
  const unrenderable = (!source && !pending) || tooLarge;
  const failed = unrenderable || state.status === 'failed';

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      data-pdf-face={failed ? 'fallback' : state.status === 'ready' ? 'ready' : 'loading'}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: failed ? 'var(--bg-raised)' : 'var(--bg-active)',
      }}
    >
      {failed ? (
        <div
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '12px 12px 40px',
            textAlign: 'center',
          }}
        >
          <IconFileTypePdf size={40} stroke={1.5} style={{ color: 'var(--file-icon-pdf)' }} />
          <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
            PDF{bytes ? ` · ${formatBytes(bytes)}` : ''}
          </span>
          {showName && (
            <span
              title={name}
              style={{
                maxWidth: '100%',
                fontSize: 12.5,
                lineHeight: 1.3,
                color: 'var(--text-primary)',
                overflowWrap: 'anywhere',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {name}
            </span>
          )}
        </div>
      ) : state.status === 'ready' ? (
        // A tall page fills the width and is cropped from the top; a short
        // (landscape) page is centred on the backdrop instead of stranded.
        <img
            src={state.thumb.dataUrl}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              left: 0,
              width: '100%',
              height: 'auto',
              ...(state.thumb.bitmapAspect >= width / height
                ? { top: '50%', transform: 'translateY(-50%)' }
                : { top: 0 }),
              display: 'block',
            }}
          />
      ) : (
        <div
          className="motion-safe:animate-pulse motion-reduce:animate-none"
          data-pdf-skeleton="true"
          style={{ position: 'absolute', inset: 0, background: 'var(--bg-hover)' }}
        />
      )}

      {!failed && (
        <span style={chipStyle}>
          PDF
          {state.status === 'ready' && state.thumb.pageCount > 0 && (
            <span style={{ fontWeight: 500, letterSpacing: 0 }}>
              · {state.thumb.pageCount} {state.thumb.pageCount === 1 ? 'page' : 'pages'}
            </span>
          )}
        </span>
      )}

      {!failed && showName && (
        <div
          title={name}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '6px 10px',
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text-primary)',
            background: 'color-mix(in srgb, var(--bg-app) 92%, transparent)',
            borderTop: '1px solid var(--border-subtle)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {name}
        </div>
      )}
    </div>
  );
};

export default PdfThumbnailFace;
