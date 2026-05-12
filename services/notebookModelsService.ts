import { doRequestOp } from "./doRequestOp";

const SERVICE_NAME = "notebook";

export type ModelType = 'language' | 'embedding' | 'text_to_speech' | 'speech_to_text';

export interface NotebookModel {
    id: string;
    name: string;
    provider: string;
    type: ModelType;
    credential?: string | null;
    created: string;
    updated: string;
}

export interface DiscoveredNotebookModel {
    name: string;
    provider: string;
    model_type?: ModelType | null;
    description?: string | null;
}

export interface ModelDefaults {
    default_chat_model?: string | null;
    default_transformation_model?: string | null;
    large_context_model?: string | null;
    default_text_to_speech_model?: string | null;
    default_speech_to_text_model?: string | null;
    default_embedding_model?: string | null;
    default_tools_model?: string | null;
}

export interface ModelTestResult {
    success: boolean;
    message: string;
}

export interface ProviderSyncResult {
    provider: string;
    discovered: number;
    new: number;
    existing: number;
}

export const listModels = async (type?: ModelType): Promise<NotebookModel[]> => {
    const op = {
        method: 'GET',
        path: '/api/models',
        op: '',
        service: SERVICE_NAME,
        queryParams: type ? { type } : undefined,
    };
    const result = await doRequestOp(op);
    return Array.isArray(result) ? (result as NotebookModel[]) : [];
};

export const createModel = async (
    data: { name: string; provider: string; type: ModelType; credential?: string }
): Promise<NotebookModel | null> => {
    const op = {
        method: 'POST',
        path: '/api/models',
        op: '',
        service: SERVICE_NAME,
        data,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as NotebookModel;
};

export const deleteModel = async (id: string): Promise<boolean> => {
    const op = {
        method: 'DELETE',
        path: '/api/models',
        op: `/${encodeURIComponent(id)}`,
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result) return false;
    if ((result as any).success === false) return false;
    return true;
};

export const testModel = async (id: string): Promise<ModelTestResult> => {
    const op = {
        method: 'POST',
        path: '/api/models',
        op: `/${encodeURIComponent(id)}/test`,
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === undefined) {
        return { success: false, message: 'Test failed' };
    }
    return result as ModelTestResult;
};

export const getDefaults = async (): Promise<ModelDefaults | null> => {
    const op = {
        method: 'GET',
        path: '/api/models',
        op: '/defaults',
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as ModelDefaults;
};

export const updateDefaults = async (
    partial: Partial<ModelDefaults>
): Promise<ModelDefaults | null> => {
    const op = {
        method: 'PUT',
        path: '/api/models',
        op: '/defaults',
        service: SERVICE_NAME,
        data: partial,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as ModelDefaults;
};

export const discoverProviderModels = async (
    provider: string
): Promise<DiscoveredNotebookModel[]> => {
    const op = {
        method: 'GET',
        path: '/api/models',
        op: `/discover/${encodeURIComponent(provider)}`,
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    return Array.isArray(result) ? (result as DiscoveredNotebookModel[]) : [];
};

export const syncProviderModels = async (
    provider: string
): Promise<ProviderSyncResult | null> => {
    const op = {
        method: 'POST',
        path: '/api/models',
        op: `/sync/${encodeURIComponent(provider)}`,
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as ProviderSyncResult;
};
