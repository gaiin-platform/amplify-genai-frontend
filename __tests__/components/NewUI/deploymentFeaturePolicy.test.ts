import { describe, expect, it } from 'vitest';
import {
  getDeploymentFeatureAvailability,
  isClassicUiSwitchAllowed,
  isDeploymentFeatureAvailable,
  resolveEffectivePluginIds,
} from '@/components/NewUI/shared/deploymentFeaturePolicy';
import { resolveUIPreferenceWithPolicy } from '@/components/NewUI/shared/uiPreferenceResolution';
import { getSettings } from '@/utils/app/settings';
import { afterEach, beforeEach, vi } from 'vitest';

describe('deployment feature policy', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults missing deployment settings to enabled for legacy configs', () => {
    expect(getDeploymentFeatureAvailability({})).toEqual({
      promptHighlighter: true,
      artifacts: true,
      webSearch: true,
      codeInterpreter: true,
      memory: true,
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

  it('forces new UI while policy is disabled and preserves normal preference resolution otherwise', () => {
    expect(resolveUIPreferenceWithPolicy('classic', 'classic', false)).toBe('new');
    expect(resolveUIPreferenceWithPolicy('new', 'classic', false)).toBe('new');
    expect(resolveUIPreferenceWithPolicy('classic', null, true)).toBe('classic');
    expect(resolveUIPreferenceWithPolicy(null, null, true)).toBe('ask');
  });
});
