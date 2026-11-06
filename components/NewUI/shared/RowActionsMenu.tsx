/**
 * RowActionsMenu — a "⋯" button that opens a row's actions in a small menu.
 *
 * List rows reveal their action buttons on hover, which touch devices can't do, and
 * the reserved width squeezes the row's name on a phone. Rows hide that cluster there
 * (`max-md:hidden touch:hidden`) and render this instead; it shows only in that same
 * condition, so desktop is unchanged.
 *
 * Keyboard: Enter / Space / ArrowDown / ArrowUp on the button open the menu with focus on
 * the first / first / last item. In the menu, ArrowUp / ArrowDown / Home / End move
 * between items (wrapping), Escape and Tab close it and return focus to the button.
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
  // Which item to focus once the menu is positioned (and so visible): set when it's opened
  // from the keyboard. A tap leaves focus alone, so no focus ring appears on touch.
  const focusOnOpenRef = useRef<'first' | 'last' | null>(null);

  const openMenu = (focus: 'first' | 'last' | null) => {
    focusOnOpenRef.current = focus;
    setOpen(true);
  };

  const menuItemButtons = (): HTMLButtonElement[] =>
    Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);

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

  // The menu is hidden until positioned, and a hidden element can't take focus.
  useEffect(() => {
    if (!open || !position || !focusOnOpenRef.current) return;
    const items = menuItemButtons();
    (focusOnOpenRef.current === 'last' ? items[items.length - 1] : items[0])?.focus();
    focusOnOpenRef.current = null;
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    // iOS Safari fires `resize` as its toolbar collapses while scrolling, which isn't a
    // layout change. Only a change of width (rotation, split view) should dismiss the menu.
    const openedAtWidth = window.innerWidth;
    const closeOnWidthChange = () => {
      if (window.innerWidth !== openedAtWidth) close();
    };
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
    window.addEventListener('resize', closeOnWidthChange);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', closeOnWidthChange);
    };
  }, [open]);

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab') {
      // Leaving the menu with Tab would strand focus on a portal at the end of the page.
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }
    const buttons = menuItemButtons();
    if (buttons.length === 0) return;
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let next: number | null = null;
    if (e.key === 'ArrowDown') next = (current + 1) % buttons.length;
    else if (e.key === 'ArrowUp') next = (current <= 0 ? buttons.length : current) - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = buttons.length - 1;
    if (next === null) return;
    e.preventDefault();
    buttons[next].focus();
  };

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
        // A keyboard-triggered click has detail 0; a tap or mouse click has detail >= 1.
        onClick={(e) => (open ? setOpen(false) : openMenu(e.detail === 0 ? 'first' : null))}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
          e.preventDefault();
          if (open) {
            const buttons = menuItemButtons();
            (e.key === 'ArrowUp' ? buttons[buttons.length - 1] : buttons[0])?.focus();
          } else {
            openMenu(e.key === 'ArrowUp' ? 'last' : 'first');
          }
        }}
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
          onKeyDown={onMenuKeyDown}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={(e) => {
                setOpen(false);
                // Chosen from the keyboard: the focused item is about to unmount, so hand
                // focus back to the button first. An action that opens a dialog or an
                // input takes focus from there itself. (Not on touch: no focus ring.)
                if (e.detail === 0) buttonRef.current?.focus();
                item.onClick(e);
              }}
              className={`w-full flex items-center gap-2.5 px-3 h-11 text-[14px] text-left active:bg-[--bg-hover] focus-visible:bg-[--bg-hover] focus-visible:outline-none disabled:opacity-50 ${
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
