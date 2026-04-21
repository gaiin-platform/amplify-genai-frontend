import { useEffect, useRef, useCallback } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Traps keyboard focus within a container element.
 * - On mount: stores the previously focused element, focuses the first focusable child
 * - Tab/Shift+Tab cycle within the container
 * - Escape calls onEscape callback
 * - On unmount: returns focus to the previously focused element
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  isActive: boolean,
  onEscape?: () => void
) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter((el) => el.offsetParent !== null); // exclude hidden elements
  }, [containerRef]);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    // Store the element that had focus before the trap activated
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus the first focusable element inside the container
    const focusable = getFocusableElements();
    if (focusable.length > 0) {
      // Small delay to ensure the container is rendered
      requestAnimationFrame(() => {
        focusable[0]?.focus();
      });
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }

      if (e.key !== 'Tab') return;

      const elements = getFocusableElements();
      if (elements.length === 0) return;

      const first = elements[0];
      const last = elements[elements.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: if focus is on first element, wrap to last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: if focus is on last element, wrap to first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);

      // Return focus to the previously focused element
      if (previousFocusRef.current && previousFocusRef.current.focus) {
        previousFocusRef.current.focus();
      }
    };
  }, [isActive, containerRef, getFocusableElements, onEscape]);
}
