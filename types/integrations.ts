import {
    IconBrandGoogleDrive,
    IconFileSpreadsheet,
    IconFileText,
    IconForms,
    IconBrandGmail,
    IconBrandOffice,
    IconMailOpened,
    IconNotebook,
    IconBrandTeams,
    IconUsers,
    IconFile,
  } from '@tabler/icons-react';
  

export const integrationProviders = {
    Google: 'google',
    Microsoft: 'microsoft',
    // Drive: 'drive',
    // Github: 'github',
    // Slack: 'slack'
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


  
  
  // Define the icon mapping
export const integrationIconComponents = {
    "BrandGoogleDrive": IconBrandGoogleDrive,
    "FileSpreadsheet": IconFileSpreadsheet,
    "FileText": IconFileText,
    "File": IconFile,
    "Forms": IconForms,
    "BrandGmail": IconBrandGmail,
    "BrandOffice": IconBrandOffice,
    "MailOpened": IconMailOpened,
    "Notebook": IconNotebook,
    "BrandTeams": IconBrandTeams,
    "Users": IconUsers
  };
