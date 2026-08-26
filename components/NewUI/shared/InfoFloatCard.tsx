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
 * The card is pointer-interactive so the user can move into it and scroll.
 * Show/hide still remains driven by the row and card hover intent; the card
 * does not contain actionable controls.
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
  /** Cancel a pending hide while the pointer travels into the card. */
  cancelHide: () => void;
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

  const cancelHide = useCallback(() => {
    clearTimer();
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
    cancelHide,
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
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  /** Above submenu panels (10000). */
  zIndex?: number;
}> = ({ anchor, children, maxWidth = 240, onMouseEnter, onMouseLeave, zIndex = 10001 }) => (
  <FloatingPortal>
    <div
      ref={anchor.setFloating}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role="tooltip"
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
        // Bound both dimensions to the viewport so long previews never run
        // off-screen. Overflow is intentionally visible as a scrollbar when
        // metadata exceeds the available height.
        maxWidth: 'min(' + maxWidth + 'px, calc(100vw - 24px))',
        maxHeight: 'calc(100dvh - 24px)',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        scrollbarWidth: 'thin',
        background: 'var(--bg-raised)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 10,
        padding: 14,
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        pointerEvents: 'auto',
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

/** Name / heading — 15px bold, primary. */
export const InfoCardTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontSize: 15,
      fontWeight: 600,
      lineHeight: 1.3,
      color: 'var(--text-primary)',
      wordBreak: 'break-word',
      overflowWrap: 'anywhere',
    }}
  >
    {children}
  </div>
);

const COLLAPSE_AT_CHARS = 400;

const InfoCardExpandableText: React.FC<{
  children: string;
  fontSize: number;
  lineHeight: number;
  color: string;
  fontStyle?: 'normal' | 'italic';
}> = ({ children, fontSize, lineHeight, color, fontStyle = 'normal' }) => {
  const [expanded, setExpanded] = useState(false);
  const isLong = children.length > COLLAPSE_AT_CHARS;
  const visibleText = !isLong || expanded
    ? children
    : children.slice(0, COLLAPSE_AT_CHARS).trimEnd() + '...';

  return (
    <div
      style={{
        fontSize,
        fontStyle,
        lineHeight,
        color,
        wordBreak: 'break-word',
        overflowWrap: 'anywhere',
      }}
    >
      <span>{visibleText}</span>
      {isLong && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          style={{
            marginLeft: 4,
            padding: 0,
            border: 0,
            background: 'transparent',
            color: 'var(--text-link, var(--accent))',
            font: 'inherit',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
};

/** Body copy — 13px secondary, collapsed after 400 characters. */
export const InfoCardText: React.FC<{ children: string }> = ({ children }) => (
  <InfoCardExpandableText
    fontSize={13}
    lineHeight={1.45}
    color="var(--text-secondary)"
  >
    {children}
  </InfoCardExpandableText>
);

/** Italic preview (e.g. "Instructions: …"), collapsed after 400 characters. */
export const InfoCardItalic: React.FC<{ children: string }> = ({ children }) => (
  <InfoCardExpandableText
    fontSize={12}
    lineHeight={1.4}
    color="var(--text-muted)"
    fontStyle="italic"
  >
    {children}
  </InfoCardExpandableText>
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
      whiteSpace: 'normal',
      maxWidth: '100%',
      overflowWrap: 'anywhere',
    }}
  >
    {children}
  </span>
);

export default InfoFloatCard;
