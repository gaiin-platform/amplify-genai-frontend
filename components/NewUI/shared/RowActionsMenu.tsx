/**
 * RowActionsMenu — a "⋯" button that opens a row's actions in a small menu.
 *
 * List rows reveal their action buttons on hover, which touch devices can't do, and
 * the reserved width squeezes the row's name on a phone. Rows hide that cluster there
 * (`max-md:hidden touch:hidden`) and render this instead; it shows only in that same
 * condition, so desktop is unchanged.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { IconDots, IconLoader2 } from '@tabler/icons-react';

export interface RowMenuItem {
  label: string;
  icon: React.ReactNode;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  danger?: boolean;
  disabled?: boolean;
}

interface RowActionsMenuProps {
  'aria-label': string;
  items: RowMenuItem[];
  /** An action is running: the menu has closed, so the button shows the progress. */
  busy?: boolean;
}

const VIEWPORT_MARGIN = 8;
const MENU_WIDTH = 220;

export const RowActionsMenu: React.FC<RowActionsMenuProps> = ({ 'aria-label': ariaLabel, items, busy = false }) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Below the button, or above it when there's no room (rows near the bottom of the list).
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const anchor = buttonRef.current?.getBoundingClientRect();
    if (!anchor) return;
    // The visual viewport excludes the on-screen keyboard.
    const visibleHeight = window.visualViewport?.height ?? window.innerHeight;
    const maxHeight = visibleHeight - VIEWPORT_MARGIN * 2;
    const menuHeight = Math.min(menuRef.current?.offsetHeight ?? 0, maxHeight);
    const fitsBelow = anchor.bottom + menuHeight + VIEWPORT_MARGIN <= visibleHeight;
    setPosition({
      top: fitsBelow ? anchor.bottom : Math.max(VIEWPORT_MARGIN, anchor.top - menuHeight),
      left: Math.max(VIEWPORT_MARGIN, anchor.right - MENU_WIDTH),
      maxHeight,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onScroll = (e: Event) => {
      if (!menuRef.current?.contains(e.target as Node)) close();
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      close();
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    // The menu is fixed to the viewport, so it would detach from a scrolling row.
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div
      className="hidden max-md:flex touch:flex flex-shrink-0"
      // Portalled clicks still bubble through React to the row, which has its own onClick.
      onClick={(e) => e.stopPropagation()}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-busy={busy}
        disabled={busy}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center justify-center h-10 w-10 -mr-2 rounded-[8px] text-[--text-muted] active:bg-[--bg-hover]"
      >
        {busy ? <IconLoader2 size={18} className="motion-safe:animate-spin motion-reduce:animate-none" /> : <IconDots size={18} />}
      </button>
      {open && typeof document !== 'undefined' && ReactDOM.createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={ariaLabel}
          className="fixed z-[9999] overflow-y-auto rounded-[12px] py-[6px] border border-[--border-subtle] bg-[--bg-raised] shadow-[0_12px_32px_rgba(0,0,0,0.4)]"
          style={{
            top: position?.top ?? 0,
            left: position?.left ?? 0,
            width: MENU_WIDTH,
            maxHeight: position?.maxHeight,
            visibility: position ? 'visible' : 'hidden',
            fontFamily: 'Inter, sans-serif',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={(e) => {
                setOpen(false);
                item.onClick(e);
              }}
              className={`w-full flex items-center gap-2.5 px-3 h-11 text-[14px] text-left active:bg-[--bg-hover] disabled:opacity-50 ${
                item.danger ? 'text-[--text-error]' : 'text-[--text-secondary]'
              }`}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
};

export default RowActionsMenu;
