/**
 * userWebSearch — the user's personal "allow web search" preference.
 *
 * Web search is ON by default for everyone. A user who handles Level 3 data
 * must be able to turn it off (Settings → General), and that choice must stick
 * and roam: it is mirrored into the server `settings` object by
 * `userDisplayPrefs#saveDisplayPrefsToServer` as `webSearchEnabled: boolean`.
 *
 * Resolution (same shape as `getChatFont`): dedicated localStorage key →
 * server-synced settings blob → ON. Reading the blob as a fallback matters
 * here: a device that has not yet applied the server value must still honour a
 * "off" the user set elsewhere on its very first send.
 *
 * Only the user's own choice lives here. Deployment availability
 * (`deploymentFeatures.availability.webSearch`) and the backend router still
 * decide whether web search is *possible*; this can only veto it.
 *
 * No React imports.
 */

export const USER_WEB_SEARCH_KEY = 'amplify_user_web_search_enabled';
export const DEFAULT_WEB_SEARCH_ENABLED = true;

const SETTINGS_BLOB_KEY = 'settings';

/** True unless the user has explicitly turned web search off. */
export function getUserWebSearchEnabled(): boolean {
  if (typeof window === 'undefined') return DEFAULT_WEB_SEARCH_ENABLED;
  try {
    const stored = localStorage.getItem(USER_WEB_SEARCH_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
    const blob = JSON.parse(localStorage.getItem(SETTINGS_BLOB_KEY) || '{}');
    if (typeof blob?.webSearchEnabled === 'boolean') return blob.webSearchEnabled;
  } catch {
    // storage unavailable / malformed blob — fall through to the default
  }
  return DEFAULT_WEB_SEARCH_ENABLED;
}

/** The explicit local choice, or null when the user has never made one. */
export function getStoredUserWebSearchChoice(): boolean | null {
  try {
    const stored = localStorage.getItem(USER_WEB_SEARCH_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  } catch {
    // ignore
  }
  return null;
}

export function setUserWebSearchEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(USER_WEB_SEARCH_KEY, enabled ? 'true' : 'false');
  } catch {
    // storage unavailable — silently ignore
  }
}

/** Shown beside the Settings toggle. */
export const WEB_SEARCH_LEVEL3_INFO =
  'Web search can send parts of your request to an external search provider. ' +
  'If you are working with Level 3 data, turn web search off here in Settings before sending it. ' +
  'It is on by default, and your choice is saved to your account.';
