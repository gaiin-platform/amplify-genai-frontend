import { useEffect, useState } from 'react';
import {
    IconPlus,
    IconRefresh,
    IconTrash,
} from '@tabler/icons-react';
import { getNotebook, NotebookSummary } from '@/services/notebookService';
import {
    deleteSource,
    listSources,
    SourceListItem,
} from '@/services/notebookSourcesService';
import {
    deleteNote,
    listNotes,
    Note,
} from '@/services/notebookNotesService';
import {
    ContextSelections,
    NoteContextMode,
    SourceContextMode,
} from '@/services/notebookChatService';
import { ConfirmModal } from '@/components/ReusableComponents/ConfirmModal';
import { AddSourceDialog } from './AddSourceDialog';
import { NoteEditorDialog } from './NoteEditorDialog';
import { ChatPanel } from './ChatPanel';

interface Props {
    notebookId: string;
    initialData?: NotebookSummary;
}

export const NotebookDetail = ({ notebookId, initialData }: Props) => {
    const [notebook, setNotebook] = useState<NotebookSummary | null>(initialData ?? null);
    const [loading, setLoading] = useState<boolean>(!initialData);
    const [error, setError] = useState<string | null>(null);

    const [sources, setSources] = useState<SourceListItem[]>([]);
    const [notes, setNotes] = useState<Note[]>([]);
    const [contextSelections, setContextSelections] = useState<ContextSelections>({
        sources: {},
        notes: {},
    });

    useEffect(() => {
        // Clear data tied to the previous notebookId so the panels don't
        // briefly render stale sources/notes during the refetch.
        setSources([]);
        setNotes([]);
        setContextSelections({ sources: {}, notes: {} });
    }, [notebookId]);

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

    if (loading) {
        return <div className="text-gray-500 dark:text-gray-400">Loading notebook…</div>;
    }

    if (error || !notebook) {
        return <div className="text-red-600 dark:text-red-400">{error ?? 'Notebook not found.'}</div>;
    }

    return (
        <div className="flex flex-col gap-5">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36]">
                <h2 className="text-xl font-semibold">{notebook.name || '(untitled)'}</h2>
                {notebook.description && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {notebook.description}
                    </p>
                )}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <SourcesPanel
                    notebookId={notebookId}
                    sources={sources}
                    onSourcesChange={setSources}
                    contextSelections={contextSelections.sources}
                    onModeChange={setSourceMode}
                />
                <NotesPanel
                    notebookId={notebookId}
                    notes={notes}
                    onNotesChange={setNotes}
                    contextSelections={contextSelections.notes}
                    onModeChange={setNoteMode}
                />
                <ChatPanel
                    notebookId={notebookId}
                    contextSelections={contextSelections}
                    sources={sources}
                    notes={notes}
                />
            </div>
        </div>
    );
};

const PanelShell = ({
    title,
    actions,
    children,
}: {
    title: string;
    actions?: React.ReactNode;
    children: React.ReactNode;
}) => (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36]">
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-neutral-700">
            <div className="text-sm font-semibold">{title}</div>
            {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
        </div>
        <div className="p-4">{children}</div>
    </div>
);

const SourcesPanel = ({
    notebookId,
    sources,
    onSourcesChange,
    contextSelections,
    onModeChange,
}: {
    notebookId: string;
    sources: SourceListItem[];
    onSourcesChange: (next: SourceListItem[] | ((prev: SourceListItem[]) => SourceListItem[])) => void;
    contextSelections: Record<string, SourceContextMode>;
    onModeChange: (id: string, mode: SourceContextMode) => void;
}) => {
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [showAdd, setShowAdd] = useState<boolean>(false);
    const [pendingDelete, setPendingDelete] = useState<SourceListItem | null>(null);
    const [deleting, setDeleting] = useState<boolean>(false);

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
            <button
                onClick={() => fetchSources(true)}
                title="Refresh"
                className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-neutral-700 dark:hover:text-white transition-colors"
            >
                <IconRefresh size={14} />
            </button>
            <button
                onClick={() => setShowAdd(true)}
                title="Add source"
                className="flex items-center gap-1 rounded-md bg-purple-500 px-2 py-1 text-xs font-medium text-white shadow-sm hover:bg-purple-600 transition-colors"
            >
                <IconPlus size={12} />
                Add
            </button>
        </>
    );

    return (
        <PanelShell title="Sources" actions={actions}>
            {loading && (
                <div className="text-xs text-gray-500 dark:text-gray-400">Loading sources…</div>
            )}

            {!loading && error && (
                <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
            )}

            {!loading && !error && sources.length === 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                    No sources yet. Click <span className="font-medium">Add</span> to ingest a URL or text.
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
                                    <div className="mt-1.5 inline-flex overflow-hidden rounded-md border border-gray-200 text-[10px] dark:border-neutral-600">
                                        <ModeButton
                                            label="off"
                                            active={mode === 'off'}
                                            onClick={() => onModeChange(s.id, 'off')}
                                        />
                                        <ModeButton
                                            label="insights"
                                            active={mode === 'insights'}
                                            disabled={!hasInsights}
                                            title={hasInsights ? '' : 'No insights yet'}
                                            onClick={() => onModeChange(s.id, 'insights')}
                                        />
                                        <ModeButton
                                            label="full"
                                            active={mode === 'full'}
                                            onClick={() => onModeChange(s.id, 'full')}
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={() => setPendingDelete(s)}
                                    title="Delete source"
                                    className="invisible rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 group-hover:visible dark:text-gray-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                                >
                                    <IconTrash size={14} />
                                </button>
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
        </PanelShell>
    );
};

const NotesPanel = ({
    notebookId,
    notes,
    onNotesChange,
    contextSelections,
    onModeChange,
}: {
    notebookId: string;
    notes: Note[];
    onNotesChange: (next: Note[] | ((prev: Note[]) => Note[])) => void;
    contextSelections: Record<string, NoteContextMode>;
    onModeChange: (id: string, mode: NoteContextMode) => void;
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
        <button
            onClick={() => setEditing(null)}
            title="New note"
            className="flex items-center gap-1 rounded-md bg-purple-500 px-2 py-1 text-xs font-medium text-white shadow-sm hover:bg-purple-600 transition-colors"
        >
            <IconPlus size={12} />
            New
        </button>
    );

    return (
        <PanelShell title="Notes" actions={actions}>
            {loading && (
                <div className="text-xs text-gray-500 dark:text-gray-400">Loading notes…</div>
            )}

            {!loading && error && (
                <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
            )}

            {!loading && !error && notes.length === 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                    No notes yet. Click <span className="font-medium">New</span> to write one.
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
                                        <span className="truncate text-sm font-medium" title={n.title || ''}>
                                            {n.title || '(untitled)'}
                                        </span>
                                        {n.note_type === 'ai' && (
                                            <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                                                AI
                                            </span>
                                        )}
                                    </div>
                                    {n.updated && (
                                        <div className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                                            updated {new Date(n.updated.replace(' ', 'T')).toLocaleString()}
                                        </div>
                                    )}
                                    <div
                                        className="mt-1.5 inline-flex overflow-hidden rounded-md border border-gray-200 text-[10px] dark:border-neutral-600"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <ModeButton
                                            label="off"
                                            active={mode === 'off'}
                                            onClick={() => onModeChange(n.id, 'off')}
                                        />
                                        <ModeButton
                                            label="full"
                                            active={mode === 'full'}
                                            onClick={() => onModeChange(n.id, 'full')}
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setPendingDelete(n);
                                    }}
                                    title="Delete note"
                                    className="invisible rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 group-hover:visible dark:text-gray-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                                >
                                    <IconTrash size={14} />
                                </button>
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

const ModeButton = ({
    label,
    active,
    disabled,
    title,
    onClick,
}: {
    label: string;
    active: boolean;
    disabled?: boolean;
    title?: string;
    onClick: () => void;
}) => (
    <button
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`px-2 py-0.5 transition-colors ${
            active
                ? 'bg-purple-500 text-white'
                : 'bg-white text-gray-500 hover:bg-gray-50 dark:bg-[#2b2c36] dark:text-gray-400 dark:hover:bg-neutral-700'
        } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
    >
        {label}
    </button>
);

const StatusBadge = ({ source }: { source: SourceListItem }) => {
    if (source.embedded) return null;
    const status = source.status || 'processing';
    const cls =
        status === 'failed' || status === 'error'
            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    return <span className={`rounded-full px-2 py-0.5 ${cls}`}>{status}</span>;
};

export default NotebookDetail;
