/**
 * NewUILoadingStatus — quiet, accessible loading treatment for the New UI.
 *
 * Replaces the old LoadingDialog "Setting Up Amplify…" for the New UI only, and
 * is reused for in-view async work (e.g. Library file deletion).
 *
 * Overlay mode presents a translucent scrim and centered card. Inline mode
 * presents a compact status treatment for page-local settings loads.
 *
 * Design rules (NEW_UI_GUIDE.md):
 *   • Uses design tokens exclusively — no hardcoded brand colors.
 *   • Supports light and dark themes (tokens handle both).
 *   • Respects prefers-reduced-motion: spinner and fade-in are suppressed.
 *   • role="status" + aria-live="polite" announces status to screen readers.
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface NewUILoadingStatusProps {
  /** Whether the loading indicator is visible */
  open: boolean;
  /** Status message shown beside the indicator. Defaults to "Loading…" */
  message?: string;
  /** Optional class for specialized inline positioning. */
  inlineClassName?: string;
  /** Render a compact inline status instead of a viewport-blocking overlay. */
  variant?: 'overlay' | 'inline';
}

export interface NewUILegacyLoadingAdapterProps {
  /** A page-scoped New UI wrapper around a legacy component. */
  wrapperRef: React.RefObject<HTMLElement>;
  /** Wrapper-scoped selector targeting the initial loader's container. */
  selector: string;
  /** Text unique to that initial state; action loaders are intentionally excluded. */
  matchText: string;
  /** Contextual status message for the replacement indicator. */
  message: string;
  /** Optional named visual treatment for a legacy loading state. */
  inlineClassName?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const NewUILoadingStatus: React.FC<NewUILoadingStatusProps> = ({
  open,
  message = 'Loading…',
  variant = 'overlay',
  inlineClassName,
}) => {
  // Portal overlays must wait until after hydration; inline markup is SSR-safe.
  const [portalReady, setPortalReady] = useState(false);
  useEffect(() => setPortalReady(true), []);

  if (variant === 'inline') {
    return open ? <InlineLoadingIndicator message={message} className={inlineClassName} /> : null;
  }

  if (!open || !portalReady || typeof document === 'undefined') return null;

  // Always portal to document.body so position:fixed is anchored to the
  // real viewport — not to a transformed/filtered ancestor in the component
  // tree (CSS transforms, backdrop-filter, will-change on any ancestor all
  // create a new containing block that traps fixed-positioned descendants).
  return createPortal(
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
    </div>,
    document.body,
  );
};

export const InlineLoadingIndicator: React.FC<{ message: string; className?: string }> = ({
  message,
  className = '',
}) => (
  <div
    className={`nui-inline-loading ${className}`.trim()}
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <span className="nui-inline-loading-ring" aria-hidden="true" />
    <span>{message}</span>
    <style>{`
      @keyframes nuiSpinnerRotate {
        to { transform: rotate(360deg); }
      }
      .nui-inline-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        min-height: 96px;
        padding: 24px;
        color: var(--text-secondary);
        font-size: 14px;
      }
      .nui-inline-loading-slot {
        display: contents;
      }
      .nui-inline-loading-slot .nui-inline-loading {
        position: absolute;
        inset: 0;
        z-index: 1;
        height: 100%;
        box-sizing: border-box;
        pointer-events: none;
      }
      .nui-inline-loading-api-keys {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        min-height: 96px;
        padding: 24px;
        justify-content: center;
        background: transparent;
        transform: translateY(var(--nui-api-key-loader-offset, 0px));
      }
      .nui-inline-loading-ring {
        width: 20px;
        height: 20px;
        flex: 0 0 20px;
        box-sizing: border-box;
        border: 2px solid var(--border-subtle);
        border-top-color: var(--accent);
        border-radius: 50%;
        animation: nuiSpinnerRotate 0.75s linear infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .nui-inline-loading-ring {
          animation: none;
          border: none;
          display: grid;
          place-items: center;
        }
        .nui-inline-loading-ring::after {
          content: '';
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--accent);
        }
      }
    `}</style>
  </div>
);

/**
 * Detect one recognized legacy initial-loading row and display the shared loader
 * declaratively in the wrapper's React tree. Only the specific legacy row is
 * marked for scoped CSS hiding, never action-level indicators.
 */
export const NewUILegacyLoadingAdapter: React.FC<NewUILegacyLoadingAdapterProps> = ({
  wrapperRef,
  selector,
  matchText,
  message,
  inlineClassName,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const matchedNodeRef = useRef<HTMLElement | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const reconcile = () => {
      const candidates = wrapper.querySelectorAll<HTMLElement>(selector);
      const nextNode = Array.from(candidates).find((node) => node.textContent?.includes(matchText)) ?? null;
      const currentNode = matchedNodeRef.current;
      if (nextNode && inlineClassName === 'nui-inline-loading-api-keys') {
        const contentRect = nextNode.getBoundingClientRect();
        const wrapperRect = wrapper.getBoundingClientRect();
        if (contentRect.height > 0) {
          const centerOffset = contentRect.top + contentRect.height / 2 - 48 - wrapperRect.top;
          wrapper.style.setProperty('--nui-api-key-loader-offset', `${centerOffset}px`);
        }
      }
      if (currentNode && currentNode !== nextNode) {
        currentNode.removeAttribute('data-new-ui-loading-replaced');
        matchedNodeRef.current = null;
      }
      if (nextNode && nextNode !== matchedNodeRef.current) {
        nextNode.setAttribute('data-new-ui-loading-replaced', 'true');
        matchedNodeRef.current = nextNode;
      }
      setIsLoading(!!nextNode);
    };

    reconcile();
    const observer = new MutationObserver(reconcile);
    observer.observe(wrapper, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      matchedNodeRef.current?.removeAttribute('data-new-ui-loading-replaced');
      matchedNodeRef.current = null;
    };
    // The wrapper/selector identify a single initial loader for the mounted section.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inlineClassName, matchText, selector, wrapperRef]);

  return isLoading ? (
    <div ref={statusRef} className="nui-inline-loading-slot">
      <NewUILoadingStatus
        open
        message={message}
        variant="inline"
        inlineClassName={inlineClassName}
      />
    </div>
  ) : null;
};

export default NewUILoadingStatus;
