import { useEffect, useMemo, useRef, useState } from 'react';
import remarkGfm from 'remark-gfm';
import {
    LucideBot,
    LucideCheck,
    LucideClock,
    LucideCopy,
    LucideLoader2,
    LucideSend,
    LucideUser,
} from './LucideIcons';
import {
    ChatMessage,
    SourceChatSession,
    SourceInsight,
    SourceListItem,
    createSourceChatSession,
    deleteSourceChatSession,
    getNote,
    getSourceChatSession,
    listSourceChatSessions,
    listSourceInsights,
    sendSourceChatMessage,
    updateSourceChatSession,
} from '@/services/notebookService';
import { ConfirmModal } from '@/components/ReusableComponents/ConfirmModal';
import { MemoizedReactMarkdown } from '@/components/Markdown/MemoizedReactMarkdown';
import { ChatModelSelect } from './ChatModelSelect';
import { SessionManagerModal } from './SessionManagerModal';

interface Props {
    source: SourceListItem;
    // Called just before we try to scroll to a clicked citation's target, so
    // the parent can switch to whatever tab that target lives on (e.g. the
    // Insights tab for a source_insight citation) before it's looked up in
    // the DOM. Omit if the panel is rendered somewhere without tabs.
    onBeforeFocusReference?: (domId: string) => void;
}

interface Citation {
    n: number;
    type: string;
    id: string;
    label: string;
    // DOM id to scroll/flash to when this citation is clicked, or null when
    // there's nowhere to jump (e.g. a note citation — this panel doesn't
    // render notes anywhere). Mirrors ChatPanel.tsx's targetDomId so citations
    // behave the same way in both chat surfaces instead of source-chat's
    // being inert text.
    targetDomId: string | null;
}

interface RenderedMessage {
    markdown: string;
    citations: Citation[];
}

// The LLM emits citations as raw SurrealDB record IDs (e.g. `[source:abc]`,
// bare `source:abc`, `[[source:abc]]`, or `[source:a, note:b]` comma-grouped).
// This panel is scoped to a single source, so the only "source" citation that
// ever makes sense is *this* source; insight/note citations are resolved
// against this source's own insight list. Every citation is rewritten into a
// numbered badge (mirroring ChatPanel.tsx's notebook-wide citations) instead
// of the raw id, and a "Sources" footer lists what each number refers to.
//
// The source-chat system prompt tells the model to cite insights with the
// shorthand `insight:<id>`, but the actual SurrealDB table (and the id the
// model copies out of the context) is `source_insight:<id>`. That mismatch
// let raw `insight:xxxx` citations slip past this regex untouched, leaking
// the id straight into the chat. Match the bare `insight` alias too so any
// citation form the model produces gets cleaned up the same way.
const REF_RE = /(source_insight|insight|note|source):([A-Za-z0-9_]+)/g;

const renderCitations = (
    raw: string,
    source: SourceListItem,
    insights: SourceInsight[],
    noteTitles: Record<string, string> = {},
): RenderedMessage => {
    REF_RE.lastIndex = 0;
    const refs: { type: string; id: string; startIndex: number; endIndex: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = REF_RE.exec(raw)) !== null) {
        refs.push({
            type: m[1],
            id: m[2],
            startIndex: m.index,
            endIndex: m.index + m[0].length,
        });
    }
    if (refs.length === 0) {
        return { markdown: raw, citations: [] };
    }

    // This panel is scoped to exactly one source, so a `source:<id>` citation
    // is always self-referential — "see this source" on a page that's
    // entirely about this source is redundant noise, not useful navigation
    // (unlike ChatPanel's notebook-wide citations, where "source" could mean
    // any of several). Strip these out entirely: no citation number, no
    // footer entry, no leftover bracket/text in the message body.
    const isSelfSourceCitation = (type: string) => type === 'source';

    // Insight citations use the `insight:` shorthand while the real record id
    // is `source_insight:...` -- normalize both to the same key so repeated
    // citations of the same insight get the same number regardless of which
    // prefix form the model used.
    const normalizedKey = (type: string, id: string) =>
        type === 'insight' ? `source_insight:${id}` : `${type}:${id}`;

    const order = new Map<string, number>();
    let next = 1;
    for (const r of refs) {
        if (isSelfSourceCitation(r.type)) continue;
        const key = normalizedKey(r.type, r.id);
        if (!order.has(key)) order.set(key, next++);
    }

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
        if (!isSelfSourceCitation(r.type)) {
            const key = normalizedKey(r.type, r.id);
            const n = order.get(key)!;
            markdown += `[${n}](#ref-${key})`;
        }
        // Self-source citations are simply dropped — nothing is written for
        // this span, so the citation (and its surrounding brackets, if any)
        // disappears from the rendered message instead of leaving an empty
        // `[]` or a redundant "This source" reference.
        pos = to;
    }
    if (pos < raw.length) markdown += raw.substring(pos);

    const citations: Citation[] = Array.from(order.entries()).map(([key, n]) => {
        const [type, id] = key.split(':') as [string, string];
        let label: string;
        // targetDomId mirrors ChatPanel.tsx's citation behavior: clicking a
        // citation should jump to the thing it references. Insight citations
        // jump to that insight's card on the Insights tab (see
        // SourceDetailView.tsx). Note citations have nowhere to jump to in
        // this single-source panel, so they stay non-interactive.
        let targetDomId: string | null = null;
        if (type === 'note') {
            label = noteTitles[id] || 'A note';
        } else if (type === 'source_insight') {
            const insight = insights.find((i) => i.id === key);
            label = insight ? insight.insight_type : 'An insight';
            targetDomId = `ref-source_insight-${id}`;
        } else {
            // Unreached in practice — 'source' refs are filtered out above —
            // kept only so this stays exhaustive if REF_RE ever gains a type.
            label = 'This source';
        }
        return { n, type, id, label, targetDomId };
    });

    return { markdown, citations };
};

// Mirrors ChatPanel.tsx's focusReference: scroll to and flash-highlight the
// referenced element. onBeforeFocus lets the caller switch to whatever tab
// the target lives on (e.g. Insights) before we try to find it in the DOM.
const focusReference = (domId: string, onBeforeFocus?: (domId: string) => void) => {
    onBeforeFocus?.(domId);
    const tryFocus = () => {
        const el = document.getElementById(domId);
        if (!el) return false;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('notebook-ref-flash');
        window.setTimeout(() => el.classList.remove('notebook-ref-flash'), 1500);
        return true;
    };
    if (tryFocus()) return;
    // The target may not be mounted yet (e.g. we just switched to the
    // Insights tab) — retry once after the tab's content has rendered.
    window.setTimeout(tryFocus, 50);
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

// Chat scoped to a single source — the backend's source-chat graph always uses
// the full source text as context, so unlike the notebook ChatPanel there are
// no context selections to manage here.
export const SourceChatPanel = ({ source, onBeforeFocusReference }: Props) => {
    const [sessions, setSessions] = useState<SourceChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [draft, setDraft] = useState<string>('');
    const [isSending, setIsSending] = useState<boolean>(false);
    const [loadingSessions, setLoadingSessions] = useState<boolean>(true);
    const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [pendingDelete, setPendingDelete] = useState<SourceChatSession | null>(null);
    const [deleting, setDeleting] = useState<boolean>(false);
    const [showSessions, setShowSessions] = useState<boolean>(false);
    // Model used to answer; '' = deployment default (no override sent).
    const [modelOverride, setModelOverride] = useState<string>('');
    // Whether there's actually more than one model to choose from — when
    // there isn't, showing "Model: <name>" is just branding noise since the
    // user has no choice to make, so the whole label+picker row is hidden
    // (mirrors ChatPanel.tsx).
    const [hasModelAlternatives, setHasModelAlternatives] = useState<boolean>(true);
    // IME composition guard — don't submit on the Enter that confirms a
    // composition (matches the main chat input).
    const [isTyping, setIsTyping] = useState<boolean>(false);
    // Resolves insight citations to a real label (e.g. "Key Topics") instead
    // of a generic "an insight" placeholder.
    const [insights, setInsights] = useState<SourceInsight[]>([]);

    const scrollRef = useRef<HTMLDivElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    // Sessions we created locally in this tab — skip the fetch-on-mount
    // for them so the optimistic user message isn't wiped.
    const locallyCreatedRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        let cancelled = false;
        listSourceInsights(source.id).then((data) => {
            if (!cancelled) setInsights(data);
        });
        return () => {
            cancelled = true;
        };
    }, [source.id]);

    useEffect(() => {
        let cancelled = false;
        // Switching to a different source: the previous source's
        // currentSessionId/messages must not carry over. Without this reset,
        // `curr ?? data[0].id` below is a no-op (curr is already non-null
        // from the old source), so the panel kept showing the OLD source's
        // session/messages — including its self-citations resolving to the
        // old source's own title — after navigating to a new source.
        setCurrentSessionId(null);
        setMessages([]);
        const load = async () => {
            setLoadingSessions(true);
            const data = await listSourceChatSessions(source.id);
            if (cancelled) return;
            setSessions(data);
            if (data.length > 0) {
                setCurrentSessionId((curr) => curr ?? data[0].id);
            }
            setLoadingSessions(false);
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [source.id]);

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
            const session = await getSourceChatSession(source.id, currentSessionId);
            if (cancelled) return;
            if (session) {
                setMessages(session.messages || []);
                // Without this, modelOverride keeps whatever session A had
                // selected after switching to session B — the ChatModelSelect
                // badge would show A's override while the next message to B
                // silently used it too (mirrors ChatPanel.tsx).
                setModelOverride(session.model_override || '');
            }
            setLoadingMessages(false);
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [source.id, currentSessionId]);

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
        const created = await createSourceChatSession(source.id, title);
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
        const updated = await updateSourceChatSession(source.id, sessionId, { title });
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
        const ok = await deleteSourceChatSession(source.id, pendingDelete.id);
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
            const created = await createSourceChatSession(source.id, title);
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

        try {
            const result = await sendSourceChatMessage(
                source.id,
                sessionId,
                text,
                modelOverride || undefined,
            );
            if (!result.success) {
                throw new Error(result.message || 'Failed to send message.');
            }
            // The send route doesn't return the reply — refetch the session for
            // the persisted message list.
            const session = await getSourceChatSession(source.id, sessionId);
            if (session) {
                setMessages(session.messages || []);
            }
            // The optimistic message is now persisted (or at least the send
            // call succeeded) — safe to fetch on future revisits of this
            // session either way.
            locallyCreatedRef.current.delete(sessionId);
        } catch (e: any) {
            setError(e?.message || 'Failed to send message.');
            setMessages((prev) => prev.filter((m) => !m.id.startsWith('temp-')));
            // Send failed: this session (if newly created) still has no
            // persisted messages, so it must stay in locallyCreatedRef —
            // otherwise switching away and back would fetch an empty
            // message list and silently drop the optimistic-but-failed
            // state context. Leave it as-is (no delete on this path).
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
                    Chat with Sources
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
                            <p className="text-sm">Start a conversation about this source</p>
                            <p className="mt-2 text-xs">
                                Ask questions to understand the content better
                            </p>
                        </div>
                    )}
                    {messages.map((m) => (
                        <MessageBubble
                            key={m.id}
                            message={m}
                            source={source}
                            insights={insights}
                            onBeforeFocusReference={onBeforeFocusReference}
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

            {/* Input Area */}
            <div className="flex flex-none flex-col gap-3 border-t border-gray-200 p-4 dark:border-neutral-700">
                {hasModelAlternatives && (
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Model</span>
                        <ChatModelSelect
                            value={modelOverride}
                            onChange={setModelOverride}
                            disabled={isSending}
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
    source,
    insights,
    onBeforeFocusReference,
}: {
    message: ChatMessage;
    source: SourceListItem;
    insights: SourceInsight[];
    onBeforeFocusReference?: (domId: string) => void;
}) => {
    const isHuman = message.type === 'human';
    const [copied, setCopied] = useState<boolean>(false);
    // Real note titles aren't available up front (this panel never loads the
    // notebook's notes — the source-chat graph excludes notes from context
    // entirely, so a `note:` citation shouldn't normally appear, but if the
    // model emits one anyway we still resolve a real title instead of a
    // permanent generic "A note" placeholder).
    const [noteTitles, setNoteTitles] = useState<Record<string, string>>({});

    const rendered = useMemo(
        () => renderCitations(message.content, source, insights, noteTitles),
        [message.content, source, insights, noteTitles],
    );

    useEffect(() => {
        const noteIds = rendered.citations
            .filter((c) => c.type === 'note' && !noteTitles[c.id])
            .map((c) => c.id);
        if (noteIds.length === 0) return;
        let cancelled = false;
        Promise.all(
            noteIds.map(async (id) => {
                const note = await getNote(`note:${id}`);
                return [id, note?.title || '(untitled note)'] as const;
            }),
        ).then((entries) => {
            if (cancelled) return;
            setNoteTitles((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
        });
        return () => {
            cancelled = true;
        };
        // rendered.citations is derived from noteTitles itself; keying off the
        // message content (already a dep of `rendered`) avoids a render loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [message.content]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(message.content);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard unavailable (e.g. insecure context) — nothing to show.
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
                    className={`rounded-lg px-4 py-2 ${
                        isHuman
                            ? 'whitespace-pre-wrap bg-purple-500 text-sm text-white'
                            : 'bg-gray-100 text-gray-800 dark:bg-neutral-700 dark:text-neutral-100'
                    }`}
                >
                    {isHuman ? (
                        message.content
                    ) : (
                        <>
                            <MemoizedReactMarkdown
                                className="prose prose-sm dark:prose-invert max-w-none break-words"
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    // Numbered citations are emitted as
                                    // `[n](#ref-type-id)` links; intercept
                                    // those to scroll/flash the referenced
                                    // source or insight instead of
                                    // navigating (mirrors ChatPanel.tsx).
                                    // Note citations have no target in this
                                    // panel and fall back to an inert badge.
                                    // Real URLs fall through untouched.
                                    a({ href, children, ...props }) {
                                        if (href && href.startsWith('#ref-')) {
                                            const citation = rendered.citations.find(
                                                (c) => `#ref-${c.type}:${c.id}` === href,
                                            );
                                            if (citation?.targetDomId) {
                                                return (
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            focusReference(
                                                                citation.targetDomId!,
                                                                onBeforeFocusReference,
                                                            );
                                                        }}
                                                        className="mx-0.5 inline-flex items-baseline rounded bg-purple-200 px-1 font-mono text-[11px] font-medium text-purple-800 hover:bg-purple-300 dark:bg-purple-900/40 dark:text-purple-300 dark:hover:bg-purple-900/60"
                                                        title="Jump to reference"
                                                    >
                                                        {children}
                                                    </button>
                                                );
                                            }
                                            return (
                                                <span className="mx-0.5 inline-flex items-baseline rounded bg-purple-200 px-1 font-mono text-[11px] font-medium text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                                                    {children}
                                                </span>
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
                            {rendered.citations.length > 0 && (
                                <div className="mt-2 border-t border-gray-300 pt-1.5 text-[11px] text-gray-600 dark:border-neutral-600 dark:text-gray-300">
                                    <div className="mb-0.5 font-medium">Sources</div>
                                    <ol className="m-0 list-none space-y-0.5 p-0">
                                        {rendered.citations.map((c) =>
                                            c.targetDomId ? (
                                                <li key={c.n}>
                                                    <button
                                                        onClick={() =>
                                                            focusReference(
                                                                c.targetDomId!,
                                                                onBeforeFocusReference,
                                                            )
                                                        }
                                                        className="text-left hover:underline"
                                                        title={`Jump to ${c.type}`}
                                                    >
                                                        <span className="font-mono">
                                                            [{c.n}]
                                                        </span>{' '}
                                                        {c.label}
                                                        {c.type !== 'source' && (
                                                            <span className="ml-1 opacity-60">
                                                                (insight)
                                                            </span>
                                                        )}
                                                    </button>
                                                </li>
                                            ) : (
                                                <li key={c.n}>
                                                    <span className="font-mono">[{c.n}]</span>{' '}
                                                    {c.label}
                                                    <span className="ml-1 opacity-60">
                                                        (note)
                                                    </span>
                                                </li>
                                            ),
                                        )}
                                    </ol>
                                </div>
                            )}
                        </>
                    )}
                </div>
                {!isHuman && (
                    <div className="flex gap-1">
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

export default SourceChatPanel;
