import { doRequestOp } from "./doRequestOp";

const SERVICE_NAME = "notebook";

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
        path: '/api/podcasts/episodes',
        op: '',
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    return Array.isArray(result) ? (result as PodcastEpisode[]) : [];
};

export const getEpisode = async (id: string): Promise<PodcastEpisode | null> => {
    const op = {
        method: 'GET',
        path: '/api/podcasts/episodes',
        op: `/${encodeURIComponent(id)}`,
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as PodcastEpisode;
};

export const deleteEpisode = async (id: string): Promise<boolean> => {
    const op = {
        method: 'DELETE',
        path: '/api/podcasts/episodes',
        op: `/${encodeURIComponent(id)}`,
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
        path: '/api/podcasts/episodes',
        op: `/${encodeURIComponent(id)}/retry`,
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
        path: '/api/podcasts/generate',
        op: '',
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
        path: '/api/podcasts/jobs',
        op: `/${encodeURIComponent(jobId)}`,
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result;
};

export const listEpisodeProfiles = async (): Promise<EpisodeProfile[]> => {
    const op = {
        method: 'GET',
        path: '/api/episode-profiles',
        op: '',
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    return Array.isArray(result) ? (result as EpisodeProfile[]) : [];
};

export const listSpeakerProfiles = async (): Promise<SpeakerProfile[]> => {
    const op = {
        method: 'GET',
        path: '/api/speaker-profiles',
        op: '',
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
