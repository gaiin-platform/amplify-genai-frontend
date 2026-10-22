/**
 * MCP Tool Executor Service
 *
 * Handles execution of MCP tools via local MCP servers.
 * This enables client-side tool execution for MCP servers running locally.
 */

import { MCPTool, MCPToolResult } from '@/types/mcp';
import { listMCPServers } from './mcpService';

// JSON-RPC request structure
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

// JSON-RPC response structure
interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// MCP tool call content type
interface MCPToolContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
  uri?: string;
}

// MCP tool call result from server
interface MCPToolCallResult {
  content: MCPToolContent[];
  isError?: boolean;
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Pick the JSON-RPC response for `requestId` out of a Server-Sent Events body
 * (`event: message` / `data: {...}`), which streamable-HTTP MCP servers may send instead of plain JSON.
 * Prefers the message with the matching id, then any response; ignores comments and non-JSON events.
 */
export function parseSseJsonRpc(text: string, requestId?: string | number): JsonRpcResponse | null {
  const events: string[] = [];
  let data: string[] = [];
  const flush = () => {
    if (data.length) events.push(data.join('\n'));
    data = [];
  };
  for (const line of text.split(/\r\n|\n|\r/)) {
    if (line === '') flush();
    else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
  }
  flush();

  let firstResponse: JsonRpcResponse | null = null;
  for (const raw of events) {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!msg || typeof msg !== 'object' || !('result' in msg || 'error' in msg)) continue;
    if (requestId !== undefined && msg.id === requestId) return msg as JsonRpcResponse;
    if (firstResponse === null) firstResponse = msg as JsonRpcResponse;
  }
  return firstResponse;
}

/**
 * Execute a tool call on an MCP server
 */
export async function executeMCPTool(
  serverUrl: string,
  toolName: string,
  args: Record<string, unknown>,
  timeout: number = 120000,
  customHeaders: Record<string, string> = {}
): Promise<MCPToolResult> {
  const requestId = generateRequestId();

  const request: JsonRpcRequest = {
    jsonrpc: '2.0',
    id: requestId,
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args
    }
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        ...customHeaders
      },
      body: JSON.stringify(request),
      signal: controller.signal
    });

    // The timer stays armed until the body is read, so a stream that never closes still times out.
    if (!response.ok) {
      clearTimeout(timeoutId);
      return {
        success: false,
        content: `HTTP error: ${response.status} ${response.statusText}`,
        rawResult: null,
        isError: true
      };
    }

    // A server may answer with plain JSON or with a Server-Sent Events stream.
    const isEventStream = (response.headers.get('content-type') || '').includes('text/event-stream');
    const jsonResponse: JsonRpcResponse | null = isEventStream
      ? parseSseJsonRpc(await response.text(), requestId)
      : await response.json();
    clearTimeout(timeoutId);

    if (!jsonResponse) {
      return {
        success: false,
        content: 'MCP server sent an event stream with no JSON-RPC response',
        rawResult: null,
        isError: true
      };
    }

    if (jsonResponse.error) {
      return {
        success: false,
        content: jsonResponse.error.message || 'Unknown error',
        rawResult: jsonResponse.error,
        isError: true
      };
    }

    const result = jsonResponse.result as MCPToolCallResult;

    // Extract text content for the main content field
    const textContent = result.content
      .filter(c => c.type === 'text' && c.text)
      .map(c => c.text)
      .join('\n');

    return {
      success: !result.isError,
      content: textContent || JSON.stringify(result.content),
      rawResult: result,
      isError: result.isError || false
    };

  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          content: 'Tool execution timed out',
          rawResult: null,
          isError: true
        };
      }
      return {
        success: false,
        content: `Execution error: ${error.message}`,
        rawResult: null,
        isError: true
      };
    }
    return {
      success: false,
      content: 'Unknown error occurred',
      rawResult: null,
      isError: true
    };
  }
}

/**
 * Execute an MCP tool by server ID and tool name
 * Finds the server and executes the tool
 */
export async function executeMCPToolByServerId(
  serverId: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<MCPToolResult> {
  try {
    const servers = await listMCPServers();
    const server = servers.find(s => s.id === serverId);

    if (!server) {
      return {
        success: false,
        content: `MCP server not found: ${serverId}`,
        rawResult: null,
        isError: true
      };
    }

    if (!server.enabled) {
      return {
        success: false,
        content: `MCP server is disabled: ${server.name}`,
        rawResult: null,
        isError: true
      };
    }

    return await executeMCPTool(server.url, toolName, args, 120000, server.headers ?? {});
  } catch (error) {
    return {
      success: false,
      content: `Failed to execute tool: ${error instanceof Error ? error.message : 'Unknown error'}`,
      rawResult: null,
      isError: true
    };
  }
}

/**
 * Convert MCP tools to OpenAI function format for LLM
 */
export function mcpToolsToLLMFormat(tools: MCPTool[], serverId: string, serverName: string): any[] {
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: `mcp_${serverId}_${tool.name}`,
      description: `[MCP: ${serverName}] ${tool.description}`,
      parameters: tool.inputSchema || { type: 'object', properties: {} }
    },
    _mcpInfo: {
      serverId,
      serverName,
      originalName: tool.name
    }
  }));
}

/**
 * Get all tools from enabled MCP servers in LLM format
 */
export async function getEnabledMCPToolsForLLM(): Promise<any[]> {
  try {
    const servers = await listMCPServers();
    const enabledServers = servers.filter(s => s.enabled && s.tools.length > 0);

    const allTools: any[] = [];
    for (const server of enabledServers) {
      const serverTools = mcpToolsToLLMFormat(server.tools, server.id, server.name);
      allTools.push(...serverTools);
    }

    return allTools;
  } catch (error) {
    console.error('Failed to get MCP tools for LLM:', error);
    return [];
  }
}

/**
 * Parse an MCP tool name to extract server ID and original tool name
 *
 * Server ID format: mcp_{timestamp}_{random} (e.g., mcp_1767629390657_b1c2812d7)
 * Full tool name format: mcp_{serverId}_{toolName}
 * Example: mcp_mcp_1767629390657_b1c2812d7_install_package
 */
export function parseMCPToolName(fullName: string): { serverId: string; toolName: string } | null {
  if (!fullName.startsWith('mcp_')) {
    return null;
  }

  // Remove initial 'mcp_' prefix (the MCP tool marker)
  const remaining = fullName.substring(4);

  // Server ID format: mcp_{timestamp}_{random}
  // e.g., mcp_1767629390657_b1c2812d7
  // The timestamp is 13+ digits (milliseconds), random is alphanumeric
  const serverIdMatch = remaining.match(/^(mcp_\d+_[a-z0-9]+)_(.+)$/);
  if (serverIdMatch) {
    return {
      serverId: serverIdMatch[1],
      toolName: serverIdMatch[2]
    };
  }

  // Fallback for other server ID formats (not starting with mcp_)
  const parts = remaining.split('_');
  if (parts.length < 2) {
    return null;
  }

  return {
    serverId: parts[0],
    toolName: parts.slice(1).join('_')
  };
}

/**
 * Check if a tool name is an MCP tool
 */
export function isMCPToolName(toolName: string): boolean {
  return toolName?.startsWith('mcp_') ?? false;
}

/**
 * Execute MCP tool from a tool_call response
 * Handles the full flow: parse name -> find server -> execute -> return result
 */
export async function handleMCPToolCall(
  toolName: string,
  args: Record<string, unknown>
): Promise<{
  success: boolean;
  result: MCPToolResult;
  toolInfo: { serverId: string; toolName: string; serverName?: string };
}> {
  const parsed = parseMCPToolName(toolName);

  if (!parsed) {
    return {
      success: false,
      result: {
        success: false,
        content: `Invalid MCP tool name: ${toolName}`,
        rawResult: null,
        isError: true
      },
      toolInfo: { serverId: '', toolName: toolName }
    };
  }

  // Find the server to get its name
  let serverName = parsed.serverId;
  try {
    const servers = await listMCPServers();
    const server = servers.find(s => s.id === parsed.serverId);
    if (server) {
      serverName = server.name;
    }
  } catch (e) {
    // Continue with serverId as name
  }

  const result = await executeMCPToolByServerId(parsed.serverId, parsed.toolName, args);

  return {
    success: result.success,
    result,
    toolInfo: {
      serverId: parsed.serverId,
      toolName: parsed.toolName,
      serverName
    }
  };
}
