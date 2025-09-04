import {
    IconFile,
    IconTool,
    IconBulb,
    IconCode,
    IconSettings,
    IconFiles,
    IconSend,
    IconArrowsMove,
    IconDeviceSdCard,
    IconBrain,
    IconActivity,
    IconSettingsAutomation,
    IconFileExport,
    IconCalendar,
    IconSearch,
    IconApi,
    IconMail,
    IconTable,
    IconFolders,
    IconCloudUpload,
    IconCloudDownload,
    IconShare,
    IconTrash,
    IconCopy,
    IconEdit,
    IconArrowsSort,
    IconChartBar,
    IconUser,
    IconUserCircle,
    IconList,
    IconArchive,
    IconMessageCircle,
    IconPhoto,
    IconLink,
    IconWorld,
    IconZip,
    IconPlus,
    IconFileImport,
  } from '@tabler/icons-react';
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
    icon: string;//IconFileText,
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



export const getOperationIcon = (name: string | undefined) => {
  if (!name) return IconTool;
  
  const nameLower = name.toLowerCase();
  
  // Icon category mapping with arrays of related terms
  const iconCategories = [
    {
      terms: ['search', 'find', 'lookup', 'query', 'find_', 'search_'],
      icon: IconSearch
    },
    {
      terms: ['code', 'script', 'exec', 'exec_code', 'execute'],
      icon: IconCode
    },
    {
      terms: ['config', 'setting', 'configure', 'preferences', 'options'],
      icon: IconSettings
    },
    {
      terms: ['file', 'document', 'read_file', 'write_file'],
      icon: IconFile
    },
    {
      terms: ['files', 'documents', 'list_files', 'search_files'],
      icon: IconFiles
    },
    {
      terms: ['export'],
      icon: IconFileExport
    },
    {
      terms: ['import'],
      icon: IconFileImport
    },
    {
      terms: ['api', 'request', 'http', 'call_api', 'send_http'],
      icon: IconApi
    },
    {
      terms: ['data', 'storage', 'database', 'store'],
      icon: IconDeviceSdCard
    },
    {
      terms: ['ai', 'ml', 'prompt', 'llm', 'gpt', 'intelligence', 'expert', 'generate'],
      icon: IconBrain
    },
    {
      terms: ['analyze', 'monitor', 'track', 'statistics', 'metrics', 'determine'],
      icon: IconActivity
    },
    {
      terms: ['automate', 'workflow', 'automation', 'schedule', 'task'],
      icon: IconSettingsAutomation
    },
    {
      terms: ['email', 'mail', 'message', 'compose', 'draft'],
      icon: IconMail
    },
    {
      terms: ['calendar', 'event', 'schedule', 'meeting', 'appointment', 'date'],
      icon: IconCalendar
    },
    {
      terms: ['spreadsheet', 'sheet', 'table', 'row', 'column', 'cell', 'excel'],
      icon: IconTable
    },
    {
      terms: ['directory', 'folder', 'path', 'location'],
      icon: IconFolders
    },
    {
      terms: ['upload', 'push'],
      icon: IconCloudUpload
    },
    {
      terms: ['download', 'get_download'],
      icon: IconCloudDownload
    },
    {
      terms: ['share', 'sharing', 'permission'],
      icon: IconShare
    },
    {
      terms: ['delete', 'remove', 'trash'],
      icon: IconTrash
    },
    {
      terms: ['move', 'relocate'],
      icon: IconArrowsMove
    },
    {
      terms: ['copy', 'duplicate', 'clone'],
      icon: IconCopy
    },
    {
      terms: ['edit', 'update', 'modify', 'change', 'rename', 'replace'],
      icon: IconEdit
    },
    {
      terms: ['sort', 'order', 'arrange'],
      icon: IconArrowsSort
    },
    {
      terms: ['chart', 'graph', 'plot', 'diagram', 'visualization'],
      icon: IconChartBar
    },
    {
      terms: ['user', 'account', 'profile'],
      icon: IconUser
    },
    {
      terms: ['contact', 'person', 'people'],
      icon: IconUserCircle
    },
    {
      terms: ['list', 'items', 'listitem'],
      icon: IconList
    },
    {
      terms: ['archive', 'compress', 'zip', 'pack'],
      icon: IconArchive
    },
    {
      terms: ['comment', 'chat', 'discuss', 'conversation', 'reply'],
      icon: IconMessageCircle
    },
    {
      terms: ['image', 'photo', 'picture', 'graphic'],
      icon: IconPhoto
    },
    {
      terms: ['link', 'url', 'hyperlink'],
      icon: IconLink
    },
    {
      terms: ['web', 'webpage', 'website', 'browse', 'internet'],
      icon: IconWorld
    },
    {
      terms: ['plan', 'route', 'path', 'think', 'create_plan'],
      icon: IconBulb
    },
    {
      terms: ['unzip', 'extract', 'decompress'],
      icon: IconZip
    },
    {
      terms: ['send'],
      icon: IconSend
    },
    {
      terms: ['add', 'create', 'insert', 'append'],
      icon: IconPlus
    },
  ];
  
  // Find the first category with a matching term
  for (const category of iconCategories) {
    if (category.terms.some(term => nameLower.includes(term))) {
      return category.icon;
    }
  }
  
  // Return default icon if no match is found
  return IconTool;
};

