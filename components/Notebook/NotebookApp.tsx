import React, { useContext, useEffect, useRef, useState } from 'react';
import { IconArrowLeft, IconNotebook, IconX } from '@tabler/icons-react';
import {
    LucideArchive,
    LucideArchiveRestore,
    LucideBook,
    LucideChevronDown,
    LucideChevronRight,
    LucideFileText,
    LucideLayoutGrid,
    LucideList,
    LucideLoader2,
    LucideMoreHorizontal,
    LucidePlus,
    LucideRefreshCw,
    LucideStickyNote,
    LucideTrash2,
} from './LucideIcons';
import HomeContext from '@/pages/api/home/home.context';
import {
    getSource,
    listNotebooks,
    NotebookSummary,
    SourceListItem,
    updateNotebook,
} from '@/services/notebookService';
import { formatDistanceToNow } from './relativeTime';
import { DropdownButton } from './DropdownButton';
import { NotebookDeleteDialog } from './NotebookDeleteDialog';
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

type ViewMode = 'tile' | 'list';
const VIEW_MODE_KEY = 'amplify.notebook.viewMode';

interface NotebookItemProps {
    notebook: NotebookSummary;
    onOpen: () => void;
    onDelete: () => void;
    onArchiveToggle: () => void;
    archiving: boolean;
}

// Reference's .card-hover: lift + shadow + muted background on hover.
const cardHoverClass =
    'cursor-pointer transition-all duration-200 hover:-translate-y-px hover:bg-gray-50 hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] dark:hover:bg-neutral-700/40 dark:hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)]';

// Count badges matching the reference: outline badge tinted with the primary
// accent, 12px icon + count.
const countBadgeClass =
    'inline-flex items-center gap-1 rounded-md border border-purple-500/50 px-1.5 py-0.5 text-xs font-medium text-purple-600 dark:text-purple-400';

const archivedBadgeClass =
    'inline-flex items-center rounded-md border border-transparent bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-neutral-700 dark:text-gray-200';

// The ⋯ menu shared by the tile and list renderings (reference uses a
// DropdownMenu with MoreHorizontal, revealed on hover).
const NotebookItemMenu = ({
    notebook,
    onDelete,
    onArchiveToggle,
    archiving,
}: Pick<NotebookItemProps, 'notebook' | 'onDelete' | 'onArchiveToggle' | 'archiving'>) => (
    <div className="flex-none" onClick={(e) => e.stopPropagation()}>
        <DropdownButton
            trigger={<LucideMoreHorizontal size={16} />}
            title="Actions"
            triggerClassName="invisible group-hover:visible"
            items={[
                {
                    label: notebook.archived ? 'Unarchive' : 'Archive',
                    icon: notebook.archived ? (
                        <LucideArchiveRestore size={16} />
                    ) : (
                        <LucideArchive size={16} />
                    ),
                    onClick: onArchiveToggle,
                    disabled: archiving,
                },
                {
                    label: 'Delete',
                    icon: <LucideTrash2 size={16} />,
                    onClick: onDelete,
                    danger: true,
                },
            ]}
        />
    </div>
);

const NotebookCard = ({ notebook: nb, onOpen, ...actionProps }: NotebookItemProps) => (
    <div
        onClick={onOpen}
        className={`group rounded-xl border border-gray-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36] ${cardHoverClass}`}
    >
        <div className="p-6 pb-3">
            <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                    {/* leading-tight, not leading-none: `truncate` sets
                        overflow-hidden, and a line-height of exactly 1 clips
                        glyph descenders (g/y/p/j) off the bottom. */}
                    <div className="truncate text-base font-semibold leading-tight transition-colors group-hover:text-purple-600 dark:group-hover:text-purple-400">
                        {nb.name || '(untitled)'}
                    </div>
                    {nb.archived && (
                        <span className={`${archivedBadgeClass} mt-1`}>Archived</span>
                    )}
                </div>
                <NotebookItemMenu notebook={nb} {...actionProps} />
            </div>
        </div>

        <div className="px-6 pb-6">
            <p className="line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
                {nb.description || 'No description'}
            </p>

            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Updated {formatDistanceToNow(nb.updated)}
            </div>

            <div className="mt-3 flex items-center gap-1.5 border-t border-gray-200 pt-3 dark:border-neutral-700">
                <span className={countBadgeClass}>
                    <LucideFileText size={12} />
                    <span>{nb.source_count ?? 0}</span>
                </span>
                <span className={countBadgeClass}>
                    <LucideStickyNote size={12} />
                    <span>{nb.note_count ?? 0}</span>
                </span>
            </div>
        </div>
    </div>
);

const NotebookRow = ({ notebook: nb, onOpen, ...actionProps }: NotebookItemProps) => (
    <div
        onClick={onOpen}
        className={`group flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36] ${cardHoverClass}`}
    >
        <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
                <span className="truncate font-medium transition-colors group-hover:text-purple-600 dark:group-hover:text-purple-400">
                    {nb.name || '(untitled)'}
                </span>
                {nb.archived && <span className={archivedBadgeClass}>Archived</span>}
            </div>
            {nb.description && (
                <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                    {nb.description}
                </p>
            )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
            <span className={countBadgeClass}>
                <LucideFileText size={12} />
                <span>{nb.source_count ?? 0}</span>
            </span>
            <span className={countBadgeClass}>
                <LucideStickyNote size={12} />
                <span>{nb.note_count ?? 0}</span>
            </span>
        </div>

        <div className="hidden w-40 shrink-0 text-right text-xs text-gray-500 dark:text-gray-400 sm:block">
            Updated {formatDistanceToNow(nb.updated)}
        </div>

        <NotebookItemMenu notebook={nb} {...actionProps} />
    </div>
);

export const NotebookApp = () => {
    const { dispatch, state } = useContext(HomeContext);
    // Transformations/Settings/Advanced edit shared, global backend records that
    // apply to every user of the notebook feature — gate them behind the same
    // admin feature flag used elsewhere in the app (e.g. the "Admin" menu) so a
    // non-admin can't change defaults for everyone else.
    const isAdmin = !!state.featureFlags?.adminInterface;

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
    // Tracks the most recently requested source id so a slow `getSource` for a
    // source the user has since navigated away from can't clobber
    // `viewingSource` with the wrong source after a faster, later request
    // resolves first (see handleOpenSourceFromGlobalList).
    const viewingSourceRequestIdRef = useRef<string | null>(null);
    const [pendingDelete, setPendingDelete] = useState<NotebookSummary | null>(null);
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
        // try/finally guarantees archivingId always clears, even if
        // updateNotebook throws instead of resolving to null (its normal
        // failure mode) — without this, an unexpected exception here left
        // archivingId stuck and the Archive button permanently disabled
        // until a full page reload.
        try {
            const updated = await updateNotebook(nb.id, { archived: !nb.archived });
            if (!updated) {
                setActionError(
                    `Couldn't ${nb.archived ? 'unarchive' : 'archive'} "${nb.name || '(untitled)'}".`,
                );
                return;
            }
            setNotebooks((prev) =>
                prev.map((n) => (n.id === nb.id ? { ...n, ...updated } : n)),
            );
        } catch (e: any) {
            setActionError(
                e?.message ||
                    `Couldn't ${nb.archived ? 'unarchive' : 'archive'} "${nb.name || '(untitled)'}".`,
            );
        } finally {
            setArchivingId(null);
        }
    };

    const goBackToChat = () => dispatch({ field: 'page', value: 'chat' });

    const handleSectionChange = (next: NotebookSection) => {
        setSection(next);
        // Always clear any open notebook/source so a sidebar click lands on the
        // section's home view. In particular, clicking "Notebooks" while a
        // notebook detail is open returns to the list (home), not the
        // currently-open notebook.
        setSelected(null);
        setViewingSource(null);
        // Returning to the notebooks list re-fetches so each card's
        // source/note counts (and ordering) reflect work done elsewhere.
        if (next === 'notebooks') fetchNotebooks();
    };

    // Clicking a source on the Sources page opens the full-page source viewer
    // (content + insights + a chat scoped to that source), whether or not the
    // source is linked to a notebook — matching open-notebook's sources/[id]
    // page. The list items lack full_text/notebooks, so fetch the full record
    // first; only that fetch failing counts as "couldn't open".
    const handleOpenSourceFromGlobalList = async (source: SourceListItem): Promise<boolean> => {
        // If the user clicks source A then quickly clicks source B before A's
        // fetch resolves, both `getSource` calls are in flight; without this
        // guard whichever resolves LAST wins and overwrites `viewingSource`,
        // regardless of which source the user most recently clicked — this is
        // exactly what produced citation footers/titles from an unrelated
        // source. Only the request matching the latest click is allowed to
        // apply its result.
        viewingSourceRequestIdRef.current = source.id;
        const full = await getSource(source.id);
        if (viewingSourceRequestIdRef.current !== source.id) return true;
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

    const isNotebooksSection = section === 'notebooks';
    // A source detail can be opened from the global Sources page OR from within
    // an open notebook (via NotebookDetail's onOpenSource), so it's no longer
    // gated to the sources section.
    const viewingSourceDetail = !!viewingSource;
    // True when the open source was reached from inside a notebook — the Back
    // button then returns to that notebook rather than the global sources list.
    const sourceFromNotebook = viewingSourceDetail && isNotebooksSection && !!selected;
    // Views that render their own in-content page header (like the reference
    // pages do) hide the app bar. The global sources list is the only view
    // still using it as its header — both detail views (notebook, source)
    // carry their own title, matching the reference's notebooks/[id] and
    // sources/[id] pages, so showing it there duplicated the name.
    const showAppBar = section === 'sources' && !viewingSourceDetail;

    const isSearching = searchQuery.trim().length > 0;
    // Reference filters by name only.
    const filteredNotebooks = isSearching
        ? notebooks.filter((nb) =>
              (nb.name || '').toLowerCase().includes(searchQuery.trim().toLowerCase()),
          )
        : notebooks;

    const activeNotebooks = filteredNotebooks.filter((nb) => !nb.archived);
    const archivedNotebooks = filteredNotebooks.filter((nb) => !!nb.archived);
    // Archived section shows whenever any archived notebooks exist, even if
    // the current search matches none of them (mirrors the reference).
    const hasArchived = notebooks.some((nb) => !!nb.archived);

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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                isAdmin={isAdmin}
            />
            <div className="flex flex-col flex-1 min-w-0">
            {showAppBar && (
            <div className="flex items-center gap-3 border-b border-gray-200 dark:border-neutral-700 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-[#343541] pl-4 pr-20 py-3">
                <div className="flex flex-col min-w-0">
                    <h1 className="text-base font-semibold leading-tight truncate">
                        {SECTION_TITLES[section]}
                    </h1>
                    {SECTION_DESCRIPTIONS[section] && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 max-w-xl">
                            {SECTION_DESCRIPTIONS[section]}
                        </span>
                    )}
                </div>
            </div>
            )}

            <div className="flex-1 overflow-auto px-6 py-6 bg-neutral-50 dark:bg-[#343541]">
                {viewingSource ? (
                    // A source can be opened from the global Sources page or from
                    // inside a notebook — either way it takes over the content
                    // area, and the in-content Back button clears it (returning
                    // to whichever context it was opened from), mirroring the
                    // reference's sources/[id] page.
                    <div className="flex h-full min-h-0 flex-col">
                        <div className="flex-none pb-4">
                            <button
                                onClick={() => setViewingSource(null)}
                                className="flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-neutral-700 dark:hover:text-white transition-colors"
                            >
                                <IconArrowLeft size={16} />
                                {sourceFromNotebook ? 'Back to Notebook' : 'Back to Sources'}
                            </button>
                        </div>
                        <div className="min-h-0 flex-1">
                            <SourceDetailView
                                source={viewingSource}
                                notebooks={notebooks}
                                onDeleted={() => {
                                    setViewingSource(null);
                                    setSourcesRefreshKey((k) => k + 1);
                                }}
                                onSourceUpdated={setViewingSource}
                            />
                        </div>
                    </div>
                ) : section === 'sources' ? (
                    <SourcesPage
                        key={sourcesRefreshKey}
                        onOpenSource={handleOpenSourceFromGlobalList}
                    />
                ) : section === 'ask' ? (
                    <AskSearchPage onOpenSource={handleOpenSourceFromGlobalList} />
                ) : section === 'podcasts' ? (
                    <PodcastsPage key={podcastsRefreshKey} isAdmin={isAdmin} />
                ) : section === 'transformations' && isAdmin ? (
                    <TransformationsPage />
                ) : section === 'settings' && isAdmin ? (
                    <SettingsPage />
                ) : section === 'advanced' && isAdmin ? (
                    <AdvancedPage />
                ) : !isNotebooksSection ? (
                    <ComingSoonPanel section={section} />
                ) : selected ? (
                    <NotebookDetail
                        notebookId={selected.id}
                        initialData={selected}
                        onOpenSource={handleOpenSourceFromGlobalList}
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
                    <div className="space-y-6">
                        {/* Page header — mirrors the reference notebooks page.
                            pr-12 keeps the controls clear of the floating
                            UserMenu avatar (fixed top-4 right-4). */}
                        <div className="flex items-center justify-between pr-12">
                            <div className="flex items-center gap-4">
                                <h1 className="text-2xl font-bold">Notebooks</h1>
                                <button
                                    onClick={fetchNotebooks}
                                    title="Refresh"
                                    className="inline-flex h-8 items-center justify-center rounded-md border border-gray-300 bg-white px-3 shadow-sm transition-colors hover:bg-gray-50 dark:border-neutral-600 dark:bg-transparent dark:hover:bg-neutral-700"
                                >
                                    <LucideRefreshCw size={16} />
                                </button>
                            </div>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                                <div className="flex items-center rounded-md border border-gray-200 p-0.5 dark:border-neutral-700">
                                    <button
                                        onClick={() => changeViewMode('tile')}
                                        title="Tile view"
                                        aria-pressed={viewMode === 'tile'}
                                        className={`inline-flex h-8 items-center justify-center rounded-md px-3 transition-colors ${
                                            viewMode === 'tile'
                                                ? 'bg-gray-100 text-gray-900 dark:bg-neutral-700 dark:text-gray-100'
                                                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-neutral-700 dark:hover:text-gray-200'
                                        }`}
                                    >
                                        <LucideLayoutGrid size={16} />
                                    </button>
                                    <button
                                        onClick={() => changeViewMode('list')}
                                        title="List view"
                                        aria-pressed={viewMode === 'list'}
                                        className={`inline-flex h-8 items-center justify-center rounded-md px-3 transition-colors ${
                                            viewMode === 'list'
                                                ? 'bg-gray-100 text-gray-900 dark:bg-neutral-700 dark:text-gray-100'
                                                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-neutral-700 dark:hover:text-gray-200'
                                        }`}
                                    >
                                        <LucideList size={16} />
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search notebooks..."
                                    autoComplete="off"
                                    className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm shadow-sm placeholder-gray-400 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 dark:border-neutral-600 dark:bg-[#2b2c36] dark:text-gray-100 dark:placeholder-gray-500 sm:w-64"
                                />
                                <button
                                    onClick={() => setShowCreate(true)}
                                    className="inline-flex h-9 items-center justify-center rounded-md bg-purple-500 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-purple-600"
                                >
                                    <LucidePlus size={16} className="mr-2" />
                                    New Notebook
                                </button>
                            </div>
                        </div>

                        {actionError && (
                            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
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

                        {loading && notebooks.length === 0 ? (
                            <div className="flex items-center justify-center py-12">
                                <LucideLoader2
                                    size={32}
                                    className="animate-spin text-gray-400"
                                />
                            </div>
                        ) : error ? (
                            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                                <div className="font-medium">Couldn&apos;t load notebooks</div>
                                <div className="mt-1 text-sm opacity-80">{error}</div>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {/* Active Notebooks */}
                                {activeNotebooks.length === 0 ? (
                                    <div className="py-12 text-center">
                                        <LucideBook
                                            size={48}
                                            className="mx-auto mb-4 text-gray-400/60 dark:text-gray-500/60"
                                        />
                                        <h3 className="mb-2 text-lg font-medium">
                                            {isSearching ? 'No matches found' : 'No results'}
                                        </h3>
                                        <p className="mb-4 text-gray-500 dark:text-gray-400">
                                            {isSearching
                                                ? 'Try using a different search term.'
                                                : 'Start by creating your first notebook to organize your research.'}
                                        </p>
                                        {!isSearching && (
                                            <button
                                                onClick={() => setShowCreate(true)}
                                                className="mt-4 inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-medium shadow-sm transition-colors hover:bg-gray-50 dark:border-neutral-600 dark:bg-transparent dark:hover:bg-neutral-700"
                                            >
                                                <LucidePlus size={16} className="mr-2" />
                                                New Notebook
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-lg font-semibold">
                                                Active Notebooks
                                            </h2>
                                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                                ({activeNotebooks.length})
                                            </span>
                                        </div>
                                        {renderNotebookGroup(activeNotebooks)}
                                    </div>
                                )}

                                {/* Archived Notebooks */}
                                {hasArchived &&
                                    (archivedNotebooks.length === 0 ? (
                                        <div className="py-12 text-center">
                                            <LucideBook
                                                size={48}
                                                className="mx-auto mb-4 text-gray-400/60 dark:text-gray-500/60"
                                            />
                                            <h3 className="mb-2 text-lg font-medium">
                                                No matches found
                                            </h3>
                                            <p className="mb-4 text-gray-500 dark:text-gray-400">
                                                Try using a different search term.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setArchivedOpen((v) => !v)}
                                                    className="inline-flex h-8 items-center justify-center rounded-md px-3 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-neutral-700 dark:hover:text-gray-200"
                                                >
                                                    {archivedOpen ? (
                                                        <LucideChevronDown size={16} />
                                                    ) : (
                                                        <LucideChevronRight size={16} />
                                                    )}
                                                </button>
                                                <h2 className="text-lg font-semibold">
                                                    Archived Notebooks
                                                </h2>
                                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                                    ({archivedNotebooks.length})
                                                </span>
                                            </div>
                                            {archivedOpen && renderNotebookGroup(archivedNotebooks)}
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
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
                    isAdmin={isAdmin}
                />
            )}

            {pendingDelete && (
                <NotebookDeleteDialog
                    notebookId={pendingDelete.id}
                    notebookName={pendingDelete.name || '(untitled)'}
                    onClose={() => setPendingDelete(null)}
                    onDeleted={() => {
                        setNotebooks((prev) =>
                            prev.filter((nb) => nb.id !== pendingDelete.id),
                        );
                        if (selected?.id === pendingDelete.id) setSelected(null);
                    }}
                />
            )}
        </div>
    );
};

export default NotebookApp;