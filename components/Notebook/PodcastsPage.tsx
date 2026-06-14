import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
    IconAlertCircle,
    IconChevronDown,
    IconInfoCircle,
    IconLoader2,
    IconMicrophone,
    IconPlus,
    IconRefresh,
    IconTrash,
} from '@tabler/icons-react';
import { ConfirmModal } from '@/components/ReusableComponents/ConfirmModal';
import { Modal } from '@/components/ReusableComponents/Modal';
import {
    deleteEpisode as deleteEpisodeApi,
    EpisodeProfile,
    EpisodeStatus,
    fetchEpisodeAudioObjectUrl,
    listEpisodeProfiles,
    listEpisodes,
    listSpeakerProfiles,
    PodcastEpisode,
    PodcastGenerationResponse,
    retryEpisode as retryEpisodeApi,
    SpeakerProfile,
} from '@/services/notebookService';
import { GeneratePodcastDialog } from './GeneratePodcastDialog';

type Tab = 'episodes' | 'templates';
type StatusGroup = 'running' | 'completed' | 'failed' | 'pending';

const STATUS_META: Record<
    EpisodeStatus,
    { label: string; className: string; group: StatusGroup }
> = {
    running: {
        label: 'Generating',
        className:
            'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
        group: 'running',
    },
    processing: {
        label: 'Generating',
        className:
            'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
        group: 'running',
    },
    pending: {
        label: 'Pending',
        className: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
        group: 'pending',
    },
    submitted: {
        label: 'Pending',
        className: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
        group: 'pending',
    },
    completed: {
        label: 'Completed',
        className:
            'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
        group: 'completed',
    },
    failed: {
        label: 'Failed',
        className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        group: 'failed',
    },
    error: {
        label: 'Failed',
        className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        group: 'failed',
    },
    unknown: {
        label: 'Unknown',
        className: 'bg-gray-100 text-gray-700 dark:bg-neutral-700 dark:text-gray-300',
        group: 'pending',
    },
};

const FAILED_STATUSES: EpisodeStatus[] = ['failed', 'error'];

// Memoized so the <audio> DOM node is created once per episode and never
// re-mounted on parent re-renders (polling, modal open, etc.). Re-mounting an
// <audio> element pauses playback, which the user hit when clicking Details
// while a podcast was playing.
//
// <audio> can't attach Authorization headers, so we fetch the binary with the
// JWT once, hand the <audio> tag an object URL, and revoke it on unmount.
// Range/seek is lost for long episodes — acceptable tradeoff to keep the API
// auth model uniform with the rest of the notebook calls.
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
        let objectUrl: string | null = null;
        setSrc(null);
        setErrorStatus(undefined);
        (async () => {
            const result = await fetchEpisodeAudioObjectUrl(episodeId);
            if (cancelled) {
                if (result.objectUrl) URL.revokeObjectURL(result.objectUrl);
                return;
            }
            if (result.objectUrl) {
                objectUrl = result.objectUrl;
                setSrc(result.objectUrl);
            } else {
                setErrorStatus(result.status);
            }
        })();
        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [episodeId, attempt]);

    if (errorStatus !== undefined) {
        return (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-[12px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
                <IconAlertCircle size={14} className="mt-0.5 flex-none" />
                <span className="flex-1">{audioErrorMessage(errorStatus)}</span>
                <button
                    onClick={() => setAttempt((n) => n + 1)}
                    className="flex items-center gap-1 rounded border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-800/50 dark:bg-transparent dark:text-amber-200 dark:hover:bg-amber-900/30"
                >
                    <IconRefresh size={12} />
                    Retry
                </button>
            </div>
        );
    }
    if (!src) {
        return (
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-neutral-400">
                <IconLoader2 size={14} className="animate-spin" />
                Loading audio...
            </div>
        );
    }
    return (
        <audio controls preload="auto" src={src} className="mt-3 w-full" />
    );
});
EpisodeAudio.displayName = 'EpisodeAudio';

const formatRelative = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso.replace(' ', 'T'));
    if (isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days}d ago`;
    return d.toLocaleDateString();
};

const StatusBadge = ({ status }: { status?: EpisodeStatus | null }) => {
    if (status === 'completed') return null;
    const meta = STATUS_META[status ?? 'unknown'] || STATUS_META.unknown;
    return (
        <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.className}`}
        >
            {meta.label}
        </span>
    );
};

const TabsHeader = ({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) => (
    <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Choose a view
        </p>
        <div className="inline-flex w-full max-w-md rounded-lg border border-gray-200 bg-white p-1 shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36]">
            <button
                onClick={() => onTab('episodes')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    tab === 'episodes'
                        ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-700'
                }`}
            >
                <IconMicrophone size={16} />
                Episodes
            </button>
            <button
                onClick={() => onTab('templates')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    tab === 'templates'
                        ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-700'
                }`}
            >
                <IconInfoCircle size={16} />
                Templates
            </button>
        </div>
    </div>
);

const SummaryBadge = ({ label, value }: { label: string; value: number }) => (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-[12px] dark:border-neutral-700 dark:bg-[#2b2c36]">
        <span className="text-gray-500 dark:text-gray-400">{label}</span>
        <span className="font-semibold text-gray-800 dark:text-gray-100">{value}</span>
    </span>
);

const EpisodeDetailsModal = ({
    episode,
    onClose,
}: {
    episode: PodcastEpisode;
    onClose: () => void;
}) => {
    const [activeTab, setActiveTab] = useState<'summary' | 'outline' | 'transcript'>(
        'summary',
    );

    const outlineSegments = (episode.outline as any)?.segments || [];
    const transcriptEntries = (episode.transcript as any)?.transcript || [];

    const tabBtn = (id: typeof activeTab, label: string) => (
        <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === id
                    ? 'border-purple-500 text-purple-500 dark:text-purple-400'
                    : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
        >
            {label}
        </button>
    );

    return (
        <Modal
            title={episode.name}
            onCancel={onClose}
            showSubmit={false}
            cancelLabel="Close"
            width={() => 720}
            height={() => 600}
            content={
                <div className="flex h-full flex-col gap-3 p-2 text-neutral-800 dark:text-neutral-100">
                    <div className="flex border-b border-neutral-200 dark:border-neutral-700">
                        {tabBtn('summary', 'Summary')}
                        {tabBtn('outline', 'Outline')}
                        {tabBtn('transcript', 'Transcript')}
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 text-sm">
                        {activeTab === 'summary' && (
                            <div className="space-y-4">
                                <section className="space-y-1">
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                        Episode profile
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-[13px]">
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">
                                                Outline
                                            </div>
                                            <div>
                                                {(episode.episode_profile as EpisodeProfile)
                                                    ?.outline_provider || '—'}{' '}
                                                /{' '}
                                                {(episode.episode_profile as EpisodeProfile)
                                                    ?.outline_model || '—'}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">
                                                Transcript
                                            </div>
                                            <div>
                                                {(episode.episode_profile as EpisodeProfile)
                                                    ?.transcript_provider || '—'}{' '}
                                                /{' '}
                                                {(episode.episode_profile as EpisodeProfile)
                                                    ?.transcript_model || '—'}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">
                                                Segments
                                            </div>
                                            <div>
                                                {(episode.episode_profile as EpisodeProfile)
                                                    ?.num_segments ?? '—'}
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <section className="space-y-1">
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                        Speaker profile
                                    </div>
                                    <div className="text-[13px] text-gray-500 dark:text-gray-400">
                                        {(episode.speaker_profile as SpeakerProfile)
                                            ?.tts_provider || '—'}{' '}
                                        /{' '}
                                        {(episode.speaker_profile as SpeakerProfile)
                                            ?.tts_model || '—'}
                                    </div>
                                    {(
                                        (episode.speaker_profile as SpeakerProfile)
                                            ?.speakers || []
                                    ).map((sp, i) => (
                                        <div
                                            key={`${sp.name}-${i}`}
                                            className="rounded border border-gray-200 bg-gray-50 p-2 text-[12px] dark:border-neutral-700 dark:bg-[#343541]"
                                        >
                                            <div className="font-semibold">{sp.name}</div>
                                            <div className="text-gray-500 dark:text-gray-400">
                                                Voice: {sp.voice_id}
                                            </div>
                                            {sp.backstory && (
                                                <div className="mt-1 whitespace-pre-wrap text-gray-600 dark:text-gray-300">
                                                    <span className="font-semibold">Backstory:</span>{' '}
                                                    {sp.backstory}
                                                </div>
                                            )}
                                            {sp.personality && (
                                                <div className="mt-1 whitespace-pre-wrap text-gray-600 dark:text-gray-300">
                                                    <span className="font-semibold">
                                                        Personality:
                                                    </span>{' '}
                                                    {sp.personality}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </section>

                                {episode.briefing && (
                                    <section className="space-y-1">
                                        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                            Briefing
                                        </div>
                                        <div className="whitespace-pre-wrap rounded border border-gray-200 bg-gray-50 p-2 text-[12px] dark:border-neutral-700 dark:bg-[#343541]">
                                            {episode.briefing}
                                        </div>
                                    </section>
                                )}
                            </div>
                        )}

                        {activeTab === 'outline' &&
                            (outlineSegments.length === 0 ? (
                                <div className="py-6 text-center text-[13px] text-gray-500 dark:text-gray-400">
                                    No outline available.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {outlineSegments.map((seg: any, i: number) => (
                                        <div
                                            key={i}
                                            className="rounded border border-gray-200 bg-gray-50 p-2 dark:border-neutral-700 dark:bg-[#343541]"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="text-[13px] font-semibold">
                                                    {seg.name || `Segment ${i + 1}`}
                                                </div>
                                                {seg.size && (
                                                    <span className="rounded bg-purple-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                                                        {seg.size}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mt-1 whitespace-pre-wrap text-[12px] text-gray-600 dark:text-gray-300">
                                                {seg.description || ''}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}

                        {activeTab === 'transcript' &&
                            (transcriptEntries.length === 0 ? (
                                <div className="py-6 text-center text-[13px] text-gray-500 dark:text-gray-400">
                                    No transcript available.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {transcriptEntries.map((e: any, i: number) => (
                                        <div
                                            key={i}
                                            className="rounded border border-gray-200 bg-gray-50 p-2 dark:border-neutral-700 dark:bg-[#343541]"
                                        >
                                            <div className="text-[12px] font-semibold">
                                                {e.speaker || 'Speaker'}
                                            </div>
                                            <div className="mt-0.5 whitespace-pre-wrap text-[12px] text-gray-600 dark:text-gray-300">
                                                {e.dialogue || ''}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                    </div>
                </div>
            }
        />
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
        (episode.episode_profile as EpisodeProfile)?.name || '(unknown profile)';

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold">{episode.name}</h3>
                        <StatusBadge status={status} />
                    </div>
                    <div className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">
                        {profileName}
                        {episode.created && ` • ${formatRelative(episode.created)}`}
                    </div>
                </div>
                <div className="flex flex-none flex-wrap items-center gap-2">
                    {!isPlaceholder && (
                        <button
                            onClick={onView}
                            className="flex h-7 items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 text-[12px] font-medium text-gray-700 hover:bg-gray-50 dark:border-neutral-600 dark:bg-[#40414f] dark:text-gray-200 dark:hover:bg-neutral-700"
                        >
                            <IconInfoCircle size={14} />
                            Details
                        </button>
                    )}
                    {isFailed && (
                        <button
                            onClick={onRetry}
                            disabled={retrying}
                            className="flex h-7 items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 text-[12px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-neutral-600 dark:bg-[#40414f] dark:text-gray-200 dark:hover:bg-neutral-700"
                        >
                            {retrying ? (
                                <IconLoader2 size={14} className="animate-spin" />
                            ) : (
                                <IconRefresh size={14} />
                            )}
                            Retry
                        </button>
                    )}
                    {!isPlaceholder && (
                        <button
                            onClick={onDelete}
                            disabled={deleting}
                            className="flex h-7 items-center gap-1 rounded-md px-2.5 text-[12px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                            <IconTrash size={14} />
                            Delete
                        </button>
                    )}
                </div>
            </div>

            {isCompleted && <EpisodeAudio episodeId={episode.id} />}

            {isFailed && episode.error_message && (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-[12px] text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                    <div className="font-medium">Error</div>
                    <div className="mt-0.5 whitespace-pre-wrap">{episode.error_message}</div>
                </div>
            )}
        </div>
    );
};

const EpisodesTab = ({
    episodes,
    loading,
    error,
    onGenerate,
    onDelete,
    onRetry,
    deletingId,
    retryingId,
    onView,
}: {
    episodes: PodcastEpisode[];
    loading: boolean;
    error: string | null;
    onGenerate: () => void;
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

    const groupOrder: { key: StatusGroup; title: string; description: string }[] = [
        { key: 'running', title: 'Generating', description: 'Currently being generated.' },
        { key: 'pending', title: 'Pending', description: 'Submitted, waiting to start.' },
        { key: 'completed', title: 'Completed', description: 'Ready to listen.' },
        { key: 'failed', title: 'Failed', description: 'Hit an error and stopped.' },
    ];

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-base font-semibold">Episodes</h2>
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                        Generate podcast episodes from your notebook content.
                    </p>
                </div>
                <button
                    onClick={onGenerate}
                    className="flex h-8 items-center gap-1.5 rounded-lg bg-purple-500 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-purple-600"
                >
                    <IconPlus size={16} />
                    Generate
                </button>
            </div>

            <div className="flex flex-wrap gap-2">
                <SummaryBadge label="Total" value={counts.total} />
                <SummaryBadge label="Generating" value={counts.running} />
                <SummaryBadge label="Completed" value={counts.completed} />
                <SummaryBadge label="Failed" value={counts.failed} />
            </div>

            {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                    <IconAlertCircle size={16} className="mt-0.5 flex-none" />
                    <span>{error}</span>
                </div>
            )}

            {loading && episodes.length === 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 p-6 text-sm text-gray-500 dark:border-neutral-700 dark:text-gray-400">
                    <IconLoader2 size={14} className="animate-spin" />
                    Loading episodes…
                </div>
            )}

            {!loading && !error && episodes.length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center dark:border-neutral-700 dark:bg-neutral-800/40">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-sm">
                        <IconMicrophone size={22} />
                    </div>
                    <h3 className="text-base font-semibold">No episodes yet</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Click &quot;Generate&quot; to create your first episode.
                    </p>
                </div>
            )}

            {groupOrder.map(({ key, title, description }) => {
                const list = groups[key];
                if (!list || list.length === 0) return null;
                return (
                    <section key={key} className="space-y-2">
                        <div>
                            <h3 className="text-sm font-semibold">{title}</h3>
                            <p className="text-[12px] text-gray-500 dark:text-gray-400">
                                {description}
                            </p>
                        </div>
                        <div className="space-y-2">
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

const TemplatesTab = () => {
    const [episodeProfiles, setEpisodeProfiles] = useState<EpisodeProfile[]>([]);
    const [speakerProfiles, setSpeakerProfiles] = useState<SpeakerProfile[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedSpeaker, setExpandedSpeaker] = useState<Set<string>>(new Set());

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [ep, sp] = await Promise.all([
                listEpisodeProfiles(),
                listSpeakerProfiles(),
            ]);
            setEpisodeProfiles(ep);
            setSpeakerProfiles(sp);
        } catch (e: any) {
            setError(e?.message || 'Failed to load templates');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const speakerUsage = useMemo(() => {
        const map: Record<string, number> = {};
        for (const sp of speakerProfiles) map[sp.name] = 0;
        for (const ep of episodeProfiles) {
            if (ep.speaker_config in map) map[ep.speaker_config] += 1;
        }
        return map;
    }, [episodeProfiles, speakerProfiles]);

    const toggleSpeaker = (id: string) => {
        setExpandedSpeaker((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-base font-semibold">Templates</h2>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                    Episode and speaker profiles available on this deployment. Configured
                    server-side.
                </p>
            </div>

            {loading && (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 p-6 text-sm text-gray-500 dark:border-neutral-700 dark:text-gray-400">
                    <IconLoader2 size={14} className="animate-spin" />
                    Loading templates…
                </div>
            )}

            {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                    <IconAlertCircle size={16} className="mt-0.5 flex-none" />
                    <span>{error}</span>
                </div>
            )}

            {!loading && !error && (
                <>
                    <section className="space-y-2">
                        <h3 className="text-sm font-semibold">Episode profiles</h3>
                        {episodeProfiles.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 dark:border-neutral-700 dark:bg-neutral-800/40 dark:text-gray-400">
                                No episode profiles configured.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                                {episodeProfiles.map((p) => (
                                    <div
                                        key={p.id}
                                        className="rounded-xl border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-[#2b2c36]"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate font-semibold">{p.name}</div>
                                                {p.description && (
                                                    <div className="mt-0.5 line-clamp-2 text-[12px] text-gray-500 dark:text-gray-400">
                                                        {p.description}
                                                    </div>
                                                )}
                                            </div>
                                            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                                                {p.num_segments} segments
                                            </span>
                                        </div>
                                        <dl className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                                            <div>
                                                <dt className="text-gray-500 dark:text-gray-400">
                                                    Outline
                                                </dt>
                                                <dd>
                                                    {p.outline_provider} / {p.outline_model}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-gray-500 dark:text-gray-400">
                                                    Transcript
                                                </dt>
                                                <dd>
                                                    {p.transcript_provider} / {p.transcript_model}
                                                </dd>
                                            </div>
                                            <div className="col-span-2">
                                                <dt className="text-gray-500 dark:text-gray-400">
                                                    Speaker config
                                                </dt>
                                                <dd>{p.speaker_config}</dd>
                                            </div>
                                        </dl>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="space-y-2">
                        <h3 className="text-sm font-semibold">Speaker profiles</h3>
                        {speakerProfiles.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 dark:border-neutral-700 dark:bg-neutral-800/40 dark:text-gray-400">
                                No speaker profiles configured.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {speakerProfiles.map((sp) => {
                                    const expanded = expandedSpeaker.has(sp.id);
                                    return (
                                        <div
                                            key={sp.id}
                                            className="rounded-xl border border-gray-200 bg-white dark:border-neutral-700 dark:bg-[#2b2c36]"
                                        >
                                            <button
                                                onClick={() => toggleSpeaker(sp.id)}
                                                className="flex w-full items-center justify-between gap-3 p-3 text-left"
                                            >
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="truncate font-semibold">
                                                            {sp.name}
                                                        </span>
                                                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                                                            used by {speakerUsage[sp.name] ?? 0}
                                                        </span>
                                                    </div>
                                                    <div className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">
                                                        {sp.tts_provider} / {sp.tts_model} ·{' '}
                                                        {sp.speakers.length} voice
                                                        {sp.speakers.length === 1 ? '' : 's'}
                                                    </div>
                                                </div>
                                                <IconChevronDown
                                                    size={16}
                                                    className={`flex-none text-gray-400 transition-transform ${
                                                        expanded ? 'rotate-180' : ''
                                                    }`}
                                                />
                                            </button>
                                            {expanded && (
                                                <div className="space-y-2 border-t border-gray-200 p-3 dark:border-neutral-700">
                                                    {sp.speakers.map((s, i) => (
                                                        <div
                                                            key={`${s.name}-${i}`}
                                                            className="rounded border border-gray-200 bg-gray-50 p-2 text-[12px] dark:border-neutral-700 dark:bg-[#343541]"
                                                        >
                                                            <div className="font-semibold">{s.name}</div>
                                                            <div className="text-gray-500 dark:text-gray-400">
                                                                Voice: {s.voice_id}
                                                            </div>
                                                            {s.backstory && (
                                                                <div className="mt-1 whitespace-pre-wrap text-gray-600 dark:text-gray-300">
                                                                    <span className="font-semibold">
                                                                        Backstory:
                                                                    </span>{' '}
                                                                    {s.backstory}
                                                                </div>
                                                            )}
                                                            {s.personality && (
                                                                <div className="mt-1 whitespace-pre-wrap text-gray-600 dark:text-gray-300">
                                                                    <span className="font-semibold">
                                                                        Personality:
                                                                    </span>{' '}
                                                                    {s.personality}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
};

export const PodcastsPage = () => {
    const [tab, setTab] = useState<Tab>('episodes');
    const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
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

    const fetchEpisodes = useCallback(
        async ({ silent = false }: { silent?: boolean } = {}) => {
            if (!silent) setLoading(true);
            setError(null);
            try {
                const data = await listEpisodes();
                setEpisodes(data);
            } catch (e: any) {
                setError(e?.message || 'Failed to load episodes');
            } finally {
                if (!silent) setLoading(false);
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

    return (
        <div className="mx-auto w-full max-w-5xl space-y-4">
            <TabsHeader tab={tab} onTab={setTab} />

            {tab === 'episodes' ? (
                <EpisodesTab
                    episodes={visibleEpisodes}
                    loading={loading}
                    error={error}
                    onGenerate={() => setShowGenerate(true)}
                    onDelete={setPendingDelete}
                    onRetry={handleRetry}
                    deletingId={deletingId}
                    retryingId={retryingId}
                    onView={setViewing}
                />
            ) : (
                <TemplatesTab />
            )}

            {showGenerate && (
                <GeneratePodcastDialog
                    onClose={() => setShowGenerate(false)}
                    onSubmitted={handleGenerated}
                />
            )}

            {pendingDelete && (
                <ConfirmModal
                    title="Delete episode?"
                    message={
                        <span>
                            Delete <b>{pendingDelete.name}</b>? The audio file will also be
                            removed. This can&apos;t be undone.
                        </span>
                    }
                    confirmLabel={deletingId ? 'Deleting…' : 'Delete'}
                    denyLabel="Cancel"
                    onConfirm={handleDelete}
                    onDeny={() => setPendingDelete(null)}
                />
            )}

            {viewing && (
                <EpisodeDetailsModal
                    episode={viewing}
                    onClose={() => setViewing(null)}
                />
            )}
        </div>
    );
};

export default PodcastsPage;
