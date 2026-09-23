/**
 * ArtifactSplitterLayer — renders a draggable vertical divider between the
 * chat column and the artifact panel column.
 *
 * Responsibilities:
 *  1. Listens for `openArtifactsTrigger` events (same as ArtifactPanelLayer)
 *     to know when the artifact panel is visible.
 *  2. When open, renders a thin vertical line at the grid column boundary.
 *     - Position: left: var(--nui-split-left, 50%) so it follows the CSS var.
 *     - Default 50/50 split uses the CSS fallback (no var set → centered).
 *  3. On mousedown: enters drag mode and tracks mouse movement via document
 *     event listeners so the drag continues even if the cursor leaves the
 *     handle.
 *  4. On mousemove during drag: clamps the x position to
 *     [MIN_COL_WIDTH, shellWidth - MIN_COL_WIDTH] and writes
 *     --nui-split-left on the ConversationViewShell element.
 *     conversation-view.css rule 16 picks this up and sets
 *     grid-template-columns: <x>px 1fr.
 *  5. On mouseup / Escape during drag: ends drag.
 *  6. When the artifact panel closes, clears --nui-split-left so the grid
 *     resets to its default 1fr 1fr (50/50) on the next open.
 *  7. Double-click on the handle resets to 50/50.
 *  8. ResizeObserver on the shell clamps the split when the window is resized
 *     so the right column never collapses below MIN_COL_WIDTH.
 */

import React, {
  MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

/** Minimum width (px) for either column. */
const MIN_COL_WIDTH = 300;

interface Props {
  shellRef: MutableRefObject<HTMLDivElement | null>;
}

export const ArtifactSplitterLayer: React.FC<Props> = ({ shellRef }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // ── Listen for openArtifactsTrigger ─────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.isOpen === false) {
        setIsOpen(false);
      } else if (detail?.isOpen === true) {
        setIsOpen(true);
      }
    };
    window.addEventListener('openArtifactsTrigger', handler);
    return () => window.removeEventListener('openArtifactsTrigger', handler);
  }, []);

  // ── Hide when artifact panel is fullscreen ───────────────────────────────
  // #artifactsTab[data-artifact-fullscreen="true"] takes up the whole shell;
  // the splitter would float over it. Use a MutationObserver to detect the
  // attribute change rather than duplicating fullscreen state.
  const [isFullscreen, setIsFullscreen] = useState(false);
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

  // ── Clear --nui-split-left when panel closes ─────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      shellRef.current?.style.removeProperty('--nui-split-left');
    }
  }, [isOpen, shellRef]);

  // ── Helper: apply a clamped split ───────────────────────────────────────
  //
  // Sets BOTH --nui-split-left AND --nui-artifact-panel-w in one synchronous
  // DOM write so the header (.new-ui-header) and composer (.new-ui-composer-dock)
  // follow the drag in real time without waiting for ArtifactPanelLayer's
  // ResizeObserver (which fires asynchronously, one frame behind).
  //
  // Math:
  //   right-column width  = totalWidth - clampedX
  //   #artifactsTab.offsetWidth = right-column width - 8px(left) - 8px(right)
  //                             = totalWidth - clampedX - 16
  //   → --nui-artifact-panel-w = totalWidth - clampedX - 16
  //
  // The header CSS adds +16px back:  right = (totalWidth-x-16)+16 = totalWidth-x
  //   → header's right visual edge from left = shellWidth-(totalWidth-x) = x  ✓
  // The composer CSS uses the raw value:  right = totalWidth-x-16
  //   → composer's right visual edge from left = x+16 (spans the 8px margin gap) ✓
  const applySplit = useCallback(
    (rawX: number) => {
      const shell = shellRef.current;
      if (!shell) return;
      const totalWidth = shell.clientWidth;
      const clamped = Math.max(
        MIN_COL_WIDTH,
        Math.min(totalWidth - MIN_COL_WIDTH, rawX),
      );
      shell.style.setProperty('--nui-split-left', `${clamped}px`);
      // Keep header/composer in sync synchronously — don't wait for ResizeObserver.
      shell.style.setProperty('--nui-artifact-panel-w', `${totalWidth - clamped - 16}px`);
    },
    [shellRef],
  );

  // ── ResizeObserver: clamp split when shell width changes ─────────────────
  useEffect(() => {
    if (!isOpen) return;
    const shell = shellRef.current;
    if (!shell) return;

    const clamp = () => {
      const current = shell.style.getPropertyValue('--nui-split-left');
      if (!current) return; // still at default 50/50 — nothing to clamp
      const px = parseFloat(current);
      if (!isNaN(px)) applySplit(px);
    };

    const ro = new ResizeObserver(clamp);
    ro.observe(shell);
    return () => ro.disconnect();
  }, [isOpen, shellRef, applySplit]);

  // ── Drag handling ────────────────────────────────────────────────────────
  const dragStartClientXRef = useRef(0);
  const dragStartSplitXRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();

      const shell = shellRef.current;
      if (!shell) return;

      // Capture current split position (in px) to use as the drag baseline.
      // If no var is set yet, read the computed 50% as an absolute pixel value.
      const currentVar = shell.style.getPropertyValue('--nui-split-left');
      const baseline = currentVar
        ? parseFloat(currentVar)
        : shell.clientWidth / 2;

      dragStartClientXRef.current = e.clientX;
      dragStartSplitXRef.current = baseline;

      setIsDragging(true);

      // Lock cursor globally so it doesn't revert when the mouse leaves the handle
      const prevCursor = document.body.style.cursor;
      document.body.style.cursor = 'ew-resize';
      // Prevent text selection while dragging
      document.body.style.userSelect = 'none';

      const onMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - dragStartClientXRef.current;
        applySplit(dragStartSplitXRef.current + delta);
      };

      const onMouseUp = () => {
        setIsDragging(false);
        document.body.style.cursor = prevCursor;
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [shellRef, applySplit],
  );

  // ── Double-click: reset to 50/50 ─────────────────────────────────────────
  // Also reset --nui-artifact-panel-w immediately to the default 50/50 value
  // so the header/composer snap back synchronously.  ArtifactPanelLayer's
  // ResizeObserver will also fire after layout and set the same value.
  const handleDoubleClick = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;
    shell.style.removeProperty('--nui-split-left');
    // Default 50/50: right column = totalWidth/2, panel = totalWidth/2 - 16px margins
    const defaultPanelW = Math.max(0, shell.clientWidth / 2 - 16);
    shell.style.setProperty('--nui-artifact-panel-w', `${defaultPanelW}px`);
    // ArtifactPanelLayer's ResizeObserver will re-measure and confirm the value
    // after the CSS grid reflows to 1fr 1fr.
  }, [shellRef]);

  // ── Escape during drag: abort ────────────────────────────────────────────
  useEffect(() => {
    if (!isDragging) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsDragging(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isDragging]);

  if (!isOpen || isFullscreen) return null;

  return (
    <div
      className="new-ui-artifact-splitter"
      data-dragging={isDragging ? 'true' : undefined}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      aria-label="Drag to resize panels"
      role="separator"
      aria-orientation="vertical"
    >
      <div className="new-ui-artifact-splitter-line" />
    </div>
  );
};

export default ArtifactSplitterLayer;
