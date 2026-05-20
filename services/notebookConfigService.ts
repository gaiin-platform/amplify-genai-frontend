import { notebookFetch, notebookFetchRaw } from './notebookFetch';

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
    const result = await notebookFetch<NotebookModel[]>({
        method: 'GET',
        path: '/models',
        queryParams: type ? { type } : undefined,
    });
    return Array.isArray(result) ? result : [];
};

export const createModel = async (
    data: { name: string; provider: string; type: ModelType; credential?: string }
): Promise<NotebookModel | null> => {
    return notebookFetch<NotebookModel>({
        method: 'POST',
        path: '/models',
        body: data,
    });
};

export const deleteModel = async (id: string): Promise<boolean> => {
    const result = await notebookFetch({
        method: 'DELETE',
        path: `/models/${encodeURIComponent(id)}`,
    });
    return result !== null;
};

export const testModel = async (id: string): Promise<ModelTestResult> => {
    const result = await notebookFetch<ModelTestResult>({
        method: 'POST',
        path: `/models/${encodeURIComponent(id)}/test`,
    });
    if (!result || (result as any).success === undefined) {
        return { success: false, message: 'Test failed' };
    }
    return result;
};

export const getDefaults = async (): Promise<ModelDefaults | null> => {
    return notebookFetch<ModelDefaults>({
        method: 'GET',
        path: '/models/defaults',
    });
};

export const updateDefaults = async (
    partial: Partial<ModelDefaults>
): Promise<ModelDefaults | null> => {
    return notebookFetch<ModelDefaults>({
        method: 'PUT',
        path: '/models/defaults',
        body: partial,
    });
};

export const discoverProviderModels = async (
    provider: string
): Promise<DiscoveredNotebookModel[]> => {
    const result = await notebookFetch<DiscoveredNotebookModel[]>({
        method: 'GET',
        path: `/models/discover/${encodeURIComponent(provider)}`,
    });
    return Array.isArray(result) ? result : [];
};

export const syncProviderModels = async (
    provider: string
): Promise<ProviderSyncResult | null> => {
    return notebookFetch<ProviderSyncResult>({
        method: 'POST',
        path: `/models/sync/${encodeURIComponent(provider)}`,
    });
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
    return notebookFetch<NotebookSettings>({
        method: 'GET',
        path: '/settings',
    });
};

export const updateSettings = async (
    patch: NotebookSettings,
): Promise<NotebookSettings | null> => {
    return notebookFetch<NotebookSettings>({
        method: 'PUT',
        path: '/settings',
        body: patch,
    });
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
    const result = await notebookFetch<Transformation[]>({
        method: 'GET',
        path: '/transformations',
    });
    return Array.isArray(result) ? result : [];
};

export const getTransformation = async (id: string): Promise<Transformation | null> => {
    return notebookFetch<Transformation>({
        method: 'GET',
        path: `/transformations/${encodeURIComponent(id)}`,
    });
};

export const createTransformation = async (
    data: CreateTransformationRequest,
): Promise<Transformation | null> => {
    return notebookFetch<Transformation>({
        method: 'POST',
        path: '/transformations',
        body: data,
    });
};

export const updateTransformation = async (
    id: string,
    data: UpdateTransformationRequest,
): Promise<Transformation | null> => {
    return notebookFetch<Transformation>({
        method: 'PUT',
        path: `/transformations/${encodeURIComponent(id)}`,
        body: data,
    });
};

export const deleteTransformation = async (id: string): Promise<boolean> => {
    const result = await notebookFetch({
        method: 'DELETE',
        path: `/transformations/${encodeURIComponent(id)}`,
    });
    return result !== null;
};

export const executeTransformation = async (
    payload: ExecuteTransformationRequest,
): Promise<ExecuteTransformationResponse | null> => {
    return notebookFetch<ExecuteTransformationResponse>({
        method: 'POST',
        path: '/transformations/execute',
        body: payload,
    });
};

export const getDefaultPrompt = async (): Promise<DefaultPrompt | null> => {
    return notebookFetch<DefaultPrompt>({
        method: 'GET',
        path: '/transformations/default-prompt',
    });
};

export const updateDefaultPrompt = async (
    prompt: DefaultPrompt,
): Promise<DefaultPrompt | null> => {
    return notebookFetch<DefaultPrompt>({
        method: 'PUT',
        path: '/transformations/default-prompt',
        body: prompt,
    });
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
    const result = await notebookFetch<PodcastEpisode[]>({
        method: 'GET',
        path: '/podcasts/episodes',
    });
    return Array.isArray(result) ? result : [];
};

export const getEpisode = async (id: string): Promise<PodcastEpisode | null> => {
    return notebookFetch<PodcastEpisode>({
        method: 'GET',
        path: `/podcasts/episodes/${encodeURIComponent(id)}`,
    });
};

export const deleteEpisode = async (id: string): Promise<boolean> => {
    const result = await notebookFetch({
        method: 'DELETE',
        path: `/podcasts/episodes/${encodeURIComponent(id)}`,
    });
    return result !== null;
};

export const retryEpisode = async (
    id: string,
): Promise<{ job_id: string; message: string } | null> => {
    return notebookFetch<{ job_id: string; message: string }>({
        method: 'POST',
        path: `/podcasts/episodes/${encodeURIComponent(id)}/retry`,
    });
};

export const generatePodcast = async (
    payload: PodcastGenerationRequest,
): Promise<PodcastGenerationResponse | null> => {
    return notebookFetch<PodcastGenerationResponse>({
        method: 'POST',
        path: '/podcasts/generate',
        body: payload,
    });
};

export const getJobStatus = async (jobId: string): Promise<any | null> => {
    return notebookFetch({
        method: 'GET',
        path: `/podcasts/jobs/${encodeURIComponent(jobId)}`,
    });
};

export const listEpisodeProfiles = async (): Promise<EpisodeProfile[]> => {
    const result = await notebookFetch<EpisodeProfile[]>({
        method: 'GET',
        path: '/episode-profiles',
    });
    return Array.isArray(result) ? result : [];
};

export const listSpeakerProfiles = async (): Promise<SpeakerProfile[]> => {
    const result = await notebookFetch<SpeakerProfile[]>({
        method: 'GET',
        path: '/speaker-profiles',
    });
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
    const response = await notebookFetchRaw({
        method: 'GET',
        path: `/podcasts/episodes/${encodeURIComponent(episodeId)}/audio`,
    });
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
