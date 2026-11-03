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
export const useIsTouch = (): boolean => useMediaQuery('(hover: none)');
