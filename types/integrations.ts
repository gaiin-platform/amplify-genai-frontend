import { AttachedDocument } from './attacheddocument';


export const integrationProviders = {
    Google: 'google',
    Microsoft: 'microsoft'
  } as const;

// Web search providers for admin-configured web search
export const webSearchProviders = {
    brave_search: 'brave_search',
    tavily: 'tavily',
    serper: 'serper',
    serpapi: 'serpapi'
  } as const;

export type WebSearchProvider = keyof typeof webSearchProviders;

export interface WebSearchProviderConfig {
    id: WebSearchProvider;
    name: string;
    description: string;
    apiKeyUrl: string;
    apiKeyPlaceholder: string;
    freeQuota?: string;
}

export interface AdminWebSearchConfig {
    provider: WebSearchProvider;
    isEnabled: boolean;
    maskedKey?: string;
    lastUpdated?: string;
}

// Configuration for admin web search integrations
export const WEB_SEARCH_PROVIDERS: Record<WebSearchProvider, WebSearchProviderConfig> = {
    brave_search: {
        id: 'brave_search',
        name: 'Brave Search',
        description: 'Privacy-focused web search API. Comprehensive results without tracking.',
        apiKeyUrl: 'https://brave.com/search/api/',
        apiKeyPlaceholder: 'BSA...',
        freeQuota: '2,000 queries/month free',
    },
    tavily: {
        id: 'tavily',
        name: 'Tavily',
        description: 'AI-optimized search API. Returns clean, LLM-ready results.',
        apiKeyUrl: 'https://tavily.com/',
        apiKeyPlaceholder: 'tvly-...',
        freeQuota: '1,000 queries/month free',
    },
    serper: {
        id: 'serper',
        name: 'Serper',
        description: 'Google Search API. Fast and reliable search results.',
        apiKeyUrl: 'https://serper.dev/',
        apiKeyPlaceholder: '',
        freeQuota: '2,500 queries free (one-time)',
    },
    serpapi: {
        id: 'serpapi',
        name: 'SerpAPI',
        description: 'Google, Bing, Yahoo and other search engines. Comprehensive search results with structured data.',
        apiKeyUrl: 'https://serpapi.com/manage-api-key',
        apiKeyPlaceholder: '',
        freeQuota: '100 searches/month free',
    },
};
  
//   // Derive the type from the object keys
export type IntegrationProviders = keyof typeof integrationProviders;

// Helper function to extract values with literal types
const values = <T extends Record<string, U>, U extends string>(obj: T) =>
  Object.keys(obj).map((key) => obj[key]) as Array<T[keyof T]>;
export const integrationProvidersList: string[] = values(integrationProviders);

export interface Integration {
    name: string;
    id: string;
    description: string;
    isAvailable?: boolean;
}

export interface IntegrationSecrets {
    client_id: string;
    client_secret: string;
    tenant_id: string;
}
  
 
// Create IntegrationsMap with dynamic keys
export type IntegrationsMap = Partial<{
    [K in IntegrationProviders]: Integration[];
}>;

export type IntegrationSecretsMap = Partial<{
    [K in IntegrationProviders]: IntegrationSecrets;
}>;

export type IntegrationFileRecord = {
  name: string;
  id:  string;
  mimeType:  string;
  size: string;
  downloadLink?: string;
  type?: string;
}



export interface DriveFileMetadata {
  type: string;
  lastCaptured?: string; // ISO date format
  datasource?: AttachedDocument;
}

export interface IntegrationFolders {
  [folderId: string]: IntegrationFiles;
}

export interface IntegrationFiles {
  [fileId: string]: DriveFileMetadata;
}

export interface IntegrationDriveData {
  folders: IntegrationFolders;
  files: IntegrationFiles;
}

export interface DriveFilesDataSources extends Partial<Record<IntegrationProviders, IntegrationDriveData>> {}

