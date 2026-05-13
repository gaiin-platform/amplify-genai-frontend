import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/api";
const SERVICE_NAME = "notebook";

// -----------------------------------------------------------------------------
// Notebooks
// -----------------------------------------------------------------------------

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
        op: '/notebooks',
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
        op: `/notebooks/${encodeURIComponent(id)}`,
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
        op: '/notebooks',
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
        op: `/notebooks/${encodeURIComponent(id)}`,
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result) return false;
    if ((result as any).success === false) return false;
    return true;
};

// -----------------------------------------------------------------------------
// Sources
// -----------------------------------------------------------------------------

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

export interface CreateSourceFileRequest {
    notebookId: string;
    file: File;
    title?: string;
}

interface ListSourcesParams {
    notebookId?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'created' | 'updated';
    sortOrder?: 'asc' | 'desc';
}

export const listSources = async (
    { notebookId, limit, offset, sortBy, sortOrder }: ListSourcesParams = {}
): Promise<SourceListItem[]> => {
    const queryParams: { [key: string]: string } = {};
    if (notebookId) queryParams.notebook_id = notebookId;
    if (typeof limit === 'number') queryParams.limit = String(limit);
    if (typeof offset === 'number') queryParams.offset = String(offset);
    if (sortBy) queryParams.sort_by = sortBy;
    if (sortOrder) queryParams.sort_order = sortOrder;

    const op = {
        method: 'GET',
        path: URL_PATH,
        op: '/sources',
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
        op: '/sources/json',
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
        op: '/sources/json',
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

export const createSourceFromFile = async (
    { notebookId, file, title }: CreateSourceFileRequest
): Promise<SourceListItem | null> => {
    const form = new FormData();
    form.append('type', 'upload');
    form.append('notebooks', JSON.stringify([notebookId]));
    if (title) form.append('title', title);
    form.append('embed', 'true');
    form.append('async_processing', 'true');
    form.append('file', file, file.name);

    try {
        const response = await fetch('/api/notebookUpload', {
            method: 'POST',
            body: form,
        });
        if (!response.ok) return null;
        const data = await response.json();
        if (!data || (data as any).success === false) return null;
        return data as SourceListItem;
    } catch {
        return null;
    }
};

export const deleteSource = async (sourceId: string): Promise<boolean> => {
    const op = {
        method: 'DELETE',
        path: URL_PATH,
        op: `/sources/${encodeURIComponent(sourceId)}`,
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result) return false;
    if ((result as any).success === false) return false;
    return true;
};

// -----------------------------------------------------------------------------
// Notes
// -----------------------------------------------------------------------------

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
        op: '/notes',
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
        op: `/notes/${encodeURIComponent(noteId)}`,
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
        op: '/notes',
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
        op: `/notes/${encodeURIComponent(noteId)}`,
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
        op: `/notes/${encodeURIComponent(noteId)}`,
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result) return false;
    if ((result as any).success === false) return false;
    return true;
};

// -----------------------------------------------------------------------------
// Chat
// -----------------------------------------------------------------------------

export type ChatMessageType = "human" | "ai" | string;

export interface ChatMessage {
    id: string;
    type: ChatMessageType;
    content: string;
    timestamp?: string | null;
}

export interface ChatSession {
    id: string;
    title: string;
    notebook_id?: string | null;
    created: string;
    updated: string;
    message_count?: number | null;
    model_override?: string | null;
}

export interface ChatSessionWithMessages extends ChatSession {
    messages: ChatMessage[];
}

export type SourceContextMode = "off" | "insights" | "full";
export type NoteContextMode = "off" | "full";

export interface ContextSelections {
    sources: Record<string, SourceContextMode>;
    notes: Record<string, NoteContextMode>;
}

interface ContextConfig {
    sources: Record<string, string>;
    notes: Record<string, string>;
}

export interface BuildContextResponse {
    context: { sources: any[]; notes: any[] };
    token_count: number;
    char_count: number;
}

export const listChatSessions = async (notebookId: string): Promise<ChatSession[]> => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: '/chat/sessions',
        service: SERVICE_NAME,
        queryParams: { notebook_id: notebookId },
    };
    const result = await doRequestOp(op);
    return Array.isArray(result) ? result : [];
};

export const createChatSession = async (
    notebookId: string,
    title?: string,
    modelOverride?: string,
): Promise<ChatSession | null> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: '/chat/sessions',
        service: SERVICE_NAME,
        data: {
            notebook_id: notebookId,
            title,
            model_override: modelOverride,
        },
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as ChatSession;
};

export const getChatSession = async (sessionId: string): Promise<ChatSessionWithMessages | null> => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: `/chat/sessions/${encodeURIComponent(sessionId)}`,
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as ChatSessionWithMessages;
};

export const deleteChatSession = async (sessionId: string): Promise<boolean> => {
    const op = {
        method: 'DELETE',
        path: URL_PATH,
        op: `/chat/sessions/${encodeURIComponent(sessionId)}`,
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result) return false;
    if ((result as any).success === false) return false;
    return true;
};

export const buildContextConfig = (selections: ContextSelections): ContextConfig => {
    const cfg: ContextConfig = { sources: {}, notes: {} };
    for (const [id, mode] of Object.entries(selections.sources)) {
        if (mode === 'insights') cfg.sources[id] = 'insights';
        else if (mode === 'full') cfg.sources[id] = 'full content';
        else cfg.sources[id] = 'not in';
    }
    for (const [id, mode] of Object.entries(selections.notes)) {
        if (mode === 'full') cfg.notes[id] = 'full content';
        else cfg.notes[id] = 'not in';
    }
    return cfg;
};

export const buildChatContext = async (
    notebookId: string,
    selections: ContextSelections,
): Promise<BuildContextResponse | null> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: '/chat/context',
        service: SERVICE_NAME,
        data: {
            notebook_id: notebookId,
            context_config: buildContextConfig(selections),
        },
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as BuildContextResponse;
};

export const sendChatMessage = async (
    sessionId: string,
    message: string,
    context: BuildContextResponse['context'],
    modelOverride?: string,
): Promise<{ session_id: string; messages: ChatMessage[] } | null> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: '/chat/execute',
        service: SERVICE_NAME,
        data: {
            session_id: sessionId,
            message,
            context,
            model_override: modelOverride,
        },
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as { session_id: string; messages: ChatMessage[] };
};

// -----------------------------------------------------------------------------
// Search
// -----------------------------------------------------------------------------

export type SearchType = 'text' | 'vector';

export interface SearchRequest {
    query: string;
    type: SearchType;
    limit?: number;
    search_sources?: boolean;
    search_notes?: boolean;
    minimum_score?: number;
}

export interface SearchMatch {
    text?: string;
    [key: string]: any;
}

export interface SearchResult {
    id: string;
    title: string;
    parent_id: string | null;
    relevance?: number;
    similarity?: number;
    score?: number;
    matches?: string[] | SearchMatch[];
    [key: string]: any;
}

export interface SearchResponse {
    results: SearchResult[];
    total_count: number;
    search_type: SearchType;
}

export interface AskRequest {
    question: string;
    strategy_model: string;
    answer_model: string;
    final_answer_model: string;
}

export interface AskResponse {
    answer: string;
    question: string;
}

export const searchKnowledgeBase = async (
    params: SearchRequest
): Promise<SearchResponse | null> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: '/search',
        service: SERVICE_NAME,
        data: {
            query: params.query,
            type: params.type,
            limit: params.limit ?? 100,
            search_sources: params.search_sources ?? true,
            search_notes: params.search_notes ?? true,
            minimum_score: params.minimum_score ?? 0.2,
        },
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as SearchResponse;
};

export const askKnowledgeBaseSimple = async (
    params: AskRequest
): Promise<AskResponse | null> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: '/search/ask/simple',
        service: SERVICE_NAME,
        data: params,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as AskResponse;
};
