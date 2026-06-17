/**
 * Admin Web Search Integration
 *
 * Allows admins to configure a shared web search API key for all users.
 */

import { FC, useState } from 'react';
import Checkbox from '@/components/ReusableComponents/CheckBox';
import {
    IconSearch,
    IconKey,
    IconTrash,
    IconCheck,
    IconX,
    IconExternalLink,
    IconInfoCircle,
} from '@tabler/icons-react';
import {
    WebSearchProvider,
    WEB_SEARCH_PROVIDERS,
    AdminWebSearchConfig,
    AgentCoreAuthMode,
} from '@/types/integrations';
import toast from 'react-hot-toast';

interface Props {
    config: AdminWebSearchConfig | null;
    setConfig: (config: AdminWebSearchConfig | null) => void;
    updateUnsavedConfigs: () => void;
}

const isGatewayProvider = (provider: WebSearchProvider | null): boolean =>
    !!provider && !!WEB_SEARCH_PROVIDERS[provider]?.isGateway;

export const WebSearchIntegration: FC<Props> = ({ config, setConfig, updateUnsavedConfigs }) => {
    const [selectedProvider, setSelectedProvider] = useState<WebSearchProvider | null>(null);
    const [apiKey, setApiKey] = useState('');
    const [allowUserKeys, setAllowUserKeys] = useState(config?.allowUserWebSearchKeys ?? false);
    const [userMessage, setUserMessage] = useState(config?.webSearchUserMessage ?? '');
    const [error, setError] = useState<string | null>(null);

    // Bedrock AgentCore gateway configuration
    const [gatewayUrl, setGatewayUrl] = useState('');
    const [authMode, setAuthMode] = useState<AgentCoreAuthMode>('user_token');
    const [tokenUrl, setTokenUrl] = useState('');
    const [clientId, setClientId] = useState('');
    const [scope, setScope] = useState('');

    const resetProviderFields = () => {
        setApiKey('');
        setGatewayUrl('');
        setAuthMode('user_token');
        setTokenUrl('');
        setClientId('');
        setScope('');
        setError(null);
    };

    const handleSelectProvider = (provider: WebSearchProvider) => {
        setSelectedProvider(provider);
        resetProviderFields();
        // Pre-fill gateway fields from any values the deployment-time provisioner
        // (or a prior save) published into the config, so the admin doesn't have to
        // re-enter the gateway URL. These are present even when AgentCore isn't yet
        // the active provider.
        if (isGatewayProvider(provider) && config) {
            if (config.bedrockAgentCoreGatewayUrl) setGatewayUrl(config.bedrockAgentCoreGatewayUrl);
            if (config.bedrockAgentCoreAuthMode) setAuthMode(config.bedrockAgentCoreAuthMode);
            if (config.bedrockAgentCoreTokenUrl) setTokenUrl(config.bedrockAgentCoreTokenUrl);
            if (config.bedrockAgentCoreClientId) setClientId(config.bedrockAgentCoreClientId);
            if (config.bedrockAgentCoreScope) setScope(config.bedrockAgentCoreScope);
        }
    };

    const handleCancel = () => {
        setSelectedProvider(null);
        resetProviderFields();
    };

    const handleSave = () => {
        if (!selectedProvider) return;

        // Bedrock AgentCore (gateway) provider: configured by gateway URL + auth mode,
        // not a single API key.
        if (isGatewayProvider(selectedProvider)) {
            if (!gatewayUrl.trim()) {
                setError('A gateway URL is required.');
                return;
            }
            if ((authMode === 'oauth' || authMode === 'bearer') && !apiKey.trim()) {
                setError(authMode === 'oauth'
                    ? 'An OAuth client secret is required for client-credentials auth.'
                    : 'A bearer token is required for bearer auth.');
                return;
            }
            if (authMode === 'oauth' && (!tokenUrl.trim() || !clientId.trim())) {
                setError('OAuth client-credentials auth requires a token URL and client ID.');
                return;
            }

            const newConfig: AdminWebSearchConfig = {
                provider: selectedProvider,
                isEnabled: true,
                allowUserWebSearchKeys: allowUserKeys,
                bedrockAgentCoreGatewayUrl: gatewayUrl.trim(),
                bedrockAgentCoreAuthMode: authMode,
                lastUpdated: new Date().toISOString(),
            };
            if (authMode === 'oauth') {
                newConfig.bedrockAgentCoreTokenUrl = tokenUrl.trim();
                newConfig.bedrockAgentCoreClientId = clientId.trim();
                if (scope.trim()) newConfig.bedrockAgentCoreScope = scope.trim();
            }
            // The secret (OAuth client secret or static bearer token) is stored via api_key.
            if (authMode === 'oauth' || authMode === 'bearer') {
                newConfig.api_key = apiKey;
                newConfig.maskedKey = `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
            }
            setConfig(newConfig);
            updateUnsavedConfigs();
            handleCancel();
            return;
        }

        // Standard API-key providers
        if (!apiKey.trim()) return;

        // Update config with the new configuration (local state only)
        setConfig({
            provider: selectedProvider,
            isEnabled: true,
            allowUserWebSearchKeys: allowUserKeys,
            api_key: apiKey, // Store full key for later submission
            maskedKey: `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`,
            lastUpdated: new Date().toISOString()
        });

        // Mark configs as unsaved to activate the "Save Changes" button
        updateUnsavedConfigs();

        handleCancel();
    };

    const handleDelete = () => {
        if (!config?.provider) return;
        if (!confirm('Are you sure you want to remove the web search API key? Users will no longer be able to use web search.')) return;

        // Clear the config (local state only)
        setConfig(null);

        // Mark configs as unsaved to activate the "Save Changes" button
        updateUnsavedConfigs();

       
    };

    const handleAllowUserKeysChange = (isChecked: boolean) => {
        setAllowUserKeys(isChecked);
        // Update the config and mark as unsaved
        if (config) {
            setConfig({
                ...config,
                allowUserWebSearchKeys: isChecked
            });
        } else {
            // Create a minimal config just for the allowUserWebSearchKeys setting
            // This allows saving the checkbox state even without an API key
            // Note: Don't set a provider - backend will save allowUserWebSearchKeys without requiring a provider
            setConfig({
                allowUserWebSearchKeys: isChecked,
                isEnabled: false // No admin key configured
            } as AdminWebSearchConfig);
        }
        // Mark configs as unsaved to activate the "Save Changes" button
        updateUnsavedConfigs();
    };

    const handleUserMessageChange = (message: string) => {
        setUserMessage(message);
        // Update the config and mark as unsaved
        if (config) {
            setConfig({
                ...config,
                webSearchUserMessage: message
            });
        } else {
            // Create a minimal config just for the webSearchUserMessage setting
            setConfig({
                webSearchUserMessage: message,
                allowUserWebSearchKeys: false,
                isEnabled: false
            } as AdminWebSearchConfig);
        }
        // Mark configs as unsaved to activate the "Save Changes" button
        updateUnsavedConfigs();
    };

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
            <div className="mx-4 my-4 p-4 bg-blue-50 dark:bg-blue-800 border border-blue-200 dark:border-blue-800 rounded-lg">
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

            {/* Allow Users to Add Their Own Keys Checkbox */}
            <div className="mx-4 mb-4">
                <Checkbox
                    id="allowUserWebSearchKeys"
                    label="Allow users to add their own web search API keys"
                    checked={allowUserKeys}
                    onChange={handleAllowUserKeysChange}
                />
                <p className="ml-6 text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                    When enabled, users can configure their own API keys in addition to using the admin-provided key.
                </p>
            </div>

            {/* User Message Textarea */}
            <div className="mx-4 mb-4">
                <label htmlFor="webSearchUserMessage" className="block text-sm font-medium text-black dark:text-white mb-2">
                    User notification message (optional)
                </label>
                <textarea
                    id="webSearchUserMessage"
                    value={userMessage}
                    onChange={(e) => handleUserMessageChange(e.target.value)}
                    placeholder="e.g., 'Web search is enabled. Please do not send sensitive data.'"
                    rows={3}
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                    This message will be shown to users when they enable web search (if configured).
                </p>
            </div>

            {/* Current Configuration */}
            {config && config.isEnabled && (
                <div className="mx-4 mb-4 p-4 border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/90 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <IconCheck className="w-5 h-5 text-green-500" />
                            <span className="font-medium text-green-700 dark:text-green-300">
                                Web Search Enabled
                            </span>
                        </div>
                        <button
                            onClick={handleDelete}
                            className="flex items-center gap-1 px-3 py-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        >
                            <IconTrash className="w-4 h-4" />
                            Remove
                        </button>
                    </div>
                    <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                        <p>Provider: <span className="font-medium">{WEB_SEARCH_PROVIDERS[config.provider]?.name || config.provider}</span></p>
                        {isGatewayProvider(config.provider) ? (
                            <>
                                {config.bedrockAgentCoreGatewayUrl &&
                                    <p>Gateway: <span className="font-mono break-all">{config.bedrockAgentCoreGatewayUrl}</span></p>}
                                <p>Auth mode: <span className="font-medium">{config.bedrockAgentCoreAuthMode || 'user_token'}</span></p>
                                {config.bedrockAgentCoreRegion && <p>Region: <span className="font-medium">{config.bedrockAgentCoreRegion}</span></p>}
                                {config.maskedKey && <p>Secret: <span className="font-mono">{config.maskedKey}</span></p>}
                            </>
                        ) : (
                            config.maskedKey && <p>API Key: <span className="font-mono">{config.maskedKey}</span></p>
                        )}
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
                                        {provider.isGateway ? 'Documentation' : 'Get API Key'}
                                        <IconExternalLink className="w-3 h-3" />
                                    </a>
                                </div>

                                {/* API Key Input - shown when this provider is selected */}
                                {selectedProvider === provider.id ? (
                                    isGatewayProvider(provider.id) ? (
                                        <div className="mt-4 space-y-3">
                                            <div>
                                                <label className="block text-sm font-medium text-black dark:text-white mb-1">
                                                    Gateway URL
                                                </label>
                                                <input
                                                    type="text"
                                                    value={gatewayUrl}
                                                    onChange={e => setGatewayUrl(e.target.value)}
                                                    placeholder="https://<gateway-id>.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp"
                                                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    autoFocus
                                                />
                                                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                                    If you enabled auto-provisioning on deploy, this is filled in for you and can be left as-is.
                                                </p>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-black dark:text-white mb-1">
                                                    Authentication mode
                                                </label>
                                                <select
                                                    value={authMode}
                                                    onChange={e => setAuthMode(e.target.value as AgentCoreAuthMode)}
                                                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="user_token">Forward each user&apos;s sign-in (recommended)</option>
                                                    <option value="oauth">OAuth client credentials</option>
                                                    <option value="bearer">Static bearer token</option>
                                                </select>
                                            </div>

                                            {authMode === 'user_token' && (
                                                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                                                    The gateway is authorized with each user&apos;s own sign-in. No secret to store.
                                                </p>
                                            )}

                                            {authMode === 'oauth' && (
                                                <>
                                                    <input
                                                        type="text"
                                                        value={tokenUrl}
                                                        onChange={e => setTokenUrl(e.target.value)}
                                                        placeholder="OAuth token URL"
                                                        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={clientId}
                                                        onChange={e => setClientId(e.target.value)}
                                                        placeholder="Client ID"
                                                        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={scope}
                                                        onChange={e => setScope(e.target.value)}
                                                        placeholder="Scope (optional)"
                                                        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </>
                                            )}

                                            {(authMode === 'oauth' || authMode === 'bearer') && (
                                                <input
                                                    type="password"
                                                    value={apiKey}
                                                    onChange={e => setApiKey(e.target.value)}
                                                    placeholder={authMode === 'oauth' ? 'Client secret' : 'Bearer token'}
                                                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            )}

                                            {error && (
                                                <p className="text-sm text-red-500 flex items-center gap-1">
                                                    <IconX className="w-4 h-4" />
                                                    {error}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={handleSave}
                                                    disabled={!gatewayUrl.trim() ||
                                                        ((authMode === 'oauth' || authMode === 'bearer') && !apiKey.trim()) ||
                                                        (authMode === 'oauth' && (!tokenUrl.trim() || !clientId.trim()))}
                                                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                >
                                                    <IconKey className="w-4 h-4" />
                                                    Save Gateway
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
                                                disabled={!apiKey.trim()}
                                                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                            >
                                                <IconKey className="w-4 h-4" />
                                                Add API Key
                                            </button>
                                            <button
                                                onClick={handleCancel}
                                                className="px-4 py-2 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                    )
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
