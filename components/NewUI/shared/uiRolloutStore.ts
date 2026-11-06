/**
 * uiRolloutStore — the single in-memory answer to "may this user see the New UI?".
 *
 * React-free so it is unit-testable. `UIPreferenceBanner` is the only writer: it
 * resolves the server verdict (or this user's cached one) and publishes it here.
 * Readers are `NewUiRolloutGate` (decides what home.tsx renders), the two account
 * menus (decide which switch to offer) and `setUIPreference` (refuses writes the
 * policy forbids). Nothing else may decide New-vs-Classic.
 *
 * `resolved` is false until the banner has applied a first verdict. Until then a
 * stored `'new'` is not trusted, so New UI never mounts ahead of the rollout answer.
 */

export type NewUiRollout = 'unknown' | 'enabled' | 'disabled';

export interface UiRolloutSnapshot {
  rollout: NewUiRollout;
  /** Whether switching back to Classic is permitted (deployment policy). */
  classicAllowed: boolean;
  /** True once the banner has applied a verdict (server, cache or fail-closed). */
  resolved: boolean;
}

const INITIAL: UiRolloutSnapshot = { rollout: 'unknown', classicAllowed: true, resolved: false };

let snapshot: UiRolloutSnapshot = INITIAL;
const listeners = new Set<() => void>();

export function getUiRolloutSnapshot(): UiRolloutSnapshot {
  return snapshot;
}

/** Identical snapshot on the server, so hydration never disagrees with the first client render. */
export function getServerUiRolloutSnapshot(): UiRolloutSnapshot {
  return INITIAL;
}

export function subscribeUiRollout(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function publish(next: UiRolloutSnapshot): void {
  if (
    next.rollout === snapshot.rollout &&
    next.classicAllowed === snapshot.classicAllowed &&
    next.resolved === snapshot.resolved
  ) {
    return;
  }
  snapshot = next;
  listeners.forEach((listener) => listener());
}

/** Publish a verdict. Safe to call repeatedly — a late response simply re-publishes. */
export function setUiRollout(rollout: 'enabled' | 'disabled', classicAllowed: boolean): void {
  publish({ rollout, classicAllowed, resolved: true });
}

/** Forget everything (new mount / new user), so no earlier verdict can leak across sessions. */
export function resetUiRollout(): void {
  publish(INITIAL);
}

/**
 * What home.tsx may render for a stored `uiPreference`.
 *   'pending' — a New UI choice exists but the rollout is not resolved yet: render nothing.
 *   'classic' — rollout disabled, or the user is not on New.
 */
export function computeEffectiveUi(
  state: UiRolloutSnapshot,
  uiPreference: 'new' | 'classic' | null,
): 'new' | 'classic' | 'pending' {
  if (state.resolved && state.rollout === 'disabled') return 'classic';
  if (uiPreference !== 'new') return 'classic';
  return state.resolved && state.rollout === 'enabled' ? 'new' : 'pending';
}

/**
 * May `pref` be persisted right now? `'new'` requires a resolved, enabled rollout;
 * `'classic'` is refused only when the deployment forbids it under an enabled rollout.
 */
export function canApplyUiPreference(state: UiRolloutSnapshot, pref: 'new' | 'classic'): boolean {
  if (pref === 'new') return state.resolved && state.rollout === 'enabled';
  return !(state.rollout === 'enabled' && !state.classicAllowed);
}
