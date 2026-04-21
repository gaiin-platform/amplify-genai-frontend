/**
 * Google Calendar Connector
 *
 * Allows offices to sync events from their Google Calendar
 * into the knowledge base for student-facing queries.
 */

import { useState, useEffect } from 'react';
import {
  IconBrandGoogle,
  IconRefresh,
  IconTrash,
  IconCheck,
  IconX,
  IconCalendar,
} from '@tabler/icons-react';
import { IntegrationConnection, SyncStatus } from '@/types/knowledgeBase';

interface GoogleCalendarConnectorProps {
  knowledgeBaseId: string;
  existingConnection?: IntegrationConnection;
  onConnect: (config: GoogleCalendarConfig) => Promise<{ success: boolean; authUrl?: string }>;
  onDisconnect: (integrationId: string) => Promise<boolean>;
  onSync: (integrationId: string) => Promise<boolean>;
}

interface GoogleCalendarConfig {
  calendarId?: string;
  calendarName?: string;
  syncFrequency: 'realtime' | 'hourly' | 'daily';
  includePrivateEvents: boolean;
}

interface CalendarOption {
  id: string;
  name: string;
  primary: boolean;
}

export default function GoogleCalendarConnector({
  knowledgeBaseId,
  existingConnection,
  onConnect,
  onDisconnect,
  onSync,
}: GoogleCalendarConnectorProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [calendars, setCalendars] = useState<CalendarOption[]>([]);
  const [config, setConfig] = useState<GoogleCalendarConfig>({
    calendarId: '',
    calendarName: '',
    syncFrequency: 'hourly',
    includePrivateEvents: false,
  });
  const [error, setError] = useState<string | null>(null);

  const isConnected = existingConnection?.status === 'connected';

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const result = await onConnect(config);
      if (result.success && result.authUrl) {
        // Redirect to Google OAuth
        window.location.href = result.authUrl;
      } else if (!result.success) {
        setError('Failed to initiate connection. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Google Calendar connection error:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!existingConnection) return;

    const confirmed = window.confirm(
      'Are you sure you want to disconnect Google Calendar? Events will stop syncing.'
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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
            <IconBrandGoogle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Google Calendar</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isConnected
                ? `Connected: ${existingConnection?.displayName || 'Calendar'}`
                : 'Sync events automatically'}
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
              <span className="text-gray-500 dark:text-gray-400">Frequency:</span>
              <span className="ml-2 text-gray-900 dark:text-white capitalize">
                {existingConnection.syncFrequency}
              </span>
            </div>
          </div>
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
                <option value="realtime">Real-time (webhook)</option>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
              </select>
            </div>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.includePrivateEvents}
                onChange={(e) =>
                  setConfig({ ...config, includePrivateEvents: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Include private events
              </span>
            </label>
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
              className="flex items-center space-x-2 px-4 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors disabled:opacity-50"
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
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <IconBrandGoogle className="w-4 h-4" />
              <span>{isConnecting ? 'Connecting...' : 'Connect Google Calendar'}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
