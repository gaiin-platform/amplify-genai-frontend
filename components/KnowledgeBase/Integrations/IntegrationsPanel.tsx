/**
 * Integrations Panel
 *
 * Displays and manages all integration connectors for a knowledge base.
 * Shows Google Calendar, Instagram, and Canvas LMS connectors.
 */

import { useState, useEffect } from 'react';
import { IconPlug, IconExternalLink } from '@tabler/icons-react';
import {
  IntegrationConnection,
  IntegrationProvider,
  INTEGRATION_PROVIDERS,
} from '@/types/knowledgeBase';
import {
  getIntegrations,
  connectIntegration,
  disconnectIntegration,
  syncIntegration,
} from '@/services/knowledgeBaseService';
import GoogleCalendarConnector from './GoogleCalendarConnector';
import InstagramConnector from './InstagramConnector';
import CanvasConnector from './CanvasConnector';

interface IntegrationsPanelProps {
  knowledgeBaseId: string;
}

export default function IntegrationsPanel({ knowledgeBaseId }: IntegrationsPanelProps) {
  const [integrations, setIntegrations] = useState<IntegrationConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load existing integrations
  useEffect(() => {
    const loadIntegrations = async () => {
      try {
        const data = await getIntegrations(knowledgeBaseId);
        setIntegrations(data);
      } catch (err) {
        console.error('Error loading integrations:', err);
        setError('Failed to load integrations');
      } finally {
        setIsLoading(false);
      }
    };
    loadIntegrations();
  }, [knowledgeBaseId]);

  const getConnectionByProvider = (provider: IntegrationProvider) => {
    return integrations.find((i) => i.provider === provider);
  };

  const handleConnect = async (provider: IntegrationProvider, config: any) => {
    try {
      const result = await connectIntegration(knowledgeBaseId, provider, config);
      if (result.success && result.integration) {
        setIntegrations((prev) => [...prev, result.integration!]);
      }
      return result;
    } catch (err) {
      console.error(`Error connecting ${provider}:`, err);
      return { success: false };
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    try {
      const success = await disconnectIntegration(integrationId);
      if (success) {
        setIntegrations((prev) => prev.filter((i) => i.id !== integrationId));
      }
      return success;
    } catch (err) {
      console.error('Error disconnecting:', err);
      return false;
    }
  };

  const handleSync = async (integrationId: string) => {
    try {
      // Update status to syncing
      setIntegrations((prev) =>
        prev.map((i) => (i.id === integrationId ? { ...i, status: 'syncing' as const } : i))
      );

      const success = await syncIntegration(integrationId);

      // Update status based on result
      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === integrationId
            ? { ...i, status: success ? 'connected' : 'error', lastSyncAt: new Date() }
            : i
        )
      );

      return success;
    } catch (err) {
      console.error('Error syncing:', err);
      setIntegrations((prev) =>
        prev.map((i) => (i.id === integrationId ? { ...i, status: 'error' as const } : i))
      );
      return false;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-3 text-gray-500 dark:text-gray-400">Loading integrations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <IconPlug className="w-5 h-5 mr-2" />
            Connected Integrations
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Automatically sync content from external tools into your knowledge base
          </p>
        </div>
        <a
          href="https://docs.amplify.holyfamily.edu/integrations"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
        >
          Learn more
          <IconExternalLink className="w-4 h-4 ml-1" />
        </a>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {/* Primary Integrations - Full Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GoogleCalendarConnector
          knowledgeBaseId={knowledgeBaseId}
          existingConnection={getConnectionByProvider('google_calendar')}
          onConnect={(config) => handleConnect('google_calendar', config)}
          onDisconnect={handleDisconnect}
          onSync={handleSync}
        />

        <CanvasConnector
          knowledgeBaseId={knowledgeBaseId}
          existingConnection={getConnectionByProvider('canvas')}
          onConnect={(config) => handleConnect('canvas', config)}
          onDisconnect={handleDisconnect}
          onSync={handleSync}
        />
      </div>

      {/* Instagram - Full Width */}
      <InstagramConnector
        knowledgeBaseId={knowledgeBaseId}
        existingConnection={getConnectionByProvider('instagram')}
        onConnect={(config) => handleConnect('instagram', config)}
        onDisconnect={handleDisconnect}
        onSync={handleSync}
      />

      {/* Additional Integrations */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
          More Integrations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {INTEGRATION_PROVIDERS.filter(
            (p) => !['google_calendar', 'instagram', 'canvas'].includes(p.id)
          ).map((provider) => {
            const connection = getConnectionByProvider(provider.id);
            const isConnected = connection?.status === 'connected';

            return (
              <div
                key={provider.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{provider.icon}</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      {provider.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {isConnected ? 'Connected' : 'Coming soon'}
                    </p>
                  </div>
                </div>
                <button
                  disabled={!isConnected}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 opacity-50 cursor-not-allowed"
                >
                  {isConnected ? 'Manage' : 'Connect'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Integration Stats */}
      {integrations.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Sync Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {integrations.length}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Active Integrations
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {integrations.filter((i) => i.status === 'connected').length}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Connected</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {integrations.filter((i) => i.status === 'syncing').length}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Syncing</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {integrations.filter((i) => i.status === 'error').length}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Errors</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
