/**
 * useStableFeatureFlags — feature flags that don't blink out from under the UI.
 *
 * Why this exists (UI-003): `state.featureFlags` starts as `{}` on every page load
 * (home.state.tsx) and is only filled once the `/feature_flags` round-trip resolves,
 * which cannot even start until the auth session lands. It is never persisted, and if
 * the request fails or returns nothing the state stays `{}` for the whole session.
 *
 * Anything gated with a bare `featureFlags.x` therefore disappears for the first
 * few hundred milliseconds after every refresh — and permanently on a failed fetch.
 * For the sidebar that meant Workflows / Scheduled Tasks / Notebook (plus their
 * preference toggles) intermittently vanishing, leaving the user unable to reverse a
 * visibility choice for a row that was no longer listed.
 *
 * Behaviour:
 *   - Flags arrived from the server → use them verbatim and cache them. An admin
 *     turning a flag off is always respected on the next load.
 *   - Flags still empty (in flight, or the request failed) → fall back to the last
 *     known-good set from localStorage, so the UI keeps the shape the user last saw.
 *   - Nothing cached yet (genuine first visit) → `{}`, same as today.
 *
 * Cache key: amplify_feature_flags_cache
 */

import { useContext, useEffect, useMemo, useRef } from 'react';
import HomeContext from '@/pages/api/home/home.context';
import { Features } from '@/types/features';

export const FEATURE_FLAG_CACHE_KEY = 'amplify_feature_flags_cache';

const EMPTY_FLAGS: Features = {};

/** Last known-good flags written by a previous session. `{}` when absent/corrupt. */
export function readCachedFeatureFlags(): Features {
  if (typeof window === 'undefined') return EMPTY_FLAGS;
  try {
    const stored = localStorage.getItem(FEATURE_FLAG_CACHE_KEY);
    if (!stored) return EMPTY_FLAGS;
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Features)
      : EMPTY_FLAGS;
  } catch {
    return EMPTY_FLAGS;
  }
}

/**
 * The resolution rule, split out so it can be reasoned about (and tested) without React:
 * server flags win whenever there are any, otherwise fall back to the cached set.
 */
export function resolveFeatureFlags(
  serverFlags: Features | undefined | null,
  cachedFlags: Features,
): Features {
  return serverFlags && Object.keys(serverFlags).length > 0 ? serverFlags : cachedFlags;
}

export function useStableFeatureFlags(): Features {
  const {
    state: { featureFlags },
  } = useContext(HomeContext);

  const hasServerFlags = !!featureFlags && Object.keys(featureFlags).length > 0;

  // Read the cache once per mount — a later write must not change what this render
  // tree is using, otherwise rows could still shift around mid-session.
  const cachedRef = useRef<Features | null>(null);
  if (cachedRef.current === null) cachedRef.current = readCachedFeatureFlags();

  useEffect(() => {
    if (!hasServerFlags) return;
    try {
      localStorage.setItem(FEATURE_FLAG_CACHE_KEY, JSON.stringify(featureFlags));
    } catch {
      // Private browsing / quota — the in-memory flags still work for this session.
    }
  }, [featureFlags, hasServerFlags]);

  return useMemo(
    () => resolveFeatureFlags(featureFlags, cachedRef.current as Features),
    [featureFlags, hasServerFlags], // eslint-disable-line react-hooks/exhaustive-deps
  );
}
