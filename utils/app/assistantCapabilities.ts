import { Prompt } from '@/types/prompt';
import { getAssistant } from '@/utils/app/assistants';

/**
 * What an assistant has configured, as the small indicators shown on its card/row. Shared by the classic
 * gallery and the New UI list so both always agree on what counts. Order is display order.
 */
export type AssistantCapabilityKind = 'agent' | 'email' | 'api' | 'scheduled' | 'website' | 'drive' | 'workflow' | 'files';

export interface AssistantCapability {
    kind: AssistantCapabilityKind;
    /** Text shown beside/instead of the icon: a count, or a word for kinds with no icon. */
    label?: string;
    tooltip: string;
}

const isWebsiteType = (doc: any): boolean =>
    !!doc?.type && ['website/url', 'website/sitemap'].includes(doc.type);

export const getAssistantCapabilities = (assistant: Prompt): AssistantCapability[] => {
    const definition = getAssistant(assistant);
    const data: any = definition.data;
    const out: AssistantCapability[] = [];

    const dataSources = definition.dataSources ?? [];
    const websiteCount = dataSources.filter(isWebsiteType).length;
    const fileCount = dataSources.length - websiteCount;

    let folderCount = 0;
    let driveFileCount = 0;
    Object.values(data?.integrationDriveData ?? {}).forEach((provider: any) => {
        if (provider?.folders) folderCount += Object.keys(provider.folders).length;
        if (provider?.files) driveFileCount += Object.keys(provider.files).length;
    });

    if ((data?.opsLanguageVersion || 'v1') === 'v4') out.push({ kind: 'agent', label: 'Agent', tooltip: 'Agent Type Assistant' });
    if (data?.emailEvents) out.push({ kind: 'email', tooltip: 'Email Enabled' });
    if (data?.operations?.length > 0 || data?.builtInOperations?.length > 0) out.push({ kind: 'api', tooltip: 'API Integration' });
    if (data?.scheduledTaskIds && Object.keys(data.scheduledTaskIds).length > 0) out.push({ kind: 'scheduled', tooltip: 'Scheduled Tasks' });
    if (websiteCount > 0) out.push({ kind: 'website', label: `${websiteCount}`, tooltip: `${websiteCount} Website/Sitemap` });
    if (folderCount > 0 || driveFileCount > 0) {
        const label = folderCount > 0 && driveFileCount > 0 ? `${folderCount}/${driveFileCount}` : `${folderCount || driveFileCount}`;
        const folders = `${folderCount} ${folderCount === 1 ? 'Folder' : 'Folders'}`;
        const files = `${driveFileCount} ${driveFileCount === 1 ? 'File' : 'Files'}`;
        out.push({ kind: 'drive', label, tooltip: folderCount > 0 && driveFileCount > 0 ? `${folders}, ${files}` : folderCount > 0 ? folders : files });
    }
    if (data?.baseWorkflowTemplateId) out.push({ kind: 'workflow', label: 'Workflow', tooltip: 'Workflow Template' });
    if (fileCount > 0) out.push({ kind: 'files', label: `${fileCount}`, tooltip: `${fileCount} Files` });
    return out;
};
