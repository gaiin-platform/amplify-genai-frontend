import { useCallback, useEffect, useRef, useState } from 'react';
import {
    LucideAlertCircle,
    LucideCheckCircle2,
    LucideChevronDown,
    LucideClock,
    LucideLoader2,
    LucideXCircle,
} from './LucideIcons';
import {
    RebuildMode,
    RebuildStatusResponse,
    getRebuildStatus,
    rebuildEmbeddings,
} from '@/services/notebookService';
import { cardClass } from './notebookUI';

const selectClass =
    'w-full rounded-md border border-[--border-subtle] bg-[--bg-composer] px-3 py-2 text-sm shadow-sm outline-none focus:border-[--accent] focus:ring-1 focus:ring-[--accent] text-[--text-primary]';

const FAQ_ITEMS: { id: string; question: string; answer: string }[] = [
    {
        id: 'when',
        question: 'When should I rebuild embeddings?',
        answer: 'You should rebuild when switching models, upgrading versions, fixing corruption, or after bulk imports.',
    },
    {
        id: 'time',
        question: 'How long does rebuilding take?',
        answer: 'Processing time depends on item count, model speed, and API rate limits. Local models are usually very fast.',
    },
    {
        id: 'safe',
        question: 'Is it safe to rebuild while using the app?',
        answer: "Yes, rebuilding is safe! It doesn't delete content, only replaces embeddings, and handles errors gracefully.",
    },
];

const CheckboxRow = ({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}) => (
    <label className="flex cursor-pointer items-center gap-2 text-sm font-normal">
        <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 accent-[--accent]"
        />
        {label}
    </label>
);

// Reference status labels: running means the backend is fanning out per-item
// embed jobs, hence "Submitting jobs...".
const StatusHeader = ({ status }: { status: RebuildStatusResponse }) => {
    if (status.status === 'queued') {
        return (
            <div className="flex items-center gap-2">
                <LucideClock size={20} className="text-[--text-muted]" />
                <span className="font-medium">Queued</span>
            </div>
        );
    }
    if (status.status === 'running') {
        return (
            <div className="flex items-center gap-2">
                <LucideLoader2 size={20} className="animate-spin text-[--text-muted]" />
                <div className="flex flex-col">
                    <span className="font-medium">Submitting jobs...</span>
                    <span className="text-sm text-[--text-muted]">
                        You can leave this page as this will run in the background
                    </span>
                </div>
            </div>
        );
    }
    if (status.status === 'completed') {
        return (
            <div className="flex items-center gap-2">
                <LucideCheckCircle2 size={20} className="text-[--text-secondary]" />
                <span className="font-medium">Jobs Submitted!</span>
            </div>
        );
    }
    return (
        <div className="flex items-center gap-2">
            <LucideXCircle size={20} className="text-[--text-error]" />
            <span className="font-medium">Failed</span>
        </div>
    );
};

const RebuildEmbeddings = () => {
    const [mode, setMode] = useState<RebuildMode>('existing');
    const [includeSources, setIncludeSources] = useState<boolean>(true);
    const [includeNotes, setIncludeNotes] = useState<boolean>(true);
    const [includeInsights, setIncludeInsights] = useState<boolean>(true);

    const [starting, setStarting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [commandId, setCommandId] = useState<string | null>(null);
    const [status, setStatus] = useState<RebuildStatusResponse | null>(null);
    const [openFaq, setOpenFaq] = useState<string | null>(null);
    // There's no cancel-job endpoint — the backend command keeps running
    // either way — but without this, a stuck/slow job left the user staring
    // at "Submitting jobs..." indefinitely with literally no control on the
    // page (handleReset/"Start New Rebuild" only appears once status is
    // completed/failed, which a stuck job may never reach). This lets them
    // stop watching and leave the page in a normal state.
    const [gaveUpWaiting, setGaveUpWaiting] = useState<boolean>(false);

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollStartedAtRef = useRef<number>(0);
    // After this long with no completed/failed status, stop auto-polling and
    // show an explicit "still running, but we've stopped watching" message
    // instead of spinning forever with no explanation.
    const MAX_POLL_MS = 5 * 60 * 1000;

    const stopPolling = () => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    };

    useEffect(() => stopPolling, []);

    const startPolling = (cmdId: string) => {
        stopPolling();
        setGaveUpWaiting(false);
        pollStartedAtRef.current = Date.now();
        pollRef.current = setInterval(async () => {
            if (Date.now() - pollStartedAtRef.current > MAX_POLL_MS) {
                stopPolling();
                setGaveUpWaiting(true);
                return;
            }
            const data = await getRebuildStatus(cmdId);
            if (!data) return; // transient fetch failure; keep polling
            setStatus(data);
            if (data.status === 'completed' || data.status === 'failed') {
                stopPolling();
            }
        }, 5000);
    };

    const anySelected = includeSources || includeNotes || includeInsights;
    const rebuildActive =
        !!commandId && (!status || status.status === 'queued' || status.status === 'running');

    const handleStart = async () => {
        if (!anySelected || starting) return;
        setStarting(true);
        setError(null);
        const result = await rebuildEmbeddings({
            mode,
            include_sources: includeSources,
            include_notes: includeNotes,
            include_insights: includeInsights,
        });
        setStarting(false);
        if (!result) {
            setError('Failed to start rebuild. Verify an embedding model is configured.');
            return;
        }
        setCommandId(result.command_id);
        setStatus(null);
        startPolling(result.command_id);
    };

    const handleReset = () => {
        stopPolling();
        setCommandId(null);
        setStatus(null);
        setError(null);
        setGaveUpWaiting(false);
    };

    // Manual escape hatch, mirrors the automatic MAX_POLL_MS give-up below —
    // lets the user stop watching a rebuild whenever they want instead of
    // only after 5 minutes, without pretending the backend job itself stops.
    const handleStopWatching = () => {
        stopPolling();
        setGaveUpWaiting(true);
    };

    const progress = status?.progress;
    const stats = status?.stats;

    const totalItems = progress?.total_items ?? progress?.total ?? 0;
    const processedItems = progress?.processed_items ?? progress?.processed ?? 0;
    const rawPercent =
        progress?.percentage ?? (totalItems > 0 ? (processedItems / totalItems) * 100 : 0);
    // Clamp both ends: a transient negative percentage or processed_items
    // briefly exceeding total_items (backend counters racing) would otherwise
    // render a negative-width/broken progress bar.
    const percent = Number.isFinite(rawPercent) ? Math.min(100, Math.max(0, rawPercent)) : 0;
    const failedItems = stats?.failed_items ?? stats?.failed ?? 0;

    const computedDuration =
        status?.started_at && status?.completed_at
            ? (new Date(status.completed_at).getTime() -
                  new Date(status.started_at).getTime()) /
              1000
            : undefined;
    const processingTime = stats?.processing_time ?? computedDuration;

    return (
        <div className={cardClass}>
            <div className="flex flex-col gap-1.5 px-6">
                <h2 className="text-lg font-semibold leading-none">Rebuild Embeddings</h2>
                <p className="text-sm text-[--text-muted]">
                    Rebuild vector search index for all sources
                </p>
            </div>

            <div className="space-y-6 px-6">
                {/* Configuration Form */}
                {!rebuildActive && !status && (
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <label className="text-sm font-medium leading-none">
                                Rebuild Mode
                            </label>
                            <select
                                value={mode}
                                onChange={(e) => setMode(e.target.value as RebuildMode)}
                                className={selectClass}
                            >
                                <option value="existing">Existing</option>
                                <option value="all">All</option>
                            </select>
                            <p className="text-sm text-[--text-muted]">
                                {mode === 'existing'
                                    ? 'Re-embed only items that already have embeddings (faster, for model switching)'
                                    : 'Re-embed existing items + create embeddings for items without any (slower, comprehensive)'}
                            </p>
                        </div>

                        <div className="space-y-3">
                            <span className="text-sm font-medium leading-none">
                                Include in Rebuild
                            </span>
                            <div className="space-y-3">
                                <CheckboxRow
                                    label="Sources"
                                    checked={includeSources}
                                    onChange={setIncludeSources}
                                />
                                <CheckboxRow
                                    label="Notes"
                                    checked={includeNotes}
                                    onChange={setIncludeNotes}
                                />
                                <CheckboxRow
                                    label="Insights"
                                    checked={includeInsights}
                                    onChange={setIncludeInsights}
                                />
                            </div>
                            {!anySelected && (
                                <div className="flex items-start gap-2 rounded-lg border border-[--border-subtle] bg-[--bg-raised] p-3 text-sm text-[--text-error]">
                                    <LucideAlertCircle size={16} className="mt-0.5 flex-none" />
                                    <span>Please select at least one item type to rebuild</span>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleStart}
                            disabled={!anySelected || starting}
                            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-[--accent] px-4 text-sm font-medium text-[--accent-fg] shadow-sm transition-colors hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
                        >
                            {starting ? (
                                <>
                                    <LucideLoader2 size={16} className="animate-spin" />
                                    Starting Rebuild...
                                </>
                            ) : (
                                '🚀 Start Rebuild'
                            )}
                        </button>

                        {error && (
                            <div className="flex items-start gap-2 rounded-lg border border-[--border-subtle] bg-[--bg-raised] p-3 text-sm text-[--text-error]">
                                <LucideAlertCircle size={16} className="mt-0.5 flex-none" />
                                <span>{error}</span>
                            </div>
                        )}
                    </div>
                )}

                {commandId && !status && !gaveUpWaiting && (
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm text-[--text-muted]">
                            <LucideLoader2 size={16} className="animate-spin" />
                            Rebuild submitted — waiting for status…
                        </div>
                        <button
                            onClick={handleStopWatching}
                            className="inline-flex h-8 flex-none items-center justify-center rounded-md border border-[--border-subtle] bg-transparent px-3 text-sm font-medium shadow-sm transition-colors hover:bg-[--bg-hover]"
                        >
                            Stop Watching
                        </button>
                    </div>
                )}

                {gaveUpWaiting && (
                    <div className="flex items-start justify-between gap-3 rounded-lg border border-[--border-subtle] bg-[--bg-active] p-3 text-sm">
                        <div className="flex items-start gap-2">
                            <LucideClock size={16} className="mt-0.5 flex-none text-[--text-muted]" />
                            <span className="text-[--text-secondary]">
                                Still waiting on this rebuild — it&apos;s likely still running on
                                the server, but this page has stopped checking. You can safely
                                leave this page; the rebuild isn&apos;t affected either way.
                            </span>
                        </div>
                        <button
                            onClick={handleReset}
                            className="inline-flex h-8 flex-none items-center justify-center rounded-md border border-[--border-subtle] bg-transparent px-3 text-sm font-medium shadow-sm transition-colors hover:bg-[--bg-hover]"
                        >
                            Dismiss
                        </button>
                    </div>
                )}

                {/* Status Display */}
                {status && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <StatusHeader status={status} />
                            {(status.status === 'completed' || status.status === 'failed') && (
                                <button
                                    onClick={handleReset}
                                    className="inline-flex h-8 items-center justify-center rounded-md border border-[--border-subtle] bg-transparent px-3 text-sm font-medium shadow-sm transition-colors hover:bg-[--bg-hover]"
                                >
                                    Start New Rebuild
                                </button>
                            )}
                            {(status.status === 'queued' || status.status === 'running') && (
                                <button
                                    onClick={handleStopWatching}
                                    className="inline-flex h-8 items-center justify-center rounded-md border border-[--border-subtle] bg-transparent px-3 text-sm font-medium shadow-sm transition-colors hover:bg-[--bg-hover]"
                                >
                                    Stop Watching
                                </button>
                            )}
                        </div>

                        {progress && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Progress</span>
                                    <span className="font-medium">
                                        {processedItems}/{totalItems} jobs submitted (
                                        {percent.toFixed(1)}%)
                                    </span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-[--bg-active]">
                                    <div
                                        className="h-full rounded-full bg-[--accent] transition-all duration-500"
                                        style={{ width: `${percent}%` }}
                                    />
                                </div>
                                {failedItems > 0 && (
                                    <p className="text-sm text-[--text-error]">
                                        ⚠️ {failedItems} jobs failed to submit
                                    </p>
                                )}
                            </div>
                        )}

                        {stats && (
                            <div className="grid grid-cols-4 gap-4">
                                <div className="space-y-1">
                                    <p className="text-sm text-[--text-muted]">
                                        Sources
                                    </p>
                                    <p className="text-[20px] font-semibold">
                                        {stats.sources_processed ?? stats.sources ?? 0}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm text-[--text-muted]">
                                        Notes
                                    </p>
                                    <p className="text-[20px] font-semibold">
                                        {stats.notes_processed ?? stats.notes ?? 0}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm text-[--text-muted]">
                                        Insights
                                    </p>
                                    <p className="text-[20px] font-semibold">
                                        {stats.insights_processed ?? stats.insights ?? 0}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm text-[--text-muted]">
                                        Time
                                    </p>
                                    <p className="text-[20px] font-semibold">
                                        {processingTime !== undefined
                                            ? `${processingTime.toFixed(1)}s`
                                            : '—'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {status.error_message && (
                            <div className="flex items-start gap-2 rounded-lg border border-[--border-subtle] bg-[--bg-raised] p-3 text-sm text-[--text-error]">
                                <LucideAlertCircle size={16} className="mt-0.5 flex-none" />
                                <span>{status.error_message}</span>
                            </div>
                        )}

                        {status.started_at && (
                            <div className="space-y-1 text-sm text-[--text-muted]">
                                <p>Created {new Date(status.started_at).toLocaleString()}</p>
                                {status.completed_at && (
                                    <p>
                                        Updated: {new Date(status.completed_at).toLocaleString()}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Help Section */}
                <div>
                    {FAQ_ITEMS.map((item) => {
                        const open = openFaq === item.id;
                        return (
                            <div
                                key={item.id}
                                className="border-b border-[--border-subtle]"
                            >
                                <button
                                    onClick={() => setOpenFaq(open ? null : item.id)}
                                    className="flex w-full items-center justify-between gap-3 py-4 text-left text-sm font-medium hover:underline"
                                >
                                    {item.question}
                                    <LucideChevronDown
                                        size={16}
                                        className={`flex-none text-[--text-muted] transition-transform ${
                                            open ? 'rotate-180' : ''
                                        }`}
                                    />
                                </button>
                                {open && (
                                    <div className="space-y-2 pb-4 text-sm">
                                        <p>{item.answer}</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export const AdvancedPage = () => (
    <div className="mx-auto max-w-4xl space-y-6 text-[--text-primary]">
        <div>
            <h1 className="text-[16px] font-semibold">Advanced Tools</h1>
            <p className="mt-2 text-[--text-muted]">
                Advanced tools and utilities for power users
            </p>
        </div>

        <RebuildEmbeddings />
    </div>
);

export default AdvancedPage;
