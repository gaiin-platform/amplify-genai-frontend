import { useEffect } from 'react';

/** Below this much lost height, it's browser chrome collapsing rather than a keyboard. */
const KEYBOARD_MIN_HEIGHT = 120;

/**
 * Overlays don't resize with the shell, whether portalled out of it or `fixed` inside it,
 * so a field in one depends on Safari's pan to stay above the keyboard.
 */
const isInOverlay = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element) || !target.closest('.app-safe-area')) return true;
  for (let el: Element | null = target; el; el = el.parentElement) {
    if (getComputedStyle(el).position === 'fixed') return true;
  }
  return false;
};

/**
 * Keeps the app above the on-screen keyboard on iOS. Safari ignores the viewport's
 * `interactive-widget=resizes-content`: the keyboard shrinks only the visual viewport,
 * and the page pans up under the status bar, taking the top bar with it. While the
 * keyboard is open for a field in the shell, this sizes the shell to the visible area
 * (see globals.css) and undoes the pan.
 *
 * Renders nothing.
 */
export const KeyboardViewportFit = () => {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport || !window.matchMedia('(hover: none) and (pointer: coarse)').matches) return;
    const root = document.documentElement;

    // Kept through a blur, so an overlay doesn't jump while the keyboard animates away.
    let overlayFocused = false;

    const clear = () => {
      root.removeAttribute('data-keyboard-open');
      root.style.removeProperty('--keyboard-visual-height');
    };
    const sync = () => {
      // Pinch-zoom shrinks the visual viewport too, and must keep panning freely.
      if (viewport.scale > 1.01) return clear();
      // clientHeight ignores the keyboard, unlike window.innerHeight, which iOS shrinks.
      if (overlayFocused || root.clientHeight - viewport.height < KEYBOARD_MIN_HEIGHT) return clear();
      // Shrinking the shell must not lose the reader's place in the chat: keep the same
      // distance from the end of the messages.
      const messages = document.querySelector<HTMLElement>('.chatcontainer');
      const fromEnd = messages ? messages.scrollHeight - messages.scrollTop - messages.clientHeight : 0;
      root.setAttribute('data-keyboard-open', '');
      root.style.setProperty('--keyboard-visual-height', `${viewport.height}px`);
      if (messages) messages.scrollTop = messages.scrollHeight - messages.clientHeight - fromEnd;
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };

    // Focus can move between the shell and an overlay with no viewport change.
    const onFocusIn = (event: FocusEvent) => {
      overlayFocused = isInOverlay(event.target);
      sync();
    };

    sync();
    viewport.addEventListener('resize', sync);
    viewport.addEventListener('scroll', sync);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      viewport.removeEventListener('resize', sync);
      viewport.removeEventListener('scroll', sync);
      document.removeEventListener('focusin', onFocusIn);
      clear();
    };
  }, []);

  return null;
};

export default KeyboardViewportFit;
