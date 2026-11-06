import { useSyncExternalStore } from 'react';

/**
 * The element inside the mobile top bar that a page may fill with its own title and
 * actions, so phones show one header bar instead of two. NewSidebar publishes it while
 * the top bar is mounted (below the sidebar breakpoint); it is null on wider screens,
 * so `useMobileTopBarSlot() !== null` also means "the top bar is on screen".
 */
let slot: HTMLElement | null = null;
const listeners = new Set<() => void>();

/** Stable, so it can be passed directly as a React ref callback. */
export const setMobileTopBarSlot = (element: HTMLElement | null): void => {
  if (element === slot) return;
  slot = element;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useMobileTopBarSlot = (): HTMLElement | null =>
  useSyncExternalStore(subscribe, () => slot, () => null);
