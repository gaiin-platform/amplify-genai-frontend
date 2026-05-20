import { notebookFetch } from './notebookFetch';

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
    const result = await notebookFetch<NotebookSummary[]>({
        method: 'GET',
        path: '/notebooks',
        queryParams: params as Record<string, string | number | boolean | undefined>,
    });
    return Array.isArray(result) ? result : [];
};

export const getNotebook = async (id: string): Promise<NotebookSummary | null> => {
    return notebookFetch<NotebookSummary>({
        method: 'GET',
        path: `/notebooks/${encodeURIComponent(id)}`,
    });
};

export const createNotebook = async (
    data: CreateNotebookRequest
): Promise<NotebookSummary | null> => {
    return notebookFetch<NotebookSummary>({
        method: 'POST',
        path: '/notebooks',
        body: data,
    });
};

export const deleteNotebook = async (id: string): Promise<boolean> => {
    const result = await notebookFetch({
        method: 'DELETE',
        path: `/notebooks/${encodeURIComponent(id)}`,
    });
    return result !== null;
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
    const queryParams: Record<string, string | number | boolean | undefined> = {};
    if (notebookId) queryParams.notebook_id = notebookId;
    if (typeof limit === 'number') queryParams.limit = limit;
    if (typeof offset === 'number') queryParams.offset = offset;
    if (sortBy) queryParams.sort_by = sortBy;
    if (sortOrder) queryParams.sort_order = sortOrder;

    const result = await notebookFetch<SourceListItem[]>({
        method: 'GET',
        path: '/sources',
        queryParams,
    });
    return Array.isArray(result) ? result : [];
};

export const createSourceFromUrl = async (
    { notebookId, url, title }: CreateSourceLinkRequest
): Promise<SourceListItem | null> => {
    return notebookFetch<SourceListItem>({
        method: 'POST',
        path: '/sources/json',
        body: {
            type: 'link',
            url,
            title,
            notebooks: [notebookId],
            embed: true,
            async_processing: true,
        },
    });
};

export const createSourceFromText = async (
    { notebookId, content, title }: CreateSourceTextRequest
): Promise<SourceListItem | null> => {
    return notebookFetch<SourceListItem>({
        method: 'POST',
        path: '/sources/json',
        body: {
            type: 'text',
            content,
            title,
            notebooks: [notebookId],
            embed: true,
            async_processing: true,
        },
    });
};

// Multipart file upload routes through the Next.js API proxy at
// /api/notebookUpload — the proxy attaches the Cognito JWT server-side and
// forwards to open-notebook's /api/sources, which avoids a CORS preflight on
// the multipart request with Authorization.
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
        if (!response.ok) {
            const errBody = await response.text().catch(() => '');
            console.error(
                `createSourceFromFile failed: ${response.status} ${response.statusText} — ${errBody}`,
            );
            return null;
        }
        const data = await response.json();
        return data as SourceListItem;
    } catch (e) {
        console.error('createSourceFromFile threw:', e);
        return null;
    }
};

export const deleteSource = async (sourceId: string): Promise<boolean> => {
    const result = await notebookFetch({
        method: 'DELETE',
        path: `/sources/${encodeURIComponent(sourceId)}`,
    });
    return result !== null;
};

// -----------------------------------------------------------------------------
// Source Insights
// -----------------------------------------------------------------------------

export interface SourceInsight {
    id: string;
    source_id: string;
    insight_type: string;
    content: string;
    created: string;
    updated: string;
}

export interface InsightCreationResponse {
    status: 'pending';
    message: string;
    source_id: string;
    transformation_id: string;
    command_id?: string | null;
}

export type CommandJobStatus =
    | 'submitted'
    | 'pending'
    | 'running'
    | 'completed'
    | 'failed'
    | 'cancelled'
    | string;

export interface CommandJobStatusResponse {
    job_id: string;
    status: CommandJobStatus;
    result?: Record<string, unknown> | null;
    error_message?: string | null;
    created?: string | null;
    updated?: string | null;
    progress?: Record<string, unknown> | null;
}

export const listSourceInsights = async (sourceId: string): Promise<SourceInsight[]> => {
    const result = await notebookFetch<SourceInsight[]>({
        method: 'GET',
        path: `/sources/${encodeURIComponent(sourceId)}/insights`,
    });
    return Array.isArray(result) ? result : [];
};

export const createSourceInsight = async (
    sourceId: string,
    transformationId: string,
    modelId?: string,
): Promise<InsightCreationResponse | null> => {
    return notebookFetch<InsightCreationResponse>({
        method: 'POST',
        path: `/sources/${encodeURIComponent(sourceId)}/insights`,
        body: {
            transformation_id: transformationId,
            model_id: modelId,
        },
    });
};

export const getInsight = async (insightId: string): Promise<SourceInsight | null> => {
    return notebookFetch<SourceInsight>({
        method: 'GET',
        path: `/insights/${encodeURIComponent(insightId)}`,
    });
};

export const deleteInsight = async (insightId: string): Promise<boolean> => {
    const result = await notebookFetch({
        method: 'DELETE',
        path: `/insights/${encodeURIComponent(insightId)}`,
    });
    return result !== null;
};

export const saveInsightAsNote = async (
    insightId: string,
    notebookId?: string,
): Promise<Note | null> => {
    return notebookFetch<Note>({
        method: 'POST',
        path: `/insights/${encodeURIComponent(insightId)}/save-as-note`,
        body: { notebook_id: notebookId },
    });
};

export const getCommandJobStatus = async (
    jobId: string,
): Promise<CommandJobStatusResponse | null> => {
    return notebookFetch<CommandJobStatusResponse>({
        method: 'GET',
        path: `/commands/jobs/${encodeURIComponent(jobId)}`,
    });
};

const TERMINAL_COMMAND_STATUSES = new Set(['completed', 'failed', 'cancelled', 'error']);

// Polls /commands/jobs/{job_id} until the job reaches a terminal status,
// `timeoutMs` elapses, or `signal` is aborted. Resolves with the final
// status response (or null on timeout/abort/network failure).
export const waitForCommand = async (
    jobId: string,
    {
        intervalMs = 2500,
        timeoutMs = 180_000,
        signal,
    }: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<CommandJobStatusResponse | null> => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (signal?.aborted) return null;
        const status = await getCommandJobStatus(jobId);
        if (status && TERMINAL_COMMAND_STATUSES.has(status.status)) return status;
        await new Promise((r) => setTimeout(r, intervalMs));
    }
    return null;
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
    const result = await notebookFetch<Note[]>({
        method: 'GET',
        path: '/notes',
        queryParams: { notebook_id: notebookId },
    });
    return Array.isArray(result) ? result : [];
};

// The list endpoint omits content (backend strips it from the SurrealDB query).
// Use this to load a single note's full body, e.g. when opening the editor.
export const getNote = async (noteId: string): Promise<Note | null> => {
    return notebookFetch<Note>({
        method: 'GET',
        path: `/notes/${encodeURIComponent(noteId)}`,
    });
};

export const createNote = async (
    { notebookId, content, title, note_type }: CreateNoteRequest
): Promise<Note | null> => {
    return notebookFetch<Note>({
        method: 'POST',
        path: '/notes',
        body: {
            notebook_id: notebookId,
            content,
            title,
            note_type: note_type || 'human',
        },
    });
};

export const updateNote = async (
    noteId: string,
    data: UpdateNoteRequest
): Promise<Note | null> => {
    return notebookFetch<Note>({
        method: 'PUT',
        path: `/notes/${encodeURIComponent(noteId)}`,
        body: data,
    });
};

export const deleteNote = async (noteId: string): Promise<boolean> => {
    const result = await notebookFetch({
        method: 'DELETE',
        path: `/notes/${encodeURIComponent(noteId)}`,
    });
    return result !== null;
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
    const result = await notebookFetch<ChatSession[]>({
        method: 'GET',
        path: '/chat/sessions',
        queryParams: { notebook_id: notebookId },
    });
    return Array.isArray(result) ? result : [];
};

export const createChatSession = async (
    notebookId: string,
    title?: string,
    modelOverride?: string,
): Promise<ChatSession | null> => {
    return notebookFetch<ChatSession>({
        method: 'POST',
        path: '/chat/sessions',
        body: {
            notebook_id: notebookId,
            title,
            model_override: modelOverride,
        },
    });
};

export const getChatSession = async (sessionId: string): Promise<ChatSessionWithMessages | null> => {
    return notebookFetch<ChatSessionWithMessages>({
        method: 'GET',
        path: `/chat/sessions/${encodeURIComponent(sessionId)}`,
    });
};

export const deleteChatSession = async (sessionId: string): Promise<boolean> => {
    const result = await notebookFetch({
        method: 'DELETE',
        path: `/chat/sessions/${encodeURIComponent(sessionId)}`,
    });
    return result !== null;
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
    return notebookFetch<BuildContextResponse>({
        method: 'POST',
        path: '/chat/context',
        body: {
            notebook_id: notebookId,
            context_config: buildContextConfig(selections),
        },
    });
};

export const sendChatMessage = async (
    sessionId: string,
    message: string,
    context: BuildContextResponse['context'],
    modelOverride?: string,
): Promise<{ session_id: string; messages: ChatMessage[] } | null> => {
    return notebookFetch<{ session_id: string; messages: ChatMessage[] }>({
        method: 'POST',
        path: '/chat/execute',
        body: {
            session_id: sessionId,
            message,
            context,
            model_override: modelOverride,
        },
    });
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
    return notebookFetch<SearchResponse>({
        method: 'POST',
        path: '/search',
        body: {
            query: params.query,
            type: params.type,
            limit: params.limit ?? 100,
            search_sources: params.search_sources ?? true,
            search_notes: params.search_notes ?? true,
            minimum_score: params.minimum_score ?? 0.2,
        },
    });
};

export const askKnowledgeBaseSimple = async (
    params: AskRequest
): Promise<AskResponse | null> => {
    return notebookFetch<AskResponse>({
        method: 'POST',
        path: '/search/ask/simple',
        body: params,
    });
};
