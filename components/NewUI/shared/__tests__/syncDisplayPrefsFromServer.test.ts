import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetchUserSettings: vi.fn(), saveUserSettings: vi.fn() }));
vi.mock('@/services/settingsService', () => ({
  fetchUserSettings: mocks.fetchUserSettings,
  saveUserSettings: mocks.saveUserSettings,
}));

import { syncDisplayPrefsFromServer } from '@/components/NewUI/shared/userDisplayPrefs';
import { getUserDefaultModelId, setUserDefaultModelId } from '@/components/NewUI/shared/userDefaultModel';
import { getUserDefaultEffort, setUserDefaultEffort } from '@/components/NewUI/shared/userDefaultEffort';
import { getStoredUserWebSearchChoice, setUserWebSearchEnabled } from '@/components/NewUI/shared/userWebSearch';

const store = new Map<string, string>();
const serverReturns = (data: unknown, success = true) =>
  mocks.fetchUserSettings.mockResolvedValue({ success, data });

beforeEach(() => {
  store.clear();
  mocks.fetchUserSettings.mockReset();
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  vi.stubGlobal('Event', class { constructor(public type: string) {} });
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});

describe('syncDisplayPrefsFromServer', () => {
  it('applies the server values for model, effort, web search and storage', async () => {
    setUserDefaultModelId('old-model');
    setUserDefaultEffort('low');
    setUserWebSearchEnabled(true);
    serverReturns({
      userDefaultModelId: 'gpt-x',
      userDefaultEffort: 'high',
      webSearchEnabled: false,
      storageSelection: 'cloud-only',
    });

    const result = await syncDisplayPrefsFromServer();

    expect(getUserDefaultModelId()).toBe('gpt-x');
    expect(getUserDefaultEffort()).toBe('high');
    expect(getStoredUserWebSearchChoice()).toBe(false);
    expect(result?.storageSelection).toBe('cloud-only');
  });

  it('treats null as an explicit clear made on another device', async () => {
    setUserDefaultModelId('old-model');
    setUserDefaultEffort('low');
    serverReturns({ userDefaultModelId: null, userDefaultEffort: null });

    await syncDisplayPrefsFromServer();

    expect(getUserDefaultModelId()).toBeNull();
    expect(getUserDefaultEffort()).toBeNull();
  });

  it('leaves this device alone for keys the server does not hold', async () => {
    setUserDefaultModelId('mine');
    setUserWebSearchEnabled(false);
    serverReturns({ theme: 'dark' });

    const result = await syncDisplayPrefsFromServer();

    expect(getUserDefaultModelId()).toBe('mine');
    expect(getStoredUserWebSearchChoice()).toBe(false);
    expect(result?.storageSelection).toBeNull();
  });

  it('copies only the roaming prefs into the local settings blob', async () => {
    store.set('settings', JSON.stringify({ theme: 'light', hiddenModelIds: ['a'], featureOptions: {} }));
    serverReturns({ theme: 'dark', hiddenModelIds: ['b'], featureOptions: { x: true }, userDefaultModelId: 'gpt-x' });

    await syncDisplayPrefsFromServer();

    const blob = JSON.parse(store.get('settings')!);
    expect(blob.userDefaultModelId).toBe('gpt-x');
    expect(blob.theme).toBe('light');
    expect(blob.hiddenModelIds).toEqual(['a']);
    expect(blob.featureOptions).toEqual({});
  });

  it.each([
    ['the request fails', { success: false, data: null }],
    ['the user has no saved settings yet', { success: true, data: null }],
  ])('returns null and changes nothing when %s', async (_name, response) => {
    setUserDefaultModelId('mine');
    mocks.fetchUserSettings.mockResolvedValue(response);

    expect(await syncDisplayPrefsFromServer()).toBeNull();
    expect(getUserDefaultModelId()).toBe('mine');
  });

  it('returns null instead of throwing when the request rejects', async () => {
    mocks.fetchUserSettings.mockRejectedValue(new Error('offline'));

    await expect(syncDisplayPrefsFromServer()).resolves.toBeNull();
  });
});
