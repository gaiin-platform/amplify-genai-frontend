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
import { UIAttachment, formatBytes } from './attachmentTypes';

interface AttachmentCardProps {
  attachment: UIAttachment;
  /** Called when the user clicks × to dismiss the card. */
  onRemove: (id: string) => void;
  /** Called when the user clicks the card face to open the preview overlay. */
  onPreview: (id: string, originRect: DOMRect) => void;
  /** Whether to make the remove × always visible (mobile, where no hover). */
  alwaysShowRemove?: boolean;
  /** Animation entry state — used by parent to control enter animation class. */
  enterState?: 'entering' | 'entered';
}

const CARD_SIZE = 160;

export const AttachmentCard: React.FC<AttachmentCardProps> = ({
  attachment,
  onRemove,
  onPreview,
  alwaysShowRemove = false,
  enterState = 'entered',
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

  const showRemove = alwaysShowRemove || hovered;
  const isFailed = status === 'failed';

  // Progress bar fill: determinate when progress is a number, indeterminate when undefined
  const progressFraction = progress ?? 0;
  const isIndeterminate = status === 'uploading' && progress === undefined;
  const isUploading = status === 'uploading';

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
        width: CARD_SIZE,
        height: CARD_SIZE,
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
            background: 'var(--bg-app)',
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
          onMouseEnter={(e) => {
            if (!isFailed) {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--bg-active)';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = isFailed
              ? '#6E4540'
              : 'var(--border-subtle)';
          }}
        >
          {/* ── Body region ── */}
          <div
            className="relative overflow-hidden"
            style={{ padding: kind !== 'image' ? 14 : 0 }}
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
              /* Paste variant: first ~400 chars of text, faded at bottom */
              <div
                className="relative w-full h-full overflow-hidden"
                style={{
                  maskImage: 'linear-gradient(to bottom, #000 70%, transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, #000 70%, transparent 100%)',
                }}
              >
                <span
                  style={{
                    fontSize: 12.5,
                    lineHeight: 1.5,
                    color: 'var(--text-muted)',
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                    display: 'block',
                  }}
                >
                  {bodyPreview}
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
            <div style={{ padding: '0 14px 14px', display: 'flex', alignItems: 'flex-end' }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: isFailed ? '#C4756B' : 'var(--text-secondary)',
                  background: isFailed ? '#3A2A28' : 'var(--bg-active)',
                  borderRadius: 6,
                  padding: '3px 9px',
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
              style={{ borderRadius: 12, pointerEvents: 'none', zIndex: 1 }}
              role="progressbar"
              aria-valuenow={isIndeterminate ? undefined : Math.round(progressFraction * 100)}
              aria-busy={isIndeterminate || undefined}
              aria-label={`Uploading ${name}`}
            >
              <svg
                width="36"
                height="36"
                viewBox="0 0 36 36"
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
        </button>

        {/* ── Remove button — absolute sibling (not nested in the face button) ── */}
        <button
          aria-label={`Remove ${name}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(id);
          }}
          className="absolute"
          style={{
            top: 6,
            right: 6,
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: 'rgba(var(--bg-active-raw, 58,58,56), 0.9)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            color: 'var(--text-primary)',
            opacity: showRemove ? 1 : 0,
            transition: 'opacity 120ms ease',
            pointerEvents: showRemove ? 'auto' : 'none',
            zIndex: 2,
          }}
        >
          ×
        </button>
      </div>
    </li>
  );
};

export default AttachmentCard;
