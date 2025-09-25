/**
 * MCPServerSettings Component
 *
 * Main component for managing MCP server configurations, providing
 * a comprehensive interface for adding, editing, and managing MCP servers.
 */

import React, { useState, useEffect } from 'react';
import {
  IconPlus,
  IconSettings,
  IconCheck,
  IconX,
  IconRefresh,
  IconTrash,
  IconEdit,
  IconTestPipe
} from '@tabler/icons-react';
import {
  MCPServerConfig,
  MCPStatusResponse,
  MCPTestResponse,
  MCPServerSettingsProps
} from '@/types/mcp';
import { mcpService } from '@/services/mcpService';
import { MCPServerForm } from './MCPServerForm';
import { MCPToolsList } from './MCPToolsList';
import toast from 'react-hot-toast';

export const MCPServerSettings: React.FC<MCPServerSettingsProps> = ({
  servers: initialServers,
  onServerAdd,
  onServerEdit,
  onServerDelete,
  onServerToggle,
  onServerTest,
}) => {
  const [servers, setServers] = useState<MCPServerConfig[]>(initialServers);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServerConfig | null>(null);
  const [testingServers, setTestingServers] = useState<Set<string>>(new Set());
  const [mcpStatus, setMcpStatus] = useState<MCPStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [showTools, setShowTools] = useState(false);

  useEffect(() => {
    loadMCPStatus();
  }, []);

  const loadMCPStatus = async () => {
    try {
      const status = await mcpService.getStatus();
      setMcpStatus(status);
    } catch (error) {
      console.error('Failed to load MCP status:', error);
      toast.error('Failed to load MCP status');
    }
  };

  const handleAddServer = async (server: MCPServerConfig) => {
    try {
      const success = await mcpService.addServer(server);
      if (success) {
        const newServers = [...servers, server];
        setServers(newServers);
        onServerAdd(server);
        setShowAddForm(false);
        toast.success(`Server "${server.name}" added successfully`);
        await loadMCPStatus();
      } else {
        toast.error('Failed to add server');
      }
    } catch (error) {
      console.error('Error adding server:', error);
      toast.error('Error adding server');
    }
  };

  const handleEditServer = async (server: MCPServerConfig) => {
    try {
      const success = await mcpService.updateServer(server);
      if (success) {
        const newServers = servers.map(s => s.name === server.name ? server : s);
        setServers(newServers);
        onServerEdit(server);
        setEditingServer(null);
        toast.success(`Server "${server.name}" updated successfully`);
        await loadMCPStatus();
      } else {
        toast.error('Failed to update server');
      }
    } catch (error) {
      console.error('Error updating server:', error);
      toast.error('Error updating server');
    }
  };

  const handleDeleteServer = async (serverName: string) => {
    if (!confirm(`Are you sure you want to delete server "${serverName}"?`)) {
      return;
    }

    try {
      const success = await mcpService.deleteServer(serverName);
      if (success) {
        const newServers = servers.filter(s => s.name !== serverName);
        setServers(newServers);
        onServerDelete(serverName);
        toast.success(`Server "${serverName}" deleted successfully`);
        await loadMCPStatus();
      } else {
        toast.error('Failed to delete server');
      }
    } catch (error) {
      console.error('Error deleting server:', error);
      toast.error('Error deleting server');
    }
  };

  const handleToggleServer = async (serverName: string, enabled: boolean) => {
    try {
      const server = servers.find(s => s.name === serverName);
      if (server) {
        const updatedServer = { ...server, enabled };
        await handleEditServer(updatedServer);
        onServerToggle(serverName, enabled);
      }
    } catch (error) {
      console.error('Error toggling server:', error);
      toast.error('Error toggling server');
    }
  };

  const handleTestServer = async (serverName: string) => {
    setTestingServers(prev => new Set([...prev, serverName]));

    try {
      const success = await mcpService.testServer(serverName);
      const result = await onServerTest(serverName);

      if (success && result) {
        toast.success(`Server "${serverName}" test passed`);
      } else {
        toast.error(`Server "${serverName}" test failed`);
      }
    } catch (error) {
      console.error('Error testing server:', error);
      toast.error(`Error testing server "${serverName}"`);
    } finally {
      setTestingServers(prev => {
        const newSet = new Set(prev);
        newSet.delete(serverName);
        return newSet;
      });
    }
  };

  const runComprehensiveTest = async () => {
    setLoading(true);
    try {
      const testResult = await mcpService.runTest();
      toast.success(`Test completed! ${testResult.test_summary.servers_initialized} servers, ${testResult.test_summary.total_tools_discovered} tools`);
      await loadMCPStatus();
    } catch (error) {
      console.error('Comprehensive test failed:', error);
      toast.error('Comprehensive test failed');
    } finally {
      setLoading(false);
    }
  };

  const getServerStatusColor = (serverName: string): string => {
    if (!mcpStatus) return 'gray';
    if (mcpStatus.available_servers.includes(serverName)) return 'green';
    return 'red';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            MCP Server Settings
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Manage Model Context Protocol server configurations
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={runComprehensiveTest}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <IconTestPipe className="w-4 h-4 mr-2" />
            {loading ? 'Testing...' : 'Run Test'}
          </button>
          <button
            onClick={() => setShowTools(!showTools)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <IconSettings className="w-4 h-4 mr-2" />
            {showTools ? 'Hide Tools' : 'Show Tools'}
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <IconPlus className="w-4 h-4 mr-2" />
            Add Server
          </button>
        </div>
      </div>

      {/* Status Overview */}
      {mcpStatus && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
            Integration Status
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${
                mcpStatus.mcp_integration_available ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Integration: {mcpStatus.mcp_integration_available ? 'Available' : 'Unavailable'}
              </span>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Active Servers: {mcpStatus.available_servers.length}
              </span>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Max Tools: {mcpStatus.configuration.max_tools_per_request}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Server List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Configured Servers
          </h3>
        </div>
        <div className="p-4">
          {servers.length === 0 ? (
            <div className="text-center py-8">
              <IconSettings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                No MCP servers configured yet
              </p>
              <button
                onClick={() => setShowAddForm(true)}
                className="mt-2 text-blue-600 hover:text-blue-700"
              >
                Add your first server
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {servers.map((server) => (
                <div
                  key={server.name}
                  className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${
                      server.enabled
                        ? getServerStatusColor(server.name) === 'green'
                          ? 'bg-green-500'
                          : 'bg-red-500'
                        : 'bg-gray-400'
                    }`} />
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                        {server.name}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {server.description || `${server.type} server`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={server.enabled}
                        onChange={(e) => handleToggleServer(server.name, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        Enabled
                      </span>
                    </label>

                    <button
                      onClick={() => handleTestServer(server.name)}
                      disabled={testingServers.has(server.name)}
                      className="p-2 text-gray-500 hover:text-blue-600 disabled:opacity-50"
                      title="Test connection"
                    >
                      <IconTestPipe className={`w-4 h-4 ${
                        testingServers.has(server.name) ? 'animate-spin' : ''
                      }`} />
                    </button>

                    <button
                      onClick={() => setEditingServer(server)}
                      className="p-2 text-gray-500 hover:text-blue-600"
                      title="Edit server"
                    >
                      <IconEdit className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteServer(server.name)}
                      className="p-2 text-gray-500 hover:text-red-600"
                      title="Delete server"
                    >
                      <IconTrash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tools List */}
      {showTools && (
        <MCPToolsList
          tools={[]}
          groupByServer={true}
          showUsageStats={true}
        />
      )}

      {/* Add Server Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Add MCP Server
            </h3>
            <MCPServerForm
              onSave={handleAddServer}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        </div>
      )}

      {/* Edit Server Form Modal */}
      {editingServer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Edit MCP Server
            </h3>
            <MCPServerForm
              server={editingServer}
              onSave={handleEditServer}
              onCancel={() => setEditingServer(null)}
              isEditing={true}
            />
          </div>
        </div>
      )}
    </div>
  );
};