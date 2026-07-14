import { useCallback, useEffect, useRef, useState } from 'react';
import {
    LucideAlertTriangle,
    LucideArchive,
    LucideArchiveRestore,
    LucideBot,
    LucideChevronDown,
    LucideChevronLeft,
    LucideClock,
    LucideExternalLink,
    LucideFileText,
    LucideLink2,
    LucideListChecks,
    LucideLoader2,
    LucideMoreVertical,
    LucidePlus,
    LucideRefreshCw,
    LucideStickyNote,
    LucideTrash2,
    LucideUnlink,
    LucideUpload,
    LucideUser,
} from './LucideIcons';
import {
    ContextSelections,
    NoteContextMode,
    Note,
    NotebookSummary,
    SourceContextMode,
    SourceListItem,
    deleteNote,
    deleteSource,
    getNotebook,
    listNotes,
    listSources,
    removeSourceFromNotebook,
    retrySource,
    updateNotebook,
} from '@/services/notebookService';
import { ConfirmModal } from '@/components/ReusableComponents/ConfirmModal';
import { AddSourceDialog } from './AddSourceDialog';
import { AddExistingSourceDialog } from './AddExistingSourceDialog';
import { ContextToggle } from './ContextToggle';
import { DropdownButton } from './DropdownButton';
import { InlineEditText } from './InlineEditText';
import { NotebookDeleteDialog } from './NotebookDeleteDialog';
import { NoteEditorDialog } from './NoteEditorDialog';
import { ChatPanel } from './ChatPanel';
import { formatDistanceToNow } from './relativeTime';

interface Props {
    notebookId: string;
    initialData?: NotebookSummary;
    // Lets the parent keep its list/header in sync with renames, description
    // edits, and archive toggles made here.
    onUpdated?: (notebook: NotebookSummary) => void;
    onDeleted?: (id: string) => void;
    // Set when the user arrived here by clicking a source on the global
    // Sources page — scrolls to and briefly highlights that source in the
    // Sources panel once it's loaded, then calls onFocusConsumed.
    focusSourceId?: string | null;
    onFocusConsumed?: () => void;
    // Opens a source's full detail view (content + insights + source chat) in
    // place of the notebook, with a Back button that returns here — mirrors the
    // reference, where clicking a source card opens its detail.
    onOpenSource?: (source: SourceListItem) => void;
}

const COLUMNS_KEY = 'amplify.notebook.collapsedColumns';

export const NotebookDetail = ({
    notebookId,
    initialData,
    onUpdated,
    onDeleted,
    focusSourceId,
    onFocusConsumed,
    onOpenSource,
}: Props) => {
    const [notebook, setNotebook] = useState<NotebookSummary | null>(initialData ?? null);
    const [loading, setLoading] = useState<boolean>(!initialData);
    const [error, setError] = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState<{ sources: boolean; notes: boolean }>({
        sources: false,
        notes: false,
    });

    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(COLUMNS_KEY) || '{}');
            setCollapsed({ sources: !!saved.sources, notes: !!saved.notes });
        } catch {
            // Ignore a corrupt value; defaults stay expanded.
        }
    }, []);

    const toggleCollapsed = (key: 'sources' | 'notes') => {
        setCollapsed((prev) => {
            const next = { ...prev, [key]: !prev[key] };
            localStorage.setItem(COLUMNS_KEY, JSON.stringify(next));
            return next;
        });
    };

    const [sources, setSources] = useState<SourceListItem[]>([]);
    const [notes, setNotes] = useState<Note[]>([]);
    const [contextSelections, setContextSelections] = useState<ContextSelections>({
        sources: {},
        notes: {},
    });
    // Guards the focus-on-arrival effect below so it only ever runs once per
    // incoming focusSourceId, even though it re-renders while it waits for
    // the Sources panel to expand/load.
    const focusAppliedRef = useRef<string | null>(null);

    useEffect(() => {
        // Clear data tied to the previous notebookId so the panels don't
        // briefly render stale sources/notes during the refetch.
        setSources([]);
        setNotes([]);
        setContextSelections({ sources: {}, notes: {} });
    }, [notebookId]);

    // Arrived here via a source click on the global Sources page — make sure
    // the Sources panel isn't collapsed so the target is actually visible.
    useEffect(() => {
        if (!focusSourceId || !collapsed.sources) return;
        setCollapsed((prev) => {
            const next = { ...prev, sources: false };
            localStorage.setItem(COLUMNS_KEY, JSON.stringify(next));
            return next;
        });
    }, [focusSourceId, collapsed.sources]);

    // Once the Sources panel is expanded and that source has loaded into the
    // list, scroll to it and flash-highlight it (same treatment ChatPanel
    // uses for citation jumps), then tell the parent we're done with it.
    useEffect(() => {
        if (!focusSourceId || collapsed.sources) return;
        if (focusAppliedRef.current === focusSourceId) return;
        if (sources.length === 0) return;

        const shortId = focusSourceId.split(':')[1] ?? focusSourceId;
        const el = document.getElementById(`ref-source-${shortId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('notebook-ref-flash');
            window.setTimeout(() => el.classList.remove('notebook-ref-flash'), 1500);
        }
        focusAppliedRef.current = focusSourceId;
        onFocusConsumed?.();
    }, [focusSourceId, collapsed.sources, sources, onFocusConsumed]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError(null);
            const result = await getNotebook(notebookId);
            if (cancelled) return;
            if (!result) {
                setError('Notebook not found.');
            } else {
                setNotebook(result);
            }
            setLoading(false);
        };
        if (!initialData) {
            load();
        }
        return () => {
            cancelled = true;
        };
    }, [notebookId, initialData]);

    useEffect(() => {
        setContextSelections((prev) => {
            const next: ContextSelections['sources'] = { ...prev.sources };
            for (const s of sources) {
                if (next[s.id] === undefined) {
                    next[s.id] = s.insights_count > 0 ? 'insights' : 'full';
                }
            }
            for (const id of Object.keys(next)) {
                if (!sources.some((s) => s.id === id)) delete next[id];
            }
            return { ...prev, sources: next };
        });
    }, [sources]);

    useEffect(() => {
        setContextSelections((prev) => {
            const next: ContextSelections['notes'] = { ...prev.notes };
            for (const n of notes) {
                if (next[n.id] === undefined) next[n.id] = 'full';
            }
            for (const id of Object.keys(next)) {
                if (!notes.some((n) => n.id === id)) delete next[id];
            }
            return { ...prev, notes: next };
        });
    }, [notes]);

    const setSourceMode = (id: string, mode: SourceContextMode) => {
        setContextSelections((prev) => ({
            ...prev,
            sources: { ...prev.sources, [id]: mode },
        }));
    };

    const setNoteMode = (id: string, mode: NoteContextMode) => {
        setContextSelections((prev) => ({
            ...prev,
            notes: { ...prev.notes, [id]: mode },
        }));
    };

    // Bulk context actions, offered in each panel's header once it has at
    // least one item. "insights" leaves sources without insights excluded
    // rather than forcing them to full — mirrors upstream's
    // bulkModeForSource, which treats that as not forcing a mode.
    const bulkSetSourceMode = (action: 'insights' | 'full' | 'exclude') => {
        setContextSelections((prev) => {
            const next = { ...prev.sources };
            for (const s of sources) {
                next[s.id] =
                    action === 'exclude'
                        ? 'off'
                        : action === 'full'
                          ? 'full'
                          : s.insights_count > 0
                            ? 'insights'
                            : 'off';
            }
            return { ...prev, sources: next };
        });
    };

    const bulkSetNoteMode = (action: 'include' | 'exclude') => {
        setContextSelections((prev) => {
            const next = { ...prev.notes };
            for (const n of notes) {
                next[n.id] = action === 'exclude' ? 'off' : 'full';
            }
            return { ...prev, notes: next };
        });
    };

    // Lets dialogs in other panels (e.g. "Save as note" in the source insights
    // dialog) surface a freshly-created note in the Notes panel immediately,
    // instead of waiting for the next full notebook refetch.
    const handleNoteSaved = useCallback((saved: Note) => {
        setNotes((prev) => {
            const exists = prev.some((n) => n.id === saved.id);
            if (exists) return prev.map((n) => (n.id === saved.id ? saved : n));
            return [saved, ...prev];
        });
    }, []);

    if (loading) {
        return <div className="text-gray-500 dark:text-gray-400">Loading notebook…</div>;
    }

    if (error || !notebook) {
        return <div className="text-red-600 dark:text-red-400">{error ?? 'Notebook not found.'}</div>;
    }

    return (
        <div className="flex h-full min-h-0 flex-col">
            <NotebookHeader
                notebook={notebook}
                onChanged={(updated) => {
                    setNotebook((prev) => (prev ? { ...prev, ...updated } : updated));
                    onUpdated?.(updated);
                }}
                onDeleted={() => onDeleted?.(notebook.id)}
            />

            <div className="flex min-h-0 flex-1 flex-col gap-6 pt-6 max-lg:overflow-y-auto lg:flex-row">
                {collapsed.sources ? (
                    <CollapsedPanel
                        label="Sources"
                        icon={<LucideFileText size={20} />}
                        onExpand={() => toggleCollapsed('sources')}
                    />
                ) : (
                    <div className="flex min-h-0 flex-col lg:min-w-0 lg:basis-1/3">
                        <SourcesPanel
                            notebookId={notebookId}
                            sources={sources}
                            onSourcesChange={setSources}
                            contextSelections={contextSelections.sources}
                            onModeChange={setSourceMode}
                            onBulkModeChange={bulkSetSourceMode}
                            onOpenSource={onOpenSource}
                            onCollapse={() => toggleCollapsed('sources')}
                        />
                    </div>
                )}

                {collapsed.notes ? (
                    <CollapsedPanel
                        label="Notes"
                        icon={<LucideStickyNote size={20} />}
                        onExpand={() => toggleCollapsed('notes')}
                    />
                ) : (
                    <div className="flex min-h-0 flex-col lg:min-w-0 lg:basis-1/3">
                        <NotesPanel
                            notebookId={notebookId}
                            notes={notes}
                            onNotesChange={setNotes}
                            contextSelections={contextSelections.notes}
                            onModeChange={setNoteMode}
                            onBulkModeChange={bulkSetNoteMode}
                            onCollapse={() => toggleCollapsed('notes')}
                        />
                    </div>
                )}

                <div className="flex min-h-0 flex-col lg:min-w-0 lg:flex-1">
                    <ChatPanel
                        notebookId={notebookId}
                        contextSelections={contextSelections}
                        sources={sources}
                        notes={notes}
                        onNoteSaved={handleNoteSaved}
                    />
                </div>
            </div>
        </div>
    );
};

// Collapsed column strip — a thin full-height button (like the original app's
// CollapsibleColumn) with a vertical label on desktop; a normal horizontal
// button when the columns are stacked on small screens.
const CollapsedPanel = ({
    label,
    icon,
    onExpand,
}: {
    label: string;
    icon: React.ReactNode;
    onExpand: () => void;
}) => (
    <button
        onClick={onExpand}
        title={`Expand ${label}`}
        className="group flex flex-none items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white p-2 text-gray-400 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-700 dark:border-neutral-700 dark:bg-[#2b2c36] dark:text-gray-500 dark:hover:bg-neutral-700/50 dark:hover:text-gray-200 lg:h-full lg:w-12 lg:flex-col lg:py-6"
    >
        {icon}
        <span className="text-xs font-medium lg:hidden">{label}</span>
        <span
            className="hidden text-xs font-medium lg:block"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
            {label}
        </span>
    </button>
);

// Click-to-edit text. Saves on blur or Enter (single-line), cancels on Escape.
const NotebookHeader = ({
    notebook,
    onChanged,
    onDeleted,
}: {
    notebook: NotebookSummary;
    onChanged: (updated: NotebookSummary) => void;
    onDeleted: () => void;
}) => {
    const [error, setError] = useState<string | null>(null);
    const [archiving, setArchiving] = useState<boolean>(false);
    const [confirmingDelete, setConfirmingDelete] = useState<boolean>(false);

    const save = async (data: { name?: string; description?: string }) => {
        setError(null);
        const updated = await updateNotebook(notebook.id, data);
        if (!updated) {
            setError("Couldn't save changes.");
            return;
        }
        onChanged(updated);
    };

    const handleRename = (name: string) => {
        const trimmed = name.trim();
        // An empty name is rejected rather than saved — the backend requires one.
        if (!trimmed || trimmed === notebook.name) return;
        save({ name: trimmed });
    };

    const handleDescription = (description: string) => {
        const trimmed = description.trim();
        if (trimmed === (notebook.description || '')) return;
        save({ description: trimmed });
    };

    const handleArchiveToggle = async () => {
        setArchiving(true);
        setError(null);
        const updated = await updateNotebook(notebook.id, {
            archived: !notebook.archived,
        });
        setArchiving(false);
        if (!updated) {
            setError(`Couldn't ${notebook.archived ? 'unarchive' : 'archive'} this notebook.`);
            return;
        }
        onChanged(updated);
    };

    return (
        <div className="flex-none border-b border-gray-200 pb-6 dark:border-neutral-700">
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <div className="flex flex-1 items-center gap-3">
                        <InlineEditText
                            value={notebook.name || ''}
                            placeholder="Notebook name"
                            className="text-2xl font-bold"
                            onSave={handleRename}
                        />
                        {notebook.archived && (
                            <span className="inline-flex flex-none items-center rounded-md border border-transparent bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-neutral-700 dark:text-gray-200">
                                Archived
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleArchiveToggle}
                            disabled={archiving}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium shadow-sm transition-colors hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-600 dark:bg-transparent dark:hover:bg-neutral-700"
                        >
                            {notebook.archived ? (
                                <>
                                    <LucideArchiveRestore size={16} />
                                    Unarchive
                                </>
                            ) : (
                                <>
                                    <LucideArchive size={16} />
                                    Archive
                                </>
                            )}
                        </button>
                        <button
                            onClick={() => setConfirmingDelete(true)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-gray-50 hover:text-red-700 dark:border-neutral-600 dark:bg-transparent dark:text-red-400 dark:hover:bg-neutral-700"
                        >
                            <LucideTrash2 size={16} />
                            Delete
                        </button>
                    </div>
                </div>

                <div className="text-gray-500 dark:text-gray-400">
                    <InlineEditText
                        value={notebook.description || ''}
                        placeholder="Add description..."
                        multiline
                        onSave={handleDescription}
                    />
                </div>

                {(notebook.created || notebook.updated) && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        {notebook.created && <>Created {formatDistanceToNow(notebook.created)}</>}
                        {notebook.created && notebook.updated && ' • '}
                        {notebook.updated && <>Updated {formatDistanceToNow(notebook.updated)}</>}
                    </div>
                )}

                {error && (
                    <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
                )}
            </div>

            {confirmingDelete && (
                <NotebookDeleteDialog
                    notebookId={notebook.id}
                    notebookName={notebook.name || '(untitled)'}
                    onClose={() => setConfirmingDelete(false)}
                    onDeleted={onDeleted}
                />
            )}
        </div>
    );
};

const PanelShell = ({
    title,
    actions,
    onCollapse,
    children,
}: {
    title: string;
    actions?: React.ReactNode;
    onCollapse?: () => void;
    children: React.ReactNode;
}) => (
    // Card shell mirroring the reference columns: no divider under the
    // header — the shadcn Card's internal gap separates header and body.
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white py-6 shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36]">
        <div className="flex flex-none items-center justify-between gap-2 px-6 pb-3">
            <div className="text-lg font-semibold leading-none">{title}</div>
            <div className="flex items-center gap-2">
                {actions}
                {onCollapse && (
                    <button
                        onClick={onCollapse}
                        title={`Collapse ${title}`}
                        className="hidden h-9 w-9 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-neutral-700 dark:hover:text-white lg:flex"
                    >
                        <LucideChevronLeft size={16} />
                    </button>
                )}
            </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-3">{children}</div>
    </div>
);

// Source type — mirrors open-notebook's SOURCE_TYPE_ICONS/getSourceType.
type SourceKind = 'link' | 'file' | 'text';

const sourceKind = (s: SourceListItem): SourceKind => {
    if (s.asset?.url) return 'link';
    if (s.asset?.file_path) return 'file';
    return 'text';
};

// Reference SOURCE_TYPE_ICONS: link → ExternalLink, upload → Upload,
// text → FileText.
const SourceKindIcon = ({ kind, size = 12 }: { kind: SourceKind; size?: number }) => {
    if (kind === 'link') return <LucideExternalLink size={size} />;
    if (kind === 'file') return <LucideUpload size={size} />;
    return <LucideFileText size={size} />;
};

// Reference badge label per type (sources.addUrl / uploadFile / enterText).
const KIND_BADGE_LABELS: Record<SourceKind, string> = {
    link: 'Add URL',
    file: 'Upload File',
    text: 'Enter Text',
};

// Mirrors open-notebook's getStatusConfig(). A "completed" source (or one
// with no async command at all) renders no badge, matching the reference UI.
const SOURCE_STATUS_CONFIG = {
    new: {
        Icon: LucideClock,
        label: 'Processing',
        cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    },
    queued: {
        Icon: LucideClock,
        label: 'Queued',
        cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    },
    running: {
        Icon: LucideLoader2,
        label: 'Processing',
        cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    },
    completed: {
        Icon: LucideClock,
        label: 'Completed',
        cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    },
    failed: {
        Icon: LucideAlertTriangle,
        label: 'Failed',
        cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    },
} as const;

type SourceStatus = keyof typeof SOURCE_STATUS_CONFIG;

// A source with a command_id but no resolved status yet is freshly created
// ("new"); one with no command at all was never queued, so it's complete.
const resolveSourceStatus = (s: SourceListItem): SourceStatus => {
    const raw = s.status;
    if (raw === 'new' || raw === 'queued' || raw === 'running' || raw === 'completed' || raw === 'failed') {
        return raw;
    }
    if (raw === 'error') return 'failed';
    return s.command_id ? 'new' : 'completed';
};

const SourcesPanel = ({
    notebookId,
    sources,
    onSourcesChange,
    contextSelections,
    onModeChange,
    onBulkModeChange,
    onOpenSource,
    onCollapse,
}: {
    notebookId: string;
    sources: SourceListItem[];
    onSourcesChange: (next: SourceListItem[] | ((prev: SourceListItem[]) => SourceListItem[])) => void;
    contextSelections: Record<string, SourceContextMode>;
    onModeChange: (id: string, mode: SourceContextMode) => void;
    onBulkModeChange: (action: 'insights' | 'full' | 'exclude') => void;
    onOpenSource?: (source: SourceListItem) => void;
    onCollapse?: () => void;
}) => {
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [showAdd, setShowAdd] = useState<boolean>(false);
    const [showAddExisting, setShowAddExisting] = useState<boolean>(false);
    const [pendingDelete, setPendingDelete] = useState<SourceListItem | null>(null);
    const [deleting, setDeleting] = useState<boolean>(false);
    const [pendingRemove, setPendingRemove] = useState<SourceListItem | null>(null);
    const [removing, setRemoving] = useState<boolean>(false);
    const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

    const fetchSources = async (showLoading: boolean = false) => {
        if (showLoading) setLoading(true);
        setError(null);
        try {
            const data = await listSources({ notebookId });
            onSourcesChange(data);
        } catch (e: any) {
            setError(e?.message || 'Failed to load sources');
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchSources(true);
    }, [notebookId]);

    useEffect(() => {
        const stillProcessing = sources.some(
            (s) => !s.embedded && s.status !== 'failed' && s.status !== 'error'
        );
        if (!stillProcessing) return;

        const id = setInterval(() => {
            fetchSources(false);
        }, 4000);
        return () => clearInterval(id);
    }, [sources]);

    const handleCreated = (created: SourceListItem) => {
        onSourcesChange((prev) => [created, ...prev]);
    };

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        setDeleting(true);
        const ok = await deleteSource(pendingDelete.id);
        setDeleting(false);
        if (!ok) {
            setError(`Couldn't delete "${pendingDelete.title || '(untitled)'}".`);
            setPendingDelete(null);
            return;
        }
        onSourcesChange((prev) => prev.filter((s) => s.id !== pendingDelete.id));
        setPendingDelete(null);
    };

    const confirmRemove = async () => {
        if (!pendingRemove) return;
        setRemoving(true);
        const ok = await removeSourceFromNotebook(notebookId, pendingRemove.id);
        setRemoving(false);
        if (!ok) {
            setError(`Couldn't remove "${pendingRemove.title || '(untitled)'}" from this notebook.`);
            setPendingRemove(null);
            return;
        }
        onSourcesChange((prev) => prev.filter((s) => s.id !== pendingRemove.id));
        setPendingRemove(null);
    };

    // Serves both "Retry Processing" (failed sources) and "Refresh Content"
    // (completed links) — same endpoint handles both server-side.
    const handleRetry = async (sourceId: string) => {
        setRetryingIds((prev) => new Set(prev).add(sourceId));
        try {
            const result = await retrySource(sourceId);
            if (!result) {
                setError("Couldn't retry processing for that source.");
            }
            await fetchSources(false);
        } finally {
            setRetryingIds((prev) => {
                const next = new Set(prev);
                next.delete(sourceId);
                return next;
            });
        }
    };

    const actions = (
        <>
            {sources.length > 0 && (
                <DropdownButton
                    align="left"
                    title="Bulk context actions"
                    trigger={
                        <>
                            <LucideListChecks size={16} />
                            <LucideChevronDown size={16} />
                        </>
                    }
                    items={[
                        {
                            label: 'Include all (insights only)',
                            onClick: () => onBulkModeChange('insights'),
                        },
                        {
                            label: 'Include all (full content)',
                            onClick: () => onBulkModeChange('full'),
                        },
                        {
                            label: 'Exclude all from context',
                            onClick: () => onBulkModeChange('exclude'),
                        },
                    ]}
                />
            )}
            <DropdownButton
                variant="solid"
                title="Add source"
                trigger={
                    <>
                        <LucidePlus size={16} />
                        Add Source
                        <LucideChevronDown size={16} />
                    </>
                }
                items={[
                    {
                        label: 'Add Source',
                        icon: <LucidePlus size={16} />,
                        onClick: () => setShowAdd(true),
                    },
                    {
                        label: 'Add Existing Sources',
                        icon: <LucideLink2 size={16} />,
                        onClick: () => setShowAddExisting(true),
                    },
                ]}
            />
        </>
    );

    return (
        <PanelShell title="Sources" actions={actions} onCollapse={onCollapse}>
            {loading && (
                <div className="flex items-center justify-center py-8">
                    <LucideLoader2 size={24} className="animate-spin text-gray-400" />
                </div>
            )}

            {!loading && error && (
                <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
            )}

            {!loading && !error && sources.length === 0 && (
                <div className="py-12 text-center">
                    <LucideFileText
                        size={48}
                        className="mx-auto mb-4 text-gray-400/60 dark:text-gray-500/60"
                    />
                    <h3 className="mb-2 text-lg font-medium">No sources yet</h3>
                    <p className="mb-4 text-gray-500 dark:text-gray-400">
                        Add your first source to start building your knowledge base.
                    </p>
                </div>
            )}

            {!loading && !error && sources.length > 0 && (
                <ul className="space-y-3">
                    {sources.map((s) => {
                        const displayTitle =
                            !s.title || s.title === 'Processing...' || s.title.trim() === ''
                                ? 'Untitled Source'
                                : s.title;
                        const mode = contextSelections[s.id] ?? 'off';
                        const hasInsights = s.insights_count > 0;
                        const kind = sourceKind(s);
                        const status = resolveSourceStatus(s);
                        const isFailed = status === 'failed';
                        const isCompleted = status === 'completed';
                        const isProcessing =
                            status === 'new' || status === 'queued' || status === 'running';
                        const statusCfg = SOURCE_STATUS_CONFIG[status];
                        const processingError = (s.processing_info as { error?: string } | null)?.error;
                        const isRetrying = retryingIds.has(s.id);
                        const topics = s.topics ?? [];

                        return (
                            <li
                                key={s.id}
                                id={`ref-source-${s.id.split(':')[1]}`}
                                onClick={onOpenSource ? () => onOpenSource(s) : undefined}
                                className={`group relative rounded-xl border border-gray-200/60 bg-white py-4 shadow-sm transition-all duration-200 hover:shadow-md dark:border-neutral-700/40 dark:bg-[#2b2c36]${
                                    onOpenSource ? ' cursor-pointer' : ''
                                }`}
                            >
                                <div className="px-3 py-1">
                                    <div className="mb-1 flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            {!isCompleted && (
                                                <div className="mb-2 flex items-center gap-2">
                                                    <div
                                                        className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${statusCfg.cls}`}
                                                    >
                                                        <statusCfg.Icon
                                                            size={12}
                                                            className={isProcessing ? 'animate-spin' : ''}
                                                        />
                                                        {statusCfg.label}
                                                    </div>
                                                    <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                                                        <SourceKindIcon kind={kind} size={12} />
                                                        <span className="text-xs capitalize">Source</span>
                                                    </div>
                                                </div>
                                            )}

                                            <div className={isCompleted ? 'mb-1.5' : 'mb-1'}>
                                                <h4
                                                    className="line-clamp-2 break-all text-sm font-medium leading-tight"
                                                    title={displayTitle}
                                                >
                                                    {displayTitle}
                                                </h4>
                                            </div>

                                            {isFailed && processingError && (
                                                <p
                                                    className="mb-2 truncate text-xs italic text-gray-600 dark:text-gray-400"
                                                    title={processingError}
                                                >
                                                    {processingError}
                                                </p>
                                            )}

                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="inline-flex items-center gap-1 rounded-md border border-transparent bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-neutral-700 dark:text-gray-200">
                                                    <SourceKindIcon kind={kind} size={12} />
                                                    {KIND_BADGE_LABELS[kind]}
                                                </span>
                                                {isCompleted && hasInsights && (
                                                    <span className="inline-flex items-center rounded-md border border-gray-300 px-2 py-0.5 text-xs font-medium dark:border-neutral-600">
                                                        {s.insights_count} insights
                                                    </span>
                                                )}
                                                {isCompleted &&
                                                    topics.slice(0, 2).map((topic) => (
                                                        <span
                                                            key={topic}
                                                            className="inline-flex items-center rounded-md border border-gray-300 px-2 py-0.5 text-xs font-medium dark:border-neutral-600"
                                                        >
                                                            {topic}
                                                        </span>
                                                    ))}
                                                {isCompleted && topics.length > 2 && (
                                                    <span className="inline-flex items-center rounded-md border border-gray-300 px-2 py-0.5 text-xs font-medium dark:border-neutral-600">
                                                        +{topics.length - 2}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div
                                            className="flex items-center gap-1"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <ContextToggle
                                                mode={mode}
                                                hasInsights={hasInsights}
                                                onChange={(m) => onModeChange(s.id, m)}
                                            />
                                            <DropdownButton
                                                title="Source actions"
                                                triggerClassName="invisible !h-8 !w-8 justify-center !px-0 group-hover:visible"
                                                trigger={<LucideMoreVertical size={16} />}
                                                items={[
                                                    {
                                                        label: 'Remove from Notebook',
                                                        icon: <LucideUnlink size={16} />,
                                                        onClick: () => setPendingRemove(s),
                                                    },
                                                    ...(isFailed
                                                        ? [
                                                              {
                                                                  label: 'Retry Processing',
                                                                  icon: <LucideRefreshCw size={16} />,
                                                                  onClick: () => handleRetry(s.id),
                                                                  separatorAbove: true,
                                                              },
                                                          ]
                                                        : kind === 'link' && isCompleted
                                                          ? [
                                                                {
                                                                    label: 'Refresh Content',
                                                                    icon: <LucideRefreshCw size={16} />,
                                                                    onClick: () => handleRetry(s.id),
                                                                    separatorAbove: true,
                                                                },
                                                            ]
                                                          : []),
                                                    {
                                                        label: 'Delete Source',
                                                        icon: <LucideTrash2 size={16} />,
                                                        danger: true,
                                                        onClick: () => setPendingDelete(s),
                                                        separatorAbove: true,
                                                    },
                                                ]}
                                            />
                                        </div>
                                    </div>

                                    {/* Prominent retry action surfaced directly on failed
                                        sources so it's discoverable without opening the menu. */}
                                    {isFailed && (
                                        <div
                                            className="flex gap-2 border-t border-gray-200 pt-2 dark:border-neutral-700"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <button
                                                onClick={() => handleRetry(s.id)}
                                                disabled={isRetrying}
                                                className="inline-flex h-7 items-center rounded-md bg-purple-500 px-3 text-xs font-medium text-white shadow-sm transition-colors hover:bg-purple-600 disabled:pointer-events-none disabled:opacity-50"
                                            >
                                                <LucideRefreshCw
                                                    size={12}
                                                    className={`mr-1 ${isRetrying ? 'animate-spin' : ''}`}
                                                />
                                                {isRetrying ? 'Retrying…' : 'Retry Processing'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {showAdd && (
                <AddSourceDialog
                    notebookId={notebookId}
                    onClose={() => setShowAdd(false)}
                    onCreated={handleCreated}
                />
            )}

            {showAddExisting && (
                <AddExistingSourceDialog
                    notebookId={notebookId}
                    currentSourceIds={new Set(sources.map((s) => s.id))}
                    onClose={() => setShowAddExisting(false)}
                    onAdded={() => fetchSources(false)}
                />
            )}

            {pendingDelete && (
                <ConfirmModal
                    title="Delete Source"
                    message={
                        <span>
                            Are you sure you want to delete{' '}
                            <b>{pendingDelete.title || 'Untitled Source'}</b>? This permanently
                            deletes it from every notebook it belongs to.
                        </span>
                    }
                    confirmLabel={deleting ? 'Deleting…' : 'Delete'}
                    denyLabel="Cancel"
                    onConfirm={confirmDelete}
                    onDeny={() => setPendingDelete(null)}
                />
            )}

            {pendingRemove && (
                <ConfirmModal
                    title="Remove from Notebook"
                    message="Are you sure you want to remove this from the notebook?"
                    confirmLabel={removing ? 'Removing…' : 'Remove'}
                    denyLabel="Cancel"
                    onConfirm={confirmRemove}
                    onDeny={() => setPendingRemove(null)}
                />
            )}
        </PanelShell>
    );
};

const NotesPanel = ({
    notebookId,
    notes,
    onNotesChange,
    contextSelections,
    onModeChange,
    onBulkModeChange,
    onCollapse,
}: {
    notebookId: string;
    notes: Note[];
    onNotesChange: (next: Note[] | ((prev: Note[]) => Note[])) => void;
    contextSelections: Record<string, NoteContextMode>;
    onModeChange: (id: string, mode: NoteContextMode) => void;
    onBulkModeChange: (action: 'include' | 'exclude') => void;
    onCollapse?: () => void;
}) => {
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState<Note | null | undefined>(undefined);
    const [pendingDelete, setPendingDelete] = useState<Note | null>(null);
    const [deleting, setDeleting] = useState<boolean>(false);

    const fetchNotes = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await listNotes(notebookId);
            onNotesChange(data);
        } catch (e: any) {
            setError(e?.message || 'Failed to load notes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchNotes();
    }, [notebookId]);

    const handleSaved = (saved: Note) => {
        onNotesChange((prev) => {
            const exists = prev.some((n) => n.id === saved.id);
            if (exists) return prev.map((n) => (n.id === saved.id ? saved : n));
            return [saved, ...prev];
        });
    };

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        setDeleting(true);
        const ok = await deleteNote(pendingDelete.id);
        setDeleting(false);
        if (!ok) {
            setError(`Couldn't delete "${pendingDelete.title || '(untitled)'}".`);
            setPendingDelete(null);
            return;
        }
        onNotesChange((prev) => prev.filter((n) => n.id !== pendingDelete.id));
        setPendingDelete(null);
    };

    const actions = (
        <>
            {notes.length > 0 && (
                <DropdownButton
                    align="left"
                    title="Bulk context actions"
                    trigger={
                        <>
                            <LucideListChecks size={16} />
                            <LucideChevronDown size={16} />
                        </>
                    }
                    items={[
                        {
                            label: 'Include all in context',
                            onClick: () => onBulkModeChange('include'),
                        },
                        {
                            label: 'Exclude all from context',
                            onClick: () => onBulkModeChange('exclude'),
                        },
                    ]}
                />
            )}
            <button
                onClick={() => setEditing(null)}
                title="Write note"
                className="flex h-8 items-center gap-1.5 rounded-md bg-purple-500 px-3 text-sm font-medium text-white shadow-sm hover:bg-purple-600 transition-colors"
            >
                <LucidePlus size={16} />
                Write Note
            </button>
        </>
    );

    return (
        <PanelShell title="Notes" actions={actions} onCollapse={onCollapse}>
            {loading && (
                <div className="flex items-center justify-center py-8">
                    <LucideLoader2 size={24} className="animate-spin text-gray-400" />
                </div>
            )}

            {!loading && error && (
                <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
            )}

            {!loading && !error && notes.length === 0 && (
                <div className="py-12 text-center">
                    <LucideStickyNote
                        size={48}
                        className="mx-auto mb-4 text-gray-400/60 dark:text-gray-500/60"
                    />
                    <h3 className="mb-2 text-lg font-medium">No notes yet</h3>
                    <p className="mb-4 text-gray-500 dark:text-gray-400">
                        Create your first note to capture insights and observations.
                    </p>
                </div>
            )}

            {!loading && !error && notes.length > 0 && (
                <div className="space-y-3">
                    {notes.map((n) => {
                        const mode = contextSelections[n.id] ?? 'off';
                        const isAi = n.note_type === 'ai';
                        return (
                            <div
                                key={n.id}
                                id={`ref-note-${n.id.split(':')[1]}`}
                                onClick={() => setEditing(n)}
                                className="group relative cursor-pointer rounded-lg border border-gray-200 p-3 transition-shadow hover:shadow-sm dark:border-neutral-700/60"
                            >
                                <div className="mb-2 flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        {isAi ? (
                                            <LucideBot
                                                size={16}
                                                className="flex-none text-purple-600 dark:text-purple-400"
                                            />
                                        ) : (
                                            <LucideUser
                                                size={16}
                                                className="flex-none text-gray-500 dark:text-gray-400"
                                            />
                                        )}
                                        <span className="inline-flex items-center rounded-md border border-transparent bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-neutral-700 dark:text-gray-200">
                                            {isAi ? 'AI Generated' : 'Human'}
                                        </span>
                                    </div>
                                    <div className="flex flex-none items-center gap-2">
                                        {n.updated && (
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                {formatDistanceToNow(n.updated)}
                                            </span>
                                        )}
                                        <div
                                            className="flex items-center gap-0.5"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <ContextToggle mode={mode} onChange={(m) => onModeChange(n.id, m)} />
                                            <DropdownButton
                                                title="Note actions"
                                                triggerClassName="!h-8 !w-8 justify-center !px-0 opacity-0 transition-opacity group-hover:opacity-100"
                                                trigger={<LucideMoreVertical size={16} />}
                                                items={[
                                                    {
                                                        label: 'Delete Note',
                                                        icon: <LucideTrash2 size={16} />,
                                                        danger: true,
                                                        onClick: () => setPendingDelete(n),
                                                    },
                                                ]}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {n.title && (
                                    <h4 className="mb-2 break-all text-sm font-medium" title={n.title}>
                                        {n.title}
                                    </h4>
                                )}

                                {/* Content preview mirrors the reference NotesColumn. The
                                    list endpoint strips note content server-side, so this
                                    renders only when content is present (e.g. AI notes that
                                    include it) and is a graceful no-op otherwise. */}
                                {n.content && (
                                    <p className="line-clamp-3 break-all text-sm text-gray-500 dark:text-gray-400">
                                        {n.content}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {editing !== undefined && (
                <NoteEditorDialog
                    notebookId={notebookId}
                    note={editing}
                    onClose={() => setEditing(undefined)}
                    onSaved={handleSaved}
                />
            )}

            {pendingDelete && (
                <ConfirmModal
                    title="Delete Note"
                    message="Are you sure you want to delete this note? This action cannot be undone."
                    confirmLabel={deleting ? 'Deleting…' : 'Delete'}
                    denyLabel="Cancel"
                    onConfirm={confirmDelete}
                    onDeny={() => setPendingDelete(null)}
                />
            )}
        </PanelShell>
    );
};

export default NotebookDetail;
