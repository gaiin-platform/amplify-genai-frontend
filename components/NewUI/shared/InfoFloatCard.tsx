/**
 * InfoFloatCard — shared hover-preview card shell + hover-intent positioning hook.
 *
 * Used by:
 *   • AttachMenu.tsx   → "Add assistant ›" submenu rows (assistant details)
 *   • ModelPicker.tsx  → "More models ›" submenu rows (model details)
 *
 * SCOPE: this is deliberately NOT a general-purpose tooltip system. It exists to
 * preview a *row in a menu* and nothing else. Keep it that way — if a third
 * use-case appears, re-evaluate rather than growing this file's API.
 *
 * Positioning: shares the submenu stack from ./menuPositioning, so the card
 * lands to the right of the hovered row (≈ the right edge of the submenu panel),
 * slides vertically to stay on screen, and only flips to the LEFT when the
 * viewport genuinely has no horizontal room. (Sharing matters: with flip's
 * default `crossAxis: true` a card near the bottom edge would flip left even
 * with plenty of room on the right — see the note in ./menuPositioning.)
 *
 * Strategy is `fixed` + `FloatingPortal`: submenu panels clip their contents
 * (`overflow: hidden` / `overflowY: auto`), so the card must escape them.
 *
 * The card is `pointer-events: none`. That is intentional:
 *   1. it can never swallow a click meant for the row underneath it, and
 *   2. it can never register as an "outside press" for the menu's `useDismiss`,
 *      which would otherwise tear the whole menu down.
 * Show/hide is therefore driven purely by the row's mouse enter/leave.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { autoUpdate, FloatingPortal, useFloating } from '@floating-ui/react';
import { SUBMENU_PLACEMENT, submenuMiddleware } from './menuPositioning';

/** Hover intent — show after a beat, hide with a short grace period. */
const SHOW_DELAY_MS = 250;
const HIDE_DELAY_MS = 200;

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export interface InfoCardAnchor {
  setFloating: (node: HTMLElement | null) => void;
  x: number | null;
  y: number | null;
  strategy: 'absolute' | 'fixed';
}

export interface InfoCardHover<T> {
  /** The item currently being previewed, or null when the card is hidden. */
  item: T | null;
  /** Spread onto `<InfoFloatCard anchor={...} />`. */
  anchor: InfoCardAnchor;
  /** Call from a row's `onMouseEnter` — `el` is usually `e.currentTarget`. */
  show: (item: T, el: HTMLElement | null) => void;
  /** Call from a row's `onMouseLeave` — hides after the grace period. */
  hide: () => void;
  /** Hide immediately (row clicked, list filtered, submenu closing). */
  hideNow: () => void;
}

export function useInfoCardHover<T>(opts?: {
  /** Gap between the hovered row's edge and the card. */
  offsetPx?: number;
}): InfoCardHover<T> {
  const [item, setItem] = useState<T | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Mirror of `item !== null` readable from stable callbacks. */
  const isOpenRef = useRef(false);
  isOpenRef.current = item !== null;

  const { refs, x, y, strategy } = useFloating({
    open: item !== null,
    placement: SUBMENU_PLACEMENT,
    // 'fixed' (unlike the submenu panels' 'absolute') because the card must
    // escape the panels' overflow — see the header note.
    strategy: 'fixed',
    middleware: submenuMiddleware(opts?.offsetPx ?? 12),
    whileElementsMounted: autoUpdate,
  } as any);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const show = useCallback(
    (next: T, el: HTMLElement | null) => {
      clearTimer();
      if (!el) return;
      const apply = () => {
        refs.setReference(el);
        setItem(next);
      };
      // Already showing a card → swap contents instantly (no second wait).
      if (isOpenRef.current) apply();
      else timerRef.current = setTimeout(apply, SHOW_DELAY_MS);
    },
    [clearTimer, refs],
  );

  const hide = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => setItem(null), HIDE_DELAY_MS);
  }, [clearTimer]);

  const hideNow = useCallback(() => {
    clearTimer();
    setItem(null);
  }, [clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  return {
    item,
    anchor: { setFloating: refs.setFloating, x, y, strategy },
    show,
    hide,
    hideNow,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Card shell
// ─────────────────────────────────────────────────────────────────────────────

export const InfoFloatCard: React.FC<{
  anchor: InfoCardAnchor;
  children: React.ReactNode;
  maxWidth?: number;
  /** Above submenu panels (10000). */
  zIndex?: number;
}> = ({ anchor, children, maxWidth = 240, zIndex = 10001 }) => (
  <FloatingPortal>
    <div
      ref={anchor.setFloating}
      role="tooltip"
      aria-hidden="true"
      // Animation lives in the <style> block below, not inline, so the
      // prefers-reduced-motion media query can actually override it.
      className="new-ui-info-float-card"
      style={{
        position: anchor.strategy,
        top: anchor.y ?? 0,
        left: anchor.x ?? 0,
        // Hidden until the first computePosition resolves — FloatingPortal mounts
        // its node in a layout effect, so x/y can be null for one render and the
        // card would otherwise flash at the top-left corner of the screen.
        visibility: anchor.x == null ? 'hidden' : 'visible',
        zIndex,
        width: 'max-content',
        maxWidth,
        background: 'var(--bg-raised)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 10,
        padding: 14,
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
      }}
    >
      {children}
      <style>{`
        .new-ui-info-float-card {
          animation: infoFloatCardEnter 120ms ease forwards;
        }
        @keyframes infoFloatCardEnter {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .new-ui-info-float-card { animation: none; }
        }
      `}</style>
    </div>
  </FloatingPortal>
);

// ─────────────────────────────────────────────────────────────────────────────
// Content primitives — shared so both cards read as one design
// ─────────────────────────────────────────────────────────────────────────────

/** Clamp helper (no Tailwind line-clamp plugin assumptions). */
const clamp = (lines: number): React.CSSProperties => ({
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: lines,
  overflow: 'hidden',
});

/** Name / heading — 15px bold, primary. */
export const InfoCardTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontSize: 15,
      fontWeight: 600,
      lineHeight: 1.3,
      color: 'var(--text-primary)',
      ...clamp(2),
      wordBreak: 'break-word',
    }}
  >
    {children}
  </div>
);

/** Body copy — 13px secondary, line-clamped. */
export const InfoCardText: React.FC<{ lines?: number; children: React.ReactNode }> = ({
  lines = 2,
  children,
}) => (
  <div
    style={{
      fontSize: 13,
      lineHeight: 1.45,
      color: 'var(--text-secondary)',
      ...clamp(lines),
      wordBreak: 'break-word',
    }}
  >
    {children}
  </div>
);

/** Italic single-line preview (e.g. "Instructions: …"). */
export const InfoCardItalic: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontSize: 12,
      fontStyle: 'italic',
      lineHeight: 1.4,
      color: 'var(--text-muted)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </div>
);

/** Small meta line — 12px muted. */
export const InfoCardMeta: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--text-muted)' }}>{children}</div>
);

/** Horizontal wrapping pill row. */
export const InfoCardPills: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{children}</div>
);

/** Pill — `--bg-active` background, `--text-secondary` text. */
export const InfoCardPill: React.FC<{ children: React.ReactNode; muted?: boolean }> = ({
  children,
  muted,
}) => (
  <span
    style={{
      fontSize: 11,
      fontWeight: 500,
      lineHeight: 1.6,
      padding: '1px 7px',
      borderRadius: 999,
      background: 'var(--bg-active)',
      color: muted ? 'var(--text-muted)' : 'var(--text-secondary)',
      whiteSpace: 'nowrap',
      maxWidth: 120,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }}
  >
    {children}
  </span>
);

export default InfoFloatCard;
