import { useContext, useEffect, useState } from 'react';
import {
    IconArrowLeft,
    IconNotebook,
    IconPlus,
    IconTrash,
} from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import {
    deleteNotebook,
    listNotebooks,
    NotebookSummary,
} from '@/services/notebookService';
import { ConfirmModal } from '@/components/ReusableComponents/ConfirmModal';
import { CreateNotebookDialog } from './CreateNotebookDialog';
import { NotebookDetail } from './NotebookDetail';

const AVATAR_GRADIENTS = [
    'from-purple-500 to-indigo-500',
    'from-fuchsia-500 to-purple-500',
    'from-blue-500 to-purple-500',
    'from-pink-500 to-purple-500',
    'from-violet-500 to-fuchsia-500',
    'from-indigo-500 to-blue-500',
];

const gradientFor = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
};

const initialsOf = (name?: string) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatRelative = (iso?: string) => {
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

export const NotebookApp = () => {
    const { dispatch } = useContext(HomeContext);

    const [notebooks, setNotebooks] = useState<NotebookSummary[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<NotebookSummary | null>(null);
    const [showCreate, setShowCreate] = useState<boolean>(false);
    const [pendingDelete, setPendingDelete] = useState<NotebookSummary | null>(null);
    const [deleting, setDeleting] = useState<boolean>(false);

    const goBackToChat = () => dispatch({ field: 'page', value: 'chat' });
    const goBackToList = () => setSelected(null);

    const fetchNotebooks = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await listNotebooks({ order_by: 'updated desc' });
            setNotebooks(data);
        } catch (e: any) {
            setError(e?.message || 'Failed to load notebooks');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotebooks();
    }, []);

    const handleCreated = (created: NotebookSummary) => {
        setNotebooks((prev) => [created, ...prev]);
        setSelected(created);
    };

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        setDeleting(true);
        const ok = await deleteNotebook(pendingDelete.id);
        setDeleting(false);
        if (!ok) {
            setError(`Couldn't delete "${pendingDelete.name}".`);
            setPendingDelete(null);
            return;
        }
        setNotebooks((prev) => prev.filter((nb) => nb.id !== pendingDelete.id));
        if (selected?.id === pendingDelete.id) setSelected(null);
        setPendingDelete(null);
    };

    return (
        <div className="flex flex-col flex-1 h-full bg-white dark:bg-[#343541] text-neutral-800 dark:text-neutral-100">
            <div className="flex items-center gap-3 border-b border-gray-200 dark:border-neutral-700 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-[#343541] pl-4 pr-20 py-3">
                <button
                    onClick={selected ? goBackToList : goBackToChat}
                    title={selected ? 'Back to notebooks' : 'Back to chat'}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white transition-colors"
                >
                    <IconArrowLeft size={20} />
                </button>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-sm">
                    <IconNotebook size={18} />
                </div>
                <div className="flex flex-col min-w-0">
                    <h1 className="text-base font-semibold leading-tight truncate">
                        {selected ? selected.name || '(untitled)' : 'Notebooks'}
                    </h1>
                    {!selected && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            {notebooks.length} {notebooks.length === 1 ? 'notebook' : 'notebooks'}
                        </span>
                    )}
                    {selected?.description && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 max-w-xl">
                            {selected.description}
                        </span>
                    )}
                </div>

            </div>

            <div className="flex-1 overflow-auto px-6 py-6 bg-neutral-50 dark:bg-[#343541]">
                {selected ? (
                    <NotebookDetail notebookId={selected.id} initialData={selected} />
                ) : (
                    <>
                        {loading && (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {[0, 1, 2].map((i) => (
                                    <div
                                        key={i}
                                        className="h-36 animate-pulse rounded-xl border border-gray-200 bg-white dark:border-neutral-700 dark:bg-[#2b2c36]"
                                    />
                                ))}
                            </div>
                        )}

                        {!loading && error && (
                            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                                <div className="font-medium">Couldn&apos;t load notebooks</div>
                                <div className="mt-1 text-sm opacity-80">{error}</div>
                            </div>
                        )}

                        {!loading && !error && notebooks.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg">
                                    <IconNotebook size={28} />
                                </div>
                                <h2 className="text-lg font-semibold">No notebooks yet</h2>
                                <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
                                    Create your first notebook to start collecting sources, taking notes,
                                    and chatting with your research.
                                </p>
                                <button
                                    onClick={() => setShowCreate(true)}
                                    className="mt-5 flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-700 transition-all duration-200"
                                >
                                    <IconPlus size={16} />
                                    Create notebook
                                </button>
                            </div>
                        )}

                        {!loading && !error && notebooks.length > 0 && (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {notebooks.map((nb) => (
                                    <div
                                        key={nb.id}
                                        className="group relative cursor-pointer rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-purple-300 hover:shadow-md dark:border-neutral-700 dark:bg-[#2b2c36] dark:hover:border-purple-500/60"
                                        onClick={() => setSelected(nb)}
                                    >
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPendingDelete(nb);
                                            }}
                                            title="Delete notebook"
                                            className="absolute top-2 right-2 invisible rounded-full p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 group-hover:visible dark:hover:bg-red-900/30"
                                        >
                                            <IconTrash size={16} />
                                        </button>

                                        <div className="flex items-start gap-3">
                                            <div
                                                className={`flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-gradient-to-br ${gradientFor(
                                                    nb.id,
                                                )} text-sm font-semibold text-white shadow-sm`}
                                            >
                                                {initialsOf(nb.name)}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate font-semibold leading-snug">
                                                    {nb.name || '(untitled)'}
                                                </div>
                                                {nb.description ? (
                                                    <div className="mt-0.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                                                        {nb.description}
                                                    </div>
                                                ) : (
                                                    <div className="mt-0.5 text-xs italic text-gray-400 dark:text-gray-500">
                                                        No description
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-4 flex flex-wrap items-center gap-1.5">
                                            <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                                {nb.source_count ?? 0} sources
                                            </span>
                                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                                {nb.note_count ?? 0} notes
                                            </span>
                                            {nb.updated && (
                                                <span className="ml-auto text-[11px] text-gray-400 dark:text-gray-500">
                                                    {formatRelative(nb.updated)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {!selected && !loading && (
                <button
                    onClick={() => setShowCreate(true)}
                    title="New notebook"
                    className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 px-5 py-3 text-sm font-medium text-white shadow-lg hover:shadow-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-200"
                >
                    <IconPlus size={18} />
                    New notebook
                </button>
            )}

            {showCreate && (
                <CreateNotebookDialog
                    onClose={() => setShowCreate(false)}
                    onCreated={handleCreated}
                />
            )}

            {pendingDelete && (
                <ConfirmModal
                    title="Delete notebook?"
                    message={
                        <span>
                            Delete <b>{pendingDelete.name || '(untitled)'}</b>? This will also remove
                            its sources, notes, and chat sessions. This can&apos;t be undone.
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

export default NotebookApp;
