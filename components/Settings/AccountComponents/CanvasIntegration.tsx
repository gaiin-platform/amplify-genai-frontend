import React, { useState, useEffect, FC } from 'react';
import { IconSchool, IconUnlink, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { useTranslation } from 'next-i18next';
import { canvasService, CanvasStatus } from '@/services/canvasService';

interface CanvasIntegrationProps {
  lightMode: 'light' | 'dark';
}

export const CanvasIntegration: FC<CanvasIntegrationProps> = ({ lightMode }) => {
  const { t } = useTranslation('settings');
  const [canvasStatus, setCanvasStatus] = useState<CanvasStatus>({ connected: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    checkCanvasStatus();

    // Check for OAuth callback parameters in URL hash or query
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));

    // Check for direct JSON response (our callback returns JSON)
    const accessToken = urlParams.get('access_token') || hashParams.get('access_token');
    const canvasConnected = urlParams.get('canvas_connected');
    const canvasError = urlParams.get('canvas_error');

    if (accessToken) {
      // Handle callback with token in URL
      const refreshToken = urlParams.get('refresh_token') || hashParams.get('refresh_token') || '';
      const expiresIn = parseInt(urlParams.get('expires_in') || hashParams.get('expires_in') || '3600', 10);
      const userStr = urlParams.get('user') || hashParams.get('user');

      let user = {};
      if (userStr) {
        try {
          user = JSON.parse(decodeURIComponent(userStr));
        } catch {
          user = {};
        }
      }

      canvasService.storeTokensFromCallback(accessToken, refreshToken, expiresIn, user);
      setSuccess('Canvas connected successfully!');
      checkCanvasStatus();
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (canvasConnected === 'true') {
      setSuccess('Canvas connected successfully!');
      checkCanvasStatus();
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (canvasError) {
      setError(`Canvas connection failed: ${decodeURIComponent(canvasError)}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const checkCanvasStatus = async () => {
    try {
      setLoading(true);
      const status = await canvasService.getStatus();
      setCanvasStatus(status);
    } catch (err: any) {
      console.error('Error checking Canvas status:', err);
      setError(err?.message || 'Failed to check Canvas connection status.');
    } finally {
      setLoading(false);
    }
  };

  const connectCanvas = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await canvasService.initiateOAuth();
      if (response && response.auth_url) {
        // Redirect to Canvas OAuth page
        window.location.href = response.auth_url;
      } else {
        setError('Failed to initiate Canvas OAuth flow');
      }
    } catch (err: any) {
      console.error('Error connecting Canvas:', err);
      setError(err?.message || 'Failed to connect to Canvas. Please check your connection settings.');
    } finally {
      setLoading(false);
    }
  };

  const disconnectCanvas = async () => {
    try {
      setLoading(true);
      setError(null);

      await canvasService.disconnect();
      setCanvasStatus({ connected: false });
      setSuccess('Canvas disconnected successfully');
    } catch (err) {
      console.error('Error disconnecting Canvas:', err);
      setError('Failed to disconnect Canvas');
    } finally {
      setLoading(false);
    }
  };

  const formatExpiryDate = (expiresAt: number) => {
    const date = new Date(expiresAt * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <IconSchool size={24} />
        <h3 className="text-lg font-semibold">Canvas LMS Integration</h3>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <span className="flex items-center gap-2">
            <IconAlertCircle size={20} />
            {error}
          </span>
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert">
          <span className="flex items-center gap-2">
            <IconCheck size={20} />
            {success}
          </span>
        </div>
      )}

      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
        {canvasStatus.connected ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-green-600 dark:text-green-400 flex items-center gap-2">
                <IconCheck size={20} />
                Connected to Canvas
              </span>
              <button
                onClick={disconnectCanvas}
                disabled={loading}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 flex items-center gap-2"
              >
                <IconUnlink size={18} />
                {loading ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              {canvasStatus.canvas_base_url && (
                <p>Canvas URL: {canvasStatus.canvas_base_url}</p>
              )}
              {canvasStatus.canvas_user_name && (
                <p>User: {canvasStatus.canvas_user_name}</p>
              )}
              {canvasStatus.canvas_user_id && (
                <p>Canvas User ID: {canvasStatus.canvas_user_id}</p>
              )}
              {canvasStatus.expires_at && (
                <p>Token expires: {formatExpiryDate(canvasStatus.expires_at)}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-gray-600 dark:text-gray-400">
              Connect your Canvas LMS account to access your courses, assignments, and grades directly in your chats.
            </p>
            <button
              onClick={connectCanvas}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
            >
              <IconSchool size={18} />
              {loading ? 'Connecting...' : 'Connect Canvas'}
            </button>
          </div>
        )}
      </div>

      <div className="text-sm text-gray-500 dark:text-gray-400 mt-4">
        <h4 className="font-semibold mb-2">When Canvas is connected, you can ask questions like:</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>"What courses am I enrolled in?"</li>
          <li>"What courses am I teaching?"</li>
          <li>"What are my upcoming assignments?"</li>
          <li>"Show me recent announcements"</li>
        </ul>
      </div>
    </div>
  );
};
