/**
 * Group-assistant settings — the data the old admin interface kept in `additionalGroupData`
 * (`AssistantModalConfigs` + `GroupTypesAstData`) and merged into `definition.data` on save.
 *
 * The old modal edited the stored definition in place, so nothing it didn't touch was ever lost.
 * The New UI editor rebuilds `data` from scratch, so everything it does not manage has to be carried
 * forward explicitly (`preserveUnmanagedData`) or an edit silently deletes it.
 *
 * No React imports.
 */

export interface GroupTypeEntry {
    additionalInstructions: string;
    dataSources: any[];
    /** UI-only upload progress per data-source id (stripped on save). */
    documentState: Record<string, number>;
    isDisabled: boolean;
    disabledMessage: string;
}

export type GroupTypeDataMap = Record<string, GroupTypeEntry>;

export interface GroupSettings {
    isPublished: boolean;
    trackConversations: boolean;
    supportConvAnalysis: boolean;
    analysisCategories: string[];
    /** Entries for every type the group offers (empty ones are filtered out on save). */
    groupTypeData: GroupTypeDataMap;
    /** The types that apply to this assistant. */
    selectedTypes: string[];
    groupUserTypeQuestion: string;
}

export interface GroupContext {
    groupTypes: string[];
    /** Group-level approval for conversation tracking/analysis. */
    supportConvAnalysis: boolean;
}

/** `definition.data` keys the group editor writes itself. */
export const GROUP_SETTING_KEYS = [
    'isPublished',
    'trackConversations',
    'supportConvAnalysis',
    'analysisCategories',
    'groupTypeData',
    'groupUserTypeQuestion',
] as const;

/**
 * `definition.data` keys neither the creation modal nor the group panel edits. They must survive a
 * save untouched.
 */
export const UNMANAGED_DATA_KEYS = [
    'astIcon',
    'scheduledTaskIds',
    // Received-share provenance ("Shared by …"): only ever written when a copy is made.
    'sharedAssistant',
] as const;

/**
 * Also kept for a *group* assistant: its email-event setup. The editor hides that panel for group
 * assistants, so without this an edit would silently delete it.
 */
export const GROUP_PRESERVED_DATA_KEYS = ['emailEvents'] as const;

export function emptyGroupTypeEntry(): GroupTypeEntry {
    return {
        additionalInstructions: '',
        dataSources: [],
        documentState: {},
        isDisabled: false,
        disabledMessage: '',
    };
}

/** Already-saved sources are complete: give each a `key` and a 100% progress entry. */
function hydrateEntry(saved: any): GroupTypeEntry {
    const dataSources = (Array.isArray(saved?.dataSources) ? saved.dataSources : []).map((ds: any) => ({
        ...ds,
        key: ds.key || ds.id,
    }));
    return {
        additionalInstructions: typeof saved?.additionalInstructions === 'string' ? saved.additionalInstructions : '',
        dataSources,
        documentState: dataSources.reduce((acc: Record<string, number>, ds: any) => {
            acc[ds.id] = 100;
            return acc;
        }, {}),
        isDisabled: !!saved?.isDisabled,
        disabledMessage: typeof saved?.disabledMessage === 'string' ? saved.disabledMessage : '',
    };
}

/**
 * Settings as the editor opens them. Types the group no longer offers are dropped (as the old UI
 * did); types it offers but this assistant never configured start empty and unselected.
 */
export function readGroupSettings(data: Record<string, any> | undefined, group: GroupContext): GroupSettings {
    const d = data ?? {};
    const saved: Record<string, any> = d.groupTypeData && typeof d.groupTypeData === 'object' ? d.groupTypeData : {};
    const groupTypeData: GroupTypeDataMap = {};
    group.groupTypes.forEach((type) => {
        groupTypeData[type] = saved[type] ? hydrateEntry(saved[type]) : emptyGroupTypeEntry();
    });
    return {
        isPublished: !!d.isPublished,
        trackConversations: !!d.trackConversations,
        supportConvAnalysis: !!d.supportConvAnalysis,
        analysisCategories: Array.isArray(d.analysisCategories) ? d.analysisCategories.filter((c: unknown) => typeof c === 'string') : [],
        groupTypeData,
        selectedTypes: group.groupTypes.filter((type) => !!saved[type]),
        groupUserTypeQuestion: typeof d.groupUserTypeQuestion === 'string' ? d.groupUserTypeQuestion : '',
    };
}

/** Turning analysis on also turns tracking on (analysis needs the transcripts). */
export function setConvAnalysis(settings: GroupSettings, on: boolean): GroupSettings {
    return {
        ...settings,
        supportConvAnalysis: on,
        trackConversations: on ? true : settings.trackConversations,
    };
}

/**
 * Tracking cannot be switched off while analysis is on. `blocked` lets the UI explain why
 * instead of silently ignoring the click.
 */
export function setTracking(settings: GroupSettings, on: boolean): { settings: GroupSettings; blocked: boolean } {
    if (!on && settings.supportConvAnalysis) return { settings, blocked: true };
    return { settings: { ...settings, trackConversations: on }, blocked: false };
}

export function toggleType(settings: GroupSettings, type: string, on: boolean): GroupSettings {
    const has = settings.selectedTypes.includes(type);
    if (on === has) return settings;
    return {
        ...settings,
        selectedTypes: on ? [...settings.selectedTypes, type] : settings.selectedTypes.filter((t) => t !== type),
        // A type added to the group after this editor opened has no entry yet; ticking it must not be a no-op.
        groupTypeData: on && !settings.groupTypeData[type]
            ? { ...settings.groupTypeData, [type]: emptyGroupTypeEntry() }
            : settings.groupTypeData,
    };
}

/** True while any selected type still has a file uploading/processing. */
export function hasPendingGroupTypeUploads(settings: GroupSettings): boolean {
    return settings.selectedTypes.some((type) => {
        const entry = settings.groupTypeData[type];
        // A type with chat turned off hides its files and doesn't use them, so they can't block saving.
        if (!entry || entry.isDisabled) return false;
        return entry.dataSources.some((ds) => (entry.documentState[ds.id] ?? 0) < 100);
    });
}

/**
 * Persisted shape of the selected types — mirrors the old `prepAdditionalData`: every source gets
 * the group id and a storage key, ids become `s3://<key>`, and the UI-only `documentState` goes.
 */
export function finalizeGroupTypeData(settings: GroupSettings, groupId: string): Record<string, any> {
    const out: Record<string, any> = {};
    settings.selectedTypes.forEach((type) => {
        const entry = settings.groupTypeData[type];
        if (!entry) return;
        const { documentState: _ui, ...rest } = entry;
        out[type] = {
            ...rest,
            dataSources: entry.dataSources.map((ds: any) => {
                const key = ds.key || ds.id;
                return {
                    ...ds,
                    groupId,
                    key,
                    id: typeof ds.id === 'string' && ds.id.startsWith('s3://') ? ds.id : 's3://' + key,
                };
            }),
        };
    });
    return out;
}

/** Keys from the stored `data` that this editor never touches. Spread these into the new `data`. */
export function preserveUnmanagedData(
    existing: Record<string, any> | undefined,
    { isGroup = false }: { isGroup?: boolean } = {},
): Record<string, any> {
    const out: Record<string, any> = {};
    if (!existing) return out;
    const keys = isGroup ? [...UNMANAGED_DATA_KEYS, ...GROUP_PRESERVED_DATA_KEYS] : UNMANAGED_DATA_KEYS;
    keys.forEach((key) => {
        if (existing[key] !== undefined) out[key] = existing[key];
    });
    return out;
}

/**
 * The group keys to write into `data`. When the group has no conversation-analysis approval the
 * tracking/analysis keys are left out (not forced off) so a later approval finds them as they were;
 * the backend resets `supportConvAnalysis` itself if approval is missing.
 */
export function buildGroupData(
    settings: GroupSettings,
    group: GroupContext,
    groupId: string,
    existing?: Record<string, any>,
): Record<string, any> {
    const out: Record<string, any> = {
        isPublished: settings.isPublished,
        groupTypeData: finalizeGroupTypeData(settings, groupId),
        groupUserTypeQuestion: settings.groupUserTypeQuestion,
    };
    if (group.supportConvAnalysis) {
        out.trackConversations = settings.trackConversations || settings.supportConvAnalysis;
        out.supportConvAnalysis = settings.supportConvAnalysis;
        out.analysisCategories = settings.analysisCategories;
    } else if (existing) {
        (['trackConversations', 'supportConvAnalysis', 'analysisCategories'] as const).forEach((key) => {
            if (existing[key] !== undefined) out[key] = existing[key];
        });
    }
    return out;
}
