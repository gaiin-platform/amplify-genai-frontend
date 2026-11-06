import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  USER_WEB_SEARCH_KEY,
  getStoredUserWebSearchChoice,
  getUserWebSearchEnabled,
  setUserWebSearchEnabled,
} from '@/components/NewUI/shared/userWebSearch';

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});

describe('userWebSearch', () => {
  it('defaults to ON with no stored choice', () => {
    expect(getUserWebSearchEnabled()).toBe(true);
    expect(getStoredUserWebSearchChoice()).toBeNull();
  });

  it('remembers an explicit off and on', () => {
    setUserWebSearchEnabled(false);
    expect(getUserWebSearchEnabled()).toBe(false);
    setUserWebSearchEnabled(true);
    expect(getUserWebSearchEnabled()).toBe(true);
  });

  it('honours a server-synced off in the settings blob before the dedicated key is applied', () => {
    store.set('settings', JSON.stringify({ webSearchEnabled: false }));
    expect(getUserWebSearchEnabled()).toBe(false);
  });

  it('dedicated key wins over the blob', () => {
    store.set('settings', JSON.stringify({ webSearchEnabled: false }));
    store.set(USER_WEB_SEARCH_KEY, 'true');
    expect(getUserWebSearchEnabled()).toBe(true);
  });

  it('ignores a malformed blob', () => {
    store.set('settings', '{nope');
    expect(getUserWebSearchEnabled()).toBe(true);
  });
});
