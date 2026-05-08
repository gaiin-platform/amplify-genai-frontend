import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/api/sources";
const SERVICE_NAME = "notebook";

export interface SourceListItem {
    id: string;
    title?: string | null;
    topics?: string[] | null;
    asset?: { url?: string | null; file_path?: string | null; source_type?: string | null } | null;
    embedded: boolean;
    embedded_chunks: number;
    insights_count: number;
    created: string;
    updated: string;
    file_available?: boolean | null;
    command_id?: string | null;
    status?: string | null;
    processing_info?: Record<string, unknown> | null;
}

export interface CreateSourceLinkRequest {
    notebookId: string;
    url: string;
    title?: string;
}

export interface CreateSourceTextRequest {
    notebookId: string;
    content: string;
    title?: string;
}

interface ListParams {
    notebookId: string;
    limit?: number;
    offset?: number;
}

export const listSources = async (
    { notebookId, limit, offset }: ListParams
): Promise<SourceListItem[]> => {
    const queryParams: { [key: string]: string } = { notebook_id: notebookId };
    if (typeof limit === 'number') queryParams.limit = String(limit);
    if (typeof offset === 'number') queryParams.offset = String(offset);

    const op = {
        method: 'GET',
        path: URL_PATH,
        op: '',
        service: SERVICE_NAME,
        queryParams,
    };
    const result = await doRequestOp(op);
    return Array.isArray(result) ? result : [];
};

export const createSourceFromUrl = async (
    { notebookId, url, title }: CreateSourceLinkRequest
): Promise<SourceListItem | null> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: '/json',
        service: SERVICE_NAME,
        data: {
            type: 'link',
            url,
            title,
            notebooks: [notebookId],
            embed: true,
            async_processing: true,
        },
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as SourceListItem;
};

export const createSourceFromText = async (
    { notebookId, content, title }: CreateSourceTextRequest
): Promise<SourceListItem | null> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: '/json',
        service: SERVICE_NAME,
        data: {
            type: 'text',
            content,
            title,
            notebooks: [notebookId],
            embed: true,
            async_processing: true,
        },
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as SourceListItem;
};

export const deleteSource = async (sourceId: string): Promise<boolean> => {
    const op = {
        method: 'DELETE',
        path: URL_PATH,
        op: `/${encodeURIComponent(sourceId)}`,
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result) return false;
    if ((result as any).success === false) return false;
    return true;
};
