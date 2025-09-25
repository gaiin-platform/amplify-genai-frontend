/**
 * MCP Service Layer for API Communication
 *
 * This service handles all API communication with the backend MCP integration,
 * providing a clean interface for frontend components to interact with MCP functionality.
 */

import {
  MCPApiResponse,
  MCPStatusResponse,
  MCPTestResponse,
  MCPServerConfig,
  MCPTool,
  MCPToolResult,
  MCPUserSettings,
  MCPError,
  MCPAuthConfig
} from '@/types/mcp';
import { getSession } from 'next-auth/react';

class MCPService {
  private baseUrl: string;
  private readonly defaultTimeout = 30000; // 30 seconds

  constructor() {
    // Use environment variable or default to localhost for development
    this.baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3015';
  }

  /**
   * Get authentication headers for API requests
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    try {
      const session = await getSession();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (session?.accessToken) {
        headers['Authorization'] = `Bearer ${session.accessToken}`;
      }

      return headers;
    } catch (error) {
      console.error('Error getting auth headers:', error);
      return {
        'Content-Type': 'application/json',
      };
    }
  }

  /**
   * Make HTTP request with error handling
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    timeout = this.defaultTimeout
  ): Promise<MCPApiResponse<T>> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const headers = await this.getAuthHeaders();

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new MCPError(
          `HTTP ${response.status}: ${response.statusText}`,
          'NETWORK_ERROR'
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new MCPError(
          data.message || 'API request failed',
          data.code || 'UNKNOWN_ERROR'
        );
      }

      return data;
    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new MCPError('Request timeout', 'EXECUTION_TIMEOUT');
        }
        throw new MCPError(error.message, 'NETWORK_ERROR');
      }

      throw new MCPError('Unknown error occurred', 'UNKNOWN_ERROR');
    }
  }

  // ============================================================================
  // Status and Health Check Methods
  // ============================================================================

  /**
   * Get MCP integration status
   */
  async getStatus(): Promise<MCPStatusResponse> {
    const response = await this.makeRequest<MCPStatusResponse>('/dev/mcp/status', {
      method: 'GET',
    });

    if (!response.data) {
      throw new MCPError('No status data received', 'UNKNOWN_ERROR');
    }

    return response.data;
  }

  /**
   * Run comprehensive MCP test
   */
  async runTest(): Promise<MCPTestResponse> {
    const response = await this.makeRequest<MCPTestResponse>(
      '/dev/mcp/run',
      {
        method: 'POST',
      },
      60000 // 60 seconds for comprehensive test
    );

    if (!response.data) {
      throw new MCPError('No test data received', 'UNKNOWN_ERROR');
    }

    return response.data;
  }

  /**
   * Check if MCP integration is available and healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const status = await this.getStatus();
      return status.mcp_integration_available && status.available_servers.length > 0;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  // ============================================================================
  // Server Configuration Methods
  // ============================================================================

  /**
   * Get list of available MCP servers
   */
  async getAvailableServers(): Promise<MCPServerConfig[]> {
    const response = await this.makeRequest<MCPServerConfig[]>('/dev/mcp/servers', {
      method: 'GET',
    });

    return response.data || [];
  }

  /**
   * Add a new MCP server configuration
   */
  async addServer(serverConfig: MCPServerConfig): Promise<boolean> {
    const response = await this.makeRequest<{ success: boolean }>('/dev/mcp/servers', {
      method: 'POST',
      body: JSON.stringify({ server: serverConfig }),
    });

    return response.data?.success || false;
  }

  /**
   * Update an existing MCP server configuration
   */
  async updateServer(serverConfig: MCPServerConfig): Promise<boolean> {
    const response = await this.makeRequest<{ success: boolean }>(
      `/dev/mcp/servers/${serverConfig.name}`,
      {
        method: 'PUT',
        body: JSON.stringify({ server: serverConfig }),
      }
    );

    return response.data?.success || false;
  }

  /**
   * Delete an MCP server configuration
   */
  async deleteServer(serverName: string): Promise<boolean> {
    const response = await this.makeRequest<{ success: boolean }>(
      `/dev/mcp/servers/${serverName}`,
      {
        method: 'DELETE',
      }
    );

    return response.data?.success || false;
  }

  /**
   * Test connection to an MCP server
   */
  async testServer(serverName: string): Promise<boolean> {
    try {
      const response = await this.makeRequest<{ success: boolean }>(
        `/dev/mcp/servers/${serverName}/test`,
        {
          method: 'POST',
        },
        15000 // 15 seconds timeout for server test
      );

      return response.data?.success || false;
    } catch (error) {
      console.error(`Server test failed for ${serverName}:`, error);
      return false;
    }
  }

  // ============================================================================
  // Tool Discovery and Management Methods
  // ============================================================================

  /**
   * Discover all available tools from connected servers
   */
  async discoverTools(): Promise<MCPTool[]> {
    const response = await this.makeRequest<MCPTool[]>('/dev/mcp/tools', {
      method: 'GET',
    });

    return response.data || [];
  }

  /**
   * Get tools from a specific server
   */
  async getServerTools(serverName: string): Promise<MCPTool[]> {
    const response = await this.makeRequest<MCPTool[]>(`/dev/mcp/servers/${serverName}/tools`, {
      method: 'GET',
    });

    return response.data || [];
  }

  /**
   * Get tool usage statistics
   */
  async getToolStatistics(): Promise<any> {
    const response = await this.makeRequest<any>('/dev/mcp/tools/statistics', {
      method: 'GET',
    });

    return response.data || {};
  }

  /**
   * Search tools by name or description
   */
  async searchTools(query: string, categories?: string[]): Promise<MCPTool[]> {
    const params = new URLSearchParams({ query });
    if (categories && categories.length > 0) {
      params.append('categories', categories.join(','));
    }

    const response = await this.makeRequest<MCPTool[]>(`/dev/mcp/tools/search?${params}`, {
      method: 'GET',
    });

    return response.data || [];
  }

  // ============================================================================
  // Authentication Methods
  // ============================================================================

  /**
   * Store authentication credentials for an MCP server
   */
  async storeCredentials(serverName: string, credentials: MCPAuthConfig): Promise<boolean> {
    const response = await this.makeRequest<{ success: boolean }>(
      `/dev/mcp/auth/${serverName}`,
      {
        method: 'POST',
        body: JSON.stringify({ credentials }),
      }
    );

    return response.data?.success || false;
  }

  /**
   * Delete stored credentials for an MCP server
   */
  async deleteCredentials(serverName: string): Promise<boolean> {
    const response = await this.makeRequest<{ success: boolean }>(
      `/dev/mcp/auth/${serverName}`,
      {
        method: 'DELETE',
      }
    );

    return response.data?.success || false;
  }

  /**
   * Check if credentials are stored for a server
   */
  async hasCredentials(serverName: string): Promise<boolean> {
    try {
      const response = await this.makeRequest<{ has_credentials: boolean }>(
        `/dev/mcp/auth/${serverName}/check`,
        {
          method: 'GET',
        }
      );

      return response.data?.has_credentials || false;
    } catch (error) {
      return false;
    }
  }

  // ============================================================================
  // User Settings Methods
  // ============================================================================

  /**
   * Get user's MCP settings
   */
  async getUserSettings(): Promise<MCPUserSettings> {
    try {
      const response = await this.makeRequest<MCPUserSettings>('/dev/mcp/settings', {
        method: 'GET',
      });

      return response.data || this.getDefaultSettings();
    } catch (error) {
      console.error('Failed to get user settings:', error);
      return this.getDefaultSettings();
    }
  }

  /**
   * Save user's MCP settings
   */
  async saveUserSettings(settings: MCPUserSettings): Promise<boolean> {
    try {
      const response = await this.makeRequest<{ success: boolean }>('/dev/mcp/settings', {
        method: 'POST',
        body: JSON.stringify({ settings }),
      });

      return response.data?.success || false;
    } catch (error) {
      console.error('Failed to save user settings:', error);
      return false;
    }
  }

  /**
   * Get default MCP settings
   */
  private getDefaultSettings(): MCPUserSettings {
    return {
      enabled: true,
      auto_discover_tools: true,
      max_tools_per_request: 20,
      show_execution_details: false,
      preferred_servers: ['filesystem', 'memory'],
      server_configs: {},
      auth_configs: {},
    };
  }

  // ============================================================================
  // Chat Integration Methods
  // ============================================================================

  /**
   * Check if chat request should include MCP tools
   */
  async shouldEnableMCPForChat(): Promise<boolean> {
    try {
      const [healthy, settings] = await Promise.all([
        this.isHealthy(),
        this.getUserSettings(),
      ]);

      return healthy && settings.enabled;
    } catch (error) {
      console.error('Error checking MCP availability for chat:', error);
      return false;
    }
  }

  /**
   * Get MCP metadata for chat response
   */
  async getChatMetadata(toolResults: MCPToolResult[]): Promise<any> {
    const totalExecutionTime = toolResults.reduce(
      (sum, result) => sum + (result.execution_time || 0),
      0
    );

    const successfulCalls = toolResults.filter(r => r.success).length;
    const failedCalls = toolResults.length - successfulCalls;

    return {
      mcp_enabled: true,
      function_calls_executed: toolResults.length,
      execution_results: toolResults,
      performance_metrics: {
        total_execution_time: totalExecutionTime,
        average_execution_time: toolResults.length > 0 ? totalExecutionTime / toolResults.length : 0,
        successful_calls: successfulCalls,
        failed_calls: failedCalls,
      },
    };
  }

  // ============================================================================
  // Cache Management Methods
  // ============================================================================

  /**
   * Clear MCP cache
   */
  async clearCache(): Promise<boolean> {
    try {
      const response = await this.makeRequest<{ success: boolean }>('/dev/mcp/cache/clear', {
        method: 'POST',
      });

      return response.data?.success || false;
    } catch (error) {
      console.error('Failed to clear MCP cache:', error);
      return false;
    }
  }

  /**
   * Refresh tool discovery cache
   */
  async refreshTools(): Promise<boolean> {
    try {
      const response = await this.makeRequest<{ success: boolean }>('/dev/mcp/tools/refresh', {
        method: 'POST',
      });

      return response.data?.success || false;
    } catch (error) {
      console.error('Failed to refresh tools:', error);
      return false;
    }
  }
}

// Create a singleton instance
export const mcpService = new MCPService();
export default mcpService;