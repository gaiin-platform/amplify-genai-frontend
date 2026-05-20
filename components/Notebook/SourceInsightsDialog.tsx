import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    IconAlertCircle,
    IconChevronDown,
    IconChevronRight,
    IconLoader2,
    IconNotebook,
    IconPlayerPlay,
    IconRefresh,
    IconTrash,
} from '@tabler/icons-react';
import { Modal } from '@/components/ReusableComponents/Modal';
import { ConfirmModal } from '@/components/ReusableComponents/ConfirmModal';
import {
    SourceInsight,
    SourceListItem,
    createSourceInsight,
    deleteInsight,
    listSourceInsights,
    saveInsightAsNote,
    waitForCommand,
} from '@/services/notebookContentService';
import {
    Transformation,
    listTransformations,
} from '@/services/notebookConfigService';

interface Props {
    notebookId: string;
    source: SourceListItem;
    onClose: () => void;
    // Bubble the new count up so the parent's source list reflects it without
    // a full refetch.
    onInsightsCountChange?: (sourceId: string, count: number) => void;
}

export const SourceInsightsDialog = ({
    notebookId,
    source,
    onClose,
    onInsightsCountChange,
}: Props) => {
    const [insights, setInsights] = useState<SourceInsight[]>([]);
    const [transformations, setTransformations] = useState<Transformation[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const [selectedTransformationId, setSelectedTransformationId] = useState<string>('');
    const [generating, setGenerating] = useState<boolean>(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [pendingJobLabel, setPendingJobLabel] = useState<string | null>(null);

    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [pendingDelete, setPendingDelete] = useState<SourceInsight | null>(null);
    const [deleting, setDeleting] = useState<boolean>(false);
    const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
    const [savedNoteId, setSavedNoteId] = useState<string | null>(null);

    const refreshInsights = useCallback(
        async (showSpinner: boolean) => {
            if (showSpinner) setRefreshing(true);
            const data = await listSourceInsights(source.id);
            setInsights(data);
            onInsightsCountChange?.(source.id, data.length);
            if (showSpinner) setRefreshing(false);
            return data;
        },
        [source.id, onInsightsCountChange],
    );

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            const [insightsData, transformationsData] = await Promise.all([
                listSourceInsights(source.id),
                listTransformations(),
            ]);
            if (cancelled) return;
            setInsights(insightsData);
            setTransformations(transformationsData);
            onInsightsCountChange?.(source.id, insightsData.length);
            const defaultTransform =
                transformationsData.find((t) => t.apply_default) ?? transformationsData[0];
            if (defaultTransform) setSelectedTransformationId(defaultTransform.id);
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [source.id, onInsightsCountChange]);

    const selectedTransformation = useMemo(
        () => transformations.find((t) => t.id === selectedTransformationId),
        [transformations, selectedTransformationId],
    );

    const handleGenerate = async () => {
        if (!selectedTransformationId || generating) return;
        setGenerating(true);
        setGenerationError(null);
        setPendingJobLabel(selectedTransformation?.title || selectedTransformation?.name || 'transformation');

        const startCountAtSubmit = insights.length;
        const response = await createSourceInsight(source.id, selectedTransformationId);
        if (!response) {
            setGenerating(false);
            setPendingJobLabel(null);
            setGenerationError('Failed to start insight generation.');
            return;
        }

        // The backend submits an async job; poll for completion. If no
        // command_id comes back (older deployments), fall back to a single
        // refetch.
        if (response.command_id) {
            const final = await waitForCommand(response.command_id, { intervalMs: 2500, timeoutMs: 180_000 });
            if (final && final.status !== 'completed') {
                setGenerationError(final.error_message || `Job ${final.status}.`);
            }
        }

        const refreshed = await refreshInsights(false);
        setGenerating(false);
        setPendingJobLabel(null);

        // If the count didn't grow, the run probably failed silently — flag it.
        if (refreshed.length <= startCountAtSubmit && !response.command_id) {
            setGenerationError(
                'Insight generation completed but no new insight appeared. Check backend logs.',
            );
        }
    };

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        setDeleting(true);
        const ok = await deleteInsight(pendingDelete.id);
        setDeleting(false);
        if (!ok) {
            setError(`Couldn't delete insight "${pendingDelete.insight_type}".`);
            setPendingDelete(null);
            return;
        }
        const next = insights.filter((i) => i.id !== pendingDelete.id);
        setInsights(next);
        onInsightsCountChange?.(source.id, next.length);
        setPendingDelete(null);
    };

    const handleSaveAsNote = async (insight: SourceInsight) => {
        setSavingNoteId(insight.id);
        const note = await saveInsightAsNote(insight.id, notebookId);
        setSavingNoteId(null);
        if (note) {
            setSavedNoteId(insight.id);
            window.setTimeout(() => {
                setSavedNoteId((curr) => (curr === insight.id ? null : curr));
            }, 2500);
        } else {
            setError('Failed to save insight as note.');
        }
    };

    const toggleExpanded = (id: string) =>
        setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

    const sourceTitle = source.title && source.title !== 'Processing...'
        ? source.title
        : '(Untitled source)';

    const content = (
        <div className="flex h-full flex-col gap-4 p-2 text-neutral-800 dark:text-neutral-100">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-neutral-700 dark:bg-[#343541]">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Run a transformation
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={selectedTransformationId}
                        onChange={(e) => setSelectedTransformationId(e.target.value)}
                        disabled={loading || transformations.length === 0 || generating}
                        className="flex-1 min-w-[200px] rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100 disabled:opacity-60"
                    >
                        {transformations.length === 0 ? (
                            <option value="">No transformations available</option>
                        ) : (
                            transformations.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.title || t.name}
                                </option>
                            ))
                        )}
                    </select>
                    <button
                        onClick={handleGenerate}
                        disabled={!selectedTransformationId || generating || loading}
                        className="flex items-center gap-1.5 rounded-md bg-purple-500 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {generating ? (
                            <IconLoader2 size={14} className="animate-spin" />
                        ) : (
                            <IconPlayerPlay size={14} />
                        )}
                        {generating ? 'Generating…' : 'Generate'}
                    </button>
                </div>
                {selectedTransformation?.description && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {selectedTransformation.description}
                    </p>
                )}
                {pendingJobLabel && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-300">
                        <IconLoader2 size={12} className="animate-spin" />
                        Running <span className="font-medium">{pendingJobLabel}</span> against this source…
                    </div>
                )}
                {generationError && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
                        <IconAlertCircle size={14} className="mt-0.5 shrink-0" />
                        <span>{generationError}</span>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Existing insights {insights.length > 0 && <span>({insights.length})</span>}
                </p>
                <button
                    onClick={() => refreshInsights(true)}
                    title="Refresh"
                    disabled={refreshing || loading}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-neutral-700 dark:hover:text-white disabled:opacity-50"
                >
                    <IconRefresh size={12} className={refreshing ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            <div className="-mr-2 flex-1 overflow-y-auto pr-2">
                {loading && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">Loading insights…</div>
                )}

                {!loading && error && (
                    <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
                )}

                {!loading && !error && insights.length === 0 && (
                    <div className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-neutral-600 dark:text-gray-400">
                        No insights yet. Pick a transformation above and click{' '}
                        <span className="font-medium">Generate</span> to create one.
                    </div>
                )}

                {!loading && !error && insights.length > 0 && (
                    <ul className="divide-y divide-gray-100 dark:divide-neutral-700/60">
                        {insights.map((insight) => {
                            const isOpen = !!expanded[insight.id];
                            const preview = insight.content.length > 220
                                ? insight.content.slice(0, 220).trimEnd() + '…'
                                : insight.content;
                            return (
                                <li key={insight.id} className="py-3">
                                    <div className="flex items-start gap-2">
                                        <button
                                            onClick={() => toggleExpanded(insight.id)}
                                            className="mt-0.5 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-neutral-700 dark:hover:text-white"
                                            title={isOpen ? 'Collapse' : 'Expand'}
                                        >
                                            {isOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                                                    {insight.insight_type}
                                                </span>
                                                {insight.created && (
                                                    <span className="text-[11px] text-gray-400 dark:text-gray-500">
                                                        {new Date(insight.created.replace(' ', 'T')).toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                            {isOpen ? (
                                                <pre className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">
                                                    {insight.content}
                                                </pre>
                                            ) : (
                                                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                                                    {preview}
                                                </p>
                                            )}
                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                <button
                                                    onClick={() => handleSaveAsNote(insight)}
                                                    disabled={savingNoteId === insight.id}
                                                    className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-50 dark:border-neutral-600 dark:text-gray-300 dark:hover:bg-neutral-700 disabled:opacity-50"
                                                >
                                                    {savingNoteId === insight.id ? (
                                                        <IconLoader2 size={12} className="animate-spin" />
                                                    ) : (
                                                        <IconNotebook size={12} />
                                                    )}
                                                    {savedNoteId === insight.id ? 'Saved!' : 'Save as note'}
                                                </button>
                                                <button
                                                    onClick={() => setPendingDelete(insight)}
                                                    className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-600 hover:bg-red-50 hover:text-red-600 dark:border-neutral-600 dark:text-gray-300 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                                                >
                                                    <IconTrash size={12} />
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );

    return (
        <>
            <Modal
                title={`Insights — ${sourceTitle}`}
                onCancel={onClose}
                showSubmit={false}
                cancelLabel="Close"
                width={() => 640}
                height={() => 620}
                content={content}
            />

            {pendingDelete && (
                <ConfirmModal
                    title="Delete insight?"
                    message={
                        <span>
                            Delete this <b>{pendingDelete.insight_type}</b> insight? This can&apos;t be undone.
                        </span>
                    }
                    confirmLabel={deleting ? 'Deleting…' : 'Delete'}
                    denyLabel="Cancel"
                    onConfirm={confirmDelete}
                    onDeny={() => setPendingDelete(null)}
                />
            )}
        </>
    );
};

export default SourceInsightsDialog;
