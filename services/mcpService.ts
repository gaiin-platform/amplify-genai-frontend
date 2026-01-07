/**
 * MCP Service
 *
 * Manages MCP (Model Context Protocol) server configurations and connections.
 * Communicates with backend API for server management.
 */

import {
    MCPServerConfig,
    MCPServerFormData,
    MCPConnectionResult,
    MCPTool,
} from '@/types/mcp';
import { doRequestOp } from './doRequestOp';

const SERVICE_NAME = 'websearch';  // Reuse integrations service
const URL_PATH = '/integrations';

/**
 * Get all MCP servers configured for the current user
 */
export async function listMCPServers(): Promise<MCPServerConfig[]> {
    try {
        const result = await doRequestOp({
            method: 'GET',
            path: URL_PATH,
            op: '/mcp/servers',
            service: SERVICE_NAME
        });

        if (result.success && Array.isArray(result.data)) {
            return result.data as MCPServerConfig[];
        }
        return [];
    } catch (e) {
        console.error('Failed to list MCP servers:', e);
        return [];
    }
}

/**
 * Get a single MCP server by ID
 */
export async function getMCPServer(serverId: string): Promise<MCPServerConfig | null> {
    try {
        const result = await doRequestOp({
            method: 'POST',
            path: URL_PATH,
            op: '/mcp/server/get',
            data: { serverId },
            service: SERVICE_NAME
        });

        if (result.success && result.data) {
            return result.data as MCPServerConfig;
        }
        return null;
    } catch (e) {
        console.error('Failed to get MCP server:', e);
        return null;
    }
}

/**
 * Add a new MCP server configuration
 */
export async function addMCPServer(
    config: MCPServerFormData
): Promise<{ success: boolean; server?: MCPServerConfig; error?: string }> {
    try {
        const result = await doRequestOp({
            method: 'POST',
            path: URL_PATH,
            op: '/mcp/servers',
            data: config,
            service: SERVICE_NAME
        });

        if (result.success && result.data) {
            return { success: true, server: result.data as MCPServerConfig };
        }
        return { success: false, error: result.message || result.error || 'Failed to add MCP server' };
    } catch (e) {
        console.error('Failed to add MCP server:', e);
        return { success: false, error: 'Network error' };
    }
}

/**
 * Update an existing MCP server configuration
 */
export async function updateMCPServer(
    serverId: string,
    updates: Partial<MCPServerFormData & { enabled: boolean }>
): Promise<{ success: boolean; server?: MCPServerConfig; error?: string }> {
    try {
        const result = await doRequestOp({
            method: 'POST',
            path: URL_PATH,
            op: '/mcp/server/update',
            data: { serverId, ...updates },
            service: SERVICE_NAME
        });

        if (result.success && result.data) {
            return { success: true, server: result.data as MCPServerConfig };
        }
        return { success: false, error: result.message || result.error || 'Failed to update MCP server' };
    } catch (e) {
        console.error('Failed to update MCP server:', e);
        return { success: false, error: 'Network error' };
    }
}

/**
 * Delete an MCP server configuration
 */
export async function deleteMCPServer(
    serverId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const result = await doRequestOp({
            method: 'POST',
            path: URL_PATH,
            op: '/mcp/server/delete',
            data: { serverId },
            service: SERVICE_NAME
        });

        if (result.success) {
            return { success: true };
        }
        return { success: false, error: result.message || result.error || 'Failed to delete MCP server' };
    } catch (e) {
        console.error('Failed to delete MCP server:', e);
        return { success: false, error: 'Network error' };
    }
}

/**
 * Test connection to an MCP server
 * Can test an existing server by ID or a new server configuration
 */
export async function testMCPConnection(
    serverOrId: string | MCPServerFormData
): Promise<MCPConnectionResult> {
    try {
        const data = typeof serverOrId === 'string'
            ? { serverId: serverOrId }
            : serverOrId;

        const result = await doRequestOp({
            method: 'POST',
            path: URL_PATH,
            op: '/mcp/servers/test',
            data,
            service: SERVICE_NAME
        });

        if (result.success && result.data) {
            // Backend returns { success, data: { serverInfo, tools } }
            // Frontend expects MCPConnectionResult with success inside
            return { success: true, ...result.data } as MCPConnectionResult;
        }
        return {
            success: false,
            error: result.message || result.error || result.data?.error || 'Connection test failed'
        };
    } catch (e) {
        console.error('Failed to test MCP connection:', e);
        return { success: false, error: 'Network error' };
    }
}

/**
 * Get tools available from a specific MCP server
 */
export async function getMCPServerTools(serverId: string): Promise<MCPTool[]> {
    try {
        const result = await doRequestOp({
            method: 'POST',
            path: URL_PATH,
            op: '/mcp/server/tools',
            data: { serverId },
            service: SERVICE_NAME
        });

        if (result.success && Array.isArray(result.data)) {
            return result.data as MCPTool[];
        }
        return [];
    } catch (e) {
        console.error('Failed to get MCP server tools:', e);
        return [];
    }
}

/**
 * Enable or disable an MCP server
 */
export async function toggleMCPServer(
    serverId: string,
    enabled: boolean
): Promise<{ success: boolean; error?: string }> {
    return updateMCPServer(serverId, { enabled });
}

/**
 * Refresh tools from an MCP server (reconnect and discover)
 */
export async function refreshMCPServerTools(
    serverId: string
): Promise<{ success: boolean; tools?: MCPTool[]; error?: string }> {
    try {
        const result = await doRequestOp({
            method: 'POST',
            path: URL_PATH,
            op: '/mcp/server/refresh',
            data: { serverId },
            service: SERVICE_NAME
        });

        if (result.success && result.data) {
            return {
                success: true,
                tools: (result.data as { tools: MCPTool[] }).tools
            };
        }
        return { success: false, error: result.message || result.error || 'Failed to refresh tools' };
    } catch (e) {
        console.error('Failed to refresh MCP server tools:', e);
        return { success: false, error: 'Network error' };
    }
}

/**
 * Get all tools from all enabled MCP servers
 */
export async function getAllEnabledMCPTools(): Promise<MCPTool[]> {
    try {
        const servers = await listMCPServers();
        const enabledServers = servers.filter(s => s.enabled);

        const allTools: MCPTool[] = [];
        for (const server of enabledServers) {
            allTools.push(...server.tools);
        }

        return allTools;
    } catch (e) {
        console.error('Failed to get enabled MCP tools:', e);
        return [];
    }
}

/**
 * Check if user has any MCP servers configured
 */
export async function hasMCPServers(): Promise<boolean> {
    const servers = await listMCPServers();
    return servers.length > 0;
}

/**
 * Check if user has any enabled MCP servers
 */
export async function hasEnabledMCPServers(): Promise<boolean> {
    const servers = await listMCPServers();
    return servers.some(s => s.enabled);
}
