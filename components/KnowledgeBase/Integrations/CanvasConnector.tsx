/**
 * Canvas LMS Connector
 *
 * Allows offices to sync course content, announcements, and assignments
 * from Canvas LMS into the knowledge base.
 *
 * Uses the existing canvasService for OAuth and API calls.
 */

import { useState, useEffect } from 'react';
import {
  IconSchool,
  IconRefresh,
  IconTrash,
  IconX,
  IconBook,
  IconSpeakerphone,
  IconClipboardList,
} from '@tabler/icons-react';
import { IntegrationConnection, SyncStatus } from '@/types/knowledgeBase';
import { canvasService, CanvasCourse, CanvasStatus } from '@/services/canvasService';

interface CanvasConnectorProps {
  knowledgeBaseId: string;
  existingConnection?: IntegrationConnection;
  onConnect: (config: CanvasConfig) => Promise<{ success: boolean; authUrl?: string }>;
  onDisconnect: (integrationId: string) => Promise<boolean>;
  onSync: (integrationId: string) => Promise<boolean>;
}

interface CanvasConfig {
  canvasCourseIds: string[];
  includeAssignments: boolean;
  includeAnnouncements: boolean;
  includeSyllabus: boolean;
  syncFrequency: 'hourly' | 'daily' | 'weekly';
}

export default function CanvasConnector({
  knowledgeBaseId,
  existingConnection,
  onConnect,
  onDisconnect,
  onSync,
}: CanvasConnectorProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [canvasStatus, setCanvasStatus] = useState<CanvasStatus | null>(null);
  const [courses, setCourses] = useState<CanvasCourse[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [config, setConfig] = useState<CanvasConfig>({
    canvasCourseIds: [],
    includeAssignments: true,
    includeAnnouncements: true,
    includeSyllabus: true,
    syncFrequency: 'daily',
  });
  const [error, setError] = useState<string | null>(null);

  // Check Canvas connection status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await canvasService.getStatus();
        setCanvasStatus(status);

        if (status.connected) {
          setLoadingCourses(true);
          const userCourses = await canvasService.getCourses();
          setCourses(userCourses);
          setLoadingCourses(false);
        }
      } catch (err: any) {
        console.error('Error checking Canvas status:', err);
        setError(err?.message || 'Failed to check Canvas connection status.');
      }
    };
    checkStatus();
  }, []);

  const isConnected =
    existingConnection?.status === 'connected' || canvasStatus?.connected;

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      // Use canvasService to initiate OAuth
      const oauthResponse = await canvasService.initiateOAuth();
      if (oauthResponse.auth_url) {
        window.location.href = oauthResponse.auth_url;
      }
    } catch (err) {
      setError('Failed to connect to Canvas. Please try again.');
      console.error('Canvas connection error:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSetupIntegration = async () => {
    // After Canvas OAuth, save integration config
    const fullConfig: CanvasConfig = {
      ...config,
      canvasCourseIds: selectedCourses,
    };

    try {
      const result = await onConnect(fullConfig);
      if (!result.success) {
        setError('Failed to save integration settings.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    }
  };

  const handleDisconnect = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to disconnect Canvas? Course content will stop syncing.'
    );
    if (!confirmed) return;

    try {
      // Disconnect from canvasService and knowledge base
      await canvasService.disconnect();
      if (existingConnection) {
        await onDisconnect(existingConnection.id);
      }
      setCanvasStatus({ connected: false });
    } catch (err) {
      setError('Failed to disconnect. Please try again.');
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

  const toggleCourse = (courseId: string) => {
    setSelectedCourses((prev) =>
      prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId]
    );
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
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
            <IconSchool className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Canvas LMS</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isConnected
                ? `Connected as ${canvasStatus?.canvas_user_name || 'user'}`
                : 'Sync course content'}
            </p>
          </div>
        </div>

        {isConnected && (
          <span
            className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(
              existingConnection?.status || (canvasStatus?.connected ? 'connected' : undefined)
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
              <span className="text-gray-500 dark:text-gray-400">Courses:</span>
              <span className="ml-2 text-gray-900 dark:text-white">
                {existingConnection.config?.canvasCourseIds?.length || 0} selected
              </span>
            </div>
          </div>

          {/* Content Types */}
          <div className="mt-3 flex flex-wrap gap-2">
            {existingConnection.config?.includeAssignments && (
              <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs rounded-full flex items-center">
                <IconClipboardList className="w-3 h-3 mr-1" />
                Assignments
              </span>
            )}
            {existingConnection.config?.includeAnnouncements && (
              <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs rounded-full flex items-center">
                <IconSpeakerphone className="w-3 h-3 mr-1" />
                Announcements
              </span>
            )}
            {existingConnection.config?.includeSyllabus && (
              <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs rounded-full flex items-center">
                <IconBook className="w-3 h-3 mr-1" />
                Syllabus
              </span>
            )}
          </div>
        </div>
      )}

      {/* Canvas Connected but not configured for KB */}
      {canvasStatus?.connected && !existingConnection && (
        <div className="px-5 py-4 bg-yellow-50 dark:bg-yellow-900/20 border-t border-gray-100 dark:border-gray-700">
          <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-4">
            You're connected to Canvas as{' '}
            <strong>{canvasStatus.canvas_user_name}</strong>. Select courses to
            sync to your knowledge base.
          </p>

          {/* Course Selection */}
          {loadingCourses ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Loading courses...</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {courses.map((course) => (
                <label
                  key={course.id}
                  className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedCourses.includes(course.id.toString())}
                    onChange={() => toggleCourse(course.id.toString())}
                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                  />
                  <span className="ml-3 text-sm text-gray-900 dark:text-white">
                    {course.name}
                  </span>
                  <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                    {course.course_code}
                  </span>
                </label>
              ))}
            </div>
          )}

          {/* Content Options */}
          <div className="mt-4 space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.includeAssignments}
                onChange={(e) =>
                  setConfig({ ...config, includeAssignments: e.target.checked })
                }
                className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Include assignments
              </span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.includeAnnouncements}
                onChange={(e) =>
                  setConfig({ ...config, includeAnnouncements: e.target.checked })
                }
                className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Include announcements
              </span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.includeSyllabus}
                onChange={(e) =>
                  setConfig({ ...config, includeSyllabus: e.target.checked })
                }
                className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Include syllabus
              </span>
            </label>
          </div>

          <button
            onClick={handleSetupIntegration}
            disabled={selectedCourses.length === 0}
            className="mt-4 w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Integration ({selectedCourses.length} courses selected)
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mx-5 my-3 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center">
          <IconX className="w-4 h-4 mr-2" />
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="p-5 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
        {isConnected && existingConnection ? (
          <>
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
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
        ) : canvasStatus?.connected ? (
          <div className="text-sm text-gray-500">
            Configure courses above to complete setup
          </div>
        ) : (
          <>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Holy Family University Canvas
            </div>
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              <IconSchool className="w-4 h-4" />
              <span>{isConnecting ? 'Connecting...' : 'Connect Canvas'}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
