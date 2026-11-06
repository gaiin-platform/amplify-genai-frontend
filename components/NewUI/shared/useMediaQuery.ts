import { useEffect, useState } from 'react';

/**
 * Live `window.matchMedia(query).matches`. Returns false during SSR and the first
 * client render, then tracks changes (rotation, window resize, input-device change).
 */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [query]);
  return matches;
};

/** True on devices without hover (phones/tablets): hover-revealed UI must be shown outright. */
/** Same query as the Tailwind `touch:` variant and the touch block in globals.css. */
export const useIsTouch = (): boolean => useMediaQuery('(hover: none) and (pointer: coarse)');

/**
 * A touch device with a phone-sized screen: narrower than the sidebar breakpoint (768px),
 * or a phone turned sideways (short). Tablets, including an iPad in the desktop layout,
 * don't match. For behaviour that suits a phone only, such as not raising the keyboard
 * unprompted.
 */
export const PHONE_MEDIA_QUERY =
  '(hover: none) and (pointer: coarse) and (max-width: 767px), (hover: none) and (pointer: coarse) and (max-height: 480px)';
