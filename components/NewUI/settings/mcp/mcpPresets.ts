/**
 * mcpPresets — the "Start from a preset" examples for Settings → MCP Servers. No React imports.
 *
 * These are real, public, hosted MCP servers that need no key, so they pass the same URL check the
 * save path uses (`validateMCPServerUrlWithReason`). The old presets in `types/mcp.ts`
 * (`MCP_SERVER_PRESETS`) all pointed at `localhost`, which both the frontend and the backend block,
 * so none of them could be saved; the classic dialog still uses that list.
 *
 * Each URL was checked to answer an MCP `initialize` over HTTP. Hosted services change, so keep the
 * list short and re-check it when touching this file. `mcpFormModel.test.ts` asserts every URL here
 * is savable.
 *
 * Location: components/NewUI/settings/mcp/mcpPresets.ts
 */

import type { MCPTransport } from '@/types/mcp';

export interface McpPreset {
  id: string;
  name: string;
  description: string;
  url: string;
  transport: MCPTransport;
}

export const MCP_PRESETS: McpPreset[] = [
  {
    id: 'deepwiki',
    name: 'DeepWiki',
    description: 'Ask questions about public GitHub repositories and read their docs.',
    url: 'https://mcp.deepwiki.com/mcp',
    transport: 'http',
  },
  {
    id: 'mslearn',
    name: 'Microsoft Learn',
    description: 'Search official Microsoft and Azure documentation.',
    url: 'https://learn.microsoft.com/api/mcp',
    transport: 'http',
  },
  {
    id: 'context7',
    name: 'Context7',
    description: 'Look up current docs and code examples for popular libraries.',
    url: 'https://mcp.context7.com/mcp',
    transport: 'http',
  },
];
