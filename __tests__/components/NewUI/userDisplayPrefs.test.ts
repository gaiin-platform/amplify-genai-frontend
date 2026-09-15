/**
 * Tests for the chat-font + conversation-storage display preferences.
 *
 * Two bugs these guard:
 *
 * 1. The chat font default lived in three places (the settings dropdown's
 *    useState, ConversationViewShell's data-body-face, and a CSS
 *    `:not([data-body-face="sans"])` fallback). Changing only the dropdown made
 *    Settings report "Inter" while the transcript still rendered Newsreader.
 *    getChatFont() is now the single resolver both call sites use.
 *
 * 2. The backend's save_settings_schema declares
 *    `required: ["theme", "featureOptions", "hiddenModelIds"]`, and
 *    `saveUserSettings` REPLACES the whole settings object rather than patching
 *    it. A naive `saveUserSettings({ chatFont })` is therefore rejected by
 *    validation and silently never persists — which broke precisely the
 *    brand-new-user case the feature exists for, because a fresh browser has no
 *    `settings` blob to merge those keys from.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/settingsService', () => ({
    fetchUserSettings: vi.fn(),
    saveUserSettings: vi.fn(),
}));

import { fetchUserSettings, saveUserSettings } from '@/services/settingsService';
import {
    getChatFont,
    saveDisplayPrefsToServer,
    applyServerPrefsToLocalStorage,
    DEFAULT_CHAT_FONT,
    DEFAULT_STORAGE_SELECTION,
    CHAT_FONT_LS_KEY,
} from '@/components/NewUI/shared/userDisplayPrefs';

// ── Browser globals (vitest runs this project in the 'node' environment) ──────
const store = new Map<string, string>();
const dispatched: string[] = [];

beforeEach(() => {
    store.clear();
    dispatched.length = 0;
    vi.mocked(fetchUserSettings).mockReset();
    vi.mocked(saveUserSettings).mockReset().mockResolvedValue(true);

    (globalThis as any).localStorage = {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => { store.set(k, String(v)); },
        removeItem: (k: string) => { store.delete(k); },
        clear: () => store.clear(),
    };
    (globalThis as any).window = {
        dispatchEvent: (e: Event) => { dispatched.push(e.type); return true; },
    };
});

const setBlob = (o: unknown) => store.set('settings', JSON.stringify(o));

/** The backend gate from save_settings_schema.py, restated as an assertion. */
const schemaAccepts = (s: any) =>
    !!s && typeof s === 'object' &&
    (s.theme === 'light' || s.theme === 'dark') &&
    !!s.featureOptions && typeof s.featureOptions === 'object' && !Array.isArray(s.featureOptions) &&
    Object.values(s.featureOptions).every((v) => typeof v === 'boolean') &&
    Array.isArray(s.hiddenModelIds) && s.hiddenModelIds.every((v: unknown) => typeof v === 'string');

// ─────────────────────────────────────────────────────────────────────────────

describe('getChatFont', () => {
    it('defaults to Inter/sans for a brand-new user — the requested default', () => {
        expect(getChatFont()).toBe('sans');
        expect(DEFAULT_CHAT_FONT).toBe('sans');
    });

    it('honours an explicit choice in the dedicated key', () => {
        store.set(CHAT_FONT_LS_KEY, 'serif');
        expect(getChatFont()).toBe('serif');
    });

    it('falls back to the server-synced blob on a fresh device, and promotes it', () => {
        setBlob({ chatFont: 'serif' });
        expect(getChatFont()).toBe('serif');
        // Promoted so later reads (and ConversationViewShell) skip the blob parse
        expect(store.get(CHAT_FONT_LS_KEY)).toBe('serif');
    });

    it('ignores junk in either store rather than treating it as a choice', () => {
        store.set(CHAT_FONT_LS_KEY, 'comic-sans');
        setBlob({ chatFont: 42 });
        expect(getChatFont()).toBe('sans');
    });

    it('survives a corrupt settings blob', () => {
        store.set('settings', '{not json');
        expect(getChatFont()).toBe('sans');
    });
});

describe('saveDisplayPrefsToServer', () => {
    it('sends a schema-valid payload from an EMPTY blob — the silent-drop bug', async () => {
        vi.mocked(fetchUserSettings).mockResolvedValue({ success: true, data: null } as any);

        const ok = await saveDisplayPrefsToServer({ chatFont: 'sans' });

        expect(ok).toBe(true);
        const sent = vi.mocked(saveUserSettings).mock.calls[0][0];
        expect(schemaAccepts(sent)).toBe(true);
        expect(sent.chatFont).toBe('sans');
    });

    it('preserves unrelated server fields instead of replacing them', async () => {
        vi.mocked(fetchUserSettings).mockResolvedValue({
            success: true,
            data: {
                theme: 'light',
                featureOptions: { includeArtifacts: true },
                hiddenModelIds: ['m1'],
                uiPreference: 'new',
            },
        } as any);

        await saveDisplayPrefsToServer({ storageSelection: 'future-cloud' });

        const sent = vi.mocked(saveUserSettings).mock.calls[0][0];
        expect(schemaAccepts(sent)).toBe(true);
        expect(sent.uiPreference).toBe('new');            // not clobbered
        expect(sent.featureOptions).toEqual({ includeArtifacts: true });
        expect(sent.hiddenModelIds).toEqual(['m1']);
        expect(sent.storageSelection).toBe('future-cloud');
    });

    it('lets the server object win over a stale local blob for untouched keys', async () => {
        setBlob({ theme: 'dark', featureOptions: {}, hiddenModelIds: [], hidden: 'stale' });
        vi.mocked(fetchUserSettings).mockResolvedValue({
            success: true,
            data: { theme: 'light', featureOptions: { a: true }, hiddenModelIds: ['fresh'] },
        } as any);

        await saveDisplayPrefsToServer({ chatFont: 'serif' });

        const sent = vi.mocked(saveUserSettings).mock.calls[0][0];
        expect(sent.hiddenModelIds).toEqual(['fresh']);
        expect(sent.theme).toBe('light');
    });

    it('still mirrors locally when the network fails, so the UI stays correct', async () => {
        vi.mocked(fetchUserSettings).mockRejectedValue(new Error('offline'));
        vi.mocked(saveUserSettings).mockRejectedValue(new Error('offline'));

        const ok = await saveDisplayPrefsToServer({ chatFont: 'serif' });

        expect(ok).toBe(false);                                  // reported, not thrown
        expect(JSON.parse(store.get('settings')!).chatFont).toBe('serif');
    });

    it('reports failure when the server rejects the save', async () => {
        vi.mocked(fetchUserSettings).mockResolvedValue({ success: true, data: null } as any);
        vi.mocked(saveUserSettings).mockResolvedValue(false as any);

        await expect(saveDisplayPrefsToServer({ chatFont: 'sans' })).resolves.toBe(false);
    });
});

describe('applyServerPrefsToLocalStorage', () => {
    it('applies a server font and notifies the transcript exactly once', () => {
        setBlob({ chatFont: 'serif' });

        expect(applyServerPrefsToLocalStorage().chatFont).toBe('serif');
        expect(store.get(CHAT_FONT_LS_KEY)).toBe('serif');
        expect(dispatched).toEqual(['amplifyChatFontChanged']);

        // Idempotent — no event churn when already in sync
        applyServerPrefsToLocalStorage();
        expect(dispatched).toEqual(['amplifyChatFontChanged']);
    });

    it('returns the server storage selection for the caller to apply', () => {
        setBlob({ storageSelection: 'local-only' });
        expect(applyServerPrefsToLocalStorage().storageSelection).toBe('local-only');
    });

    it('reports nothing when the server holds no display prefs', () => {
        setBlob({ theme: 'dark' });
        expect(applyServerPrefsToLocalStorage()).toEqual({ chatFont: null, storageSelection: null });
        expect(dispatched).toEqual([]);
    });
});

describe('system defaults', () => {
    it('stores new conversations in the cloud going forward', () => {
        expect(DEFAULT_STORAGE_SELECTION).toBe('future-cloud');
    });
});
