import { doRequestOp } from "./doRequestOp";

const SERVICE_NAME = "notebook";

export type DocEngine = 'auto' | 'docling' | 'simple';
export type UrlEngine = 'auto' | 'firecrawl' | 'jina' | 'simple';
export type EmbeddingOption = 'ask' | 'always' | 'never';
export type AutoDeleteFiles = 'yes' | 'no';

export interface NotebookSettings {
    default_content_processing_engine_doc?: DocEngine | null;
    default_content_processing_engine_url?: UrlEngine | null;
    default_embedding_option?: EmbeddingOption | null;
    auto_delete_files?: AutoDeleteFiles | null;
    youtube_preferred_languages?: string[] | null;
}

export const getSettings = async (): Promise<NotebookSettings | null> => {
    const op = {
        method: 'GET',
        path: '/api/settings',
        op: '',
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as NotebookSettings;
};

export const updateSettings = async (
    patch: NotebookSettings,
): Promise<NotebookSettings | null> => {
    const op = {
        method: 'PUT',
        path: '/api/settings',
        op: '',
        service: SERVICE_NAME,
        data: patch,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as NotebookSettings;
};
