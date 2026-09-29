/**
 * UIPreferenceBanner — shown once when the user hasn't yet chosen
 * between the Classic UI and the New UI.
 *
 * Behavior:
 *   - Resolves the stored preference first: localStorage `amplify_new_ui_preference`,
 *     then the server-side user settings (cross-device roaming)
 *   - Holds an opaque cover while that resolution is in flight, so neither the popup
 *     nor the wrong UI flashes (see below)
 *   - Only if *neither* store has a choice does it ask
 *   - "Try New UI" → sets preference to 'new', sets cookie X-Amplify-UI=new, calls onSelectNew()
 *   - "Stay Classic" → sets preference to 'classic', calls onSelectClassic()
 *   - User can always switch later via Settings → Appearance
 *   - `?uiPreference=reset` erases both stores and reloads, to re-test the first run
 *
 * Why the resolve-before-ask step exists: `home.tsx` renders this banner whenever
 * `uiPreference === null`, and that state starts null on every load. Its own
 * `fetchSettings()` fills it in asynchronously, so on a returning user's session the
 * popup used to paint immediately and then get torn down mid-read the moment the
 * server answered — looking like it "closed and launched the new UI by itself".
 * Waiting for the same answer here means the popup only ever appears for a user who
 * genuinely has no stored choice. `home.tsx` state is off-limits (NEW_UI_GUIDE §2),
 * so the gate lives in this component.
 *
 * Why it covers the screen instead of rendering nothing: `uiPreference === null` is
 * also what makes `home.tsx` render the *classic* layout, so the unresolved window is
 * exactly a window in which the old UI is on screen — "old loading animation → old UI
 * → new UI" on every load with an empty localStorage. This component is the only thing
 * mounted for precisely that window, so it owns hiding it. The localStorage branch
 * resolves in a **layout** effect (pre-paint) so that path costs no visible frame at
 * all; only a genuine server round trip shows the cover.
 *
 * The authenticated home mounts this gate before the conversation is initialized, and it
 * keeps the opaque cover in place until the server/local preference has been resolved.
 *
 * The cookie is for future load-balancer routing:
 *   LB listener rule #3 on port 443 matches X-Amplify-UI=new
 *   and forwards to the new-UI target group.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { saveUserSettings, fetchUserSettings } from '@/services/settingsService';
import { getFeatureFlags } from '@/services/adminService';
import NewUILoadingStatus from '@/components/NewUI/shared/NewUILoadingStatus';
import {
  UI_PREF_KEY,
  clearLocalUIPreference,
  getUIPreference,
  readUIPreferenceOverride,
  resolveStoredUIPreference,
  resolveUIPreferenceWithPolicy,
  urlWithoutUIPreferenceParam,
  writeLocalUIPreference,
  type UIPreference,
} from '@/components/NewUI/shared/uiPreferenceResolution';
import { cacheClassicUiSwitchPolicy, isCachedClassicUiSwitchDisallowed, isClassicUiSwitchAllowed } from '@/components/NewUI/shared/deploymentFeaturePolicy';
import { getSettings } from '@/utils/app/settings';

// Re-exported so existing importers (home.tsx, AccountMenu) keep their import path.
export { UI_PREF_KEY, getUIPreference, resolveStoredUIPreference };
export type { UIPreference };

/**
 * How long we wait for the server's stored choice before asking anyway.
 * A hung settings request must not leave the user stuck with no popup at all.
 */
export const PREF_RESOLVE_TIMEOUT_MS = 6000;

/**
 * Persist the UI preference to:
 *   1. localStorage  (immediate, same-device)
 *   2. A cookie      (for future load-balancer routing)
 *   3. Server-side user settings (cross-device / cross-browser)
 *
 * The server save is fire-and-forget — a failure silently falls back to
 * localStorage so the user's session isn't interrupted.
 */
export async function setUIPreference(pref: 'new' | 'classic'): Promise<void> {
  // Persist locally first: offline users still get the selected UI immediately.
  writeLocalUIPreference(pref);

  // A failed read means we cannot safely replace the server's full settings object.
  // Keep the local choice and retry on a later explicit switch/startup instead.
  try {
    const result = await fetchUserSettings();
    const current = result?.success && result.data
      ? result.data
      : getSettings({});
    await saveUserSettings({ ...current, uiPreference: pref });
  } catch {
    // Non-fatal — localStorage already holds the value.
  }
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
  // 'resolving' → checking the stores; 'ask' → popup visible; 'done' → user answered
  const [phase, setPhase] = useState<'resolving' | 'ask' | 'done'>('resolving');
  // Start restrictive from a prior policy observation to prevent stale server
  // settings from flashing classic before the current policy request resolves.
  const [classicAllowed, setClassicAllowed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('amplify_classic_ui_switch_allowed') !== 'false';
    } catch {
      return true;
    }
  });

  // home.tsx passes fresh inline arrows on every render, so these are read through a
  // ref. Listing them in the effect deps would restart the settings fetch each render.
  const callbacksRef = useRef({ onSelectNew, onSelectClassic });
  callbacksRef.current = { onSelectNew, onSelectClassic };

  const dialogRef = useRef<HTMLDivElement>(null);
  const newCardRef = useRef<HTMLButtonElement>(null);

  // A *layout* effect starts the server/local resolution before the browser paints,
  // so the opaque resolving cover is committed before any classic fallback can be
  // visible (NEW_UI_GUIDE §21 uses the same pre-paint reasoning for scroll restore).
  useLayoutEffect(() => {
    // Per-effect flags, declared in the effect body so a StrictMode remount re-arms
    // them rather than latching the unmounted value forever (NEW_UI_GUIDE §16).
    let cancelled = false;
    let settled = false;
    let timer = 0;
    let forcedByCachedPolicy = false;
    // Older deployments and failed policy reads retain the documented allow default.
    let allowClassic = true;

    const decide = (resolution: 'new' | 'classic' | 'ask') => {
      if (cancelled || settled || forcedByCachedPolicy) return;
      settled = true;
      window.clearTimeout(timer);

      // If the deployment config disables classic switching, force 'new' regardless of
      // stored preference and skip the 'ask' state so the banner never shows the dialog.
      const effective = !allowClassic && resolution !== 'new' ? 'new' : resolution;

      if (effective === 'ask') {
        setPhase('ask');
        return;
      }
      // A stored choice exists — honour it silently instead of asking again.
      // Mark the gate done before notifying home.tsx so an unconditional mount
      // cannot leave the opaque resolving cover over the selected layout.
      writeLocalUIPreference(effective);
      setPhase('done');
      if (effective === 'new') callbacksRef.current.onSelectNew();
      else callbacksRef.current.onSelectClassic();
    };

    // `?uiPreference=reset` — erase both stores, then reload without the param so the
    // next load is indistinguishable from a first-ever visit. Reloading is what makes
    // this reliable: home.tsx's own settings fetch starts before we could clear the
    // server value, so only a fresh load is guaranteed to see an empty server field.
    if (readUIPreferenceOverride(window.location.search)) {
      clearUIPreference().finally(() => {
        window.location.replace(urlWithoutUIPreferenceParam(window.location.href));
      });
      return;
    }

    const local = getUIPreference();
    const cachedPolicyDisallowsClassic = isCachedClassicUiSwitchDisallowed();
    if (cachedPolicyDisallowsClassic && local !== 'new') {
      forcedByCachedPolicy = true;
      settled = true;
      writeLocalUIPreference('new');
      callbacksRef.current.onSelectNew();
      setPhase('done');
      void setUIPreference('new');
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }

    // Always wait for the server when possible: it is the cross-device source
    // of truth. The local value remains the timeout/offline fallback, but must
    // not tear down the opaque gate before a server value can win.
    timer = window.setTimeout(
      () => decide(local ?? 'ask'),
      PREF_RESOLVE_TIMEOUT_MS,
    );

    (async () => {
      // Fetch user settings and deployment feature flags in parallel.
      const [settingsResult, flagsResult] = await Promise.allSettled([
        fetchUserSettings(),
        getFeatureFlags(),
      ]);

      let server: unknown = null;
      if (settingsResult.status === 'fulfilled' && settingsResult.value?.success) {
        server = (settingsResult.value.data as { uiPreference?: unknown }).uiPreference;
      }

      // Extract the deployment switch policy (missing legacy value means allowed).
      if (flagsResult.status === 'fulfilled' && flagsResult.value?.success) {
        allowClassic = isClassicUiSwitchAllowed(flagsResult.value.data as any);
        cacheClassicUiSwitchPolicy(allowClassic);
        setClassicAllowed(allowClassic);
      } else if (isCachedClassicUiSwitchDisallowed()) {
        allowClassic = false;
        setClassicAllowed(false);
      }

      const resolved = resolveStoredUIPreference(local, server);
      const effective = resolveUIPreferenceWithPolicy(local, server, allowClassic);
      if (!allowClassic && resolved !== 'new') {
        writeLocalUIPreference('new');
        void setUIPreference('new');
      }
      decide(effective);
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  // Focus the recommended card on open and keep Tab inside the dialog.
  // There is deliberately no Escape handler — a choice is required, and dismissing
  // without one would just re-open on the next load.
  useEffect(() => {
    if (phase !== 'ask') return;
    newCardRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>('button:not([disabled])'),
      );
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const outside = !(active instanceof Node) || !dialog.contains(active);

      if (e.shiftKey && (outside || active === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (outside || active === last)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [phase]);

  const choose = (pref: 'new' | 'classic') => {
    if (phase === 'done') return;
    // Honour the deployment policy: classic is unavailable when disallowed.
    const effective: 'new' | 'classic' = !classicAllowed && pref === 'classic' ? 'new' : pref;
    setPhase('done');
    if (effective === 'new') onSelectNew();
    else onSelectClassic();
    // Fire-and-forget — don't await so the UI switches immediately
    setUIPreference(effective).catch(() => {});
  };

  // Still resolving: cover the app. The home render uses a safe New UI loader for
  // unresolved preference values, and this opaque wrapper prevents any fallback UI
  // from painting while the server/local choice is still in flight. Bounded by
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

  // The user answered — home.tsx owns the layout from here.
  if (phase !== 'ask') return null;

  const handleNew = () => choose('new');
  const handleClassic = () => choose('classic');

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{
        backgroundColor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ui-preference-title"
        className={`
          relative w-full max-w-[520px] mx-4
          bg-[--bg-raised] border border-[--border-subtle]
          rounded-[--radius-panel]
          shadow-[0_24px_60px_rgba(0,0,0,0.5)]
          p-8
          animate-fade-in
        `}
        style={{ transformOrigin: 'center' }}
      >
        {/* Wordmark — `priority` so the logo is preloaded at high fetch priority and
            paints with the rest of the card. next/image lazy-loads by default, which
            made it arrive visibly after the text on a cold load. */}
        <div className="flex items-center gap-2 mb-6">
          <Image
            src="/amplify-logo.png"
            alt="Amplify"
            width={28}
            height={28}
            priority
            style={{ borderRadius: 4 }}
          />
          <span
            className="text-[22px] text-[--text-primary] tracking-[-0.01em]"
            style={{ fontFamily: '"Newsreader", "Georgia", serif', fontWeight: 400 }}
          >
            Amplify
          </span>
        </div>

        <h2
          id="ui-preference-title"
          className="text-[22px] font-medium text-[--text-primary] mb-3 leading-tight"
        >
          We have a new look
        </h2>
        <p className="text-[15px] text-[--text-secondary] mb-8 leading-relaxed">
          We&apos;ve redesigned Amplify with a cleaner, more focused interface. You
          can switch back to the classic view at any time from Settings →
          Appearance.
        </p>

        {/* Comparison row — clicking a card directly selects the UI */}
        <div className={`grid gap-3 ${classicAllowed ? 'grid-cols-2' : 'grid-cols-1 max-w-[260px]'}`}>
          {/* New UI preview card */}
          <button
            ref={newCardRef}
            type="button"
            className="text-left rounded-[10px] border-2 border-[--accent] bg-[--bg-app] p-4 cursor-pointer hover:bg-[--bg-hover] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
            onClick={handleNew}
          >
            <div className="text-[13px] font-medium text-[--text-primary] mb-1">New UI</div>
            <div className="text-[12px] text-[--text-muted] leading-relaxed">
              Clean sidebar, unified navigation, modern composer
            </div>
            <div className="mt-3 text-[11px] font-medium text-[--accent] uppercase tracking-wide">
              {classicAllowed ? 'Recommended' : 'Required by your organization'}
            </div>
          </button>

          {/* Classic preview card — hidden when the deployment policy disallows switching */}
          {classicAllowed && (
            <button
              type="button"
              className="text-left rounded-[10px] border border-[--border-subtle] bg-[--bg-app] p-4 cursor-pointer hover:bg-[--bg-hover] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
              onClick={handleClassic}
            >
              <div className="text-[13px] font-medium text-[--text-primary] mb-1">Classic UI</div>
              <div className="text-[12px] text-[--text-muted] leading-relaxed">
                Original interface with three-tab sidebar
              </div>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default UIPreferenceBanner;
