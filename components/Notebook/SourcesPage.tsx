import { useCallback, useEffect, useRef, useState } from 'react';
import {
    IconAlignLeft,
    IconArrowsSort,
    IconFileText,
    IconLink,
    IconSearch,
    IconTrash,
    IconUpload,
} from '@tabler/icons-react';
import {
    deleteSource,
    listSources,
    SourceListItem,
} from '@/services/notebookSourcesService';
import { ConfirmModal } from '@/components/ReusableComponents/ConfirmModal';

const PAGE_SIZE = 30;

type SortBy = 'created' | 'updated';
type SortOrder = 'asc' | 'desc';

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

export const SourcesPage = () => {
    const [sources, setSources] = useState<SourceListItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [loadingMore, setLoadingMore] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<SortBy>('updated');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [search, setSearch] = useState<string>('');
    const [pendingDelete, setPendingDelete] = useState<SourceListItem | null>(null);
    const [deleting, setDeleting] = useState<boolean>(false);

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

    const toggleSort = (field: SortBy) => {
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
        setPendingDelete(null);
    };

    const q = search.trim().toLowerCase();
    const filtered = q
        ? sources.filter((s) => {
              const title = (s.title || '').toLowerCase();
              const url = (s.asset?.url || '').toLowerCase();
              return title.includes(q) || url.includes(q);
          })
        : sources;

    return (
        <div className="flex h-full flex-col">
            <div className="mb-4 flex flex-shrink-0 items-center gap-2">
                <div className="relative">
                    <IconSearch
                        size={14}
                        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search sources…"
                        className="h-8 w-64 rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 dark:border-neutral-700 dark:bg-[#2b2c36] dark:text-gray-100 dark:placeholder-gray-500"
                    />
                </div>
                <div className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                    {sources.length} loaded
                </div>
            </div>

            <div
                ref={scrollRef}
                className="flex-1 overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36]"
            >
                <table className="w-full min-w-[760px] table-fixed text-sm">
                    <colgroup>
                        <col className="w-[120px]" />
                        <col className="w-auto" />
                        <col className="w-[140px]" />
                        <col className="w-[100px]" />
                        <col className="w-[110px]" />
                        <col className="w-[80px]" />
                    </colgroup>
                    <thead className="sticky top-0 z-10 bg-gradient-to-b from-gray-50 to-white text-xs uppercase tracking-wide text-gray-500 dark:from-gray-800 dark:to-[#2b2c36] dark:text-gray-400">
                        <tr className="border-b border-gray-200 dark:border-neutral-700">
                            <th className="px-4 py-3 text-left font-medium">Type</th>
                            <th className="px-4 py-3 text-left font-medium">Title</th>
                            <th className="px-4 py-3 text-left font-medium">
                                <button
                                    onClick={() => toggleSort('created')}
                                    className="inline-flex items-center gap-1 hover:text-gray-800 dark:hover:text-gray-200"
                                >
                                    Created
                                    <IconArrowsSort
                                        size={12}
                                        className={sortBy === 'created' ? 'opacity-100' : 'opacity-30'}
                                    />
                                    {sortBy === 'created' && (
                                        <span className="text-[10px]">
                                            {sortOrder === 'asc' ? '↑' : '↓'}
                                        </span>
                                    )}
                                </button>
                            </th>
                            <th className="px-4 py-3 text-center font-medium">Insights</th>
                            <th className="px-4 py-3 text-center font-medium">Embedded</th>
                            <th className="px-4 py-3 text-right font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!loading && !error && filtered.length === 0 && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="h-40 text-center text-sm text-gray-500 dark:text-gray-400"
                                >
                                    {sources.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center gap-1">
                                            <IconFileText size={20} className="opacity-60" />
                                            <div className="font-medium">No sources yet</div>
                                            <div className="text-xs opacity-80">
                                                Add sources from inside a notebook to see them here.
                                            </div>
                                        </div>
                                    ) : (
                                        <>No sources match &quot;{search}&quot;.</>
                                    )}
                                </td>
                            </tr>
                        )}

                        {filtered.map((s) => {
                            const kind = sourceKind(s);
                            return (
                                <tr
                                    key={s.id}
                                    className="border-b border-gray-100 transition-colors hover:bg-purple-50/40 dark:border-neutral-700/60 dark:hover:bg-white/5"
                                >
                                    <td className="px-4 py-3">
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                                            <KindIcon kind={kind} />
                                            {kind}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="truncate font-medium text-gray-800 dark:text-gray-100">
                                                {s.title || 'Untitled'}
                                            </span>
                                            {s.asset?.url && (
                                                <a
                                                    href={s.asset.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="truncate text-xs text-gray-500 hover:text-purple-500 dark:text-gray-400 dark:hover:text-purple-400"
                                                >
                                                    {s.asset.url}
                                                </a>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                                        {formatRelative(s.created)}
                                    </td>
                                    <td className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-200">
                                        {s.insights_count || 0}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span
                                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                                s.embedded
                                                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                                                    : 'bg-neutral-100 text-gray-500 dark:bg-neutral-700 dark:text-gray-400'
                                            }`}
                                        >
                                            {s.embedded ? 'Yes' : 'No'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => setPendingDelete(s)}
                                            title="Delete source"
                                            className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                                        >
                                            <IconTrash size={15} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}

                        {loadingMore && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="h-12 text-center text-xs text-gray-500 dark:text-gray-400"
                                >
                                    Loading more…
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {loading && sources.length === 0 && (
                    <div className="space-y-2 p-4">
                        {[0, 1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="h-10 animate-pulse rounded bg-gray-100 dark:bg-neutral-700/40"
                            />
                        ))}
                    </div>
                )}

                {error && (
                    <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                        <div className="font-medium">Couldn&apos;t load sources</div>
                        <div className="mt-1 text-xs opacity-80">{error}</div>
                    </div>
                )}
            </div>

            {pendingDelete && (
                <ConfirmModal
                    title="Delete source?"
                    message={
                        <span>
                            Delete <b>{pendingDelete.title || 'Untitled'}</b>? This will
                            remove it from every notebook it appears in. This can&apos;t be undone.
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
