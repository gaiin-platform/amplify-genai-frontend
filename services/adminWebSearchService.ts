/**
 * Admin Web Search Service
 *
 * Manages admin-level API keys for web search tools.
 * Keys are stored server-side in SSM Parameter Store for all users to share.
 */

import { WebSearchProvider, AdminWebSearchConfig } from '@/types/integrations';
import { doRequestOp } from './doRequestOp';

const SERVICE_NAME = 'websearch';  // Use separate service for local testing
const URL_PATH = '/integrations';

/**
 * Get the current admin web search configuration
 */
export async function getAdminWebSearchConfig(): Promise<AdminWebSearchConfig | null> {
    try {
        const result = await doRequestOp({
            method: 'GET',
            path: URL_PATH,
            op: '/web-search/admin/config',
            service: SERVICE_NAME
        });

        if (result.success && result.data) {
            return result.data as AdminWebSearchConfig;
        }
        return null;
    } catch (e) {
        console.error('Failed to get admin web search config:', e);
        return null;
    }
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
            op: '/web-search/admin/register',
            data: {
                provider,
                api_key: apiKey
            },
            service: SERVICE_NAME
        });

        if (result.success) {
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
            op: '/web-search/admin/delete',
            data: { provider },
            service: SERVICE_NAME
        });

        if (result.success) {
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
 */
export async function testAdminWebSearchKey(
    provider: WebSearchProvider,
    apiKey: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const result = await doRequestOp({
            method: 'POST',
            path: URL_PATH,
            op: '/web-search/admin/test',
            data: {
                provider,
                api_key: apiKey
            },
            service: SERVICE_NAME
        });

        if (result.success) {
            return { success: true };
        }
        return { success: false, error: result.message || result.error || 'API key test failed' };
    } catch (e) {
        console.error('Failed to test admin web search key:', e);
        return { success: false, error: 'Network error' };
    }
}

/**
 * Check if admin has configured web search
 */
export async function hasAdminWebSearch(): Promise<boolean> {
    const config = await getAdminWebSearchConfig();
    return config !== null && config.isEnabled;
}
