import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { MemoizedReactMarkdown } from '@/components/Markdown/MemoizedReactMarkdown';
import LatexBlock from '@/components/Chat/ChatContentBlocks/LatexBlock';
import {
    LucideAlertCircle,
    LucideCheckCircle,
    LucideChevronDown,
    LucideLoader2,
    LucideMessageCircleQuestion,
    LucideSave,
    LucideSearch,
    LucideSettings,
} from './LucideIcons';
import {
    AskRequest,
    ModelDefaults,
    NotebookModel,
    SearchResponse,
    SearchResult,
    SearchType,
    SourceListItem,
    askKnowledgeBaseSimple,
    getDefaults,
    getNote,
    listModels,
    listSources,
    searchKnowledgeBase,
} from '@/services/notebookService';
import { formatModelName, prepareModelOptions } from './modelDisplay';
import { AdvancedModelsDialog, AskModels } from './AdvancedModelsDialog';
import { SaveToNotebooksDialog } from './SaveToNotebooksDialog';

type Tab = 'ask' | 'search';
type RefType = 'source' | 'note' | 'source_insight';

interface ParsedRef {
    type: RefType;
    id: string;
    startIndex: number;
    endIndex: number;
}

interface Citation {
    n: number;
    type: RefType;
    id: string;
    label: string;
}

const REF_RE = /(source_insight|note|source):([A-Za-z0-9_]+)/g;

// LaTeX rendering matches the main chat renderer (ChatContentBlock): this repo
// pins react-markdown@8 (unified@10), so rehype-katax@7 (a unified@11 plugin)
// can't be used — see components/Notebook/MarkdownEditor.tsx. Instead we rewrite
// $$…$$ / \[…\] / \(…\) into <math-display>/<math-inline> custom elements (via
// rehype-raw), rendered by LatexBlock. Code spans/blocks are shielded first so
// dollar signs inside them aren't treated as math.
const processLatex = (content: string): string => {
    const stash: string[] = [];
    const placeholders: string[] = [];

    let processed = content.replace(/```[\s\S]*?```/g, (match) => {
        const ph = `__CODE_BLOCK_${stash.length}__`;
        stash.push(match);
        placeholders.push(ph);
        return ph;
    });
    processed = processed.replace(/`[^`]*`/g, (match) => {
        const ph = `__INLINE_CODE_${stash.length}__`;
        stash.push(match);
        placeholders.push(ph);
        return ph;
    });

    processed = processed.replace(/\$\$(.*?)\$\$/g, (_m, latex) => `<math-display>${latex}</math-display>`);
    processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_m, latex) => `<math-display>${latex}</math-display>`);
    processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_m, latex) => `<math-inline>${latex}</math-inline>`);

    placeholders.forEach((ph, i) => {
        processed = processed.replace(ph, stash[i]);
    });
    return processed;
};

// Allow the custom math elements through sanitization (mirrors chatSanitizeSchema).
const mathSanitizeSchema = {
    ...defaultSchema,
    tagNames: [...(defaultSchema.tagNames ?? []), 'math-display', 'math-inline'],
    attributes: {
        ...defaultSchema.attributes,
        '*': [...(defaultSchema.attributes?.['*'] ?? []), 'className', 'class'],
    },
};

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
): { markdown: string; orderedRefs: { type: RefType; id: string }[] } => {
    const refs = parseRefs(raw);
    if (refs.length === 0) {
        return { markdown: raw, orderedRefs: [] };
    }

    const order = new Map<string, number>();
    let next = 1;
    for (const r of refs) {
        const key = `${r.type}:${r.id}`;
        if (!order.has(key)) order.set(key, next++);
    }

    // Rebuild the answer text, replacing each citation (and any surrounding
    // brackets) with a markdown link `[n](#ref-type-id)` so react-markdown
    // renders the surrounding prose (bold, lists, tables, LaTeX) while the
    // numbered citation stays a clickable chip via the custom `a` renderer.
    let markdown = '';
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
        if (from > pos) markdown += raw.substring(pos, from);
        const n = order.get(`${r.type}:${r.id}`)!;
        markdown += `[${n}](#ref-${r.type}-${r.id})`;
        pos = to;
    }
    if (pos < raw.length) markdown += raw.substring(pos);

    const orderedRefs = Array.from(order.entries()).map(([key]) => {
        const [type, id] = key.split(':') as [RefType, string];
        return { type, id };
    });

    return { markdown, orderedRefs };
};

const labelForType = (type: RefType): string => {
    if (type === 'source') return 'Source';
    if (type === 'note') return 'Note';
    return 'Insight';
};

const scoreFor = (r: SearchResult): number =>
    r.relevance ?? r.similarity ?? r.score ?? 0;

// Shared button/badge classes mirroring the reference shadcn sizes.
const primaryButtonClass =
    'inline-flex h-9 items-center justify-center gap-2 rounded-md bg-purple-500 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-purple-600 disabled:pointer-events-none disabled:opacity-50';
const outlineButtonClass =
    'inline-flex h-9 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 text-sm font-medium shadow-sm transition-colors hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-600 dark:bg-transparent dark:hover:bg-neutral-700';
const secondaryBadgeClass =
    'inline-flex items-center rounded-md border border-transparent bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-neutral-700 dark:text-gray-200';

interface Props {
    // Clicking a source result title opens the full-page source viewer
    // (the reference opens a source modal there).
    onOpenSource?: (source: SourceListItem) => void;
}

export const AskSearchPage = ({ onOpenSource }: Props) => {
    const [tab, setTab] = useState<Tab>('ask');

    // Shared state
    const [defaults, setDefaults] = useState<ModelDefaults | null>(null);
    const [defaultsLoading, setDefaultsLoading] = useState<boolean>(true);
    const [languageModels, setLanguageModels] = useState<NotebookModel[]>([]);

    // Ask state
    const [question, setQuestion] = useState<string>('');
    // Per-stage model overrides picked in the Advanced dialog; null = use the
    // default chat model for all three stages.
    const [customModels, setCustomModels] = useState<AskModels | null>(null);
    const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
    const [asking, setAsking] = useState<boolean>(false);
    const [answer, setAnswer] = useState<string | null>(null);
    const [answerCitations, setAnswerCitations] = useState<Citation[]>([]);
    const [askError, setAskError] = useState<string | null>(null);
    const [showSaveDialog, setShowSaveDialog] = useState<boolean>(false);
    // Remembers which question produced the current answer, so the saved note's
    // title matches even if the user has already typed a new question.
    const [answeredQuestion, setAnsweredQuestion] = useState<string>('');
    const [savedNotice, setSavedNotice] = useState<boolean>(false);

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
            const [d, models] = await Promise.all([getDefaults(), listModels('language')]);
            if (cancelled) return;
            setDefaults(d);
            setLanguageModels(prepareModelOptions(models));
            setDefaultsLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const hasEmbedding = !!defaults?.default_embedding_model;
    const hasChatModel = !!defaults?.default_chat_model;

    const resolveModelName = useCallback(
        (id?: string | null): string => {
            if (!id) return 'Not set';
            const m = languageModels.find((mm) => mm.id === id);
            return m ? formatModelName(m.name) : id;
        },
        [languageModels],
    );

    const canAsk =
        !asking &&
        question.trim().length > 0 &&
        (hasChatModel || !!customModels) &&
        hasEmbedding;
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
        const fallback = defaults?.default_chat_model;
        const models: AskModels | null = customModels
            ? customModels
            : fallback
            ? { strategy: fallback, answer: fallback, finalAnswer: fallback }
            : null;
        if (!canAsk || !models) return;
        setAsking(true);
        setAnswer(null);
        setAnswerCitations([]);
        setAskError(null);
        setSavedNotice(false);
        setAnsweredQuestion(question.trim());

        const params: AskRequest = {
            question: question.trim(),
            strategy_model: models.strategy,
            answer_model: models.answer,
            final_answer_model: models.finalAnswer,
        };

        // The ask graph runs several sequential model calls server-side;
        // askKnowledgeBaseSimple rejects with the backend's real error message
        // instead of returning null, so the catch below surfaces the actual
        // cause rather than a config red herring.
        try {
            const result = await askKnowledgeBaseSimple(params);
            await finalizeAnswer(result.answer);
        } catch (e: any) {
            setAskError(e?.message || 'Failed to get an answer.');
        } finally {
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

    const tabButton = (value: Tab, icon: React.ReactNode, label: string) => (
        <button
            onClick={() => setTab(value)}
            className={`inline-flex h-9 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-4 text-sm font-medium transition-all ${
                tab === value
                    ? 'border-gray-200 bg-white text-gray-900 shadow-sm dark:border-neutral-600 dark:bg-[#2b2c36] dark:text-gray-100'
                    : 'border-transparent text-gray-500 dark:text-gray-400'
            }`}
        >
            {icon}
            {label}
        </button>
    );

    const citationChip = (label: React.ReactNode, key?: React.Key, title?: string) => (
        <span
            key={key}
            title={title}
            className="mx-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-purple-500/20 px-1.5 text-[11px] font-semibold text-purple-700 dark:bg-purple-400/20 dark:text-purple-200"
        >
            {label}
        </span>
    );

    return (
        <div className="w-full space-y-6">
            <h1 className="text-xl font-bold md:text-2xl">Ask and Search</h1>

            {/* Mode tabs */}
            <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Choose a mode
                </p>
                <div className="flex w-full max-w-xl gap-1 rounded-xl border border-gray-200 bg-gray-100/80 p-1 shadow-sm dark:border-neutral-700 dark:bg-neutral-800/80">
                    {tabButton(
                        'ask',
                        <LucideMessageCircleQuestion size={16} />,
                        'Ask (beta)',
                    )}
                    {tabButton('search', <LucideSearch size={16} />, 'Search')}
                </div>
            </div>

            {tab === 'ask' ? (
                <div className="flex flex-col gap-6 rounded-xl border border-gray-200 bg-white py-6 shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36]">
                    <div className="flex flex-col gap-1.5 px-6">
                        <h2 className="text-lg font-semibold leading-none">
                            Ask Your Knowledge Base (beta)
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            The LLM will answer your query based on the documents in your
                            knowledge base.
                        </p>
                    </div>

                    <div className="space-y-4 px-6">
                        {/* Question Input */}
                        <div className="space-y-2">
                            <label
                                htmlFor="ask-question"
                                className="text-sm font-medium leading-none"
                            >
                                Question
                            </label>
                            <textarea
                                id="ask-question"
                                ref={askTextareaRef}
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                onKeyDown={(e) => {
                                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canAsk) {
                                        e.preventDefault();
                                        handleAsk();
                                    }
                                }}
                                rows={3}
                                disabled={asking}
                                placeholder="Enter your question..."
                                className="w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder-gray-400 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 disabled:opacity-50 dark:border-neutral-600 dark:bg-[#40414f] dark:text-gray-100 dark:placeholder-gray-500"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Press Cmd/Ctrl+Enter to submit
                            </p>
                        </div>

                        {/* Models Display */}
                        {!defaultsLoading && !hasEmbedding ? (
                            <div className="flex items-center gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-600 dark:bg-amber-950/20 dark:text-amber-500">
                                <LucideAlertCircle size={16} className="flex-none" />
                                <span>
                                    You can&apos;t use this feature because you have no embedding
                                    model selected. Please set one up in the Models page.
                                </span>
                            </div>
                        ) : (
                            !defaultsLoading && (
                                <>
                                    {!hasChatModel && !customModels && (
                                        <div className="flex items-center gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-600 dark:bg-amber-950/20 dark:text-amber-500">
                                            <LucideAlertCircle size={16} className="flex-none" />
                                            <span>
                                                No default chat model is configured. Pick models
                                                via Advanced below, or set a default on the
                                                Models page.
                                            </span>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                {customModels
                                                    ? 'Using Custom Models'
                                                    : 'Using Default Models'}
                                            </span>
                                            <button
                                                onClick={() => setShowAdvanced(true)}
                                                disabled={asking}
                                                className="inline-flex items-center rounded-md px-2 py-1 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-50 dark:text-gray-200 dark:hover:bg-neutral-700"
                                            >
                                                <LucideSettings size={12} className="mr-1" />
                                                Advanced
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-2 text-xs">
                                            <span className={secondaryBadgeClass}>
                                                Strategy:{' '}
                                                {resolveModelName(
                                                    customModels?.strategy ||
                                                        defaults?.default_chat_model,
                                                )}
                                            </span>
                                            <span className={secondaryBadgeClass}>
                                                Answer:{' '}
                                                {resolveModelName(
                                                    customModels?.answer ||
                                                        defaults?.default_chat_model,
                                                )}
                                            </span>
                                            <span className={secondaryBadgeClass}>
                                                Final:{' '}
                                                {resolveModelName(
                                                    customModels?.finalAnswer ||
                                                        defaults?.default_chat_model,
                                                )}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2 sm:flex-row">
                                        <button
                                            onClick={handleAsk}
                                            disabled={!canAsk}
                                            className={`${primaryButtonClass} w-full`}
                                        >
                                            {asking ? (
                                                <>
                                                    <LucideLoader2
                                                        size={16}
                                                        className="animate-spin"
                                                    />
                                                    Processing...
                                                </>
                                            ) : (
                                                'Ask'
                                            )}
                                        </button>

                                        {answer && (
                                            <button
                                                onClick={() => setShowSaveDialog(true)}
                                                className={`${outlineButtonClass} w-full`}
                                            >
                                                <LucideSave size={16} />
                                                Save to Notebooks
                                                {savedNotice && (
                                                    <span className="text-xs text-emerald-600 dark:text-emerald-400">
                                                        Saved
                                                    </span>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </>
                            )
                        )}

                        {askError && (
                            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                                <LucideAlertCircle size={16} className="mt-0.5 flex-none" />
                                <span>{askError}</span>
                            </div>
                        )}

                        {/* Response — mirrors the reference StreamingResponse's Final
                            Answer card; our /search/ask/simple flow is non-streaming, so
                            the strategy/intermediate-answer sections never apply. */}
                        {asking && (
                            <div className="mt-6 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                <LucideLoader2 size={16} className="animate-spin" />
                                <span>Processing your question...</span>
                            </div>
                        )}

                        {answerRendered && (
                            <div className="mt-6 flex flex-col gap-6 rounded-xl border border-purple-500 bg-white py-6 shadow-sm dark:bg-[#2b2c36]">
                                <div className="px-6">
                                    <h3 className="flex items-center gap-2 text-base font-semibold leading-none">
                                        <LucideCheckCircle
                                            size={16}
                                            className="text-purple-600 dark:text-purple-400"
                                        />
                                        Final Answer
                                    </h3>
                                </div>
                                <div className="px-6">
                                    <MemoizedReactMarkdown
                                        className="prose prose-sm dark:prose-invert max-w-none break-words text-sm leading-relaxed"
                                        remarkPlugins={[remarkGfm]}
                                        // @ts-ignore — rehype-raw/sanitize typings vs react-markdown@8
                                        rehypePlugins={[rehypeRaw, [rehypeSanitize, mathSanitizeSchema]]}
                                        components={{
                                            // @ts-ignore — custom math elements aren't in react-markdown@8's component map
                                            'math-display': ({
                                                children,
                                            }: {
                                                children: React.ReactNode;
                                            }) => (
                                                <LatexBlock
                                                    math={String(children)}
                                                    displayMode={true}
                                                />
                                            ),
                                            'math-inline': ({
                                                children,
                                            }: {
                                                children: React.ReactNode;
                                            }) => (
                                                <LatexBlock
                                                    math={String(children)}
                                                    displayMode={false}
                                                />
                                            ),
                                            // Citations are rewritten as `[n](#ref-type-id)`
                                            // links; render those as static numbered chips
                                            // (matching the reference's citationChip) instead
                                            // of navigating. Real URLs fall through to a
                                            // normal new-tab anchor.
                                            a({ href, children, ...props }) {
                                                if (href && href.startsWith('#ref-')) {
                                                    return citationChip(
                                                        children as React.ReactNode,
                                                        undefined,
                                                        href
                                                            .slice('#ref-'.length)
                                                            .replace('-', ' '),
                                                    );
                                                }
                                                return (
                                                    <a
                                                        href={href}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        {...props}
                                                    >
                                                        {children}
                                                    </a>
                                                );
                                            },
                                        }}
                                    >
                                        {processLatex(answerRendered.markdown)}
                                    </MemoizedReactMarkdown>

                                    {answerCitations.length > 0 && (
                                        <div className="mt-4 border-t border-gray-200 pt-3 dark:border-neutral-700">
                                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                Sources cited
                                            </div>
                                            <ol className="space-y-1 text-sm">
                                                {answerCitations.map((c) => (
                                                    <li
                                                        key={`${c.type}-${c.id}`}
                                                        className="flex items-start gap-2"
                                                    >
                                                        {citationChip(c.n)}
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
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-6 rounded-xl border border-gray-200 bg-white py-6 shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36]">
                    <div className="flex flex-col gap-1.5 px-6">
                        <h2 className="text-lg font-semibold leading-none">Search</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Search your knowledge base for specific keywords or concepts
                        </p>
                    </div>

                    <div className="space-y-4 px-6">
                        {/* Search Input */}
                        <div className="space-y-2">
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
                                    placeholder="Enter search query..."
                                    autoComplete="off"
                                    className="h-9 flex-1 rounded-md border border-gray-300 bg-white px-3 text-sm shadow-sm placeholder-gray-400 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 disabled:opacity-50 dark:border-neutral-600 dark:bg-[#40414f] dark:text-gray-100 dark:placeholder-gray-500"
                                />
                                <button
                                    onClick={handleSearch}
                                    disabled={!canSearch}
                                    className={`${primaryButtonClass} w-full sm:w-auto`}
                                >
                                    {searching ? (
                                        <LucideLoader2 size={16} className="animate-spin" />
                                    ) : (
                                        <LucideSearch size={16} />
                                    )}
                                    Search
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Press Enter to search
                            </p>
                        </div>

                        {/* Search Options */}
                        <div className="space-y-4">
                            {/* Search Type */}
                            <div className="space-y-2">
                                <span className="text-sm font-medium leading-none">
                                    Search Type
                                </span>
                                {!hasEmbedding && !defaultsLoading && (
                                    <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500">
                                        <LucideAlertCircle size={16} className="flex-none" />
                                        <span>
                                            Vector search requires an embedding model. Only text
                                            search is available.
                                        </span>
                                    </div>
                                )}
                                <div className="flex flex-col gap-2">
                                    <label className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                                        <input
                                            type="radio"
                                            name="search-type"
                                            checked={searchType === 'text'}
                                            onChange={() => setSearchType('text')}
                                            disabled={searching}
                                            className="h-4 w-4 accent-purple-500"
                                        />
                                        Text Search
                                    </label>
                                    <label
                                        className={`flex items-center gap-2 text-sm font-normal ${
                                            hasEmbedding
                                                ? 'cursor-pointer'
                                                : 'cursor-not-allowed text-gray-400 dark:text-gray-500'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="search-type"
                                            checked={searchType === 'vector'}
                                            onChange={() => setSearchType('vector')}
                                            disabled={!hasEmbedding || searching}
                                            className="h-4 w-4 accent-purple-500"
                                        />
                                        Vector Search
                                    </label>
                                </div>
                            </div>

                            {/* Search Locations */}
                            <div className="space-y-2">
                                <span className="text-sm font-medium leading-none">
                                    Search In
                                </span>
                                <div className="space-y-2">
                                    <label className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                                        <input
                                            type="checkbox"
                                            checked={searchSources}
                                            onChange={(e) => setSearchSources(e.target.checked)}
                                            disabled={searching}
                                            className="h-4 w-4 accent-purple-500"
                                        />
                                        Search Sources
                                    </label>
                                    <label className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                                        <input
                                            type="checkbox"
                                            checked={searchNotes}
                                            onChange={(e) => setSearchNotes(e.target.checked)}
                                            disabled={searching}
                                            className="h-4 w-4 accent-purple-500"
                                        />
                                        Search Notes
                                    </label>
                                </div>
                            </div>
                        </div>

                        {searchError && (
                            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                                <LucideAlertCircle size={16} className="mt-0.5 flex-none" />
                                <span>{searchError}</span>
                            </div>
                        )}

                        {/* Search Results */}
                        {searchResponse && (
                            <div className="mt-6 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-medium">
                                        {searchResponse.total_count} results found
                                    </h3>
                                    <span className="inline-flex items-center rounded-md border border-gray-300 px-2 py-0.5 text-xs font-medium dark:border-neutral-600">
                                        {searchResponse.search_type === 'text'
                                            ? 'Text Search'
                                            : 'Vector Search'}
                                    </span>
                                </div>

                                {searchResponse.results.length === 0 ? (
                                    <div className="rounded-xl border border-gray-200 bg-white px-6 py-6 text-center text-sm text-gray-500 shadow-sm dark:border-neutral-700 dark:bg-[#343541] dark:text-gray-400">
                                        No results found for &quot;{searchQuery}&quot;
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {searchResponse.results.map((r, idx) => {
                                            if (!r.parent_id) return null;
                                            const [type] = r.parent_id.split(':');
                                            const expanded = expandedMatches.has(idx);
                                            const matches = (r.matches || []) as string[];
                                            const matchCount = matches.length;
                                            const canOpen = type === 'source' && !!onOpenSource;
                                            return (
                                                <div
                                                    key={`${r.parent_id}-${idx}`}
                                                    className="rounded-xl border border-gray-200 bg-white px-6 py-4 shadow-sm dark:border-neutral-700 dark:bg-[#343541]"
                                                >
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="flex-1">
                                                            {canOpen ? (
                                                                <button
                                                                    onClick={() =>
                                                                        onOpenSource!({
                                                                            id: r.parent_id!,
                                                                        } as SourceListItem)
                                                                    }
                                                                    className="text-left font-medium text-purple-600 hover:underline dark:text-purple-400"
                                                                >
                                                                    {r.title || '(untitled)'}
                                                                </button>
                                                            ) : (
                                                                <span className="font-medium">
                                                                    {r.title || '(untitled)'}
                                                                </span>
                                                            )}
                                                            <span
                                                                className={`${secondaryBadgeClass} ml-2`}
                                                            >
                                                                {scoreFor(r).toFixed(2)}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {matchCount > 0 && (
                                                        <div className="mt-3">
                                                            <button
                                                                onClick={() => toggleMatches(idx)}
                                                                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                                                            >
                                                                <LucideChevronDown size={16} />
                                                                Matches ({matchCount})
                                                            </button>
                                                            {expanded && (
                                                                <div className="mt-2 space-y-1">
                                                                    {matches.map((m, i) => (
                                                                        <MemoizedReactMarkdown
                                                                            key={i}
                                                                            className="prose prose-sm dark:prose-invert max-w-none break-words border-l-2 border-gray-200 py-1 pl-6 text-sm dark:border-neutral-600"
                                                                            remarkPlugins={[
                                                                                remarkGfm,
                                                                            ]}
                                                                            // @ts-ignore — rehype-raw/sanitize typings vs react-markdown@8
                                                                            rehypePlugins={[rehypeRaw, [rehypeSanitize, mathSanitizeSchema]]}
                                                                            components={{
                                                                                // @ts-ignore — custom math elements aren't in react-markdown@8's component map
                                                                                'math-display': ({
                                                                                    children,
                                                                                }: {
                                                                                    children: React.ReactNode;
                                                                                }) => (
                                                                                    <LatexBlock
                                                                                        math={String(
                                                                                            children,
                                                                                        )}
                                                                                        displayMode={
                                                                                            true
                                                                                        }
                                                                                    />
                                                                                ),
                                                                                'math-inline': ({
                                                                                    children,
                                                                                }: {
                                                                                    children: React.ReactNode;
                                                                                }) => (
                                                                                    <LatexBlock
                                                                                        math={String(
                                                                                            children,
                                                                                        )}
                                                                                        displayMode={
                                                                                            false
                                                                                        }
                                                                                    />
                                                                                ),
                                                                            }}
                                                                        >
                                                                            {processLatex(
                                                                                typeof m === 'string'
                                                                                    ? m
                                                                                    : (m as any)
                                                                                          ?.text ||
                                                                                          '',
                                                                            )}
                                                                        </MemoizedReactMarkdown>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showSaveDialog && answer && (
                <SaveToNotebooksDialog
                    question={answeredQuestion || 'Ask answer'}
                    answer={answer}
                    onClose={() => setShowSaveDialog(false)}
                    onSaved={() => setSavedNotice(true)}
                />
            )}

            {showAdvanced && (
                <AdvancedModelsDialog
                    models={languageModels}
                    initial={
                        customModels || {
                            strategy: defaults?.default_chat_model || '',
                            answer: defaults?.default_chat_model || '',
                            finalAnswer: defaults?.default_chat_model || '',
                        }
                    }
                    onSave={setCustomModels}
                    onClose={() => setShowAdvanced(false)}
                />
            )}
        </div>
    );
};

export default AskSearchPage;
