import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/api/notebooks";
const SERVICE_NAME = "notebook";

export interface NotebookSummary {
    id: string;
    name: string;
    description?: string;
    archived?: boolean;
    created?: string;
    updated?: string;
    source_count?: number;
    note_count?: number;
}

export interface CreateNotebookRequest {
    name: string;
    description?: string;
}

export const listNotebooks = async (
    params?: { archived?: boolean; order_by?: string }
): Promise<NotebookSummary[]> => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: '',
        service: SERVICE_NAME,
        queryParams: params as { [key: string]: string } | undefined,
    };
    const result = await doRequestOp(op);
    return Array.isArray(result) ? result : [];
};

export const getNotebook = async (id: string): Promise<NotebookSummary | null> => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: `/${encodeURIComponent(id)}`,
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as NotebookSummary;
};

export const createNotebook = async (
    data: CreateNotebookRequest
): Promise<NotebookSummary | null> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: '',
        service: SERVICE_NAME,
        data,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as NotebookSummary;
};

export const deleteNotebook = async (id: string): Promise<boolean> => {
    const op = {
        method: 'DELETE',
        path: URL_PATH,
        op: `/${encodeURIComponent(id)}`,
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result) return false;
    if ((result as any).success === false) return false;
    return true;
};
