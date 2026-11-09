/**
 * React-free rules for re-fetching `/feature_flags` after the startup request failed.
 *
 * home.tsx fetches the flags exactly once per load. If that single request fails
 * (cold lambda, 5xx, throttle, dropped connection) `state.featureFlags` stays `{}` for
 * the whole session — and a user with no cached flag set (first visit, new browser,
 * cleared storage) sees every flag-gated control missing until they refresh.
 */

import { PATCH_ONLY_FLAG_KEYS, isFullFlagSet } from './useStableFeatureFlags';
import type { Features } from '@/types/features';

/** Backoff between attempts. The array length is the retry budget per outage. */
export const FLAG_RETRY_DELAYS_MS: readonly number[] = [1500, 4000, 10000, 30000, 60000];

/**
 * Cadence once the backoff budget is spent. A long outage (or a user who simply never
 * switches tabs, so focus never re-arms a try) must still heal without a refresh; one
 * request per few minutes, and only while flags are missing, is cheap.
 */
export const FLAG_RETRY_STEADY_MS = 5 * 60 * 1000;

/** Delay before retry number `attempt` (0-based): backoff first, then a slow steady cadence. */
export function nextFlagRetryDelay(attempt: number): number | null {
  if (attempt < 0) return null;
  return attempt < FLAG_RETRY_DELAYS_MS.length ? FLAG_RETRY_DELAYS_MS[attempt] : FLAG_RETRY_STEADY_MS;
}

/**
 * The flag set to dispatch after a successful retry, or `null` if the payload is not
 * a trustworthy full set (error shape, `{}`, a lone startup patch).
 *
 * Patch-only keys already in state (`smartMessages`, dispatched by
 * `fetchUserAppConfigs`) keep their value: in the healthy ordering that dispatch spreads
 * the full set and so wins over the server's own value for that key.
 */
export function mergeRetriedFlags(payload: unknown, current: Features | undefined | null): Features | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const server = payload as Features;
  if (!isFullFlagSet(server)) return null;
  const merged: Record<string, unknown> = { ...server };
  for (const key of PATCH_ONLY_FLAG_KEYS) {
    if (current && Object.prototype.hasOwnProperty.call(current, key)) {
      merged[key] = (current as Record<string, unknown>)[key];
    }
  }
  return merged as Features;
}
