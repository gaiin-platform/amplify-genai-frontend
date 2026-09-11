/**
 * customInstructions.ts — React-free store for custom instructions.
 *
 * Storage key: amplify_custom_instructions_v2 (JSON)
 * Migration: if the old plain-string key amplify_custom_instructions exists, it
 * is auto-migrated to a new instruction named "My Instructions" on first load.
 */

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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read the store from localStorage.  Migrates the old plain-string key on
 * first call if it has a non-empty value.
 */
export const loadStore = (): CustomInstructionsStore => {
  if (typeof window === 'undefined') return emptyStore();

  const raw = localStorage.getItem(STORE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as CustomInstructionsStore;
      if (parsed && Array.isArray(parsed.instructions)) {
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

/** Persist the store to localStorage. */
export const saveStore = (store: CustomInstructionsStore): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
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
  return updated;
};

/** Set the active instruction by id (or null for none). */
export const setActiveInstruction = (id: string | null): CustomInstructionsStore => {
  const store = loadStore();
  const updated: CustomInstructionsStore = { ...store, activeId: id };
  saveStore(updated);
  return updated;
};
