import { AttachedDocument } from './attacheddocument';
  

export const integrationProviders = {
    Google: 'google',
    Microsoft: 'microsoft'
  } as const;
  
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

