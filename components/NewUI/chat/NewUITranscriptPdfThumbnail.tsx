/**
 * First-page PDF thumbnail for post-send transcript attachment cards.
 *
 * The classic DataSourcesBlock renders non-image attachments as a grey tile with
 * a PDF glyph. `NewUITranscriptAttachmentsLayer` portals this component into that
 * tile's face so a sent PDF shows what it contains, the way images do.
 *
 * No PDF library is involved: the file is fetched once (lazily, when the card
 * scrolls into view) and shown in the browser's own PDF viewer, scaled down and
 * pinned to page 1 with the viewer chrome hidden. The iframe ignores pointer
 * events so clicks still reach the card and open the full `AttachmentPreview`.
 * Until the first page paints, or if the fetch fails, the classic icon stays.
 */
import React, { useEffect, useRef, useState } from 'react';

import { fetchLibraryPdfPreview } from '@/components/NewUI/shared/libraryPreview';

/** Skip the fetch for very large files — the glyph is a better trade than a 50 MB download. */
const MAX_THUMBNAIL_BYTES = 25 * 1024 * 1024;
/** Viewer is laid out at 3× the card, then scaled down, so page text stays legible. */
const SCALE_UP = 3;
/** Extra width pushes the viewer's scrollbar outside the clipped card. */
const SCROLLBAR_BLEED = 30;
const VIEWER_PARAMS = '#page=1&view=FitH&toolbar=0&navpanes=0&scrollbar=0';

export function isPdfDoc(doc: any): boolean {
  return Boolean(doc?.id) && (doc.type === 'application/pdf' || /\.pdf$/i.test(doc.name ?? ''));
}

interface Props {
  doc: { id: string; name?: string; size?: number; groupId?: string };
  width: number;
  height: number;
}

export const NewUITranscriptPdfThumbnail: React.FC<Props> = ({ doc, width, height }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [painted, setPainted] = useState(false);

  // Only fetch once the card is near the viewport — long chats can hold many PDFs.
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
    if (!visible || (doc.size && doc.size > MAX_THUMBNAIL_BYTES)) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    fetchLibraryPdfPreview({ key: doc.id, mime: 'application/pdf', groupId: doc.groupId })
      .then((result) => {
        if (cancelled) {
          URL.revokeObjectURL(result.objectUrl);
          return;
        }
        objectUrl = result.objectUrl;
        setUrl(result.objectUrl);
      })
      .catch(() => {
        /* keep the classic icon */
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [visible, doc.id, doc.groupId, doc.size]);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: 'white',
        opacity: painted ? 1 : 0,
        transition: 'opacity 160ms ease',
        pointerEvents: 'none',
      }}
    >
      {url && (
        <iframe
          src={`${url}${VIEWER_PARAMS}`}
          title={`Preview of ${doc.name ?? 'PDF'}`}
          tabIndex={-1}
          loading="lazy"
          onLoad={() => setPainted(true)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: width * SCALE_UP + SCROLLBAR_BLEED,
            height: height * SCALE_UP,
            border: 0,
            transform: `scale(${1 / SCALE_UP})`,
            transformOrigin: 'top left',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
};

export default NewUITranscriptPdfThumbnail;
