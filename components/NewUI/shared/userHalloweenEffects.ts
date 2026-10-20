/**
 * userHalloweenEffects — per-user opt-outs for the seasonal Halloween theme.
 *
 *   theme  — the whole thing: home-page decorations, spooky greeting, and the swarm
 *   swarm  — just the bat-swarm send transition (only meaningful while theme is on)
 *
 * Both default ON. Stored in localStorage as 'off' when disabled — a cosmetic,
 * seasonal preference, so it is intentionally not synced to the server.
 *
 * No React imports — safe to call from NewHome or the settings modal.
 */

export type HalloweenPart = 'theme' | 'swarm';

const KEYS: Record<HalloweenPart, string> = {
  theme: 'amplify_halloween_effects',
  swarm: 'amplify_halloween_bat_swarm',
};

/** Fired on `window` after any stored preference changes, so mounted views update live. */
export const USER_HALLOWEEN_EFFECTS_CHANGED_EVENT = 'amplifyHalloweenEffectsChanged';

export function getHalloweenPartEnabled(part: HalloweenPart): boolean {
  try {
    return localStorage.getItem(KEYS[part]) !== 'off';
  } catch {
    return true;
  }
}

export function setHalloweenPartEnabled(part: HalloweenPart, enabled: boolean): void {
  try {
    if (enabled) localStorage.removeItem(KEYS[part]);
    else localStorage.setItem(KEYS[part], 'off');
  } catch {
    // storage unavailable — silently ignore
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(USER_HALLOWEEN_EFFECTS_CHANGED_EVENT));
  }
}
