import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
    LucideAlertCircle,
    LucideAlertTriangle,
    LucideChevronDown,
    LucideCopy,
    LucideEdit3,
    LucideInfo,
    LucideLayoutTemplate,
    LucideLightbulb,
    LucideLoader2,
    LucideMic,
    LucideMoreVertical,
    LucidePlus,
    LucideRefreshCcw,
    LucideTrash2,
    LucideUsers,
    LucideVolume2,
    LucideX,
} from './LucideIcons';
import { ConfirmDialog } from '@/components/NewUI/shared/ConfirmDialog';
import { CreationModalShell } from '@/components/NewUI/shared/CreationModalShell';
import { SegmentedControl, SegmentItem } from '@/components/NewUI/shared/SegmentedControl';
import {
    cardClass,
    primaryButtonClass,
    outlineSmButtonClass,
    outlineBadgeClass,
    secondaryBadgeClass,
} from './notebookUI';
import {
    createEpisodeProfile,
    createSpeakerProfile,
    deleteEpisode as deleteEpisodeApi,
    deleteEpisodeProfile,
    deleteSpeakerProfile,
    duplicateEpisodeProfile,
    duplicateSpeakerProfile,
    EpisodeProfile,
    EpisodeStatus,
    fetchEpisodeAudioObjectUrl,
    listEpisodeProfiles,
    listEpisodes,
    listModels,
    listSpeakerProfiles,
    NotebookModel,
    PodcastEpisode,
    PodcastGenerationResponse,
    retryEpisode as retryEpisodeApi,
    SpeakerProfile,
} from '@/services/notebookService';
import { CreateEpisodeProfileDialog } from './CreateEpisodeProfileDialog';
import { CreateSpeakerProfileDialog } from './CreateSpeakerProfileDialog';
import { DropdownButton } from './DropdownButton';
import {
    DEFAULT_EPISODE_PROFILES,
    DEFAULT_SPEAKER_PROFILES,
    resolveDefaultVoiceId,
} from './defaultPodcastProfiles';
import { GeneratePodcastDialog } from './GeneratePodcastDialog';
import { formatDistanceToNow } from './relativeTime';

type Tab = 'episodes' | 'templates';
type StatusGroup = 'running' | 'completed' | 'failed' | 'pending';

// Reference STATUS_META: outline badges tinted per status, hidden when
// completed.
const STATUS_META: Record<
    EpisodeStatus,
    { label: string; className: string; group: StatusGroup }
> = {
    running: {
        label: 'Processing',
        className: 'border-transparent bg-[--bg-active] text-[--text-muted]',
        group: 'running',
    },
    processing: {
        label: 'Processing',
        className: 'border-transparent bg-[--bg-active] text-[--text-muted]',
        group: 'running',
    },
    pending: {
        label: 'Pending',
        className: 'border-transparent bg-[--bg-active] text-[--text-muted]',
        group: 'pending',
    },
    submitted: {
        label: 'Pending',
        className: 'border-transparent bg-[--bg-active] text-[--text-muted]',
        group: 'pending',
    },
    completed: {
        label: 'Completed',
        className: 'border-transparent bg-[--bg-active] text-[--text-muted]',
        group: 'completed',
    },
    failed: {
        label: 'Failed',
        className: 'border-transparent bg-[--bg-active] text-[--text-error]',
        group: 'failed',
    },
    error: {
        label: 'Failed',
        className: 'border-transparent bg-[--bg-active] text-[--text-error]',
        group: 'failed',
    },
    unknown: {
        label: 'Unknown',
        className:
            'border-transparent bg-[--bg-active] text-[--text-muted]',
        group: 'pending',
    },
};

const FAILED_STATUSES: EpisodeStatus[] = ['failed', 'error'];

// Reference needsModelSetup: a profile is unconfigured when it has neither a
// new-style model reference nor a legacy provider/model pair.
const episodeProfileNeedsSetup = (p: EpisodeProfile): boolean =>
    (!p.outline_llm && !(p.outline_provider && p.outline_model)) ||
    (!p.transcript_llm && !(p.transcript_provider && p.transcript_model));
const speakerProfileNeedsSetup = (p: SpeakerProfile): boolean =>
    !p.voice_model && !(p.tts_provider && p.tts_model);

const ghostSmButtonClass =
    'inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors hover:bg-[--bg-hover] disabled:pointer-events-none disabled:opacity-50';
const setupBadge = (
    <span className="inline-flex items-center gap-1 rounded-md border border-[--border-subtle] px-2 py-0.5 text-xs font-medium text-[--text-secondary]">
        <LucideAlertTriangle size={12} />
        Setup required
    </span>
);

// Memoized so the <audio> DOM node is created once per episode and never
// re-mounted on parent re-renders (polling, modal open, etc.). Re-mounting an
// <audio> element pauses playback, which the user hit when clicking Details
// while a podcast was playing.
//
// Audio is served via a short-lived S3 presigned URL resolved by the lambda
// (Open Notebook's /audio-url endpoint).  The <audio> tag uses the presigned
// URL as its src and streams directly from S3 — no large binary ever passes
// through Lambda or API Gateway (which has a ~10 MB response cap).
// Range/seek works normally because the browser talks directly to S3.
const audioErrorMessage = (status: number | null): string => {
    if (status === null) return 'Network error fetching audio.';
    if (status === 404)
        return "Audio isn't available yet — the job finished but the file isn't on disk.";
    if (status === 401 || status === 403)
        return 'Not authorized to fetch this audio. Try reloading to refresh your session.';
    return `Couldn't load audio (HTTP ${status}).`;
};

const EpisodeAudio = memo(({ episodeId }: { episodeId: string }) => {
    const [src, setSrc] = useState<string | null>(null);
    const [errorStatus, setErrorStatus] = useState<number | null | undefined>(undefined);
    const [attempt, setAttempt] = useState<number>(0);

    useEffect(() => {
        let cancelled = false;
        setSrc(null);
        setErrorStatus(undefined);
        (async () => {
            const result = await fetchEpisodeAudioObjectUrl(episodeId);
            if (cancelled) return;
            if (result.objectUrl) {
                setSrc(result.objectUrl);
            } else {
                setErrorStatus(result.status);
            }
        })();
        return () => {
            cancelled = true;
            // Presigned URLs are not blob: URLs — no revocation needed.
        };
    }, [episodeId, attempt]);

    if (errorStatus !== undefined) {
        return (
            <div className="flex items-start gap-2 rounded-md border border-[--border-subtle] bg-[--bg-raised] p-2 text-xs text-[--text-error]">
                <LucideAlertCircle size={14} className="mt-0.5 flex-none" />
                <span className="flex-1">{audioErrorMessage(errorStatus)}</span>
                <button
                    onClick={() => setAttempt((n) => n + 1)}
                    className="flex items-center gap-1 rounded border border-[--border-subtle] bg-transparent px-2 py-0.5 text-[11px] font-medium text-[--text-secondary] hover:bg-[--bg-hover]"
                >
                    <LucideRefreshCcw size={12} />
                    Retry
                </button>
            </div>
        );
    }
    if (!src) {
        return (
            <div className="flex items-center gap-2 text-xs text-[--text-muted]">
                <LucideLoader2 size={14} className="animate-spin" />
                Loading audio...
            </div>
        );
    }
    return <audio controls preload="auto" src={src} className="w-full" />;
});
EpisodeAudio.displayName = 'EpisodeAudio';

const StatusBadge = ({ status }: { status?: EpisodeStatus | null }) => {
    if (status === 'completed') return null;
    const meta = STATUS_META[status ?? 'unknown'] || STATUS_META.unknown;
    return (
        <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${meta.className}`}
        >
            {meta.label}
        </span>
    );
};

const SummaryBadge = ({ label, value }: { label: string; value: number }) => (
    <span className={`${outlineBadgeClass} font-medium`}>
        <span className="mr-1.5 text-[--text-muted]">{label}</span>
        <span>{value}</span>
    </span>
);

const EpisodeDetailsModal = ({
    episode,
    models,
    onClose,
}: {
    episode: PodcastEpisode;
    models: NotebookModel[];
    onClose: () => void;
}) => {
    const [activeTab, setActiveTab] = useState<'summary' | 'outline' | 'transcript'>(
        'summary',
    );

    const profile = episode.episode_profile as EpisodeProfile | undefined;
    const speakerProfile = episode.speaker_profile as SpeakerProfile | undefined;

    // Resolves a new-style model-record reference first, falling back to the
    // legacy provider/model string pair — mirrors EpisodeProfilesPanel's
    // modelName helper so this dialog doesn't show "— / —" for profiles
    // created through the current UI (which only populate the *_llm /
    // voice_model fields, not the legacy ones).
    const modelName = useCallback(
        (
            ref?: string | null,
            legacyProvider?: string | null,
            legacyModel?: string | null,
        ): string => {
            if (ref) {
                const m = models.find((mm) => mm.id === ref);
                return m ? `${m.provider} / ${m.name}` : ref;
            }
            if (legacyProvider && legacyModel) return `${legacyProvider} / ${legacyModel}`;
            return '—';
        },
        [models],
    );
    const outlineSegments = (episode.outline as any)?.segments || [];
    const transcriptEntries = (episode.transcript as any)?.transcript || [];
    const isCompleted = episode.job_status === 'completed';
    const createdLabel = episode.created
        ? `Created ${formatDistanceToNow(episode.created)}`
        : null;

    const tabItems: SegmentItem[] = [
        { id: 'summary', label: 'Summary' },
        { id: 'outline', label: 'Outline' },
        { id: 'transcript', label: 'Transcript' },
    ];

    const infoBox = 'rounded-md border border-[--border-subtle] bg-[--bg-active] p-3 text-xs';

    return (
        <CreationModalShell title={episode.name} onClose={onClose}>
            <div className="flex h-full flex-col gap-4 pt-2 text-[--text-primary]">
                    <p className="text-sm text-[--text-muted]">
                        {profile?.name || 'Unknown'}
                        {createdLabel ? ` • ${createdLabel}` : ''}
                    </p>

                    {isCompleted && <EpisodeAudio episodeId={episode.id} />}

                    <SegmentedControl
                        items={tabItems}
                        value={activeTab}
                        onChange={(id) => setActiveTab(id as typeof activeTab)}
                        aria-label="Episode detail view"
                    />

                    <div className="flex-1 overflow-y-auto pr-1 text-sm">
                        {activeTab === 'summary' && (
                            <div className="space-y-6">
                                <section className="space-y-2">
                                    <h4 className="text-sm font-semibold">Episode profile</h4>
                                    <div className="grid gap-2 text-sm md:grid-cols-2">
                                        <div>
                                            <p className="text-[--text-muted]">
                                                Outline model
                                            </p>
                                            <p>
                                                {modelName(
                                                    profile?.outline_llm,
                                                    profile?.outline_provider,
                                                    profile?.outline_model,
                                                )}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[--text-muted]">
                                                Transcript model
                                            </p>
                                            <p>
                                                {modelName(
                                                    profile?.transcript_llm,
                                                    profile?.transcript_provider,
                                                    profile?.transcript_model,
                                                )}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[--text-muted]">
                                                Segments
                                            </p>
                                            <p>{profile?.num_segments ?? '—'}</p>
                                        </div>
                                    </div>
                                    {profile?.default_briefing ? (
                                        <div className={`${infoBox} whitespace-pre-wrap`}>
                                            {profile.default_briefing}
                                        </div>
                                    ) : null}
                                </section>

                                <section className="space-y-2">
                                    <h4 className="text-sm font-semibold">Speaker profile</h4>
                                    <p className="text-xs text-[--text-muted]">
                                        {modelName(
                                            speakerProfile?.voice_model,
                                            speakerProfile?.tts_provider,
                                            speakerProfile?.tts_model,
                                        )}
                                    </p>
                                    {(speakerProfile?.speakers || []).map((sp, i) => (
                                        <div key={`${sp.name}-${i}`} className={infoBox}>
                                            <p className="font-semibold">{sp.name}</p>
                                            <p className="text-[--text-muted]">
                                                Voice ID: {sp.voice_id}
                                            </p>
                                            {sp.backstory && (
                                                <p className="mt-2 whitespace-pre-wrap text-[--text-muted]">
                                                    <span className="font-semibold">
                                                        Backstory:
                                                    </span>{' '}
                                                    {sp.backstory}
                                                </p>
                                            )}
                                            {sp.personality && (
                                                <p className="mt-2 whitespace-pre-wrap text-[--text-muted]">
                                                    <span className="font-semibold">
                                                        Personality:
                                                    </span>{' '}
                                                    {sp.personality}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </section>

                                {episode.briefing && (
                                    <section className="space-y-2">
                                        <h4 className="text-sm font-semibold">Briefing</h4>
                                        <div className={`${infoBox} whitespace-pre-wrap`}>
                                            {episode.briefing}
                                        </div>
                                    </section>
                                )}
                            </div>
                        )}

                        {activeTab === 'outline' &&
                            (outlineSegments.length === 0 ? (
                                <p className="text-xs text-[--text-muted]">
                                    No outline available.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {outlineSegments.map((seg: any, i: number) => (
                                        <div key={i} className={`${infoBox} space-y-1`}>
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="font-semibold">
                                                    {seg.name || `Segment ${i + 1}`}
                                                </p>
                                                {seg.size && (
                                                    <span className="inline-flex items-center rounded-md border border-[--border-subtle] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[--text-secondary]">
                                                        {seg.size}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="whitespace-pre-wrap text-[--text-muted]">
                                                {seg.description || 'No description'}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ))}

                        {activeTab === 'transcript' &&
                            (transcriptEntries.length === 0 ? (
                                <p className="text-xs text-[--text-muted]">
                                    No transcript available.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {transcriptEntries.map((e: any, i: number) => (
                                        <div key={i} className={`${infoBox} space-y-1`}>
                                            <p className="font-semibold">
                                                {e.speaker || 'Speaker'}
                                            </p>
                                            <p className="whitespace-pre-wrap text-[--text-muted]">
                                                {e.dialogue || ''}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ))}
                    </div>
            </div>
        </CreationModalShell>
    );
};

const EpisodeCard = ({
    episode,
    onDelete,
    onRetry,
    onView,
    retrying,
    deleting,
}: {
    episode: PodcastEpisode;
    onDelete: () => void;
    onRetry: () => void;
    onView: () => void;
    retrying: boolean;
    deleting: boolean;
}) => {
    const status = (episode.job_status || 'unknown') as EpisodeStatus;
    const isFailed = FAILED_STATUSES.includes(status);
    const isCompleted = status === 'completed';
    // Optimistic placeholders have client-side ids and no server row yet, so
    // Details/Delete would hit a 404. Hide those actions until polling swaps
    // in the real episode (usually within one poll cycle).
    const isPlaceholder = episode.id.startsWith('temp-');
    const profileName =
        (episode.episode_profile as EpisodeProfile)?.name || 'Unknown';

    return (
        <div className="rounded-xl border border-[--border-subtle] bg-[--bg-raised] shadow-sm">
            <div className="space-y-4 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-[14px] font-semibold">{episode.name}</h3>
                            <StatusBadge status={status} />
                        </div>
                        <p className="text-xs text-[--text-muted]">
                            Profile: {profileName}
                            {episode.created &&
                                ` • Created ${formatDistanceToNow(episode.created)}`}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {!isPlaceholder && (
                            <button onClick={onView} className={outlineSmButtonClass}>
                                <LucideInfo size={16} className="mr-2" />
                                Details
                            </button>
                        )}
                        {isFailed && (
                            <button
                                onClick={onRetry}
                                disabled={retrying}
                                className={outlineSmButtonClass}
                            >
                                <LucideRefreshCcw
                                    size={16}
                                    className={`mr-2 ${retrying ? 'animate-spin' : ''}`}
                                />
                                {retrying ? 'Retrying…' : 'Retry'}
                            </button>
                        )}
                        {!isPlaceholder && (
                            <button
                                onClick={onDelete}
                                disabled={deleting}
                                className={`${ghostSmButtonClass} text-[--text-error]`}
                            >
                                <LucideTrash2 size={16} className="mr-2" />
                                Delete
                            </button>
                        )}
                    </div>
                </div>

                {isCompleted && <EpisodeAudio episodeId={episode.id} />}

                {isFailed && episode.error_message && (
                    <div className="rounded-md border border-[--border-subtle] bg-[--bg-raised] p-3">
                        <p className="text-xs font-medium text-[--text-error]">
                            Error Details
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-xs text-[--text-secondary]">
                            {episode.error_message}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

const EpisodesTab = ({
    episodes,
    loading,
    fetching,
    error,
    onGenerate,
    onRefresh,
    onDelete,
    onRetry,
    deletingId,
    retryingId,
    onView,
}: {
    episodes: PodcastEpisode[];
    loading: boolean;
    fetching: boolean;
    error: string | null;
    onGenerate: () => void;
    onRefresh: () => void;
    onDelete: (e: PodcastEpisode) => void;
    onRetry: (e: PodcastEpisode) => void;
    deletingId: string | null;
    retryingId: string | null;
    onView: (e: PodcastEpisode) => void;
}) => {
    const counts = useMemo(() => {
        const c = { total: episodes.length, running: 0, completed: 0, failed: 0, pending: 0 };
        for (const e of episodes) {
            const meta = STATUS_META[(e.job_status || 'unknown') as EpisodeStatus];
            c[meta.group]++;
        }
        return c;
    }, [episodes]);

    const groups = useMemo(() => {
        const g: Record<StatusGroup, PodcastEpisode[]> = {
            running: [],
            pending: [],
            completed: [],
            failed: [],
        };
        for (const e of episodes) {
            const meta = STATUS_META[(e.job_status || 'unknown') as EpisodeStatus];
            g[meta.group].push(e);
        }
        return g;
    }, [episodes]);

    // Reference STATUS_ORDER: running, pending, completed, failed.
    const groupOrder: { key: StatusGroup; title: string; description: string }[] = [
        {
            key: 'running',
            title: 'Currently Processing',
            description: 'Episodes that are actively generating assets.',
        },
        {
            key: 'pending',
            title: 'Queued / Pending',
            description: 'Submitted episodes waiting to start processing.',
        },
        {
            key: 'completed',
            title: 'Completed Episodes',
            description: 'Ready to review, download, or publish.',
        },
        {
            key: 'failed',
            title: 'Failed Episodes',
            description: 'Episodes that encountered issues during generation.',
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                    <h2 className="text-[16px] font-semibold">Episodes overview</h2>
                    <p className="text-sm text-[--text-muted]">
                        Monitor podcast generation jobs and review the final artifacts.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onGenerate} className={primaryButtonClass}>
                        Generate Podcast
                    </button>
                    <button
                        onClick={onRefresh}
                        disabled={fetching}
                        className={outlineSmButtonClass}
                    >
                        {fetching ? (
                            <LucideLoader2 size={16} className="mr-2 animate-spin" />
                        ) : (
                            <LucideRefreshCcw size={16} className="mr-2" />
                        )}
                        Refresh
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                <SummaryBadge label="Total" value={counts.total} />
                <SummaryBadge label="Processing" value={counts.running} />
                <SummaryBadge label="Completed" value={counts.completed} />
                <SummaryBadge label="Failed" value={counts.failed} />
                <SummaryBadge label="Pending" value={counts.pending} />
            </div>

            {error && (
                <div className="flex items-start gap-2 rounded-lg border border-[--border-subtle] bg-[--bg-raised] p-4 text-sm text-[--text-error]">
                    <LucideAlertCircle size={16} className="mt-0.5 flex-none" />
                    <div>
                        <div className="font-medium">Failed to load episodes</div>
                        <div className="mt-1">
                            We could not fetch the latest podcast episodes. Try again shortly.
                        </div>
                    </div>
                </div>
            )}

            {loading && episodes.length === 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-dashed border-[--border-subtle] p-6 text-sm text-[--text-muted]">
                    <LucideLoader2 size={16} className="animate-spin" />
                    Loading episodes…
                </div>
            )}

            {!loading && !error && episodes.length === 0 && (
                <div className="rounded-lg border border-dashed border-[--border-subtle] bg-[--bg-hover] p-10 text-center">
                    <p className="text-sm text-[--text-muted]">
                        No podcast episodes yet. Generate your first one from the notebook or
                        source chat interfaces.
                    </p>
                </div>
            )}

            {groupOrder.map(({ key, title, description }) => {
                const list = groups[key];
                if (!list || list.length === 0) return null;
                return (
                    <section key={key} className="space-y-4">
                        <div>
                            <h3 className="text-lg font-semibold leading-tight">{title}</h3>
                            <p className="text-sm text-[--text-muted]">
                                {description}
                            </p>
                        </div>
                        <div className="h-px bg-[--border-subtle]" />
                        <div className="space-y-4">
                            {list.map((e) => (
                                <EpisodeCard
                                    key={e.id}
                                    episode={e}
                                    onDelete={() => onDelete(e)}
                                    onRetry={() => onRetry(e)}
                                    onView={() => onView(e)}
                                    deleting={deletingId === e.id}
                                    retrying={retryingId === e.id}
                                />
                            ))}
                        </div>
                    </section>
                );
            })}
        </div>
    );
};

// Collapsible "How profiles power podcast generation" explainer, mirroring
// the reference TemplatesTab accordion.
const TemplatesExplainer = () => {
    const [open, setOpen] = useState<boolean>(false);
    return (
        <div className="overflow-hidden rounded-xl border border-[--border-subtle] bg-[--bg-hover]/80 px-4">
            <button
                onClick={() => setOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 py-4 text-left text-sm font-semibold"
            >
                <span className="flex items-center gap-2">
                    <LucideLightbulb
                        size={16}
                        className="text-[--accent]"
                    />
                    How profiles power podcast generation
                </span>
                <LucideChevronDown
                    size={16}
                    className={`text-[--text-muted] transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </button>
            {open && (
                <div className="space-y-4 pb-4 text-sm text-[--text-muted]">
                    <p>
                        Profiles split the podcast workflow into two reusable building blocks.
                        Mix and match them whenever you generate a new episode.
                    </p>

                    <div className="space-y-2">
                        <h4 className="font-medium text-[--text-primary]">
                            Episode profiles set the format
                        </h4>
                        <ul className="list-disc space-y-1 pl-5">
                            <li>Outline the number of segments and how the story flows</li>
                            <li>
                                Pick the language models used for briefing, outlining, and
                                script writing
                            </li>
                            <li>
                                Store default briefings so every episode starts with a
                                consistent tone
                            </li>
                        </ul>
                    </div>

                    <div className="space-y-2">
                        <h4 className="font-medium text-[--text-primary]">
                            Speaker profiles bring voices to life
                        </h4>
                        <ul className="list-disc space-y-1 pl-5">
                            <li>Choose the text-to-speech provider and model</li>
                            <li>
                                Capture personality, backstory, and pronunciation notes per
                                speaker
                            </li>
                            <li>
                                Reuse the same host or guest voices across different episode
                                formats
                            </li>
                        </ul>
                    </div>

                    <div className="space-y-2">
                        <h4 className="font-medium text-[--text-primary]">
                            Recommended workflow
                        </h4>
                        <ol className="list-decimal space-y-1 pl-5">
                            <li>Create speaker profiles for each voice you need</li>
                            <li>Build episode profiles that reference those speakers by name</li>
                            <li>
                                Generate podcasts by selecting the episode profile that fits
                                the story
                            </li>
                        </ol>
                        <p className="text-xs text-[--text-muted]">
                            Episode profiles reference speaker profiles by name, so starting
                            with speakers avoids missing voice assignments later.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

const SpeakerProfilesPanel = ({
    speakerProfiles,
    usage,
    models,
    busyProfileId,
    onCreate,
    onEdit,
    onDuplicate,
    onDelete,
}: {
    speakerProfiles: SpeakerProfile[];
    usage: Record<string, number>;
    models: NotebookModel[];
    busyProfileId: string | null;
    onCreate: () => void;
    onEdit: (p: SpeakerProfile) => void;
    onDuplicate: (p: SpeakerProfile) => void;
    onDelete: (p: SpeakerProfile) => void;
}) => {
    const modelName = useCallback(
        (id?: string | null) => {
            if (!id) return null;
            const m = models.find((mm) => mm.id === id);
            return m ? `${m.provider} / ${m.name}` : id;
        },
        [models],
    );

    const sorted = useMemo(
        () => [...speakerProfiles].sort((a, b) => a.name.localeCompare(b.name, 'en')),
        [speakerProfiles],
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold">Speaker profiles</h2>
                    <p className="text-sm text-[--text-muted]">
                        Configure voices and personalities for generated episodes.
                    </p>
                </div>
                <button onClick={onCreate} className={primaryButtonClass}>
                    Create speaker
                </button>
            </div>

            {sorted.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[--border-subtle] bg-[--bg-hover] p-8 text-center text-sm text-[--text-muted]">
                    No speaker profiles yet. Create one to make episode profiles available.
                </div>
            ) : (
                <div className="space-y-4">
                    {sorted.map((profile) => {
                        const usageCount = usage[profile.name] ?? 0;
                        const deleteDisabled = usageCount > 0;
                        const voiceBadge =
                            modelName(profile.voice_model) ??
                            (profile.tts_provider
                                ? `${profile.tts_provider} / ${profile.tts_model}`
                                : 'Not configured');
                        return (
                            <div key={profile.id} className={cardClass}>
                                <div className="flex flex-col gap-2 px-6">
                                    <div className="flex items-center justify-between gap-2">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-lg font-semibold leading-none">
                                                    {profile.name}
                                                </h3>
                                                {speakerProfileNeedsSetup(profile) && setupBadge}
                                            </div>
                                            <p className="mt-1.5 text-sm text-[--text-muted]">
                                                {profile.description ||
                                                    'No description provided.'}
                                            </p>
                                        </div>
                                        <span className={outlineBadgeClass}>{voiceBadge}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <span
                                            className={
                                                usageCount > 0
                                                    ? secondaryBadgeClass
                                                    : outlineBadgeClass
                                            }
                                        >
                                            {usageCount > 0
                                                ? usageCount === 1
                                                    ? 'Used by 1 episode'
                                                    : `Used by ${usageCount} episodes`
                                                : 'Unused'}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-4 px-6 text-sm">
                                    <div className="space-y-3">
                                        {profile.speakers.map((speaker, i) => (
                                            <div
                                                key={`${speaker.name}-${i}`}
                                                className="rounded-md border border-[--border-subtle] bg-[--bg-active] p-3"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <LucideVolume2 size={16} />
                                                        <span className="font-medium">
                                                            {speaker.name}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-[--text-muted]">
                                                            Voice ID: {speaker.voice_id}
                                                        </span>
                                                        {speaker.voice_model && (
                                                            <span
                                                                className={secondaryBadgeClass}
                                                            >
                                                                {modelName(
                                                                    speaker.voice_model,
                                                                ) ?? speaker.voice_model}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <p className="mt-2 whitespace-pre-wrap text-xs text-[--text-muted]">
                                                    <span className="font-semibold">
                                                        Backstory:
                                                    </span>{' '}
                                                    {speaker.backstory}
                                                </p>
                                                <p className="mt-2 whitespace-pre-wrap text-xs text-[--text-muted]">
                                                    <span className="font-semibold">
                                                        Personality:
                                                    </span>{' '}
                                                    {speaker.personality}
                                                </p>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                        <button
                                            onClick={() => onEdit(profile)}
                                            className={ghostSmButtonClass}
                                        >
                                            <LucideEdit3 size={16} className="mr-2" />
                                            Edit
                                        </button>
                                        <DropdownButton
                                            title="Speaker profile actions"
                                            trigger={
                                                busyProfileId === profile.id ? (
                                                    <LucideLoader2
                                                        size={16}
                                                        className="animate-spin"
                                                    />
                                                ) : (
                                                    <LucideMoreVertical size={16} />
                                                )
                                            }
                                            triggerClassName="!h-8 !w-8 justify-center !px-0"
                                            items={[
                                                {
                                                    label: 'Duplicate',
                                                    icon: <LucideCopy size={16} />,
                                                    onClick: () => onDuplicate(profile),
                                                    disabled: busyProfileId === profile.id,
                                                },
                                                {
                                                    label: 'Delete',
                                                    icon: <LucideTrash2 size={16} />,
                                                    onClick: () => onDelete(profile),
                                                    danger: true,
                                                    disabled: deleteDisabled,
                                                    separatorAbove: true,
                                                },
                                            ]}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const EpisodeProfilesPanel = ({
    episodeProfiles,
    speakerProfiles,
    models,
    busyProfileId,
    onCreate,
    onEdit,
    onDuplicate,
    onDelete,
}: {
    episodeProfiles: EpisodeProfile[];
    speakerProfiles: SpeakerProfile[];
    models: NotebookModel[];
    busyProfileId: string | null;
    onCreate: () => void;
    onEdit: (p: EpisodeProfile) => void;
    onDuplicate: (p: EpisodeProfile) => void;
    onDelete: (p: EpisodeProfile) => void;
}) => {
    const modelName = useCallback(
        (
            ref?: string | null,
            legacyProvider?: string | null,
            legacyModel?: string | null,
        ): string => {
            if (ref) {
                const m = models.find((mm) => mm.id === ref);
                return m ? `${m.provider} / ${m.name}` : ref;
            }
            if (legacyProvider && legacyModel) return `${legacyProvider} / ${legacyModel}`;
            return 'Not configured';
        },
        [models],
    );

    const speakerVoiceBadge = useCallback(
        (speakerName: string): string | null => {
            const summary = speakerProfiles.find((p) => p.name === speakerName);
            if (!summary) return null;
            if (summary.voice_model) {
                const m = models.find((mm) => mm.id === summary.voice_model);
                return m ? `${m.provider} / ${m.name}` : summary.voice_model;
            }
            if (summary.tts_provider) {
                return `${summary.tts_provider} / ${summary.tts_model}`;
            }
            return null;
        },
        [speakerProfiles, models],
    );

    const sorted = useMemo(
        () => [...episodeProfiles].sort((a, b) => a.name.localeCompare(b.name, 'en')),
        [episodeProfiles],
    );

    const disableCreate = speakerProfiles.length === 0;
    const labelClass =
        'text-xs font-semibold uppercase tracking-wide text-[--text-muted]';

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold">Episode profiles</h2>
                    <p className="text-sm text-[--text-muted]">
                        Define reusable generation settings for your shows.
                    </p>
                </div>
                <button
                    onClick={onCreate}
                    disabled={disableCreate}
                    className={primaryButtonClass}
                >
                    Create profile
                </button>
            </div>

            {disableCreate && (
                <p className="rounded-lg border border-dashed border-[--border-subtle] bg-[--bg-raised] p-4 text-sm text-[--text-secondary]">
                    Create a speaker profile before adding an episode profile.
                </p>
            )}

            {sorted.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[--border-subtle] bg-[--bg-hover] p-10 text-center text-sm text-[--text-muted]">
                    No episode profiles yet. Create one to kickstart podcast generation.
                </div>
            ) : (
                <div className="space-y-4">
                    {sorted.map((profile) => (
                        <div key={profile.id} className={cardClass}>
                            <div className="flex flex-col gap-2 px-6 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-semibold leading-none">
                                            {profile.name}
                                        </h3>
                                        {episodeProfileNeedsSetup(profile) && setupBadge}
                                    </div>
                                    <p className="mt-1.5 text-sm text-[--text-muted]">
                                        {profile.description || 'No description provided.'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => onEdit(profile)}
                                        className={ghostSmButtonClass}
                                    >
                                        <LucideEdit3 size={16} className="mr-2" />
                                        Edit
                                    </button>
                                    <DropdownButton
                                        title="Episode profile actions"
                                        trigger={
                                            busyProfileId === profile.id ? (
                                                <LucideLoader2
                                                    size={16}
                                                    className="animate-spin"
                                                />
                                            ) : (
                                                <LucideMoreVertical size={16} />
                                            )
                                        }
                                        triggerClassName="!h-8 !w-8 justify-center !px-0"
                                        items={[
                                            {
                                                label: 'Duplicate',
                                                icon: <LucideCopy size={16} />,
                                                onClick: () => onDuplicate(profile),
                                                disabled: busyProfileId === profile.id,
                                            },
                                            {
                                                label: 'Delete',
                                                icon: <LucideTrash2 size={16} />,
                                                onClick: () => onDelete(profile),
                                                danger: true,
                                                separatorAbove: true,
                                            },
                                        ]}
                                    />
                                </div>
                            </div>

                            <div className="space-y-4 px-6 text-sm">
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div>
                                        <p className={labelClass}>Outline model</p>
                                        <p>
                                            {modelName(
                                                profile.outline_llm,
                                                profile.outline_provider,
                                                profile.outline_model,
                                            )}
                                        </p>
                                    </div>
                                    <div>
                                        <p className={labelClass}>Transcript model</p>
                                        <p>
                                            {modelName(
                                                profile.transcript_llm,
                                                profile.transcript_provider,
                                                profile.transcript_model,
                                            )}
                                        </p>
                                    </div>
                                    <div>
                                        <p className={labelClass}>Segments</p>
                                        <p>{profile.num_segments}</p>
                                    </div>
                                    {profile.language && (
                                        <div>
                                            <p className={labelClass}>Language</p>
                                            <p>{profile.language}</p>
                                        </div>
                                    )}
                                    <div>
                                        <p className={labelClass}>Speaker profile</p>
                                        <div className="flex items-center gap-2">
                                            <LucideUsers size={16} />
                                            <span>{profile.speaker_config}</span>
                                            {speakerVoiceBadge(profile.speaker_config) && (
                                                <span className={outlineBadgeClass}>
                                                    {speakerVoiceBadge(profile.speaker_config)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {profile.default_briefing && (
                                    <div>
                                        <p className={labelClass}>Default briefing</p>
                                        <p className="mt-1 whitespace-pre-wrap text-[--text-muted]">
                                            {profile.default_briefing}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const TemplatesTab = ({
    episodeProfiles,
    speakerProfiles,
    models,
    loading,
    error,
    onReload,
}: {
    episodeProfiles: EpisodeProfile[];
    speakerProfiles: SpeakerProfile[];
    models: NotebookModel[];
    loading: boolean;
    error: string | null;
    onReload: () => Promise<void>;
}) => {
    const [showCreateEpisode, setShowCreateEpisode] = useState<boolean>(false);
    const [showCreateSpeaker, setShowCreateSpeaker] = useState<boolean>(false);
    const [editEpisode, setEditEpisode] = useState<EpisodeProfile | null>(null);
    const [editSpeaker, setEditSpeaker] = useState<SpeakerProfile | null>(null);
    const [pendingProfileDelete, setPendingProfileDelete] = useState<{
        kind: 'episode' | 'speaker';
        id: string;
        name: string;
    } | null>(null);
    const [busyProfileId, setBusyProfileId] = useState<string | null>(null);
    const [seeding, setSeeding] = useState<boolean>(false);
    // Errors from per-profile actions (delete/duplicate) — shown as a dismissible
    // banner instead of replacing the whole tab the way a load error does.
    const [actionError, setActionError] = useState<string | null>(null);

    const speakerUsage = useMemo(() => {
        const map: Record<string, number> = {};
        for (const sp of speakerProfiles) map[sp.name] = 0;
        for (const ep of episodeProfiles) {
            if (ep.speaker_config in map) map[ep.speaker_config] += 1;
        }
        return map;
    }, [episodeProfiles, speakerProfiles]);

    // Upstream open-notebook ships three sample speaker/episode profile pairs
    // via a database migration; per-user databases created through amplify miss
    // them. Offer to create whichever ones aren't present yet.
    const missingDefaults = useMemo(() => {
        const spNames = new Set(speakerProfiles.map((p) => p.name));
        const epNames = new Set(episodeProfiles.map((p) => p.name));
        return {
            speakers: DEFAULT_SPEAKER_PROFILES.filter((p) => !spNames.has(p.name)),
            episodes: DEFAULT_EPISODE_PROFILES.filter((p) => !epNames.has(p.name)),
        };
    }, [speakerProfiles, episodeProfiles]);
    const hasMissingDefaults =
        missingDefaults.speakers.length > 0 || missingDefaults.episodes.length > 0;

    const handleAddDefaults = async () => {
        if (seeding) return;
        setSeeding(true);
        setActionError(null);
        // The upstream seeds reference openai models; substitute this
        // deployment's registered models so the profiles can actually generate.
        const langModel = models.find((m) => m.type === 'language')?.id ?? null;
        const ttsModelRecord = models.find((m) => m.type === 'text_to_speech') ?? null;
        const ttsModel = ttsModelRecord?.id ?? null;
        // The starter profiles' speakers[].voice_id values are OpenAI voice
        // names (nova/alloy/echo/...) — meaningless to any other TTS
        // provider. Substitute a real default for this deployment's actual
        // provider (mirrors the backend's own per-provider test-voice
        // defaults) so generation doesn't fail opaquely on a provider
        // mismatch the UI never surfaced.
        const substituteVoice = resolveDefaultVoiceId(ttsModelRecord?.provider);
        const noStaticVoiceForProvider = !!ttsModelRecord && !substituteVoice;

        const failures: string[] = [];
        for (const sp of missingDefaults.speakers) {
            const created = await createSpeakerProfile({
                name: sp.name,
                description: sp.description,
                voice_model: ttsModel,
                speakers: sp.speakers.map((speaker) => ({
                    ...speaker,
                    voice_id: substituteVoice ?? speaker.voice_id,
                })),
            });
            if (!created) failures.push(sp.name);
        }
        for (const ep of missingDefaults.episodes) {
            const created = await createEpisodeProfile({
                name: ep.name,
                description: ep.description,
                speaker_config: ep.speaker_config,
                outline_llm: langModel,
                transcript_llm: langModel,
                default_briefing: ep.default_briefing,
                num_segments: ep.num_segments,
            });
            if (!created) failures.push(ep.name);
        }
        setSeeding(false);
        if (failures.length > 0) {
            setActionError(`Couldn't create: ${failures.join(', ')}.`);
        } else if (noStaticVoiceForProvider) {
            setActionError(
                `Starter speaker profiles were created, but ${ttsModelRecord?.provider} voices ` +
                    "must be looked up per-account — edit each speaker's Voice ID before " +
                    'generating an episode, or generation will fail.',
            );
        }
        await onReload();
    };

    const handleDuplicateProfile = async (kind: 'episode' | 'speaker', id: string) => {
        setBusyProfileId(id);
        setActionError(null);
        const created =
            kind === 'episode'
                ? await duplicateEpisodeProfile(id)
                : await duplicateSpeakerProfile(id);
        setBusyProfileId(null);
        if (!created) {
            setActionError(`Couldn't duplicate the ${kind} profile.`);
            return;
        }
        await onReload();
    };

    const confirmProfileDelete = async () => {
        if (!pendingProfileDelete) return;
        const { kind, id, name } = pendingProfileDelete;
        setBusyProfileId(id);
        setActionError(null);
        const ok =
            kind === 'episode'
                ? await deleteEpisodeProfile(id)
                : await deleteSpeakerProfile(id);
        setBusyProfileId(null);
        setPendingProfileDelete(null);
        if (!ok) {
            setActionError(
                kind === 'speaker'
                    ? `Couldn't delete "${name}". Speaker profiles still used by an episode profile can't be deleted.`
                    : `Couldn't delete "${name}".`,
            );
            return;
        }
        await onReload();
    };

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                    <h2 className="text-[16px] font-semibold">Profiles workspace</h2>
                    <p className="text-sm text-[--text-muted]">
                        Build reusable episode and speaker configurations for fast podcast
                        production.
                    </p>
                </div>
                {!loading && !error && hasMissingDefaults && (
                    <button
                        onClick={handleAddDefaults}
                        disabled={seeding}
                        title="Create the starter profiles that ship with Open Notebook"
                        className={`${outlineSmButtonClass} flex-none`}
                    >
                        {seeding ? (
                            <LucideLoader2 size={16} className="mr-2 animate-spin" />
                        ) : (
                            <LucidePlus size={16} className="mr-2" />
                        )}
                        Add default profiles
                    </button>
                )}
            </div>

            <TemplatesExplainer />

            {error && (
                <div className="flex items-start gap-2 rounded-lg border border-[--border-subtle] bg-[--bg-raised] p-4 text-sm text-[--text-error]">
                    <LucideAlertCircle size={16} className="mt-0.5 flex-none" />
                    <div>
                        <div className="font-medium">Failed to load profiles data</div>
                        <div className="mt-1">
                            Ensure the API is running and try again. Some sections may be
                            incomplete.
                        </div>
                    </div>
                </div>
            )}

            {actionError && (
                <div className="flex items-start gap-2 rounded-lg border border-[--border-subtle] bg-[--bg-raised] p-3 text-sm text-[--text-error]">
                    <LucideAlertCircle size={16} className="mt-0.5 flex-none" />
                    <span className="flex-1">{actionError}</span>
                    <button
                        onClick={() => setActionError(null)}
                        title="Dismiss"
                        className="rounded p-0.5 hover:bg-[--bg-hover]"
                    >
                        <LucideX size={14} />
                    </button>
                </div>
            )}

            {loading ? (
                <div className="flex items-center gap-3 rounded-lg border border-dashed border-[--border-subtle] p-6 text-sm text-[--text-muted]">
                    <LucideLoader2 size={16} className="animate-spin" />
                    Loading profiles…
                </div>
            ) : (
                <div className="grid gap-6 lg:grid-cols-2">
                    <SpeakerProfilesPanel
                        speakerProfiles={speakerProfiles}
                        usage={speakerUsage}
                        models={models}
                        busyProfileId={busyProfileId}
                        onCreate={() => setShowCreateSpeaker(true)}
                        onEdit={setEditSpeaker}
                        onDuplicate={(p) => handleDuplicateProfile('speaker', p.id)}
                        onDelete={(p) =>
                            setPendingProfileDelete({
                                kind: 'speaker',
                                id: p.id,
                                name: p.name,
                            })
                        }
                    />
                    <EpisodeProfilesPanel
                        episodeProfiles={episodeProfiles}
                        speakerProfiles={speakerProfiles}
                        models={models}
                        busyProfileId={busyProfileId}
                        onCreate={() => setShowCreateEpisode(true)}
                        onEdit={setEditEpisode}
                        onDuplicate={(p) => handleDuplicateProfile('episode', p.id)}
                        onDelete={(p) =>
                            setPendingProfileDelete({
                                kind: 'episode',
                                id: p.id,
                                name: p.name,
                            })
                        }
                    />
                </div>
            )}

            {(showCreateEpisode || editEpisode) && (
                <CreateEpisodeProfileDialog
                    speakerProfiles={speakerProfiles}
                    initial={editEpisode ?? undefined}
                    onClose={() => {
                        setShowCreateEpisode(false);
                        setEditEpisode(null);
                    }}
                    onCreated={() => onReload()}
                />
            )}

            {(showCreateSpeaker || editSpeaker) && (
                <CreateSpeakerProfileDialog
                    initial={editSpeaker ?? undefined}
                    onClose={() => {
                        setShowCreateSpeaker(false);
                        setEditSpeaker(null);
                    }}
                    onCreated={() => onReload()}
                />
            )}

            <ConfirmDialog
                isOpen={!!pendingProfileDelete}
                title={
                    pendingProfileDelete?.kind === 'speaker'
                        ? 'Delete speaker profile?'
                        : 'Delete profile?'
                }
                message={
                    !pendingProfileDelete ? (
                        ''
                    ) : pendingProfileDelete.kind === 'speaker' ? (
                        <span>
                            Deleting &quot;<b>{pendingProfileDelete.name}</b>&quot; cannot
                            be undone.
                        </span>
                    ) : (
                        <span>
                            This will remove &quot;<b>{pendingProfileDelete.name}</b>&quot;.
                            Existing episodes keep their data, but new ones will no longer
                            use this configuration.
                        </span>
                    )
                }
                confirmLabel={busyProfileId ? 'Deleting…' : 'Delete'}
                cancelLabel="Cancel"
                variant="danger"
                onConfirm={confirmProfileDelete}
                onCancel={() => setPendingProfileDelete(null)}
            />
        </div>
    );
};

export const PodcastsPage = ({ isAdmin = false }: { isAdmin?: boolean }) => {
    const [tab, setTab] = useState<Tab>('episodes');
    const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [fetching, setFetching] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [showGenerate, setShowGenerate] = useState<boolean>(false);
    const [pendingDelete, setPendingDelete] = useState<PodcastEpisode | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [retryingId, setRetryingId] = useState<string | null>(null);
    const [viewing, setViewing] = useState<PodcastEpisode | null>(null);
    // Timestamp until which we should keep polling regardless of episode state.
    // Armed on Generate/Retry to cover the brief window where the new Running
    // episode hasn't been written to SurrealDB yet.
    const [pollGraceUntil, setPollGraceUntil] = useState<number>(0);
    // Optimistic cards rendered the moment a generation job is submitted, so
    // the user doesn't stare at an empty list while waiting for SurrealDB to
    // catch up and the next poll to fire. Matched out by `name` once the real
    // episode appears, and cleared wholesale when the grace window expires.
    const [pendingPlaceholders, setPendingPlaceholders] = useState<PodcastEpisode[]>([]);

    // Profiles are loaded at page level: the setup-required alert needs them
    // regardless of the active tab (mirrors the reference page).
    const [episodeProfiles, setEpisodeProfiles] = useState<EpisodeProfile[]>([]);
    const [speakerProfiles, setSpeakerProfiles] = useState<SpeakerProfile[]>([]);
    const [models, setModels] = useState<NotebookModel[]>([]);
    const [profilesLoading, setProfilesLoading] = useState<boolean>(true);
    const [profilesError, setProfilesError] = useState<string | null>(null);

    const loadProfiles = useCallback(async () => {
        setProfilesError(null);
        try {
            const [ep, sp, mdl] = await Promise.all([
                listEpisodeProfiles(),
                listSpeakerProfiles(),
                listModels(),
            ]);
            setEpisodeProfiles(ep);
            setSpeakerProfiles(sp);
            setModels(mdl);
        } catch (e: any) {
            setProfilesError(e?.message || 'Failed to load profiles');
        } finally {
            setProfilesLoading(false);
        }
    }, []);

    useEffect(() => {
        loadProfiles();
    }, [loadProfiles]);

    const hasUnconfiguredProfiles = useMemo(
        () =>
            episodeProfiles.some(episodeProfileNeedsSetup) ||
            speakerProfiles.some(speakerProfileNeedsSetup),
        [episodeProfiles, speakerProfiles],
    );

    const fetchEpisodes = useCallback(
        async ({ silent = false }: { silent?: boolean } = {}) => {
            if (!silent) setLoading(true);
            setFetching(true);
            setError(null);
            try {
                const data = await listEpisodes();
                setEpisodes(data);
            } catch (e: any) {
                setError(e?.message || 'Failed to load episodes');
            } finally {
                if (!silent) setLoading(false);
                setFetching(false);
            }
        },
        [],
    );

    useEffect(() => {
        fetchEpisodes();
    }, [fetchEpisodes]);

    // Drop placeholders whose real counterpart has shown up on the server.
    useEffect(() => {
        if (pendingPlaceholders.length === 0) return;
        const liveNames = new Set(episodes.map((e) => e.name));
        if (pendingPlaceholders.some((p) => liveNames.has(p.name))) {
            setPendingPlaceholders((prev) =>
                prev.filter((p) => !liveNames.has(p.name)),
            );
        }
    }, [episodes, pendingPlaceholders]);

    const visibleEpisodes = useMemo(
        () => [...pendingPlaceholders, ...episodes],
        [pendingPlaceholders, episodes],
    );

    const hasActive = useMemo(
        () =>
            visibleEpisodes.some((e) => {
                const meta = STATUS_META[(e.job_status || 'unknown') as EpisodeStatus];
                return meta.group === 'running' || meta.group === 'pending';
            }),
        [visibleEpisodes],
    );

    // Poll only when there's actually work to watch: either a Running/Pending
    // episode is already in state, or we recently armed a grace window via
    // Generate/Retry (covers the post-submit race before SurrealDB has the row).
    useEffect(() => {
        if (tab !== 'episodes') return;
        const inGrace = Date.now() < pollGraceUntil;
        if (!hasActive && !inGrace) return;
        const id = window.setInterval(() => {
            fetchEpisodes({ silent: true });
        }, 4000);
        return () => window.clearInterval(id);
    }, [tab, hasActive, pollGraceUntil, fetchEpisodes]);

    // Tear down the grace window once it expires so the effect above can
    // re-evaluate and stop polling if there's still nothing active. When the
    // grace window ends we also drop any leftover placeholders — if the real
    // episode hasn't shown up by then, the submission likely failed silently
    // and the stale card would mislead the user.
    useEffect(() => {
        if (pollGraceUntil === 0) {
            if (pendingPlaceholders.length > 0) setPendingPlaceholders([]);
            return;
        }
        const ms = pollGraceUntil - Date.now();
        if (ms <= 0) {
            setPollGraceUntil(0);
            return;
        }
        const t = window.setTimeout(() => setPollGraceUntil(0), ms);
        return () => window.clearTimeout(t);
    }, [pollGraceUntil, pendingPlaceholders.length]);

    const armPolling = useCallback(() => {
        setPollGraceUntil(Date.now() + 30_000);
    }, []);

    const handleGenerated = useCallback(
        (resp: PodcastGenerationResponse) => {
            const placeholder: PodcastEpisode = {
                id: `temp-${resp.job_id}`,
                name: resp.episode_name,
                episode_profile: { name: resp.episode_profile },
                speaker_profile: {},
                briefing: '',
                job_status: 'submitted',
                created: new Date().toISOString(),
            };
            setPendingPlaceholders((prev) => [...prev, placeholder]);
            armPolling();
            fetchEpisodes({ silent: true });
        },
        [armPolling, fetchEpisodes],
    );

    const handleDelete = async () => {
        if (!pendingDelete) return;
        setDeletingId(pendingDelete.id);
        const ok = await deleteEpisodeApi(pendingDelete.id);
        setDeletingId(null);
        setPendingDelete(null);
        if (ok) {
            setEpisodes((prev) => prev.filter((e) => e.id !== pendingDelete.id));
        } else {
            setError(`Couldn't delete "${pendingDelete.name}".`);
        }
    };

    const handleRetry = async (e: PodcastEpisode) => {
        setRetryingId(e.id);
        // Optimistically move the card out of "Failed" so the user gets
        // immediate feedback that retry was accepted; polling will overwrite
        // this with the authoritative server state within a few seconds.
        setEpisodes((prev) =>
            prev.map((ep) =>
                ep.id === e.id
                    ? { ...ep, job_status: 'submitted', error_message: null }
                    : ep,
            ),
        );
        await retryEpisodeApi(e.id);
        setRetryingId(null);
        armPolling();
        await fetchEpisodes({ silent: true });
    };

    const pageTabItems: SegmentItem[] = [
        { id: 'episodes', label: 'Episodes', icon: <LucideMic size={16} /> },
        { id: 'templates', label: 'Profiles', icon: <LucideLayoutTemplate size={16} /> },
    ];

    return (
        <div className="w-full space-y-6">
            <header className="space-y-1">
                <h1 className="text-[16px] font-semibold">Podcasts</h1>
                <p className="text-[--text-muted]">
                    {isAdmin
                        ? 'Keep track of generated episodes and manage reusable profiles.'
                        : 'Keep track of your generated episodes.'}
                </p>
            </header>

            {/* Only admins can edit profiles, so only they can act on this. */}
            {isAdmin && !profilesLoading && hasUnconfiguredProfiles && (
                <div className="flex items-start gap-3 rounded-lg border border-[--border-subtle] bg-[--bg-raised] p-4 text-[--text-secondary]">
                    <LucideAlertTriangle size={16} className="mt-0.5 flex-none" />
                    <div>
                        <div className="mb-1 font-medium">Setup required</div>
                        <div className="text-sm">
                            Some profiles don&apos;t have models configured yet. Edit them to
                            select models before generating podcasts.
                        </div>
                    </div>
                </div>
            )}

            {isAdmin && (
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[--text-muted]">
                        Choose a view
                    </p>
                    <div className="w-full max-w-md">
                        <SegmentedControl
                            items={pageTabItems}
                            value={tab}
                            onChange={(id) => setTab(id as Tab)}
                            aria-label="Podcasts view"
                        />
                    </div>
                </div>
            )}

            {tab === 'episodes' || !isAdmin ? (
                <EpisodesTab
                    episodes={visibleEpisodes}
                    loading={loading}
                    fetching={fetching}
                    error={error}
                    onGenerate={() => setShowGenerate(true)}
                    onRefresh={() => fetchEpisodes({ silent: true })}
                    onDelete={setPendingDelete}
                    onRetry={handleRetry}
                    deletingId={deletingId}
                    retryingId={retryingId}
                    onView={setViewing}
                />
            ) : (
                <TemplatesTab
                    episodeProfiles={episodeProfiles}
                    speakerProfiles={speakerProfiles}
                    models={models}
                    loading={profilesLoading}
                    error={profilesError}
                    onReload={loadProfiles}
                />
            )}

            {showGenerate && (
                <GeneratePodcastDialog
                    onClose={() => setShowGenerate(false)}
                    onSubmitted={handleGenerated}
                    isAdmin={isAdmin}
                />
            )}

            <ConfirmDialog
                isOpen={!!pendingDelete}
                title="Delete episode?"
                message={
                    pendingDelete ? (
                        <span>
                            This will remove &quot;<b>{pendingDelete.name}</b>&quot; and its
                            audio file permanently.
                        </span>
                    ) : (
                        ''
                    )
                }
                confirmLabel={deletingId ? 'Deleting…' : 'Delete'}
                cancelLabel="Cancel"
                variant="danger"
                onConfirm={handleDelete}
                onCancel={() => setPendingDelete(null)}
            />

            {viewing && (
                <EpisodeDetailsModal
                    episode={viewing}
                    models={models}
                    onClose={() => setViewing(null)}
                />
            )}
        </div>
    );
};

export default PodcastsPage;
