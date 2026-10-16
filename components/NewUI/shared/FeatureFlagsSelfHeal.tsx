/**
 * FeatureFlagsSelfHeal — mounts once at the new-UI root, renders nothing.
 *
 * home.tsx fetches `/feature_flags` once. When that request fails, `state.featureFlags`
 * never fills, so every flag-gated control (the ⊕ menu's files/library/connectors, the
 * account menu's "Switch to classic", admin entries…) stays missing until a refresh.
 * `useStableFeatureFlags` masks this only for users who have a cached flag set.
 *
 * While the state holds no full flag set this retries the (de-duplicated) request with
 * backoff, and again whenever the tab regains focus or the network returns, then
 * dispatches the result into `state.featureFlags` so raw readers heal too. It stops as
 * soon as any writer — including home.tsx's own late response — supplies a full set.
 */

import { FC, useContext, useEffect, useRef } from 'react';
import HomeContext from '@/components/Home/home.context';
import { getFeatureFlags } from '@/services/adminService';
import { isFullFlagSet } from './useStableFeatureFlags';
import { mergeRetriedFlags, nextFlagRetryDelay } from './featureFlagRetry';
import type { Features } from '@/types/features';

export const FeatureFlagsSelfHeal: FC = () => {
  const {
    state: { featureFlags },
    dispatch,
  } = useContext(HomeContext);

  const healthy = isFullFlagSet(featureFlags);
  const currentRef = useRef<Features>(featureFlags);
  currentRef.current = featureFlags;

  useEffect(() => {
    if (healthy) return;

    // §16: re-armed in the effect body so StrictMode's simulated unmount can't latch it.
    let alive = true;
    let attempt = 0;
    let inFlight = false;
    let timer: number | undefined;

    const schedule = () => {
      window.clearTimeout(timer);
      const delay = nextFlagRetryDelay(attempt);
      if (delay === null) return; // budget spent — focus / online will still re-arm one try
      timer = window.setTimeout(run, delay);
    };

    const run = async () => {
      if (!alive || inFlight) return;
      inFlight = true;
      attempt += 1;
      try {
        const result = await getFeatureFlags();
        if (!alive) return;
        const merged = result?.success ? mergeRetriedFlags(result.data, currentRef.current) : null;
        if (merged) {
          dispatch({ field: 'featureFlags', value: merged });
          return; // `healthy` flips and the effect cleans up
        }
      } catch {
        // Fall through to the next attempt.
      } finally {
        inFlight = false;
      }
      if (alive) schedule();
    };

    const retryNow = () => {
      if (document.visibilityState === 'hidden') return;
      window.clearTimeout(timer);
      void run();
    };

    schedule();
    window.addEventListener('online', retryNow);
    document.addEventListener('visibilitychange', retryNow);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      window.removeEventListener('online', retryNow);
      document.removeEventListener('visibilitychange', retryNow);
    };
  }, [healthy, dispatch]);

  return null;
};
