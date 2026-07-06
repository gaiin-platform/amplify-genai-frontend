import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    IconAlertCircle,
    IconChevronDown,
    IconLoader2,
    IconMessageCircleQuestion,
    IconSearch,
    IconSparkles,
} from '@tabler/icons-react';
import {
    AskRequest,
    ModelDefaults,
    SearchResponse,
    SearchResult,
    SearchType,
    SourceListItem,
    askKnowledgeBaseSimple,
    getDefaults,
    getNote,
    listSources,
    searchKnowledgeBase,
} from '@/services/notebookService';

type Tab = 'ask' | 'search';
type RefType = 'source' | 'note' | 'source_insight';

interface ParsedRef {
    type: RefType;
    id: string;
    startIndex: number;
    endIndex: number;
}

type Segment =
    | { kind: 'text'; text: string }
    | { kind: 'citation'; n: number; type: RefType; id: string };

interface Citation {
    n: number;
    type: RefType;
    id: string;
    label: string;
}

const REF_RE = /(source_insight|note|source):([A-Za-z0-9_]+)/g;

const parseRefs = (text: string): ParsedRef[] => {
    const refs: ParsedRef[] = [];
    REF_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = REF_RE.exec(text)) !== null) {
        refs.push({
            type: m[1] as RefType,
            id: m[2],
            startIndex: m.index,
            endIndex: REF_RE.lastIndex,
        });
    }
    return refs;
};

const renderAnswer = (
    raw: string,
): { segments: Segment[]; orderedRefs: { type: RefType; id: string }[] } => {
    const refs = parseRefs(raw);
    if (refs.length === 0) {
        return { segments: [{ kind: 'text', text: raw }], orderedRefs: [] };
    }

    const order = new Map<string, number>();
    let next = 1;
    for (const r of refs) {
        const key = `${r.type}:${r.id}`;
        if (!order.has(key)) order.set(key, next++);
    }

    const segments: Segment[] = [];
    let pos = 0;
    for (const r of refs) {
        const before = raw.substring(Math.max(0, r.startIndex - 2), r.startIndex);
        const after = raw.substring(r.endIndex, Math.min(raw.length, r.endIndex + 2));
        let from = r.startIndex;
        let to = r.endIndex;
        if (before === '[[' && after.startsWith(']]')) {
            from = r.startIndex - 2;
            to = r.endIndex + 2;
        } else if (before.endsWith('[') && after.startsWith(']')) {
            from = r.startIndex - 1;
            to = r.endIndex + 1;
        }
        if (from > pos) segments.push({ kind: 'text', text: raw.substring(pos, from) });
        const n = order.get(`${r.type}:${r.id}`)!;
        segments.push({ kind: 'citation', n, type: r.type, id: r.id });
        pos = to;
    }
    if (pos < raw.length) segments.push({ kind: 'text', text: raw.substring(pos) });

    const orderedRefs = Array.from(order.entries()).map(([key]) => {
        const [type, id] = key.split(':') as [RefType, string];
        return { type, id };
    });

    return { segments, orderedRefs };
};

const labelForType = (type: RefType): string => {
    if (type === 'source') return 'Source';
    if (type === 'note') return 'Note';
    return 'Insight';
};

const scoreFor = (r: SearchResult): number =>
    r.relevance ?? r.similarity ?? r.score ?? 0;

export const AskSearchPage = () => {
    const [tab, setTab] = useState<Tab>('ask');

    // Shared state
    const [defaults, setDefaults] = useState<ModelDefaults | null>(null);
    const [defaultsLoading, setDefaultsLoading] = useState<boolean>(true);

    // Ask state
    const [question, setQuestion] = useState<string>('');
    const [asking, setAsking] = useState<boolean>(false);
    const [askStatus, setAskStatus] = useState<string | null>(null);
    const [answer, setAnswer] = useState<string | null>(null);
    const [answerCitations, setAnswerCitations] = useState<Citation[]>([]);
    const [askError, setAskError] = useState<string | null>(null);

    // Search state
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [searchType, setSearchType] = useState<SearchType>('text');
    const [searchSources, setSearchSources] = useState<boolean>(true);
    const [searchNotes, setSearchNotes] = useState<boolean>(true);
    const [searching, setSearching] = useState<boolean>(false);
    const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [expandedMatches, setExpandedMatches] = useState<Set<number>>(new Set());

    const askTextareaRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setDefaultsLoading(true);
            const d = await getDefaults();
            if (cancelled) return;
            setDefaults(d);
            setDefaultsLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const hasEmbedding = !!defaults?.default_embedding_model;
    const hasChatModel = !!defaults?.default_chat_model;
    const canAsk = !asking && question.trim().length > 0 && hasChatModel && hasEmbedding;
    const canSearch =
        !searching &&
        searchQuery.trim().length > 0 &&
        (searchSources || searchNotes) &&
        (searchType === 'text' || hasEmbedding);

    const resolveCitations = useCallback(
        async (orderedRefs: { type: RefType; id: string }[]): Promise<Citation[]> => {
            if (orderedRefs.length === 0) return [];

            const needSources = orderedRefs.some((r) => r.type === 'source');
            const sourceById = new Map<string, SourceListItem>();
            if (needSources) {
                const all = await listSources({ limit: 500 });
                for (const s of all) {
                    sourceById.set(s.id, s);
                    const recordId = s.id.includes(':') ? s.id.split(':').slice(1).join(':') : s.id;
                    if (recordId !== s.id) sourceById.set(recordId, s);
                }
            }

            const sourceName = (s: SourceListItem): string =>
                s.title || s.asset?.file_path || s.asset?.url || '(untitled source)';

            const citations: Citation[] = [];
            let n = 1;
            for (const r of orderedRefs) {
                const fullId = `${r.type}:${r.id}`;
                let label = '(untitled)';
                if (r.type === 'source') {
                    const found = sourceById.get(fullId) || sourceById.get(r.id);
                    label = found ? sourceName(found) : '(untitled source)';
                } else if (r.type === 'note') {
                    const note = await getNote(fullId);
                    label = note?.title || '(untitled note)';
                } else {
                    label = 'AI insight';
                }
                citations.push({ n, type: r.type, id: r.id, label });
                n++;
            }
            return citations;
        },
        [],
    );

    const finalizeAnswer = async (text: string) => {
        setAnswer(text);
        try {
            const { orderedRefs } = renderAnswer(text);
            const citations = await resolveCitations(orderedRefs);
            setAnswerCitations(citations);
        } catch {
            // Non-fatal — answer renders without citation labels.
        }
    };

    const handleAsk = async () => {
        if (!canAsk || !defaults?.default_chat_model) return;
        setAsking(true);
        setAskStatus(null);
        setAnswer(null);
        setAnswerCitations([]);
        setAskError(null);

        const params: AskRequest = {
            question: question.trim(),
            strategy_model: defaults.default_chat_model,
            answer_model: defaults.default_chat_model,
            final_answer_model: defaults.default_chat_model,
        };

        // The ask graph runs several sequential model calls server-side;
        // askKnowledgeBaseSimple streams its progress events and rejects with
        // the backend's real error message instead of returning null, so the
        // catch below surfaces the actual cause rather than a config red herring.
        const runAsk = async () => {
            const result = await askKnowledgeBaseSimple(params);
            await finalizeAnswer(result.answer);
        };

        try {
            await runAsk();
        } catch (e: any) {
            setAskError(e?.message || 'Failed to get an answer.');
        } finally {
            setAskStatus(null);
            setAsking(false);
        }
    };

    const handleSearch = async () => {
        if (!canSearch) return;
        setSearching(true);
        setSearchError(null);
        setExpandedMatches(new Set());

        const resp = await searchKnowledgeBase({
            query: searchQuery.trim(),
            type: searchType,
            limit: 100,
            search_sources: searchSources,
            search_notes: searchNotes,
            minimum_score: 0.2,
        });

        if (!resp) {
            setSearching(false);
            setSearchResponse(null);
            setSearchError('Search failed. Try again or check your models.');
            return;
        }

        const sorted: SearchResponse = {
            ...resp,
            results: [...(resp.results || [])].sort((a, b) => scoreFor(b) - scoreFor(a)),
        };
        setSearchResponse(sorted);
        setSearching(false);
    };

    const toggleMatches = (idx: number) => {
        setExpandedMatches((prev) => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    const answerRendered = useMemo(() => (answer ? renderAnswer(answer) : null), [answer]);

    return (
        <div className="mx-auto w-full max-w-4xl space-y-4">
            {/* Mode tabs */}
            <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Choose a mode
                </p>
                <div className="inline-flex w-full max-w-md rounded-lg border border-gray-200 bg-white p-1 shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36]">
                    <button
                        onClick={() => setTab('ask')}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                            tab === 'ask'
                                ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-sm'
                                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-700'
                        }`}
                    >
                        <IconMessageCircleQuestion size={16} />
                        Ask
                    </button>
                    <button
                        onClick={() => setTab('search')}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                            tab === 'search'
                                ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-sm'
                                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-700'
                        }`}
                    >
                        <IconSearch size={16} />
                        Search
                    </button>
                </div>
            </div>

            {tab === 'ask' ? (
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36]">
                    <div className="border-b border-gray-200 px-5 py-4 dark:border-neutral-700">
                        <h2 className="text-base font-semibold">Ask your knowledge base</h2>
                        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                            Ask a question and the assistant will search your sources and notes
                            across notebooks before answering.
                        </p>
                    </div>

                    <div className="space-y-4 p-5">
                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor="ask-question"
                                className="text-sm font-medium text-gray-700 dark:text-gray-200"
                            >
                                Question
                            </label>
                            <textarea
                                id="ask-question"
                                ref={askTextareaRef}
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                onKeyDown={(e) => {
                                    if (
                                        (e.metaKey || e.ctrlKey) &&
                                        e.key === 'Enter' &&
                                        canAsk
                                    ) {
                                        e.preventDefault();
                                        handleAsk();
                                    }
                                }}
                                rows={3}
                                disabled={asking}
                                placeholder="What does my research say about…?"
                                className="resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 disabled:opacity-60 dark:border-neutral-600 dark:bg-[#40414f] dark:text-gray-100 dark:placeholder-gray-500"
                            />
                            <p className="text-[11px] text-gray-400 dark:text-gray-500">
                                Press ⌘/Ctrl + Enter to submit.
                            </p>
                        </div>

                        {!defaultsLoading && !hasEmbedding && (
                            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
                                <IconAlertCircle size={16} className="mt-0.5 flex-none" />
                                <span>
                                    Ask requires a default embedding model. Configure one on the
                                    Models page first.
                                </span>
                            </div>
                        )}
                        {!defaultsLoading && hasEmbedding && !hasChatModel && (
                            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
                                <IconAlertCircle size={16} className="mt-0.5 flex-none" />
                                <span>
                                    Ask requires a default chat model. Configure one on the
                                    Models page first.
                                </span>
                            </div>
                        )}

                        <button
                            onClick={handleAsk}
                            disabled={!canAsk}
                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {asking ? (
                                <>
                                    <IconLoader2 size={16} className="animate-spin" />
                                    {askStatus || 'Thinking…'}
                                </>
                            ) : (
                                <>
                                    <IconSparkles size={16} />
                                    Ask
                                </>
                            )}
                        </button>

                        {askError && (
                            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                                <IconAlertCircle size={16} className="mt-0.5 flex-none" />
                                <span>{askError}</span>
                            </div>
                        )}

                        {answerRendered && (
                            <div className="space-y-3 rounded-lg border border-purple-200 bg-purple-50/50 p-4 dark:border-purple-700/50 dark:bg-purple-900/10">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">
                                    Answer
                                </div>
                                <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-100">
                                    {answerRendered.segments.map((seg, i) =>
                                        seg.kind === 'text' ? (
                                            <span key={i}>{seg.text}</span>
                                        ) : (
                                            <span
                                                key={i}
                                                title={`${labelForType(seg.type)} ${seg.id}`}
                                                className="mx-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-purple-500/20 px-1.5 text-[11px] font-semibold text-purple-700 dark:bg-purple-400/20 dark:text-purple-200"
                                            >
                                                {seg.n}
                                            </span>
                                        ),
                                    )}
                                </div>

                                {answerCitations.length > 0 && (
                                    <div className="border-t border-purple-200/60 pt-3 dark:border-purple-700/40">
                                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">
                                            Sources cited
                                        </div>
                                        <ol className="space-y-1 text-sm">
                                            {answerCitations.map((c) => (
                                                <li
                                                    key={`${c.type}-${c.id}`}
                                                    className="flex items-start gap-2 text-gray-700 dark:text-gray-200"
                                                >
                                                    <span className="mt-0.5 inline-flex h-5 min-w-[20px] flex-none items-center justify-center rounded-full bg-purple-500/20 px-1.5 text-[11px] font-semibold text-purple-700 dark:bg-purple-400/20 dark:text-purple-200">
                                                        {c.n}
                                                    </span>
                                                    <span className="truncate">
                                                        <span className="text-gray-400 dark:text-gray-500">
                                                            {labelForType(c.type)}:
                                                        </span>{' '}
                                                        {c.label}
                                                    </span>
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36]">
                    <div className="border-b border-gray-200 px-5 py-4 dark:border-neutral-700">
                        <h2 className="text-base font-semibold">Search</h2>
                        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                            Find sources and notes by keyword or semantic similarity.
                        </p>
                    </div>

                    <div className="space-y-4 p-5">
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && canSearch) {
                                        e.preventDefault();
                                        handleSearch();
                                    }
                                }}
                                disabled={searching}
                                placeholder="Search across sources and notes…"
                                className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 disabled:opacity-60 dark:border-neutral-600 dark:bg-[#40414f] dark:text-gray-100 dark:placeholder-gray-500"
                            />
                            <button
                                onClick={handleSearch}
                                disabled={!canSearch}
                                className="flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {searching ? (
                                    <IconLoader2 size={16} className="animate-spin" />
                                ) : (
                                    <IconSearch size={16} />
                                )}
                                Search
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-200">
                                    Search type
                                </p>
                                <div className="flex flex-col gap-1.5 text-sm">
                                    <label className="flex cursor-pointer items-center gap-2 text-gray-700 dark:text-gray-200">
                                        <input
                                            type="radio"
                                            name="search-type"
                                            checked={searchType === 'text'}
                                            onChange={() => setSearchType('text')}
                                            disabled={searching}
                                            className="text-purple-600"
                                        />
                                        Text
                                    </label>
                                    <label
                                        className={`flex items-center gap-2 ${
                                            hasEmbedding
                                                ? 'cursor-pointer text-gray-700 dark:text-gray-200'
                                                : 'cursor-not-allowed text-gray-400 dark:text-gray-500'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="search-type"
                                            checked={searchType === 'vector'}
                                            onChange={() => setSearchType('vector')}
                                            disabled={!hasEmbedding || searching}
                                            className="text-purple-600"
                                        />
                                        Vector (semantic)
                                    </label>
                                </div>
                                {!hasEmbedding && !defaultsLoading && (
                                    <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                                        <IconAlertCircle size={12} />
                                        Vector search needs a default embedding model.
                                    </p>
                                )}
                            </div>

                            <div>
                                <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-200">
                                    Search in
                                </p>
                                <div className="flex flex-col gap-1.5 text-sm">
                                    <label className="flex cursor-pointer items-center gap-2 text-gray-700 dark:text-gray-200">
                                        <input
                                            type="checkbox"
                                            checked={searchSources}
                                            onChange={(e) => setSearchSources(e.target.checked)}
                                            disabled={searching}
                                            className="text-purple-600"
                                        />
                                        Sources
                                    </label>
                                    <label className="flex cursor-pointer items-center gap-2 text-gray-700 dark:text-gray-200">
                                        <input
                                            type="checkbox"
                                            checked={searchNotes}
                                            onChange={(e) => setSearchNotes(e.target.checked)}
                                            disabled={searching}
                                            className="text-purple-600"
                                        />
                                        Notes
                                    </label>
                                </div>
                            </div>
                        </div>

                        {searchError && (
                            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                                <IconAlertCircle size={16} className="mt-0.5 flex-none" />
                                <span>{searchError}</span>
                            </div>
                        )}

                        {searchResponse && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                        {searchResponse.total_count} result
                                        {searchResponse.total_count === 1 ? '' : 's'}
                                    </h3>
                                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-gray-600 dark:bg-neutral-700 dark:text-gray-300">
                                        {searchResponse.search_type}
                                    </span>
                                </div>

                                {searchResponse.results.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500 dark:border-neutral-700 dark:bg-neutral-800/40 dark:text-gray-400">
                                        No results for &quot;{searchQuery}&quot;.
                                    </div>
                                ) : (
                                    <ul className="space-y-2">
                                        {searchResponse.results.map((r, idx) => {
                                            if (!r.parent_id) return null;
                                            const [type] = r.parent_id.split(':');
                                            const expanded = expandedMatches.has(idx);
                                            const matches = (r.matches || []) as string[];
                                            const matchCount = matches.length;
                                            return (
                                                <li
                                                    key={`${r.parent_id}-${idx}`}
                                                    className="rounded-lg border border-gray-200 bg-white p-3 transition-colors hover:border-purple-300 dark:border-neutral-700 dark:bg-[#343541] dark:hover:border-purple-500/60"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                                                                {r.title || '(untitled)'}
                                                            </div>
                                                            <div className="mt-0.5 text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                                                {type === 'source_insight'
                                                                    ? 'Insight'
                                                                    : type === 'note'
                                                                    ? 'Note'
                                                                    : 'Source'}
                                                            </div>
                                                        </div>
                                                        <span className="flex-none rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                                                            {scoreFor(r).toFixed(2)}
                                                        </span>
                                                    </div>

                                                    {matchCount > 0 && (
                                                        <div className="mt-2">
                                                            <button
                                                                onClick={() => toggleMatches(idx)}
                                                                className="flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                                                            >
                                                                <IconChevronDown
                                                                    size={14}
                                                                    className={`transition-transform ${
                                                                        expanded ? 'rotate-180' : ''
                                                                    }`}
                                                                />
                                                                {matchCount} match
                                                                {matchCount === 1 ? '' : 'es'}
                                                            </button>
                                                            {expanded && (
                                                                <div className="mt-2 space-y-1">
                                                                    {matches.map((m, i) => (
                                                                        <div
                                                                            key={i}
                                                                            className="border-l-2 border-purple-300 pl-3 text-[13px] text-gray-700 dark:border-purple-600 dark:text-gray-200"
                                                                        >
                                                                            {typeof m === 'string'
                                                                                ? m
                                                                                : (m as any)
                                                                                      ?.text || ''}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AskSearchPage;
