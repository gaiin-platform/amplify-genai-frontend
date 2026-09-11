/**
 * UploadPendingIndicator — ambient progress display while deferred-send images upload.
 *
 * Shown inside the ConversationComposer card when the user has clicked Send
 * but one or more image uploads are still in flight. The send will fire
 * automatically once all uploads complete.
 *
 * Design spec (Task 14 §3):
 *   - Unobtrusive: thin 3px progress bar at the top of the card, muted label text
 *   - Determinate bar fills as images complete
 *   - Cancel button abandons the pending send (restores message text, keeps uploads)
 *   - No blocking spinner or alarming visual weight
 *   - prefers-reduced-motion: bar still fills, but no pulse animation
 */
import React from 'react';

interface UploadPendingIndicatorProps {
  /** Number of images that have finished uploading since Send was clicked. */
  done: number;
  /** Total number of images that were uploading when Send was clicked. */
  total: number;
  /** Abandon the pending deferred send (message text will be restored). */
  onCancel: () => void;
}

export const UploadPendingIndicator: React.FC<UploadPendingIndicatorProps> = ({
  done,
  total,
  onCancel,
}) => {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const labelText =
    total === 1
      ? done === 0
        ? 'Uploading image…'
        : 'Upload complete, sending…'
      : done < total
      ? `Uploading image ${done + 1} of ${total}…`
      : 'Uploads complete, sending…';

  return (
    <div
      className="new-ui-upload-pending-indicator"
      aria-label={labelText}
      aria-live="polite"
    >
      {/* Thin progress bar at the top of the card */}
      <div
        className="new-ui-upload-bar-track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="new-ui-upload-bar-fill"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Label + cancel row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '7px 0 4px',
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            fontFamily: 'Inter, sans-serif',
            lineHeight: 1,
          }}
        >
          {labelText}
        </span>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel pending send and restore message"
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            background: 'none',
            border: 'none',
            padding: '1px 4px',
            cursor: 'pointer',
            borderRadius: 4,
            fontFamily: 'Inter, sans-serif',
            lineHeight: 1,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
            (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
            (e.currentTarget as HTMLElement).style.background = 'none';
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default UploadPendingIndicator;
