/**
 * MCP Chat Hook
 *
 * Manages MCP tool integration with the chat system.
 * Handles fetching MCP tools and executing them during conversations.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { MCPServerConfig } from '@/types/mcp';
import { listMCPServers } from '@/services/mcpService';
import {
  getEnabledMCPToolsForLLM,
  handleMCPToolCall,
  isMCPToolName,
  parseMCPToolName
} from '@/services/mcpToolExecutor';

export interface MCPToolCallInfo {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  serverId?: string;
  serverName?: string;
  originalToolName?: string;
}

export interface MCPToolExecutionResult {
  toolCallId: string;
  toolName: string;
  success: boolean;
  content: string;
  rawResult?: unknown;
  isError: boolean;
  serverName?: string;
  executionTime?: number;
}

export interface UseMCPChatReturn {
  // State
  mcpEnabled: boolean;
  mcpServers: MCPServerConfig[];
  mcpToolsForLLM: any[];
  isLoadingTools: boolean;
  hasEnabledServers: boolean;
  loadError: string | null;

  // Actions
  loadMCPTools: () => Promise<void>;
  executeMCPToolCall: (toolCall: MCPToolCallInfo) => Promise<MCPToolExecutionResult>;
  executeMCPToolCalls: (toolCalls: MCPToolCallInfo[]) => Promise<MCPToolExecutionResult[]>;
  isMCPTool: (toolName: string) => boolean;
  parseMCPTool: (toolName: string) => { serverId: string; toolName: string } | null;
}

/**
 * Hook for managing MCP tools in chat
 */
export function useMCPChat(): UseMCPChatReturn {
  const [mcpServers, setMcpServers] = useState<MCPServerConfig[]>([]);
  const [mcpToolsForLLM, setMcpToolsForLLM] = useState<any[]>([]);
  const [isLoadingTools, setIsLoadingTools] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  // Check if MCP is effectively enabled (has servers with tools)
  const hasEnabledServers = mcpServers.some(s => s.enabled && s.tools.length > 0);
  const mcpEnabled = hasEnabledServers && mcpToolsForLLM.length > 0;

  /**
   * Load MCP servers and their tools
   */
  const loadMCPTools = useCallback(async () => {
    if (isLoadingTools) return;

    setIsLoadingTools(true);
    setLoadError(null);
    try {
      // Load servers
      const servers = await listMCPServers();
      setMcpServers(servers);

      // Get tools in LLM format
      const tools = await getEnabledMCPToolsForLLM();
      setMcpToolsForLLM(tools);

      console.log(`[MCP] Loaded ${servers.length} servers, ${tools.length} tools`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load MCP tools';
      console.error('[MCP] Failed to load tools:', error);
      setLoadError(errorMessage);
      setMcpToolsForLLM([]);
    } finally {
      setIsLoadingTools(false);
    }
  }, [isLoadingTools]);

  /**
   * Execute a single MCP tool call
   */
  const executeMCPToolCall = useCallback(async (
    toolCall: MCPToolCallInfo
  ): Promise<MCPToolExecutionResult> => {
    const startTime = Date.now();

    console.log(`[MCP] Executing tool: ${toolCall.name}`, toolCall.arguments);

    try {
      const { success, result, toolInfo } = await handleMCPToolCall(
        toolCall.name,
        toolCall.arguments
      );

      const executionTime = Date.now() - startTime;

      return {
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        success,
        content: result.content,
        rawResult: result.rawResult,
        isError: result.isError,
        serverName: toolInfo.serverName,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.error(`[MCP] Tool execution failed:`, error);

      return {
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        success: false,
        content: `Error executing tool: ${errorMessage}`,
        rawResult: null,
        isError: true,
        executionTime
      };
    }
  }, []);

  /**
   * Execute multiple MCP tool calls (in parallel)
   */
  const executeMCPToolCalls = useCallback(async (
    toolCalls: MCPToolCallInfo[]
  ): Promise<MCPToolExecutionResult[]> => {
    console.log(`[MCP] Executing ${toolCalls.length} tool calls`);

    const results = await Promise.all(
      toolCalls.map(tc => executeMCPToolCall(tc))
    );

    return results;
  }, [executeMCPToolCall]);

  /**
   * Check if a tool name is an MCP tool
   */
  const isMCPTool = useCallback((toolName: string): boolean => {
    return isMCPToolName(toolName);
  }, []);

  /**
   * Parse MCP tool name
   */
  const parseMCPTool = useCallback((toolName: string) => {
    return parseMCPToolName(toolName);
  }, []);

  // Auto-load tools on mount (only once)
  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      loadMCPTools();
    }
  }, []);

  return {
    mcpEnabled,
    mcpServers,
    mcpToolsForLLM,
    isLoadingTools,
    hasEnabledServers,
    loadError,
    loadMCPTools,
    executeMCPToolCall,
    executeMCPToolCalls,
    isMCPTool,
    parseMCPTool
  };
}

/**
 * Format MCP tool results for display in chat
 */
export function formatMCPToolResultForChat(result: MCPToolExecutionResult): {
  toolName: string;
  serverName?: string;
  content: Array<{ type: 'text' | 'image'; text?: string; data?: string; mimeType?: string }>;
  isError: boolean;
  executionTime?: number;
} {
  const rawResult = result.rawResult as any;

  // If we have structured content from MCP, use it
  if (rawResult?.content && Array.isArray(rawResult.content)) {
    return {
      toolName: result.toolName,
      serverName: result.serverName,
      content: rawResult.content.map((c: any) => ({
        type: c.type || 'text',
        text: c.text,
        data: c.data,
        mimeType: c.mimeType
      })),
      isError: result.isError,
      executionTime: result.executionTime
    };
  }

  // Otherwise, wrap the content as text
  return {
    toolName: result.toolName,
    serverName: result.serverName,
    content: [{ type: 'text', text: result.content }],
    isError: result.isError,
    executionTime: result.executionTime
  };
}

export default useMCPChat;
