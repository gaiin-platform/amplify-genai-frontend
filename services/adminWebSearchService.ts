/**
 * Admin Web Search Service
 *
 * Manages admin-level API keys for web search tools.
 * Keys are stored server-side in SSM Parameter Store for all users to share.
 */

import { WebSearchProvider, AdminWebSearchConfig } from '@/types/integrations';
import { doRequestOp } from './doRequestOp';

const SERVICE_NAME = 'admin';  // Use admin service
const URL_PATH = '/amplifymin';

/**
 * Get the current admin web search configuration
 */
export async function getAdminWebSearchConfig(): Promise<AdminWebSearchConfig | null> {
    try {
        // Try to get from backend first
        const result = await doRequestOp({
            method: 'GET',
            path: URL_PATH,
            op: '/configs',
            queryParams: {
                config_ids: 'webSearchConfig'
            },
            service: SERVICE_NAME
        });

        if (result.success && result.data?.webSearchConfig) {
            const config = result.data.webSearchConfig;
            return {
                provider: config.provider,
                isEnabled: config.isEnabled !== false,
                maskedKey: config.maskedKey || config.masked_key,
                lastUpdated: config.lastUpdated || config.last_updated
            } as AdminWebSearchConfig;
        }
    } catch (e) {
        console.error('Backend web search config not available:', e);
    }

    // Fallback to localStorage for temporary caching
    // This is used when the backend config was just saved but GET hasn't propagated yet.
    // The localStorage value is set immediately after a successful POST and serves as a
    // short-term cache until the backend GET returns the updated config. It's cleared
    // when the config is deleted, ensuring consistency with the source of truth (backend).
    try {
        const tempConfig = localStorage.getItem('tempAdminWebSearchConfig');
        if (tempConfig) {
            return JSON.parse(tempConfig) as AdminWebSearchConfig;
        }
    } catch (e) {
        console.error('Failed to read localStorage fallback:', e);
    }

    return null;
}

/**
 * Register/update an admin web search API key
 */
export async function registerAdminWebSearchKey(
    provider: WebSearchProvider,
    apiKey: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const result = await doRequestOp({
            method: 'POST',
            path: URL_PATH,
            op: '/configs/update',
            data: {
                configurations: [
                    {
                        type: 'webSearchConfig',
                        data: {
                            provider,
                            api_key: apiKey
                        }
                    }
                ]
            },
            service: SERVICE_NAME
        });

        if (result.success) {
            // Store successful config in localStorage as a fallback until backend GET works
            const tempConfig = {
                provider,
                isEnabled: true,
                // Use consistent masking pattern (4 chars on each end) matching maskApiKey in types/tools.ts
                maskedKey: `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`,
                lastUpdated: new Date().toISOString()
            };
            localStorage.setItem('tempAdminWebSearchConfig', JSON.stringify(tempConfig));

            return { success: true };
        }
        return { success: false, error: result.message || result.error || 'Failed to register API key' };
    } catch (e) {
        console.error('Failed to register admin web search key:', e);
        return { success: false, error: 'Network error' };
    }
}

/**
 * Delete the admin web search API key
 */
export async function deleteAdminWebSearchKey(
    provider: WebSearchProvider
): Promise<{ success: boolean; error?: string }> {
    try {
        const result = await doRequestOp({
            method: 'POST',
            path: URL_PATH,
            op: '/configs/update',
            data: {
                configurations: [
                    {
                        type: 'webSearchConfig',
                        data: {
                            provider,
                            isEnabled: false
                        }
                    }
                ]
            },
            service: SERVICE_NAME
        });

        if (result.success) {
            // Clear localStorage fallback when successfully deleted
            localStorage.removeItem('tempAdminWebSearchConfig');
            return { success: true };
        }
        return { success: false, error: result.message || 'Failed to delete API key' };
    } catch (e) {
        console.error('Failed to delete admin web search key:', e);
        return { success: false, error: 'Network error' };
    }
}

/**
 * Test an admin web search API key
 * Note: Test functionality is not available in the new admin config system
 */
export async function testAdminWebSearchKey(
    _provider: WebSearchProvider,
    _apiKey: string
): Promise<{ success: boolean; error?: string }> {
    // Test functionality is not implemented in the new admin config system
    console.warn('Test admin web search key functionality is not available in the new admin config system');
    return { success: false, error: 'Test functionality not available' };
}

/**
 * Check if admin has configured web search
 */
export async function hasAdminWebSearch(): Promise<boolean> {
    const config = await getAdminWebSearchConfig();
    return config !== null && config.isEnabled;
}
