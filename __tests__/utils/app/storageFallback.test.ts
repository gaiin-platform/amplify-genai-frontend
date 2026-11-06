import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── minimal in-memory IndexedDB (just what utils/app/storage.ts uses) ──────────────────────────────
const idb = vi.hoisted(() => ({ data: new Map<string, any>(), failWrites: false, failAll: false }));

class FakeLocalStorage {
  private m = new Map<string, string>();
  quotaFull = false;
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { if (this.quotaFull) throw new Error('QuotaExceededError'); this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  keys() { return Array.from(this.m.keys()); }
}

const fakeIndexedDB = () => {
  const makeRequest = (run: () => any, tx?: any) => {
    const req: any = {};
    queueMicrotask(() => {
      try { req.result = run(); req.onsuccess?.(); } catch (e) { req.error = e; req.onerror?.(); }
      setTimeout(() => tx?.oncomplete?.(), 0);
    });
    return req;
  };
  const db = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => undefined,
    transaction: (_names: string[], mode: string) => {
      const tx: any = {};
      const store = {
        put: (row: any) => {
          if (mode === 'readwrite' && (idb.failWrites || idb.failAll)) {
            queueMicrotask(() => { tx.error = new Error('write failed'); tx.onabort?.(); });
            return {};
          }
          return makeRequest(() => { idb.data.set(row.key, row); }, tx);
        },
        get: (k: string) => makeRequest(() => { if (idb.failAll) throw new Error('read failed'); return idb.data.get(k); }, tx),
        delete: (k: string) => makeRequest(() => { idb.data.delete(k); }, tx),
        getAllKeys: () => makeRequest(() => Array.from(idb.data.keys()), tx),
      };
      tx.objectStore = () => store;
      return tx;
    },
  };
  return {
    open: () => {
      const req: any = {};
      queueMicrotask(() => {
        if (idb.failAll) { req.error = new Error('IndexedDB unavailable'); req.onerror?.(); return; }
        req.result = db; req.onupgradeneeded?.(); req.onsuccess?.();
      });
      return req;
    },
  };
};

type Storage = typeof import('@/utils/app/storage');
let storage: Storage;
let ls: FakeLocalStorage;

describe('storage with an IndexedDB that sometimes fails', () => {
  beforeEach(async () => {
    vi.resetModules();
    idb.data.clear(); idb.failWrites = false; idb.failAll = false;
    ls = new FakeLocalStorage();
    vi.stubGlobal('localStorage', ls);
    vi.stubGlobal('indexedDB', fakeIndexedDB());
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    storage = await import('@/utils/app/storage');
  });

  it('stores and reads a value through IndexedDB', async () => {
    await storage.storageSet('k', 'v1');
    expect(await storage.storageGet('k')).toBe('v1');
    expect(ls.getItem('k')).toBeNull();
  });

  it('serves the NEWER localStorage copy after an IndexedDB write failed (it used to return the stale IndexedDB value and delete the new one)', async () => {
    await storage.storageSet('k', 'old');
    idb.failWrites = true;
    await storage.storageSet('k', 'new'); // falls back to localStorage
    idb.failWrites = false;

    expect(await storage.storageGet('k')).toBe('new');
    // and it was moved back into IndexedDB
    expect(idb.data.get('k').value).toBe('new');
    expect(ls.getItem('k')).toBeNull();
  });

  it('reports a failed write when localStorage is full as well', async () => {
    idb.failWrites = true;
    ls.quotaFull = true;
    await expect(storage.storageSet('k', 'v')).rejects.toThrow();
  });

  it('migration never overwrites a value IndexedDB already holds with an older localStorage copy', async () => {
    idb.data.set('k', { key: 'k', value: 'fresh' });
    ls.setItem('k', 'stale-from-before-the-migration');

    expect(await storage.storageGet('k')).toBe('fresh');
    expect(idb.data.get('k').value).toBe('fresh');
    expect(ls.getItem('k')).toBeNull();
  });

  it('migrates a localStorage-only value into IndexedDB', async () => {
    ls.setItem('legacy', 'from-local-storage');
    expect(await storage.storageGet('legacy')).toBe('from-local-storage');
    expect(idb.data.get('legacy').value).toBe('from-local-storage');
  });

  it('storageGetStrict reports an unreadable IndexedDB instead of looking like "no data"', async () => {
    idb.failAll = true;
    await expect(storage.storageGetStrict('conversationHistory')).rejects.toThrow();
    // the lenient reader still returns null (existing behaviour for callers that can live with it)
    expect(await storage.storageGet('conversationHistory')).toBeNull();
  });

  it('storageGetStrict still returns a localStorage copy when IndexedDB is down', async () => {
    idb.failAll = true;
    ls.setItem('conversationHistory', '[1]');
    expect(await storage.storageGetStrict('conversationHistory')).toBe('[1]');
  });
});
