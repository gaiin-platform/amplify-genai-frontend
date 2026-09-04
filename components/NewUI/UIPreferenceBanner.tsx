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
 * The cookie is for future load-balancer routing:
 *   LB listener rule #3 on port 443 matches X-Amplify-UI=new
 *   and forwards to the new-UI target group.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { saveUserSettings, fetchUserSettings } from '@/services/settingsService';
import NewUILoadingStatus from '@/components/NewUI/shared/NewUILoadingStatus';
import {
  UI_PREF_KEY,
  clearLocalUIPreference,
  getUIPreference,
  readUIPreferenceOverride,
  resolveStoredUIPreference,
  urlWithoutUIPreferenceParam,
  writeLocalUIPreference,
  type UIPreference,
} from '@/components/NewUI/shared/uiPreferenceResolution';

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
  // 1 + 2. Sync storage (always succeeds locally)
  writeLocalUIPreference(pref);

  // 3. Server-side persistence (fire-and-forget)
  try {
    // Fetch current settings first so we don't overwrite other fields
    const result = await fetchUserSettings();
    const current = result?.success && result.data ? result.data : {};
    await saveUserSettings({ ...current, uiPreference: pref });
  } catch {
    // Non-fatal — localStorage already holds the value
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

  // home.tsx passes fresh inline arrows on every render, so these are read through a
  // ref. Listing them in the effect deps would restart the settings fetch each render.
  const callbacksRef = useRef({ onSelectNew, onSelectClassic });
  callbacksRef.current = { onSelectNew, onSelectClassic };

  const dialogRef = useRef<HTMLDivElement>(null);
  const newCardRef = useRef<HTMLButtonElement>(null);

  // A *layout* effect, so the localStorage branch below flips home.tsx's state before
  // the browser paints — otherwise that one pre-resolution paint is a visible frame of
  // the classic layout (NEW_UI_GUIDE §21 uses the same reasoning for scroll restore).
  useLayoutEffect(() => {
    // Per-effect flags, declared in the effect body so a StrictMode remount re-arms
    // them rather than latching the unmounted value forever (NEW_UI_GUIDE §16).
    let cancelled = false;
    let settled = false;
    let timer = 0;

    const decide = (resolution: 'new' | 'classic' | 'ask') => {
      if (cancelled || settled) return;
      settled = true;
      window.clearTimeout(timer);

      if (resolution === 'ask') {
        setPhase('ask');
        return;
      }
      // A stored choice exists — honour it silently instead of asking again.
      writeLocalUIPreference(resolution);
      if (resolution === 'new') callbacksRef.current.onSelectNew();
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
    if (local) {
      decide(local);
      return;
    }

    // Ask anyway if the server never answers.
    timer = window.setTimeout(() => decide('ask'), PREF_RESOLVE_TIMEOUT_MS);

    (async () => {
      let server: unknown = null;
      try {
        const result = await fetchUserSettings();
        if (result?.success && result.data) {
          server = (result.data as { uiPreference?: unknown }).uiPreference;
        }
      } catch {
        // Offline or failed — fall through and ask, same as "nothing stored".
      }
      decide(resolveStoredUIPreference(getUIPreference(), server));
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
    setPhase('done');
    if (pref === 'new') onSelectNew();
    else onSelectClassic();
    // Fire-and-forget — don't await so the UI switches immediately
    setUIPreference(pref).catch(() => {});
  };

  // Still resolving: cover the app. `uiPreference === null` makes home.tsx render the
  // classic layout, so returning null here is what let the old UI paint for the length
  // of a settings round trip before being swapped out. The cover is opaque (not the
  // translucent scrim NewUILoadingStatus paints on its own) precisely because the point
  // is to hide what is behind it. Bounded by PREF_RESOLVE_TIMEOUT_MS.
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
        <div className="grid grid-cols-2 gap-3">
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
              Recommended
            </div>
          </button>

          {/* Classic preview card */}
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
        </div>

      </div>
    </div>
  );
};

export default UIPreferenceBanner;
