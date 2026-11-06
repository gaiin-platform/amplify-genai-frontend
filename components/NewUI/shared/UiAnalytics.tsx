/**
 * UiAnalytics — Mixpanel plumbing for comparing the New UI against Classic.
 *
 * `<UiAnalytics variant="new" | "classic" />` renders nothing. Mount it once inside each
 * layout in home.tsx. It:
 *   1. Stamps every subsequent Mixpanel event with a `UI Version` super property
 *      (see `setAnalyticsUiVersion`), so ANY event can be broken down new vs classic.
 *   2. Fires `UI Loaded` once per page load (the denominator for "% of sessions").
 *   3. Fires `Page Viewed` whenever the top-level `page` changes.
 *
 * Events are gated by the `mixPanel` feature flag (via `statsService`). The effects depend
 * on that flag because it lands after first render; without it the first events would be
 * dropped.
 *
 * Also exports `useTrack` / `useDebouncedSearchTracking` for New UI components.
 */
import { useCallback, useContext, useEffect, useRef } from 'react';
import HomeContext from '@/components/Home/home.context';
import { setAnalyticsUiVersion, type AnalyticsUiVersion } from '@/hooks/useEventService';
import { getUIPreference } from '@/components/NewUI/shared/uiPreferenceResolution';

export function UiAnalytics({ variant }: { variant: AnalyticsUiVersion }) {
  const {
    state: { statsService, page, featureFlags },
  } = useContext(HomeContext);
  const mixPanelOn = !!(featureFlags as Record<string, boolean> | undefined)?.mixPanel;

  // Set synchronously-as-early-as-possible so events fired by sibling effects pick it up.
  setAnalyticsUiVersion(variant);

  useEffect(() => {
    if (!mixPanelOn) return;
    statsService.uiLoadedEvent(variant, getUIPreference() ?? undefined);
    // statsService is rebuilt each render; only re-fire when the UI or the flag changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, mixPanelOn]);

  useEffect(() => {
    if (!mixPanelOn) return;
    statsService.pageViewedEvent(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, page, mixPanelOn]);

  return null;
}

/** Stable-identity `track(name, props)` bound to the current statsService. */
export function useTrack() {
  // Tolerate rendering outside the Home provider (tests, isolated previews).
  const statsService = useContext(HomeContext)?.state?.statsService;
  const ref = useRef(statsService);
  ref.current = statsService;
  return useCallback((name: string, properties?: Record<string, any>) => {
    ref.current?.trackEvent(name, properties);
  }, []);
}

/**
 * Fires `name` once the user has stopped typing in a search box for `delayMs`.
 * The search text itself is never sent -- only whether/where a search happened and
 * its length.
 */
export function useDebouncedSearchTracking(
  term: string,
  name: string,
  properties?: Record<string, any>,
  delayMs = 1000,
) {
  const track = useTrack();
  const propsRef = useRef(properties);
  propsRef.current = properties;
  useEffect(() => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const t = setTimeout(
      () => track(name, { ...(propsRef.current ?? {}), 'Search Length': trimmed.length }),
      delayMs,
    );
    return () => clearTimeout(t);
  }, [term, name, delayMs, track]);
}
