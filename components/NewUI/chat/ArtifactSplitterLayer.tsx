/**
 * ArtifactSplitterLayer — draggable vertical divider between the chat column
 * and the artifact panel column.
 *
 * Layout model (post-rewrite):
 *   The CSS grid is `minmax(480px, 1fr)  var(--nui-panel-w, 50%)`.
 *   The RIGHT column (panel) has an explicit width; the LEFT column (chat)
 *   fills the remainder. This guarantees the panel is always anchored to the
 *   right edge and the chat column never collapses below its minimum.
 *
 * CSS variables written on the shell element:
 *   --nui-panel-w       right-column pixel width, e.g. "640px"
 *   --nui-artifact-panel-w   panel offsetWidth = panelW − 16 (8px margins each side)
 *                            used by .new-ui-header and .new-ui-composer-dock for
 *                            their `right` inset.
 *
 * Responsibilities:
 *   1. Listen for openArtifactsTrigger to show/hide.
 *   2. On open: read stored ratio from localStorage, compute pixel width, apply.
 *   3. Drag via Pointer Capture API (no global event listeners).
 *      Drag-right = narrower panel (less `--nui-panel-w`).
 *      Drag-left  = wider panel   (more `--nui-panel-w`).
 *   4. Clamp: panel ≥ MIN_PANEL_WIDTH, chat ≥ MIN_CHAT_WIDTH.
 *   5. ResizeObserver on the shell: re-clamp on window resize using stored ratio.
 *   6. Double-click: reset to 50/50, store ratio 0.5.
 *   7. Keyboard: Tab-focusable, Left/Right arrows ± KEYBOARD_STEP_PX.
 *   8. Set data-resizing="true" on shell during drag so CSS disables iframes.
 *   9. Hide in fullscreen mode.
 */

import React, {
  MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

// ── Constants ────────────────────────────────────────────────────────────────
/** Minimum width of the left (chat) column in pixels. */
const MIN_CHAT_WIDTH = 480;
/** Minimum width of the right (artifact panel) column in pixels. */
const MIN_PANEL_WIDTH = 400;
/** localStorage key for the persisted panel ratio (0.0–1.0). */
const STORAGE_KEY = 'nui-artifact-panel-ratio';
/** Default panel ratio when no stored value exists. */
const DEFAULT_RATIO = 0.5;
/** Arrow-key step size in pixels. */
const KEYBOARD_STEP_PX = 24;

interface Props {
  shellRef: MutableRefObject<HTMLDivElement | null>;
}

export const ArtifactSplitterLayer: React.FC<Props> = ({ shellRef }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Tracks the current ratio without causing re-renders on every frame.
  const panelRatioRef = useRef(DEFAULT_RATIO);

  // Drag start state
  const dragStartXRef = useRef(0);
  const dragStartPanelWRef = useRef(0);

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Clamp panelPx to [MIN_PANEL_WIDTH, totalWidth − MIN_CHAT_WIDTH], write
   * --nui-panel-w and --nui-artifact-panel-w onto the shell synchronously.
   *
   * --nui-artifact-panel-w = panelW − 16  (accounts for 8px left + right margins
   *   on #artifactsTab, so .new-ui-header right = panelW and composer right = panelW−16)
   */
  const applySplit = useCallback(
    (panelPx: number) => {
      const shell = shellRef.current;
      if (!shell) return;
      const totalWidth = shell.clientWidth;
      const clamped = Math.max(
        MIN_PANEL_WIDTH,
        Math.min(totalWidth - MIN_CHAT_WIDTH, panelPx),
      );
      panelRatioRef.current = clamped / totalWidth;
      shell.style.setProperty('--nui-panel-w', `${clamped}px`);
      shell.style.setProperty('--nui-artifact-panel-w', `${clamped - 16}px`);
    },
    [shellRef],
  );

  /** Returns the current panel width in pixels from the CSS variable. */
  const getCurrentPanelW = useCallback((): number => {
    const shell = shellRef.current;
    if (!shell) return 0;
    const raw = shell.style.getPropertyValue('--nui-panel-w');
    if (raw) return parseFloat(raw);
    return shell.clientWidth * panelRatioRef.current;
  }, [shellRef]);

  // ── Open / close ──────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.isOpen === false) setIsOpen(false);
      else if (detail?.isOpen === true) setIsOpen(true);
    };
    window.addEventListener('openArtifactsTrigger', handler);
    return () => window.removeEventListener('openArtifactsTrigger', handler);
  }, []);

  // On open: read stored ratio and apply
  useEffect(() => {
    if (!isOpen) {
      // Clean up on close
      const shell = shellRef.current;
      if (shell) {
        shell.style.removeProperty('--nui-panel-w');
        shell.style.removeProperty('--nui-artifact-panel-w');
      }
      return;
    }

    // Read stored ratio or default
    let ratio = DEFAULT_RATIO;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        const parsed = parseFloat(stored);
        if (isFinite(parsed) && parsed > 0 && parsed < 1) ratio = parsed;
      }
    } catch {
      /* localStorage unavailable */
    }
    panelRatioRef.current = ratio;

    // Apply after one RAF so the shell has its final clientWidth
    const raf = requestAnimationFrame(() => {
      const shell = shellRef.current;
      if (!shell) return;
      applySplit(ratio * shell.clientWidth);
    });
    return () => cancelAnimationFrame(raf);
  }, [isOpen, shellRef, applySplit]);

  // ── Fullscreen detection ──────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    const check = () => {
      const panel = document.getElementById('artifactsTab');
      setIsFullscreen(panel?.hasAttribute('data-artifact-fullscreen') ?? false);
    };
    check();
    const observer = new MutationObserver(check);
    const panel = document.getElementById('artifactsTab');
    if (panel) observer.observe(panel, { attributes: true, attributeFilter: ['data-artifact-fullscreen'] });
    return () => observer.disconnect();
  }, [isOpen]);

  // ── ResizeObserver: re-clamp on window / shell resize ────────────────────

  useEffect(() => {
    if (!isOpen) return;
    const shell = shellRef.current;
    if (!shell) return;

    const clamp = () => {
      applySplit(panelRatioRef.current * shell.clientWidth);
    };

    const ro = new ResizeObserver(clamp);
    ro.observe(shell);
    return () => ro.disconnect();
  }, [isOpen, shellRef, applySplit]);

  // ── Drag — Pointer Capture API ────────────────────────────────────────────

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);

      dragStartXRef.current = e.clientX;
      dragStartPanelWRef.current = getCurrentPanelW();

      setIsDragging(true);
      document.body.style.userSelect = 'none';

      // Signal CSS to disable iframes inside the artifact panel
      shellRef.current?.setAttribute('data-resizing', 'true');
    },
    [shellRef, getCurrentPanelW],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      const delta = e.clientX - dragStartXRef.current;
      // Drag right → chat gets wider → panel gets narrower (delta > 0 → smaller panelW)
      applySplit(dragStartPanelWRef.current - delta);
    },
    [isDragging, applySplit],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.releasePointerCapture(e.pointerId);
      setIsDragging(false);
      document.body.style.userSelect = '';
      shellRef.current?.removeAttribute('data-resizing');

      // Persist ratio on release
      try {
        localStorage.setItem(STORAGE_KEY, String(panelRatioRef.current));
      } catch {
        /* localStorage unavailable */
      }
    },
    [shellRef],
  );

  // ── Double-click: reset to 50/50 ─────────────────────────────────────────

  const handleDoubleClick = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;
    panelRatioRef.current = DEFAULT_RATIO;
    applySplit(shell.clientWidth * DEFAULT_RATIO);
    try {
      localStorage.setItem(STORAGE_KEY, String(DEFAULT_RATIO));
    } catch {
      /* localStorage unavailable */
    }
  }, [shellRef, applySplit]);

  // ── Keyboard navigation ───────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const current = getCurrentPanelW();
      // ArrowLeft  → move boundary left → panel gets wider
      // ArrowRight → move boundary right → panel gets narrower
      const next = e.key === 'ArrowLeft'
        ? current + KEYBOARD_STEP_PX
        : current - KEYBOARD_STEP_PX;
      applySplit(next);
      try {
        localStorage.setItem(STORAGE_KEY, String(panelRatioRef.current));
      } catch {
        /* localStorage unavailable */
      }
    },
    [getCurrentPanelW, applySplit],
  );

  // ── Derived aria values ───────────────────────────────────────────────────

  const shell = shellRef.current;
  const totalWidth = shell?.clientWidth ?? 0;
  const panelW = getCurrentPanelW();
  const chatW = totalWidth - panelW; // aria-valuenow = chat column width

  // ── Render ────────────────────────────────────────────────────────────────

  if (!isOpen || isFullscreen) return null;

  return (
    <div
      className="new-ui-artifact-splitter"
      data-dragging={isDragging ? 'true' : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize chat and artifact panels"
      aria-valuenow={Math.round(chatW)}
      aria-valuemin={MIN_CHAT_WIDTH}
      aria-valuemax={totalWidth - MIN_PANEL_WIDTH}
      tabIndex={0}
    >
      <div className="new-ui-artifact-splitter-line" />
    </div>
  );
};

export default ArtifactSplitterLayer;
