/**
 * MCP (Model Context Protocol) Types
 *
 * Types for managing MCP server connections and tool execution.
 */

// MCP transport types
export type MCPTransport = 'http' | 'sse';

// MCP server connection status
export type MCPServerStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

// JSON Schema type for tool input schemas
export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  description?: string;
}

export interface JSONSchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
  items?: JSONSchemaProperty;
}

// MCP Tool definition
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  serverId?: string;
  serverName?: string;
}

// MCP Server configuration
export interface MCPServerConfig {
  id: string;
  name: string;
  url: string;
  transport: MCPTransport;
  enabled: boolean;
  tools: MCPTool[];
  status: MCPServerStatus;
  lastConnected?: string;
  lastError?: string;
  createdAt?: string;
  updatedAt?: string;
}

// MCP Server info returned from connection
export interface MCPServerInfo {
  name?: string;
  version?: string;
  capabilities?: {
    tools?: Record<string, unknown>;
    resources?: Record<string, unknown>;
    prompts?: Record<string, unknown>;
  };
}

// MCP Connection result
export interface MCPConnectionResult {
  success: boolean;
  serverInfo?: MCPServerInfo;
  tools?: MCPTool[];
  error?: string;
}

// MCP Tool execution result
export interface MCPToolResult {
  success: boolean;
  content: string;
  rawResult?: unknown;
  isError: boolean;
}

// Form data for adding/editing MCP server
export interface MCPServerFormData {
  name: string;
  url: string;
  transport: MCPTransport;
}

// MCP Settings stored in localStorage
export interface MCPSettings {
  enabledServerIds: string[];
  autoConnect: boolean;
}

// Default MCP settings
export const DEFAULT_MCP_SETTINGS: MCPSettings = {
  enabledServerIds: [],
  autoConnect: true,
};

// MCP Tool definition in OpenAI function format (for LLM)
export interface MCPToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JSONSchema;
  };
  _mcpInfo?: {
    serverId: string;
    serverName: string;
    originalName: string;
  };
}

// Common MCP server presets (for quick setup)
export interface MCPServerPreset {
  id: string;
  name: string;
  description: string;
  defaultUrl: string;
  transport: MCPTransport;
  setupInstructions?: string;
}

export const MCP_SERVER_PRESETS: MCPServerPreset[] = [
  {
    id: 'jupyter',
    name: 'Jupyter Notebook',
    description: 'Execute Python code, create notebooks, and visualize data with Jupyter.',
    defaultUrl: 'http://localhost:8888/mcp',
    transport: 'http',
    setupInstructions: 'Install: cd jupyter-mcp-server && pip install -e . && jupyter-mcp-server --port 8888',
  },
  {
    id: 'filesystem',
    name: 'File System',
    description: 'Read and write files on the local file system.',
    defaultUrl: 'http://localhost:3000/mcp/filesystem',
    transport: 'http',
    setupInstructions: 'Run: npx @modelcontextprotocol/server-filesystem',
  },
  {
    id: 'sqlite',
    name: 'SQLite Database',
    description: 'Query and modify SQLite databases.',
    defaultUrl: 'http://localhost:3000/mcp/sqlite',
    transport: 'http',
    setupInstructions: 'Run: npx @modelcontextprotocol/server-sqlite',
  },
];

// Helper to validate MCP server URL
export function validateMCPServerUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// Helper to format MCP tool name (mcp_{serverId}_{toolName})
export function formatMCPToolName(serverId: string, toolName: string): string {
  return `mcp_${serverId}_${toolName}`;
}

// Helper to parse MCP tool name
// NOTE: A more robust version of this function exists in services/mcpToolExecutor.ts
// which handles the full mcp_{timestamp}_{random}_{toolName} server ID format.
// Consider consolidating to a single implementation if both are being used.
export function parseMCPToolName(fullName: string): { serverId: string; toolName: string } | null {
  if (!fullName.startsWith('mcp_')) {
    return null;
  }

  const parts = fullName.substring(4).split('_');
  if (parts.length < 2) {
    return null;
  }

  const serverId = parts[0];
  const toolName = parts.slice(1).join('_');

  return { serverId, toolName };
}

// Helper to check if a tool name is an MCP tool
export function isMCPTool(toolName: string): boolean {
  return toolName?.startsWith('mcp_') ?? false;
}
