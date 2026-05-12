import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/api/notes";
const SERVICE_NAME = "notebook";

export interface Note {
    id: string;
    title?: string | null;
    content?: string | null;
    note_type?: string | null;
    created: string;
    updated: string;
    command_id?: string | null;
}

export interface CreateNoteRequest {
    notebookId: string;
    content: string;
    title?: string;
    note_type?: 'human' | 'ai';
}

export interface UpdateNoteRequest {
    title?: string;
    content?: string;
}

export const listNotes = async (notebookId: string): Promise<Note[]> => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: '',
        service: SERVICE_NAME,
        queryParams: { notebook_id: notebookId },
    };
    const result = await doRequestOp(op);
    return Array.isArray(result) ? result : [];
};

// The list endpoint omits content (backend strips it from the SurrealDB query).
// Use this to load a single note's full body, e.g. when opening the editor.
export const getNote = async (noteId: string): Promise<Note | null> => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: `/${encodeURIComponent(noteId)}`,
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as Note;
};

export const createNote = async (
    { notebookId, content, title, note_type }: CreateNoteRequest
): Promise<Note | null> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: '',
        service: SERVICE_NAME,
        data: {
            notebook_id: notebookId,
            content,
            title,
            note_type: note_type || 'human',
        },
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as Note;
};

export const updateNote = async (
    noteId: string,
    data: UpdateNoteRequest
): Promise<Note | null> => {
    const op = {
        method: 'PUT',
        path: URL_PATH,
        op: `/${encodeURIComponent(noteId)}`,
        service: SERVICE_NAME,
        data,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as Note;
};

export const deleteNote = async (noteId: string): Promise<boolean> => {
    const op = {
        method: 'DELETE',
        path: URL_PATH,
        op: `/${encodeURIComponent(noteId)}`,
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result) return false;
    if ((result as any).success === false) return false;
    return true;
};
