/**
 * Layered-assistant settings & save payload.
 *
 * Group layered assistants carry settings beside the tree (publish to read-access members, an enforced
 * model, conversation tracking/analysis) that the old admin interface kept in `LayeredAssistantConvConfigs`.
 *
 * The rule this module exists for: **the backend clears any DATA_FIELD a save omits**
 * (`isPublished`, `model`, `trackConversations`, `supportConvAnalysis`, `analysisCategories`, `astIcon`),
 * so a save must always carry the full set. `saveGroupLayeredAssistant` writes the group keys from the
 * top level of the object it is handed (after spreading `data`), so they must be set there and removed
 * from the copied `data`; `astIcon` rides in `data`. A personal layered assistant only persists `data`,
 * and the group-only settings do not apply to it.
 *
 * No React imports.
 */

import type { LayeredAssistant } from '@/types/layeredAssistant';

/** The backend DATA_FIELDS that this module owns (everything except `astIcon`). */
const SETTING_FIELDS = ['isPublished', 'model', 'trackConversations', 'supportConvAnalysis', 'analysisCategories'] as const;

export interface LayeredSettings {
    isPublished: boolean;
    /** Enforce a model for every conversation with this layered assistant. */
    enforceModel: boolean;
    model: string | undefined;
    trackConversations: boolean;
    supportConvAnalysis: boolean;
    analysisCategories: string[];
}

/** Settings as stored. The list endpoint has returned these both top-level and inside `data`. */
export function readLayeredSettings(la: Partial<LayeredAssistant> | undefined): LayeredSettings {
    const data = (la?.data ?? {}) as Record<string, any>;
    const pick = <T,>(top: T | undefined, nested: unknown): T | undefined =>
        top !== undefined ? top : (nested as T | undefined);
    const model = pick<string>(la?.model, data.model);
    const categories = pick<string[]>(la?.analysisCategories, data.analysisCategories);
    return {
        isPublished: !!pick<boolean>(la?.isPublished, data.isPublished),
        enforceModel: !!model,
        model: model || undefined,
        trackConversations: !!pick<boolean>(la?.trackConversations, data.trackConversations),
        supportConvAnalysis: !!pick<boolean>(la?.supportConvAnalysis, data.supportConvAnalysis),
        analysisCategories: Array.isArray(categories) ? categories.filter((c) => typeof c === 'string') : [],
    };
}

/** Analysis on turns tracking on too. */
export function setLayeredAnalysis(settings: LayeredSettings, on: boolean): LayeredSettings {
    return { ...settings, supportConvAnalysis: on, trackConversations: on ? true : settings.trackConversations };
}

/**
 * Tracking off also turns analysis off — the old layered-assistant panel's behaviour. (Group
 * *assistants* instead refuse to untick tracking while analysis is on; layered ones never did.)
 */
export function setLayeredTracking(settings: LayeredSettings, on: boolean): LayeredSettings {
    return { ...settings, trackConversations: on, supportConvAnalysis: on ? settings.supportConvAnalysis : false };
}

export function setEnforcedModel(settings: LayeredSettings, enforce: boolean, fallbackModelId?: string): LayeredSettings {
    if (!enforce) return { ...settings, enforceModel: false, model: undefined };
    return { ...settings, enforceModel: true, model: settings.model ?? fallbackModelId };
}

export interface BuildSaveInput {
    la: LayeredAssistant;
    settings: LayeredSettings;
    /** Group layered assistants persist the settings; personal ones don't have them. */
    isGroup: boolean;
    /** Group-level approval for tracking/analysis. Without it stored values are kept as they were. */
    groupSupportsAnalysis: boolean;
    /** The icon shown on the standalone page, or undefined to clear it. */
    astIcon: unknown;
    now?: string;
}

/**
 * The object to hand `saveLayeredAssistant` / `saveGroupLayeredAssistant`. Always sets every
 * DATA_FIELD (see the module note), so editing one setting can never clear another.
 */
export function buildLayeredForSave({ la, settings, isGroup, groupSupportsAnalysis, astIcon, now }: BuildSaveInput): LayeredAssistant {
    const data: Record<string, any> = { ...(la.data ?? {}) };
    // The list endpoint returns these inside `data` *and* hoisted to the top level, and the group save
    // spreads `data` first — so a stale copy in `data` would out-live a change (e.g. enforcement turned
    // off) and be written straight back. The settings are written from the top level below.
    for (const field of SETTING_FIELDS) delete data[field];
    if (astIcon) data.astIcon = astIcon;
    else delete data.astIcon;

    const next: LayeredAssistant = { ...la, data, updatedAt: now ?? new Date().toISOString() };
    if (!isGroup) return next;

    const stored = readLayeredSettings(la);
    // Without the group's approval the analysis controls are hidden, so don't overwrite what's stored.
    const tracking = groupSupportsAnalysis ? settings.trackConversations || settings.supportConvAnalysis : stored.trackConversations;
    const analysis = groupSupportsAnalysis ? settings.supportConvAnalysis : stored.supportConvAnalysis;
    const categories = groupSupportsAnalysis ? settings.analysisCategories : stored.analysisCategories;

    next.isPublished = settings.isPublished;
    next.trackConversations = tracking;
    next.supportConvAnalysis = analysis;
    next.analysisCategories = categories;
    if (settings.enforceModel && settings.model) next.model = settings.model;
    else delete next.model;
    return next;
}
