import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import remarkGfm from 'remark-gfm';
import HomeContext from '@/pages/api/home/home.context';
import {
    LucideBot,
    LucideCheck,
    LucideClock,
    LucideCopy,
    LucideLoader2,
    LucideSave,
    LucideSend,
    LucideUser,
} from './LucideIcons';
import {
    ChatMessage,
    ChatSession,
    ContextSelections,
    Note,
    NotebookModel,
    SourceListItem,
    buildChatContext,
    createChatSession,
    createNote,
    deleteChatSession,
    getChatSession,
    listChatSessions,
    sendChatMessage,
    updateChatSession,
} from '@/services/notebookService';
import { ConfirmModal } from '@/components/ReusableComponents/ConfirmModal';
import { MemoizedReactMarkdown } from '@/components/Markdown/MemoizedReactMarkdown';
import { ChatModelSelect } from './ChatModelSelect';
import { ContextIndicator } from './ContextIndicator';
import { formatModelName } from './modelDisplay';
import { resolveContextWindow } from './modelContext';
import { SessionManagerModal } from './SessionManagerModal';

interface Props {
    notebookId: string;
    contextSelections: ContextSelections;
    sources: SourceListItem[];
    notes: Note[];
    // Lets "Save to note" on AI replies surface the new note in the Notes
    // panel immediately.
    onNoteSaved?: (note: Note) => void;
}

// The LLM emits citations as raw SurrealDB record IDs (e.g. `[source:abc]`,
// `source:abc` bare, `[[source:abc]]`, or `[source:a, note:b]` comma-grouped).
// Ported from open-notebook's convertReferencesToCompactMarkdown so we cover the
// same edge cases. Output is the message text with each citation rewritten as a
// markdown link (`[n](#ref-type-id)`) so the whole message can be rendered
// through react-markdown, plus an ordered citation list for the footer.
type RefType = 'source' | 'note' | 'source_insight' | 'insight';
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
    targetDomId: string;
}
interface RenderedMessage {
    // Message text with inline citations rewritten as markdown links
    // (`[n](#ref-type-id)`); rendered via react-markdown so **bold**, lists,
    // tables, etc. render, while the numbered citations stay clickable through
    // a custom link renderer that intercepts `#ref-` hrefs.
    markdown: string;
    citations: Citation[];
}

// The source-chat/notebook-chat system prompts tell the model to cite
// insights with the shorthand `insight:<id>`, but the actual SurrealDB table
// (and the id the model copies out of context) is `source_insight:<id>`.
// That mismatch let raw `insight:xxxx` citations slip past this regex
// untouched, leaking the id straight into the rendered message. Match the
// bare `insight` alias too so it gets the same citation treatment.
const REF_RE = /(source_insight|insight|note|source):([A-Za-z0-9_]+)/g;

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

const renderCitations = (
    raw: string,
    sources: SourceListItem[],
    notes: Note[],
): RenderedMessage => {
    const refs = parseRefs(raw);
    if (refs.length === 0) {
        return { markdown: raw, citations: [] };
    }

    const order = new Map<string, number>();
    let next = 1;
    for (const r of refs) {
        const key = `${r.type}:${r.id}`;
        if (!order.has(key)) order.set(key, next++);
    }

    // Rebuild the message text, replacing each citation (and any surrounding
    // brackets) with a markdown link `[n](#ref-type-id)` so react-markdown
    // renders the surrounding prose while the citation stays clickable.
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

    const citations: Citation[] = Array.from(order.entries()).map(([key, n]) => {
        const [type, id] = key.split(':') as [RefType, string];
        const fullId = `${type}:${id}`;
        let label = '(unknown)';
        if (type === 'source') {
            label = sources.find((s) => s.id === fullId)?.title || '(untitled source)';
        } else if (type === 'note') {
            label = notes.find((nn) => nn.id === fullId)?.title || '(untitled note)';
        } else {
            label = 'AI insight';
        }
        return { n, type, id, label, targetDomId: `ref-${type}-${id}` };
    });

    return { markdown, citations };
};

const focusReference = (domId: string) => {
    const el = document.getElementById(domId);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('notebook-ref-flash');
    window.setTimeout(() => el.classList.remove('notebook-ref-flash'), 1500);
};

// Mirrors components/Chat/ChatInput.tsx: on mobile, Enter inserts a newline
// (send is via the button) rather than submitting.
const isMobile = () => {
    const userAgent = typeof window.navigator === 'undefined' ? '' : navigator.userAgent;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(
        userAgent,
    );
};

// Matches the reference composer's max-h-[100px].
const COMPOSER_MAX_HEIGHT = 100;

export const ChatPanel = ({
    notebookId,
    contextSelections,
    sources,
    notes,
    onNoteSaved,
}: Props) => {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [draft, setDraft] = useState<string>('');
    const [isSending, setIsSending] = useState<boolean>(false);
    const [loadingSessions, setLoadingSessions] = useState<boolean>(true);
    const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [pendingDelete, setPendingDelete] = useState<ChatSession | null>(null);
    const [deleting, setDeleting] = useState<boolean>(false);
    const [showSessions, setShowSessions] = useState<boolean>(false);
    // Model used to answer; '' = deployment default (no override sent).
    const [modelOverride, setModelOverride] = useState<string>('');
    // Record of the model that will answer (override or default), reported by
    // ChatModelSelect — drives the context-limit readout in the indicator.
    const [activeModel, setActiveModel] = useState<NotebookModel | null>(null);
    // Whether there's actually more than one model to choose from — when
    // there isn't, showing "Model: <name>" is just branding noise since the
    // user has no choice to make, so the whole label+picker row is hidden.
    const [hasModelAlternatives, setHasModelAlternatives] = useState<boolean>(true);
    // Amplify's admin model table — the source of truth for context windows.
    const {
        state: { availableModels },
    } = useContext(HomeContext);
    // IME composition guard — don't submit on the Enter that confirms a
    // composition (matches the main chat input).
    const [isTyping, setIsTyping] = useState<boolean>(false);

    const scrollRef = useRef<HTMLDivElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    // Sessions we created locally in this tab — skip the fetch-on-mount
    // for them so the optimistic user message isn't wiped.
    const locallyCreatedRef = useRef<Set<string>>(new Set());

    const contextStats = useMemo(() => {
        let sourcesInsights = 0;
        let sourcesFull = 0;
        let notesCount = 0;
        for (const s of sources) {
            const mode = contextSelections.sources[s.id];
            if (mode === 'insights') sourcesInsights++;
            else if (mode === 'full') sourcesFull++;
        }
        for (const n of notes) {
            if (contextSelections.notes[n.id] === 'full') notesCount++;
        }
        return { sourcesInsights, sourcesFull, notesCount };
    }, [sources, notes, contextSelections]);

    // Token/char counts for the indicator bar — refreshed whenever the
    // selection changes, independent of sending a message (sendChatMessage's
    // own fast path doesn't build context client-side, so this is the only
    // place these counts come from).
    const [tokenCount, setTokenCount] = useState<number | undefined>(undefined);
    const [charCount, setCharCount] = useState<number | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;
        buildChatContext(notebookId, contextSelections).then((result) => {
            if (cancelled || !result) return;
            setTokenCount(result.token_count);
            setCharCount(result.char_count);
        });
        return () => {
            cancelled = true;
        };
    }, [notebookId, contextSelections]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoadingSessions(true);
            const data = await listChatSessions(notebookId);
            if (cancelled) return;
            setSessions(data);
            if (data.length > 0 && !currentSessionId) {
                setCurrentSessionId(data[0].id);
            }
            setLoadingSessions(false);
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [notebookId]);

    useEffect(() => {
        let cancelled = false;
        if (!currentSessionId) {
            setMessages([]);
            return;
        }
        if (locallyCreatedRef.current.has(currentSessionId)) {
            // We just created this session — its initial state is whatever
            // we set locally (likely the optimistic user message).
            return;
        }
        const load = async () => {
            setLoadingMessages(true);
            setError(null);
            const session = await getChatSession(currentSessionId);
            if (cancelled) return;
            if (session) {
                setMessages(session.messages || []);
                // Without this, modelOverride keeps whatever session A had
                // selected after switching to session B — the ChatModelSelect
                // badge would show A's override while the next message to B
                // silently used it too.
                setModelOverride(session.model_override || '');
            }
            setLoadingMessages(false);
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [currentSessionId]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isSending]);

    // Auto-grow the composer as the draft changes so a Shift+Enter newline is
    // actually visible (a fixed-height textarea hides newlines as they scroll
    // off). Mirrors the main chat input's height handling.
    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = 'auto';
        ta.style.height = `${Math.min(ta.scrollHeight, COMPOSER_MAX_HEIGHT)}px`;
        ta.style.overflowY = ta.scrollHeight > COMPOSER_MAX_HEIGHT ? 'auto' : 'hidden';
    }, [draft]);

    const handleCreateSession = async (title: string) => {
        const created = await createChatSession(notebookId, title);
        if (!created) {
            setError('Failed to create session.');
            return;
        }
        locallyCreatedRef.current.add(created.id);
        setSessions((prev) => [created, ...prev]);
        setCurrentSessionId(created.id);
        setMessages([]);
        // A brand-new session has no override yet — don't carry over
        // whatever the previously active session had selected.
        setModelOverride(created.model_override || '');
        setShowSessions(false);
    };

    const handleRenameSession = async (sessionId: string, title: string) => {
        const updated = await updateChatSession(sessionId, { title });
        if (!updated) {
            setError('Failed to rename session.');
            return;
        }
        setSessions((prev) =>
            prev.map((s) => (s.id === sessionId ? { ...s, title: updated.title ?? title } : s)),
        );
    };

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        setDeleting(true);
        const ok = await deleteChatSession(pendingDelete.id);
        setDeleting(false);
        if (!ok) {
            setError(`Couldn't delete session.`);
            setPendingDelete(null);
            return;
        }
        setSessions((prev) => prev.filter((s) => s.id !== pendingDelete.id));
        if (currentSessionId === pendingDelete.id) {
            setCurrentSessionId(null);
            setMessages([]);
        }
        setPendingDelete(null);
    };

    const handleSend = async () => {
        const text = draft.trim();
        if (!text || isSending) return;
        // Set before the first await (session creation) so a fast
        // double-click/double-Enter on the very first message of a new chat
        // can't race past this guard — the Send button's `disabled` also
        // reads `isSending`, so this closes the window where a second
        // invocation could create a duplicate session and send the message
        // twice.
        setIsSending(true);

        let sessionId = currentSessionId;
        if (!sessionId) {
            // Name the session from the first message, trimmed to a clean word
            // boundary, so the sessions list shows something relevant.
            const trimmed = text.replace(/\s+/g, ' ').trim();
            const title =
                trimmed.length > 48
                    ? `${trimmed.slice(0, 48).replace(/\s+\S*$/, '')}…`
                    : trimmed;
            const created = await createChatSession(notebookId, title);
            if (!created) {
                setError('Failed to create session.');
                setIsSending(false);
                return;
            }
            locallyCreatedRef.current.add(created.id);
            setSessions((prev) => [created, ...prev]);
            setCurrentSessionId(created.id);
            sessionId = created.id;
        }

        setError(null);
        setDraft('');
        const userMsg: ChatMessage = {
            id: `temp-${Date.now()}`,
            type: 'human',
            content: text,
        };
        setMessages((prev) => [...prev, userMsg]);

        // Context is built from the selections server-side, so there's no
        // separate buildChatContext round-trip on the send path.
        try {
            const result = await sendChatMessage(
                notebookId,
                sessionId,
                text,
                contextSelections,
                modelOverride || undefined,
            );
            if (!result) {
                throw new Error('Failed to send message.');
            }
            setMessages(result.messages);
            // The message is now persisted, so a fresh fetch would return the
            // same list we just set — safe to stop treating this as a
            // locally-created session with special-cased state. Without
            // this, switching away from and back to this session later would
            // hit the `locallyCreatedRef.current.has(...)` guard above and
            // skip the fetch, leaving whatever session's messages happened to
            // be in state at the time (i.e. a different session's messages
            // rendered under this session's header).
            locallyCreatedRef.current.delete(sessionId);
        } catch (e: any) {
            setError(e?.message || 'Failed to send message.');
            setMessages((prev) => prev.filter((m) => !m.id.startsWith('temp-')));
            // Send failed: this session (if newly created) still has no
            // persisted messages, so keep it in locallyCreatedRef — leave as
            // is (mirrors SourceChatPanel.tsx's handleSend).
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Enter submits; Shift+Enter inserts a newline (default textarea
        // behavior). Skip submit during IME composition or on mobile, matching
        // the main model chat input.
        if (e.key === 'Enter' && !isTyping && !isMobile() && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex h-[640px] flex-col rounded-xl border border-gray-200 bg-white py-6 shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36] lg:h-full lg:min-h-0">
            {/* Header — mirrors the reference ChatPanel CardHeader */}
            <div className="flex flex-none items-center justify-between px-6 pb-3">
                <div className="flex items-center gap-2 font-semibold leading-none">
                    <LucideBot size={20} />
                    Chat with Notebook
                </div>
                <button
                    onClick={() => setShowSessions(true)}
                    disabled={loadingSessions}
                    className="inline-flex h-8 items-center gap-2 rounded-md px-3 text-gray-700 transition-colors hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-50 dark:text-gray-200 dark:hover:bg-neutral-700"
                >
                    <LucideClock size={16} />
                    <span className="text-xs">Sessions</span>
                </button>
            </div>

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4">
                <div className="flex flex-col gap-4 py-4">
                    {loadingMessages && messages.length === 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                            Loading messages…
                        </div>
                    )}
                    {!loadingMessages && messages.length === 0 && !isSending && (
                        <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                            <LucideBot size={48} className="mx-auto mb-4 opacity-50" />
                            <p className="text-sm">Start a conversation about this notebook</p>
                            <p className="mt-2 text-xs">
                                Ask questions to understand the content better
                            </p>
                        </div>
                    )}
                    {messages.map((m) => (
                        <MessageBubble
                            key={m.id}
                            message={m}
                            sources={sources}
                            notes={notes}
                            notebookId={notebookId}
                            onNoteSaved={onNoteSaved}
                        />
                    ))}
                    {isSending && (
                        <div className="flex justify-start gap-3">
                            <div className="flex-none">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/40">
                                    <LucideBot
                                        size={16}
                                        className="text-purple-600 dark:text-purple-300"
                                    />
                                </div>
                            </div>
                            <div className="rounded-lg bg-gray-100 px-4 py-2 dark:bg-neutral-700">
                                <LucideLoader2
                                    size={16}
                                    className="animate-spin text-gray-500 dark:text-gray-300"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {error && (
                <div className="border-t border-red-200 bg-red-50 px-6 py-2 text-xs text-red-600 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                    {error}
                </div>
            )}

            <ContextIndicator
                sourcesInsights={contextStats.sourcesInsights}
                sourcesFull={contextStats.sourcesFull}
                notesCount={contextStats.notesCount}
                tokenCount={tokenCount}
                charCount={charCount}
                contextWindow={
                    activeModel ? resolveContextWindow(activeModel.name, availableModels) : null
                }
                modelLabel={activeModel ? formatModelName(activeModel.name) : null}
            />

            {/* Input Area */}
            <div className="flex flex-none flex-col gap-3 border-t border-gray-200 p-4 dark:border-neutral-700">
                {hasModelAlternatives && (
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Model</span>
                        <ChatModelSelect
                            value={modelOverride}
                            onChange={setModelOverride}
                            disabled={isSending}
                            onResolvedModel={setActiveModel}
                            onHasAlternatives={setHasModelAlternatives}
                        />
                    </div>
                )}
                <div className="flex min-w-0 items-end gap-2">
                    <textarea
                        ref={textareaRef}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onCompositionStart={() => setIsTyping(true)}
                        onCompositionEnd={() => setIsTyping(false)}
                        placeholder="Ask anything about your sources... (Enter to send)"
                        rows={1}
                        disabled={isSending}
                        className="min-h-[40px] min-w-0 flex-1 resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400 dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!draft.trim() || isSending}
                        title="Send"
                        className="flex h-[40px] w-[40px] flex-none items-center justify-center rounded-md bg-purple-500 text-white shadow-sm transition-colors hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isSending ? (
                            <LucideLoader2 size={16} className="animate-spin" />
                        ) : (
                            <LucideSend size={16} />
                        )}
                    </button>
                </div>
            </div>

            {showSessions && (
                <SessionManagerModal
                    sessions={sessions}
                    currentSessionId={currentSessionId}
                    loadingSessions={loadingSessions}
                    onClose={() => setShowSessions(false)}
                    onCreate={handleCreateSession}
                    onSelect={(id) => {
                        setCurrentSessionId(id);
                        setShowSessions(false);
                    }}
                    onRename={handleRenameSession}
                    onDelete={(session) => {
                        setPendingDelete(session);
                        setShowSessions(false);
                    }}
                />
            )}

            {pendingDelete && (
                <ConfirmModal
                    title="Delete Session"
                    message="Are you sure you want to delete this chat session? This action cannot be undone."
                    confirmLabel={deleting ? 'Deleting…' : 'Delete'}
                    denyLabel="Cancel"
                    onConfirm={confirmDelete}
                    onDeny={() => setPendingDelete(null)}
                />
            )}
        </div>
    );
};

const MessageBubble = ({
    message,
    sources,
    notes,
    notebookId,
    onNoteSaved,
}: {
    message: ChatMessage;
    sources: SourceListItem[];
    notes: Note[];
    notebookId: string;
    onNoteSaved?: (note: Note) => void;
}) => {
    const isHuman = message.type === 'human';
    const [copied, setCopied] = useState<boolean>(false);
    const [saving, setSaving] = useState<boolean>(false);
    const [saved, setSaved] = useState<boolean>(false);

    const rendered: RenderedMessage = isHuman
        ? { markdown: message.content, citations: [] }
        : renderCitations(message.content, sources, notes);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(message.content);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard unavailable (e.g. insecure context) — nothing to show.
        }
    };

    // "Save to note" mirroring the reference MessageActions: creates an AI
    // note in this notebook from the reply's content.
    const handleSaveToNote = async () => {
        if (saving) return;
        setSaving(true);
        const note = await createNote({
            notebookId,
            content: message.content,
            note_type: 'ai',
        });
        setSaving(false);
        if (note) {
            setSaved(true);
            onNoteSaved?.(note);
            window.setTimeout(() => setSaved(false), 2000);
        }
    };

    return (
        <div className={`flex gap-3 ${isHuman ? 'justify-end' : 'justify-start'}`}>
            {!isHuman && (
                <div className="flex-none">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/40">
                        <LucideBot size={16} className="text-purple-600 dark:text-purple-300" />
                    </div>
                </div>
            )}
            <div className="flex max-w-[80%] flex-col gap-2">
                <div
                    className={`rounded-lg px-4 py-2 text-sm ${
                        isHuman
                            ? 'whitespace-pre-wrap bg-purple-500 text-white'
                            : 'bg-gray-100 text-gray-800 dark:bg-neutral-700 dark:text-neutral-100'
                    }`}
                >
                    {isHuman ? (
                        rendered.markdown
                    ) : (
                        <MemoizedReactMarkdown
                            className="prose prose-sm dark:prose-invert max-w-none break-words"
                            remarkPlugins={[remarkGfm]}
                            components={{
                                // Numbered citations are emitted as `[n](#ref-type-id)`
                                // links; intercept those to scroll/flash the referenced
                                // source or note instead of navigating. All other links
                                // (real URLs) fall through to a normal new-tab anchor.
                                a({ href, children, ...props }) {
                                    if (href && href.startsWith('#ref-')) {
                                        return (
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    focusReference(href.slice(1));
                                                }}
                                                className="mx-0.5 inline-flex items-baseline rounded bg-purple-100 px-1 font-mono text-[11px] font-medium text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:hover:bg-purple-900/60"
                                                title="Jump to reference"
                                            >
                                                {children}
                                            </button>
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
                            {rendered.markdown}
                        </MemoizedReactMarkdown>
                    )}
                    {rendered.citations.length > 0 && (
                        <div className="mt-2 border-t border-gray-300 pt-1.5 text-[11px] text-gray-600 dark:border-neutral-600 dark:text-gray-300">
                            <div className="mb-0.5 font-medium">Sources</div>
                            <ol className="m-0 list-none space-y-0.5 p-0">
                                {rendered.citations.map((c) => (
                                    <li key={c.n}>
                                        <button
                                            onClick={() => focusReference(c.targetDomId)}
                                            className="text-left hover:underline"
                                            title={`Jump to ${c.type}`}
                                        >
                                            <span className="font-mono">[{c.n}]</span> {c.label}
                                            {c.type !== 'source' && (
                                                <span className="ml-1 opacity-60">({c.type})</span>
                                            )}
                                        </button>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    )}
                </div>
                {!isHuman && (
                    <div className="flex gap-1">
                        <button
                            onClick={handleSaveToNote}
                            disabled={saving}
                            title="Save to note"
                            className="inline-flex h-7 items-center rounded-md px-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:pointer-events-none disabled:opacity-50 dark:text-gray-400 dark:hover:bg-neutral-700 dark:hover:text-gray-200"
                        >
                            {saving ? (
                                <LucideLoader2 size={14} className="animate-spin" />
                            ) : saved ? (
                                <LucideCheck size={14} className="text-green-500" />
                            ) : (
                                <LucideSave size={14} />
                            )}
                        </button>
                        <button
                            onClick={handleCopy}
                            title="Copy to clipboard"
                            className="inline-flex h-7 items-center rounded-md px-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-neutral-700 dark:hover:text-gray-200"
                        >
                            {copied ? (
                                <LucideCheck size={14} className="text-green-500" />
                            ) : (
                                <LucideCopy size={14} />
                            )}
                        </button>
                    </div>
                )}
            </div>
            {isHuman && (
                <div className="flex-none">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500">
                        <LucideUser size={16} className="text-white" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatPanel;
