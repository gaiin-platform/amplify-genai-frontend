import { AttachedDocument } from './attacheddocument';
  

export const integrationProviders = {
    Google: 'google',
    Microsoft: 'microsoft'
  } as const;
  
// Type for the TypeScript-friendly names (keys)
export type IntegrationProviderNames = keyof typeof integrationProviders;

// Type for the actual runtime keys used by backend (values) - 'google' | 'microsoft'
export type IntegrationProviders = typeof integrationProviders[IntegrationProviderNames];

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
  
 
// Create IntegrationsMap with dynamic keys (using lowercase runtime values)
export type IntegrationsMap = Partial<{
    [K in IntegrationProviders]: Integration[];
}>;

export type IntegrationSecretsMap = Partial<{
    [K in IntegrationProviders]: IntegrationSecrets;
}>;

export interface ProviderSettings {
  azure_admin_consent_provided?: boolean;
  // Future: google_service_account_auth?: boolean;
}

export type ProviderSettingsMap = Partial<{
  [K in IntegrationProviders]: ProviderSettings;
}>;

export interface IntegrationsConfigData {
  integrations: IntegrationsMap;
  provider_settings: ProviderSettingsMap;
}

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

