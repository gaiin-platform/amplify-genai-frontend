/**
 * userThanksgivingEffects — per-user opt-outs for the seasonal Thanksgiving theme.
 *
 *   theme — the whole thing: turkeys, falling leaves, warm glow, and the gust
 *   gust  — just the leaf-gust send transition (only meaningful while theme is on)
 *
 * Both default ON. Stored in localStorage as 'off' when disabled — a cosmetic,
 * seasonal preference, so it is intentionally not synced to the server.
 * Mirrors userHalloweenEffects.
 *
 * No React imports — safe to call from NewHome or the settings modal.
 */

export type ThanksgivingPart = 'theme' | 'gust';

const KEYS: Record<ThanksgivingPart, string> = {
  theme: 'amplify_thanksgiving_effects',
  gust: 'amplify_thanksgiving_leaf_gust',
};

/** Fired on `window` after any stored preference changes, so mounted views update live. */
export const USER_THANKSGIVING_EFFECTS_CHANGED_EVENT = 'amplifyThanksgivingEffectsChanged';

export function getThanksgivingPartEnabled(part: ThanksgivingPart): boolean {
  try {
    return localStorage.getItem(KEYS[part]) !== 'off';
  } catch {
    return true;
  }
}

export function setThanksgivingPartEnabled(part: ThanksgivingPart, enabled: boolean): void {
  try {
    if (enabled) localStorage.removeItem(KEYS[part]);
    else localStorage.setItem(KEYS[part], 'off');
  } catch {
    // storage unavailable — silently ignore
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(USER_THANKSGIVING_EFFECTS_CHANGED_EVENT));
  }
}
