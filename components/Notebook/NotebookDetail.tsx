import { useCallback, useEffect, useRef, useState } from 'react';
import {
    IconArchive,
    IconArchiveOff,
    IconChevronDown,
    IconChevronLeft,
    IconFileText,
    IconLibraryPlus,
    IconListCheck,
    IconNote,
    IconPlus,
    IconRobot,
    IconSparkles,
    IconTrash,
    IconUser,
} from '@tabler/icons-react';
import {
    ContextSelections,
    NoteContextMode,
    Note,
    NotebookSummary,
    SourceContextMode,
    SourceListItem,
    deleteNote,
    deleteNotebook,
    deleteSource,
    getNotebook,
    listNotes,
    listSources,
    updateNotebook,
} from '@/services/notebookService';
import { ConfirmModal } from '@/components/ReusableComponents/ConfirmModal';
import { AddSourceDialog } from './AddSourceDialog';
import { AddExistingSourceDialog } from './AddExistingSourceDialog';
import { ContextToggle } from './ContextToggle';
import { DropdownButton } from './DropdownButton';
import { InlineEditText } from './InlineEditText';
import { NoteEditorDialog } from './NoteEditorDialog';
import { ChatPanel } from './ChatPanel';
import { SourceInsightsDialog } from './SourceInsightsDialog';

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
}

const COLUMNS_KEY = 'amplify.notebook.collapsedColumns';

export const NotebookDetail = ({
    notebookId,
    initialData,
    onUpdated,
    onDeleted,
    focusSourceId,
    onFocusConsumed,
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
        <div className="flex h-full min-h-0 flex-col gap-4">
            <NotebookHeader
                notebook={notebook}
                onChanged={(updated) => {
                    setNotebook((prev) => (prev ? { ...prev, ...updated } : updated));
                    onUpdated?.(updated);
                }}
                onDeleted={() => onDeleted?.(notebook.id)}
            />

            <div className="flex min-h-0 flex-1 flex-col gap-6 max-lg:overflow-y-auto lg:flex-row">
                {collapsed.sources ? (
                    <CollapsedPanel
                        label="Sources"
                        icon={<IconFileText size={18} />}
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
                            onNoteSaved={handleNoteSaved}
                            onCollapse={() => toggleCollapsed('sources')}
                        />
                    </div>
                )}

                {collapsed.notes ? (
                    <CollapsedPanel
                        label="Notes"
                        icon={<IconNote size={18} />}
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

const formatRelative = (iso?: string): string => {
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
    const [deleting, setDeleting] = useState<boolean>(false);

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

    const confirmDelete = async () => {
        setDeleting(true);
        const ok = await deleteNotebook(notebook.id);
        setDeleting(false);
        setConfirmingDelete(false);
        if (!ok) {
            setError("Couldn't delete this notebook.");
            return;
        }
        onDeleted();
    };

    return (
        <div className="flex-none rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36]">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <InlineEditText
                            value={notebook.name || ''}
                            placeholder="(untitled)"
                            className="text-xl font-semibold"
                            onSave={handleRename}
                        />
                        {notebook.archived && (
                            <span className="flex-none rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-neutral-700 dark:text-gray-300">
                                Archived
                            </span>
                        )}
                    </div>
                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        <InlineEditText
                            value={notebook.description || ''}
                            placeholder="Add a description…"
                            multiline
                            onSave={handleDescription}
                        />
                    </div>
                </div>

                <div className="flex flex-none items-center gap-2">
                    <button
                        onClick={handleArchiveToggle}
                        disabled={archiving}
                        className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-neutral-600 dark:bg-[#40414f] dark:text-gray-200 dark:hover:bg-neutral-700"
                    >
                        {notebook.archived ? (
                            <>
                                <IconArchiveOff size={14} />
                                Unarchive
                            </>
                        ) : (
                            <>
                                <IconArchive size={14} />
                                Archive
                            </>
                        )}
                    </button>
                    <button
                        onClick={() => setConfirmingDelete(true)}
                        className="flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                        <IconTrash size={14} />
                        Delete
                    </button>
                </div>
            </div>

            {(notebook.created || notebook.updated) && (
                <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                    {notebook.created && <>Created {formatRelative(notebook.created)}</>}
                    {notebook.created && notebook.updated && ' • '}
                    {notebook.updated && <>Updated {formatRelative(notebook.updated)}</>}
                </div>
            )}

            {error && (
                <div className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</div>
            )}

            {confirmingDelete && (
                <ConfirmModal
                    title="Delete notebook?"
                    message={
                        <span>
                            Delete <b>{notebook.name || '(untitled)'}</b>? This will also remove
                            its sources, notes, and chat sessions. This can&apos;t be undone.
                        </span>
                    }
                    confirmLabel={deleting ? 'Deleting…' : 'Delete'}
                    denyLabel="Cancel"
                    onConfirm={confirmDelete}
                    onDeny={() => setConfirmingDelete(false)}
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
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-gray-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36]">
        <div className="flex flex-none items-center gap-2 border-b border-gray-200 px-6 py-4 dark:border-neutral-700">
            <div className="text-lg font-semibold">{title}</div>
            <div className="ml-auto flex items-center gap-1">
                {actions}
                {onCollapse && (
                    <button
                        onClick={onCollapse}
                        title={`Collapse ${title}`}
                        className="hidden h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-neutral-700 dark:hover:text-white lg:flex"
                    >
                        <IconChevronLeft size={16} />
                    </button>
                )}
            </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
    </div>
);

const SourcesPanel = ({
    notebookId,
    sources,
    onSourcesChange,
    contextSelections,
    onModeChange,
    onBulkModeChange,
    onNoteSaved,
    onCollapse,
}: {
    notebookId: string;
    sources: SourceListItem[];
    onSourcesChange: (next: SourceListItem[] | ((prev: SourceListItem[]) => SourceListItem[])) => void;
    contextSelections: Record<string, SourceContextMode>;
    onModeChange: (id: string, mode: SourceContextMode) => void;
    onBulkModeChange: (action: 'insights' | 'full' | 'exclude') => void;
    onNoteSaved: (note: Note) => void;
    onCollapse?: () => void;
}) => {
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [showAdd, setShowAdd] = useState<boolean>(false);
    const [showAddExisting, setShowAddExisting] = useState<boolean>(false);
    const [pendingDelete, setPendingDelete] = useState<SourceListItem | null>(null);
    const [deleting, setDeleting] = useState<boolean>(false);
    const [insightsFor, setInsightsFor] = useState<SourceListItem | null>(null);

    // Stable identity so it can be safely listed as a useEffect dep in the
    // child dialog. Also a no-op when the count hasn't actually changed to
    // break any feedback loop between the dialog's load effect and this
    // panel's state.
    const handleInsightsCountChange = useCallback(
        (sourceId: string, count: number) => {
            onSourcesChange((prev) => {
                let changed = false;
                const next = prev.map((s) => {
                    if (s.id !== sourceId || s.insights_count === count) return s;
                    changed = true;
                    return { ...s, insights_count: count };
                });
                return changed ? next : prev;
            });
        },
        [onSourcesChange],
    );

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

    const actions = (
        <>
            {sources.length > 0 && (
                <DropdownButton
                    title="Bulk context actions"
                    trigger={
                        <>
                            <IconListCheck size={16} />
                            <IconChevronDown size={14} />
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
                        <IconPlus size={14} />
                        Add Source
                        <IconChevronDown size={14} />
                    </>
                }
                items={[
                    {
                        label: 'Add Source',
                        icon: <IconPlus size={14} />,
                        onClick: () => setShowAdd(true),
                    },
                    {
                        label: 'Add Existing Sources',
                        icon: <IconLibraryPlus size={14} />,
                        onClick: () => setShowAddExisting(true),
                    },
                ]}
            />
        </>
    );

    return (
        <PanelShell title="Sources" actions={actions} onCollapse={onCollapse}>
            {loading && (
                <div className="text-xs text-gray-500 dark:text-gray-400">Loading sources…</div>
            )}

            {!loading && error && (
                <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
            )}

            {!loading && !error && sources.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                    <IconFileText size={40} className="mb-3 text-gray-300 dark:text-neutral-600" />
                    <div className="text-lg font-semibold text-gray-700 dark:text-gray-200">
                        No sources yet
                    </div>
                    <p className="mt-1 max-w-[220px] text-xs text-gray-500 dark:text-gray-400">
                        Add your first source to start building your knowledge base.
                    </p>
                </div>
            )}

            {!loading && !error && sources.length > 0 && (
                <ul className="-mx-1 divide-y divide-gray-100 dark:divide-neutral-700/60">
                    {sources.map((s) => {
                        const isPlaceholderTitle =
                            !s.title || s.title === 'Processing...' || s.title.trim() === '';
                        const displayTitle = isPlaceholderTitle ? '(Untitled)' : s.title!;
                        const mode = contextSelections[s.id] ?? 'off';
                        const hasInsights = s.insights_count > 0;
                        return (
                            <li
                                key={s.id}
                                id={`ref-source-${s.id.split(':')[1]}`}
                                className="group flex items-start gap-2 px-1 py-2"
                            >
                                <div className="flex-1 min-w-0">
                                    <div
                                        className={`truncate text-sm font-medium ${
                                            isPlaceholderTitle ? 'italic text-gray-400 dark:text-gray-500' : ''
                                        }`}
                                        title={s.title || ''}
                                    >
                                        {displayTitle}
                                    </div>
                                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                                        <StatusBadge source={s} />
                                        {s.insights_count > 0 && <span>{s.insights_count} insights</span>}
                                    </div>
                                </div>
                                <div className="flex items-start gap-0.5">
                                    <ContextToggle
                                        mode={mode}
                                        hasInsights={hasInsights}
                                        onChange={(m) => onModeChange(s.id, m)}
                                    />
                                    <button
                                        onClick={() => setInsightsFor(s)}
                                        title={hasInsights ? 'View insights' : 'Generate insights'}
                                        className={`rounded-md p-1 ${
                                            hasInsights
                                                ? 'text-purple-500 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-900/30'
                                                : 'invisible text-gray-400 hover:bg-gray-100 hover:text-purple-600 group-hover:visible dark:text-gray-500 dark:hover:bg-neutral-700 dark:hover:text-purple-300'
                                        }`}
                                    >
                                        <IconSparkles size={14} />
                                    </button>
                                    <button
                                        onClick={() => setPendingDelete(s)}
                                        title="Delete source"
                                        className="invisible rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 group-hover:visible dark:text-gray-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                                    >
                                        <IconTrash size={14} />
                                    </button>
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
                    title="Delete source?"
                    message={
                        <span>
                            Delete <b>{pendingDelete.title || '(untitled)'}</b>? This removes it from
                            the notebook and deletes its embeddings. This can&apos;t be undone.
                        </span>
                    }
                    confirmLabel={deleting ? 'Deleting…' : 'Delete'}
                    denyLabel="Cancel"
                    onConfirm={confirmDelete}
                    onDeny={() => setPendingDelete(null)}
                />
            )}

            {insightsFor && (
                <SourceInsightsDialog
                    notebookId={notebookId}
                    source={insightsFor}
                    onClose={() => setInsightsFor(null)}
                    onInsightsCountChange={handleInsightsCountChange}
                    onNoteSaved={onNoteSaved}
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
                    title="Bulk context actions"
                    trigger={
                        <>
                            <IconListCheck size={16} />
                            <IconChevronDown size={14} />
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
                <IconPlus size={14} />
                Write Note
            </button>
        </>
    );

    return (
        <PanelShell title="Notes" actions={actions} onCollapse={onCollapse}>
            {loading && (
                <div className="text-xs text-gray-500 dark:text-gray-400">Loading notes…</div>
            )}

            {!loading && error && (
                <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
            )}

            {!loading && !error && notes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                    <IconNote size={40} className="mb-3 text-gray-300 dark:text-neutral-600" />
                    <div className="text-lg font-semibold text-gray-700 dark:text-gray-200">
                        No notes yet
                    </div>
                    <p className="mt-1 max-w-[220px] text-xs text-gray-500 dark:text-gray-400">
                        Create your first note to capture insights and observations.
                    </p>
                </div>
            )}

            {!loading && !error && notes.length > 0 && (
                <ul className="-mx-1 divide-y divide-gray-100 dark:divide-neutral-700/60">
                    {notes.map((n) => {
                        const mode = contextSelections[n.id] ?? 'off';
                        return (
                            <li
                                key={n.id}
                                id={`ref-note-${n.id.split(':')[1]}`}
                                className="group flex items-start gap-2 px-1 py-2"
                            >
                                <div
                                    className="flex-1 min-w-0 cursor-pointer"
                                    onClick={() => setEditing(n)}
                                >
                                    <div className="flex items-center gap-1.5">
                                        {n.title && (
                                            <span className="truncate text-sm font-medium" title={n.title}>
                                                {n.title}
                                            </span>
                                        )}
                                        <span
                                            className={`inline-flex flex-none items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] ${
                                                n.note_type === 'ai'
                                                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                                                    : 'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-300'
                                            }`}
                                        >
                                            {n.note_type === 'ai' ? (
                                                <IconRobot size={10} />
                                            ) : (
                                                <IconUser size={10} />
                                            )}
                                            {n.note_type === 'ai' ? 'AI Generated' : 'Human'}
                                        </span>
                                    </div>
                                    {n.updated && (
                                        <div className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                                            updated {new Date(n.updated.replace(' ', 'T')).toLocaleString()}
                                        </div>
                                    )}
                                </div>
                                <div
                                    className="flex items-start gap-0.5"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <ContextToggle mode={mode} onChange={(m) => onModeChange(n.id, m)} />
                                    <button
                                        onClick={() => setPendingDelete(n)}
                                        title="Delete note"
                                        className="invisible rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 group-hover:visible dark:text-gray-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                                    >
                                        <IconTrash size={14} />
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
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
                    title="Delete note?"
                    message={
                        <span>
                            Delete <b>{pendingDelete.title || '(untitled)'}</b>? This can&apos;t be undone.
                        </span>
                    }
                    confirmLabel={deleting ? 'Deleting…' : 'Delete'}
                    denyLabel="Cancel"
                    onConfirm={confirmDelete}
                    onDeny={() => setPendingDelete(null)}
                />
            )}
        </PanelShell>
    );
};

const StatusBadge = ({ source }: { source: SourceListItem }) => {
    if (source.embedded) return null;
    const status = source.status;
    const isFailed = status === 'failed' || status === 'error';
    const label = isFailed ? status : 'Processing';
    const cls = isFailed
        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    return <span className={`rounded-full px-2 py-0.5 ${cls}`}>{label}</span>;
};

export default NotebookDetail;
