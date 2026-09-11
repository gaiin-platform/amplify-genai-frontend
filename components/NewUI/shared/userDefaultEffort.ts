/**
 * userDefaultEffort — user-configurable personal default reasoning effort.
 *
 * When a user picks a default effort in Settings → General, that choice is stored
 * here (localStorage key `amplify_user_default_effort`).
 *
 * No React imports — call from ModelPicker, NewHome, or GeneralSection without
 * worrying about hook constraints.
 */

import type { EffortLevel } from './ModelPicker';

export const USER_DEFAULT_EFFORT_KEY = 'amplify_user_default_effort';

const VALID_EFFORTS: EffortLevel[] = ['low', 'medium', 'high', 'off'];

/** Returns the user's personally chosen default effort level, or null if not set. */
export function getUserDefaultEffort(): EffortLevel | null {
  try {
    const stored = localStorage.getItem(USER_DEFAULT_EFFORT_KEY) as EffortLevel | null;
    return stored && VALID_EFFORTS.includes(stored) ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Persists the user's personal default effort level.
 * Pass `null` to clear it and fall back to 'medium'.
 */
export function setUserDefaultEffort(effort: EffortLevel | null): void {
  try {
    if (effort && VALID_EFFORTS.includes(effort)) {
      localStorage.setItem(USER_DEFAULT_EFFORT_KEY, effort);
    } else {
      localStorage.removeItem(USER_DEFAULT_EFFORT_KEY);
    }
  } catch {
    // storage unavailable — silently ignore
  }
}
