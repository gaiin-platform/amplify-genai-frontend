/**
 * AttachmentRail — horizontal scrolling row of AttachmentCards above the textarea.
 *
 * Lives in the composer's "rail" band (grid row 1 of 3).
 * Collapses to zero height when empty; expands to 176px when cards are present.
 * New cards animate in with opacity+scale+translateY; removed cards animate out.
 *
 * Key spec refs:
 *   §3   rail geometry (single row, horizontal scroll, scroll-snap)
 *   §4.2 entry animation timeline
 *   §5   removal animation + FLIP reflow
 *   §11  keyboard — roving tabindex, ⌫ removes focused card
 *   §13  reduced-motion — opacity only, instant height
 */
import React, { useEffect, useRef, useState } from 'react';
import { UIAttachment } from './attachmentTypes';
import { AttachmentCard } from './AttachmentCard';

interface AttachmentRailProps {
  attachments: UIAttachment[];
  onRemove: (id: string) => void;
  /** Opens the preview overlay for the given attachment, anchoring the FLIP from originRect. */
  onPreview: (id: string, originRect: DOMRect) => void;
  /** Called when the user clicks Retry on a failed card. Optional — omit to hide retry button. */
  onRetry?: (id: string) => void;
}

const RAIL_HEIGHT = 176; // px — fixed single-row height (spec §3)
const EASE_OUT = 'cubic-bezier(.2,.8,.2,1)';
const EASE_IN = 'cubic-bezier(.4,0,1,1)';

/** Check if the user has asked for reduced motion. */
function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export const AttachmentRail: React.FC<AttachmentRailProps> = ({
  attachments,
  onRemove,
  onPreview,
  onRetry,
}) => {
  const railRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Track which ids are entering (for entry animation) vs settled
  const [enteringIds, setEnteringIds] = useState<Set<string>>(new Set());
  // IDs scheduled for exit animation
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  // Previous attachment list for FLIP
  const prevCountRef = useRef(0);
  // Whether the rail is currently visible (has or had cards, allowing collapse animation)
  const [railOpen, setRailOpen] = useState(false);
  const reduced = prefersReducedMotion();

  // ── Entry animation ──────────────────────────────────────────────────────────
  useEffect(() => {
    const currentIds = new Set(attachments.map((a) => a.id));
    // New ids: those not in the previous render
    const prevIds = new Set(
      Array.from(enteringIds).filter((id) => currentIds.has(id)),
    );
    const newIds = attachments
      .filter((a) => !prevIds.has(a.id) && !exitingIds.has(a.id))
      .map((a, i) => ({ id: a.id, delay: Math.min(i, 4) * 40 })); // max 5 stagger (spec §4.2)

    if (newIds.length === 0) return;

    if (!reduced) {
      // Mark them entering
      setEnteringIds((prev) => {
        const next = new Set(prev);
        newIds.forEach(({ id }) => next.add(id));
        return next;
      });

      // After 60ms (spec §4.2 t=60ms) kick off actual card animations with stagger
      newIds.forEach(({ id, delay }) => {
        setTimeout(() => {
          setEnteringIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, 60 + delay);
      });

      // Scroll newest card into view at t=280ms (spec §4.2)
      setTimeout(() => {
        const list = listRef.current;
        if (!list) return;
        const last = list.lastElementChild as HTMLElement | null;
        if (!last) return;
        const railEl = railRef.current;
        if (!railEl) return;
        const lastRight = last.offsetLeft + last.offsetWidth;
        const visibleRight = railEl.scrollLeft + railEl.offsetWidth;
        if (lastRight > visibleRight) {
          railEl.scrollTo({ left: lastRight - railEl.offsetWidth + 16, behavior: 'smooth' });
        }
      }, 280);
    }

    prevCountRef.current = attachments.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments.length]);

  // ── Rail open/close ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (attachments.length > 0) {
      setRailOpen(true);
    } else {
      // Delay collapse by 60ms so departing card is gone first (spec §5)
      const t = setTimeout(() => setRailOpen(false), reduced ? 0 : 200 + 60);
      return () => clearTimeout(t);
    }
  }, [attachments.length, reduced]);

  // ── Roving tabindex keyboard navigation (spec §11) ───────────────────────────
  const [focusedIdx, setFocusedIdx] = useState(0);
  const handleRailKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setFocusedIdx((i) => Math.min(i + 1, attachments.length - 1));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setFocusedIdx((i) => Math.max(i - 1, 0));
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && attachments[focusedIdx]) {
      e.preventDefault();
      const toRemove = attachments[focusedIdx];
      const nextIdx = Math.max(0, focusedIdx - 1);
      setFocusedIdx(nextIdx);
      onRemove(toRemove.id);
    } else if (e.key === 'Escape') {
      // Return focus to the textarea (spec §11)
      const composer = document.querySelector(
        '[data-composer-textarea], #messageChatInputText',
      ) as HTMLElement | null;
      composer?.focus();
    }
  };

  if (!railOpen && attachments.length === 0) return null;

  return (
    <div
      ref={railRef}
      className="overflow-x-auto overflow-y-hidden"
      style={{
        height: railOpen ? RAIL_HEIGHT : 0,
        transition: reduced
          ? 'none'
          : `height 220ms ${railOpen ? EASE_OUT : EASE_OUT}`,
        paddingBottom: railOpen ? 6 : 0,
        // Fade right edge when scrollable (spec §3)
        maskImage:
          'linear-gradient(to right, #000 0, #000 calc(100% - 32px), transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(to right, #000 0, #000 calc(100% - 32px), transparent 100%)',
        scrollbarWidth: 'thin',
        scrollSnapType: 'x proximity',
      }}
    >
      <ul
        ref={listRef}
        role="list"
        aria-label={`${attachments.length} attachment${attachments.length !== 1 ? 's' : ''}`}
        className="flex gap-[16px] items-start"
        style={{ width: 'max-content', padding: '10px 2px 6px' }}
        onKeyDown={handleRailKeyDown}
      >
        {attachments.map((a, idx) => (
          <AttachmentCard
            key={a.id}
            attachment={a}
            onRemove={onRemove}
            onPreview={onPreview}
            onRetry={onRetry}
            enterState={enteringIds.has(a.id) ? 'entering' : 'entered'}
          />
        ))}
      </ul>
    </div>
  );
};

export default AttachmentRail;
