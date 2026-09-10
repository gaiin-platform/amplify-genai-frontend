import { ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import remarkGfm from 'remark-gfm';
import HomeContext from '@/pages/api/home/home.context';
import {
    LucideAlertCircle,
    LucideAlignLeft,
    LucideBookOpen,
    LucideCheck,
    LucideCheckCircle,
    LucideCopy,
    LucideDatabase,
    LucideDownload,
    LucideExternalLink,
    LucideLightbulb,
    LucideLink,
    LucideChevronDown,
    LucideLoader2,
    LucideMoreVertical,
    LucidePlus,
    LucideSparkles,
    LucideTrash2,
    LucideUpload,
    LucideYoutube,
} from './LucideIcons';
import {
    NotebookSummary,
    SourceInsight,
    SourceListItem,
    Transformation,
    addSourceToNotebook,
    createSourceInsight,
    deleteInsight,
    deleteSource,
    downloadSourceFile,
    embedSource,
    getSource,
    listSourceInsights,
    listTransformations,
    removeSourceFromNotebook,
    updateSource,
    waitForCommand,
} from '@/services/notebookService';
import { ConfirmModal } from '@/components/ReusableComponents/ConfirmModal';
import { Modal } from '@/components/ReusableComponents/Modal';
import { MemoizedReactMarkdown } from '@/components/Markdown/MemoizedReactMarkdown';
import { filterTransformationsForRole } from './transformationAccess';
import { InlineEditText } from './InlineEditText';
import { DropdownButton, DropdownItem } from './DropdownButton';
import { SourceChatPanel } from './SourceChatPanel';
import { formatDistanceToNow } from './relativeTime';

type Tab = 'content' | 'insights' | 'details';

interface Props {
    // Full source record from getSource (includes full_text and notebooks);
    // the list endpoint's items are missing both.
    source: SourceListItem;
    // Used by the Manage Notebooks card in the Details tab.
    notebooks: NotebookSummary[];
    // Fired after "Delete Source" succeeds — the parent should navigate back
    // to the sources list and refresh it.
    onDeleted?: () => void;
    // Fired when the source record changes (rename, embed, notebook links) so
    // the parent's copy (e.g. the page header title) stays in sync.
    onSourceUpdated?: (source: SourceListItem) => void;
}

const sourceKind = (s: SourceListItem): 'link' | 'file' | 'text' => {
    if (s.asset?.url) return 'link';
    if (s.asset?.file_path) return 'file';
    return 'text';
};

// asset.file_path is an internal storage path — for S3-backed deployments
// it's the full `s3://open-notebook-data/user_<...>/uploads/<uuid>/name.ext`
// URI, exposing the bucket name, the user's DB-identifier path segment, and
// an opaque upload UUID to someone who just wants to know which file this
// is. Show only the filename; the full path is still available via the
// element's title tooltip for anyone who needs it (e.g. support/debugging).
const fileBaseName = (filePath: string): string =>
    filePath.split(/[/\\]/).pop() || filePath;

const KIND_LABELS: Record<'link' | 'file' | 'text', string> = {
    link: 'Link',
    file: 'File',
    text: 'Text',
};

const KindIcon = ({ kind, size = 20 }: { kind: 'link' | 'file' | 'text'; size?: number }) => {
    if (kind === 'link') return <LucideLink size={size} />;
    if (kind === 'file') return <LucideUpload size={size} />;
    return <LucideAlignLeft size={size} />;
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

// Card primitives mirroring the reference UI's shadcn card
// (rounded-xl border py-6 shadow-sm, px-6 sections).
const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
    <div
        className={`flex flex-col gap-6 rounded-xl border border-gray-200 bg-white py-6 shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36] ${className}`}
    >
        {children}
    </div>
);
const CardHeader = ({ children }: { children: ReactNode }) => (
    <div className="flex flex-col gap-1.5 px-6">{children}</div>
);
const CardTitle = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
    <div className={`font-semibold leading-none ${className}`}>{children}</div>
);
const CardDescription = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
    <div className={`text-sm text-gray-500 dark:text-gray-400 ${className}`}>{children}</div>
);
const CardContent = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
    <div className={`px-6 ${className}`}>{children}</div>
);

// Badge variants matching shadcn: rounded-md px-2 py-0.5 text-xs font-medium.
const badgeClass = (variant: 'default' | 'secondary' | 'outline', extra = '') => {
    const variants = {
        default: 'border-transparent bg-purple-500 text-white',
        secondary:
            'border-transparent bg-gray-100 text-gray-800 dark:bg-neutral-700 dark:text-gray-200',
        outline: 'border-gray-300 text-gray-800 dark:border-neutral-600 dark:text-gray-200',
    };
    return `inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${variants[variant]} ${extra}`;
};

// Button styles matching shadcn sizes: sm = h-8 px-3, default = h-9 px-4.
const outlineButtonClass =
    'inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium shadow-sm transition-colors hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-600 dark:bg-transparent dark:hover:bg-neutral-700';
const primaryButtonClass =
    'inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-purple-500 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-purple-600 disabled:pointer-events-none disabled:opacity-50';

// Full-page source viewer mirroring open-notebook's sources/[id] page:
// editable title header with the ⋯ actions menu, Content/Insights/Details
// tabs on the left, and a chat pane scoped to this source on the right.
export const SourceDetailView = ({ source, notebooks, onDeleted, onSourceUpdated }: Props) => {
    const [src, setSrc] = useState<SourceListItem>(source);
    const [tab, setTab] = useState<Tab>('content');
    const [actionError, setActionError] = useState<string | null>(null);

    const [isEmbedding, setIsEmbedding] = useState<boolean>(false);
    const [isDownloading, setIsDownloading] = useState<boolean>(false);
    const [fileAvailable, setFileAvailable] = useState<boolean | null>(null);
    const [confirmDeleteSource, setConfirmDeleteSource] = useState<boolean>(false);
    const [deletingSource, setDeletingSource] = useState<boolean>(false);

    // The single-source GET this page is populated from doesn't return
    // insights_count (only the list endpoint does), so fetch the real count
    // immediately — the "Insights (N)" tab label must be right from the first
    // render, matching the reference which fetches insights on mount.
    const [insightsCount, setInsightsCount] = useState<number>(source.insights_count || 0);

    useEffect(() => {
        setSrc(source);
    }, [source]);

    // Once a 404 sets fileAvailable=false, nothing ever cleared it — so
    // "File unavailable" (and the disabled Download button) could wrongly
    // persist across unrelated updates to this source (rename, embed) or
    // even after navigating to a completely different source that reuses
    // this mounted component. Reset whenever we're looking at a different
    // source record.
    useEffect(() => {
        setFileAvailable(null);
    }, [source.id]);

    useEffect(() => {
        let cancelled = false;
        listSourceInsights(source.id).then((data) => {
            if (!cancelled) setInsightsCount(data.length);
        });
        return () => {
            cancelled = true;
        };
    }, [source.id]);

    const kind = sourceKind(src);
    const externalHref = useMemo(() => safeExternalHref(src.asset?.url), [src.asset?.url]);
    const youTubeVideoId = useMemo(
        () => (externalHref ? getYouTubeVideoId(externalHref) : null),
        [externalHref],
    );

    const applyUpdate = useCallback(
        (next: SourceListItem) => {
            setSrc(next);
            onSourceUpdated?.(next);
        },
        [onSourceUpdated],
    );

    const handleRename = async (title: string) => {
        if (title === (src.title || '')) return;
        setActionError(null);
        const updated = await updateSource(src.id, { title });
        if (!updated) {
            setActionError("Couldn't update the source title.");
            return;
        }
        applyUpdate({ ...src, title: updated.title ?? title });
    };

    const handleEmbed = async () => {
        if (isEmbedding || src.embedded) return;
        setActionError(null);
        setIsEmbedding(true);
        const result = await embedSource(src.id);
        setIsEmbedding(false);
        if (!result) {
            setActionError("Couldn't embed this source's content.");
            return;
        }
        const refreshed = await getSource(src.id);
        applyUpdate(refreshed ?? { ...src, embedded: true });
    };

    const handleDownload = async () => {
        if (!src.asset?.file_path || isDownloading || fileAvailable === false) return;
        setActionError(null);
        setIsDownloading(true);
        const result = await downloadSourceFile(src.id);
        setIsDownloading(false);
        if (!result.ok || !result.blob) {
            if (result.status === 404) {
                setFileAvailable(false);
            } else {
                setActionError("Couldn't download the file. Please try again.");
            }
            return;
        }
        setFileAvailable(true);
        const fallbackName = fileBaseName(src.asset.file_path) || `source-${src.id}`;
        const blobUrl = window.URL.createObjectURL(result.blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = result.filename || fallbackName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
    };

    const handleDeleteSource = async () => {
        setDeletingSource(true);
        const ok = await deleteSource(src.id);
        setDeletingSource(false);
        setConfirmDeleteSource(false);
        if (!ok) {
            setActionError("Couldn't delete this source.");
            return;
        }
        onDeleted?.();
    };

    const menuItems: DropdownItem[] = [
        ...(src.asset?.file_path
            ? [
                  {
                      label:
                          fileAvailable === false
                              ? 'File unavailable'
                              : isDownloading
                                ? 'Preparing...'
                                : 'Download File',
                      icon: <LucideDownload size={16} />,
                      onClick: handleDownload,
                      disabled: isDownloading || fileAvailable === false,
                  } as DropdownItem,
              ]
            : []),
        {
            label: isEmbedding
                ? 'Embedding...'
                : src.embedded
                  ? 'Already Embedded'
                  : 'Embed Content',
            icon: <LucideDatabase size={16} />,
            onClick: handleEmbed,
            disabled: isEmbedding || !!src.embedded,
            separatorAbove: !!src.asset?.file_path,
        },
        {
            label: 'Delete Source',
            icon: <LucideTrash2 size={16} />,
            onClick: () => setConfirmDeleteSource(true),
            danger: true,
            separatorAbove: true,
        },
    ];

    const tabButton = (value: Tab, label: string) => (
        <button
            onClick={() => setTab(value)}
            className={`inline-flex h-9 flex-1 items-center justify-center whitespace-nowrap rounded-lg border px-4 text-sm font-medium transition-all ${
                tab === value
                    ? 'border-gray-200 bg-white text-gray-900 shadow-sm dark:border-neutral-600 dark:bg-[#2b2c36] dark:text-gray-100'
                    : 'border-transparent text-gray-500 dark:text-gray-400'
            }`}
        >
            {label}
        </button>
    );

    return (
        // minmax(0,…) tracks: with the default minmax(auto,…), any content
        // whose intrinsic min size exceeds the column's share (long code/URL
        // lines on the Details tab) blows the column out past the viewport,
        // so the page scrolls on both axes instead of the tab body scrolling
        // internally.
        <div className="grid h-full gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden">
            <div className="flex min-h-0 min-w-0 flex-col">
                {/* Header */}
                {/* id targeted by SourceChatPanel's "This source" citations
                    (see focusReference/onBeforeFocusReference below). */}
                <div id="ref-this-source" className="px-2 pb-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <InlineEditText
                                value={src.title || ''}
                                placeholder="Give your source a descriptive title"
                                className="text-2xl font-bold"
                                onSave={handleRename}
                            />
                        </div>
                        <div className="flex flex-none items-center gap-2">
                            <KindIcon kind={kind} size={20} />
                            <span className={badgeClass('secondary', '!text-sm')}>
                                {KIND_LABELS[kind]}
                            </span>
                            <DropdownButton
                                trigger={<LucideMoreVertical size={16} />}
                                title="Source actions"
                                items={menuItems}
                                triggerClassName="!h-9 !w-9 !px-0 justify-center"
                            />
                        </div>
                    </div>
                    {actionError && (
                        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                            {actionError}
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2">
                    <div className="sticky top-0 z-10 grid w-full grid-cols-3 gap-1 rounded-xl border border-gray-200 bg-gray-100/90 p-1 shadow-sm backdrop-blur dark:border-neutral-700 dark:bg-neutral-800/90">
                        {tabButton('content', 'Content')}
                        {tabButton(
                            'insights',
                            insightsCount > 0 ? `Insights (${insightsCount})` : 'Insights',
                        )}
                        {tabButton('details', 'Details')}
                    </div>

                    <div className="mt-6 pb-6">
                        {tab === 'content' && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        {youTubeVideoId && <LucideYoutube size={20} />}
                                        Content
                                    </CardTitle>
                                    {externalHref && !youTubeVideoId && (
                                        <CardDescription className="flex items-center gap-2">
                                            <LucideLink size={16} className="flex-none" />
                                            <a
                                                href={externalHref}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="truncate text-blue-600 hover:underline"
                                            >
                                                {src.asset?.url}
                                            </a>
                                        </CardDescription>
                                    )}
                                </CardHeader>
                                <CardContent>
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
                                            {externalHref && (
                                                <div className="mt-2">
                                                    <a
                                                        href={externalHref}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:underline dark:text-gray-400"
                                                    >
                                                        <LucideExternalLink size={12} />
                                                        Open on YouTube
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {src.full_text ? (
                                        <MemoizedReactMarkdown
                                            className="prose prose-sm dark:prose-invert max-w-none break-words"
                                            remarkPlugins={[remarkGfm]}
                                        >
                                            {src.full_text}
                                        </MemoizedReactMarkdown>
                                    ) : (
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            No content available
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {tab === 'insights' && (
                            <InsightsTab source={src} onCountChange={setInsightsCount} />
                        )}

                        {tab === 'details' && (
                            <DetailsTab
                                source={src}
                                notebooks={notebooks}
                                externalHref={externalHref}
                                isEmbedding={isEmbedding}
                                isDownloading={isDownloading}
                                fileAvailable={fileAvailable}
                                onEmbed={handleEmbed}
                                onDownload={handleDownload}
                                onSourceUpdated={applyUpdate}
                            />
                        )}
                    </div>
                </div>
            </div>

            <div className="min-h-0 min-w-0">
                <SourceChatPanel
                    source={src}
                    onBeforeFocusReference={(domId) => {
                        // Insight citation targets only exist in the DOM once
                        // the Insights tab is mounted; switch to it before
                        // SourceChatPanel tries to scroll/flash the element.
                        if (domId.startsWith('ref-source_insight-')) setTab('insights');
                        else if (domId === 'ref-this-source') setTab('content');
                    }}
                />
            </div>

            {confirmDeleteSource && (
                <ConfirmModal
                    title="Delete Source"
                    message={
                        <span>
                            Are you sure you want to delete{' '}
                            <b>{src.title || 'Untitled Source'}</b>? This will remove it from
                            every notebook it appears in.
                        </span>
                    }
                    confirmLabel={deletingSource ? 'Deleting…' : 'Delete'}
                    denyLabel="Cancel"
                    onConfirm={handleDeleteSource}
                    onDeny={() => setConfirmDeleteSource(false)}
                />
            )}
        </div>
    );
};

// Insights tab mirroring the reference: a "Generate New Insight" box with a
// transformation picker, and a card list with View/Delete actions.
const InsightsTab = ({
    source,
    onCountChange,
}: {
    source: SourceListItem;
    onCountChange: (count: number) => void;
}) => {
    const {
        state: { featureFlags },
    } = useContext(HomeContext);
    const isAdmin = !!featureFlags?.adminInterface;

    const [insights, setInsights] = useState<SourceInsight[]>([]);
    const [transformations, setTransformations] = useState<Transformation[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const [selectedTransformationId, setSelectedTransformationId] = useState<string>('');
    const [generating, setGenerating] = useState<boolean>(false);
    const [generationError, setGenerationError] = useState<string | null>(null);

    const [viewInsight, setViewInsight] = useState<SourceInsight | null>(null);
    const [pendingDelete, setPendingDelete] = useState<SourceInsight | null>(null);
    const [deleting, setDeleting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const refreshInsights = useCallback(async () => {
        const data = await listSourceInsights(source.id);
        setInsights(data);
        onCountChange(data.length);
        return data;
    }, [source.id, onCountChange]);

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
            // Non-admins are offered only the curated transformation set;
            // admins keep the full list.
            const allowedTransformations = filterTransformationsForRole(transformationsData, isAdmin);
            setTransformations(allowedTransformations);
            // Default the picker to "Dense Summary" when available so the
            // common case (generate a summary) is a single click.
            const denseSummary = allowedTransformations.find(
                (t) => (t.title || t.name) === 'Dense Summary',
            );
            if (denseSummary) {
                setSelectedTransformationId(denseSummary.id);
            }
            onCountChange(insightsData.length);
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [source.id, onCountChange, isAdmin]);

    const handleGenerate = async () => {
        if (!selectedTransformationId || generating) return;
        setGenerating(true);
        setGenerationError(null);

        const response = await createSourceInsight(source.id, selectedTransformationId);
        if (!response) {
            setGenerating(false);
            setGenerationError('Failed to start insight generation.');
            return;
        }
        setSelectedTransformationId('');

        const baselineCount = insights.length;

        // The command_id's own status only tracks the outer run_transformation
        // job — the insight itself is created by a separate create_insight
        // command fired from within that job's graph, so run_transformation
        // can report "completed" slightly before the new insight is actually
        // visible via GET /sources/{id}/insights (or the status value coming
        // back through the proxy just doesn't land cleanly). That gap is why
        // this previously sat on "Generating insight…" indefinitely while
        // staying on the page: waitForCommand alone doesn't tell us whether
        // the insight actually landed. Poll the insights list itself instead
        // — the same list a manual navigate-away-and-back re-fetches — and
        // stop as soon as it actually grows, independent of what the command
        // status field says.
        const insightAppeared = async (): Promise<boolean> => {
            const data = await refreshInsights();
            return data.length > baselineCount;
        };

        let commandFailed: string | null = null;
        let commandSettled = false;
        const commandWait = response.command_id
            ? waitForCommand(response.command_id, { intervalMs: 2500, timeoutMs: 180_000 }).then(
                  (final) => {
                      if (final && final.status !== 'completed') {
                          commandFailed = final.error_message || `Job ${final.status}.`;
                      }
                      commandSettled = true;
                  },
              )
            : Promise.resolve().then(() => {
                  commandSettled = true;
              });

        const POLL_INTERVAL_MS = 3000;
        const POLL_TIMEOUT_MS = 180_000;
        const startedAt = Date.now();
        let appeared = await insightAppeared();
        while (!appeared && !commandFailed && Date.now() - startedAt < POLL_TIMEOUT_MS) {
            // Once commandWait has already settled, racing it again would
            // resolve instantly every time (an already-settled promise wins
            // a race immediately) and turn this into a tight loop hammering
            // insightAppeared() with no delay. Only race it while it's still
            // pending; afterwards just wait out the fixed poll interval.
            if (commandSettled) {
                await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
            } else {
                await Promise.race([new Promise((r) => setTimeout(r, POLL_INTERVAL_MS)), commandWait]);
            }
            if (commandFailed) break;
            appeared = await insightAppeared();
        }

        if (commandFailed) {
            setGenerationError(commandFailed);
        } else if (!appeared) {
            // Gave up after 3 minutes without ever seeing the new insight —
            // it may still finish server-side, but there's nothing more to
            // wait for here.
            setGenerationError(
                "This is taking longer than expected. It may still finish in the " +
                    'background — check back in a bit, or try again.',
            );
        }

        setGenerating(false);
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

    return (
        <div className="flex flex-col gap-4">
            {/* Create New Insight */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-neutral-700 dark:bg-[#343541]">
                <label className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <LucideSparkles size={16} />
                    Generate New Insight
                </label>
                <div className="flex gap-2">
                    <div className="relative min-w-0 flex-1">
                        <select
                            value={selectedTransformationId}
                            onChange={(e) => setSelectedTransformationId(e.target.value)}
                            disabled={generating || loading}
                            className="h-9 w-full min-w-0 appearance-none rounded-md border border-gray-300 bg-white px-3 pr-8 text-sm shadow-sm disabled:opacity-50 dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100"
                        >
                            <option value="">Select a transformation...</option>
                            {transformations.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.title || t.name}
                                </option>
                            ))}
                        </select>
                        <LucideChevronDown
                            size={16}
                            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={!selectedTransformationId || generating || loading}
                        className={primaryButtonClass}
                    >
                        {generating ? (
                            <>
                                <LucideLoader2 size={12} className="animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <LucidePlus size={16} />
                                New
                            </>
                        )}
                    </button>
                </div>
                {generationError && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
                        <LucideAlertCircle size={14} className="mt-0.5 flex-none" />
                        <span>{generationError}</span>
                    </div>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <LucideLightbulb size={20} />
                        Insights
                    </CardTitle>
                    <CardDescription>Insights generated from model analysis</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    {error && (
                        <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
                    )}

                    {/* Insights List */}
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <LucideLoader2 size={24} className="animate-spin text-gray-400" />
                        </div>
                    ) : insights.length === 0 && !generating ? (
                        <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                            <LucideLightbulb size={48} className="mx-auto mb-3 opacity-50" />
                            <p className="text-sm">No insights yet</p>
                            <p className="mt-1 text-xs">
                                Create your first insight using a transformation above
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {generating && (
                                <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500 dark:border-neutral-600 dark:bg-[#343541] dark:text-gray-400">
                                    <LucideLoader2 size={16} className="animate-spin flex-none" />
                                    Generating insight…
                                </div>
                            )}
                            {insights.map((insight) => (
                                <div
                                    key={insight.id}
                                    id={`ref-source_insight-${insight.id.split(':')[1] ?? insight.id}`}
                                    className="rounded-lg border border-gray-200 bg-white p-4 dark:border-neutral-700 dark:bg-[#2b2c36]"
                                >
                                    <div className="flex items-start justify-between">
                                        <span className={badgeClass('outline', 'uppercase')}>
                                            {insight.insight_type}
                                        </span>
                                    </div>
                                    <div className="mt-2 line-clamp-3 text-sm text-gray-500 dark:text-gray-400">
                                        <MemoizedReactMarkdown
                                            className="prose prose-sm dark:prose-invert max-w-none break-words [&_*]:my-0 [&_*]:text-sm [&_*]:font-normal [&_*]:leading-normal"
                                            remarkPlugins={[remarkGfm]}
                                        >
                                            {insight.content}
                                        </MemoizedReactMarkdown>
                                    </div>
                                    <div className="mt-3 flex justify-end gap-2">
                                        <button
                                            onClick={() => setViewInsight(insight)}
                                            className={outlineButtonClass}
                                        >
                                            View Insight
                                        </button>
                                        <button
                                            onClick={() => setPendingDelete(insight)}
                                            className={`${outlineButtonClass} text-red-600 hover:text-red-600 dark:text-red-400`}
                                        >
                                            <LucideTrash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {viewInsight && (
                <Modal
                    title="Source Insight"
                    onCancel={() => setViewInsight(null)}
                    showSubmit={false}
                    cancelLabel="Close"
                    width={() => Math.min(768, window.innerWidth * 0.9)}
                    height={() => window.innerHeight * 0.85}
                    content={
                        <div className="flex flex-col gap-3 p-2 text-neutral-800 dark:text-neutral-100">
                            <div>
                                <span className={badgeClass('outline', 'uppercase')}>
                                    {viewInsight.insight_type}
                                </span>
                            </div>
                            <MemoizedReactMarkdown
                                className="prose prose-sm dark:prose-invert max-w-none break-words"
                                remarkPlugins={[remarkGfm]}
                            >
                                {viewInsight.content}
                            </MemoizedReactMarkdown>
                        </div>
                    }
                />
            )}

            {pendingDelete && (
                <ConfirmModal
                    title="Delete Insight"
                    message="Are you sure you want to delete this insight? This action cannot be undone."
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
    notebooks,
    externalHref,
    isEmbedding,
    isDownloading,
    fileAvailable,
    onEmbed,
    onDownload,
    onSourceUpdated,
}: {
    source: SourceListItem;
    notebooks: NotebookSummary[];
    externalHref: string | null;
    isEmbedding: boolean;
    isDownloading: boolean;
    fileAvailable: boolean | null;
    onEmbed: () => void;
    onDownload: () => void;
    onSourceUpdated: (source: SourceListItem) => void;
}) => {
    const [copied, setCopied] = useState<boolean>(false);
    const [idCopied, setIdCopied] = useState<boolean>(false);

    const handleCopyUrl = () => {
        if (!source.asset?.url) return;
        navigator.clipboard.writeText(source.asset.url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
    };

    const handleCopyId = () => {
        navigator.clipboard.writeText(source.id);
        setIdCopied(true);
        window.setTimeout(() => setIdCopied(false), 2000);
    };

    const created = source.created ? new Date(source.created.replace(' ', 'T')) : null;
    const updated = source.updated ? new Date(source.updated.replace(' ', 'T')) : null;

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Details</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                    {/* Embedding Alert */}
                    {!source.embedded && (
                        <div className="rounded-lg border border-gray-200 p-4 dark:border-neutral-700">
                            <div className="flex gap-3">
                                <LucideAlertCircle size={16} className="mt-0.5 flex-none" />
                                <div className="min-w-0">
                                    <div className="mb-1 font-medium">Content Not Embedded</div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                        This content hasn&apos;t been embedded for vector search.
                                        Embedding enables advanced search capabilities and better
                                        content discovery.
                                        <div className="mt-3">
                                            <button
                                                onClick={onEmbed}
                                                disabled={isEmbedding}
                                                className={primaryButtonClass}
                                            >
                                                <LucideDatabase size={16} />
                                                {isEmbedding ? 'Embedding...' : 'Embed Content'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Source Information */}
                    <div className="flex flex-col gap-4">
                        {source.asset?.url && (
                            <div>
                                <h3 className="mb-2 text-sm font-semibold">URL</h3>
                                <div className="flex items-center gap-2">
                                    <code className="min-w-0 flex-1 truncate rounded bg-gray-100 px-2 py-1 text-sm dark:bg-neutral-700">
                                        {source.asset.url}
                                    </code>
                                    <button
                                        onClick={handleCopyUrl}
                                        title="Copy URL"
                                        className={outlineButtonClass}
                                    >
                                        {copied ? (
                                            <LucideCheckCircle size={16} />
                                        ) : (
                                            <LucideCopy size={16} />
                                        )}
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (externalHref) {
                                                window.open(
                                                    externalHref,
                                                    '_blank',
                                                    'noopener,noreferrer',
                                                );
                                            }
                                        }}
                                        disabled={!externalHref}
                                        title="Open in new tab"
                                        className={outlineButtonClass}
                                    >
                                        <LucideExternalLink size={16} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {source.asset?.file_path && (
                            <div className="flex flex-col gap-2">
                                <h3 className="text-sm font-semibold">Uploaded File</h3>
                                <div className="flex flex-wrap items-center gap-2">
                                    <code
                                        title={source.asset.file_path}
                                        className="min-w-0 max-w-full truncate rounded bg-gray-100 px-2 py-1 text-sm dark:bg-neutral-700"
                                    >
                                        {fileBaseName(source.asset.file_path)}
                                    </code>
                                    <button
                                        onClick={onDownload}
                                        disabled={isDownloading || fileAvailable === false}
                                        className={outlineButtonClass}
                                    >
                                        <LucideDownload size={16} />
                                        {fileAvailable === false
                                            ? 'File unavailable'
                                            : isDownloading
                                              ? 'Preparing...'
                                              : 'Download'}
                                    </button>
                                </div>
                                {fileAvailable === false && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        This file is currently unavailable due to storage system
                                        reasons.
                                    </p>
                                )}
                            </div>
                        )}

                        {source.topics && source.topics.length > 0 && (
                            <div>
                                <h3 className="mb-2 text-sm font-semibold">Topics</h3>
                                <div className="flex flex-wrap gap-2">
                                    {source.topics.map((topic, idx) => (
                                        <span key={idx} className={badgeClass('outline')}>
                                            {topic}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Metadata */}
                    <div>
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-semibold">Metadata</h3>
                            <div className="flex items-center gap-2">
                                <LucideDatabase
                                    size={14}
                                    className="text-gray-500 dark:text-gray-400"
                                />
                                <span
                                    className={badgeClass(
                                        source.embedded ? 'default' : 'secondary',
                                    )}
                                >
                                    {source.embedded ? 'Embedded' : 'Not Embedded'}
                                </span>
                            </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                    Created
                                </p>
                                <p className="text-sm">{formatDistanceToNow(source.created)}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {created ? created.toLocaleString() : '—'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                    Updated
                                </p>
                                <p className="text-sm">{formatDistanceToNow(source.updated)}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {updated ? updated.toLocaleString() : '—'}
                                </p>
                            </div>
                        </div>
                        <div className="mt-4">
                            <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                                Source ID
                            </p>
                            <div className="flex items-center gap-2">
                                <code className="min-w-0 flex-1 truncate rounded bg-gray-100 px-2 py-1 text-sm dark:bg-neutral-700">
                                    {source.id}
                                </code>
                                <button
                                    onClick={handleCopyId}
                                    title="Copy source ID"
                                    className={outlineButtonClass}
                                >
                                    {idCopied ? (
                                        <LucideCheckCircle size={16} />
                                    ) : (
                                        <LucideCopy size={16} />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <ManageNotebooksCard
                source={source}
                notebooks={notebooks}
                onSourceUpdated={onSourceUpdated}
            />
        </>
    );
};

// Mirrors the reference's NotebookAssociations card: checkboxes for every
// (non-archived) notebook, with Save/Cancel appearing once the selection
// differs from the source's current links.
const ManageNotebooksCard = ({
    source,
    notebooks,
    onSourceUpdated,
}: {
    source: SourceListItem;
    notebooks: NotebookSummary[];
    onSourceUpdated: (source: SourceListItem) => void;
}) => {
    const currentIds = useMemo(() => source.notebooks || [], [source.notebooks]);
    const [selectedIds, setSelectedIds] = useState<string[]>(currentIds);
    const [saving, setSaving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setSelectedIds(currentIds);
    }, [currentIds]);

    const hasChanges = useMemo(() => {
        if (currentIds.length !== selectedIds.length) return true;
        const selected = new Set(selectedIds);
        return currentIds.some((id) => !selected.has(id));
    }, [currentIds, selectedIds]);

    const toggle = (notebookId: string) => {
        setSelectedIds((prev) =>
            prev.includes(notebookId)
                ? prev.filter((id) => id !== notebookId)
                : [...prev, notebookId],
        );
    };

    const handleSave = async () => {
        if (!hasChanges || saving) return;
        setSaving(true);
        setError(null);
        const current = new Set(currentIds);
        const selected = new Set(selectedIds);
        const toAdd = selectedIds.filter((id) => !current.has(id));
        const toRemove = currentIds.filter((id) => !selected.has(id));
        const results = await Promise.all([
            ...toAdd.map((id) => addSourceToNotebook(id, source.id)),
            ...toRemove.map((id) => removeSourceFromNotebook(id, source.id)),
        ]);
        const refreshed = await getSource(source.id);
        setSaving(false);
        if (results.some((ok) => !ok)) {
            setError("Couldn't update some notebook links.");
        }
        if (refreshed) {
            onSourceUpdated(refreshed);
        } else {
            onSourceUpdated({ ...source, notebooks: selectedIds });
        }
    };

    const visibleNotebooks = notebooks.filter((nb) => !nb.archived);

    return (
        <Card className="mt-6">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <LucideBookOpen size={20} />
                    Manage Notebooks
                </CardTitle>
                <CardDescription>Manage which notebooks contain this source</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {visibleNotebooks.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        No notebooks available
                    </p>
                ) : (
                    <div className="h-[300px] overflow-y-auto rounded-md border border-gray-200 p-4 dark:border-neutral-700">
                        <div className="flex flex-col gap-3">
                            {visibleNotebooks.map((nb) => {
                                const isSelected = selectedIds.includes(nb.id);
                                const isLinked = currentIds.includes(nb.id);
                                return (
                                    <div
                                        key={nb.id}
                                        className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                                            isSelected
                                                ? 'border-gray-300 bg-gray-100 dark:border-neutral-500 dark:bg-neutral-700/60'
                                                : 'border-gray-200 hover:bg-gray-50 dark:border-neutral-700 dark:hover:bg-neutral-700/30'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggle(nb.id)}
                                            className="mt-0.5 h-4 w-4 accent-purple-500"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="truncate text-sm font-medium">
                                                    {nb.name || '(untitled)'}
                                                </h4>
                                                {/* Per-row, not gated on the
                                                    global hasChanges — that
                                                    previously hid every
                                                    linked checkmark at once
                                                    the moment ANY row was
                                                    toggled. Show the check
                                                    only for a row that's
                                                    linked and still selected
                                                    (i.e. no pending removal
                                                    queued for THIS row). */}
                                                {isLinked && isSelected && (
                                                    <LucideCheck
                                                        size={16}
                                                        className="flex-none text-green-600"
                                                    />
                                                )}
                                            </div>
                                            {nb.description && (
                                                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                                    {nb.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {error && (
                    <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
                )}

                {hasChanges && (
                    <div className="flex items-center justify-end gap-2 border-t border-gray-200 pt-2 dark:border-neutral-700">
                        <button
                            onClick={() => setSelectedIds(currentIds)}
                            disabled={saving}
                            className={outlineButtonClass}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className={primaryButtonClass}
                        >
                            {saving ? (
                                <>
                                    <LucideLoader2 size={16} className="animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default SourceDetailView;
