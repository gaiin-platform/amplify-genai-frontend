/**
 * NewUILoadingStatus — quiet, accessible loading treatment for the New UI.
 *
 * Replaces the old LoadingDialog "Setting Up Amplify…" for the New UI only.
 *
 * Design rules (NEW_UI_GUIDE.md):
 *   • Uses design tokens exclusively — no hardcoded hex values.
 *   • Supports light and dark themes (tokens handle both).
 *   • Respects prefers-reduced-motion: spinner is suppressed, a static icon shown.
 *   • role="status" + aria-live="polite" announces status to screen readers.
 *   • Matches the quiet, intentional visual language of the rest of the New UI.
 */

import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface NewUILoadingStatusProps {
  /** Whether the loading overlay is visible */
  open: boolean;
  /** Status message shown beneath the indicator. Defaults to "Loading…" */
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
      aria-label={message}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-app)',
        gap: 16,
      }}
    >
      {/* Spinner — hidden when prefers-reduced-motion is set */}
      <SpinnerOrDot />

      {/* Status text */}
      <p
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--text-secondary)',
          letterSpacing: '0.01em',
        }}
      >
        {message}
      </p>

      <style>{`
        /* Animated ring */
        @keyframes nuiSpinnerRotate {
          to { transform: rotate(360deg); }
        }

        .nui-loading-ring {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 2.5px solid var(--border-subtle);
          border-top-color: var(--accent);
          animation: nuiSpinnerRotate 0.75s linear infinite;
        }

        /* Reduced-motion: swap animated ring for a static dot */
        @media (prefers-reduced-motion: reduce) {
          .nui-loading-ring {
            animation: none;
            border: none;
          }
          .nui-loading-ring::after {
            content: '';
            display: block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--accent);
            margin: auto;
            margin-top: 12px;
          }
        }
      `}</style>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Inner: spinner / reduced-motion dot
// ─────────────────────────────────────────────────────────────────────────────

const SpinnerOrDot: React.FC = () => (
  <div
    className="nui-loading-ring"
    aria-hidden="true"
    style={{ flexShrink: 0 }}
  />
);

export default NewUILoadingStatus;
