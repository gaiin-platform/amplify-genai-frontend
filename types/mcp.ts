/**
 * MCP (Model Context Protocol) TypeScript types and interfaces
 *
 * This file defines all the types needed for MCP integration in the frontend,
 * including server configurations, tools, resources, and API responses.
 */

// ============================================================================
// Core MCP Types
// ============================================================================

export type MCPServerType = 'stdio' | 'http' | 'websocket';

export interface MCPServerConfig {
  name: string;
  type: MCPServerType;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  auth?: MCPAuthConfig;
  enabled: boolean;
  description?: string;
  category?: string;
  requiresAuth?: boolean;
}

export interface MCPAuthConfig {
  type: 'bearer' | 'api_key' | 'oauth' | 'basic';
  token?: string;
  apiKey?: string;
  username?: string;
  password?: string;
  headers?: Record<string, string>;
}

// ============================================================================
// MCP Tools and Resources
// ============================================================================

export interface MCPTool {
  name: string;
  description: string;
  server: string;
  qualified_name: string;
  inputSchema: MCPInputSchema;
  category?: string;
  usage_count?: number;
  last_used?: string;
  average_execution_time?: number;
  success_rate?: number;
}

export interface MCPInputSchema {
  type: string;
  properties?: Record<string, MCPProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface MCPProperty {
  type: string;
  description?: string;
  enum?: string[];
  items?: MCPProperty;
  properties?: Record<string, MCPProperty>;
  default?: any;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  server: string;
  size?: number;
  lastModified?: string;
}

// ============================================================================
// MCP Tool Execution
// ============================================================================

export interface MCPToolCall {
  tool_name: string;
  server: string;
  arguments: Record<string, any>;
  call_id?: string;
  timestamp?: string;
}

export interface MCPToolResult {
  success: boolean;
  result?: any;
  error?: string;
  execution_time?: number;
  server: string;
  tool: string;
  function_name?: string;
  call_id?: string;
  timestamp?: string;
}

export interface MCPExecutionStatus {
  status: 'pending' | 'running' | 'completed' | 'failed';
  tool_name: string;
  server: string;
  start_time?: string;
  end_time?: string;
  progress?: number;
  message?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface MCPApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface MCPStatusResponse {
  mcp_integration_available: boolean;
  available_servers: string[];
  auth_manager_status: {
    encryption_enabled: boolean;
    table_configured: boolean;
    cache_entries: number;
    cache_ttl_seconds: number;
  };
  configuration: {
    cache_ttl: number;
    max_tools_per_request: number;
  };
}

export interface MCPTestResponse {
  timestamp: string;
  servers_tested: MCPServerTestResult[];
  tools_discovered: MCPToolDiscoveryResult[];
  test_summary: {
    available_default_servers: number;
    servers_initialized: number;
    total_tools_discovered: number;
    ai_formatted_tools: number;
    healthy_servers: number;
  };
  health_check?: Record<string, MCPHealthStatus>;
  tool_statistics?: MCPToolStatistics;
  errors: string[];
}

export interface MCPServerTestResult {
  name: string;
  initialized: boolean;
  config?: {
    command: string;
    args: string[];
    has_env: boolean;
  };
  error?: string;
}

export interface MCPToolDiscoveryResult {
  server: string;
  tool_count: number;
  tools: string[];
}

export interface MCPHealthStatus {
  status: 'healthy' | 'unhealthy' | 'failed';
  info: any;
}

export interface MCPToolStatistics {
  total_tools: number;
  tools_by_server: Record<string, number>;
  tools_by_category: Record<string, number>;
  most_used_tools: Array<{
    name: string;
    usage_count: number;
  }>;
  fastest_tools: Array<{
    name: string;
    avg_time: number;
  }>;
  most_reliable_tools: Array<{
    name: string;
    success_rate: number;
  }>;
  total_executions: number;
}

// ============================================================================
// Chat Integration Types
// ============================================================================

export interface MCPChatMetadata {
  mcp_enabled: boolean;
  available_tools: number;
  function_calls_executed?: number;
  execution_results?: MCPToolResult[];
  server_status?: Record<string, 'healthy' | 'unhealthy' | 'unknown'>;
  performance_metrics?: {
    total_execution_time: number;
    average_execution_time: number;
    successful_calls: number;
    failed_calls: number;
  };
}

export interface MCPEnhancedMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  mcp_metadata?: {
    tools_used: string[];
    execution_time: number;
    results: MCPToolResult[];
  };
  timestamp: string;
}

// ============================================================================
// Settings and Configuration Types
// ============================================================================

export interface MCPUserSettings {
  enabled: boolean;
  auto_discover_tools: boolean;
  max_tools_per_request: number;
  show_execution_details: boolean;
  preferred_servers: string[];
  server_configs: Record<string, MCPServerConfig>;
  auth_configs: Record<string, MCPAuthConfig>;
}

export interface MCPServerFormData {
  name: string;
  type: MCPServerType;
  command: string;
  args: string;
  env_vars: Record<string, string>;
  url: string;
  auth_type: 'none' | 'bearer' | 'api_key' | 'oauth' | 'basic';
  auth_token: string;
  auth_api_key: string;
  auth_username: string;
  auth_password: string;
  enabled: boolean;
  description: string;
}

// ============================================================================
// UI Component Props Types
// ============================================================================

export interface MCPToolIndicatorProps {
  tools: MCPTool[];
  executionStatus?: MCPExecutionStatus[];
  showDetails?: boolean;
  onToolClick?: (tool: MCPTool) => void;
}

export interface MCPStatusDisplayProps {
  status: MCPExecutionStatus[];
  compact?: boolean;
  showProgressBars?: boolean;
}

export interface MCPServerSettingsProps {
  servers: MCPServerConfig[];
  onServerAdd: (server: MCPServerConfig) => void;
  onServerEdit: (server: MCPServerConfig) => void;
  onServerDelete: (serverName: string) => void;
  onServerToggle: (serverName: string, enabled: boolean) => void;
  onServerTest: (serverName: string) => Promise<boolean>;
}

export interface MCPServerFormProps {
  server?: MCPServerConfig;
  onSave: (server: MCPServerConfig) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

export interface MCPToolsListProps {
  tools: MCPTool[];
  groupByServer?: boolean;
  showUsageStats?: boolean;
  onToolSelect?: (tool: MCPTool) => void;
  searchQuery?: string;
  selectedCategories?: string[];
}

// ============================================================================
// Error Types
// ============================================================================

export class MCPError extends Error {
  public code: string;
  public server?: string;
  public tool?: string;
  public details?: any;

  constructor(message: string, code: string, server?: string, tool?: string, details?: any) {
    super(message);
    this.name = 'MCPError';
    this.code = code;
    this.server = server;
    this.tool = tool;
    this.details = details;
  }
}

export type MCPErrorCode =
  | 'SERVER_UNAVAILABLE'
  | 'TOOL_NOT_FOUND'
  | 'AUTHENTICATION_FAILED'
  | 'EXECUTION_TIMEOUT'
  | 'INVALID_ARGUMENTS'
  | 'PERMISSION_DENIED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

// ============================================================================
// Utility Types
// ============================================================================

export type MCPServerCategory =
  | 'filesystem'
  | 'memory'
  | 'database'
  | 'web'
  | 'code'
  | 'communication'
  | 'utility'
  | 'custom';

export type MCPToolCategory =
  | 'file_operations'
  | 'data_analysis'
  | 'web_search'
  | 'code_analysis'
  | 'database_query'
  | 'memory_management'
  | 'communication'
  | 'utility';

// ============================================================================
// Constants
// ============================================================================

export const MCP_SERVER_CATEGORIES: Record<MCPServerCategory, string> = {
  filesystem: 'File System Operations',
  memory: 'Knowledge & Memory Management',
  database: 'Database & Query Operations',
  web: 'Web Search & Content Retrieval',
  code: 'Code Analysis & Repository Operations',
  communication: 'Communication & Messaging',
  utility: 'Utility & Helper Tools',
  custom: 'Custom Integrations'
};

export const MCP_TOOL_CATEGORIES: Record<MCPToolCategory, string> = {
  file_operations: 'File & Directory Operations',
  data_analysis: 'Data Analysis & Processing',
  web_search: 'Web Search & Content',
  code_analysis: 'Code & Repository Analysis',
  database_query: 'Database Queries',
  memory_management: 'Knowledge Management',
  communication: 'Communication Tools',
  utility: 'Utility Functions'
};

export const DEFAULT_MCP_SERVERS: MCPServerConfig[] = [
  {
    name: 'filesystem',
    type: 'stdio',
    command: 'npx',
    args: ['@modelcontextprotocol/server-filesystem', '/tmp'],
    env: {},
    enabled: true,
    description: 'File operations and document processing',
    category: 'filesystem',
    requiresAuth: false
  },
  {
    name: 'memory',
    type: 'stdio',
    command: 'npx',
    args: ['@modelcontextprotocol/server-memory'],
    env: {},
    enabled: true,
    description: 'Persistent knowledge management',
    category: 'memory',
    requiresAuth: false
  }
];

// ============================================================================
// Type Guards
// ============================================================================

export function isMCPTool(obj: any): obj is MCPTool {
  return obj && typeof obj === 'object' &&
         typeof obj.name === 'string' &&
         typeof obj.description === 'string' &&
         typeof obj.server === 'string' &&
         typeof obj.qualified_name === 'string' &&
         obj.inputSchema;
}

export function isMCPToolResult(obj: any): obj is MCPToolResult {
  return obj && typeof obj === 'object' &&
         typeof obj.success === 'boolean' &&
         typeof obj.server === 'string' &&
         typeof obj.tool === 'string';
}

export function isMCPError(error: any): error is MCPError {
  return error instanceof MCPError;
}