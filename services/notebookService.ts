type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
type QueryParams = Record<string, string | number | boolean | undefined>;

interface NotebookCallResult<T> {
    success: boolean;
    data: T | null;
    // Error message when success is false. notebookCall() discards this; callers
    // that need the cause use notebookCallResult() directly.
    message?: string;
    // Upstream HTTP status from Open Notebook (null on network failure). Lets
    // callers tell a 404 (resource not ready) apart from a 401 (token lapsed).
    status?: number | null;
}

// All notebook calls go through the Next.js proxy route, which attaches the
// Cognito access token server-side and forwards directly to the Open Notebook
// ALB. Open Notebook's JWTAuthMiddleware validates the token and scopes the
// request to the user's own database.
const notebookCallResult = async <T = unknown>(
    method: HttpMethod,
    path: string,
    body?: unknown,
    queryParams?: QueryParams,
): Promise<NotebookCallResult<T>> => {
    try {
        const response = await fetch('/api/notebook/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                method,
                path,
                query_params: queryParams ?? {},
                body: body ?? null,
            }),
        });
        if (!response.ok) {
            return {
                success: false,
                data: null,
                message: `Notebook proxy error: ${response.status} ${response.statusText}`,
                status: null,
            };
        }
        const result = await response.json();
        return {
            success: !!result?.success,
            data: result?.success ? ((result.data as T) ?? null) : null,
            message: result?.message,
            status: typeof result?.status === 'number' ? result.status : null,
        };
    } catch (e: any) {
        return {
            success: false,
            data: null,
            message: e?.message || `Network error calling ${method} ${path}`,
            status: null,
        };
    }
};

const notebookCall = async <T = unknown>(
    method: HttpMethod,
    path: string,
    body?: unknown,
    queryParams?: QueryParams,
): Promise<T | null> => {
    const { data } = await notebookCallResult<T>(method, path, body, queryParams);
    return data;
};

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
    params?: { archived?: boolean; order_by?: string },
): Promise<NotebookSummary[]> => {
    const result = await notebookCall<NotebookSummary[]>(
        'GET',
        '/notebooks',
        null,
        params as QueryParams,
    );
    return Array.isArray(result) ? result : [];
};

export const getNotebook = async (id: string): Promise<NotebookSummary | null> => {
    return notebookCall<NotebookSummary>('GET', `/notebooks/${encodeURIComponent(id)}`);
};

export const createNotebook = async (
    data: CreateNotebookRequest,
): Promise<NotebookSummary | null> => {
    return notebookCall<NotebookSummary>('POST', '/notebooks', data);
};

export interface UpdateNotebookRequest {
    name?: string;
    description?: string;
    archived?: boolean;
}

export const updateNotebook = async (
    id: string,
    data: UpdateNotebookRequest,
): Promise<NotebookSummary | null> => {
    return notebookCall<NotebookSummary>(
        'PUT',
        `/notebooks/${encodeURIComponent(id)}`,
        data,
    );
};

// What deleting a notebook would remove — drives the delete dialog's
// "keep or delete exclusive sources" choice, mirroring the reference UI.
export interface NotebookDeletePreview {
    notebook_id: string;
    notebook_name: string;
    note_count: number;
    exclusive_source_count: number;
    shared_source_count: number;
}

export const getNotebookDeletePreview = async (
    id: string,
): Promise<NotebookDeletePreview | null> => {
    return notebookCall<NotebookDeletePreview>(
        'GET',
        `/notebooks/${encodeURIComponent(id)}/delete-preview`,
    );
};

export const deleteNotebook = async (
    id: string,
    deleteExclusiveSources = false,
): Promise<boolean> => {
    // When true, sources belonging only to this notebook are deleted too;
    // sources shared with other notebooks are always merely unlinked. The
    // delete dialog surfaces this as an explicit keep/delete choice.
    const result = await notebookCall(
        'DELETE',
        `/notebooks/${encodeURIComponent(id)}`,
        null,
        { delete_exclusive_sources: deleteExclusiveSources },
    );
    return result !== null;
};

// -----------------------------------------------------------------------------
// Sources
// -----------------------------------------------------------------------------

export interface SourceListItem {
    id: string;
    title?: string | null;
    topics?: string[] | null;
    asset?: {
        url?: string | null;
        file_path?: string | null;
        source_type?: string | null;
    } | null;
    embedded: boolean;
    embedded_chunks: number;
    insights_count: number;
    created: string;
    updated: string;
    file_available?: boolean | null;
    command_id?: string | null;
    status?: string | null;
    processing_info?: Record<string, unknown> | null;
    // Only populated by the single-source GET (/sources/{id}); the list
    // endpoint (GET /sources) doesn't include notebook associations or the
    // full extracted text.
    notebooks?: string[];
    full_text?: string | null;
}

// Sources may land in zero or more notebooks (the wizard's Notebooks step is
// optional, matching the reference app), so these take a notebook id list.
export interface CreateSourceLinkRequest {
    notebooks: string[];
    url: string;
    title?: string;
    transformations?: string[];
    embed?: boolean;
}

export interface CreateSourceTextRequest {
    notebooks: string[];
    content: string;
    title?: string;
    transformations?: string[];
    embed?: boolean;
}

export interface CreateSourceFileRequest {
    notebooks: string[];
    file: File;
    title?: string;
    transformations?: string[];
    embed?: boolean;
}

export type SourceSortField =
    | 'type'
    | 'title'
    | 'created'
    | 'updated'
    | 'insights_count'
    | 'embedded';

interface ListSourcesParams {
    notebookId?: string;
    limit?: number;
    offset?: number;
    sortBy?: SourceSortField;
    sortOrder?: 'asc' | 'desc';
}

export const listSources = async (
    { notebookId, limit, offset, sortBy, sortOrder }: ListSourcesParams = {},
): Promise<SourceListItem[]> => {
    const queryParams: QueryParams = {};
    if (notebookId) queryParams.notebook_id = notebookId;
    if (typeof limit === 'number') queryParams.limit = limit;
    if (typeof offset === 'number') queryParams.offset = offset;
    if (sortBy) queryParams.sort_by = sortBy;
    if (sortOrder) queryParams.sort_order = sortOrder;

    const result = await notebookCall<SourceListItem[]>(
        'GET',
        '/sources',
        null,
        queryParams,
    );
    return Array.isArray(result) ? result : [];
};

export const createSourceFromUrl = async ({
    notebooks,
    url,
    title,
    transformations,
    embed,
}: CreateSourceLinkRequest): Promise<SourceListItem | null> => {
    return notebookCall<SourceListItem>('POST', '/sources/json', {
        type: 'link',
        url,
        title,
        notebooks,
        transformations: transformations ?? [],
        embed: embed ?? true,
        async_processing: true,
    });
};

export const createSourceFromText = async ({
    notebooks,
    content,
    title,
    transformations,
    embed,
}: CreateSourceTextRequest): Promise<SourceListItem | null> => {
    return notebookCall<SourceListItem>('POST', '/sources/json', {
        type: 'text',
        content,
        title,
        notebooks,
        transformations: transformations ?? [],
        embed: embed ?? true,
        async_processing: true,
    });
};

interface PresignedUpload {
    upload_url: string;
    file_path: string;
}

// Multipart fallback through the Next.js proxy at /api/notebookUpload, which
// attaches the Cognito JWT server-side. Only used when the backend can't mint
// presigned URLs (non-S3 storage, e.g. local dev): on the deployed site the
// ALB's WAF 403s raw binary multipart bodies, so presigned PUT is preferred.
const createSourceFromFileMultipart = async ({
    notebooks,
    file,
    title,
    transformations,
    embed,
}: CreateSourceFileRequest): Promise<SourceListItem | null> => {
    const form = new FormData();
    form.append('type', 'upload');
    form.append('notebooks', JSON.stringify(notebooks));
    if (title) form.append('title', title);
    form.append('transformations', JSON.stringify(transformations ?? []));
    form.append('embed', String(embed ?? true));
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

export const createSourceFromFile = async (
    request: CreateSourceFileRequest,
): Promise<SourceListItem | null> => {
    const { notebooks, file, title, transformations, embed } = request;

    // Preferred path: presigned S3 PUT. The file bytes go browser → S3
    // directly, never through the Amplify ALB, whose WAF false-positives on
    // raw PDF bytes in multipart bodies.
    const contentType = file.type || 'application/octet-stream';
    const presigned = await notebookCall<PresignedUpload>('POST', '/sources/upload-url', {
        filename: file.name,
        content_type: contentType,
    });

    if (presigned?.upload_url && presigned.file_path) {
        try {
            const put = await fetch(presigned.upload_url, {
                method: 'PUT',
                // Must match the content type signed into the URL.
                headers: { 'Content-Type': contentType },
                body: file,
            });
            if (put.ok) {
                return notebookCall<SourceListItem>('POST', '/sources/json', {
                    type: 'upload',
                    file_path: presigned.file_path,
                    title,
                    notebooks,
                    transformations: transformations ?? [],
                    embed: embed ?? true,
                    async_processing: true,
                });
            }
            console.error(
                `createSourceFromFile: presigned PUT failed (${put.status}); falling back to multipart`,
            );
        } catch (e) {
            console.error(
                'createSourceFromFile: presigned PUT threw; falling back to multipart',
                e,
            );
        }
    }

    // Backend can't presign (non-S3 storage) or the direct PUT failed
    // (e.g. missing bucket CORS) — use the legacy multipart proxy.
    return createSourceFromFileMultipart(request);
};

export const deleteSource = async (sourceId: string): Promise<boolean> => {
    const result = await notebookCall('DELETE', `/sources/${encodeURIComponent(sourceId)}`);
    return result !== null;
};

// Links an existing source (possibly already used in other notebooks) into
// this notebook, without duplicating or re-processing it — the inverse of
// deleteSource, which removes the source everywhere. Idempotent server-side.
export const addSourceToNotebook = async (
    notebookId: string,
    sourceId: string,
): Promise<boolean> => {
    const result = await notebookCall(
        'POST',
        `/notebooks/${encodeURIComponent(notebookId)}/sources/${encodeURIComponent(sourceId)}`,
    );
    return result !== null;
};

// Unlinks a source from one notebook only (deletes the `reference` edge) —
// unlike deleteSource, the source, its embeddings, and its other notebook
// memberships are untouched.
export const removeSourceFromNotebook = async (
    notebookId: string,
    sourceId: string,
): Promise<boolean> => {
    const result = await notebookCall(
        'DELETE',
        `/notebooks/${encodeURIComponent(notebookId)}/sources/${encodeURIComponent(sourceId)}`,
    );
    return result !== null;
};

// Re-runs processing for a failed source, or re-scrapes a link source that
// already completed. Same endpoint serves both cases server-side.
export const retrySource = async (sourceId: string): Promise<SourceListItem | null> => {
    return notebookCall<SourceListItem>('POST', `/sources/${encodeURIComponent(sourceId)}/retry`);
};

// Unlike listSources, this includes the `notebooks` array — used to figure
// out which notebook to jump into from the global Sources page.
export const getSource = async (sourceId: string): Promise<SourceListItem | null> => {
    return notebookCall<SourceListItem>('GET', `/sources/${encodeURIComponent(sourceId)}`);
};

export const updateSource = async (
    sourceId: string,
    data: { title?: string; topics?: string[] },
): Promise<SourceListItem | null> => {
    return notebookCall<SourceListItem>(
        'PUT',
        `/sources/${encodeURIComponent(sourceId)}`,
        data,
    );
};

export interface EmbedContentResponse {
    success: boolean;
    message: string;
    chunks_created?: number;
    command_id?: string;
}

// Chunks and embeds the source's full text for vector search — the "Embed
// Content" action in the source detail view. Synchronous server-side.
export const embedSource = async (
    sourceId: string,
): Promise<EmbedContentResponse | null> => {
    return notebookCall<EmbedContentResponse>('POST', '/embed', {
        item_id: sourceId,
        item_type: 'source',
        async_processing: false,
    });
};

// Downloads the original uploaded file for a file-backed source. Binary
// doesn't fit the JSON proxy, so this goes through /api/notebookDownload
// (mirror of /api/notebookUpload) which attaches the JWT server-side. A 404
// means the file is gone from storage ("File unavailable" in the UI).
export const downloadSourceFile = async (
    sourceId: string,
): Promise<{ ok: boolean; status: number | null; blob?: Blob; filename?: string }> => {
    try {
        const response = await fetch(
            `/api/notebookDownload?sourceId=${encodeURIComponent(sourceId)}`,
        );
        if (!response.ok) return { ok: false, status: response.status };
        const blob = await response.blob();
        const header = response.headers.get('content-disposition') || '';
        const match = header.match(/filename\*?=([^;]+)/i);
        let filename: string | undefined;
        if (match) {
            const value = match[1].trim();
            filename = value.toLowerCase().startsWith("utf-8''")
                ? decodeURIComponent(value.slice(7))
                : value.replace(/^["']|["']$/g, '');
        }
        return { ok: true, status: response.status, blob, filename };
    } catch {
        return { ok: false, status: null };
    }
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
    const result = await notebookCall<SourceInsight[]>(
        'GET',
        `/sources/${encodeURIComponent(sourceId)}/insights`,
    );
    return Array.isArray(result) ? result : [];
};

export const createSourceInsight = async (
    sourceId: string,
    transformationId: string,
    modelId?: string,
): Promise<InsightCreationResponse | null> => {
    return notebookCall<InsightCreationResponse>(
        'POST',
        `/sources/${encodeURIComponent(sourceId)}/insights`,
        { transformation_id: transformationId, model_id: modelId },
    );
};

export const getInsight = async (insightId: string): Promise<SourceInsight | null> => {
    return notebookCall<SourceInsight>('GET', `/insights/${encodeURIComponent(insightId)}`);
};

export const deleteInsight = async (insightId: string): Promise<boolean> => {
    const result = await notebookCall('DELETE', `/insights/${encodeURIComponent(insightId)}`);
    return result !== null;
};

export const saveInsightAsNote = async (
    insightId: string,
    notebookId?: string,
): Promise<Note | null> => {
    return notebookCall<Note>(
        'POST',
        `/insights/${encodeURIComponent(insightId)}/save-as-note`,
        { notebook_id: notebookId },
    );
};

export const getCommandJobStatus = async (
    jobId: string,
): Promise<CommandJobStatusResponse | null> => {
    return notebookCall<CommandJobStatusResponse>(
        'GET',
        `/commands/jobs/${encodeURIComponent(jobId)}`,
    );
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
    const result = await notebookCall<Note[]>('GET', '/notes', null, {
        notebook_id: notebookId,
    });
    return Array.isArray(result) ? result : [];
};

// The list endpoint omits content (backend strips it from the SurrealDB query).
// Use this to load a single note's full body, e.g. when opening the editor.
export const getNote = async (noteId: string): Promise<Note | null> => {
    return notebookCall<Note>('GET', `/notes/${encodeURIComponent(noteId)}`);
};

export const createNote = async ({
    notebookId,
    content,
    title,
    note_type,
}: CreateNoteRequest): Promise<Note | null> => {
    return notebookCall<Note>('POST', '/notes', {
        notebook_id: notebookId,
        content,
        title,
        note_type: note_type || 'human',
    });
};

export const updateNote = async (
    noteId: string,
    data: UpdateNoteRequest,
): Promise<Note | null> => {
    return notebookCall<Note>('PUT', `/notes/${encodeURIComponent(noteId)}`, data);
};

export const deleteNote = async (noteId: string): Promise<boolean> => {
    const result = await notebookCall('DELETE', `/notes/${encodeURIComponent(noteId)}`);
    return result !== null;
};

// -----------------------------------------------------------------------------
// Chat
// -----------------------------------------------------------------------------

export type ChatMessageType = 'human' | 'ai' | string;

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

export type SourceContextMode = 'off' | 'insights' | 'full';
export type NoteContextMode = 'off' | 'full';

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
    const result = await notebookCall<ChatSession[]>('GET', '/chat/sessions', null, {
        notebook_id: notebookId,
    });
    return Array.isArray(result) ? result : [];
};

export const createChatSession = async (
    notebookId: string,
    title?: string,
    modelOverride?: string,
): Promise<ChatSession | null> => {
    return notebookCall<ChatSession>('POST', '/chat/sessions', {
        notebook_id: notebookId,
        title,
        model_override: modelOverride,
    });
};

export const getChatSession = async (
    sessionId: string,
): Promise<ChatSessionWithMessages | null> => {
    return notebookCall<ChatSessionWithMessages>(
        'GET',
        `/chat/sessions/${encodeURIComponent(sessionId)}`,
    );
};

export const updateChatSession = async (
    sessionId: string,
    data: { title?: string; model_override?: string | null },
): Promise<ChatSession | null> => {
    return notebookCall<ChatSession>(
        'PUT',
        `/chat/sessions/${encodeURIComponent(sessionId)}`,
        data,
    );
};

export const deleteChatSession = async (sessionId: string): Promise<boolean> => {
    const result = await notebookCall(
        'DELETE',
        `/chat/sessions/${encodeURIComponent(sessionId)}`,
    );
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
    return notebookCall<BuildContextResponse>('POST', '/chat/context', {
        notebook_id: notebookId,
        context_config: buildContextConfig(selections),
    });
};

// Sends the per-source/per-note context_config (not a pre-built context blob),
// so the backend builds context in the same round-trip — this avoids a separate
// /chat/context call and stops a potentially large context payload from bouncing
// through the browser.
//
// Older backends' /chat/execute predates context_config and require a pre-built
// `context` field instead (they 422 on context_config). To stay compatible with
// both, we try the fast single-round-trip path first and, only if it fails, fall
// back to building context via /chat/context and resending. The fast path stays
// fast on merged backends; the fallback costs one extra round-trip on older ones.
export const sendChatMessage = async (
    notebookId: string,
    sessionId: string,
    message: string,
    selections: ContextSelections,
    modelOverride?: string,
): Promise<{ session_id: string; messages: ChatMessage[] } | null> => {
    const fast = await notebookCall<{ session_id: string; messages: ChatMessage[] }>(
        'POST',
        '/chat/execute',
        {
            session_id: sessionId,
            message,
            context_config: buildContextConfig(selections),
            model_override: modelOverride,
        },
    );
    if (fast) return fast;

    const built = await buildChatContext(notebookId, selections);
    if (!built) return null;
    return notebookCall<{ session_id: string; messages: ChatMessage[] }>(
        'POST',
        '/chat/execute',
        {
            session_id: sessionId,
            message,
            context: built.context,
            model_override: modelOverride,
        },
    );
};

// -----------------------------------------------------------------------------
// Source Chat — sessions scoped to a single source, independent of notebooks
// -----------------------------------------------------------------------------

export interface SourceChatSession {
    id: string;
    title: string;
    source_id: string;
    model_override?: string | null;
    created: string;
    updated: string;
    message_count?: number | null;
}

export interface SourceChatSessionWithMessages extends SourceChatSession {
    messages: ChatMessage[];
}

export const listSourceChatSessions = async (
    sourceId: string,
): Promise<SourceChatSession[]> => {
    const result = await notebookCall<SourceChatSession[]>(
        'GET',
        `/sources/${encodeURIComponent(sourceId)}/chat/sessions`,
    );
    return Array.isArray(result) ? result : [];
};

export const createSourceChatSession = async (
    sourceId: string,
    title?: string,
    modelOverride?: string,
): Promise<SourceChatSession | null> => {
    // The backend expects the bare record id (no "source:" prefix) in the body.
    const cleanId = sourceId.startsWith('source:') ? sourceId.slice(7) : sourceId;
    return notebookCall<SourceChatSession>(
        'POST',
        `/sources/${encodeURIComponent(sourceId)}/chat/sessions`,
        { source_id: cleanId, title, model_override: modelOverride },
    );
};

export const getSourceChatSession = async (
    sourceId: string,
    sessionId: string,
): Promise<SourceChatSessionWithMessages | null> => {
    return notebookCall<SourceChatSessionWithMessages>(
        'GET',
        `/sources/${encodeURIComponent(sourceId)}/chat/sessions/${encodeURIComponent(sessionId)}`,
    );
};

export const updateSourceChatSession = async (
    sourceId: string,
    sessionId: string,
    data: { title?: string; model_override?: string | null },
): Promise<SourceChatSession | null> => {
    return notebookCall<SourceChatSession>(
        'PUT',
        `/sources/${encodeURIComponent(sourceId)}/chat/sessions/${encodeURIComponent(sessionId)}`,
        data,
    );
};

export const deleteSourceChatSession = async (
    sourceId: string,
    sessionId: string,
): Promise<boolean> => {
    const result = await notebookCall(
        'DELETE',
        `/sources/${encodeURIComponent(sourceId)}/chat/sessions/${encodeURIComponent(sessionId)}`,
    );
    return result !== null;
};

// The messages endpoint is SSE-only upstream, so it bypasses the JSON proxy and
// goes through a dedicated route (pages/api/notebook/sourceChat.ts) that buffers
// the stream. On success, callers refetch the session for the persisted
// message list — the route only reports whether the turn succeeded.
export const sendSourceChatMessage = async (
    sourceId: string,
    sessionId: string,
    message: string,
    modelOverride?: string,
): Promise<{ success: boolean; message?: string }> => {
    try {
        const response = await fetch('/api/notebook/sourceChat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source_id: sourceId,
                session_id: sessionId,
                message,
                model_override: modelOverride ?? null,
            }),
        });
        if (!response.ok) {
            return {
                success: false,
                message: `Source chat error: ${response.status} ${response.statusText}`,
            };
        }
        const result = await response.json();
        return { success: !!result?.success, message: result?.message };
    } catch (e: any) {
        return { success: false, message: e?.message || 'Network error sending message' };
    }
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
    params: SearchRequest,
): Promise<SearchResponse | null> => {
    return notebookCall<SearchResponse>('POST', '/search', {
        query: params.query,
        type: params.type,
        limit: params.limit ?? 100,
        search_sources: params.search_sources ?? true,
        search_notes: params.search_notes ?? true,
        minimum_score: params.minimum_score ?? 0.2,
    });
};

// The ask graph runs several sequential model calls server-side and can take
// minutes. The /api/notebook/ask route streams Open Notebook's SSE progress
// events (strategy → per-source answers → final answer) through to us, which
// keeps every hop's idle timeout at bay without any polling machinery. We
// accumulate events and resolve with the final answer; on failure we throw the
// real cause so the UI reports it instead of falsely blaming model
// configuration — callers already verify a default chat + embedding model
// exist before allowing the ask.
export const askKnowledgeBaseSimple = async (
    params: AskRequest,
): Promise<AskResponse> => {
    const response = await fetch('/api/notebook/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });

    if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        throw new Error(
            errBody?.error || `Ask failed: ${response.status} ${response.statusText}`,
        );
    }
    if (!response.body) {
        throw new Error('Ask failed: empty response stream.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalAnswer: string | null = null;

    const handleEvent = (payload: string) => {
        let event: any;
        try {
            event = JSON.parse(payload);
        } catch {
            return;
        }
        if (event?.type === 'error') {
            throw new Error(event.message || 'Failed to generate an answer.');
        }
        if (event?.type === 'final_answer' && typeof event.content === 'string') {
            finalAnswer = event.content;
        }
        if (event?.type === 'complete' && typeof event.final_answer === 'string') {
            finalAnswer = event.final_answer;
        }
    };

    // SSE frames are separated by a blank line; each data line is "data: {json}".
    const drainBuffer = (flush: boolean) => {
        const frames = buffer.split('\n\n');
        buffer = flush ? '' : frames.pop() ?? '';
        for (const frame of frames) {
            for (const line of frame.split('\n')) {
                if (line.startsWith('data: ')) handleEvent(line.slice(6));
            }
        }
    };

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        drainBuffer(false);
    }
    buffer += decoder.decode();
    drainBuffer(true);

    if (finalAnswer !== null) {
        return { answer: finalAnswer, question: params.question };
    }
    throw new Error('Failed to generate an answer. Please try again.');
};

// -----------------------------------------------------------------------------
// Models
// -----------------------------------------------------------------------------

export type ModelType = 'language' | 'embedding' | 'text_to_speech' | 'speech_to_text';

export interface NotebookModel {
    id: string;
    name: string;
    provider: string;
    type: ModelType;
    credential?: string | null;
    created: string;
    updated: string;
    // Max tokens the model accepts, from the backend's context-window catalog.
    // Missing/null on older backends or unknown models — callers fall back to
    // the local catalog in components/Notebook/modelContext.ts.
    context_window?: number | null;
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
    const result = await notebookCall<NotebookModel[]>(
        'GET',
        '/models',
        null,
        type ? { type } : undefined,
    );
    return Array.isArray(result) ? result : [];
};

export const createModel = async (data: {
    name: string;
    provider: string;
    type: ModelType;
    credential?: string;
}): Promise<NotebookModel | null> => {
    return notebookCall<NotebookModel>('POST', '/models', data);
};

export const deleteModel = async (id: string): Promise<boolean> => {
    const result = await notebookCall('DELETE', `/models/${encodeURIComponent(id)}`);
    return result !== null;
};

export const testModel = async (id: string): Promise<ModelTestResult> => {
    const result = await notebookCall<ModelTestResult>(
        'POST',
        `/models/${encodeURIComponent(id)}/test`,
    );
    if (!result || (result as any).success === undefined) {
        return { success: false, message: 'Test failed' };
    }
    return result;
};

export const getDefaults = async (): Promise<ModelDefaults | null> => {
    return notebookCall<ModelDefaults>('GET', '/models/defaults');
};

export const updateDefaults = async (
    partial: Partial<ModelDefaults>,
): Promise<ModelDefaults | null> => {
    return notebookCall<ModelDefaults>('PUT', '/models/defaults', partial);
};

export const discoverProviderModels = async (
    provider: string,
): Promise<DiscoveredNotebookModel[]> => {
    const result = await notebookCall<DiscoveredNotebookModel[]>(
        'GET',
        `/models/discover/${encodeURIComponent(provider)}`,
    );
    return Array.isArray(result) ? result : [];
};

export const syncProviderModels = async (
    provider: string,
): Promise<ProviderSyncResult | null> => {
    return notebookCall<ProviderSyncResult>(
        'POST',
        `/models/sync/${encodeURIComponent(provider)}`,
    );
};

// -----------------------------------------------------------------------------
// Settings
// -----------------------------------------------------------------------------

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
    return notebookCall<NotebookSettings>('GET', '/settings');
};

export const updateSettings = async (
    patch: NotebookSettings,
): Promise<NotebookSettings | null> => {
    return notebookCall<NotebookSettings>('PUT', '/settings', patch);
};

// -----------------------------------------------------------------------------
// Embeddings rebuild
// -----------------------------------------------------------------------------

export type RebuildMode = 'existing' | 'all';

export interface RebuildEmbeddingsRequest {
    mode: RebuildMode;
    include_sources?: boolean;
    include_notes?: boolean;
    include_insights?: boolean;
}

export interface RebuildEmbeddingsResponse {
    command_id: string;
    message: string;
    estimated_items: number;
}

// The backend has shipped both naming schemes for progress/stats fields;
// mirror the upstream client and accept either.
export interface RebuildProgress {
    total_items?: number;
    processed_items?: number;
    failed_items?: number;
    total?: number;
    processed?: number;
    percentage?: number;
}

export interface RebuildStats {
    sources_processed?: number;
    notes_processed?: number;
    insights_processed?: number;
    sources?: number;
    notes?: number;
    insights?: number;
    failed?: number;
    failed_items?: number;
    processing_time?: number;
}

export type RebuildStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface RebuildStatusResponse {
    command_id: string;
    status: RebuildStatus;
    progress?: RebuildProgress;
    stats?: RebuildStats;
    started_at?: string;
    completed_at?: string;
    error_message?: string;
}

export const rebuildEmbeddings = async (
    request: RebuildEmbeddingsRequest,
): Promise<RebuildEmbeddingsResponse | null> => {
    return notebookCall<RebuildEmbeddingsResponse>('POST', '/embeddings/rebuild', request);
};

export const getRebuildStatus = async (
    commandId: string,
): Promise<RebuildStatusResponse | null> => {
    return notebookCall<RebuildStatusResponse>(
        'GET',
        `/embeddings/rebuild/${encodeURIComponent(commandId)}/status`,
    );
};

// -----------------------------------------------------------------------------
// Transformations
// -----------------------------------------------------------------------------

export interface Transformation {
    id: string;
    name: string;
    title: string;
    description: string;
    prompt: string;
    apply_default: boolean;
    created: string;
    updated: string;
}

export interface CreateTransformationRequest {
    name: string;
    title: string;
    description: string;
    prompt: string;
    apply_default?: boolean;
}

export interface UpdateTransformationRequest {
    name?: string;
    title?: string;
    description?: string;
    prompt?: string;
    apply_default?: boolean;
}

export interface ExecuteTransformationRequest {
    transformation_id: string;
    input_text: string;
    model_id: string;
}

export interface ExecuteTransformationResponse {
    output: string;
    transformation_id: string;
    model_id: string;
}

export interface DefaultPrompt {
    transformation_instructions: string;
}

export const listTransformations = async (): Promise<Transformation[]> => {
    const result = await notebookCall<Transformation[]>('GET', '/transformations');
    return Array.isArray(result) ? result : [];
};

export const getTransformation = async (id: string): Promise<Transformation | null> => {
    return notebookCall<Transformation>(
        'GET',
        `/transformations/${encodeURIComponent(id)}`,
    );
};

export const createTransformation = async (
    data: CreateTransformationRequest,
): Promise<Transformation | null> => {
    return notebookCall<Transformation>('POST', '/transformations', data);
};

export const updateTransformation = async (
    id: string,
    data: UpdateTransformationRequest,
): Promise<Transformation | null> => {
    return notebookCall<Transformation>(
        'PUT',
        `/transformations/${encodeURIComponent(id)}`,
        data,
    );
};

export const deleteTransformation = async (id: string): Promise<boolean> => {
    const result = await notebookCall(
        'DELETE',
        `/transformations/${encodeURIComponent(id)}`,
    );
    return result !== null;
};

export const executeTransformation = async (
    payload: ExecuteTransformationRequest,
): Promise<ExecuteTransformationResponse | null> => {
    return notebookCall<ExecuteTransformationResponse>(
        'POST',
        '/transformations/execute',
        payload,
    );
};

export const getDefaultPrompt = async (): Promise<DefaultPrompt | null> => {
    return notebookCall<DefaultPrompt>('GET', '/transformations/default-prompt');
};

export const updateDefaultPrompt = async (
    prompt: DefaultPrompt,
): Promise<DefaultPrompt | null> => {
    return notebookCall<DefaultPrompt>('PUT', '/transformations/default-prompt', prompt);
};

// -----------------------------------------------------------------------------
// Podcasts
// -----------------------------------------------------------------------------

export type EpisodeStatus =
    | 'running'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'error'
    | 'pending'
    | 'submitted'
    | 'unknown';

export interface EpisodeProfile {
    id: string;
    name: string;
    description: string;
    speaker_config: string;
    // New-style model references (model record IDs). Legacy provider/model
    // pairs below are still returned for profiles created before the switch.
    outline_llm?: string | null;
    transcript_llm?: string | null;
    language?: string | null;
    outline_provider?: string | null;
    outline_model?: string | null;
    transcript_provider?: string | null;
    transcript_model?: string | null;
    default_briefing: string;
    num_segments: number;
}

export interface SpeakerVoice {
    name: string;
    voice_id: string;
    backstory: string;
    personality: string;
    // Optional per-speaker TTS model override (model record ID).
    voice_model?: string | null;
}

export interface SpeakerProfile {
    id: string;
    name: string;
    description: string;
    // New-style TTS model reference (model record ID); tts_provider/tts_model
    // are the legacy equivalent.
    voice_model?: string | null;
    tts_provider?: string | null;
    tts_model?: string | null;
    speakers: SpeakerVoice[];
}

export interface PodcastEpisode {
    id: string;
    name: string;
    episode_profile: EpisodeProfile | Record<string, any>;
    speaker_profile: SpeakerProfile | Record<string, any>;
    briefing: string;
    audio_file?: string | null;
    audio_url?: string | null;
    transcript?: any;
    outline?: any;
    created?: string | null;
    job_status?: EpisodeStatus | null;
    error_message?: string | null;
}

export interface PodcastGenerationRequest {
    episode_profile: string;
    speaker_profile: string;
    episode_name: string;
    content?: string;
    notebook_id?: string;
    briefing_suffix?: string | null;
}

export interface PodcastGenerationResponse {
    job_id: string;
    status: string;
    message: string;
    episode_profile: string;
    episode_name: string;
}

export const listEpisodes = async (): Promise<PodcastEpisode[]> => {
    const result = await notebookCall<PodcastEpisode[]>('GET', '/podcasts/episodes');
    return Array.isArray(result) ? result : [];
};

export const getEpisode = async (id: string): Promise<PodcastEpisode | null> => {
    return notebookCall<PodcastEpisode>(
        'GET',
        `/podcasts/episodes/${encodeURIComponent(id)}`,
    );
};

export const deleteEpisode = async (id: string): Promise<boolean> => {
    const result = await notebookCall(
        'DELETE',
        `/podcasts/episodes/${encodeURIComponent(id)}`,
    );
    return result !== null;
};

export const retryEpisode = async (
    id: string,
): Promise<{ job_id: string; message: string } | null> => {
    return notebookCall<{ job_id: string; message: string }>(
        'POST',
        `/podcasts/episodes/${encodeURIComponent(id)}/retry`,
    );
};

export const generatePodcast = async (
    payload: PodcastGenerationRequest,
): Promise<PodcastGenerationResponse | null> => {
    return notebookCall<PodcastGenerationResponse>('POST', '/podcasts/generate', payload);
};

export const getJobStatus = async (jobId: string): Promise<any | null> => {
    return notebookCall('GET', `/podcasts/jobs/${encodeURIComponent(jobId)}`);
};

export const listEpisodeProfiles = async (): Promise<EpisodeProfile[]> => {
    const result = await notebookCall<EpisodeProfile[]>('GET', '/episode-profiles');
    return Array.isArray(result) ? result : [];
};

export const listSpeakerProfiles = async (): Promise<SpeakerProfile[]> => {
    const result = await notebookCall<SpeakerProfile[]>('GET', '/speaker-profiles');
    return Array.isArray(result) ? result : [];
};

export interface EpisodeProfileCreateData {
    name: string;
    description?: string;
    speaker_config: string;
    outline_llm?: string | null;
    transcript_llm?: string | null;
    language?: string | null;
    default_briefing: string;
    num_segments: number;
}

export const createEpisodeProfile = async (
    data: EpisodeProfileCreateData,
): Promise<EpisodeProfile | null> => {
    return notebookCall<EpisodeProfile>('POST', '/episode-profiles', data);
};

export interface SpeakerProfileCreateData {
    name: string;
    description?: string;
    voice_model?: string | null;
    speakers: SpeakerVoice[];
}

export const createSpeakerProfile = async (
    data: SpeakerProfileCreateData,
): Promise<SpeakerProfile | null> => {
    return notebookCall<SpeakerProfile>('POST', '/speaker-profiles', data);
};

export const updateEpisodeProfile = async (
    id: string,
    data: Partial<EpisodeProfileCreateData>,
): Promise<EpisodeProfile | null> => {
    return notebookCall<EpisodeProfile>(
        'PUT',
        `/episode-profiles/${encodeURIComponent(id)}`,
        data,
    );
};

export const updateSpeakerProfile = async (
    id: string,
    data: Partial<SpeakerProfileCreateData>,
): Promise<SpeakerProfile | null> => {
    return notebookCall<SpeakerProfile>(
        'PUT',
        `/speaker-profiles/${encodeURIComponent(id)}`,
        data,
    );
};

export const deleteEpisodeProfile = async (id: string): Promise<boolean> => {
    const result = await notebookCall(
        'DELETE',
        `/episode-profiles/${encodeURIComponent(id)}`,
    );
    return result !== null;
};

export const duplicateEpisodeProfile = async (
    id: string,
): Promise<EpisodeProfile | null> => {
    return notebookCall<EpisodeProfile>(
        'POST',
        `/episode-profiles/${encodeURIComponent(id)}/duplicate`,
    );
};

export const deleteSpeakerProfile = async (id: string): Promise<boolean> => {
    const result = await notebookCall(
        'DELETE',
        `/speaker-profiles/${encodeURIComponent(id)}`,
    );
    return result !== null;
};

export const duplicateSpeakerProfile = async (
    id: string,
): Promise<SpeakerProfile | null> => {
    return notebookCall<SpeakerProfile>(
        'POST',
        `/speaker-profiles/${encodeURIComponent(id)}/duplicate`,
    );
};

export interface NotebookLanguage {
    code: string;
    name: string;
}

export const listLanguages = async (): Promise<NotebookLanguage[]> => {
    const result = await notebookCall<NotebookLanguage[]>('GET', '/languages');
    return Array.isArray(result) ? result : [];
};

export interface EpisodeAudioResult {
    objectUrl: string | null;
    // null = network/transport failure (no response). Otherwise the upstream
    // HTTP status — non-2xx surfaces the reason (404 if audio file isn't on
    // disk yet, 401 if JWT lapsed, etc.) instead of an infinite spinner.
    status: number | null;
}

// Podcast audio is consumed by an HTML5 <audio> element, which can't attach
// Authorization headers itself. Open Notebook's /audio-url endpoint resolves a
// short-lived S3 presigned URL (or a fallback streaming path for non-S3
// backends); we hand that URL directly to the <audio> tag so the browser
// streams the MP3 straight from S3 — no large binary ever passes through our
// servers. Callers don't need to revoke an object URL; the presigned URL
// expires on its own after ~1 hour (server-side TTL).
export const fetchEpisodeAudioObjectUrl = async (
    episodeId: string,
): Promise<EpisodeAudioResult> => {
    const { success, data, status } = await notebookCallResult<{
        url: string;
        type: string;
    }>('GET', `/podcasts/episodes/${encodeURIComponent(episodeId)}/audio-url`);
    if (!success) {
        console.warn(
            `Episode audio fetch failed for ${episodeId}: HTTP ${status ?? 'network error'}`,
        );
        return { objectUrl: null, status: status ?? null };
    }
    if (!data?.url) {
        console.error('Episode audio response missing url', episodeId);
        return { objectUrl: null, status: status ?? null };
    }
    return { objectUrl: data.url, status: status ?? 200 };
};
