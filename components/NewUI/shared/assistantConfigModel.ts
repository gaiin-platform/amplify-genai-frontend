/**
 * assistantConfigSummary — a read-only description of everything an assistant is configured with,
 * for a viewer who cannot edit it (the "View prompt" dialog on a shared assistant).
 *
 * It reads a stored `Prompt` defensively: `types/` is read-only reference and not always accurate
 * (NEW_UI_GUIDE §17), and a shared record may be older than the editor that wrote it. Anything
 * missing or malformed is skipped rather than thrown on. Tags are deliberately not summarised.
 * No React imports.
 */

import type { Prompt } from '@/types/prompt';

export interface SummaryDataSource {
    id: string;
    name: string;
    type?: string;
    /** Stored S3 key (`s3://…` or bare), when the record has one — what a download is requested by. */
    key?: string;
    /** Set on files that belong to a group; the download endpoint needs it for those. */
    groupId?: string;
}

export interface SummaryDriveGroup {
    integration: string;
    label: string;
    fileCount: number;
    folderCount: number;
    /** Names of the selected items that carry one; may be shorter than the counts. */
    names: string[];
}

export interface SummarySkill {
    name: string;
    required: boolean;
}

export interface AssistantConfigSummary {
    instructions: string;
    /** Uploaded / library documents (everything that is not a website). */
    documents: SummaryDataSource[];
    websites: SummaryDataSource[];
    drive: SummaryDriveGroup[];
    skills: SummarySkill[];
    /** `'all' | 'auto' | 'manual'`-style label from the stored mode, when present. */
    skillSelectionMode?: string;
    /** Tools, APIs and operations by display name. */
    tools: string[];
    /** The assistant is bound to a workflow template (the template itself may not be readable). */
    hasWorkflow: boolean;
    /** Name stored with the assistant at save time; absent on assistants saved before it existed. */
    workflowName?: string;
    enforcedModelId?: string;
    enforcedEffort?: string;
}

const isRecord = (value: unknown): value is Record<string, any> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** `microsoft_drive` / `getUserEmail` → "Microsoft Drive" / "Get User Email". */
export const humanizeConfigName = (raw: string): string => {
    const spaced = raw
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_\-]+/g, ' ')
        .trim();
    return spaced
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

export const isWebsiteSource = (type?: string): boolean =>
    typeof type === 'string' && type.startsWith('website/');

const toSource = (value: unknown, index: number): SummaryDataSource | null => {
    if (!isRecord(value)) return null;
    const name = str(value.name) || str(value.metadata?.sourceUrl) || str(value.url);
    if (!name) return null;
    return {
        id: str(value.id) || `${name}-${index}`,
        name,
        type: str(value.type) || undefined,
        key: str(value.key) || undefined,
        groupId: str(value.groupId) || undefined,
    };
};

const summarizeDrive = (value: unknown): SummaryDriveGroup[] => {
    if (!isRecord(value)) return [];
    const groups: SummaryDriveGroup[] = [];
    for (const [integration, entry] of Object.entries(value)) {
        if (!isRecord(entry)) continue;
        const files = isRecord(entry.files) ? entry.files : {};
        const folders = isRecord(entry.folders) ? entry.folders : {};
        const fileCount = Object.keys(files).length;
        const folderCount = Object.keys(folders).length;
        if (fileCount + folderCount === 0) continue;
        const names = [...Object.values(folders), ...Object.values(files)]
            .map((item) => (isRecord(item) ? str(item.datasource?.name) : ''))
            .filter(Boolean);
        groups.push({ integration, label: humanizeConfigName(integration), fileCount, folderCount, names });
    }
    return groups;
};

const summarizeSkills = (value: unknown): SummarySkill[] => {
    if (!Array.isArray(value)) return [];
    return value.flatMap((ref): SummarySkill[] => {
        if (!isRecord(ref)) return [];
        // The reference stores the display name only when the editor had it; otherwise the id is
        // all we have and an id is not something to show a person.
        const name = str(ref.name);
        if (!name && !str(ref.skillId)) return [];
        return [{ name: name || 'Unnamed skill', required: ref.isRequired !== false }];
    });
};

const toolName = (value: unknown): string => {
    if (typeof value === 'string') return humanizeConfigName(value);
    if (!isRecord(value)) return '';
    const raw = str(value.name) || str(value.id) || str(value.tool);
    return raw ? humanizeConfigName(raw) : '';
};

const summarizeTools = (definition: Record<string, any>, data: Record<string, any>): string[] => {
    const sources: unknown[] = [
        ...(Array.isArray(definition.tools) ? definition.tools : []),
        ...(Array.isArray(data.operations) ? data.operations : []),
        ...(Array.isArray(data.builtInOperations) ? data.builtInOperations : []),
    ];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const source of sources) {
        const name = toolName(source);
        const key = name.toLowerCase();
        if (!name || seen.has(key)) continue;
        seen.add(key);
        out.push(name);
    }
    return out;
};

export function summarizeAssistantConfig(prompt: Prompt | null | undefined): AssistantConfigSummary {
    const definition: Record<string, any> = isRecord(prompt?.data?.assistant?.definition)
        ? (prompt!.data!.assistant!.definition as Record<string, any>)
        : {};
    const data: Record<string, any> = isRecord(definition.data) ? definition.data : {};

    const sources = (Array.isArray(definition.dataSources) ? definition.dataSources : [])
        .map(toSource)
        .filter((source): source is SummaryDataSource => source !== null);

    const documents = sources.filter((source) => !isWebsiteSource(source.type));
    const websites = sources.filter((source) => isWebsiteSource(source.type));

    // A website is stored twice: as a data source and in `websiteUrls`. List each URL once.
    const known = new Set(websites.map((site) => site.name));
    (Array.isArray(data.websiteUrls) ? data.websiteUrls : []).forEach((entry: unknown, index: number) => {
        const url = typeof entry === 'string' ? entry.trim() : isRecord(entry) ? str(entry.url) : '';
        if (!url || known.has(url)) return;
        known.add(url);
        websites.push({ id: `${url}-${index}`, name: url, type: 'website/url' });
    });

    const enforcedModelId = str(data.model) || undefined;
    const effort = str(data.thinkingLevel);

    return {
        instructions: str(definition.instructions) || str(prompt?.content),
        documents,
        websites,
        drive: summarizeDrive(data.integrationDriveData),
        skills: summarizeSkills(data.skills),
        skillSelectionMode: str(data.skillSelectionMode) || undefined,
        tools: summarizeTools(definition, data),
        hasWorkflow: !!(str(data.baseWorkflowTemplateId) || str(data.workflowTemplateId)),
        workflowName: str(data.workflowTemplateName) || undefined,
        enforcedModelId,
        // An effort level only means something while the model is enforced (see enforcedEffortModel).
        enforcedEffort: enforcedModelId && data.enforceThinkingLevel && effort ? effort : undefined,
    };
}

export type SourceOpenTarget =
    | { kind: 'url'; url: string }
    | { kind: 'file'; key: string; groupId?: string }
    | { kind: 'invalid' };

const HTTP_URL = /^https?:\/\/[^\s]+$/i;

/**
 * What opening one attached source means. Websites open at their address — only http(s), because a
 * shared record is the sender's data and must never be able to hand us a `javascript:` URL. Files
 * are requested by their stored S3 key (`key`, else the id with its `s3://` prefix removed).
 */
export function resolveSourceOpenTarget(source: SummaryDataSource): SourceOpenTarget {
    if (isWebsiteSource(source.type)) {
        const candidate = HTTP_URL.test(source.id) ? source.id : HTTP_URL.test(source.name) ? source.name : '';
        return candidate ? { kind: 'url', url: candidate } : { kind: 'invalid' };
    }
    const key = (source.key || source.id).replace(/^s3:\/\//, '').trim();
    return key ? { kind: 'file', key, ...(source.groupId ? { groupId: source.groupId } : {}) } : { kind: 'invalid' };
}
