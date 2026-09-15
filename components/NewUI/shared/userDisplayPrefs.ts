/**
 * userDisplayPrefs.ts — React-free module for the user's personal display
 * preferences, with server-side sync so they roam across devices/browsers:
 *
 *   - chat font            (`amplify_chat_font`)
 *   - conversation storage (`storageSelection`)
 *   - default model        (`amplify_user_default_model_id`)
 *   - default effort       (`amplify_user_default_effort`)
 *
 * All four ride along in the `settings` server object, following the precedent
 * set by `uiPreference` (see UIPreferenceBanner#setUIPreference), and are
 * mirrored into their dedicated localStorage keys so every existing consumer
 * (ConversationViewShell, ModelPicker, NewHome, ConversationComposer) keeps
 * working unchanged — they all read those keys lazily.
 *
 * ── The three constraints that shape this file ──────────────────────────────
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
 * 3. Model and effort have a "System default" affordance, i.e. an explicit
 *    *clear*. "Cleared" must roam, but must not be confused with "this server
 *    object predates the feature". Hence: `null` = explicitly cleared (roams
 *    and clears other devices), key ABSENT = no opinion (leaves devices alone).
 *
 * NO React imports — safe to call from effects, event handlers, and
 * non-component modules.
 */

import { saveUserSettings, fetchUserSettings } from '@/services/settingsService';
import { getUserDefaultModelId, setUserDefaultModelId } from './userDefaultModel';
import { getUserDefaultEffort, setUserDefaultEffort } from './userDefaultEffort';
import type { EffortLevel } from './ModelPicker';

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

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The prefs that roam. `null` on model/effort means "explicitly cleared, fall
 * back to the system default"; omitting a key means "don't touch it".
 */
export interface DisplayPrefs {
    chatFont?: 'serif' | 'sans';
    storageSelection?: string;
    userDefaultModelId?: string | null;
    userDefaultEffort?: EffortLevel | null;
}

const VALID_EFFORTS: EffortLevel[] = ['low', 'medium', 'high', 'off'];

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Read the raw settings blob from localStorage (includes server-synced extra fields). */
const readSettingsBlob = (): Record<string, unknown> => {
    if (typeof window === 'undefined') return {};
    try {
        const parsed = JSON.parse(localStorage.getItem(SETTINGS_BLOB_KEY) || '{}');
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
};

/**
 * Drop keys explicitly set to `undefined` so a caller passing an absent value
 * can never be mistaken for an intentional clear (which is `null`).
 */
const omitUndefined = (o: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

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
export const saveDisplayPrefsToServer = async (prefs: DisplayPrefs): Promise<boolean> => {
    const patch = omitUndefined(prefs as Record<string, unknown>);

    // Mirror locally first so the UI is correct even if the network call fails.
    try {
        localStorage.setItem(SETTINGS_BLOB_KEY, JSON.stringify({ ...readSettingsBlob(), ...patch }));
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

        const merged = withRequiredFields({ ...readSettingsBlob(), ...base, ...patch });
        const ok = await saveUserSettings(merged);
        if (!ok) {
            console.error('[userDisplayPrefs] Server rejected display prefs save:', patch);
        }
        return !!ok;
    } catch (e) {
        console.error('[userDisplayPrefs] Failed to save display prefs to server:', e);
        return false;
    }
};

// ─── Server → local sync ───────────────────────────────────────────────────────

/**
 * Read the server-synced display prefs out of the settings blob and apply them
 * to their dedicated localStorage keys.
 *
 * - `chatFont` fires `amplifyChatFontChanged` only when it actually changed, so
 *   ConversationViewShell doesn't churn.
 * - Model/effort are applied through their own setters, reusing their
 *   validation. A `null` clears them; an absent key leaves this device alone.
 * - `storageSelection` is returned rather than applied, because writing it has
 *   consequences the caller has to sequence (see UserPrefsSync).
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

    // ── Default model ──────────────────────────────────────────────────────
    // `null` = cleared on another device; absent = server has no opinion.
    if ('userDefaultModelId' in blob) {
        const v = blob.userDefaultModelId;
        if (v === null) {
            if (getUserDefaultModelId() !== null) setUserDefaultModelId(null);
        } else if (typeof v === 'string' && v.trim()) {
            if (getUserDefaultModelId() !== v.trim()) setUserDefaultModelId(v);
        }
    }

    // ── Default reasoning effort ───────────────────────────────────────────
    if ('userDefaultEffort' in blob) {
        const v = blob.userDefaultEffort;
        if (v === null) {
            if (getUserDefaultEffort() !== null) setUserDefaultEffort(null);
        } else if (typeof v === 'string' && VALID_EFFORTS.includes(v as EffortLevel)) {
            if (getUserDefaultEffort() !== v) setUserDefaultEffort(v as EffortLevel);
        }
    }

    // ── Storage selection ──────────────────────────────────────────────────
    if (typeof blob.storageSelection === 'string' && blob.storageSelection) {
        storageSelection = blob.storageSelection;
    }

    return { chatFont, storageSelection };
};

// ─── One-time backfill for users who set a preference before it roamed ────────

/**
 * Upload this device's locally-set prefs for any key the server has **no
 * opinion on**, so a user who chose a font/model/effort before this feature
 * existed doesn't have to re-pick it to make it roam.
 *
 * Deliberately conservative:
 *  - Decides from a FRESH server fetch, never the local blob: "absent" is only
 *    meaningful once the server has actually answered, and a failed fetch
 *    aborts rather than guesses.
 *  - Skips any key the server already holds (including an explicit `null`), so
 *    a stale device can never overwrite a newer choice made elsewhere.
 *  - Excludes `storageSelection` on purpose. That key may have been written by
 *    the admin-configured default rather than chosen by the user, and freezing
 *    an admin default as a *personal* preference would make future admin
 *    changes stop applying to them.
 *
 * Returns true when it actually saved something.
 */
export const backfillLocalDefaultsToServer = async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;

    let server: Record<string, unknown>;
    try {
        const result = await fetchUserSettings();
        if (!result?.success) return false;                     // can't tell — don't guess
        server = (result.data && typeof result.data === 'object')
            ? (result.data as Record<string, unknown>)
            : {};
    } catch {
        return false;
    }

    const patch: DisplayPrefs = {};

    if (!('chatFont' in server)) {
        const local = localStorage.getItem(CHAT_FONT_LS_KEY);
        if (local === 'serif' || local === 'sans') patch.chatFont = local;
    }
    if (!('userDefaultModelId' in server)) {
        const local = getUserDefaultModelId();
        if (local) patch.userDefaultModelId = local;
    }
    if (!('userDefaultEffort' in server)) {
        const local = getUserDefaultEffort();
        if (local) patch.userDefaultEffort = local;
    }

    if (Object.keys(patch).length === 0) return false;
    return await saveDisplayPrefsToServer(patch);
};
