/**
 * MCP Servers Tab
 *
 * Allows users to configure MCP (Model Context Protocol) servers
 * for extended tool capabilities like Jupyter notebooks, databases, etc.
 */

import { FC, useEffect, useState } from 'react';
import {
  IconServer,
  IconPlus,
  IconTrash,
  IconCheck,
  IconX,
  IconExternalLink,
  IconLoader2,
  IconRefresh,
  IconInfoCircle,
  IconTool,
  IconPlugConnected,
  IconPlugConnectedX,
} from '@tabler/icons-react';
import {
  MCPServerConfig,
  MCPServerFormData,
  MCPTool,
  MCPOAuth2Config,
  MCP_SERVER_PRESETS,
  validateMCPServerUrl,
} from '@/types/mcp';
import {
  listMCPServers,
  addMCPServer,
  deleteMCPServer,
  testMCPConnection,
  toggleMCPServer,
  refreshMCPServerTools,
  startMCPOAuth,
  disconnectMCPOAuth,
} from '@/services/mcpService';

interface Props {
  open: boolean;
  setUnsavedChanges?: (hasChanges: boolean) => void;
}

export const MCPServersTab: FC<Props> = ({ open, setUnsavedChanges }) => {
  const [servers, setServers] = useState<MCPServerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<MCPServerFormData>({
    name: '',
    url: '',
    transport: 'http',
  });
  const [authHeader, setAuthHeader] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; tools?: MCPTool[]; error?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [expandedServerId, setExpandedServerId] = useState<string | null>(null);

  // OAuth2 state: which server is showing the OAuth form, and its field values
  const [oauthServerId, setOauthServerId] = useState<string | null>(null);
  const [oauthForm, setOauthForm] = useState<MCPOAuth2Config>({
    clientId: '', clientSecret: '', authorizationUrl: '', tokenUrl: '', scopes: ''
  });
  const [oauthConnecting, setOauthConnecting] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  // Track unsaved form changes
  useEffect(() => {
    if (setUnsavedChanges) {
      const hasFormData = showAddForm && (formData.name.trim() !== '' || formData.url.trim() !== '');
      setUnsavedChanges(hasFormData);
    }
  }, [showAddForm, formData, setUnsavedChanges]);

  // Load servers
  useEffect(() => {
    if (open) {
      loadServers();
    }
  }, [open]);

  const loadServers = async () => {
    setLoading(true);
    try {
      const serverList = await listMCPServers();
      setServers(serverList);
    } catch (e) {
      console.error('Failed to load MCP servers:', e);
    }
    setLoading(false);
  };

  const handleShowAddForm = () => {
    setShowAddForm(true);
    setFormData({ name: '', url: '', transport: 'http' });
    setAuthHeader('');
    setError(null);
    setTestResult(null);
  };

  const handleCancelAdd = () => {
    setShowAddForm(false);
    setFormData({ name: '', url: '', transport: 'http' });
    setAuthHeader('');
    setError(null);
    setTestResult(null);
  };

  const handlePresetSelect = (presetId: string) => {
    const preset = MCP_SERVER_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setFormData({
        name: preset.name,
        url: preset.defaultUrl,
        transport: preset.transport,
      });
      setAuthHeader('');
    }
  };

  const handleTestConnection = async () => {
    if (!formData.url) {
      setError('Server URL is required');
      return;
    }

    if (!validateMCPServerUrl(formData.url)) {
      setError('Invalid URL format. Must start with http:// or https://');
      return;
    }

    setTesting(true);
    setError(null);
    setTestResult(null);

    const headers: Record<string, string> = {};
    if (authHeader.trim()) headers['Authorization'] = authHeader.trim();
    const result = await testMCPConnection({ ...formData, headers });
    setTesting(false);

    if (result.success) {
      setTestResult({ success: true, tools: result.tools });
    } else if (result.requiresAuth) {
      setTestResult({ success: false, error: 'Server requires authentication. Add an Authorization header above, or save the server first and connect via OAuth2.' });
    } else {
      setTestResult({ success: false, error: result.error });
    }
  };

  const handleAddServer = async () => {
    if (!formData.name.trim()) {
      setError('Server name is required');
      return;
    }

    if (!formData.url.trim()) {
      setError('Server URL is required');
      return;
    }

    if (!validateMCPServerUrl(formData.url)) {
      setError('Invalid URL format. Must start with http:// or https://');
      return;
    }

    setSaving(true);
    setError(null);

    const headers: Record<string, string> = {};
    if (authHeader.trim()) headers['Authorization'] = authHeader.trim();
    const result = await addMCPServer({ ...formData, headers });
    setSaving(false);

    if (result.success) {
      await loadServers();
      handleCancelAdd();
    } else {
      setError(result.error || 'Failed to add server');
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    if (!confirm('Are you sure you want to remove this MCP server?')) return;

    setDeletingId(serverId);
    const result = await deleteMCPServer(serverId);
    setDeletingId(null);

    if (result.success) {
      await loadServers();
    } else {
      alert(result.error || 'Failed to delete server');
    }
  };

  const handleToggleServer = async (serverId: string, enabled: boolean) => {
    setTogglingId(serverId);
    const result = await toggleMCPServer(serverId, enabled);
    setTogglingId(null);

    if (result.success) {
      await loadServers();
    }
  };

  const handleRefreshTools = async (serverId: string) => {
    setRefreshingId(serverId);
    const result = await refreshMCPServerTools(serverId);
    setRefreshingId(null);

    if (result.success) {
      await loadServers();
    } else if (result.requiresAuth) {
      await loadServers();
      setOauthServerId(serverId);
    } else {
      alert(result.error || 'Failed to refresh tools');
    }
  };

  const toggleExpanded = (serverId: string) => {
    setExpandedServerId(expandedServerId === serverId ? null : serverId);
  };

  const handleConnectOAuth = async (serverId: string, manualConfig?: typeof oauthForm) => {
    // If a manual config is provided its fields must be filled; if not we rely on
    // backend auto-discovery (just pass serverId with no extra fields).
    if (manualConfig && (!manualConfig.clientId || !manualConfig.authorizationUrl || !manualConfig.tokenUrl)) {
      alert('Client ID, Authorization URL and Token URL are required.');
      return;
    }
    setOauthConnecting(serverId);
    const redirectUri = `${window.location.origin}/mcp-oauth-callback`;
    const result = await startMCPOAuth(serverId, manualConfig, redirectUri);
    setOauthConnecting(null);
    if (result.success && result.authorizationUrl) {
      // Open the auth URL in a popup; poll for window close then reload servers
      const popup = window.open(result.authorizationUrl, '_blank', 'width=600,height=700');
      if (!popup) {
        alert('Popup was blocked. Please allow popups for this site and try again.');
        return;
      }
      const timer = setInterval(async () => {
        if (popup && popup.closed) {
          clearInterval(timer);
          clearTimeout(timeoutId);
          setOauthServerId(null);
          await loadServers();
        }
      }, 1000);
      const timeoutId = window.setTimeout(() => {
        clearInterval(timer);
      }, 5 * 60 * 1000);
    } else {
      alert(result.error || 'Failed to start OAuth flow');
    }
  };

  const handleDisconnectOAuth = async (serverId: string) => {
    if (!confirm('Remove the OAuth token for this server?')) return;
    setDisconnectingId(serverId);
    const result = await disconnectMCPOAuth(serverId);
    setDisconnectingId(null);
    if (result.success) {
      await loadServers();
    } else {
      alert(result.error || 'Failed to disconnect OAuth');
    }
  };

  const renderManualOAuthForm = (serverId: string) => (
    <div className="mt-3 space-y-3 p-3 bg-purple-50/50 dark:bg-purple-900/10 rounded border border-purple-200 dark:border-purple-800">
      <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">OAuth2 Settings</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Client ID</label>
          <input type="text" value={oauthForm.clientId} onChange={e => setOauthForm({ ...oauthForm, clientId: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500" />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Client Secret</label>
          <input type="password" value={oauthForm.clientSecret} onChange={e => setOauthForm({ ...oauthForm, clientSecret: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Authorization URL</label>
        <input type="text" value={oauthForm.authorizationUrl} onChange={e => setOauthForm({ ...oauthForm, authorizationUrl: e.target.value })} placeholder="https://provider.com/oauth/authorize" className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500" />
      </div>
      <div>
        <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Token URL</label>
        <input type="text" value={oauthForm.tokenUrl} onChange={e => setOauthForm({ ...oauthForm, tokenUrl: e.target.value })} placeholder="https://provider.com/oauth/token" className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500" />
      </div>
      <div>
        <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Scopes <span className="text-neutral-400">(space-separated, optional)</span></label>
        <input type="text" value={oauthForm.scopes ?? ''} onChange={e => setOauthForm({ ...oauthForm, scopes: e.target.value })} placeholder="read write" className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500" />
      </div>
      <button onClick={() => handleConnectOAuth(serverId, oauthForm)} disabled={oauthConnecting === serverId} className="px-3 py-1.5 bg-purple-500 text-white text-sm rounded hover:bg-purple-600 disabled:opacity-50 flex items-center gap-2">
        {oauthConnecting === serverId ? (
          <><IconLoader2 className="w-4 h-4 animate-spin" />Redirecting...</>
        ) : (
          <><IconPlugConnected className="w-4 h-4" />Authorize</>
        )}
      </button>
    </div>
  );

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconServer className="w-6 h-6 text-purple-500" />
            <h2 className="text-xl font-semibold text-black dark:text-white">
              MCP Servers
            </h2>
          </div>
          {!showAddForm && (
            <button
              onClick={handleShowAddForm}
              className="px-3 py-1.5 bg-purple-500 text-white rounded hover:bg-purple-600 flex items-center gap-1 text-sm"
            >
              <IconPlus className="w-4 h-4" />
              Add Server
            </button>
          )}
        </div>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
          Connect to MCP servers for extended tool capabilities like Jupyter notebooks,
          file systems, databases, and more.
        </p>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
        <div className="flex items-start gap-3">
          <IconInfoCircle className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-purple-700 dark:text-purple-300">
            <p className="font-medium">What is MCP?</p>
            <p className="mt-1">
              Model Context Protocol (MCP) allows the AI to interact with external tools
              and services. When you connect an MCP server, its tools become available
              for the AI to use during conversations.
            </p>
          </div>
        </div>
      </div>

      {/* Add Server Form */}
      {showAddForm && (
        <div className="border border-purple-300 dark:border-purple-700 rounded-lg p-4 bg-purple-50/50 dark:bg-purple-900/10">
          <h3 className="font-medium text-black dark:text-white mb-4">
            Add MCP Server
          </h3>

          {/* Quick Presets */}
          <div className="mb-4">
            <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-2">
              Quick Start (select a preset)
            </label>
            <div className="flex flex-wrap gap-2">
              {MCP_SERVER_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetSelect(preset.id)}
                  className="px-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  title={preset.description}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                Server Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Jupyter Server"
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                Server URL
              </label>
              <input
                type="text"
                value={formData.url}
                onChange={e => setFormData({ ...formData, url: e.target.value })}
                placeholder="http://localhost:8888/mcp"
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                Transport
              </label>
              <select
                value={formData.transport}
                onChange={e => setFormData({ ...formData, transport: e.target.value as 'http' | 'sse' })}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="http">HTTP (Recommended)</option>
                <option value="sse">SSE (Server-Sent Events)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                Authorization Header{' '}
                <span className="text-neutral-400 dark:text-neutral-500 font-normal">(optional)</span>
              </label>
              <input
                type="password"
                value={authHeader}
                onChange={e => setAuthHeader(e.target.value)}
                placeholder="Bearer your-api-key"
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                Sent as the <code className="font-mono">Authorization</code> header. Required for servers like scite.ai.
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <IconX className="w-4 h-4" />
                {error}
              </p>
            )}

            {testResult && (
              <div className={`p-3 rounded ${testResult.success ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
                {testResult.success ? (
                  <div>
                    <p className="text-green-700 dark:text-green-300 flex items-center gap-1">
                      <IconCheck className="w-4 h-4" />
                      Connection successful!
                    </p>
                    {testResult.tools && testResult.tools.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm text-green-600 dark:text-green-400">
                          Discovered {testResult.tools.length} tool(s):
                        </p>
                        <ul className="mt-1 text-sm text-green-700 dark:text-green-300 list-disc list-inside">
                          {testResult.tools.slice(0, 5).map(tool => (
                            <li key={tool.name}>{tool.name}</li>
                          ))}
                          {testResult.tools.length > 5 && (
                            <li>...and {testResult.tools.length - 5} more</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-red-700 dark:text-red-300 flex items-center gap-1">
                    <IconX className="w-4 h-4" />
                    {testResult.error || 'Connection failed'}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleTestConnection}
                disabled={testing || !formData.url}
                className="px-4 py-2 border border-purple-500 text-purple-500 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {testing ? (
                  <>
                    <IconLoader2 className="w-4 h-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <IconPlugConnected className="w-4 h-4" />
                    Test Connection
                  </>
                )}
              </button>
              <button
                onClick={handleAddServer}
                disabled={saving || !formData.name || !formData.url}
                className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <IconLoader2 className="w-4 h-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <IconPlus className="w-4 h-4" />
                    Add Server
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
        </div>
      )}

      {/* Server List */}
      {servers.length === 0 && !showAddForm ? (
        <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
          <IconServer className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No MCP servers configured yet.</p>
          <p className="text-sm mt-1">
            Click &quot;Add Server&quot; to connect to an MCP server.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map(server => (
            <div
              key={server.id}
              className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {server.status === 'connected' ? (
                        <IconPlugConnected className="w-4 h-4 text-green-500" />
                      ) : server.status === 'error' ? (
                        <IconPlugConnectedX className="w-4 h-4 text-red-500" />
                      ) : (
                        <IconPlugConnectedX className="w-4 h-4 text-neutral-400" />
                      )}
                      <h3 className="font-medium text-black dark:text-white">
                        {server.name}
                      </h3>
                      {server.enabled ? (
                        <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                          Enabled
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 rounded-full">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 font-mono">
                      {server.url}
                    </p>
                    {server.tools.length > 0 && (
                      <button
                        onClick={() => toggleExpanded(server.id)}
                        className="text-sm text-purple-500 hover:text-purple-600 mt-2 flex items-center gap-1"
                      >
                        <IconTool className="w-3 h-3" />
                        {server.tools.length} tool(s) available
                        <span className="text-xs">
                          {expandedServerId === server.id ? '(hide)' : '(show)'}
                        </span>
                      </button>
                    )}
                    {server.lastError && (
                      <p className="text-sm text-red-500 mt-1">
                        Error: {server.lastError}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRefreshTools(server.id)}
                      disabled={refreshingId === server.id}
                      className="p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded"
                      title="Refresh tools"
                    >
                      {refreshingId === server.id ? (
                        <IconLoader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <IconRefresh className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleToggleServer(server.id, !server.enabled)}
                      disabled={togglingId === server.id}
                      className={`p-2 rounded ${server.enabled ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
                      title={server.enabled ? 'Disable server' : 'Enable server'}
                    >
                      {togglingId === server.id ? (
                        <IconLoader2 className="w-4 h-4 animate-spin" />
                      ) : server.enabled ? (
                        <IconCheck className="w-4 h-4" />
                      ) : (
                        <IconX className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteServer(server.id)}
                      disabled={deletingId === server.id}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      title="Remove server"
                    >
                      {deletingId === server.id ? (
                        <IconLoader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <IconTrash className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Tools List */}
                {expandedServerId === server.id && server.tools.length > 0 && (
                  <div className="mt-3 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                      Available Tools:
                    </p>
                    <div className="space-y-2">
                      {server.tools.map(tool => (
                        <div key={tool.name} className="text-sm">
                          <span className="font-mono text-purple-600 dark:text-purple-400">
                            {tool.name}
                          </span>
                          {tool.description && (
                            <p className="text-neutral-500 dark:text-neutral-400 text-xs mt-0.5">
                              {tool.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* OAuth2 section */}
                <div className="mt-3 border-t border-neutral-100 dark:border-neutral-700 pt-3">
                  {server.oauthConnected ? (
                    /* ── Already connected ── */
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <IconCheck className="w-3 h-3" />
                        OAuth connected
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleConnectOAuth(server.id)}
                          disabled={oauthConnecting === server.id}
                          className="text-xs text-purple-500 hover:text-purple-600 disabled:opacity-50"
                        >
                          {oauthConnecting === server.id ? 'Signing in…' : 'Re-authenticate'}
                        </button>
                        <button
                          onClick={() => handleDisconnectOAuth(server.id)}
                          disabled={disconnectingId === server.id}
                          className="text-xs text-red-500 hover:text-red-600 disabled:opacity-50"
                        >
                          {disconnectingId === server.id ? 'Disconnecting…' : 'Disconnect'}
                        </button>
                      </div>
                    </div>
                  ) : server.oauthDiscoverable ? (
                    /* ── Auto-discoverable (e.g. scite.ai) ── */
                    <div className="space-y-2">
                      <button
                        onClick={() => handleConnectOAuth(server.id)}
                        disabled={oauthConnecting === server.id}
                        className="flex items-center gap-2 px-3 py-1.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white text-sm rounded"
                      >
                        {oauthConnecting === server.id ? (
                          <><IconLoader2 className="w-4 h-4 animate-spin" />Signing in…</>
                        ) : (
                          <><IconPlugConnected className="w-4 h-4" />Sign in with {server.name}</>
                        )}
                      </button>
                      {/* Advanced: manual override */}
                      <button
                        onClick={() => setOauthServerId(oauthServerId === server.id ? null : server.id)}
                        className="text-xs text-neutral-400 hover:text-neutral-500"
                      >
                        {oauthServerId === server.id ? 'Hide advanced' : 'Advanced (manual config)'}
                      </button>
                      {oauthServerId === server.id && (
                        renderManualOAuthForm(server.id)
                      )}
                    </div>
                  ) : (
                    /* ── Manual OAuth config ── */
                    <>
                      <button
                        onClick={() => setOauthServerId(oauthServerId === server.id ? null : server.id)}
                        className="text-xs text-purple-500 hover:text-purple-600 flex items-center gap-1"
                      >
                        <IconPlugConnected className="w-3 h-3" />
                        {oauthServerId === server.id ? 'Cancel OAuth setup' : 'Connect with OAuth2'}
                      </button>

                      {oauthServerId === server.id && (
                        renderManualOAuthForm(server.id)
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Documentation Link */}
      <div className="text-sm text-neutral-500 dark:text-neutral-400">
        <a
          href="https://modelcontextprotocol.io/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-purple-500 hover:text-purple-600"
        >
          Learn more about MCP
          <IconExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};

export default MCPServersTab;
