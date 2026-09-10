import { useCallback, useEffect, useRef, useState } from 'react';
import {
    LucideAlignLeft,
    LucideArrowDown,
    LucideArrowUp,
    LucideArrowUpDown,
    LucideFileText,
    LucideLink,
    LucideLoader2,
    LucideTrash2,
    LucideUpload,
} from './LucideIcons';
import {
    deleteSource,
    listSources,
    SourceListItem,
    SourceSortField,
} from '@/services/notebookService';
import { ConfirmModal } from '@/components/ReusableComponents/ConfirmModal';
import { formatDistanceToNow } from './relativeTime';

const PAGE_SIZE = 30;

type SortBy = SourceSortField;
type SortOrder = 'asc' | 'desc';

const sourceKind = (s: SourceListItem): 'link' | 'file' | 'text' => {
    if (s.asset?.url) return 'link';
    if (s.asset?.file_path) return 'file';
    return 'text';
};

// Same labels as the reference UI's sources.type.* strings.
const KIND_LABELS: Record<'link' | 'file' | 'text', string> = {
    link: 'Link',
    file: 'File',
    text: 'Text',
};

const KindIcon = ({ kind }: { kind: 'link' | 'file' | 'text' }) => {
    if (kind === 'link') return <LucideLink size={16} />;
    if (kind === 'file') return <LucideUpload size={16} />;
    return <LucideAlignLeft size={16} />;
};

interface Props {
    // Resolves once opening has been attempted. `true` means the caller
    // handled it by navigating to the source viewer (this page unmounts).
    // `false` means it genuinely couldn't be opened (e.g. the source failed
    // to load), so we stay and show an error instead.
    onOpenSource?: (source: SourceListItem) => Promise<boolean>;
}

export const SourcesPage = ({ onOpenSource }: Props) => {
    const [sources, setSources] = useState<SourceListItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [loadingMore, setLoadingMore] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<SortBy>('updated');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [selectedIndex, setSelectedIndex] = useState<number>(0);
    const [pendingDelete, setPendingDelete] = useState<SourceListItem | null>(null);
    const [deleting, setDeleting] = useState<boolean>(false);
    const [openingId, setOpeningId] = useState<string | null>(null);

    const offsetRef = useRef<number>(0);
    const hasMoreRef = useRef<boolean>(true);
    const loadingMoreRef = useRef<boolean>(false);
    const scrollRef = useRef<HTMLDivElement | null>(null);

    const fetchPage = useCallback(
        async (reset: boolean) => {
            if (loadingMoreRef.current) return;
            if (!reset && !hasMoreRef.current) return;
            loadingMoreRef.current = true;
            if (reset) {
                offsetRef.current = 0;
                hasMoreRef.current = true;
                setLoading(true);
            } else {
                setLoadingMore(true);
            }
            setError(null);
            try {
                const data = await listSources({
                    limit: PAGE_SIZE,
                    offset: offsetRef.current,
                    sortBy,
                    sortOrder,
                });
                setSources((prev) => (reset ? data : [...prev, ...data]));
                hasMoreRef.current = data.length === PAGE_SIZE;
                offsetRef.current += data.length;
            } catch (e: any) {
                setError(e?.message || 'Failed to load sources');
            } finally {
                setLoading(false);
                setLoadingMore(false);
                loadingMoreRef.current = false;
            }
        },
        [sortBy, sortOrder],
    );

    useEffect(() => {
        setSelectedIndex(0);
        fetchPage(true);
    }, [fetchPage]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const onScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = el;
            if (scrollHeight - scrollTop - clientHeight < 200) {
                fetchPage(false);
            }
        };
        el.addEventListener('scroll', onScroll);
        return () => el.removeEventListener('scroll', onScroll);
    }, [fetchPage]);

    const scrollToSelectedRow = (index: number) => {
        const container = scrollRef.current;
        if (!container) return;
        const rows = container.querySelectorAll('tbody tr');
        const row = rows[index] as HTMLElement | undefined;
        if (!row) return;
        const containerRect = container.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        if (rowRect.top < containerRect.top) {
            row.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (rowRect.bottom > containerRect.bottom) {
            row.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    };

    const handleRowClick = useCallback(
        async (s: SourceListItem) => {
            if (!onOpenSource || openingId) return;
            setError(null);
            setOpeningId(s.id);
            try {
                const opened = await onOpenSource(s);
                if (!opened) {
                    setError(`Couldn't open "${s.title || 'this source'}". Please try again.`);
                }
            } finally {
                // Reset regardless of outcome: on navigation-away this is a no-op
                // (the page unmounts); on failure it clears the row's
                // spinner/disabled state.
                setOpeningId(null);
            }
        },
        [onOpenSource, openingId],
    );

    // Keyboard navigation matching the reference sources page: arrows move the
    // selection, Enter opens, Home/End jump.
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (sources.length === 0 || pendingDelete) return;
            const target = e.target as HTMLElement | null;
            if (
                target &&
                (target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.isContentEditable)
            ) {
                return;
            }

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex((prev) => {
                        const next = Math.min(prev + 1, sources.length - 1);
                        setTimeout(() => scrollToSelectedRow(next), 0);
                        return next;
                    });
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex((prev) => {
                        const next = Math.max(prev - 1, 0);
                        setTimeout(() => scrollToSelectedRow(next), 0);
                        return next;
                    });
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (sources[selectedIndex]) handleRowClick(sources[selectedIndex]);
                    break;
                case 'Home':
                    e.preventDefault();
                    setSelectedIndex(0);
                    setTimeout(() => scrollToSelectedRow(0), 0);
                    break;
                case 'End': {
                    e.preventDefault();
                    const last = sources.length - 1;
                    setSelectedIndex(last);
                    setTimeout(() => scrollToSelectedRow(last), 0);
                    break;
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [sources, selectedIndex, pendingDelete, handleRowClick]);

    const toggleSort = (field: SortBy) => {
        setSelectedIndex(0);
        if (field === sortBy) {
            setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
    };

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        setDeleting(true);
        const ok = await deleteSource(pendingDelete.id);
        setDeleting(false);
        if (!ok) {
            setError(`Couldn't delete "${pendingDelete.title || 'source'}".`);
            setPendingDelete(null);
            return;
        }
        setSources((prev) => prev.filter((s) => s.id !== pendingDelete.id));
        // offsetRef tracks how many sources we've fetched from the server so
        // the next scroll-triggered page starts where the last one left off.
        // Without decrementing it here, offsetRef stays one ahead of what's
        // actually left on the server after this delete, so the next
        // fetchPage(false) skips exactly one source between the last-loaded
        // item and the first item of the next page.
        offsetRef.current = Math.max(0, offsetRef.current - 1);
        setPendingDelete(null);
    };

    const sortHeader = (field: SortBy, label: string, align: 'left' | 'center' = 'left') => {
        const active = sortBy === field;
        const SortIcon = active
            ? sortOrder === 'asc'
                ? LucideArrowUp
                : LucideArrowDown
            : LucideArrowUpDown;
        return (
            <button
                onClick={() => toggleSort(field)}
                className={`inline-flex h-8 items-center rounded-md px-2 text-sm font-medium transition-colors hover:bg-gray-100 dark:hover:bg-neutral-700 ${
                    align === 'center' ? 'mx-auto' : ''
                }`}
            >
                {label}
                <SortIcon
                    size={12}
                    className={`ml-2 ${active ? 'opacity-100' : 'opacity-30'}`}
                />
            </button>
        );
    };

    if (loading && sources.length === 0) {
        return (
            <div className="flex h-full items-center justify-center">
                <LucideLoader2 size={24} className="animate-spin text-gray-400" />
            </div>
        );
    }

    if (error && sources.length === 0) {
        return (
            <div className="flex h-full items-center justify-center">
                <p className="text-red-500">{error}</p>
            </div>
        );
    }

    if (!loading && sources.length === 0) {
        return (
            <div className="py-12 text-center">
                <LucideFileText
                    size={48}
                    className="mx-auto mb-4 text-gray-400/60 dark:text-gray-500/60"
                />
                <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-gray-100">
                    No sources yet
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                    View all your sources here.
                </p>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col">
            <div
                ref={scrollRef}
                className="flex-1 overflow-auto rounded-md border border-gray-200 bg-white dark:border-neutral-700 dark:bg-[#2b2c36]"
            >
                <table className="w-full min-w-[920px] table-fixed outline-none" tabIndex={0}>
                    <colgroup>
                        <col className="w-[120px]" />
                        <col className="w-auto" />
                        <col className="w-[140px]" />
                        <col className="w-[140px]" />
                        <col className="w-[100px]" />
                        <col className="w-[100px]" />
                        <col className="w-[100px]" />
                    </colgroup>
                    <thead className="sticky top-0 z-10 bg-white dark:bg-[#2b2c36]">
                        <tr className="border-b border-gray-200 bg-gray-50/50 dark:border-neutral-700 dark:bg-neutral-800/50">
                            <th className="h-12 px-4 text-left align-middle font-medium text-gray-500 dark:text-gray-400">
                                {sortHeader('type', 'Type')}
                            </th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-gray-500 dark:text-gray-400">
                                {sortHeader('title', 'Title')}
                            </th>
                            <th className="hidden h-12 px-4 text-left align-middle font-medium text-gray-500 dark:text-gray-400 sm:table-cell">
                                {sortHeader('created', 'Created')}
                            </th>
                            <th className="hidden h-12 px-4 text-left align-middle font-medium text-gray-500 dark:text-gray-400 sm:table-cell">
                                {sortHeader('updated', 'Updated')}
                            </th>
                            <th className="hidden h-12 px-4 text-center align-middle font-medium text-gray-500 dark:text-gray-400 md:table-cell">
                                {sortHeader('insights_count', 'Insights', 'center')}
                            </th>
                            <th className="hidden h-12 px-4 text-center align-middle font-medium text-gray-500 dark:text-gray-400 lg:table-cell">
                                {sortHeader('embedded', 'Embedded', 'center')}
                            </th>
                            <th className="h-12 px-4 text-right align-middle text-sm font-medium text-gray-500 dark:text-gray-400">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sources.map((s, index) => {
                            const kind = sourceKind(s);
                            const isOpening = openingId === s.id;
                            return (
                                <tr
                                    key={s.id}
                                    onClick={() => handleRowClick(s)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    className={`border-b border-gray-200 transition-colors dark:border-neutral-700 ${
                                        onOpenSource ? 'cursor-pointer' : ''
                                    } ${
                                        selectedIndex === index
                                            ? 'bg-gray-100 dark:bg-neutral-700/60'
                                            : 'hover:bg-gray-50 dark:hover:bg-neutral-700/30'
                                    } ${isOpening ? 'opacity-60' : ''}`}
                                >
                                    <td className="h-12 px-4">
                                        <div className="flex items-center gap-2">
                                            <KindIcon kind={kind} />
                                            <span className="inline-flex items-center rounded-md border border-transparent bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-neutral-700 dark:text-gray-200">
                                                {KIND_LABELS[kind]}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="h-12 px-4">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                                                <span className="truncate font-medium">
                                                    {s.title || 'Untitled Source'}
                                                </span>
                                                {s.asset?.url && (
                                                    <span className="truncate text-xs text-gray-500 dark:text-gray-400">
                                                        {s.asset.url}
                                                    </span>
                                                )}
                                            </div>
                                            {isOpening && (
                                                <LucideLoader2
                                                    size={16}
                                                    className="flex-none animate-spin text-gray-400"
                                                />
                                            )}
                                        </div>
                                    </td>
                                    <td className="hidden h-12 px-4 text-sm text-gray-500 dark:text-gray-400 sm:table-cell">
                                        {formatDistanceToNow(s.created)}
                                    </td>
                                    <td className="hidden h-12 px-4 text-sm text-gray-500 dark:text-gray-400 sm:table-cell">
                                        {formatDistanceToNow(s.updated)}
                                    </td>
                                    <td className="hidden h-12 px-4 text-center md:table-cell">
                                        <span className="text-sm font-medium">
                                            {s.insights_count || 0}
                                        </span>
                                    </td>
                                    <td className="hidden h-12 px-4 text-center lg:table-cell">
                                        <span
                                            className={`inline-flex items-center rounded-md border border-transparent px-2 py-0.5 text-xs font-medium ${
                                                s.embedded
                                                    ? 'bg-purple-500 text-white'
                                                    : 'bg-gray-100 text-gray-800 dark:bg-neutral-700 dark:text-gray-200'
                                            }`}
                                        >
                                            {s.embedded ? 'Yes' : 'No'}
                                        </span>
                                    </td>
                                    <td className="h-12 px-4 text-right">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPendingDelete(s);
                                            }}
                                            title="Delete Source"
                                            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-red-600 transition-colors hover:bg-gray-100 dark:text-red-400 dark:hover:bg-neutral-700"
                                        >
                                            <LucideTrash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}

                        {loadingMore && (
                            <tr>
                                <td colSpan={7} className="h-16 text-center">
                                    <div className="flex items-center justify-center">
                                        <LucideLoader2
                                            size={16}
                                            className="animate-spin text-gray-400"
                                        />
                                        <span className="ml-2 text-gray-500 dark:text-gray-400">
                                            Loading more...
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {error && sources.length > 0 && (
                    <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                        {error}
                    </div>
                )}
            </div>

            {pendingDelete && (
                <ConfirmModal
                    title="Delete Source"
                    message={
                        <span>
                            Are you sure you want to delete &quot;
                            <b>{pendingDelete.title || 'Untitled Source'}</b>&quot;?
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

export default SourcesPage;
