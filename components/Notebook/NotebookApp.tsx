import React, { useContext, useEffect, useState } from 'react';
import {
    IconArchive,
    IconArchiveOff,
    IconArrowLeft,
    IconChevronDown,
    IconLayoutGrid,
    IconList,
    IconNotebook,
    IconSearch,
    IconTrash,
    IconX,
} from '@tabler/icons-react';
import { LucideBook } from './LucideIcons';
import HomeContext from '@/pages/api/home/home.context';
import {
    deleteNotebook,
    getSource,
    listNotebooks,
    NotebookSummary,
    SourceListItem,
    updateNotebook,
} from '@/services/notebookService';
import { ConfirmModal } from '@/components/ReusableComponents/ConfirmModal';
import { AddSourceDialog } from './AddSourceDialog';
import { CreateNotebookDialog } from './CreateNotebookDialog';
import { GeneratePodcastDialog } from './GeneratePodcastDialog';
import { NotebookDetail } from './NotebookDetail';
import { SourceDetailView } from './SourceDetailView';
import { NotebookSidebar, NotebookSection, CreateTarget } from './NotebookSidebar';
import { SourcesPage } from './SourcesPage';
import { AskSearchPage } from './AskSearchPage';
import { PodcastsPage } from './PodcastsPage';
import { TransformationsPage } from './TransformationsPage';
import { SettingsPage } from './SettingsPage';
import { AdvancedPage } from './AdvancedPage';

const SECTION_TITLES: Record<NotebookSection, string> = {
    notebooks: 'Notebooks',
    sources: 'Sources',
    ask: 'Ask and Search',
    podcasts: 'Podcasts',
    transformations: 'Transformations',
    settings: 'Settings',
    advanced: 'Advanced',
};

const SECTION_DESCRIPTIONS: Record<NotebookSection, string> = {
    notebooks: '',
    sources: 'A unified view of every source across your notebooks.',
    ask: 'Run semantic search and ask questions across all your sources and notes.',
    podcasts: 'Generate podcast episodes from your notebook content.',
    transformations: 'Reusable prompts that generate insights, summaries, and rewrites from sources.',
    settings: 'Defaults for content processing, embeddings, and file management.',
    advanced: 'Maintenance tools for power users.',
};

const ComingSoonPanel: React.FC<{ section: NotebookSection }> = ({ section }) => (
    <div className="flex h-full items-center justify-center">
        <div className="max-w-md rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36]">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-sm">
                <IconNotebook size={22} />
            </div>
            <h2 className="text-lg font-semibold">{SECTION_TITLES[section]}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {SECTION_DESCRIPTIONS[section]}
            </p>
        </div>
    </div>
);

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

type ViewMode = 'tile' | 'list';
const VIEW_MODE_KEY = 'amplify.notebook.viewMode';

interface NotebookItemProps {
    notebook: NotebookSummary;
    onOpen: () => void;
    onDelete: () => void;
    onArchiveToggle: () => void;
    archiving: boolean;
}

// Hover actions shared by the tile and list renderings: archive/unarchive + delete.
const NotebookItemActions = ({
    notebook,
    onDelete,
    onArchiveToggle,
    archiving,
}: Pick<NotebookItemProps, 'notebook' | 'onDelete' | 'onArchiveToggle' | 'archiving'>) => (
    <>
        <button
            onClick={(e) => {
                e.stopPropagation();
                onArchiveToggle();
            }}
            disabled={archiving}
            title={notebook.archived ? 'Unarchive notebook' : 'Archive notebook'}
            className="invisible rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 group-hover:visible dark:text-gray-500 dark:hover:bg-neutral-700 dark:hover:text-gray-200"
        >
            {notebook.archived ? <IconArchiveOff size={16} /> : <IconArchive size={16} />}
        </button>
        <button
            onClick={(e) => {
                e.stopPropagation();
                onDelete();
            }}
            title="Delete notebook"
            className="invisible rounded-full p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 group-hover:visible dark:text-gray-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
        >
            <IconTrash size={16} />
        </button>
    </>
);

const NotebookCard = ({ notebook: nb, onOpen, ...actionProps }: NotebookItemProps) => (
    <div
        className="group relative cursor-pointer rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-purple-300 hover:shadow-md dark:border-neutral-700 dark:bg-[#2b2c36] dark:hover:border-purple-500/60"
        onClick={onOpen}
    >
        <div className="absolute top-3 right-3 flex items-center">
            <NotebookItemActions notebook={nb} {...actionProps} />
        </div>

        <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold leading-snug">
                    {nb.name || '(untitled)'}
                </div>
                {nb.description ? (
                    <div className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
                        {nb.description}
                    </div>
                ) : (
                    <div className="mt-1 text-sm italic text-gray-400 dark:text-gray-500">
                        No description
                    </div>
                )}
            </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                {nb.source_count ?? 0} sources
            </span>
            <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                {nb.note_count ?? 0} notes
            </span>
            {nb.updated && (
                <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
                    {formatRelative(nb.updated)}
                </span>
            )}
        </div>
    </div>
);

const NotebookRow = ({ notebook: nb, onOpen, ...actionProps }: NotebookItemProps) => (
    <div
        className="group flex cursor-pointer items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm transition-colors hover:border-purple-300 dark:border-neutral-700 dark:bg-[#2b2c36] dark:hover:border-purple-500/60"
        onClick={onOpen}
    >
        <div className="min-w-0 flex-1">
            <div className="truncate font-medium leading-snug">
                {nb.name || '(untitled)'}
            </div>
            {nb.description && (
                <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                    {nb.description}
                </div>
            )}
        </div>

        <div className="flex flex-none items-center gap-1.5">
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                {nb.source_count ?? 0} sources
            </span>
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                {nb.note_count ?? 0} notes
            </span>
        </div>

        {nb.updated && (
            <span className="hidden w-24 flex-none text-right text-[11px] text-gray-400 sm:block dark:text-gray-500">
                {formatRelative(nb.updated)}
            </span>
        )}

        <div className="flex flex-none items-center">
            <NotebookItemActions notebook={nb} {...actionProps} />
        </div>
    </div>
);

export const NotebookApp = () => {
    const { dispatch } = useContext(HomeContext);

    const [notebooks, setNotebooks] = useState<NotebookSummary[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<NotebookSummary | null>(null);
    const [showCreate, setShowCreate] = useState<boolean>(false);
    const [showAddSource, setShowAddSource] = useState<boolean>(false);
    const [showPodcast, setShowPodcast] = useState<boolean>(false);
    // Bumped after a global create so the target section's page remounts and
    // re-fetches (the pages only load their data on mount).
    const [sourcesRefreshKey, setSourcesRefreshKey] = useState<number>(0);
    const [podcastsRefreshKey, setPodcastsRefreshKey] = useState<number>(0);
    // Source opened from the Sources page — renders the full-page source
    // viewer (content + insights + source-scoped chat) in place of the list.
    const [viewingSource, setViewingSource] = useState<SourceListItem | null>(null);
    const [pendingDelete, setPendingDelete] = useState<NotebookSummary | null>(null);
    const [deleting, setDeleting] = useState<boolean>(false);
    const [section, setSection] = useState<NotebookSection>('notebooks');
    const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [viewMode, setViewMode] = useState<ViewMode>('tile');
    const [archivedOpen, setArchivedOpen] = useState<boolean>(false);
    const [archivingId, setArchivingId] = useState<string | null>(null);
    // Errors from row-level actions (archive/unarchive) shown as a dismissible
    // banner — they must not blank the whole list the way a load error does.
    const [actionError, setActionError] = useState<string | null>(null);

    useEffect(() => {
        const saved = localStorage.getItem(VIEW_MODE_KEY);
        if (saved === 'tile' || saved === 'list') setViewMode(saved);
    }, []);

    const changeViewMode = (mode: ViewMode) => {
        setViewMode(mode);
        localStorage.setItem(VIEW_MODE_KEY, mode);
    };

    const toggleArchive = async (nb: NotebookSummary) => {
        setArchivingId(nb.id);
        setActionError(null);
        const updated = await updateNotebook(nb.id, { archived: !nb.archived });
        setArchivingId(null);
        if (!updated) {
            setActionError(
                `Couldn't ${nb.archived ? 'unarchive' : 'archive'} "${nb.name || '(untitled)'}".`,
            );
            return;
        }
        setNotebooks((prev) =>
            prev.map((n) => (n.id === nb.id ? { ...n, ...updated } : n)),
        );
    };

    const goBackToChat = () => dispatch({ field: 'page', value: 'chat' });
    const goBackToList = () => {
        setSelected(null);
        // Refresh so each card's source/note count (and ordering) reflects any
        // sources/notes added or removed while the detail was open. Background
        // refresh: the loader only shows when the list is empty, so no flicker.
        fetchNotebooks();
    };

    const handleSectionChange = (next: NotebookSection) => {
        setSection(next);
        // Always clear any open notebook/source so a sidebar click lands on the
        // section's home view. In particular, clicking "Notebooks" while a
        // notebook detail is open returns to the list (home), not the
        // currently-open notebook.
        setSelected(null);
        setViewingSource(null);
        // Returning to the notebooks list re-fetches for the same reason as
        // goBackToList — counts may be stale after work in another section.
        if (next === 'notebooks') fetchNotebooks();
    };

    // Clicking a source on the Sources page opens the full-page source viewer
    // (content + insights + a chat scoped to that source), whether or not the
    // source is linked to a notebook — matching open-notebook's sources/[id]
    // page. The list items lack full_text/notebooks, so fetch the full record
    // first; only that fetch failing counts as "couldn't open".
    const handleOpenSourceFromGlobalList = async (source: SourceListItem): Promise<boolean> => {
        const full = await getSource(source.id);
        if (!full) return false;
        setViewingSource(full);
        return true;
    };

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

    const handleCreate = (target: CreateTarget) => {
        if (target === 'notebook') {
            setShowCreate(true);
        } else if (target === 'source') {
            setShowAddSource(true);
        } else if (target === 'podcast') {
            setShowPodcast(true);
        }
    };

    const handleCreated = (created: NotebookSummary) => {
        // Add it to the list and land on the notebooks list — the user opens it
        // by clicking its card (setSelected). Don't auto-navigate into it.
        setNotebooks((prev) => [created, ...prev]);
        setSection('notebooks');
        setSelected(null);
    };

    // Global creates land the user on the section where the result shows up.
    const handleGlobalSourceCreated = () => {
        setSection('sources');
        setSelected(null);
        setViewingSource(null);
        setSourcesRefreshKey((k) => k + 1);
    };

    const handlePodcastSubmitted = () => {
        setSection('podcasts');
        setSelected(null);
        setPodcastsRefreshKey((k) => k + 1);
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

    const isNotebooksSection = section === 'notebooks';
    const viewingSourceDetail = section === 'sources' && !!viewingSource;
    const headerTitle = isNotebooksSection
        ? selected
            ? selected.name || '(untitled)'
            : 'Notebooks'
        : viewingSourceDetail
          ? viewingSource!.title || 'Untitled source'
          : SECTION_TITLES[section];
    const showBackToList = isNotebooksSection && !!selected;
    const showListControls = isNotebooksSection && !selected;

    const filteredNotebooks = searchQuery.trim()
        ? notebooks.filter((nb) => {
              const q = searchQuery.toLowerCase();
              return (
                  (nb.name || '').toLowerCase().includes(q) ||
                  (nb.description || '').toLowerCase().includes(q)
              );
          })
        : notebooks;

    const activeNotebooks = filteredNotebooks.filter((nb) => !nb.archived);
    const archivedNotebooks = filteredNotebooks.filter((nb) => !!nb.archived);

    const renderNotebookGroup = (group: NotebookSummary[]) =>
        viewMode === 'list' ? (
            <div className="flex flex-col gap-2">
                {group.map((nb) => (
                    <NotebookRow
                        key={nb.id}
                        notebook={nb}
                        onOpen={() => setSelected(nb)}
                        onDelete={() => setPendingDelete(nb)}
                        onArchiveToggle={() => toggleArchive(nb)}
                        archiving={archivingId === nb.id}
                    />
                ))}
            </div>
        ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.map((nb) => (
                    <NotebookCard
                        key={nb.id}
                        notebook={nb}
                        onOpen={() => setSelected(nb)}
                        onDelete={() => setPendingDelete(nb)}
                        onArchiveToggle={() => toggleArchive(nb)}
                        archiving={archivingId === nb.id}
                    />
                ))}
            </div>
        );

    return (
        <div className="notebook-app flex flex-1 h-full bg-white dark:bg-[#343541] text-neutral-800 dark:text-neutral-100">
            <NotebookSidebar
                section={section}
                onSection={handleSectionChange}
                onCreate={handleCreate}
                onBack={goBackToChat}
                collapsed={sidebarCollapsed}
                onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
            />
            <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-3 border-b border-gray-200 dark:border-neutral-700 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-[#343541] pl-4 pr-20 py-3">
                {(showBackToList || viewingSourceDetail) && (
                    <button
                        onClick={
                            viewingSourceDetail ? () => setViewingSource(null) : goBackToList
                        }
                        title={viewingSourceDetail ? 'Back to sources' : 'Back to notebooks'}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-neutral-700 dark:hover:text-white transition-colors"
                    >
                        <IconArrowLeft size={20} />
                    </button>
                )}
                <div className="flex flex-col min-w-0">
                    <h1 className="text-base font-semibold leading-tight truncate">
                        {headerTitle}
                    </h1>
                    {isNotebooksSection && selected?.description && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 max-w-xl">
                            {selected.description}
                        </span>
                    )}
                    {!isNotebooksSection && !viewingSourceDetail && SECTION_DESCRIPTIONS[section] && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 max-w-xl">
                            {SECTION_DESCRIPTIONS[section]}
                        </span>
                    )}
                </div>

                {showListControls && (
                    <>
                        <div className="ml-auto flex items-center gap-2">
                            <div className="flex items-center rounded-lg border border-gray-200 p-0.5 dark:border-neutral-700">
                                <button
                                    onClick={() => changeViewMode('tile')}
                                    title="Tile view"
                                    aria-pressed={viewMode === 'tile'}
                                    className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                                        viewMode === 'tile'
                                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                                            : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-neutral-700 dark:hover:text-gray-200'
                                    }`}
                                >
                                    <IconLayoutGrid size={16} />
                                </button>
                                <button
                                    onClick={() => changeViewMode('list')}
                                    title="List view"
                                    aria-pressed={viewMode === 'list'}
                                    className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                                        viewMode === 'list'
                                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                                            : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-neutral-700 dark:hover:text-gray-200'
                                    }`}
                                >
                                    <IconList size={16} />
                                </button>
                            </div>
                            <div className="relative">
                                <IconSearch
                                    size={14}
                                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                                />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search notebooks…"
                                    className="h-8 w-56 rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 dark:border-neutral-700 dark:bg-[#2b2c36] dark:text-gray-100 dark:placeholder-gray-500"
                                />
                            </div>
                            <button
                                onClick={() => setShowCreate(true)}
                                className="group flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 px-3 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/30 active:scale-95"
                            >
                                <LucideBook size={16} />
                                New Notebook
                            </button>
                        </div>
                    </>
                )}
            </div>

            <div className="flex-1 overflow-auto px-6 py-6 bg-neutral-50 dark:bg-[#343541]">
                {section === 'sources' ? (
                    viewingSource ? (
                        <SourceDetailView source={viewingSource} notebooks={notebooks} />
                    ) : (
                        <SourcesPage
                            key={sourcesRefreshKey}
                            onOpenSource={handleOpenSourceFromGlobalList}
                        />
                    )
                ) : section === 'ask' ? (
                    <AskSearchPage />
                ) : section === 'podcasts' ? (
                    <PodcastsPage key={podcastsRefreshKey} />
                ) : section === 'transformations' ? (
                    <TransformationsPage />
                ) : section === 'settings' ? (
                    <SettingsPage />
                ) : section === 'advanced' ? (
                    <AdvancedPage />
                ) : !isNotebooksSection ? (
                    <ComingSoonPanel section={section} />
                ) : selected ? (
                    <NotebookDetail
                        notebookId={selected.id}
                        initialData={selected}
                        onUpdated={(updated) => {
                            setSelected((prev) =>
                                prev && prev.id === updated.id ? { ...prev, ...updated } : prev,
                            );
                            setNotebooks((prev) =>
                                prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n)),
                            );
                        }}
                        onDeleted={(id) => {
                            setNotebooks((prev) => prev.filter((n) => n.id !== id));
                            setSelected(null);
                        }}
                    />
                ) : (
                    <>
                        {loading && notebooks.length === 0 && (
                            <div className="flex items-center justify-center py-20 text-sm text-gray-500 dark:text-gray-400">
                                <svg
                                    className="mr-2 h-4 w-4 animate-spin text-purple-500"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                                    <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                </svg>
                                Loading notebooks…
                            </div>
                        )}

                        {!loading && error && (
                            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                                <div className="font-medium">Couldn&apos;t load notebooks</div>
                                <div className="mt-1 text-sm opacity-80">{error}</div>
                            </div>
                        )}

                        {!loading && !error && notebooks.length === 0 && !searchQuery && (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg">
                                    <IconNotebook size={28} />
                                </div>
                                <h2 className="text-lg font-semibold">No notebooks yet</h2>
                                <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
                                    Create your first notebook to start collecting sources, taking notes,
                                    and chatting with your research.
                                </p>
                            </div>
                        )}

                        {!loading && !error && notebooks.length > 0 && filteredNotebooks.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-400 dark:border-neutral-700 dark:bg-[#2b2c36]">
                                    <IconNotebook size={28} />
                                </div>
                                <h2 className="text-lg font-semibold">No results</h2>
                                <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
                                    No notebooks match &quot;{searchQuery}&quot;.
                                </p>
                            </div>
                        )}

                        {actionError && (
                            <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                                <span className="flex-1">{actionError}</span>
                                <button
                                    onClick={() => setActionError(null)}
                                    title="Dismiss"
                                    className="rounded p-0.5 hover:bg-red-100 dark:hover:bg-red-900/40"
                                >
                                    <IconX size={14} />
                                </button>
                            </div>
                        )}

                        {!loading && !error && filteredNotebooks.length > 0 && (
                            <div className="space-y-8">
                                <section>
                                    <div className="mb-3 flex items-baseline gap-2">
                                        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">
                                            Active Notebooks
                                        </h2>
                                        <span className="text-sm text-gray-400 dark:text-gray-500">
                                            ({activeNotebooks.length})
                                        </span>
                                    </div>
                                    {activeNotebooks.length > 0 ? (
                                        renderNotebookGroup(activeNotebooks)
                                    ) : (
                                        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500 dark:border-neutral-700 dark:bg-neutral-800/40 dark:text-gray-400">
                                            No active notebooks
                                            {searchQuery ? ` match "${searchQuery}"` : ''}.
                                        </div>
                                    )}
                                </section>

                                {archivedNotebooks.length > 0 && (
                                    <section>
                                        <button
                                            onClick={() => setArchivedOpen((v) => !v)}
                                            className="mb-3 flex items-baseline gap-2"
                                        >
                                            <IconChevronDown
                                                size={16}
                                                className={`self-center text-gray-400 transition-transform ${
                                                    archivedOpen ? '' : '-rotate-90'
                                                }`}
                                            />
                                            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">
                                                Archived Notebooks
                                            </h2>
                                            <span className="text-sm text-gray-400 dark:text-gray-500">
                                                ({archivedNotebooks.length})
                                            </span>
                                        </button>
                                        {archivedOpen && renderNotebookGroup(archivedNotebooks)}
                                    </section>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
            </div>

            {showCreate && (
                <CreateNotebookDialog
                    onClose={() => setShowCreate(false)}
                    onCreated={handleCreated}
                />
            )}

            {showAddSource && (
                <AddSourceDialog
                    onClose={() => setShowAddSource(false)}
                    onCreated={handleGlobalSourceCreated}
                />
            )}

            {showPodcast && (
                <GeneratePodcastDialog
                    onClose={() => setShowPodcast(false)}
                    onSubmitted={handlePodcastSubmitted}
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