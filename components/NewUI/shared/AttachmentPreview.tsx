/**
 * AttachmentPreview — full-screen overlay showing attachment contents.
 *
 * Opens when the user clicks a card face (pre-send) or a post-send attachment card.
 * FLIP animation: the panel expands from the card's bounding rect.
 *
 * Key spec refs:
 *   §7   preview overlay geometry, header, content panel, motion
 *   §8   unavailable-preview states (too-large, unsupported, pending, failed)
 *   §11  keyboard & a11y
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { IconAlertCircle, IconClock, IconLoader2, IconPaperclip } from '@tabler/icons-react';
import { UIAttachment, formatBytes } from './attachmentTypes';

interface AttachmentPreviewProps {
  attachments: UIAttachment[];
  /** Index into `attachments` to open first. */
  initialIndex: number;
  /** DOMRect of the originating card — used for FLIP entrance. */
  originRect?: DOMRect;
  onClose: () => void;
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// CSV mini-parser — only the first 500 rows (spec §7.3)
function parseCSV(text: string): string[][] {
  const lines = text.split('\n').slice(0, 501);
  return lines.map((l) =>
    l.split(',').map((c) => c.replace(/^"|"$/g, '').trim()),
  );
}

export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({
  attachments,
  initialIndex,
  originRect,
  onClose,
}) => {
  const [idx, setIdx] = useState(
    Math.max(0, Math.min(initialIndex, attachments.length - 1)),
  );
  const [panelMounted, setPanelMounted] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);
  const [remoteText, setRemoteText] = useState<string | undefined>(undefined);
  const [remoteTextLoading, setRemoteTextLoading] = useState(false);
  const [remoteTextFailed, setRemoteTextFailed] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const reduced = prefersReducedMotion();

  const attachment = attachments[idx];

  useEffect(() => {
    let cancelled = false;
    setRemoteText(undefined);
    setRemoteTextFailed(false);
    const isRemoteText = Boolean(
      attachment?.previewUrl &&
      attachment.previewState === 'available' &&
      !attachment.fullText &&
      !attachment.bodyPreview &&
      !attachment.mime.startsWith('image/'),
    );
    if (!isRemoteText || !attachment?.previewUrl) {
      setRemoteTextLoading(false);
      return;
    }
    setRemoteTextLoading(true);
    fetch(attachment.previewUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Preview request failed: ${response.status}`);
        return response.text();
      })
      .then((text) => {
        if (!cancelled) setRemoteText(text);
      })
      .catch(() => {
        if (!cancelled) setRemoteTextFailed(true);
      })
      .finally(() => {
        if (!cancelled) setRemoteTextLoading(false);
      });
    return () => { cancelled = true; };
  }, [attachment]);

  // ── FLIP entrance animation ────────────────────────────────────────────────
  useEffect(() => {
    if (reduced || !originRect || !panelRef.current) {
      setPanelMounted(true);
      setTimeout(() => setContentVisible(true), 60);
      return;
    }

    const panel = panelRef.current;
    const finalRect = panel.getBoundingClientRect();

    // Start from card rect
    const scaleX = originRect.width / finalRect.width;
    const scaleY = originRect.height / finalRect.height;
    const dx = originRect.left + originRect.width / 2 - (finalRect.left + finalRect.width / 2);
    const dy = originRect.top + originRect.height / 2 - (finalRect.top + finalRect.height / 2);

    panel.style.transition = 'none';
    panel.style.transform = `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`;
    panel.style.borderRadius = '12px';
    panel.style.opacity = '0';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        panel.style.transition =
          'transform 320ms cubic-bezier(.2,.8,.2,1), border-radius 320ms cubic-bezier(.2,.8,.2,1), opacity 100ms ease';
        panel.style.transform = 'translate(0,0) scale(1)';
        panel.style.borderRadius = '20px';
        panel.style.opacity = '1';
        setPanelMounted(true);
        setTimeout(() => setContentVisible(true), 140);
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Focus trap + keyboard navigation ─────────────────────────────────────
  const dialogRef = panelRef; // alias for clarity — panelRef IS the dialog element
  useEffect(() => {
    closeBtnRef.current?.focus();

    const FOCUSABLE = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowLeft') { setIdx((i) => Math.max(0, i - 1)); return; }
      if (e.key === 'ArrowRight') { setIdx((i) => Math.min(attachments.length - 1, i + 1)); return; }
      if (e.key !== 'Tab') return;
      const panel = dialogRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [attachments.length, onClose, dialogRef]);

  // ── Close with reverse FLIP ───────────────────────────────────────────────
  const handleClose = useCallback(() => {
    if (!reduced && originRect && panelRef.current) {
      const panel = panelRef.current;
      const finalRect = panel.getBoundingClientRect();
      const scaleX = originRect.width / finalRect.width;
      const scaleY = originRect.height / finalRect.height;
      const dx = originRect.left + originRect.width / 2 - (finalRect.left + finalRect.width / 2);
      const dy = originRect.top + originRect.height / 2 - (finalRect.top + finalRect.height / 2);
      panel.style.transition =
        'transform 240ms cubic-bezier(.4,0,1,1), border-radius 240ms cubic-bezier(.4,0,1,1), opacity 120ms ease';
      panel.style.transform = `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`;
      panel.style.borderRadius = '12px';
      panel.style.opacity = '0';
      setTimeout(onClose, 240);
    } else {
      onClose();
    }
  }, [onClose, originRect, reduced]);

  if (!attachment) return null;

  const { name, kind, mime, bytes, lineCount, dimensions, previewState, caveat, fullText, thumbUrl, previewUrl, bodyPreview } = attachment;
  const previewText = fullText ?? bodyPreview ?? remoteText;

  // Meta line items (spec §7.2)
  const metaItems: string[] = [formatBytes(bytes)];
  if (lineCount) metaItems.push(`${lineCount.toLocaleString()} lines`);
  else if (dimensions) metaItems.push(`${dimensions.w} × ${dimensions.h}`);
  const metaLine = metaItems.join(' • ');

  // Is CSV/TSV?
  const isCSV =
    mime === 'text/csv' ||
    mime === 'text/tsv' ||
    name.endsWith('.csv') ||
    name.endsWith('.tsv');

  const csvRows = isCSV && previewText ? parseCSV(previewText) : null;
  const csvTruncated = csvRows && csvRows.length > 500;

  // Is image?
  const isImage = kind === 'image';

  return (
    <>
      {/* ── Overlay ── */}
      <div
        className="fixed inset-0 z-[200]"
        style={{
          background: 'rgba(var(--bg-app-rgb, 38,38,36), 0.62)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          opacity: panelMounted ? 1 : 0,
          transition: reduced ? 'none' : 'opacity 200ms ease',
        }}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* ── Centering wrapper — never transformed, purely layout ── */}
      <div
        className="fixed inset-0 z-[201] flex items-center justify-center"
        style={{ pointerEvents: 'none' }}
      >
      {/* ── Panel — FLIP transforms applied here only ── */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="attachment-preview-title"
        style={{
          pointerEvents: 'auto',
          width: 'min(1040px, 92vw)',
          height: 'min(760px, 86dvh)',
          background: 'var(--bg-app)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 20,
          boxShadow: '0 32px 80px rgba(0,0,0,.6)',
          display: 'grid',
          gridTemplateRows: 'auto 1fr',
          padding: '28px 28px 24px',
          opacity: reduced ? 1 : 0, // FLIP useEffect drives this
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          style={{
            opacity: contentVisible ? 1 : 0,
            transition: reduced ? 'none' : 'opacity 180ms ease',
            marginBottom: 16,
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <h2
              id="attachment-preview-title"
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: 'var(--text-primary)',
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                margin: 0,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {name}
            </h2>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Navigation counter (spec §7.6) */}
              {attachments.length > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIdx((i) => Math.max(0, i - 1))}
                    disabled={idx === 0}
                    aria-label="Previous attachment"
                    style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: 'transparent',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-muted)',
                      cursor: idx === 0 ? 'not-allowed' : 'pointer',
                      fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >‹</button>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', minWidth: 40, textAlign: 'center' }}>
                    {idx + 1} of {attachments.length}
                  </span>
                  <button
                    onClick={() => setIdx((i) => Math.min(attachments.length - 1, i + 1))}
                    disabled={idx === attachments.length - 1}
                    aria-label="Next attachment"
                    style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: 'transparent',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-muted)',
                      cursor: idx === attachments.length - 1 ? 'not-allowed' : 'pointer',
                      fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >›</button>
                </div>
              )}

              {/* Close × (spec §7.2) */}
              <button
                ref={closeBtnRef}
                onClick={handleClose}
                aria-label="Close preview"
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, color: 'var(--text-muted)',
                  transition: 'color 120ms',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Meta line (spec §7.2) */}
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            {metaLine}
            {caveat && <span> • {caveat}</span>}
          </div>
        </div>

        {/* ── Content panel ── */}
        <div
          tabIndex={0}
          aria-label="File contents"
          style={{
            background: 'var(--bg-raised)',
            borderRadius: 12,
            padding: '22px 24px',
            position: 'relative',
            overflow: 'auto',
            overscrollBehavior: 'contain',
            maskImage: 'linear-gradient(to bottom, #000 0, #000 calc(100% - 20px), transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, #000 0, #000 calc(100% - 20px), transparent 100%)',
            opacity: contentVisible ? 1 : 0,
            transition: reduced ? 'none' : 'opacity 180ms ease 40ms',
          }}
        >
          {previewState === 'pending' || (previewState === 'available' && ((isImage && !(thumbUrl || previewUrl)) || remoteTextLoading)) ? (
            <div
              className="absolute inset-0 flex items-center justify-center"
              role="status"
              aria-label="Loading preview"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.16)', color: 'var(--text-secondary)' }}
            >
              <IconLoader2 size={24} className="animate-spin" />
            </div>
          ) : null}
          {previewState === 'too-large' && (
            <UnavailableBlock
              icon={<IconAlertCircle size={28} />}
              line1="This file is too large to preview."
              line2="It will still be sent with your message in full."
              showDownload={!!attachment.doc?.raw}
              doc={attachment.doc}
            />
          )}
          {previewState === 'unsupported' && (
            <UnavailableBlock
              icon={<IconPaperclip size={28} />}
              line1="Preview isn't available for this file type."
              line2={attachment.ext ? `${attachment.ext} files are sent as-is.` : 'This file is sent as-is.'}
              showDownload={!!attachment.doc?.raw}
              doc={attachment.doc}
            />
          )}
          {previewState === 'pending' && (
            <UnavailableBlock
              icon={<IconClock size={28} />}
              line1="Preparing preview…"
              line2=""
              showDownload={false}
            />
          )}
          {previewState === 'failed' && (
            <UnavailableBlock
              icon={<IconAlertCircle size={28} />}
              line1="This file couldn't be read for preview."
              line2="It will still be sent with your message."
              showDownload={!!attachment.doc?.raw}
              doc={attachment.doc}
            />
          )}
          {previewState === 'available' && (
            <>
              {isImage && (thumbUrl || previewUrl) && (
                /* Image: letterboxed, object-fit:contain (spec §7.3) */
                <div
                  className="flex items-center justify-center w-full h-full"
                  style={{
                    minHeight: 200,
                    background: 'var(--bg-raised)',
                    borderRadius: 8,
                  }}
                >
                  <img
                    src={thumbUrl ?? previewUrl}
                    alt={name}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                </div>
              )}

              {isCSV && csvRows && (
                /* CSV table (spec §7.3) */
                <div>
                  {csvTruncated && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                      Showing first 500 of {attachment.lineCount?.toLocaleString()} rows
                    </div>
                  )}
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: 13,
                      fontFamily: 'monospace',
                    }}
                  >
                    <thead>
                      <tr>
                        <th
                          style={{
                            padding: '4px 10px',
                            background: 'var(--bg-sidebar)',
                            color: 'var(--text-muted)',
                            fontWeight: 400,
                            border: '1px solid var(--border-subtle)',
                            textAlign: 'right',
                            userSelect: 'none',
                          }}
                        >
                          #
                        </th>
                        {csvRows[0]?.map((cell, ci) => (
                          <th
                            key={ci}
                            style={{
                              padding: '4px 10px',
                              background: 'var(--bg-sidebar)',
                              color: 'var(--text-secondary)',
                              fontWeight: 600,
                              border: '1px solid var(--border-subtle)',
                              textAlign: 'left',
                            }}
                          >
                            {cell}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.slice(1).map((row, ri) => (
                        <tr key={ri}>
                          <td
                            style={{
                              padding: '3px 10px',
                              color: 'var(--text-muted)',
                              border: '1px solid var(--border-subtle)',
                              textAlign: 'right',
                              fontSize: 11,
                              userSelect: 'none',
                            }}
                          >
                            {ri + 1}
                          </td>
                          {row.map((cell, ci) => (
                            <td
                              key={ci}
                              style={{
                                padding: '3px 10px',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-subtle)',
                              }}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {remoteTextLoading && (
                <div role="status" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                  Loading preview…
                </div>
              )}

              {remoteTextFailed && (
                <UnavailableBlock
                  icon={<IconAlertCircle size={28} />}
                  line1="This file couldn't be read for preview."
                  line2="Try downloading the file instead."
                  showDownload={false}
                />
              )}

              {!isImage && !isCSV && !remoteTextLoading && !remoteTextFailed && previewText && (
                /* Raw text source (spec §7.3) */
                <pre
                  style={{
                    margin: 0,
                    fontFamily: "'Menlo','Monaco','Courier New',monospace",
                    fontSize: 13,
                    lineHeight: 1.7,
                    color: 'var(--text-primary)',
                    whiteSpace: 'pre-wrap',
                    tabSize: 2,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {previewText}
                </pre>
              )}
            </>
          )}
        </div>
      </div>
      </div>{/* end centering wrapper */}
    </>
  );
};

// ── Unavailable placeholder (spec §8) ─────────────────────────────────────────
interface UnavailableBlockProps {
  icon: React.ReactNode;
  line1: string;
  line2: string;
  showDownload: boolean;
  doc?: UIAttachment['doc'];
}

const UnavailableBlock: React.FC<UnavailableBlockProps> = ({
  icon, line1, line2, showDownload, doc,
}) => {
  const handleDownload = () => {
    if (!doc?.raw) return;
    const url = URL.createObjectURL(doc.raw);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="flex flex-col items-center justify-center h-full"
      style={{ gap: 12, maxWidth: '40ch', margin: '0 auto', paddingTop: 60 }}
    >
      <span style={{ fontSize: 28, color: 'var(--text-muted)' }}>{icon}</span>
      {line1 && (
        <span style={{ fontSize: 15, color: 'var(--text-primary)', textAlign: 'center' }}>
          {line1}
        </span>
      )}
      {line2 && (
        <span style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
          {line2}
        </span>
      )}
      {showDownload && (
        <button
          onClick={handleDownload}
          style={{
            marginTop: 8,
            height: 32,
            padding: '0 16px',
            borderRadius: 8,
            background: 'var(--bg-active)',
            border: 'none',
            color: 'var(--text-primary)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Download to view
        </button>
      )}
    </div>
  );
};

export default AttachmentPreview;
