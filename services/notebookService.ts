import { doRequestOp } from './doRequestOp';

const URL_PATH = '/notebook';
const SERVICE_NAME = 'notebook';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
type QueryParams = Record<string, string | number | boolean | undefined>;

interface NotebookCallResult<T> {
    success: boolean;
    data: T | null;
    // The proxy/doRequestOp error message when success is false (e.g. a backend
    // 504 surfaces here). notebookCall() discards this; callers that need to tell
    // a timeout apart from other failures use notebookCallResult() directly.
    message?: string;
}

const notebookCallResult = async <T = unknown>(
    method: HttpMethod,
    path: string,
    body?: unknown,
    queryParams?: QueryParams,
    // enablePolling routes the call through doRequestOp's poll-status fallback so
    // it can outlive API Gateway's 29s cap (the backend proxy uses support_polling
    // for the same paths). Only slow ops like /search/ask/simple need it.
    opts?: { enablePolling?: boolean },
): Promise<NotebookCallResult<T>> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: '/proxy',
        data: {
            method,
            path,
            query_params: queryParams ?? {},
            body: body ?? null,
        },
        service: SERVICE_NAME,
        ...(opts?.enablePolling ? { enablePolling: true } : {}),
    };
    const result = await doRequestOp(op);
    return {
        success: !!result?.success,
        data: result?.success ? ((result.data as T) ?? null) : null,
        message: result?.message,
    };
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

// Binary response variant — open-notebook returns the bytes base64-encoded
// from the lambda; we rehydrate into a Response so callers can use blob().
const notebookCallRaw = async (
    method: HttpMethod,
    path: string,
    body?: unknown,
    queryParams?: QueryParams,
): Promise<Response | null> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: '/proxy/raw',
        data: {
            method,
            path,
            query_params: queryParams ?? {},
            body: body ?? null,
        },
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result?.success || !result.data) return null;
    const { content_type, data_b64 } = result.data as {
        content_type: string;
        data_b64: string;
    };
    const binary = Uint8Array.from(window.atob(data_b64), (c) => c.charCodeAt(0));
    return new Response(binary, {
        status: 200,
        headers: { 'Content-Type': content_type },
    });
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

export const deleteNotebook = async (id: string): Promise<boolean> => {
    // delete_exclusive_sources=true so sources belonging only to this notebook are
    // deleted (matching the confirm dialog's promise), while sources shared with
    // other notebooks are merely unlinked. Without this flag the backend defaults
    // to False and leaves orphaned source records behind.
    const result = await notebookCall(
        'DELETE',
        `/notebooks/${encodeURIComponent(id)}`,
        null,
        { delete_exclusive_sources: true },
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
    notebookId,
    url,
    title,
}: CreateSourceLinkRequest): Promise<SourceListItem | null> => {
    return notebookCall<SourceListItem>('POST', '/sources/json', {
        type: 'link',
        url,
        title,
        notebooks: [notebookId],
        embed: true,
        async_processing: true,
    });
};

export const createSourceFromText = async ({
    notebookId,
    content,
    title,
}: CreateSourceTextRequest): Promise<SourceListItem | null> => {
    return notebookCall<SourceListItem>('POST', '/sources/json', {
        type: 'text',
        content,
        title,
        notebooks: [notebookId],
        embed: true,
        async_processing: true,
    });
};

// Multipart file upload routes through the Next.js API proxy at
// /api/notebookUpload — the proxy attaches the Cognito JWT server-side and
// forwards to open-notebook's /api/sources (directly or via the lambda
// upload endpoint). Multipart bodies don't fit cleanly into doRequestOp's
// JSON pipeline, so this stays separate.
export const createSourceFromFile = async ({
    notebookId,
    file,
    title,
}: CreateSourceFileRequest): Promise<SourceListItem | null> => {
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
    const result = await notebookCall('DELETE', `/sources/${encodeURIComponent(sourceId)}`);
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

// The ask graph runs several sequential model calls server-side and routinely
// exceeds API Gateway's 29s cap. enablePolling lets it complete asynchronously:
// the backend proxy (support_polling) keeps running past the gateway 504 and
// writes the result to the poll-status table, which doRequestOp retrieves by
// polling. On failure we throw the proxy's real message (rather than returning
// null) so the UI reports the actual cause instead of falsely blaming model
// configuration — callers already verify a default chat + embedding model exist
// before allowing the ask.
export const askKnowledgeBaseSimple = async (
    params: AskRequest,
): Promise<AskResponse> => {
    const { success, data, message } = await notebookCallResult<AskResponse>(
        'POST',
        '/search/ask/simple',
        params,
        undefined,
        { enablePolling: true },
    );
    if (success && data) return data;
    throw new Error(message || 'Failed to generate an answer. Please try again.');
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
    outline_provider: string;
    outline_model: string;
    transcript_provider: string;
    transcript_model: string;
    default_briefing: string;
    num_segments: number;
}

export interface SpeakerVoice {
    name: string;
    voice_id: string;
    backstory: string;
    personality: string;
}

export interface SpeakerProfile {
    id: string;
    name: string;
    description: string;
    tts_provider: string;
    tts_model: string;
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

export interface EpisodeAudioResult {
    objectUrl: string | null;
    // null = network/transport failure (no response). Otherwise the upstream
    // HTTP status — non-2xx surfaces the reason (404 if audio file isn't on
    // disk yet, 401 if JWT lapsed, etc.) instead of an infinite spinner.
    status: number | null;
}

// Podcast audio is consumed by an HTML5 <audio> element, which can't attach
// Authorization headers itself. Fetch the full binary with the JWT once and
// return an object URL that the <audio> tag can use as src. Callers must
// revoke the URL on unmount (URL.revokeObjectURL) to avoid leaking blobs.
export const fetchEpisodeAudioObjectUrl = async (
    episodeId: string,
): Promise<EpisodeAudioResult> => {
    const response = await notebookCallRaw(
        'GET',
        `/podcasts/episodes/${encodeURIComponent(episodeId)}/audio`,
    );
    if (!response) return { objectUrl: null, status: null };
    if (!response.ok) {
        console.warn(
            `Episode audio fetch failed for ${episodeId}: HTTP ${response.status}`,
        );
        return { objectUrl: null, status: response.status };
    }
    try {
        const blob = await response.blob();
        return { objectUrl: URL.createObjectURL(blob), status: response.status };
    } catch (e) {
        console.error('Failed to read episode audio blob:', e);
        return { objectUrl: null, status: response.status };
    }
};
