/**
 * UIPreferenceBanner — resolves, once per load, which UI this user gets, and holds an
 * opaque cover until it knows. It is the only writer of the rollout store
 * (`shared/uiRolloutStore`), which `NewUiRolloutGate` and the account menus read.
 *
 * Behavior:
 *   - Fetches user settings and `/feature_flags` concurrently; `uiPreferenceResolver`
 *     turns the results (or the startup timeout) into one verdict.
 *   - Rollout disabled → Classic for everyone. The stored choice is left alone, so
 *     re-enabling restores it.
 *   - Rollout enabled (`newUi: true`; absent = off) → stored choice (server beats
 *     localStorage); no choice → New UI.
 *   - Fallbacks when `/feature_flags` is slow or fails: this user's last server verdict,
 *     else fail closed (Classic). A late response re-resolves, so a late "disabled" wins.
 *   - `?uiPreference=reset` erases both stores and reloads, to re-test a first run.
 *
 * Why it covers the screen: `home.tsx` renders the Classic layout while its own
 * `uiPreference` is null, so the unresolved window must be hidden. The layout effect
 * mounts the cover before first paint. The New UI itself is kept unmounted by
 * `NewUiRolloutGate` until the rollout is confirmed.
 *
 * The cookie is for load-balancer routing: rule #3 on port 443 matches
 * X-Amplify-UI=new and forwards to the new-UI target group. It is cleared whenever the
 * rollout is disabled.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { saveUserSettings, fetchUserSettings } from '@/services/settingsService';
import { getFeatureFlags } from '@/services/adminService';
import NewUILoadingStatus from '@/components/NewUI/shared/NewUILoadingStatus';
import {
  UI_PREF_KEY,
  clearLocalUIPreference,
  clearUIRoutingCookie,
  getUIPreference,
  readUIPreferenceOverride,
  resolveStoredUIPreference,
  urlWithoutUIPreferenceParam,
  writeLocalUIPreference,
  type UIPreference,
} from '@/components/NewUI/shared/uiPreferenceResolution';
import {
  NEW_UI_ROLLOUT_CACHE_KEY,
  cacheClassicUiSwitchPolicy,
  cacheNewUiRollout,
  claimClassicUiSwitchCache,
  isCachedClassicUiSwitchDisallowed,
  isClassicUiSwitchAllowed,
  readCachedNewUiRollout,
  resolveNewUiRollout,
} from '@/components/NewUI/shared/deploymentFeaturePolicy';
import { createUiPreferenceResolver } from '@/components/NewUI/shared/uiPreferenceResolver';
import {
  canApplyUiPreference,
  getUiRolloutSnapshot,
  resetUiRollout,
  setUiRollout,
} from '@/components/NewUI/shared/uiRolloutStore';
import { getSettings } from '@/utils/app/settings';

// Re-exported so existing importers (home.tsx, AccountMenu) keep their import path.
export { UI_PREF_KEY, getUIPreference, resolveStoredUIPreference };
export type { UIPreference };

/**
 * How long we wait for the server before deciding from the fallbacks. A hung request
 * must not leave the user behind the cover; a response arriving later still re-resolves.
 */
export const PREF_RESOLVE_TIMEOUT_MS = 6000;

/** A refocused tab re-checks the rollout at most this often. */
const REVALIDATE_MIN_INTERVAL_MS = 30000;

/** Window event: something changed the feature flags (e.g. the admin saved), re-check now. */
export const REVALIDATE_ROLLOUT_EVENT = 'amplifyRevalidateNewUiRollout';

/** The loader shown after a switch is requested; the callers reload well before this. */
const SWITCH_LOADER_MAX_MS = 10000;

export interface SetUIPreferenceResult {
  /** The policy allowed the change and it was applied on this device. */
  applied: boolean;
  /** The server accepted it. Without this a reload resolves to the old server value. */
  persisted: boolean;
}

/**
 * Persist the UI preference to:
 *   1. localStorage  (immediate, same-device)
 *   2. A cookie      (for load-balancer routing)
 *   3. Server-side user settings (cross-device; wins on the next load)
 *
 * Refuses a change the current rollout policy forbids, so a stale menu, tab or caller
 * cannot activate New UI while the rollout is disabled. When the server write fails the
 * local change is rolled back: the server value wins on reload, so keeping it would just
 * bounce the user back.
 */
export async function setUIPreference(pref: 'new' | 'classic'): Promise<SetUIPreferenceResult> {
  if (!canApplyUiPreference(getUiRolloutSnapshot(), pref)) {
    return { applied: false, persisted: false };
  }

  const previous = getUIPreference();
  writeLocalUIPreference(pref);
  // Notify the mounted gate immediately so callers that must await server
  // persistence still get instant feedback.
  window.dispatchEvent(new CustomEvent('amplifyUIPreferenceSwitch', {
    detail: { preference: pref },
  }));

  let persisted = false;
  try {
    const result = await fetchUserSettings();
    const current = result?.success && result.data
      ? result.data
      : getSettings({});
    persisted = (await saveUserSettings({ ...current, uiPreference: pref })) === true;
  } catch {
    persisted = false;
  }

  if (!persisted) {
    if (previous) writeLocalUIPreference(previous);
    else clearLocalUIPreference();
    window.dispatchEvent(new CustomEvent('amplifyUIPreferenceSwitchFailed'));
  }
  return { applied: true, persisted };
}

/**
 * Erase the stored choice everywhere, so the next load is a genuine first run.
 * Backs `?uiPreference=reset`. The key is *removed* rather than set to null because
 * `saveUserSettings` replaces the whole settings object.
 */
async function clearUIPreference(): Promise<void> {
  clearLocalUIPreference();
  try {
    const result = await fetchUserSettings();
    const current = (result?.success && result.data ? result.data : {}) as Record<string, unknown>;
    delete current.uiPreference;
    await saveUserSettings(current);
  } catch {
    // Non-fatal — localStorage is already clear.
  }
}

interface UIPreferenceBannerProps {
  onSelectNew: () => void;
  onSelectClassic: () => void;
}

export const UIPreferenceBanner: React.FC<UIPreferenceBannerProps> = ({
  onSelectNew,
  onSelectClassic,
}) => {
  // 'resolving' → opaque cover; 'done' → home.tsx owns the layout
  const [phase, setPhase] = useState<'resolving' | 'done'>('resolving');
  const [switchingTo, setSwitchingTo] = useState<'new' | 'classic' | null>(null);

  const { data: session } = useSession();
  const userKeyRef = useRef<string | null>(null);
  userKeyRef.current = session?.user?.email ?? (session?.user as any)?.username ?? null;

  // home.tsx passes fresh inline arrows on every render, so these are read through a
  // ref. Listing them in the effect deps would restart the fetches each render.
  const callbacksRef = useRef({ onSelectNew, onSelectClassic });
  callbacksRef.current = { onSelectNew, onSelectClassic };

  // A *layout* effect starts the resolution before the browser paints, so the opaque
  // cover is committed before any fallback layout can be visible.
  useLayoutEffect(() => {
    // Per-effect flags, declared in the effect body so a StrictMode remount re-arms
    // them rather than latching the unmounted value forever (NEW_UI_GUIDE §16).
    let cancelled = false;
    let timer = 0;

    // A verdict from an earlier mount or user must never be visible to this one.
    resetUiRollout();

    // `?uiPreference=reset` — erase both stores, then reload without the param so the
    // next load is indistinguishable from a first-ever visit.
    if (readUIPreferenceOverride(window.location.search)) {
      clearUIPreference().finally(() => {
        window.location.replace(urlWithoutUIPreferenceParam(window.location.href));
      });
      return;
    }

    const userKey = userKeyRef.current;
    // Drop a classic-switch value left by another account before anything reads it
    // (home.tsx reads that key directly in fetchSettings).
    claimClassicUiSwitchCache(userKey);

    const resolver = createUiPreferenceResolver({
      local: getUIPreference(),
      cachedRollout: readCachedNewUiRollout(userKey),
      cachedClassicDisallowed: isCachedClassicUiSwitchDisallowed(userKey),
      onResolved: ({ rollout, allowClassic, effective }) => {
        if (cancelled) return;
        // Publish before notifying home.tsx so the gate already knows the verdict
        // when the preference state changes.
        setUiRollout(rollout ? 'enabled' : 'disabled', allowClassic);
        if (rollout) writeLocalUIPreference(effective);
        else clearUIRoutingCookie(); // keep the stored choice; only stop LB routing
        setPhase('done');
        if (effective === 'new') callbacksRef.current.onSelectNew();
        else callbacksRef.current.onSelectClassic();
      },
    });

    const settleTimer = () => {
      if (resolver.isFinalized()) window.clearTimeout(timer);
    };

    // The server is the cross-device source of truth; the local value is only the
    // fallback and must not tear down the cover before a server value can win.
    timer = window.setTimeout(() => resolver.timeout(), PREF_RESOLVE_TIMEOUT_MS);

    fetchUserSettings().then(
      (result) => {
        const data = result?.success ? (result.data as { uiPreference?: unknown } | null) : null;
        resolver.receiveSettings(data?.uiPreference);
        settleTimer();
      },
      () => {
        resolver.receiveSettings(undefined);
        settleTimer();
      },
    );

    getFeatureFlags().then(
      (result) => {
        const data = result?.success ? result.data : null;
        // Cache only a trusted payload, even after unmount: it is correct data for this user.
        const verdict = resolveNewUiRollout(data);
        if (verdict !== null) {
          cacheNewUiRollout(userKey, verdict);
          cacheClassicUiSwitchPolicy(isClassicUiSwitchAllowed(data as any), userKey);
        }
        resolver.receiveFlags(data);
        settleTimer();
      },
      () => {
        resolver.receiveFlags(null);
        settleTimer();
      },
    );

    // ── Staying current after startup ────────────────────────────────────────
    // An open tab must not keep showing the New UI after the rollout is switched off
    // (or miss it being switched back on). Three triggers re-check: the tab regaining
    // focus, an admin save in this tab, and another tab of the same user publishing a
    // verdict. A failed re-check is ignored, so it can never knock the session over.
    let lastChecked = Date.now();
    let checking = false;
    const revalidate = async () => {
      if (cancelled || checking || !resolver.isFinalized()) return;
      checking = true;
      lastChecked = Date.now();
      try {
        const result = await getFeatureFlags();
        const data = result?.success ? result.data : null;
        const verdict = resolveNewUiRollout(data);
        if (verdict !== null) {
          cacheNewUiRollout(userKey, verdict);
          cacheClassicUiSwitchPolicy(isClassicUiSwitchAllowed(data as any), userKey);
          if (!cancelled) resolver.revalidate(data);
        }
      } catch {
        // Keep the current verdict.
      } finally {
        checking = false;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastChecked < REVALIDATE_MIN_INTERVAL_MS) return;
      void revalidate();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== NEW_UI_ROLLOUT_CACHE_KEY || !event.newValue || !userKey) return;
      try {
        const peer = JSON.parse(event.newValue);
        if (peer?.u === userKey && typeof peer.enabled === 'boolean') {
          resolver.adoptPeerVerdict(peer.enabled);
        }
      } catch {
        // Malformed peer value — ignore.
      }
    };
    const onRevalidateRequest = () => void revalidate();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('storage', onStorage);
    window.addEventListener(REVALIDATE_ROLLOUT_EVENT, onRevalidateRequest);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(REVALIDATE_ROLLOUT_EVENT, onRevalidateRequest);
    };
  }, []);

  // Immediate feedback while a switch is persisting. Callers reload on success; the
  // failure event (or the cap below) clears the loader if they cannot.
  useEffect(() => {
    let loaderTimer = 0;
    const onSwitch = (event: Event) => {
      const preference = (event as CustomEvent<{ preference?: unknown }>).detail?.preference;
      if (preference !== 'new' && preference !== 'classic') return;
      setSwitchingTo(preference);
      window.clearTimeout(loaderTimer);
      loaderTimer = window.setTimeout(() => setSwitchingTo(null), SWITCH_LOADER_MAX_MS);
    };
    const onFailed = () => {
      window.clearTimeout(loaderTimer);
      setSwitchingTo(null);
    };
    window.addEventListener('amplifyUIPreferenceSwitch', onSwitch);
    window.addEventListener('amplifyUIPreferenceSwitchFailed', onFailed);
    return () => {
      window.clearTimeout(loaderTimer);
      window.removeEventListener('amplifyUIPreferenceSwitch', onSwitch);
      window.removeEventListener('amplifyUIPreferenceSwitchFailed', onFailed);
    };
  }, []);

  // Still resolving: cover the app so no fallback layout paints. Bounded by
  // PREF_RESOLVE_TIMEOUT_MS.
  if (phase === 'resolving') {
    return (
      <div
        className="fixed inset-0 z-[200]"
        style={{ background: 'var(--bg-app)' }}
      >
        <NewUILoadingStatus open message="Setting up Amplify…" />
      </div>
    );
  }

  // Resolved — home.tsx owns the layout from here.
  return switchingTo ? (
    <NewUILoadingStatus
      open
      message={switchingTo === 'new' ? 'Switching to New UI…' : 'Switching to Classic UI…'}
    />
  ) : null;
};

export default UIPreferenceBanner;
