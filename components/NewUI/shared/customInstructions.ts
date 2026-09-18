/**
 * customInstructions.ts — React-free store for custom instructions.
 *
 * Storage key: amplify_custom_instructions_v2 (JSON)
 * Migration: if the old plain-string key amplify_custom_instructions exists, it
 * is auto-migrated to a new instruction named "My Instructions" on first load.
 *
 * Persistence:
 *   - Primary:  localStorage key `amplify_custom_instructions_v2`
 *   - Backup:   server settings blob under key `customInstructionsStore`
 *   - Hot path: module-level in-memory cache (`memCache`) ensures the freshest
 *               value is always available within a session, even if localStorage
 *               fails or the settings blob hasn't been read yet.
 *
 * Server sync:
 *   - Every mutation fires `saveCustomInstructionsToServer` (fire-and-forget).
 *   - On startup, `applyServerCustomInstructions` (called by UserPrefsSync)
 *     reads the `customInstructionsStore` field from the settings blob that
 *     `home.tsx#fetchSettings` already cached in localStorage, and applies it
 *     to the dedicated key so a cleared localStorage is automatically restored.
 */

import { saveUserSettings, fetchUserSettings } from '@/services/settingsService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CustomInstruction {
  id: string;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface CustomInstructionsStore {
  instructions: CustomInstruction[];
  activeId: string | null;
}

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const STORE_KEY = 'amplify_custom_instructions_v2';
const LEGACY_KEY = 'amplify_custom_instructions';
/** Key within the server settings blob where the store is mirrored. */
const SERVER_FIELD = 'customInstructionsStore';
/** The `settings` localStorage key that home.tsx#fetchSettings populates. */
const SETTINGS_BLOB_KEY = 'settings';

// ---------------------------------------------------------------------------
// Module-level in-memory cache
// ---------------------------------------------------------------------------

/**
 * Hot-path cache: always holds the most recently written store for the current
 * session.  Avoids localStorage parse overhead and prevents stale reads if the
 * browser ever defers a write.  Reset to null on module cold-start only; never
 * cleared between mutations.
 */
let memCache: CustomInstructionsStore | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const emptyStore = (): CustomInstructionsStore => ({
  instructions: [],
  activeId: null,
});

const newId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

/** Read the raw settings blob from localStorage (populated by fetchSettings). */
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
 * Guarantee the three server-required keys exist so the schema validator
 * never rejects the save (mirrors `userDisplayPrefs#withRequiredFields`).
 */
const withRequiredFields = (o: Record<string, unknown>): Record<string, unknown> => {
  const out = { ...o };
  if (out.theme !== 'light' && out.theme !== 'dark') {
    const lm = typeof window !== 'undefined' ? localStorage.getItem('lightMode') : null;
    out.theme = lm === 'light' ? 'light' : 'dark';
  }
  if (!out.featureOptions || typeof out.featureOptions !== 'object' || Array.isArray(out.featureOptions)) {
    out.featureOptions = {};
  }
  if (!Array.isArray(out.hiddenModelIds)) {
    out.hiddenModelIds = [];
  }
  return out;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read the store from localStorage (or the in-memory cache).
 * Migrates the old plain-string key on first call if it has a non-empty value.
 */
export const loadStore = (): CustomInstructionsStore => {
  // Hot-path: return the in-memory cache if it has been seeded this session
  if (memCache !== null) return memCache;

  if (typeof window === 'undefined') return emptyStore();

  const raw = localStorage.getItem(STORE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as CustomInstructionsStore;
      if (parsed && Array.isArray(parsed.instructions)) {
        memCache = parsed;
        return parsed;
      }
    } catch {
      // fall through to empty store
    }
  }

  // Migration: promote old single-string value
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy && legacy.trim()) {
    const now = Date.now();
    const migrated: CustomInstruction = {
      id: newId(),
      name: 'My Instructions',
      content: legacy.trim(),
      createdAt: now,
      updatedAt: now,
    };
    const store: CustomInstructionsStore = {
      instructions: [migrated],
      activeId: migrated.id,
    };
    saveStore(store);
    localStorage.removeItem(LEGACY_KEY);
    return store;
  }

  return emptyStore();
};

/** Persist the store to localStorage and update the in-memory cache. */
export const saveStore = (store: CustomInstructionsStore): void => {
  // Always update the in-memory cache so subsequent reads are instant
  memCache = store;

  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch (e) {
    // localStorage can throw (e.g. quota exceeded, Safari private mode).
    // The in-memory cache still holds the value for the current session.
    console.error('[customInstructions] localStorage save failed:', e);
  }
};

/** Returns the content of the currently active instruction, or null if none. */
export const getActiveInstructionContent = (): string | null => {
  const store = loadStore();
  if (!store.activeId) return null;
  const active = store.instructions.find((i) => i.id === store.activeId);
  return active?.content ?? null;
};

/**
 * Returns `basePrompt` with the active custom instruction appended, or
 * `basePrompt` unchanged when no instruction is active.
 */
export const buildPromptWithInstruction = (basePrompt: string): string => {
  const content = getActiveInstructionContent();
  if (!content) return basePrompt;
  return `${basePrompt}\n\n---\n\n## Custom Instructions:\n${content}`;
};

/** Create a new instruction (not yet active). Returns the new store. */
export const createInstruction = (
  name: string,
  content: string,
  activateOnCreate = true,
): CustomInstructionsStore => {
  const store = loadStore();
  const now = Date.now();
  const instruction: CustomInstruction = {
    id: newId(),
    name: name.trim(),
    content,
    createdAt: now,
    updatedAt: now,
  };
  const updated: CustomInstructionsStore = {
    instructions: [...store.instructions, instruction],
    activeId: activateOnCreate ? instruction.id : store.activeId,
  };
  saveStore(updated);
  void saveCustomInstructionsToServer(updated).catch(() => {});
  return updated;
};

/** Update an existing instruction by id. Returns the new store. */
export const updateInstruction = (
  id: string,
  patch: { name?: string; content?: string },
): CustomInstructionsStore => {
  const store = loadStore();
  const updated: CustomInstructionsStore = {
    ...store,
    instructions: store.instructions.map((i) =>
      i.id === id
        ? { ...i, ...patch, updatedAt: Date.now() }
        : i,
    ),
  };
  saveStore(updated);
  void saveCustomInstructionsToServer(updated).catch(() => {});
  return updated;
};

/** Delete an instruction by id. Clears activeId if it was the active one. */
export const deleteInstruction = (id: string): CustomInstructionsStore => {
  const store = loadStore();
  const updated: CustomInstructionsStore = {
    instructions: store.instructions.filter((i) => i.id !== id),
    activeId: store.activeId === id ? null : store.activeId,
  };
  saveStore(updated);
  void saveCustomInstructionsToServer(updated).catch(() => {});
  return updated;
};

/** Set the active instruction by id (or null for none). */
export const setActiveInstruction = (id: string | null): CustomInstructionsStore => {
  const store = loadStore();
  const updated: CustomInstructionsStore = { ...store, activeId: id };
  saveStore(updated);
  void saveCustomInstructionsToServer(updated).catch(() => {});
  return updated;
};

// ---------------------------------------------------------------------------
// Server sync
// ---------------------------------------------------------------------------

/**
 * Save the store to the user's server settings blob so it roams across devices
 * and survives localStorage being cleared.
 *
 * Mirrors the approach in `userDisplayPrefs#saveDisplayPrefsToServer`:
 *   1. Write locally first (so the UI is correct even if the network call fails).
 *   2. Fetch the freshest server object, merge, and save.
 *
 * Never throws — returns false on failure so callers can stay fire-and-forget.
 */
export const saveCustomInstructionsToServer = async (
  store: CustomInstructionsStore,
): Promise<boolean> => {
  // 1. Mirror to the settings blob locally first
  try {
    const blob = readSettingsBlob();
    localStorage.setItem(
      SETTINGS_BLOB_KEY,
      JSON.stringify({ ...blob, [SERVER_FIELD]: store }),
    );
  } catch (e) {
    console.error('[customInstructions] Failed to mirror to settings blob:', e);
  }

  // 2. Fetch → merge → save
  try {
    let base: Record<string, unknown> = {};
    try {
      const result = await fetchUserSettings();
      if (result?.success && result.data && typeof result.data === 'object') {
        base = result.data as Record<string, unknown>;
      }
    } catch {
      // Non-fatal — fall through to the local blob
    }

    const merged = withRequiredFields({
      ...readSettingsBlob(),
      ...base,
      [SERVER_FIELD]: store,
    });
    const ok = await saveUserSettings(merged);
    if (!ok) {
      console.error('[customInstructions] Server rejected save');
    }
    return !!ok;
  } catch (e) {
    console.error('[customInstructions] Server save failed:', e);
    return false;
  }
};

/**
 * Read the store from the server settings blob (already cached in localStorage
 * by `home.tsx#fetchSettings`) and apply it to the dedicated key and in-memory
 * cache.
 *
 * Call this from UserPrefsSync on startup and on every `updateFeatureSettings`
 * event (i.e. whenever fetchSettings lands).  Idempotent — only writes if the
 * server value actually differs from the local one, so existing local-only data
 * is never silently overwritten by a stale or empty server blob.
 *
 * No-ops when the server has no `customInstructionsStore` field (new user or
 * not yet synced) so local-only instructions are left untouched.
 */
export const applyServerCustomInstructions = (): void => {
  if (typeof window === 'undefined') return;

  const blob = readSettingsBlob();
  if (!(SERVER_FIELD in blob)) return;

  const serverStore = blob[SERVER_FIELD] as CustomInstructionsStore;
  if (!serverStore || !Array.isArray(serverStore.instructions)) return;

  // Compare with current local state to avoid unnecessary writes
  const local = loadStore();
  if (JSON.stringify(local) === JSON.stringify(serverStore)) return;

  // Server value wins — apply to localStorage and in-memory cache
  saveStore(serverStore);
};
