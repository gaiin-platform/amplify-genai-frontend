/**
 * userDisplayPrefs.ts — React-free module for user display preferences
 * (chat font + conversation storage) with server-side sync.
 *
 * These prefs ride along in the `settings` server object so they roam across
 * devices/browsers, following the precedent set by `uiPreference`
 * (see UIPreferenceBanner#setUIPreference). They are also mirrored into their
 * dedicated localStorage keys so existing consumers keep working unchanged.
 *
 * ── The two constraints that shape this file ────────────────────────────────
 *
 * 1. The backend schema (`save_settings_schema.py`) declares
 *    `required: ["theme", "featureOptions", "hiddenModelIds"]`. A POST missing
 *    any of the three is REJECTED by validation, so a naive
 *    `saveUserSettings({ chatFont })` silently never persists. Every save from
 *    here must therefore carry those three keys.
 *
 * 2. `saveUserSettings` REPLACES the whole settings object — it is not a patch.
 *    So we must merge onto the freshest full object we can get, and the
 *    freshest source is the server itself (localStorage may be thin on a new
 *    device, or stale). Same order as UIPreferenceBanner#setUIPreference.
 *
 * NO React imports — safe to call from effects, event handlers, and
 * non-component modules.
 */

import { saveUserSettings, fetchUserSettings } from '@/services/settingsService';

// ─── Storage keys ─────────────────────────────────────────────────────────────
/** Dedicated localStorage key read by ConversationViewShell + the settings modal */
export const CHAT_FONT_LS_KEY = 'amplify_chat_font';
/** Dedicated localStorage key written by saveStorageSettings (conversationStorage.ts) */
export const STORAGE_SELECTION_LS_KEY = 'storageSelection';
/** The main settings blob in localStorage (populated by fetchSettings → saveSettings) */
const SETTINGS_BLOB_KEY = 'settings';

// ─── System defaults (applied to brand-new users with no saved preference) ────
/** Default chat font — Inter (sans) */
export const DEFAULT_CHAT_FONT: 'serif' | 'sans' = 'sans';
/** Default conversation storage — new conversations go to the cloud */
export const DEFAULT_STORAGE_SELECTION = 'future-cloud' as const;

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Read the raw settings blob from localStorage (includes server-synced extra fields). */
const readSettingsBlob = (): Record<string, unknown> => {
    if (typeof window === 'undefined') return {};
    try {
        const parsed = JSON.parse(localStorage.getItem(SETTINGS_BLOB_KEY) || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
};

/**
 * Guarantee the three server-required keys exist, without inventing values that
 * would clobber real ones. Only fills a key that is genuinely absent/malformed.
 */
const withRequiredFields = (o: Record<string, unknown>): Record<string, unknown> => {
    const out = { ...o };
    if (out.theme !== 'light' && out.theme !== 'dark') {
        // Mirror whatever the app is currently showing rather than guessing.
        const lm = typeof window !== 'undefined' ? localStorage.getItem('lightMode') : null;
        out.theme = lm === 'light' ? 'light' : 'dark';
    }
    // Schema: object with boolean values. `{}` is valid and getSettings() re-adds
    // the flag defaults on read, so an empty object is safe when none exist.
    if (!out.featureOptions || typeof out.featureOptions !== 'object' || Array.isArray(out.featureOptions)) {
        out.featureOptions = {};
    }
    if (!Array.isArray(out.hiddenModelIds)) {
        out.hiddenModelIds = [];
    }
    return out;
};

// ─── Chat font ─────────────────────────────────────────────────────────────────

/**
 * Get the current chat font.
 *
 * Resolution order:
 *  1. Dedicated `amplify_chat_font` key (set by the settings modal / server sync)
 *  2. `chatFont` field in the settings blob (server-synced)
 *  3. DEFAULT_CHAT_FONT ('sans' / Inter)
 */
export const getChatFont = (): 'serif' | 'sans' => {
    if (typeof window === 'undefined') return DEFAULT_CHAT_FONT;

    const dedicated = localStorage.getItem(CHAT_FONT_LS_KEY);
    if (dedicated === 'serif' || dedicated === 'sans') return dedicated;

    // Fall back to the server-synced settings blob
    const blob = readSettingsBlob();
    if (blob.chatFont === 'serif' || blob.chatFont === 'sans') {
        // Promote to the dedicated key so future reads skip the blob parse
        localStorage.setItem(CHAT_FONT_LS_KEY, blob.chatFont);
        return blob.chatFont;
    }

    return DEFAULT_CHAT_FONT;
};

// ─── Server sync ───────────────────────────────────────────────────────────────

/**
 * Merge the given display prefs into the user's server settings and save.
 *
 * Order (matches UIPreferenceBanner#setUIPreference):
 *   server settings  ←  local blob  ←  the prefs being set
 * The server object wins over the local blob for keys we are not touching, so a
 * stale/thin local snapshot cannot silently erase server-side fields.
 *
 * Never throws — returns false on failure so callers can stay fire-and-forget.
 */
export const saveDisplayPrefsToServer = async (prefs: {
    chatFont?: 'serif' | 'sans';
    storageSelection?: string;
}): Promise<boolean> => {
    // Mirror locally first so the UI is correct even if the network call fails.
    try {
        const localMerged = { ...readSettingsBlob(), ...prefs };
        localStorage.setItem(SETTINGS_BLOB_KEY, JSON.stringify(localMerged));
    } catch (e) {
        console.error('[userDisplayPrefs] Failed to mirror display prefs locally:', e);
    }

    try {
        // Freshest full object available; falls back to the local blob offline.
        let base: Record<string, unknown> = {};
        try {
            const result = await fetchUserSettings();
            if (result?.success && result.data && typeof result.data === 'object') {
                base = result.data as Record<string, unknown>;
            }
        } catch {
            // Non-fatal — fall through to the local blob.
        }

        const merged = withRequiredFields({ ...readSettingsBlob(), ...base, ...prefs });
        const ok = await saveUserSettings(merged);
        if (!ok) {
            console.error('[userDisplayPrefs] Server rejected display prefs save:', prefs);
        }
        return !!ok;
    } catch (e) {
        console.error('[userDisplayPrefs] Failed to save display prefs to server:', e);
        return false;
    }
};

// ─── Server → local sync ───────────────────────────────────────────────────────

/**
 * Read the server-synced display prefs out of the settings blob and apply the
 * chat font to its dedicated key.
 *
 * - Promotes `chatFont` to CHAT_FONT_LS_KEY and fires `amplifyChatFontChanged`
 *   only when the value actually changed (so listeners don't churn).
 * - Returns the raw server-side values so the caller can decide how to apply
 *   `storageSelection`, which has side effects the font does not.
 */
export const applyServerPrefsToLocalStorage = (): {
    chatFont: 'serif' | 'sans' | null;
    storageSelection: string | null;
} => {
    if (typeof window === 'undefined') return { chatFont: null, storageSelection: null };

    const blob = readSettingsBlob();
    let chatFont: 'serif' | 'sans' | null = null;
    let storageSelection: string | null = null;

    // ── Chat font ──────────────────────────────────────────────────────────
    if (blob.chatFont === 'serif' || blob.chatFont === 'sans') {
        if (localStorage.getItem(CHAT_FONT_LS_KEY) !== blob.chatFont) {
            localStorage.setItem(CHAT_FONT_LS_KEY, blob.chatFont);
            window.dispatchEvent(new Event('amplifyChatFontChanged'));
        }
        chatFont = blob.chatFont;
    }

    // ── Storage selection ──────────────────────────────────────────────────
    if (typeof blob.storageSelection === 'string' && blob.storageSelection) {
        storageSelection = blob.storageSelection;
    }

    return { chatFont, storageSelection };
};
