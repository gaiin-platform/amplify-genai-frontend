/**
 * Admin Web Search Integration
 *
 * Allows admins to configure a shared web search API key for all users.
 */

import { FC, useState, useEffect, useRef } from 'react';
import {
    IconSearch,
    IconKey,
    IconTrash,
    IconCheck,
    IconX,
    IconExternalLink,
    IconLoader2,
    IconInfoCircle,
} from '@tabler/icons-react';
import {
    WebSearchProvider,
    WEB_SEARCH_PROVIDERS,
    AdminWebSearchConfig,
} from '@/types/integrations';
import {
    getAdminWebSearchConfig,
    registerAdminWebSearchKey,
    deleteAdminWebSearchKey,
} from '@/services/adminWebSearchService';
import toast from 'react-hot-toast';
import { AdminConfigTypes } from '@/types/admin';

interface Props {
    updateUnsavedConfigs?: (t: AdminConfigTypes) => void;
}

export const WebSearchIntegration: FC<Props> = ({ updateUnsavedConfigs }) => {
    const [config, setConfig] = useState<AdminWebSearchConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedProvider, setSelectedProvider] = useState<WebSearchProvider | null>(null);
    const [apiKey, setApiKey] = useState('');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Track if we've already notified about unsaved changes
    const hasNotifiedUnsaved = useRef(false);

    useEffect(() => {
        loadConfig();
    }, []);

    // Track unsaved form changes
    useEffect(() => {
        if (updateUnsavedConfigs) {
            const hasUnsavedData = selectedProvider !== null && apiKey.trim() !== '';
            if (hasUnsavedData && !hasNotifiedUnsaved.current) {
                updateUnsavedConfigs(AdminConfigTypes.WEB_SEARCH);
                hasNotifiedUnsaved.current = true;
            }
        }
    }, [selectedProvider, apiKey, updateUnsavedConfigs]);

    const loadConfig = async () => {
        setLoading(true);
        try {
            const result = await getAdminWebSearchConfig();
            setConfig(result);
        } catch (e) {
            console.error('Failed to load web search config:', e);
        }
        setLoading(false);
    };

    const handleSelectProvider = (provider: WebSearchProvider) => {
        setSelectedProvider(provider);
        setApiKey('');
        setError(null);
    };

    const handleCancel = () => {
        setSelectedProvider(null);
        setApiKey('');
        setError(null);
        hasNotifiedUnsaved.current = false;
    };

    const handleSave = async () => {
        if (!selectedProvider || !apiKey.trim()) return;

        setSaving(true);
        setError(null);

        const result = await registerAdminWebSearchKey(selectedProvider, apiKey);

        if (result.success) {
            toast.success('Web search API key saved successfully');
            await loadConfig();
            handleCancel();
        } else {
            setError(result.error || 'Failed to save API key');
        }

        setSaving(false);
    };

    const handleDelete = async () => {
        if (!config?.provider) return;
        if (!confirm('Are you sure you want to remove the web search API key? Users will no longer be able to use web search.')) return;

        setDeleting(true);
        const result = await deleteAdminWebSearchKey(config.provider);

        if (result.success) {
            toast.success('Web search API key removed');
            setConfig(null);
        } else {
            toast.error(result.error || 'Failed to remove API key');
        }

        setDeleting(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <IconLoader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span className="ml-2 text-neutral-600 dark:text-neutral-400">Loading...</span>
            </div>
        );
    }

    return (
        <div className="admin-style-settings-card">
            <div className="admin-style-settings-card-header">
                <div className="flex flex-row items-center gap-3 mb-2">
                    <IconSearch className="w-6 h-6 text-blue-500" />
                    <h3 className="admin-style-settings-card-title">Web Search</h3>
                </div>
                <p className="admin-style-settings-card-description">
                    Configure web search API keys for all users. When enabled, users can use web search in their conversations.
                </p>
            </div>

            {/* Info Box */}
            <div className="mx-4 my-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-start gap-3">
                    <IconInfoCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                        <p className="font-medium">Admin-managed web search</p>
                        <p className="mt-1">
                            When you configure a web search API key here, all users in your organization
                            can use web search without needing their own API keys. Usage costs will be
                            billed to the organization account.
                        </p>
                    </div>
                </div>
            </div>

            {/* Current Configuration */}
            {config && config.isEnabled && (
                <div className="mx-4 mb-4 p-4 border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <IconCheck className="w-5 h-5 text-green-500" />
                            <span className="font-medium text-green-700 dark:text-green-300">
                                Web Search Enabled
                            </span>
                        </div>
                        <button
                            onClick={handleDelete}
                            disabled={deleting}
                            className="flex items-center gap-1 px-3 py-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        >
                            {deleting ? (
                                <IconLoader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <IconTrash className="w-4 h-4" />
                            )}
                            Remove
                        </button>
                    </div>
                    <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                        <p>Provider: <span className="font-medium">{WEB_SEARCH_PROVIDERS[config.provider]?.name || config.provider}</span></p>
                        {config.maskedKey && <p>API Key: <span className="font-mono">{config.maskedKey}</span></p>}
                        {config.lastUpdated && <p>Last updated: {new Date(config.lastUpdated).toLocaleDateString()}</p>}
                    </div>
                </div>
            )}

            {/* Provider Selection / Configuration */}
            {(!config || !config.isEnabled) && (
                <div className="mx-4 mb-4 space-y-4">
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        {selectedProvider
                            ? `Configure ${WEB_SEARCH_PROVIDERS[selectedProvider]?.name || selectedProvider}:`
                            : 'Select a web search provider to enable for your organization:'}
                    </p>

                    {Object.values(WEB_SEARCH_PROVIDERS)
                        .filter(provider => !selectedProvider || selectedProvider === provider.id)
                        .map(provider => (
                        <div
                            key={provider.id}
                            className={`border rounded-lg overflow-hidden ${
                                selectedProvider === provider.id
                                    ? 'border-blue-500 dark:border-blue-400'
                                    : 'border-neutral-200 dark:border-neutral-700'
                            }`}
                        >
                            <div className="p-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h4 className="font-medium text-black dark:text-white">
                                            {provider.name}
                                        </h4>
                                        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                                            {provider.description}
                                        </p>
                                        {provider.freeQuota && (
                                            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                                {provider.freeQuota}
                                            </p>
                                        )}
                                    </div>
                                    <a
                                        href={provider.apiKeyUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600"
                                    >
                                        Get API Key
                                        <IconExternalLink className="w-3 h-3" />
                                    </a>
                                </div>

                                {/* API Key Input - shown when this provider is selected */}
                                {selectedProvider === provider.id ? (
                                    <div className="mt-4 space-y-3">
                                        <input
                                            type="password"
                                            value={apiKey}
                                            onChange={e => setApiKey(e.target.value)}
                                            placeholder={provider.apiKeyPlaceholder || 'Enter API key'}
                                            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            autoFocus
                                        />
                                        {error && (
                                            <p className="text-sm text-red-500 flex items-center gap-1">
                                                <IconX className="w-4 h-4" />
                                                {error}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={handleSave}
                                                disabled={saving || !apiKey.trim()}
                                                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                            >
                                                {saving ? (
                                                    <>
                                                        <IconLoader2 className="w-4 h-4 animate-spin" />
                                                        Saving...
                                                    </>
                                                ) : (
                                                    <>
                                                        <IconKey className="w-4 h-4" />
                                                        Save API Key
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                onClick={handleCancel}
                                                className="px-4 py-2 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => handleSelectProvider(provider.id)}
                                        className="mt-4 px-4 py-2 border border-blue-500 text-blue-500 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2"
                                    >
                                        <IconKey className="w-4 h-4" />
                                        Configure
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default WebSearchIntegration;
