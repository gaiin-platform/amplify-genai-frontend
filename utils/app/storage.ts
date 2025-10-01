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
      const request = store.put({ key, value });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
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

  async removeItem(key: string): Promise<void> {
    await this.ensureInit();
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete(key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
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

  // Mark key as migrated
  async markMigrated(key: string): Promise<void> {
    let migrationStatus = await this.getItem(this.migrationKey);
    let migratedKeys: string[] = [];
    
    if (migrationStatus) {
      try {
        migratedKeys = JSON.parse(migrationStatus);
      } catch {
        migratedKeys = [];
      }
    }
    
    if (!migratedKeys.includes(key)) {
      migratedKeys.push(key);
      await this.setItem(this.migrationKey, JSON.stringify(migratedKeys));
    }
  }

  // Migrate single key from localStorage to IndexedDB
  async migrateKey(key: string): Promise<string | null> {
    const localValue = localStorage.getItem(key);
    if (localValue !== null) {
      await this.setItem(key, localValue);
      await this.markMigrated(key);
      
      // Clean up localStorage after successful migration to save space
      localStorage.removeItem(key);
      console.log(`Migrated and cleaned up '${key}' from localStorage to IndexedDB`);
    }
    return localValue;
  }
}

// Global instance
const indexedStorage = new IndexedStorage();

// Enhanced storage functions with automatic migration
export const storageGet = async (key: string): Promise<string | null> => {
  try {
    // Check if already migrated to IndexedDB
    const isMigrated = await indexedStorage.isMigrated(key);
    
    if (isMigrated) {
      // Clean up any leftover localStorage data from previous sessions
      if (localStorage.getItem(key) !== null) {
        console.log(`Cleaning up stale localStorage data for '${key}'`);
        localStorage.removeItem(key);
      }
      
      return await indexedStorage.getItem(key);
    } else {
      console.log(`Migrating '${key}' from localStorage to IndexedDB`);
      return await indexedStorage.migrateKey(key);
    }
  } catch (error) {
    console.warn('IndexedDB error, falling back to localStorage:', error);
    // Fallback to localStorage if IndexedDB fails
    return localStorage.getItem(key);
  }
};

export const storageSet = async (key: string, value: string): Promise<void> => {
  try {
    await indexedStorage.setItem(key, value);
    await indexedStorage.markMigrated(key);
  } catch (error) {
    console.warn('IndexedDB error, falling back to localStorage:', error);
    // Fallback to localStorage if IndexedDB fails
    localStorage.setItem(key, value);
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