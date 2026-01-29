/**
 * Admin Web Search Service
 *
 * Manages admin-level API keys for web search tools.
 * Keys are stored server-side in SSM Parameter Store for all users to share.
 */

import { WebSearchProvider } from '@/types/integrations';
import { doRequestOp } from './doRequestOp';

const SERVICE_NAME = 'admin';  // Use admin service
const URL_PATH = '/amplifymin';


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


