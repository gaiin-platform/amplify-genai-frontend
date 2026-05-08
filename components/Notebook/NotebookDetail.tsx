import { useEffect, useState } from 'react';
import {
    IconFileText,
    IconMessageCircle,
    IconNote,
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
import { ConfirmModal } from '@/components/ReusableComponents/ConfirmModal';
import { AddSourceDialog } from './AddSourceDialog';

interface Props {
    notebookId: string;
    initialData?: NotebookSummary;
}

export const NotebookDetail = ({ notebookId, initialData }: Props) => {
    const [notebook, setNotebook] = useState<NotebookSummary | null>(initialData ?? null);
    const [loading, setLoading] = useState<boolean>(!initialData);
    const [error, setError] = useState<string | null>(null);

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
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                        {notebook.source_count ?? 0} sources
                    </span>
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                        {notebook.note_count ?? 0} notes
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <SourcesPanel notebookId={notebookId} />
                <PlaceholderPanel
                    icon={<IconNote size={16} />}
                    accentClass="from-emerald-500 to-teal-500"
                    title="Notes"
                    body="Notes porting coming next."
                />
                <PlaceholderPanel
                    icon={<IconMessageCircle size={16} />}
                    accentClass="from-pink-500 to-rose-500"
                    title="Chat"
                    body="Chat porting coming next."
                />
            </div>
        </div>
    );
};

const PanelShell = ({
    icon,
    accentClass,
    title,
    actions,
    children,
}: {
    icon: React.ReactNode;
    accentClass: string;
    title: string;
    actions?: React.ReactNode;
    children: React.ReactNode;
}) => (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36]">
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-neutral-700">
            <div className={`flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br ${accentClass} text-white shadow-sm`}>
                {icon}
            </div>
            <div className="text-sm font-semibold">{title}</div>
            {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
        </div>
        <div className="p-4">{children}</div>
    </div>
);

const PlaceholderPanel = ({
    icon,
    accentClass,
    title,
    body,
}: {
    icon: React.ReactNode;
    accentClass: string;
    title: string;
    body: string;
}) => (
    <PanelShell icon={icon} accentClass={accentClass} title={title}>
        <div className="text-xs text-gray-500 dark:text-gray-400">{body}</div>
    </PanelShell>
);

const SourcesPanel = ({ notebookId }: { notebookId: string }) => {
    const [sources, setSources] = useState<SourceListItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [showAdd, setShowAdd] = useState<boolean>(false);
    const [pendingDelete, setPendingDelete] = useState<SourceListItem | null>(null);
    const [deleting, setDeleting] = useState<boolean>(false);

    const fetchSources = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await listSources({ notebookId });
            setSources(data);
        } catch (e: any) {
            setError(e?.message || 'Failed to load sources');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSources();
    }, [notebookId]);

    useEffect(() => {
        const stillProcessing = sources.some(
            (s) => !s.embedded && s.status !== 'failed' && s.status !== 'error'
        );
        if (!stillProcessing) return;

        const id = setInterval(() => {
            fetchSources();
        }, 4000);
        return () => clearInterval(id);
    }, [sources]);

    const handleCreated = (created: SourceListItem) => {
        setSources((prev) => [created, ...prev]);
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
        setSources((prev) => prev.filter((s) => s.id !== pendingDelete.id));
        setPendingDelete(null);
    };

    const actions = (
        <>
            <button
                onClick={fetchSources}
                title="Refresh"
                className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white transition-colors"
            >
                <IconRefresh size={14} />
            </button>
            <button
                onClick={() => setShowAdd(true)}
                title="Add source"
                className="flex items-center gap-1 rounded-md bg-purple-600 px-2 py-1 text-xs font-medium text-white shadow-sm hover:bg-purple-700 transition-colors"
            >
                <IconPlus size={12} />
                Add
            </button>
        </>
    );

    return (
        <PanelShell
            icon={<IconFileText size={16} />}
            accentClass="from-purple-500 to-indigo-500"
            title="Sources"
            actions={actions}
        >
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
                    {sources.map((s) => (
                        <li key={s.id} className="group flex items-start gap-2 px-1 py-2">
                            <div className="flex-1 min-w-0">
                                <div className="truncate text-sm font-medium" title={s.title || ''}>
                                    {s.title || '(untitled)'}
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                                    <StatusBadge source={s} />
                                    <span>{s.embedded_chunks} chunks</span>
                                    {s.insights_count > 0 && <span>{s.insights_count} insights</span>}
                                </div>
                            </div>
                            <button
                                onClick={() => setPendingDelete(s)}
                                title="Delete source"
                                className="invisible rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 group-hover:visible dark:hover:bg-red-900/30"
                            >
                                <IconTrash size={14} />
                            </button>
                        </li>
                    ))}
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

const StatusBadge = ({ source }: { source: SourceListItem }) => {
    if (source.embedded) {
        return (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                embedded
            </span>
        );
    }
    const status = source.status || 'processing';
    const cls =
        status === 'failed' || status === 'error'
            ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
            : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    return <span className={`rounded-full px-2 py-0.5 ${cls}`}>{status}</span>;
};

export default NotebookDetail;
