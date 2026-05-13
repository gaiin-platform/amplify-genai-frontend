import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/api";
const SERVICE_NAME = "notebook";

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
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: '/models',
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
        path: URL_PATH,
        op: '/models',
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
        path: URL_PATH,
        op: `/models/${encodeURIComponent(id)}`,
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
        path: URL_PATH,
        op: `/models/${encodeURIComponent(id)}/test`,
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
        path: URL_PATH,
        op: '/models/defaults',
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
        path: URL_PATH,
        op: '/models/defaults',
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
        path: URL_PATH,
        op: `/models/discover/${encodeURIComponent(provider)}`,
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
        path: URL_PATH,
        op: `/models/sync/${encodeURIComponent(provider)}`,
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as ProviderSyncResult;
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
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: '/settings',
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
        path: URL_PATH,
        op: '/settings',
        service: SERVICE_NAME,
        data: patch,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as NotebookSettings;
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
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: '/transformations',
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    return Array.isArray(result) ? (result as Transformation[]) : [];
};

export const getTransformation = async (id: string): Promise<Transformation | null> => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: `/transformations/${encodeURIComponent(id)}`,
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as Transformation;
};

export const createTransformation = async (
    data: CreateTransformationRequest,
): Promise<Transformation | null> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: '/transformations',
        service: SERVICE_NAME,
        data,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as Transformation;
};

export const updateTransformation = async (
    id: string,
    data: UpdateTransformationRequest,
): Promise<Transformation | null> => {
    const op = {
        method: 'PUT',
        path: URL_PATH,
        op: `/transformations/${encodeURIComponent(id)}`,
        service: SERVICE_NAME,
        data,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as Transformation;
};

export const deleteTransformation = async (id: string): Promise<boolean> => {
    const op = {
        method: 'DELETE',
        path: URL_PATH,
        op: `/transformations/${encodeURIComponent(id)}`,
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result) return false;
    if ((result as any).success === false) return false;
    return true;
};

export const executeTransformation = async (
    payload: ExecuteTransformationRequest,
): Promise<ExecuteTransformationResponse | null> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: '/transformations/execute',
        service: SERVICE_NAME,
        data: payload,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as ExecuteTransformationResponse;
};

export const getDefaultPrompt = async (): Promise<DefaultPrompt | null> => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: '/transformations/default-prompt',
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as DefaultPrompt;
};

export const updateDefaultPrompt = async (
    prompt: DefaultPrompt,
): Promise<DefaultPrompt | null> => {
    const op = {
        method: 'PUT',
        path: URL_PATH,
        op: '/transformations/default-prompt',
        service: SERVICE_NAME,
        data: prompt,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as DefaultPrompt;
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
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: '/podcasts/episodes',
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    return Array.isArray(result) ? (result as PodcastEpisode[]) : [];
};

export const getEpisode = async (id: string): Promise<PodcastEpisode | null> => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: `/podcasts/episodes/${encodeURIComponent(id)}`,
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as PodcastEpisode;
};

export const deleteEpisode = async (id: string): Promise<boolean> => {
    const op = {
        method: 'DELETE',
        path: URL_PATH,
        op: `/podcasts/episodes/${encodeURIComponent(id)}`,
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result) return false;
    if ((result as any).success === false) return false;
    return true;
};

export const retryEpisode = async (
    id: string,
): Promise<{ job_id: string; message: string } | null> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: `/podcasts/episodes/${encodeURIComponent(id)}/retry`,
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as { job_id: string; message: string };
};

export const generatePodcast = async (
    payload: PodcastGenerationRequest,
): Promise<PodcastGenerationResponse | null> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: '/podcasts/generate',
        service: SERVICE_NAME,
        data: payload,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as PodcastGenerationResponse;
};

export const getJobStatus = async (jobId: string): Promise<any | null> => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: `/podcasts/jobs/${encodeURIComponent(jobId)}`,
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result;
};

export const listEpisodeProfiles = async (): Promise<EpisodeProfile[]> => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: '/episode-profiles',
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    return Array.isArray(result) ? (result as EpisodeProfile[]) : [];
};

export const listSpeakerProfiles = async (): Promise<SpeakerProfile[]> => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: '/speaker-profiles',
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    return Array.isArray(result) ? (result as SpeakerProfile[]) : [];
};

// Audio is served as a binary file response; route it through the dedicated
// amplify proxy that proxies the upstream stream instead of doRequestOp (which
// expects JSON).
export const getEpisodeAudioUrl = (episodeId: string): string =>
    `/api/notebookAudio?episodeId=${encodeURIComponent(episodeId)}`;
