import { describe, expect, it } from 'vitest';
import {
  cacheClassicUiSwitchPolicy,
  cacheNewUiRollout,
  claimClassicUiSwitchCache,
  isCachedClassicUiSwitchDisallowed,
  getDeploymentFeatureAvailability,
  isClassicUiSwitchAllowed,
  isDeploymentFeatureAvailable,
  isNewUiEnabled,
  readCachedNewUiRollout,
  resolveNewUiRollout,
  resolveEffectivePluginIds,
} from '@/components/NewUI/shared/deploymentFeaturePolicy';
import { resolveUIPreferenceWithPolicy } from '@/components/NewUI/shared/uiPreferenceResolution';
import { getSettings } from '@/utils/app/settings';
import { afterEach, beforeEach, vi } from 'vitest';

describe('deployment feature policy', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    };
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', { localStorage: storage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults missing deployment settings to prompt highlighter and memory off', () => {
    expect(getDeploymentFeatureAvailability({})).toEqual({
      promptHighlighter: false,
      artifacts: true,
      webSearch: true,
      codeInterpreter: true,
      memory: false,
    });
    expect(isClassicUiSwitchAllowed({})).toBe(true);
  });

  it('uses admin availability over feature flags and stale user preference data', () => {
    const flags = {
      artifacts: true,
      deploymentFeatures: {
        availability: { artifacts: false, codeInterpreter: false, webSearch: true },
      },
    };
    expect(isDeploymentFeatureAvailable(flags, 'artifacts')).toBe(false);
    expect(isDeploymentFeatureAvailable(flags, 'codeInterpreter')).toBe(false);
    expect(isDeploymentFeatureAvailable(flags, 'webSearch')).toBe(true);
  });

  it('permanently removes user feature preferences from hydrated settings', () => {
    localStorage.setItem('settings', JSON.stringify({
      theme: 'dark',
      featureOptions: {
        includePluginSelector: true,
        includeFocusedMessages: true,
        includeArtifacts: true,
        includeHighlighter: true,
        includeWebSearch: true,
        includeMemory: true,
      },
      hiddenModelIds: [],
    }));
    expect(getSettings({ pluginsOnInput: true, smartMessages: true, artifacts: true }).featureOptions)
      .toEqual({});
  });

  it('drops stale mode plugin IDs while retaining independent RAG, MCP, and skills', () => {
    expect(resolveEffectivePluginIds([
      'code-interpreter', 'artifacts', 'memory', 'web-search', 'rag', 'mcp', 'skills',
    ])).toEqual(['rag', 'mcp', 'skills']);
  });

  it('defaults the rollout OFF when the flag is absent; the check is pure', () => {
    expect(isNewUiEnabled({})).toBe(false);
    expect(isNewUiEnabled(undefined)).toBe(false);
    expect(isNewUiEnabled(null)).toBe(false);
    expect(isNewUiEnabled({ newUi: false })).toBe(false);
    expect(isNewUiEnabled({ newUi: true })).toBe(true);
    // A stale cached verdict must not leak into the pure check.
    cacheNewUiRollout('a@x.com', false);
    expect(isNewUiEnabled({ newUi: true })).toBe(true);
  });

  it('keeps the classic-switch policy independent of the rollout', () => {
    expect(isClassicUiSwitchAllowed({ newUi: false })).toBe(true);
    expect(isClassicUiSwitchAllowed({ newUi: true })).toBe(true);
    expect(isClassicUiSwitchAllowed({ deploymentFeatures: { allowClassicUiSwitch: false } })).toBe(false);
    expect(isClassicUiSwitchAllowed({ newUi: false, deploymentFeatures: { allowClassicUiSwitch: false } })).toBe(false);
  });

  it('trusts only a real flag payload for the rollout verdict', () => {
    expect(resolveNewUiRollout({ notebook: true })).toBe(false); // trusted payload, flag absent → off
    expect(resolveNewUiRollout({ notebook: true, newUi: true })).toBe(true);
    expect(resolveNewUiRollout({ notebook: true, newUi: false })).toBe(false);
    expect(resolveNewUiRollout({ newUi: false })).toBe(false);
    expect(resolveNewUiRollout({})).toBeNull();
    expect(resolveNewUiRollout(null)).toBeNull();
    expect(resolveNewUiRollout(undefined)).toBeNull();
    expect(resolveNewUiRollout([])).toBeNull();
    expect(resolveNewUiRollout('error')).toBeNull();
    expect(resolveNewUiRollout({ smartMessages: true })).toBeNull();
  });

  it('caches the rollout verdict per user, in both directions', () => {
    expect(readCachedNewUiRollout('a@x.com')).toBeNull();
    cacheNewUiRollout('a@x.com', false);
    expect(readCachedNewUiRollout('a@x.com')).toBe(false);
    expect(readCachedNewUiRollout('b@x.com')).toBeNull();
    cacheNewUiRollout('a@x.com', true);
    expect(readCachedNewUiRollout('a@x.com')).toBe(true);
  });

  it('ignores the cache without a user and survives corrupt entries', () => {
    cacheNewUiRollout(null, false);
    expect(readCachedNewUiRollout(null)).toBeNull();
    localStorage.setItem('amplify_new_ui_rollout_enabled', 'false');
    expect(readCachedNewUiRollout('a@x.com')).toBeNull();
    localStorage.setItem('amplify_new_ui_rollout_enabled', '{"u":"a@x.com","enabled":"no"}');
    expect(readCachedNewUiRollout('a@x.com')).toBeNull();
  });

  it('forces classic while rollout is disabled and defaults new UI when enabled', () => {
    expect(resolveUIPreferenceWithPolicy('new', 'new', true, false)).toBe('classic');
    expect(resolveUIPreferenceWithPolicy('classic', 'classic', true, false)).toBe('classic');
    expect(resolveUIPreferenceWithPolicy(null, null, true, true)).toBe('new');
    expect(resolveUIPreferenceWithPolicy('classic', null, true, true)).toBe('classic');
    expect(resolveUIPreferenceWithPolicy('new', 'classic', true, true)).toBe('classic');
    expect(resolveUIPreferenceWithPolicy('classic', 'new', true, true)).toBe('new');
  });

  it('forces new UI when classic is disallowed, including over a stored classic choice', () => {
    expect(resolveUIPreferenceWithPolicy('classic', 'classic', false, true)).toBe('new');
    expect(resolveUIPreferenceWithPolicy(null, null, false, true)).toBe('new');
    expect(resolveUIPreferenceWithPolicy('new', 'new', false, false)).toBe('classic');
  });

  it('scopes the classic-switch cache to its owner while keeping the bare value key', () => {
    cacheClassicUiSwitchPolicy(false, 'a@x.com');
    expect(localStorage.getItem('amplify_classic_ui_switch_allowed')).toBe('false');
    expect(isCachedClassicUiSwitchDisallowed('a@x.com')).toBe(true);
    expect(isCachedClassicUiSwitchDisallowed('b@x.com')).toBe(false);
    expect(isCachedClassicUiSwitchDisallowed(null)).toBe(false);
  });

  it('claiming the classic-switch cache removes another account\'s value, keeps your own', () => {
    cacheClassicUiSwitchPolicy(false, 'a@x.com');
    claimClassicUiSwitchCache('a@x.com');
    expect(localStorage.getItem('amplify_classic_ui_switch_allowed')).toBe('false');

    claimClassicUiSwitchCache('b@x.com');
    expect(localStorage.getItem('amplify_classic_ui_switch_allowed')).toBeNull();
    expect(isCachedClassicUiSwitchDisallowed('b@x.com')).toBe(false);
  });

  it('removes an unowned (legacy) classic-switch value on claim', () => {
    localStorage.setItem('amplify_classic_ui_switch_allowed', 'false');
    claimClassicUiSwitchCache('a@x.com');
    expect(localStorage.getItem('amplify_classic_ui_switch_allowed')).toBeNull();
  });
});
