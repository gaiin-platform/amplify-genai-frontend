// Enhanced localStorage with IndexedDB migration
// Drop-in replacement for localStorage with automatic migration

class IndexedStorage {
  private dbName = 'ChatUIStorage';
  private version = 1;
  private storeName = 'keyvalue';
  private db: IDBDatabase | null = null;
  private initialized = false;
  migrationKey = '__indexeddb_migration_status__';

  async init(): Promise<void> {
    if (this.initialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        this.db = request.result;
        this.initialized = true;
        resolve();
      };
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'key' });
        }
      };
    });
  }

  private async ensureInit(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      store.put({ key, value });

      // Resolve on tx.oncomplete (transaction committed to disk),
      // not request.onsuccess (request accepted but not yet committed).
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async getItem(key: string): Promise<string | null> {
    await this.ensureInit();
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([this.storeName], 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async keys(prefix: string): Promise<string[]> {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([this.storeName], 'readonly');
      const request = tx.objectStore(this.storeName).getAllKeys();
      request.onsuccess = () => {
        resolve((request.result as IDBValidKey[]).filter((k): k is string => typeof k === 'string' && k.startsWith(prefix)));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async removeItem(key: string): Promise<void> {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      store.delete(key);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  // Check if key has been migrated
  async isMigrated(key: string): Promise<boolean> {
    const migrationStatus = await this.getItem(this.migrationKey);
    if (!migrationStatus) return false;
    
    try {
      const migratedKeys = JSON.parse(migrationStatus);
      return migratedKeys.includes(key);
    } catch {
      return false;
    }
  }

  // Mark key as migrated — atomic read-modify-write in a single readwrite
  // transaction so concurrent calls cannot interleave and lose keys.
  async markMigrated(key: string): Promise<void> {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      const getReq = store.get(this.migrationKey);

      getReq.onsuccess = () => {
        let migratedKeys: string[] = [];
        if (getReq.result?.value) {
          try {
            migratedKeys = JSON.parse(getReq.result.value);
          } catch {
            migratedKeys = [];
          }
        }
        if (!migratedKeys.includes(key)) {
          migratedKeys.push(key);
          store.put({ key: this.migrationKey, value: JSON.stringify(migratedKeys) });
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  // Migrate single key from localStorage to IndexedDB.
  // Compare-and-set: a value that IndexedDB already holds is never replaced by the (older) localStorage
  // copy, unless a write that had to fall back to localStorage left a "newer" marker (see storageSet).
  async migrateKey(key: string): Promise<string | null> {
    const localValue = localStorage.getItem(key);
    if (localValue !== null) {
      const fallbackIsNewer = localStorage.getItem(LS_NEWER_PREFIX + key) !== null;
      const existing = await this.getItem(key);
      if (existing !== null && !fallbackIsNewer) {
        // IndexedDB wins; the localStorage copy is a stale leftover
        await this.markMigrated(key);
        localStorage.removeItem(key);
        return existing;
      }
      await this.setItem(key, localValue);
      await this.markMigrated(key);

      // Clean up localStorage after successful migration to save space
      localStorage.removeItem(key);
      localStorage.removeItem(LS_NEWER_PREFIX + key);
      console.log(`Migrated and cleaned up '${key}' from localStorage to IndexedDB`);
    }
    return localValue;
  }
}

// Set when an IndexedDB write failed and the value was written to localStorage instead: that copy is
// then the NEWER one, even though the key is flagged as migrated.
const LS_NEWER_PREFIX = '__ls_newer__:';

// Global instance
const indexedStorage = new IndexedStorage();

// Enhanced storage functions with automatic migration
const readThroughIndexedDb = async (key: string): Promise<string | null> => {
  // Check if already migrated to IndexedDB
  const isMigrated = await indexedStorage.isMigrated(key);

  if (isMigrated) {
    const localCopy = localStorage.getItem(key);
    if (localCopy !== null) {
      if (localStorage.getItem(LS_NEWER_PREFIX + key) !== null) {
        // an earlier IndexedDB write failed and landed here: this is the newest value, move it back
        try {
          await indexedStorage.setItem(key, localCopy);
          localStorage.removeItem(key);
          localStorage.removeItem(LS_NEWER_PREFIX + key);
        } catch {
          // IndexedDB still failing: keep serving the localStorage copy
        }
        return localCopy;
      }
      // Clean up stale localStorage data from previous sessions
      console.log(`Cleaning up stale localStorage data for '${key}'`);
      localStorage.removeItem(key);
    }
    return await indexedStorage.getItem(key);
  }
  console.log(`Migrating '${key}' from localStorage to IndexedDB`);
  return await indexedStorage.migrateKey(key);
};

export const storageGet = async (key: string): Promise<string | null> => {
  try {
    return await readThroughIndexedDb(key);
  } catch (error) {
    console.warn('IndexedDB error, falling back to localStorage:', error);
    // Fallback to localStorage if IndexedDB fails
    return localStorage.getItem(key);
  }
};

/**
 * Like storageGet, but a failing IndexedDB read is reported (throws) instead of looking like "no value".
 * Use it where "nothing stored" would make the caller overwrite real data (e.g. the conversation history).
 */
export const storageGetStrict = async (key: string): Promise<string | null> => {
  try {
    return await readThroughIndexedDb(key);
  } catch (error) {
    const fallback = localStorage.getItem(key);
    if (fallback !== null) return fallback;
    throw error;
  }
};

export const storageSet = async (key: string, value: string): Promise<void> => {
  try {
    await indexedStorage.setItem(key, value);
    await indexedStorage.markMigrated(key);
    // a successful IndexedDB write supersedes any earlier localStorage fallback copy
    localStorage.removeItem(LS_NEWER_PREFIX + key);
    if (localStorage.getItem(key) !== null) localStorage.removeItem(key);
  } catch (error) {
    console.warn('IndexedDB error, falling back to localStorage:', error);
    // Fallback to localStorage if IndexedDB fails. Throws (quota) if that fails as well, so callers can tell.
    localStorage.setItem(key, value);
    try { localStorage.setItem(LS_NEWER_PREFIX + key, '1'); } catch { /* best effort */ }
  }
};

// All stored keys starting with a prefix (IndexedDB plus, as a fallback, localStorage)
export const storageKeys = async (prefix: string): Promise<string[]> => {
  const fromLocal = () => Object.keys(localStorage).filter((k) => k.startsWith(prefix));
  try {
    const fromIndexed = await indexedStorage.keys(prefix);
    return Array.from(new Set([...fromIndexed, ...fromLocal()]));
  } catch (error) {
    console.warn('IndexedDB error, falling back to localStorage:', error);
    return fromLocal();
  }
};

export const storageRemove = async (key: string): Promise<void> => {
  try {
    await indexedStorage.removeItem(key);
    // Also remove from localStorage if it exists
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('IndexedDB error, falling back to localStorage:', error);
    // Fallback to localStorage if IndexedDB fails
    localStorage.removeItem(key);
  }
};

// Utility to migrate all existing localStorage data at once
export const migrateAllLocalStorageData = async (): Promise<void> => {
  try {
    const keys = Object.keys(localStorage);
    console.log(`Starting migration of ${keys.length} localStorage keys...`);
    
    for (const key of keys) {
      if (key !== indexedStorage.migrationKey) {
        await indexedStorage.migrateKey(key);
      }
    }
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Context-conversation cache helpers
// Stores lightweight {id, role, content} message arrays so we don't need to
// re-fetch cloud conversations every time the user opens the context panel.
// ─────────────────────────────────────────────────────────────────────────────

const CONTEXT_CACHE_PREFIX = 'contextCache:';
export const CONTEXT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Stripped-down message — just the text content we need for context injection */
export interface CachedConversationMessage {
    id: string;
    role: string;
    content: string;
}

export interface ContextCacheEntry {
    conversationId: string;
    conversationName: string;
    /** Bare-text messages: role + content only */
    messages: CachedConversationMessage[];
    fetchedAt: number; // epoch ms
}

export const saveContextCache = async (entry: ContextCacheEntry): Promise<void> => {
    await storageSet(`${CONTEXT_CACHE_PREFIX}${entry.conversationId}`, JSON.stringify(entry));
};

export const loadContextCache = async (conversationId: string): Promise<ContextCacheEntry | null> => {
    const raw = await storageGet(`${CONTEXT_CACHE_PREFIX}${conversationId}`);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as ContextCacheEntry;
    } catch {
        return null;
    }
};

export const isContextCacheValid = (entry: ContextCacheEntry): boolean => {
    return (Date.now() - entry.fetchedAt) < CONTEXT_CACHE_TTL_MS;
};

export const deleteContextCache = async (conversationId: string): Promise<void> => {
    await storageRemove(`${CONTEXT_CACHE_PREFIX}${conversationId}`);
};

// Check migration status
export const getMigrationStatus = async (): Promise<{ 
  totalKeys: number, 
  migratedKeys: number, 
  isComplete: boolean 
}> => {
  try {
    const localStorageKeys = Object.keys(localStorage);
    const migrationStatus = await indexedStorage.getItem(indexedStorage.migrationKey);
    
    let migratedKeys: string[] = [];

    if (migrationStatus) {
      try {
        migratedKeys = JSON.parse(migrationStatus);
      } catch {
        migratedKeys = [];
      }
    }
    
    return {
      totalKeys: localStorageKeys.length,
      migratedKeys: migratedKeys.length,
      isComplete: migratedKeys.length >= localStorageKeys.length
    };
  } catch {
    return { totalKeys: 0, migratedKeys: 0, isComplete: false };
  }
};