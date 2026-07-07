import { useEffect, useRef, useState } from 'react';
import {
    IconAlertCircle,
    IconChevronDown,
    IconChevronRight,
    IconCircleCheck,
    IconCircleX,
    IconClock,
    IconLoader2,
    IconRefresh,
    IconTool,
} from '@tabler/icons-react';
import {
    RebuildMode,
    RebuildStatusResponse,
    getRebuildStatus,
    rebuildEmbeddings,
} from '@/services/notebookService';

const MODE_HELP: Record<RebuildMode, string> = {
    existing:
        'Re-embed only items that already have embeddings (faster, for model switching).',
    all: 'Re-embed existing items and create embeddings for items without any (slower, comprehensive).',
};

const FAQ_ITEMS: { id: string; question: string; answer: string }[] = [
    {
        id: 'when',
        question: 'When should I rebuild embeddings?',
        answer: 'You should rebuild when switching embedding models, upgrading versions, fixing corruption, or after bulk imports.',
    },
    {
        id: 'time',
        question: 'How long does rebuilding take?',
        answer: 'Processing time depends on item count, model speed, and API rate limits.',
    },
    {
        id: 'safe',
        question: 'Is it safe to rebuild while using the app?',
        answer: "Yes, rebuilding is safe. It doesn't delete content, only replaces embeddings, and handles errors gracefully.",
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
    <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 accent-purple-500 dark:border-neutral-600"
        />
        {label}
    </label>
);

const StatusHeader = ({ status }: { status: RebuildStatusResponse }) => {
    if (status.status === 'queued') {
        return (
            <div className="flex items-center gap-2">
                <IconClock size={20} className="text-yellow-500" />
                <span className="font-medium">Queued</span>
            </div>
        );
    }
    if (status.status === 'running') {
        return (
            <div className="flex items-center gap-2">
                <IconLoader2 size={20} className="animate-spin text-blue-500" />
                <div className="flex flex-col">
                    <span className="font-medium">Rebuilding…</span>
                    <span className="text-[12px] text-gray-500 dark:text-gray-400">
                        You can leave this page — the rebuild runs in the background.
                    </span>
                </div>
            </div>
        );
    }
    if (status.status === 'completed') {
        return (
            <div className="flex items-center gap-2">
                <IconCircleCheck size={20} className="text-emerald-500" />
                <span className="font-medium">Rebuild complete</span>
            </div>
        );
    }
    return (
        <div className="flex items-center gap-2">
            <IconCircleX size={20} className="text-red-500" />
            <span className="font-medium">Rebuild failed</span>
        </div>
    );
};

export const AdvancedPage = () => {
    const [mode, setMode] = useState<RebuildMode>('existing');
    const [includeSources, setIncludeSources] = useState<boolean>(true);
    const [includeNotes, setIncludeNotes] = useState<boolean>(true);
    const [includeInsights, setIncludeInsights] = useState<boolean>(true);

    const [starting, setStarting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [commandId, setCommandId] = useState<string | null>(null);
    const [status, setStatus] = useState<RebuildStatusResponse | null>(null);
    const [openFaq, setOpenFaq] = useState<string | null>(null);

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopPolling = () => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    };

    useEffect(() => stopPolling, []);

    const startPolling = (cmdId: string) => {
        stopPolling();
        pollRef.current = setInterval(async () => {
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
            setError('Failed to start the rebuild. Verify an embedding model is configured.');
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
    };

    const progress = status?.progress;
    const stats = status?.stats;

    const totalItems = progress?.total_items ?? progress?.total ?? 0;
    const processedItems = progress?.processed_items ?? progress?.processed ?? 0;
    const rawPercent =
        progress?.percentage ?? (totalItems > 0 ? (processedItems / totalItems) * 100 : 0);
    const percent = Number.isFinite(rawPercent) ? Math.min(100, rawPercent) : 0;
    const failedItems = stats?.failed_items ?? stats?.failed ?? 0;

    const computedDuration =
        status?.started_at && status?.completed_at
            ? (new Date(status.completed_at).getTime() -
                  new Date(status.started_at).getTime()) /
              1000
            : undefined;
    const processingTime = stats?.processing_time ?? computedDuration;

    const statCells: { label: string; value: string }[] = stats
        ? [
              { label: 'Sources', value: String(stats.sources_processed ?? stats.sources ?? 0) },
              { label: 'Notes', value: String(stats.notes_processed ?? stats.notes ?? 0) },
              { label: 'Insights', value: String(stats.insights_processed ?? stats.insights ?? 0) },
              {
                  label: 'Time',
                  value: processingTime !== undefined ? `${processingTime.toFixed(1)}s` : '—',
              },
          ]
        : [];

    return (
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 text-neutral-800 dark:text-neutral-100">
            <div className="flex items-center gap-2">
                <IconTool size={20} className="text-purple-600 dark:text-purple-400" />
                <div>
                    <h2 className="text-base font-semibold">Rebuild embeddings</h2>
                    <p className="text-[12px] text-gray-500 dark:text-gray-400">
                        Regenerate the vector search index for your sources, notes, and insights.
                    </p>
                </div>
            </div>

            {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                    <IconAlertCircle size={16} className="mt-0.5 flex-none" />
                    <span>{error}</span>
                </div>
            )}

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36]">
                <div className="space-y-5 p-4">
                    {!rebuildActive && !status && (
                        <>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium">Rebuild mode</label>
                                <select
                                    value={mode}
                                    onChange={(e) => setMode(e.target.value as RebuildMode)}
                                    className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100"
                                >
                                    <option value="existing">Existing embeddings only</option>
                                    <option value="all">All items</option>
                                </select>
                                <p className="text-[12px] text-gray-500 dark:text-gray-400">
                                    {MODE_HELP[mode]}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <span className="block text-sm font-medium">Include in rebuild</span>
                                <div className="space-y-2">
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
                                    <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 p-2 text-[12px] text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                                        <IconAlertCircle size={14} className="mt-0.5 flex-none" />
                                        <span>Select at least one item type to rebuild.</span>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleStart}
                                disabled={!anySelected || starting}
                                className={`flex h-9 w-full items-center justify-center gap-1.5 rounded-md px-4 text-sm font-medium transition-colors ${
                                    !anySelected || starting
                                        ? 'cursor-not-allowed bg-gray-200 text-gray-500 dark:bg-neutral-700 dark:text-neutral-400'
                                        : 'bg-purple-500 text-white hover:bg-purple-600'
                                }`}
                            >
                                {starting ? (
                                    <>
                                        <IconLoader2 size={16} className="animate-spin" />
                                        Starting rebuild…
                                    </>
                                ) : (
                                    'Start rebuild'
                                )}
                            </button>
                        </>
                    )}

                    {commandId && !status && (
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <IconLoader2 size={16} className="animate-spin" />
                            Rebuild submitted — waiting for status…
                        </div>
                    )}

                    {status && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <StatusHeader status={status} />
                                {(status.status === 'completed' || status.status === 'failed') && (
                                    <button
                                        onClick={handleReset}
                                        className="flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-sm text-gray-700 shadow-sm hover:bg-gray-50 dark:border-neutral-700 dark:bg-[#2b2c36] dark:text-gray-200 dark:hover:bg-neutral-700"
                                    >
                                        <IconRefresh size={14} />
                                        Start new rebuild
                                    </button>
                                )}
                            </div>

                            {progress && (
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-sm">
                                        <span>Progress</span>
                                        <span className="font-medium">
                                            {processedItems}/{totalItems} items ({percent.toFixed(1)}%)
                                        </span>
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-neutral-700">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 transition-all duration-500"
                                            style={{ width: `${percent}%` }}
                                        />
                                    </div>
                                    {failedItems > 0 && (
                                        <p className="text-[12px] text-yellow-600 dark:text-yellow-400">
                                            {failedItems} item{failedItems === 1 ? '' : 's'} failed to process.
                                        </p>
                                    )}
                                </div>
                            )}

                            {stats && (
                                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                    {statCells.map((cell) => (
                                        <div key={cell.label}>
                                            <div className="text-[12px] text-gray-500 dark:text-gray-400">
                                                {cell.label}
                                            </div>
                                            <div className="text-xl font-bold">{cell.value}</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {status.error_message && (
                                <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 p-2 text-[12px] text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                                    <IconAlertCircle size={14} className="mt-0.5 flex-none" />
                                    <span>{status.error_message}</span>
                                </div>
                            )}

                            {status.started_at && (
                                <div className="text-[12px] text-gray-500 dark:text-gray-400">
                                    <div>Started: {new Date(status.started_at).toLocaleString()}</div>
                                    {status.completed_at && (
                                        <div>
                                            Finished: {new Date(status.completed_at).toLocaleString()}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36]">
                {FAQ_ITEMS.map((item, idx) => {
                    const open = openFaq === item.id;
                    return (
                        <div
                            key={item.id}
                            className={idx > 0 ? 'border-t border-gray-200 dark:border-neutral-700' : ''}
                        >
                            <button
                                onClick={() => setOpenFaq(open ? null : item.id)}
                                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium"
                            >
                                {item.question}
                                {open ? (
                                    <IconChevronDown size={16} className="flex-none text-gray-400" />
                                ) : (
                                    <IconChevronRight size={16} className="flex-none text-gray-400" />
                                )}
                            </button>
                            {open && (
                                <p className="px-4 pb-3 text-[13px] leading-5 text-gray-600 dark:text-gray-300">
                                    {item.answer}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AdvancedPage;
