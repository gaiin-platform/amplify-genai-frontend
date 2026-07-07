import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    IconAlertCircle,
    IconAlignLeft,
    IconChevronDown,
    IconChevronRight,
    IconCheck,
    IconCopy,
    IconExternalLink,
    IconLink,
    IconLoader2,
    IconNotebook,
    IconPlayerPlay,
    IconRefresh,
    IconTrash,
    IconUpload,
} from '@tabler/icons-react';
import remarkGfm from 'remark-gfm';
import {
    NotebookSummary,
    SourceInsight,
    SourceListItem,
    Transformation,
    createSourceInsight,
    deleteInsight,
    listSourceInsights,
    listTransformations,
    saveInsightAsNote,
    waitForCommand,
} from '@/services/notebookService';
import { ConfirmModal } from '@/components/ReusableComponents/ConfirmModal';
import { MemoizedReactMarkdown } from '@/components/Markdown/MemoizedReactMarkdown';
import { SourceChatPanel } from './SourceChatPanel';

type Tab = 'content' | 'insights' | 'details';

interface Props {
    // Full source record from getSource (includes full_text and notebooks);
    // the list endpoint's items are missing both.
    source: SourceListItem;
    // Used to show which notebooks this source belongs to by name.
    notebooks: NotebookSummary[];
}

const sourceKind = (s: SourceListItem): 'link' | 'file' | 'text' => {
    if (s.asset?.url) return 'link';
    if (s.asset?.file_path) return 'file';
    return 'text';
};

const KindIcon = ({ kind }: { kind: 'link' | 'file' | 'text' }) => {
    if (kind === 'link') return <IconLink size={14} />;
    if (kind === 'file') return <IconUpload size={14} />;
    return <IconAlignLeft size={14} />;
};

const safeExternalHref = (url: string | null | undefined): string | null => {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
    } catch {
        return null;
    }
};

const getYouTubeVideoId = (url: string): string | null => {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
};

const formatTimestamp = (iso?: string): string => {
    if (!iso) return '—';
    const d = new Date(iso.replace(' ', 'T'));
    return isNaN(d.getTime()) ? '—' : d.toLocaleString();
};

// Full-page source viewer: content/insights/details on the left, a chat pane
// scoped to this source on the right. Mirrors open-notebook's sources/[id]
// page, and works whether or not the source is linked to a notebook.
export const SourceDetailView = ({ source, notebooks }: Props) => {
    const [tab, setTab] = useState<Tab>('content');
    // Seeded from source.insights_count, but the single-source GET this page
    // is populated from doesn't actually return that field (only the list
    // endpoint's response model does) — so it's always 0 here. Fetch the
    // real count immediately, independent of the Insights tab ever being
    // opened, so the "(N)" badge is right from the first render.
    const [insightsCount, setInsightsCount] = useState<number>(source.insights_count || 0);

    useEffect(() => {
        let cancelled = false;
        listSourceInsights(source.id).then((data) => {
            if (!cancelled) setInsightsCount(data.length);
        });
        return () => {
            cancelled = true;
        };
    }, [source.id]);

    const kind = sourceKind(source);
    const externalHref = useMemo(() => safeExternalHref(source.asset?.url), [source.asset?.url]);
    const youTubeVideoId = useMemo(
        () => (externalHref ? getYouTubeVideoId(externalHref) : null),
        [externalHref],
    );

    const linkedNotebooks = useMemo(() => {
        const ids = source.notebooks || [];
        return ids.map((id) => ({
            id,
            name: notebooks.find((nb) => nb.id === id)?.name || '(unknown notebook)',
        }));
    }, [source.notebooks, notebooks]);

    const tabButton = (value: Tab, label: string) => (
        <button
            onClick={() => setTab(value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === value
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-neutral-700 dark:hover:text-gray-200'
            }`}
        >
            {label}
        </button>
    );

    return (
        <div className="grid h-full gap-6 lg:grid-cols-[2fr_1fr] lg:overflow-hidden">
            <div className="flex min-h-0 flex-col rounded-xl border border-gray-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36]">
                <div className="border-b border-gray-200 px-6 py-4 dark:border-neutral-700">
                    <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                            <h2 className="truncate text-lg font-semibold">
                                {source.title || 'Untitled source'}
                            </h2>
                            {externalHref && (
                                <a
                                    href={externalHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-0.5 block truncate text-xs text-gray-500 hover:text-purple-500 dark:text-gray-400 dark:hover:text-purple-400"
                                >
                                    {source.asset?.url}
                                </a>
                            )}
                        </div>
                        <span className="inline-flex flex-none items-center gap-1.5 rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                            <KindIcon kind={kind} />
                            {kind}
                        </span>
                    </div>
                    <div className="mt-3 flex items-center gap-1">
                        {tabButton('content', 'Content')}
                        {tabButton('insights', insightsCount > 0 ? `Insights (${insightsCount})` : 'Insights')}
                        {tabButton('details', 'Details')}
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-4">
                    {tab === 'content' && (
                        <>
                            {youTubeVideoId && (
                                <div className="mb-6">
                                    <div className="aspect-video overflow-hidden rounded-lg bg-black">
                                        <iframe
                                            src={`https://www.youtube.com/embed/${youTubeVideoId}`}
                                            title="YouTube video"
                                            className="h-full w-full"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                        />
                                    </div>
                                </div>
                            )}
                            {source.full_text ? (
                                <MemoizedReactMarkdown
                                    className="prose prose-sm dark:prose-invert max-w-none break-words"
                                    remarkPlugins={[remarkGfm]}
                                >
                                    {source.full_text}
                                </MemoizedReactMarkdown>
                            ) : (
                                <div className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-neutral-600 dark:text-gray-400">
                                    No extracted content available for this source.
                                </div>
                            )}
                        </>
                    )}

                    {tab === 'insights' && (
                        <InsightsTab
                            source={source}
                            notebookId={source.notebooks?.[0]}
                            onCountChange={setInsightsCount}
                        />
                    )}

                    {tab === 'details' && (
                        <DetailsTab
                            source={source}
                            externalHref={externalHref}
                            linkedNotebooks={linkedNotebooks}
                        />
                    )}
                </div>
            </div>

            <div className="min-h-0">
                <SourceChatPanel source={source} />
            </div>
        </div>
    );
};

// Same behavior as SourceInsightsDialog, hosted as a tab: run a transformation
// against the source, list/expand/delete insights, save one as a note.
const InsightsTab = ({
    source,
    notebookId,
    onCountChange,
}: {
    source: SourceListItem;
    notebookId?: string;
    onCountChange: (count: number) => void;
}) => {
    const [insights, setInsights] = useState<SourceInsight[]>([]);
    const [transformations, setTransformations] = useState<Transformation[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const [selectedTransformationId, setSelectedTransformationId] = useState<string>('');
    const [generating, setGenerating] = useState<boolean>(false);
    const [generationError, setGenerationError] = useState<string | null>(null);

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
            onCountChange(data.length);
            if (showSpinner) setRefreshing(false);
            return data;
        },
        [source.id, onCountChange],
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
            onCountChange(insightsData.length);
            const defaultTransform =
                transformationsData.find((t) => t.apply_default) ?? transformationsData[0];
            if (defaultTransform) setSelectedTransformationId(defaultTransform.id);
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [source.id, onCountChange]);

    const selectedTransformation = useMemo(
        () => transformations.find((t) => t.id === selectedTransformationId),
        [transformations, selectedTransformationId],
    );

    const handleGenerate = async () => {
        if (!selectedTransformationId || generating) return;
        setGenerating(true);
        setGenerationError(null);

        const startCountAtSubmit = insights.length;
        const response = await createSourceInsight(source.id, selectedTransformationId);
        if (!response) {
            setGenerating(false);
            setGenerationError('Failed to start insight generation.');
            return;
        }

        // The backend submits an async job; poll for completion. If no
        // command_id comes back (older deployments), fall back to a single
        // refetch.
        if (response.command_id) {
            const final = await waitForCommand(response.command_id, {
                intervalMs: 2500,
                timeoutMs: 180_000,
            });
            if (final && final.status !== 'completed') {
                setGenerationError(final.error_message || `Job ${final.status}.`);
            }
        }

        const refreshed = await refreshInsights(false);
        setGenerating(false);

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
        onCountChange(next.length);
        setPendingDelete(null);
    };

    const handleSaveAsNote = async (insight: SourceInsight) => {
        if (!notebookId) return;
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

    return (
        <div className="flex flex-col gap-4">
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
                                                disabled={savingNoteId === insight.id || !notebookId}
                                                title={notebookId ? undefined : 'Link this source to a notebook to save insights as notes'}
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
        </div>
    );
};

const DetailsTab = ({
    source,
    externalHref,
    linkedNotebooks,
}: {
    source: SourceListItem;
    externalHref: string | null;
    linkedNotebooks: { id: string; name: string }[];
}) => {
    const [copied, setCopied] = useState<boolean>(false);

    const handleCopyUrl = () => {
        if (!source.asset?.url) return;
        navigator.clipboard.writeText(source.asset.url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col gap-5 text-sm">
            {source.asset?.url && (
                <div>
                    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        URL
                    </h3>
                    <div className="flex items-center gap-2">
                        <code className="min-w-0 flex-1 truncate rounded bg-gray-100 px-2 py-1 text-xs dark:bg-neutral-700">
                            {source.asset.url}
                        </code>
                        <button
                            onClick={handleCopyUrl}
                            title="Copy URL"
                            className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 dark:border-neutral-600 dark:text-gray-300 dark:hover:bg-neutral-700"
                        >
                            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                        </button>
                        {externalHref && (
                            <a
                                href={externalHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open in new tab"
                                className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 dark:border-neutral-600 dark:text-gray-300 dark:hover:bg-neutral-700"
                            >
                                <IconExternalLink size={14} />
                            </a>
                        )}
                    </div>
                </div>
            )}

            {source.asset?.file_path && (
                <div>
                    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Uploaded file
                    </h3>
                    <code className="block truncate rounded bg-gray-100 px-2 py-1 text-xs dark:bg-neutral-700">
                        {source.asset.file_path}
                    </code>
                </div>
            )}

            {source.topics && source.topics.length > 0 && (
                <div>
                    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Topics
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                        {source.topics.map((topic, idx) => (
                            <span
                                key={idx}
                                className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-gray-600 dark:border-neutral-600 dark:text-gray-300"
                            >
                                {topic}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <div>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Notebooks
                </h3>
                {linkedNotebooks.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        This source isn&apos;t linked to any notebook.
                    </p>
                ) : (
                    <div className="flex flex-wrap gap-1.5">
                        {linkedNotebooks.map((nb) => (
                            <span
                                key={nb.id}
                                className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                            >
                                <IconNotebook size={11} />
                                {nb.name}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Created
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                        {formatTimestamp(source.created)}
                    </p>
                </div>
                <div>
                    <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Updated
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                        {formatTimestamp(source.updated)}
                    </p>
                </div>
            </div>

            <div>
                <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Embedding
                </h3>
                <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        source.embedded
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                            : 'bg-neutral-100 text-gray-500 dark:bg-neutral-700 dark:text-gray-400'
                    }`}
                >
                    {source.embedded
                        ? `Embedded (${source.embedded_chunks} chunks)`
                        : 'Not embedded'}
                </span>
            </div>
        </div>
    );
};

export default SourceDetailView;
