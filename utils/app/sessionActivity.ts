// Shared helpers for the inactivity sign-out (see app/components/SessionActivityTracker.tsx).
//
// The last-activity timestamp lives in localStorage so every tab of the app sees the same
// value. Signing out clears the shared session cookie and therefore logs out *all* tabs, so
// the decision to sign out must be based on activity in any tab, not just the current one.

export const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour
export const INACTIVITY_CHECK_INTERVAL_MS = 30 * 1000;
export const ACTIVITY_WRITE_THROTTLE_MS = 1000;
export const ACTIVITY_STORAGE_KEY = 'amplify:lastActivity';

// `scroll` does not bubble, so it is registered with capture to also see scrolling inside
// nested containers (chat panes, sidebars). `mousemove`/`wheel`/`pointerdown` cover reading
// and trackpad use that never produces a click or keypress.
export const ACTIVITY_EVENTS = [
  'pointerdown',
  'mousedown',
  'mousemove',
  'keydown',
  'wheel',
  'scroll',
  'touchstart',
] as const;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Returns the stored last-activity time (ms epoch), or null if missing/invalid/unavailable. */
export function readLastActivity(storage: StorageLike | null | undefined): number | null {
  try {
    const raw = storage?.getItem(ACTIVITY_STORAGE_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null; // storage can throw (privacy mode, disabled cookies)
  }
}

export function writeLastActivity(storage: StorageLike | null | undefined, timestamp: number): void {
  try {
    storage?.setItem(ACTIVITY_STORAGE_KEY, String(timestamp));
  } catch {
    // best effort; the in-memory value still protects this tab
  }
}

export function clearLastActivity(storage: StorageLike | null | undefined): void {
  try {
    storage?.removeItem(ACTIVITY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Most recent activity across this tab (in-memory) and any other tab (storage). */
export function latestActivity(inMemory: number, storage: StorageLike | null | undefined): number {
  return Math.max(inMemory, readLastActivity(storage) ?? 0);
}

export function isInactive(lastActivity: number, now: number, timeoutMs: number = INACTIVITY_TIMEOUT_MS): boolean {
  return now - lastActivity >= timeoutMs;
}
