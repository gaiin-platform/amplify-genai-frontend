import { useEffect, useState } from 'react';

/** SSR-safe matchMedia hook. Defaults to `false` until mounted. */
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(false);
    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;
        const mql = window.matchMedia(query);
        const update = () => setMatches(mql.matches);
        update();
        mql.addEventListener?.('change', update);
        return () => mql.removeEventListener?.('change', update);
    }, [query]);
    return matches;
}
