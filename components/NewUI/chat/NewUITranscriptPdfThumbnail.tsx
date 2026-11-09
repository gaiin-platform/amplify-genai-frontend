/**
 * First-page PDF thumbnail for post-send (and reloaded) transcript cards.
 *
 * The classic DataSourcesBlock renders a non-image attachment as a grey tile
 * with a small PDF glyph. `NewUITranscriptAttachmentsLayer` portals this into
 * that tile so it is covered by `shared/PdfThumbnailFace` — the same face the
 * composer card uses — rendered with pdf.js to a still image. There is no
 * <iframe>/<embed>/<object> here: those paint the browser's own PDF toolbar.
 * The classic card keeps its own name label and click target; a click opens
 * `shared/AttachmentPreview` via `NewUITranscriptPreviewLayer`.
 */
import React from 'react';

import { PdfThumbnailFace } from '@/components/NewUI/shared/PdfThumbnailFace';

/**
 * A PDF data source, by MIME or extension. No `id` requirement: a PDF with no
 * stored key still gets the clean file-card face rather than the classic glyph.
 */
export function isPdfDoc(doc: any): boolean {
  return Boolean(doc) && (doc.type === 'application/pdf' || /\.pdf$/i.test(doc.name ?? ''));
}

interface Props {
  doc: { id?: string; name?: string; size?: number; groupId?: string };
  width: number;
  height: number;
}

export const NewUITranscriptPdfThumbnail: React.FC<Props> = ({ doc, width, height }) => (
  <PdfThumbnailFace
    source={doc.id ? { kind: 'library', key: doc.id, groupId: doc.groupId } : null}
    name={doc.name ?? 'PDF'}
    bytes={Number(doc.size) || undefined}
    width={width}
    height={height}
    // The classic card already draws the (middle-ellipsised) name along its bottom edge.
    showName={false}
  />
);

export default NewUITranscriptPdfThumbnail;
