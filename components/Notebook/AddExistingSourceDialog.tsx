import { useEffect, useMemo, useRef, useState } from 'react';
import {
    IconAlignLeft,
    IconFileText,
    IconLink,
    IconLoader2,
    IconSearch,
    IconUpload,
} from '@tabler/icons-react';
import { Modal } from '@/components/ReusableComponents/Modal';
import {
    SourceListItem,
    addSourceToNotebook,
    listSources,
    searchKnowledgeBase,
} from '@/services/notebookService';

interface Props {
    notebookId: string;
    // Sources already linked to this notebook — checked and disabled in the
    // list so they can't be "added" twice.
    currentSourceIds: Set<string>;
    onClose: () => void;
    // Called once after the selected sources have all been linked, so the
    // caller can refetch the notebook's own source list.
    onAdded: () => void;
}

const PAGE_LIMIT = 100;
const SEARCH_DEBOUNCE_MS = 300;

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

const formatDate = (iso?: string): string => {
    if (!iso) return '';
    const d = new Date(iso.replace(' ', 'T'));
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
};

// Lets a user pull a source that's already been ingested elsewhere into this
// notebook, instead of re-uploading/re-processing it — the inverse of
// AddSourceDialog, which only ever creates brand-new sources. Mirrors
// open-notebook's AddExistingSourceDialog: search-or-browse, multi-select,
// already-linked sources shown but disabled.
export const AddExistingSourceDialog = ({
    notebookId,
    currentSourceIds,
    onClose,
    onAdded,
}: Props) => {
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [sources, setSources] = useState<SourceListItem[]>([]);
    const [allSources, setAllSources] = useState<SourceListItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const requestSeq = useRef(0);

    useEffect(() => {
        const id = window.setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(id);
    }, [query]);

    // Unfiltered list, loaded once — reused as the base for an empty query so
    // clearing the search box doesn't require a round-trip.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            const data = await listSources({
                limit: PAGE_LIMIT,
                offset: 0,
                sortBy: 'created',
                sortOrder: 'desc',
            });
            if (cancelled) return;
            setAllSources(data);
            setSources(data);
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!debouncedQuery) {
            setSources(allSources);
            return;
        }
        const seq = ++requestSeq.current;
        setLoading(true);
        (async () => {
            const result = await searchKnowledgeBase({
                query: debouncedQuery,
                type: 'text',
                search_sources: true,
                search_notes: false,
                limit: PAGE_LIMIT,
                minimum_score: 0.01,
            });
            if (seq !== requestSeq.current) return; // stale response
            const mapped: SourceListItem[] = (result?.results || [])
                .filter((r) => !!r.parent_id)
                .map((r) => ({
                    id: r.parent_id as string,
                    title: r.title,
                    asset: null,
                    embedded: false,
                    embedded_chunks: 0,
                    insights_count: 0,
                    created: (r.created as string) || '',
                    updated: (r.updated as string) || '',
                }));
            setSources(mapped);
            setLoading(false);
        })();
    }, [debouncedQuery, allSources]);

    const toggle = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectedCount = selected.size;

    const handleSubmit = async () => {
        if (selectedCount === 0 || submitting) return;
        setSubmitting(true);
        setError(null);

        const ids = Array.from(selected);
        const results = await Promise.all(ids.map((id) => addSourceToNotebook(notebookId, id)));
        const failures = results.filter((ok) => !ok).length;

        setSubmitting(false);

        if (failures > 0 && failures === ids.length) {
            setError(`Couldn't add ${failures === 1 ? 'that source' : 'those sources'}.`);
            return;
        }
        if (failures > 0) {
            setError(`Added ${ids.length - failures} of ${ids.length} sources — some failed.`);
        }

        onAdded();
        if (failures === 0) onClose();
    };

    const truncated = !debouncedQuery && allSources.length >= PAGE_LIMIT;

    const content = (
        <div className="flex h-full flex-col gap-3 p-2 text-neutral-800 dark:text-neutral-100">
            <p className="text-sm text-gray-500 dark:text-gray-400">
                Select existing sources from across all your notebooks to add to the current one.
            </p>

            <div className="relative">
                <IconSearch
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                    type="text"
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search sources by name or URL…"
                    className="w-full rounded border border-neutral-300 bg-white py-2 pl-9 pr-8 text-sm dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100"
                />
                {loading && (
                    <IconLoader2
                        size={14}
                        className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400"
                    />
                )}
            </div>

            <div className="-mr-2 min-h-0 flex-1 overflow-y-auto rounded-md border border-gray-200 pr-2 dark:border-neutral-700">
                {loading && sources.length === 0 ? (
                    <div className="flex h-40 flex-col items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
                        <IconLoader2 size={28} className="animate-spin" />
                        <span className="text-sm">Loading…</span>
                    </div>
                ) : sources.length === 0 ? (
                    <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-gray-500 dark:text-gray-400">
                        <IconFileText size={32} className="opacity-50" />
                        <span className="text-sm">No sources found.</span>
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-100 p-2 dark:divide-neutral-700/60">
                        {sources.map((s) => {
                            const isLinked = currentSourceIds.has(s.id);
                            const isSelected = selected.has(s.id);
                            const kind = sourceKind(s);
                            return (
                                <li key={s.id}>
                                    <label
                                        className={`flex cursor-pointer items-start gap-3 rounded-lg p-2.5 transition-colors ${
                                            isLinked
                                                ? 'cursor-not-allowed opacity-60'
                                                : isSelected
                                                  ? 'bg-purple-50 dark:bg-purple-900/20'
                                                  : 'hover:bg-gray-50 dark:hover:bg-neutral-700/40'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected || isLinked}
                                            disabled={isLinked}
                                            onChange={() => toggle(s.id)}
                                            className="mt-1 h-3.5 w-3.5 flex-none accent-purple-500"
                                        />
                                        <span className="mt-0.5 flex-none text-gray-400 dark:text-gray-500">
                                            <KindIcon kind={kind} />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-start gap-2">
                                                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                                    {s.title || 'Untitled'}
                                                </span>
                                                {isLinked && (
                                                    <span className="flex-none rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                                                        Linked
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                                                Added on {formatDate(s.created)}
                                            </p>
                                        </div>
                                    </label>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {truncated && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Showing the first {PAGE_LIMIT} sources. Search to narrow the list.
                </p>
            )}

            {selectedCount > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    {selectedCount} source{selectedCount === 1 ? '' : 's'} selected
                </p>
            )}

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
    );

    return (
        <Modal
            title="Add Existing Sources"
            onCancel={onClose}
            onSubmit={handleSubmit}
            submitLabel={
                submitting ? 'Adding…' : `Add Selected${selectedCount > 0 ? ` (${selectedCount})` : ''}`
            }
            disableSubmit={selectedCount === 0 || submitting}
            width={() => 560}
            height={() => 620}
            content={content}
        />
    );
};

export default AddExistingSourceDialog;
