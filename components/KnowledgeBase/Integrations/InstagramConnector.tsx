/**
 * Instagram Connector
 *
 * Allows offices to import content from their Instagram accounts
 * into the knowledge base. Uses Instagram Basic Display API.
 */

import { useState } from 'react';
import {
  IconBrandInstagram,
  IconRefresh,
  IconTrash,
  IconX,
  IconPhoto,
  IconHash,
} from '@tabler/icons-react';
import { IntegrationConnection, SyncStatus } from '@/types/knowledgeBase';

interface InstagramConnectorProps {
  knowledgeBaseId: string;
  existingConnection?: IntegrationConnection;
  onConnect: (config: InstagramConfig) => Promise<{ success: boolean; authUrl?: string }>;
  onDisconnect: (integrationId: string) => Promise<boolean>;
  onSync: (integrationId: string) => Promise<boolean>;
}

interface InstagramConfig {
  instagramAccountId?: string;
  instagramUsername?: string;
  hashtagsToTrack: string[];
  includeStories: boolean;
  syncFrequency: 'hourly' | 'daily' | 'weekly';
  contentTypes: ('posts' | 'reels' | 'stories')[];
}

export default function InstagramConnector({
  knowledgeBaseId,
  existingConnection,
  onConnect,
  onDisconnect,
  onSync,
}: InstagramConnectorProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [hashtagInput, setHashtagInput] = useState('');
  const [config, setConfig] = useState<InstagramConfig>({
    hashtagsToTrack: [],
    includeStories: true,
    syncFrequency: 'daily',
    contentTypes: ['posts', 'reels'],
  });
  const [error, setError] = useState<string | null>(null);

  const isConnected = existingConnection?.status === 'connected';

  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, '');
    if (tag && !config.hashtagsToTrack.includes(tag)) {
      setConfig({
        ...config,
        hashtagsToTrack: [...config.hashtagsToTrack, tag],
      });
      setHashtagInput('');
    }
  };

  const removeHashtag = (tag: string) => {
    setConfig({
      ...config,
      hashtagsToTrack: config.hashtagsToTrack.filter((t) => t !== tag),
    });
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const result = await onConnect(config);
      if (result.success && result.authUrl) {
        // Redirect to Instagram OAuth
        window.location.href = result.authUrl;
      } else if (!result.success) {
        setError('Failed to initiate connection. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Instagram connection error:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!existingConnection) return;

    const confirmed = window.confirm(
      'Are you sure you want to disconnect Instagram? Content will stop syncing.'
    );
    if (!confirmed) return;

    try {
      const success = await onDisconnect(existingConnection.id);
      if (!success) {
        setError('Failed to disconnect. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    }
  };

  const handleSync = async () => {
    if (!existingConnection) return;

    setIsSyncing(true);
    setError(null);

    try {
      const success = await onSync(existingConnection.id);
      if (!success) {
        setError('Sync failed. Please try again.');
      }
    } catch (err) {
      setError('An error occurred during sync.');
    } finally {
      setIsSyncing(false);
    }
  };

  const formatLastSync = (date?: Date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status?: SyncStatus) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'syncing':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'error':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400';
    }
  };

  const toggleContentType = (type: 'posts' | 'reels' | 'stories') => {
    const current = config.contentTypes;
    if (current.includes(type)) {
      setConfig({
        ...config,
        contentTypes: current.filter((t) => t !== type),
      });
    } else {
      setConfig({
        ...config,
        contentTypes: [...current, type],
      });
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
            <IconBrandInstagram className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Instagram</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isConnected
                ? `@${existingConnection?.config?.instagramUsername || 'connected'}`
                : 'Import posts and stories'}
            </p>
          </div>
        </div>

        {isConnected && (
          <span
            className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(
              existingConnection?.status
            )}`}
          >
            {existingConnection?.status === 'syncing' ? 'Syncing...' : 'Connected'}
          </span>
        )}
      </div>

      {/* Connection Info */}
      {isConnected && existingConnection && (
        <div className="px-5 pb-4 border-b border-gray-100 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Last Sync:</span>
              <span className="ml-2 text-gray-900 dark:text-white">
                {formatLastSync(existingConnection.lastSyncAt)}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Posts Imported:</span>
              <span className="ml-2 text-gray-900 dark:text-white">
                {existingConnection.config?.postCount || 0}
              </span>
            </div>
          </div>

          {/* Tracked Hashtags */}
          {existingConnection.config?.hashtagsToTrack?.length > 0 && (
            <div className="mt-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">Tracking:</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {existingConnection.config.hashtagsToTrack.map((tag: string) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mx-5 my-3 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center">
          <IconX className="w-4 h-4 mr-2" />
          {error}
        </div>
      )}

      {/* Configuration Panel */}
      {showConfig && !isConnected && (
        <div className="px-5 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
            Configuration
          </h4>

          <div className="space-y-4">
            {/* Content Types */}
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                Content to Import
              </label>
              <div className="flex flex-wrap gap-2">
                {(['posts', 'reels', 'stories'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => toggleContentType(type)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      config.contentTypes.includes(type)
                        ? 'bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-400'
                        : 'bg-white border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <IconPhoto className="w-4 h-4 inline mr-1" />
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Hashtags */}
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                <IconHash className="w-4 h-4 inline mr-1" />
                Track Hashtags (optional)
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addHashtag()}
                  placeholder="studentlife"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  onClick={addHashtag}
                  className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Add
                </button>
              </div>
              {config.hashtagsToTrack.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {config.hashtagsToTrack.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs rounded-full flex items-center"
                    >
                      #{tag}
                      <button
                        onClick={() => removeHashtag(tag)}
                        className="ml-1 hover:text-purple-900 dark:hover:text-purple-200"
                      >
                        <IconX className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Sync Frequency */}
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                Sync Frequency
              </label>
              <select
                value={config.syncFrequency}
                onChange={(e) =>
                  setConfig({ ...config, syncFrequency: e.target.value as any })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="p-5 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
        {isConnected ? (
          <>
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="flex items-center space-x-2 px-4 py-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors disabled:opacity-50"
            >
              <IconRefresh className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
            <button
              onClick={handleDisconnect}
              className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
            >
              <IconTrash className="w-4 h-4" />
              <span>Disconnect</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              {showConfig ? 'Hide Options' : 'Show Options'}
            </button>
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 transition-all"
            >
              <IconBrandInstagram className="w-4 h-4" />
              <span>{isConnecting ? 'Connecting...' : 'Connect Instagram'}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
