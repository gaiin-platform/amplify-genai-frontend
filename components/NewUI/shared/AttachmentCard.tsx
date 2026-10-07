/**
 * AttachmentCard — a single 160×160 attachment tile shown in the composer rail.
 *
 * Three variants: image (thumbnail), file (name + badge), paste (text preview + badge).
 * Has a remove (×) button that fades in on hover.
 * Clicking the card face opens the preview overlay.
 *
 * Key spec refs:
 *   §2   card geometry, badge, remove button
 *   §4.4 upload progress bar (2px, inside bottom edge)
 *   §4.5 failure state
 *   §13  reduced-motion
 */
import React, { useRef, useState } from 'react';
import { IconEdit, IconLoader2 } from '@tabler/icons-react';
import { UIAttachment, formatBytes } from './attachmentTypes';

interface AttachmentCardProps {
  attachment: UIAttachment;
  /** Called when the user clicks × to dismiss the card. Omit for a read-only card. */
  onRemove?: (id: string) => void;
  /** Called when the user clicks the card face to open the preview overlay. */
  onPreview: (id: string, originRect: DOMRect) => void;
  /** Called when the user clicks "Retry" on a failed card. */
  onRetry?: (id: string) => void;
  /** Called to restore an eligible clipboard paste into the prompt editor. */
  onEdit?: (id: string) => void;
  /** Whether to make the remove × always visible (mobile, where no hover). */
  alwaysShowRemove?: boolean;
  /** Animation entry state — used by parent to control enter animation class. */
  enterState?: 'entering' | 'entered';
  /**
   * Card footprint. Defaults to the composer rail's 160×160. The transcript
   * rail passes the smaller card size the moved classic attachment cards use,
   * so a paste chip and an image chip are the same object in the same row.
   */
  width?: number;
  height?: number;
  /**
   * A sent attachment cannot be removed or retried — hide those affordances
   * without every caller having to pass no-op handlers.
   */
  readOnly?: boolean;
}

const CARD_SIZE = 160;
/** Below this edge length the 14px inset leaves too little room for text. */
const COMPACT_BELOW = 150;

/** Visible-text version for the paste card only; the source attachment stays untouched. */
export function normalizePastePreview(text: string | undefined): string {
  return text?.replace(/\s+/g, ' ').trim() ?? '';
}

export const AttachmentCard: React.FC<AttachmentCardProps> = ({
  attachment,
  onRemove,
  onPreview,
  onRetry,
  onEdit,
  alwaysShowRemove = false,
  enterState = 'entered',
  width = CARD_SIZE,
  height = CARD_SIZE,
  readOnly = false,
}) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const faceRef = useRef<HTMLButtonElement>(null);

  const {
    id,
    kind,
    status,
    name,
    ext,
    thumbUrl,
    bodyPreview,
    progress,
    error,
  } = attachment;

  const isFailed = status === 'failed';
  const composerPaste = kind === 'paste' && !readOnly && !attachment.sourceMessageId;
  const canEditPaste = composerPaste && Boolean(onEdit);
  const cardWidth = composerPaste ? 240 : width;
  const cardHeight = composerPaste ? 240 : height;
  const compact = Math.min(cardWidth, cardHeight) < COMPACT_BELOW;
  const inset = composerPaste ? 18 : compact ? 10 : 14;
  const pasteFontSize = composerPaste ? 13.5 : compact ? 11.5 : 12.5;
  const pastePreview = normalizePastePreview(bodyPreview);

  // Progress bar fill: determinate when progress is a number, indeterminate when undefined
  const progressFraction = progress ?? 0;
  const isIndeterminate = status === 'uploading' && progress === undefined;
  const isUploading = status === 'uploading';
  const isPreparingPreview = attachment.previewState === 'pending';
  const showRemove =
    !readOnly &&
    Boolean(onRemove) &&
    (alwaysShowRemove || hovered || isUploading || isPreparingPreview);

  // Entry animation: opacity+scale+translateY
  const entryStyle: React.CSSProperties =
    enterState === 'entering'
      ? {
          opacity: 0,
          transform: 'scale(0.92) translateY(8px)',
          transformOrigin: 'bottom left',
        }
      : {
          opacity: isUploading ? 0.7 : 1,
          transform: 'none',
          transition:
            'opacity 200ms cubic-bezier(.2,.8,.2,1), transform 200ms cubic-bezier(.2,.8,.2,1)',
        };

  return (
    <li
      role="listitem"
      className="relative flex-shrink-0"
      style={{
        width: cardWidth,
        height: cardHeight,
        scrollSnapAlign: 'start',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      {/* Card wrapper — positioning context */}
      <div
        className="relative w-full h-full"
        style={{
          ...entryStyle,
          willChange: 'opacity, transform',
        }}
      >
        {/* ── Card face button — fills the card, opens preview ── */}
        <button
          ref={faceRef}
          aria-label={`${name}${ext ? `, ${ext}` : ''}, ${formatBytes(attachment.bytes)}. Open preview.`}
          onClick={() => {
            const rect = faceRef.current?.getBoundingClientRect();
            if (rect) onPreview(id, rect);
          }}
          className="group w-full h-full rounded-[12px] overflow-hidden"
          style={{
            background: canEditPaste ? 'var(--bg-raised)' : 'var(--bg-app)',
            border: isFailed
              ? '1px solid #6E4540'
              : '1px solid var(--border-subtle)',
            padding: 0,
            cursor: 'pointer',
            display: 'grid',
            gridTemplateRows: '1fr auto',
            textAlign: 'left',
            transition: 'border-color 120ms, background 120ms',
          }}
          data-attachment-face="true"
        >
          {/* ── Body region ── */}
          <div
            className="relative overflow-hidden"
            style={{ padding: kind !== 'image' ? inset : 0 }}
          >
            {kind === 'image' ? (
              /* Image variant: thumbnail letterboxed in card, no badge */
              <div
                className="absolute inset-0 flex items-center justify-center p-2"
              >
                {/* Loading skeleton */}
                {!imgLoaded && (
                  <div
                    className="absolute inset-0 rounded-[10px]"
                    style={{ background: 'var(--bg-active)', opacity: 0.4 }}
                  />
                )}
                {thumbUrl && (
                  <img
                    src={thumbUrl}
                    alt={name}
                    onLoad={() => setImgLoaded(true)}
                    className="w-full h-full rounded-[6px]"
                    style={{
                      objectFit: 'contain',
                      opacity: imgLoaded ? 1 : 0,
                      transition: 'opacity 160ms ease',
                    }}
                  />
                )}
              </div>
            ) : kind === 'paste' ? (
              /* Paste preview: collapse whitespace visually and clamp without altering source text. */
              <div
                className="relative w-full h-full overflow-hidden"
                style={!composerPaste ? {
                  maskImage: 'linear-gradient(to bottom, #000 70%, transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, #000 70%, transparent 100%)',
                } : undefined}
              >
                <span
                  style={composerPaste ? {
                    fontSize: pasteFontSize,
                    lineHeight: 1.5,
                    color: 'var(--text-secondary)',
                    whiteSpace: 'normal',
                    wordBreak: 'break-all',
                    display: '-webkit-box',
                    WebkitLineClamp: 6,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  } : {
                    fontSize: pasteFontSize,
                    lineHeight: 1.5,
                    color: 'var(--text-muted)',
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                    display: 'block',
                  }}
                >
                  {composerPaste ? pastePreview : bodyPreview}
                </span>
              </div>
            ) : (
              /* File variant: filename (wrapping, 4 lines max) */
              <div>
                {isFailed && error && (
                  <span
                    className="block mb-1"
                    style={{ fontSize: 11.5, color: '#C4756B' }}
                  >
                    {error}
                  </span>
                )}
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: isFailed ? 'var(--text-muted)' : 'var(--text-primary)',
                    lineHeight: 1.35,
                    overflowWrap: 'anywhere',
                    display: '-webkit-box',
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {name}
                </span>
              </div>
            )}
          </div>

          {/* ── Badge row ── */}
          {(ext || kind === 'paste' || isFailed) && kind !== 'image' && (
            <div
              style={{
                padding: canEditPaste ? `0 ${inset + 48}px ${inset}px ${inset}px` : `0 ${inset}px ${inset}px`,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: isFailed ? '#C4756B' : 'var(--text-secondary)',
                  background: isFailed ? '#3A2A28' : canEditPaste ? 'transparent' : 'var(--bg-active)',
                  border: canEditPaste ? '1px solid var(--border-subtle)' : '1px solid transparent',
                  borderRadius: 6,
                  padding: '4px 8px',
                  lineHeight: 1,
                }}
              >
                {isFailed ? 'FAILED' : ext ?? 'PASTED'}
              </span>
            </div>
          )}

          {/* ── Upload progress spinner — centered overlay ── */}
          {isUploading && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                borderRadius: 12,
                pointerEvents: 'none',
                zIndex: 1,
                background: 'color-mix(in srgb, var(--bg-app) 42%, transparent)',
              }}
              role="progressbar"
              aria-valuenow={isIndeterminate ? undefined : Math.round(progressFraction * 100)}
              aria-busy={isIndeterminate || undefined}
              aria-label={`Uploading ${name}`}
            >
              <svg
                width="36"
                height="36"
                viewBox="0 0 36 36"
                className="new-ui-attachment-progress"
                style={{ display: 'block' }}
              >
                {/* Track */}
                <circle
                  cx="18" cy="18" r="14"
                  fill="none"
                  stroke="var(--border-subtle)"
                  strokeWidth="2.5"
                />
                {/* Fill arc — determinate */}
                {!isIndeterminate && (
                  <circle
                    cx="18" cy="18" r="14"
                    fill="none"
                    stroke="var(--text-secondary)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 14}`}
                    strokeDashoffset={`${2 * Math.PI * 14 * (1 - progressFraction)}`}
                    transform="rotate(-90 18 18)"
                    style={{ transition: 'stroke-dashoffset 200ms ease' }}
                  />
                )}
                {/* Spinning arc — indeterminate */}
                {isIndeterminate && (
                  <circle
                    cx="18" cy="18" r="14"
                    fill="none"
                    stroke="var(--text-secondary)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 14 * 0.25} ${2 * Math.PI * 14 * 0.75}`}
                    style={{ animation: 'attachment-spinner 1s linear infinite', transformOrigin: '18px 18px' }}
                  />
                )}
              </svg>
            </div>
          )}
          {isPreparingPreview && !isUploading && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: 'rgba(var(--bg-app-rgb, 38,38,36), 0.42)', borderRadius: 12, pointerEvents: 'none', zIndex: 1 }}
              role="status"
              aria-label={`Preparing preview for ${name}`}
            >
              <IconLoader2 size={30} style={{ color: 'var(--accent)', animation: 'attachment-spinner 1s linear infinite' }} />
            </div>
          )}
        </button>

        {/* ── Remove button — absolute sibling (not nested in the face button) ── */}
        {!readOnly && onRemove && (
        <button
          aria-label={`Remove ${name}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(id);
          }}
          className="absolute new-ui-attachment-remove"
          style={{
            top: -10,
            right: -10,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: 'var(--bg-composer)',
            border: '1px solid var(--border-subtle)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            lineHeight: 1,
            color: 'var(--text-primary)',
            opacity: showRemove ? 1 : 0,
            transition: 'opacity 120ms ease, background-color 120ms ease',
            pointerEvents: showRemove ? 'auto' : 'none',
            zIndex: 2,
          }}
        >
          ×
        </button>
        )}

        {/* ── Edit button — only wired for clipboard-paste cards in composer rails ── */}
        {canEditPaste && onEdit && (
          <button
            type="button"
            aria-label="Edit pasted text"
            title="Edit"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(id);
            }}
            className="absolute bottom-[18px] right-[18px] flex h-[38px] w-[38px] items-center justify-center rounded-[8px] border-0 text-[--accent-fg] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] focus-visible:ring-offset-2"
            style={{ background: 'var(--accent)', zIndex: 2 }}
          >
            <IconEdit size={18} aria-hidden="true" />
          </button>
        )}

        {/* ── Retry button — shown on failed cards (absolute, bottom-center) ── */}
        {!readOnly && isFailed && onRetry && (
          <button
            aria-label={`Retry uploading ${name}`}
            onClick={(e) => {
              e.stopPropagation();
              onRetry(id);
            }}
            style={{
              position: 'absolute',
              bottom: 10,
              left: '50%',
              transform: 'translateX(-50%)',
              height: 24,
              borderRadius: 6,
              background: '#3A2A28',
              border: '1px solid #6E4540',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 10px',
              fontSize: 11.5,
              fontWeight: 600,
              color: '#C4756B',
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
              zIndex: 3,
              transition: 'background 120ms, border-color 120ms',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = '#4A3530';
              (e.currentTarget as HTMLElement).style.borderColor = '#8E5550';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = '#3A2A28';
              (e.currentTarget as HTMLElement).style.borderColor = '#6E4540';
            }}
          >
            Retry
          </button>
        )}
      </div>
    </li>
  );
};

export default AttachmentCard;
