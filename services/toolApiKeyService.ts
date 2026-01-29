/**
 * Tool API Key Service
 *
 * Manages user's API keys for tools like web search.
 * Uses the existing user-data API for storage.
 * Keys are encrypted on the client side before storage.
 */

import { ToolProvider, MaskedToolApiKey, ToolSettings, DEFAULT_TOOL_SETTINGS } from '@/types/tools';
import { doRequestOp } from './doRequestOp';

const TOOL_SETTINGS_KEY = 'tool_settings';
const APP_ID = 'amplify-tools';
const ENTITY_TYPE = 'api_keys';

// Simple encryption using base64 + reversal (not secure, but obfuscates)
// In production, use proper encryption or store keys server-side
function obfuscateKey(key: string): string {
  const base64 = btoa(key);
  return base64.split('').reverse().join('');
}

function deobfuscateKey(obfuscated: string): string {
  const base64 = obfuscated.split('').reverse().join('');
  return atob(base64);
}

function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.substring(0, 4) + '****' + key.substring(key.length - 4);
}

// Get tool settings from localStorage
export function getToolSettings(): ToolSettings {
  if (typeof window === 'undefined') return DEFAULT_TOOL_SETTINGS;

  try {
    const stored = localStorage.getItem(TOOL_SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_TOOL_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to parse tool settings:', e);
  }
  return DEFAULT_TOOL_SETTINGS;
}

// Save tool settings to localStorage
export function saveToolSettings(settings: ToolSettings): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(TOOL_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save tool settings:', e);
  }
}

// Check if a tool is enabled
export function isToolEnabled(provider: ToolProvider): boolean {
  const settings = getToolSettings();
  return settings.enabledTools.includes(provider);
}

// Enable/disable a tool
export function setToolEnabled(provider: ToolProvider, enabled: boolean): void {
  const settings = getToolSettings();
  if (enabled && !settings.enabledTools.includes(provider)) {
    settings.enabledTools.push(provider);
  } else if (!enabled) {
    settings.enabledTools = settings.enabledTools.filter(t => t !== provider);
  }
  saveToolSettings(settings);
}

/**
 * Get all configured API keys for the user (masked)
 */
export async function getConfiguredApiKeys(): Promise<MaskedToolApiKey[]> {
  try {
    console.log('🔑 getConfiguredApiKeys: Fetching keys for app:', APP_ID, 'entityType:', ENTITY_TYPE);

    // Query all tool API keys for this user
    const result = await doRequestOp({
      method: 'POST',
      path: '/user-data',
      op: '/query-type',
      data: {
        appId: APP_ID,
        entityType: ENTITY_TYPE,
      },
    });

    console.log('🔑 getConfiguredApiKeys: Response:', result);

    if (result.success && result.data) {
      const items = Array.isArray(result.data) ? result.data : [];
      console.log('🔑 getConfiguredApiKeys: Found', items.length, 'keys');
      return items.map((item: any) => ({
        provider: item.itemId as ToolProvider,
        maskedKey: item.data?.maskedKey || '****',
        isConfigured: true,
        lastUpdated: item.data?.lastUpdated,
      }));
    }

    console.log('🔑 getConfiguredApiKeys: No keys found or result.success is false');
    return [];
  } catch (e) {
    console.error('🔑 getConfiguredApiKeys: EXCEPTION:', e);
    return [];
  }
}

/**
 * Save an API key for a tool provider
 */
export async function saveApiKey(
  provider: ToolProvider,
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const obfuscatedKey = obfuscateKey(apiKey);
    const maskedKey = maskKey(apiKey);

    const requestData = {
      appId: APP_ID,
      entityType: ENTITY_TYPE,
      itemId: provider,
      data: {
        key: obfuscatedKey,
        maskedKey: maskedKey,
        lastUpdated: new Date().toISOString(),
      },
    };

    console.log('🔑 saveApiKey: Saving API key for provider:', provider);
    console.log('🔑 saveApiKey: Request data:', { ...requestData, data: { ...requestData.data, key: '[REDACTED]' } });

    const result = await doRequestOp({
      method: 'POST',
      path: '/user-data',
      op: '/put',
      data: requestData,
    });

    console.log('🔑 saveApiKey: Response:', result);

    if (result.success) {
      console.log('🔑 saveApiKey: SUCCESS - API key saved, UUID:', result.data?.uuid);
      // Enable the tool
      setToolEnabled(provider, true);
      return { success: true };
    }

    console.error('🔑 saveApiKey: FAILED - Response indicates failure:', result);
    return { success: false, error: result.message || result.error || 'Failed to save API key' };
  } catch (e) {
    console.error('🔑 saveApiKey: EXCEPTION:', e);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Delete an API key for a tool provider
 */
export async function deleteApiKey(
  provider: ToolProvider
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await doRequestOp({
      method: 'POST',
      path: '/user-data',
      op: '/delete',
      data: {
        appId: APP_ID,
        entityType: ENTITY_TYPE,
        itemId: provider,
      },
    });

    if (result.success) {
      // Disable the tool
      setToolEnabled(provider, false);
      return { success: true };
    }

    return { success: false, error: result.message || 'Failed to delete API key' };
  } catch (e) {
    console.error('Failed to delete API key:', e);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Test an API key before saving (performs a simple validation)
 * Note: Full API testing would require backend integration
 */
export async function testApiKey(
  provider: ToolProvider,
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  // Basic format validation
  if (!apiKey || apiKey.length < 10) {
    return { success: false, error: 'API key is too short' };
  }

  // Provider-specific validation
  switch (provider) {
    case 'brave_search':
      if (!apiKey.startsWith('BSA')) {
        return { success: false, error: 'Brave Search API keys typically start with "BSA"' };
      }
      break;
    case 'tavily':
      if (!apiKey.startsWith('tvly-')) {
        return { success: false, error: 'Tavily API keys typically start with "tvly-"' };
      }
      break;
    case 'serper':
      // Serper keys don't have a specific prefix
      break;
  }

  return { success: true };
}

/**
 * Check if user has any search tool configured
 */
export async function hasConfiguredSearchTool(): Promise<boolean> {
  const keys = await getConfiguredApiKeys();
  return keys.some(k => k.isConfigured);
}

/**
 * Get the decrypted API key for a provider (used internally)
 * This should only be called when making actual API requests
 */
export async function getApiKey(provider: ToolProvider): Promise<string | null> {
  try {
    const result = await doRequestOp({
      method: 'POST',
      path: '/user-data',
      op: '/get',
      data: {
        appId: APP_ID,
        entityType: ENTITY_TYPE,
        itemId: provider,
      },
    });

    if (result.success && result.data?.data?.key) {
      return deobfuscateKey(result.data.data.key);
    }

    return null;
  } catch (e) {
    console.error('Failed to get API key:', e);
    return null;
  }
}
