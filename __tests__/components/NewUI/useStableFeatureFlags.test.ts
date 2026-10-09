/**
 * Tests for the feature-flag resolution rule behind useStableFeatureFlags (UI-003).
 *
 * The bug this guards: state.featureFlags is `{}` from mount until /feature_flags
 * resolves — and stays `{}` for the whole session if that request fails — which made
 * the flag-gated sidebar rows (Workflows, Scheduled Tasks, Notebook) intermittently
 * vanish along with their preference toggles.
 *
 * UI-003b adds the startup race: home.tsx fires fetchFeatureFlags() and
 * fetchUserAppConfigs() concurrently, and the DEFAULT_SMART_MESSAGES branch of the
 * latter dispatches `{ ...featureFlagsRef.current, smartMessages: x }` as the whole
 * featureFlags state. Lose the race and that object is `{ smartMessages: false }` —
 * non-empty, but carrying none of the sidebar flags.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    resolveFeatureFlags,
    isFullFlagSet,
    readCachedFeatureFlags,
    FEATURE_FLAG_CACHE_KEY,
    FEATURE_FLAG_CACHE_OWNER_KEY,
} from '@/components/NewUI/shared/useStableFeatureFlags';
import { isNotebookFeatureEnabled } from '@/components/NewUI/shared/notebookFeatureFlag';

const cached = { createAssistantWorkflows: true, scheduledTasks: true, notebook: true };

describe('resolveFeatureFlags', () => {
    it('falls back to the cached set while the fetch is still in flight', () => {
        expect(resolveFeatureFlags({}, cached)).toEqual(cached);
    });

    it('falls back to the cached set when the fetch never lands (undefined/null state)', () => {
        expect(resolveFeatureFlags(undefined, cached)).toEqual(cached);
        expect(resolveFeatureFlags(null, cached)).toEqual(cached);
    });

    it('prefers server flags once they arrive, so an admin turning a flag off is honoured', () => {
        const server = { createAssistantWorkflows: false, scheduledTasks: true, notebook: true };
        expect(resolveFeatureFlags(server, cached)).toEqual(server);
    });

    it('does not resurrect a flag dropped from a full server response', () => {
        const server = { scheduledTasks: true, notebook: true };
        expect(resolveFeatureFlags(server, cached)).toEqual(server);
        expect(resolveFeatureFlags(server, cached).createAssistantWorkflows).toBeUndefined();
    });

    it('is empty on a genuine first visit with nothing cached', () => {
        expect(resolveFeatureFlags({}, {})).toEqual({});
    });

    // ── UI-003b: the startup race ────────────────────────────────────────────────
    it('keeps the sidebar flags when the smartMessages patch wins the startup race', () => {
        // This is the exact object home.tsx dispatches when user-app-configs resolves
        // before /feature_flags. Replacing the whole set with it is what made the rows
        // blink out mid-load.
        const patch = { smartMessages: false };
        expect(resolveFeatureFlags(patch, cached)).toEqual({ ...cached, smartMessages: false });
    });

    it('lets the patch update its own flag without touching the others', () => {
        const withSmart = { ...cached, smartMessages: false };
        expect(resolveFeatureFlags({ smartMessages: true }, withSmart).smartMessages).toBe(true);
        expect(resolveFeatureFlags({ smartMessages: true }, withSmart).scheduledTasks).toBe(true);
    });

    it('still yields only the patch when the race is lost on a first-ever visit', () => {
        expect(resolveFeatureFlags({ smartMessages: false }, {})).toEqual({ smartMessages: false });
    });

    it('takes the full set verbatim even though it also carries smartMessages', () => {
        const server = { ...cached, smartMessages: true };
        expect(resolveFeatureFlags(server, cached)).toEqual(server);
    });

    it('preserves the artifacts flag when the startup patch arrives first', () => {
        const full = { ...cached, artifacts: true };
        expect(resolveFeatureFlags({ smartMessages: false }, full)).toEqual({ ...full, smartMessages: false });
    });
});

describe('Notebook feature gate', () => {
    it('defaults to off when the flag is absent', () => {
        expect(isNotebookFeatureEnabled({})).toBe(false);
        expect(isNotebookFeatureEnabled(undefined)).toBe(false);
        expect(isNotebookFeatureEnabled(null)).toBe(false);
    });

    it('requires the flag to be the boolean true', () => {
        expect(isNotebookFeatureEnabled({ notebook: true })).toBe(true);
        expect(isNotebookFeatureEnabled({ notebook: false })).toBe(false);
        expect(isNotebookFeatureEnabled({ notebook: 1 as unknown as boolean })).toBe(false);
        expect(isNotebookFeatureEnabled({ notebook: 'true' as unknown as boolean })).toBe(false);
    });

    it('does not resurrect Notebook from a cache when a complete payload omits it', () => {
        const resolved = resolveFeatureFlags({ scheduledTasks: true }, cached);
        expect(isNotebookFeatureEnabled(resolved)).toBe(false);
    });

    it('stays off while the current flag payload is empty, even if the cache enabled it', () => {
        const resolved = resolveFeatureFlags({}, cached);
        expect(resolved.notebook).toBe(true);
        expect(isNotebookFeatureEnabled({})).toBe(false);
    });
});

describe('isFullFlagSet', () => {
    it('rejects empty and nullish sets', () => {
        expect(isFullFlagSet({})).toBe(false);
        expect(isFullFlagSet(undefined)).toBe(false);
        expect(isFullFlagSet(null)).toBe(false);
    });

    it('rejects a set made only of patch-dispatched keys', () => {
        expect(isFullFlagSet({ smartMessages: false })).toBe(false);
    });

    it('accepts anything carrying a non-patch flag', () => {
        expect(isFullFlagSet({ notebook: true })).toBe(true);
        expect(isFullFlagSet({ smartMessages: false, notebook: true })).toBe(true);
    });
});

describe('readCachedFeatureFlags', () => {
    // Tests run in the `node` environment (vitest.config.ts) and the repo has no jsdom,
    // so stand up just enough of the browser globals this function touches.
    beforeEach(() => {
        const store = new Map<string, string>();
        vi.stubGlobal('window', {});
        vi.stubGlobal('localStorage', {
            getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
            setItem: (k: string, v: string) => void store.set(k, v),
            removeItem: (k: string) => void store.delete(k),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('discards a cache poisoned with the startup patch by the pre-fix version', () => {
        localStorage.setItem(FEATURE_FLAG_CACHE_KEY, JSON.stringify({ smartMessages: false }));
        expect(readCachedFeatureFlags()).toEqual({});
    });

    it('returns a genuine cached set', () => {
        localStorage.setItem(FEATURE_FLAG_CACHE_KEY, JSON.stringify(cached));
        expect(readCachedFeatureFlags()).toEqual(cached);
    });

    it('scopes the cache to its owner when an identity is supplied', () => {
        localStorage.setItem(FEATURE_FLAG_CACHE_KEY, JSON.stringify(cached));
        localStorage.setItem(FEATURE_FLAG_CACHE_OWNER_KEY, 'a@x.com');
        expect(readCachedFeatureFlags('a@x.com')).toEqual(cached);
        expect(readCachedFeatureFlags('b@x.com')).toEqual({});
        expect(readCachedFeatureFlags(null)).toEqual({});
    });

    it('never uses an unowned (legacy) cache once identity is checked', () => {
        localStorage.setItem(FEATURE_FLAG_CACHE_KEY, JSON.stringify(cached));
        expect(readCachedFeatureFlags('a@x.com')).toEqual({});
    });

    it('survives absent and corrupt entries', () => {
        localStorage.removeItem(FEATURE_FLAG_CACHE_KEY);
        expect(readCachedFeatureFlags()).toEqual({});
        localStorage.setItem(FEATURE_FLAG_CACHE_KEY, 'not json');
        expect(readCachedFeatureFlags()).toEqual({});
        localStorage.setItem(FEATURE_FLAG_CACHE_KEY, JSON.stringify([1, 2]));
        expect(readCachedFeatureFlags()).toEqual({});
    });
});
