/**
 * The stored-UI-preference vocabulary: where the choice lives, how to read it,
 * how to write it same-device, and which of the two stores wins.
 *
 * React-free on purpose so the resolution rule is unit-testable — see
 * `__tests__/components/NewUI/uiPreferenceResolution.test.ts`. `UIPreferenceBanner`
 * re-exports the public names so existing importers (including `home.tsx`, which is
 * off-limits per NEW_UI_GUIDE §2) keep working unchanged.
 */

export const UI_PREF_KEY = 'amplify_new_ui_preference';
export type UIPreference = 'new' | 'classic' | null;

export function getUIPreference(): UIPreference {
  if (typeof window === 'undefined') return null;
  const val = localStorage.getItem(UI_PREF_KEY);
  if (val === 'new' || val === 'classic') return val;
  return null;
}

/**
 * Decide what to do with the two stores that can hold a choice.
 *
 * The server wins when both are set, matching `home.tsx#fetchSettings`, which
 * overwrites localStorage with the server value for cross-device roaming.
 * `'ask'` — and only `'ask'` — means the first-run popup is allowed to show.
 *
 * `server` is typed `unknown` on purpose: it comes straight off a network payload,
 * so a truthy-but-invalid value must not be mistaken for a real choice.
 */
export function resolveStoredUIPreference(
  local: UIPreference,
  server: unknown,
): 'new' | 'classic' | 'ask' {
  if (server === 'new' || server === 'classic') return server;
  if (local === 'new' || local === 'classic') return local;
  return 'ask';
}

/**
 * Same-device persistence only: localStorage + the load-balancer routing cookie.
 * Split out from `setUIPreference` so applying an *already stored* preference never
 * triggers a redundant save back to the server.
 */
export function writeLocalUIPreference(pref: 'new' | 'classic'): void {
  localStorage.setItem(UI_PREF_KEY, pref);

  if (pref === 'new') {
    document.cookie = 'X-Amplify-UI=new; path=/; SameSite=Lax; max-age=31536000';
  } else {
    document.cookie = 'X-Amplify-UI=; path=/; SameSite=Lax; max-age=0';
  }
}

/** Drop the same-device stores, so only the server value remains. */
export function clearLocalUIPreference(): void {
  localStorage.removeItem(UI_PREF_KEY);
  document.cookie = 'X-Amplify-UI=; path=/; SameSite=Lax; max-age=0';
}

/** Query param that forces the first-run flow: `?uiPreference=reset`. */
export const UI_PREF_QUERY_PARAM = 'uiPreference';

/**
 * Detect the reset escape hatch in a URL query string.
 *
 * Needed because once a choice is stored there is no way back to the popup — and
 * `'ask'` alone can't work: `home.tsx#fetchSettings` runs its own settings fetch on
 * every load and would set `uiPreference` from the still-stored server value, closing
 * the popup under the user. Reset therefore *erases* both stores and reloads, which
 * turns the next load into a genuine first run.
 */
export function readUIPreferenceOverride(search: string): 'reset' | null {
  if (!search) return null;
  const value = new URLSearchParams(search).get(UI_PREF_QUERY_PARAM);
  return value === 'reset' ? 'reset' : null;
}

/** The same URL with the reset param stripped, so the reload is a normal load. */
export function urlWithoutUIPreferenceParam(href: string): string {
  const url = new URL(href);
  url.searchParams.delete(UI_PREF_QUERY_PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
}
