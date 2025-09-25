/**
 * MCPServerForm Component
 *
 * Form component for adding and editing MCP server configurations
 * with validation and authentication options.
 */

import React, { useState, useEffect } from 'react';
import { IconX, IconCheck, IconEye, IconEyeOff } from '@tabler/icons-react';
import {
  MCPServerConfig,
  MCPServerType,
  MCPServerFormData,
  MCPServerFormProps,
  MCP_SERVER_CATEGORIES
} from '@/types/mcp';

export const MCPServerForm: React.FC<MCPServerFormProps> = ({
  server,
  onSave,
  onCancel,
  isEditing = false,
}) => {
  const [formData, setFormData] = useState<MCPServerFormData>({
    name: '',
    type: 'stdio',
    command: '',
    args: '',
    env_vars: {},
    url: '',
    auth_type: 'none',
    auth_token: '',
    auth_api_key: '',
    auth_username: '',
    auth_password: '',
    enabled: true,
    description: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [envVarsText, setEnvVarsText] = useState('');

  useEffect(() => {
    if (server) {
      setFormData({
        name: server.name,
        type: server.type,
        command: server.command || '',
        args: server.args?.join(' ') || '',
        env_vars: server.env || {},
        url: server.url || '',
        auth_type: server.auth?.type || 'none',
        auth_token: server.auth?.token || '',
        auth_api_key: server.auth?.apiKey || '',
        auth_username: server.auth?.username || '',
        auth_password: server.auth?.password || '',
        enabled: server.enabled,
        description: server.description || '',
      });

      // Convert env vars to text format
      const envText = Object.entries(server.env || {})
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
      setEnvVarsText(envText);
    }
  }, [server]);

  const handleInputChange = (field: keyof MCPServerFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleEnvVarsChange = (text: string) => {
    setEnvVarsText(text);
    try {
      const envVars: Record<string, string> = {};
      text.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && trimmed.includes('=')) {
          const [key, ...valueParts] = trimmed.split('=');
          envVars[key.trim()] = valueParts.join('=').trim();
        }
      });
      setFormData(prev => ({ ...prev, env_vars: envVars }));
    } catch (error) {
      // Invalid format, but don't error immediately
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Required fields
    if (!formData.name.trim()) {
      newErrors.name = 'Server name is required';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.name)) {
      newErrors.name = 'Server name must contain only letters, numbers, hyphens, and underscores';
    }

    // Type-specific validation
    switch (formData.type) {
      case 'stdio':
        if (!formData.command.trim()) {
          newErrors.command = 'Command is required for stdio servers';
        }
        break;
      case 'http':
      case 'websocket':
        if (!formData.url.trim()) {
          newErrors.url = 'URL is required for HTTP/WebSocket servers';
        } else {
          try {
            new URL(formData.url);
          } catch {
            newErrors.url = 'Please enter a valid URL';
          }
        }
        break;
    }

    // Authentication validation
    if (formData.auth_type !== 'none') {
      switch (formData.auth_type) {
        case 'bearer':
          if (!formData.auth_token.trim()) {
            newErrors.auth_token = 'Bearer token is required';
          }
          break;
        case 'api_key':
          if (!formData.auth_api_key.trim()) {
            newErrors.auth_api_key = 'API key is required';
          }
          break;
        case 'basic':
          if (!formData.auth_username.trim()) {
            newErrors.auth_username = 'Username is required';
          }
          if (!formData.auth_password.trim()) {
            newErrors.auth_password = 'Password is required';
          }
          break;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Convert form data to MCPServerConfig
    const serverConfig: MCPServerConfig = {
      name: formData.name.trim(),
      type: formData.type,
      enabled: formData.enabled,
      description: formData.description.trim(),
    };

    // Add type-specific configuration
    switch (formData.type) {
      case 'stdio':
        serverConfig.command = formData.command.trim();
        serverConfig.args = formData.args.trim()
          ? formData.args.trim().split(/\s+/)
          : [];
        serverConfig.env = formData.env_vars;
        break;
      case 'http':
      case 'websocket':
        serverConfig.url = formData.url.trim();
        break;
    }

    // Add authentication if configured
    if (formData.auth_type !== 'none') {
      serverConfig.auth = {
        type: formData.auth_type,
      };

      switch (formData.auth_type) {
        case 'bearer':
          serverConfig.auth.token = formData.auth_token.trim();
          break;
        case 'api_key':
          serverConfig.auth.apiKey = formData.auth_api_key.trim();
          break;
        case 'basic':
          serverConfig.auth.username = formData.auth_username.trim();
          serverConfig.auth.password = formData.auth_password.trim();
          break;
      }
    }

    onSave(serverConfig);
  };

  const serverTypeOptions: { value: MCPServerType; label: string; description: string }[] = [
    {
      value: 'stdio',
      label: 'Standard I/O',
      description: 'Run server as a subprocess with stdin/stdout communication'
    },
    {
      value: 'http',
      label: 'HTTP',
      description: 'Connect to server via HTTP REST API'
    },
    {
      value: 'websocket',
      label: 'WebSocket',
      description: 'Connect to server via WebSocket'
    },
  ];

  const authTypeOptions = [
    { value: 'none', label: 'No Authentication' },
    { value: 'bearer', label: 'Bearer Token' },
    { value: 'api_key', label: 'API Key' },
    { value: 'basic', label: 'Basic Auth' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Server Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            disabled={isEditing}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
            placeholder="e.g., filesystem, database"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Server Type *
          </label>
          <select
            value={formData.type}
            onChange={(e) => handleInputChange('type', e.target.value as MCPServerType)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {serverTypeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {serverTypeOptions.find(opt => opt.value === formData.type)?.description}
          </p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Description
        </label>
        <input
          type="text"
          value={formData.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="Brief description of this server"
        />
      </div>

      {/* Type-specific Configuration */}
      {formData.type === 'stdio' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Command *
            </label>
            <input
              type="text"
              value={formData.command}
              onChange={(e) => handleInputChange('command', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g., npx, python, node"
            />
            {errors.command && (
              <p className="mt-1 text-sm text-red-600">{errors.command}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Arguments
            </label>
            <input
              type="text"
              value={formData.args}
              onChange={(e) => handleInputChange('args', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g., @modelcontextprotocol/server-filesystem /tmp"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Separate arguments with spaces
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Environment Variables
            </label>
            <textarea
              value={envVarsText}
              onChange={(e) => handleEnvVarsChange(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="API_KEY=your_key_here&#10;DATABASE_URL=postgres://..."
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              One variable per line in KEY=value format
            </p>
          </div>
        </div>
      )}

      {(formData.type === 'http' || formData.type === 'websocket') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Server URL *
          </label>
          <input
            type="url"
            value={formData.url}
            onChange={(e) => handleInputChange('url', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder={formData.type === 'http' ? 'https://api.example.com' : 'wss://api.example.com/ws'}
          />
          {errors.url && (
            <p className="mt-1 text-sm text-red-600">{errors.url}</p>
          )}
        </div>
      )}

      {/* Authentication */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Authentication
          </label>
          <select
            value={formData.auth_type}
            onChange={(e) => handleInputChange('auth_type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {authTypeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {formData.auth_type === 'bearer' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Bearer Token *
            </label>
            <input
              type="password"
              value={formData.auth_token}
              onChange={(e) => handleInputChange('auth_token', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            {errors.auth_token && (
              <p className="mt-1 text-sm text-red-600">{errors.auth_token}</p>
            )}
          </div>
        )}

        {formData.auth_type === 'api_key' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API Key *
            </label>
            <input
              type="password"
              value={formData.auth_api_key}
              onChange={(e) => handleInputChange('auth_api_key', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            {errors.auth_api_key && (
              <p className="mt-1 text-sm text-red-600">{errors.auth_api_key}</p>
            )}
          </div>
        )}

        {formData.auth_type === 'basic' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Username *
              </label>
              <input
                type="text"
                value={formData.auth_username}
                onChange={(e) => handleInputChange('auth_username', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              {errors.auth_username && (
                <p className="mt-1 text-sm text-red-600">{errors.auth_username}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.auth_password}
                  onChange={(e) => handleInputChange('auth_password', e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <IconEyeOff className="w-4 h-4 text-gray-400" />
                  ) : (
                    <IconEye className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.auth_password && (
                <p className="mt-1 text-sm text-red-600">{errors.auth_password}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Enable/Disable */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="enabled"
          checked={formData.enabled}
          onChange={(e) => handleInputChange('enabled', e.target.checked)}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="enabled" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
          Enable this server
        </label>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-600">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <IconCheck className="w-4 h-4 mr-2" />
          {isEditing ? 'Update Server' : 'Add Server'}
        </button>
      </div>
    </form>
  );
};