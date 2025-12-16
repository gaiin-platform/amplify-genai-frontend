/**
 * Tool API Keys and Configuration Types
 *
 * Supports "Bring Your Own API Key" model for server-side tools.
 */

// Supported tool providers
export type ToolProvider = 'brave_search' | 'tavily' | 'serper';

// Tool provider configuration
export interface ToolProviderConfig {
  id: ToolProvider;
  name: string;
  description: string;
  apiKeyUrl: string;  // Where users can get an API key
  apiKeyPlaceholder: string;
  freeQuota?: string;  // Description of free tier
  docsUrl?: string;
}

// User's configured API key for a tool
export interface ToolApiKey {
  provider: ToolProvider;
  apiKey: string;  // Will be encrypted when stored
  createdAt: string;
  lastUsedAt?: string;
}

// Masked version returned from backend (for display)
export interface MaskedToolApiKey {
  provider: ToolProvider;
  maskedKey: string;  // e.g., "sk-...abc"
  createdAt: string;
  lastUsedAt?: string;
  isConfigured: boolean;
}

// Tool execution status (for UI display)
export type ToolExecutionStatus = 'pending' | 'executing' | 'completed' | 'error';

// Tool execution display in chat
export interface ToolExecutionDisplay {
  id: string;
  toolName: string;
  toolProvider: ToolProvider;
  status: ToolExecutionStatus;
  arguments?: Record<string, unknown>;
  result?: ToolExecutionResult;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

// Tool execution result
export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Tool settings stored in localStorage
export interface ToolSettings {
  enabledTools: ToolProvider[];
}

// Available tool providers
export const TOOL_PROVIDERS: Record<ToolProvider, ToolProviderConfig> = {
  brave_search: {
    id: 'brave_search',
    name: 'Brave Search',
    description: 'Web search powered by Brave. Privacy-focused and comprehensive.',
    apiKeyUrl: 'https://brave.com/search/api/',
    apiKeyPlaceholder: 'BSA...',
    freeQuota: '2,000 queries/month free',
    docsUrl: 'https://api.search.brave.com/app/documentation/web-search',
  },
  tavily: {
    id: 'tavily',
    name: 'Tavily',
    description: 'AI-optimized search API. Returns clean, relevant results for LLMs.',
    apiKeyUrl: 'https://tavily.com/',
    apiKeyPlaceholder: 'tvly-...',
    freeQuota: '1,000 queries/month free',
    docsUrl: 'https://docs.tavily.com/',
  },
  serper: {
    id: 'serper',
    name: 'Serper',
    description: 'Google Search API. Fast and reliable search results.',
    apiKeyUrl: 'https://serper.dev/',
    apiKeyPlaceholder: '',
    freeQuota: '2,500 queries free (one-time)',
    docsUrl: 'https://serper.dev/docs',
  },
};

// Default tool settings
export const DEFAULT_TOOL_SETTINGS: ToolSettings = {
  enabledTools: [],
};

// Helper to mask an API key for display
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 8) return '••••••••';
  const prefix = apiKey.slice(0, 4);
  const suffix = apiKey.slice(-4);
  return `${prefix}...${suffix}`;
}

// Helper to validate API key format (basic check)
export function validateApiKeyFormat(provider: ToolProvider, apiKey: string): boolean {
  if (!apiKey || apiKey.trim().length === 0) return false;

  switch (provider) {
    case 'brave_search':
      return apiKey.startsWith('BSA') && apiKey.length > 20;
    case 'tavily':
      return apiKey.startsWith('tvly-') && apiKey.length > 20;
    case 'serper':
      return apiKey.length > 20;
    default:
      return apiKey.length > 10;
  }
}

// Tool definitions for LLM (OpenAI function format)
export const WEB_SEARCH_TOOL_DEFINITION = {
  type: 'function' as const,
  function: {
    name: 'web_search',
    description: 'Search the web for current information. Use this when you need up-to-date information, facts, news, or when the user asks about recent events.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to find relevant information',
        },
      },
      required: ['query'],
    },
  },
};
