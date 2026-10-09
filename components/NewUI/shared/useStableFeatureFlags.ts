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
 * ── The startup race (UI-003b) ──────────────────────────────────────────────────
 * Treating "any non-empty object" as a full flag set is not enough, because
 * `featureFlags` is not only written by `/feature_flags`. home.tsx fires
 * `fetchFeatureFlags()` and `fetchUserAppConfigs()` concurrently and unordered, and the
 * DEFAULT_SMART_MESSAGES branch of the latter dispatches
 * `{ ...featureFlagsRef.current, smartMessages: x }` as the *entire* featureFlags state.
 * When user-app-configs wins the race, `featureFlagsRef.current` is still `{}` and the
 * state becomes exactly `{ smartMessages: false }` — non-empty, but missing every
 * sidebar flag. That is the flicker: rows drawn from cache, blanked by the patch, then
 * restored when `/feature_flags` lands. Worse, the old code wrote that patch to the
 * cache, so losing the race once poisoned the fallback for all later loads.
 *
 * Both fixes live here rather than in home.tsx / the reducer, which are off-limits
 * (NEW_UI_GUIDE §2). We can't reorder the dispatches, so we classify them instead.
 *
 * Behaviour:
 *   - Full flag set from the server → use it verbatim and cache it. An admin turning a
 *     flag off is always respected on the next load.
 *   - Single-key patch (see PATCH_ONLY_FLAG_KEYS) → merged *over* the last known-good
 *     set instead of replacing it, and never cached. Patch value wins for its own key.
 *   - Empty (in flight, or the request failed) → fall back to the last known-good set
 *     from localStorage, so the UI keeps the shape the user last saw.
 *   - Nothing cached yet (genuine first visit) → `{}`, same as before.
 *
 * Cache key: amplify_feature_flags_cache
 */

import { useContext, useEffect, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import HomeContext from '@/pages/api/home/home.context';
import { Features } from '@/types/features';

export const FEATURE_FLAG_CACHE_KEY = 'amplify_feature_flags_cache';
/** Whose flags the cache holds. A cache with a different (or no) owner is never used. */
export const FEATURE_FLAG_CACHE_OWNER_KEY = 'amplify_feature_flags_cache_owner';

/**
 * Flags that the app dispatches on their own as a patch, outside the `/feature_flags`
 * payload. Today that is only `smartMessages`, written by the DEFAULT_SMART_MESSAGES
 * branch of `fetchUserAppConfigs` in pages/api/home/home.tsx.
 *
 * `smartMessages` is also a genuine server flag, so a real payload will contain it —
 * what marks an object as a patch is containing *nothing but* these keys. A full set
 * always carries other flags alongside it.
 *
 * Add a key here if another call site starts dispatching a lone flag into
 * `state.featureFlags`; otherwise that dispatch will be mistaken for a full set and
 * will blank every other flag.
 */
export const PATCH_ONLY_FLAG_KEYS: readonly string[] = ['smartMessages'];

const EMPTY_FLAGS: Features = {};

/**
 * True when `flags` looks like the real `/feature_flags` payload — non-empty, and
 * carrying at least one key that isn't dispatched as a standalone patch.
 */
export function isFullFlagSet(flags: Features | undefined | null): boolean {
  if (!flags) return false;
  return Object.keys(flags).some((key) => !PATCH_ONLY_FLAG_KEYS.includes(key));
}

/**
 * Last known-good flags written by a previous session. `{}` when absent/corrupt.
 *
 * `userKey` scopes the cache to one account: `undefined` skips the check (pure tests),
 * `null` (identity not known yet) and any other owner return `{}`, so one user's flags
 * — including the New UI rollout verdict — are never shown to the next user on the browser.
 */
export function readCachedFeatureFlags(userKey?: string | null): Features {
  if (typeof window === 'undefined') return EMPTY_FLAGS;
  try {
    if (userKey !== undefined) {
      if (!userKey || localStorage.getItem(FEATURE_FLAG_CACHE_OWNER_KEY) !== userKey) return EMPTY_FLAGS;
    }
    const stored = localStorage.getItem(FEATURE_FLAG_CACHE_KEY);
    if (!stored) return EMPTY_FLAGS;
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return EMPTY_FLAGS;
    // Discard a cache poisoned by the pre-fix version, which persisted the
    // `{ smartMessages: … }` startup patch as though it were a full flag set. Using it
    // as the baseline would hide the flag-gated rows on every load.
    return isFullFlagSet(parsed as Features) ? (parsed as Features) : EMPTY_FLAGS;
  } catch {
    return EMPTY_FLAGS;
  }
}

/**
 * The resolution rule, split out so it can be reasoned about (and tested) without React.
 *
 * A full server set wins outright. A patch-only set is merged over the baseline so it
 * can update its own flag without dropping the rest. Nothing at all falls back to the
 * baseline.
 */
export function resolveFeatureFlags(
  serverFlags: Features | undefined | null,
  cachedFlags: Features,
): Features {
  if (!serverFlags || Object.keys(serverFlags).length === 0) return cachedFlags;
  if (isFullFlagSet(serverFlags)) return serverFlags;
  return { ...cachedFlags, ...serverFlags };
}

export function useStableFeatureFlags(): Features {
  const {
    state: { featureFlags },
  } = useContext(HomeContext);

  const hasFullFlags = isFullFlagSet(featureFlags);

  const { data: session } = useSession();
  const userKey: string | null =
    session?.user?.email ?? (session?.user as { username?: string } | undefined)?.username ?? null;

  // Read the cache once per mount — a later write must not change what this render
  // tree is using, otherwise rows could still shift around mid-session. The only
  // re-read is when the account becomes known after mount (session still loading).
  const cachedRef = useRef<{ key: string | null; flags: Features } | null>(null);
  if (cachedRef.current === null || (cachedRef.current.key === null && userKey !== null)) {
    cachedRef.current = { key: userKey, flags: readCachedFeatureFlags(userKey) };
  }

  useEffect(() => {
    // Only a full set is worth persisting. Caching the startup patch would make the
    // next load start from a baseline with no sidebar flags in it.
    if (!hasFullFlags || !userKey) return;
    try {
      localStorage.setItem(FEATURE_FLAG_CACHE_KEY, JSON.stringify(featureFlags));
      localStorage.setItem(FEATURE_FLAG_CACHE_OWNER_KEY, userKey);
    } catch {
      // Private browsing / quota — the in-memory flags still work for this session.
    }
  }, [featureFlags, hasFullFlags, userKey]);

  return useMemo(
    () => resolveFeatureFlags(featureFlags, (cachedRef.current as { flags: Features }).flags),
    [featureFlags, hasFullFlags, userKey], // eslint-disable-line react-hooks/exhaustive-deps
  );
}
