/**
 * NewUILoadingStatus — quiet, accessible loading treatment for the New UI.
 *
 * Replaces the old LoadingDialog "Setting Up Amplify…" for the New UI only, and
 * is reused for in-view async work (e.g. Library file deletion).
 *
 * Visual model: a translucent scrim over the app plus a small centered card.
 * The scrim intentionally does NOT hide the UI behind it — the user keeps their
 * context (which page/list they were on) while the work is in flight. The scrim
 * still captures pointer events so the blocked action can't be double-fired.
 *
 * Design rules (NEW_UI_GUIDE.md):
 *   • Uses design tokens exclusively — no hardcoded brand colors.
 *   • Supports light and dark themes (tokens handle both).
 *   • Respects prefers-reduced-motion: spinner and fade-in are suppressed.
 *   • role="status" + aria-live="polite" announces status to screen readers.
 */

import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface NewUILoadingStatusProps {
  /** Whether the loading overlay is visible */
  open: boolean;
  /** Status message shown beside the indicator. Defaults to "Loading…" */
  message?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const NewUILoadingStatus: React.FC<NewUILoadingStatusProps> = ({
  open,
  message = 'Loading…',
}) => {
  if (!open) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message}
      className="nui-loading-scrim"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Light scrim: dims the app enough to focus attention on the card
        // without hiding what the user was looking at.
        background: 'rgba(0, 0, 0, 0.28)',
        backdropFilter: 'blur(1.5px)',
        WebkitBackdropFilter: 'blur(1.5px)',
      }}
    >
      {/* Centered card */}
      <div
        className="nui-loading-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 22px',
          background: 'var(--bg-raised)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-panel, 12px)',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.32)',
          maxWidth: 'min(420px, calc(100vw - 32px))',
        }}
      >
        {/* Spinner — becomes a static dot when prefers-reduced-motion is set */}
        <div className="nui-loading-ring" aria-hidden="true" style={{ flexShrink: 0 }} />

        {/* Status text */}
        <p
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--text-primary)',
            letterSpacing: '0.01em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {message}
        </p>
      </div>

      <style>{`
        @keyframes nuiSpinnerRotate {
          to { transform: rotate(360deg); }
        }

        @keyframes nuiLoadingFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        @keyframes nuiLoadingCardIn {
          from { opacity: 0; transform: translateY(4px) scale(0.98); }
          to   { opacity: 1; transform: none; }
        }

        .nui-loading-scrim {
          animation: nuiLoadingFadeIn 140ms ease-out both;
        }

        .nui-loading-card {
          animation: nuiLoadingCardIn 160ms ease-out both;
        }

        .nui-loading-ring {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 2.5px solid var(--border-subtle);
          border-top-color: var(--accent);
          animation: nuiSpinnerRotate 0.75s linear infinite;
        }

        /* Reduced-motion: no fades, and a static dot instead of a spinning ring */
        @media (prefers-reduced-motion: reduce) {
          .nui-loading-scrim,
          .nui-loading-card {
            animation: none;
          }
          .nui-loading-ring {
            animation: none;
            border: none;
            display: flex;
          }
          .nui-loading-ring::after {
            content: '';
            display: block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--accent);
            margin: auto;
          }
        }
      `}</style>
    </div>
  );
};

export default NewUILoadingStatus;
