/**
 * Tool API Keys Tab
 *
 * Allows users to configure their own API keys for tools like web search.
 */

import { FC, useEffect, useState } from 'react';
import {
  IconKey,
  IconTrash,
  IconCheck,
  IconX,
  IconExternalLink,
  IconLoader2,
  IconSearch,
  IconInfoCircle,
} from '@tabler/icons-react';
import {
  ToolProvider,
  MaskedToolApiKey,
  TOOL_PROVIDERS,
  validateApiKeyFormat,
} from '@/types/tools';
import {
  getConfiguredApiKeys,
  saveApiKey,
  deleteApiKey,
  testApiKey,
} from '@/services/toolApiKeyService';

interface Props {
  open: boolean;
}

export const ToolApiKeysTab: FC<Props> = ({ open }) => {
  const [configuredKeys, setConfiguredKeys] = useState<MaskedToolApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingProvider, setAddingProvider] = useState<ToolProvider | null>(null);
  const [newApiKey, setNewApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ToolProvider | null>(null);

  // Load configured keys
  useEffect(() => {
    if (open) {
      loadKeys();
    }
  }, [open]);

  const loadKeys = async () => {
    setLoading(true);
    try {
      const keys = await getConfiguredApiKeys();
      setConfiguredKeys(keys);
    } catch (e) {
      console.error('Failed to load API keys:', e);
    }
    setLoading(false);
  };

  const handleAddKey = (provider: ToolProvider) => {
    setAddingProvider(provider);
    setNewApiKey('');
    setError(null);
  };

  const handleCancelAdd = () => {
    setAddingProvider(null);
    setNewApiKey('');
    setError(null);
  };

  const handleTestKey = async () => {
    if (!addingProvider || !newApiKey) return;

    setTesting(true);
    setError(null);

    const result = await testApiKey(addingProvider, newApiKey);
    setTesting(false);

    if (!result.success) {
      setError(result.error || 'Test failed');
    } else {
      setError(null);
      // Show success briefly, then save
      await handleSaveKey();
    }
  };

  const handleSaveKey = async () => {
    if (!addingProvider || !newApiKey) return;

    if (!validateApiKeyFormat(addingProvider, newApiKey)) {
      setError('Invalid API key format');
      return;
    }

    setSaving(true);
    setError(null);

    const result = await saveApiKey(addingProvider, newApiKey);
    setSaving(false);

    if (result.success) {
      await loadKeys();
      handleCancelAdd();
    } else {
      setError(result.error || 'Failed to save');
    }
  };

  const handleDeleteKey = async (provider: ToolProvider) => {
    if (!confirm('Are you sure you want to remove this API key?')) return;

    setDeleting(provider);
    const result = await deleteApiKey(provider);
    setDeleting(null);

    if (result.success) {
      await loadKeys();
    } else {
      alert(result.error || 'Failed to delete');
    }
  };

  const isConfigured = (provider: ToolProvider) => {
    return configuredKeys.some(k => k.provider === provider && k.isConfigured);
  };

  const getMaskedKey = (provider: ToolProvider) => {
    const key = configuredKeys.find(k => k.provider === provider);
    return key?.maskedKey || '';
  };

  if (!open) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <IconLoader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-neutral-600 dark:text-neutral-400">
          Loading...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <IconSearch className="w-6 h-6 text-blue-500" />
          <h2 className="text-xl font-semibold text-black dark:text-white">
            Web Search Tools
          </h2>
        </div>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
          Add your own API keys to enable web search in conversations.
          Your keys are encrypted and stored securely.
        </p>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start gap-3">
          <IconInfoCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium">How it works</p>
            <p className="mt-1">
              When you enable web search, the AI can look up current information
              to answer your questions. You provide your own API key, so you
              control the usage and costs.
            </p>
          </div>
        </div>
      </div>

      {/* Provider List */}
      <div className="space-y-4">
        {Object.values(TOOL_PROVIDERS).map(provider => (
          <div
            key={provider.id}
            className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden"
          >
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-black dark:text-white">
                      {provider.name}
                    </h3>
                    {isConfigured(provider.id) && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                        <IconCheck className="w-3 h-3" />
                        Configured
                      </span>
                    )}
                  </div>
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

              {/* Configured Key Display */}
              {isConfigured(provider.id) && addingProvider !== provider.id && (
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-neutral-100 dark:bg-neutral-800 rounded font-mono text-sm">
                    {getMaskedKey(provider.id)}
                  </div>
                  <button
                    onClick={() => handleDeleteKey(provider.id)}
                    disabled={deleting === provider.id}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    title="Remove API key"
                  >
                    {deleting === provider.id ? (
                      <IconLoader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <IconTrash className="w-4 h-4" />
                    )}
                  </button>
                </div>
              )}

              {/* Add Key Form */}
              {addingProvider === provider.id ? (
                <div className="mt-3 space-y-3">
                  <div>
                    <input
                      type="password"
                      value={newApiKey}
                      onChange={e => setNewApiKey(e.target.value)}
                      placeholder={provider.apiKeyPlaceholder || 'Enter API key'}
                      className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    {error && (
                      <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                        <IconX className="w-4 h-4" />
                        {error}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveKey}
                      disabled={saving || testing || !newApiKey}
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
                          Save Key
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleCancelAdd}
                      className="px-4 py-2 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : !isConfigured(provider.id) ? (
                <button
                  onClick={() => handleAddKey(provider.id)}
                  className="mt-3 px-4 py-2 border border-blue-500 text-blue-500 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2"
                >
                  <IconKey className="w-4 h-4" />
                  Add API Key
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* Usage Note */}
      <div className="text-sm text-neutral-500 dark:text-neutral-400">
        <p>
          Once configured, you can enable web search per conversation using the
          plugins menu in the chat input.
        </p>
      </div>
    </div>
  );
};

export default ToolApiKeysTab;
