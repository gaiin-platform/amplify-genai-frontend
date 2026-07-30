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
    SourceListItem,
    createSourceChatSession,
    deleteSourceChatSession,
    getSourceChatSession,
    listSourceChatSessions,
    sendSourceChatMessage,
    updateSourceChatSession,
} from '@/services/notebookService';
import { ConfirmModal } from '@/components/ReusableComponents/ConfirmModal';
import { MemoizedReactMarkdown } from '@/components/Markdown/MemoizedReactMarkdown';
import { ChatModelSelect } from './ChatModelSelect';
import { SessionManagerModal } from './SessionManagerModal';

interface Props {
    source: SourceListItem;
}

// The LLM emits citations as raw SurrealDB record IDs (e.g. `[source:abc]`,
// bare `source:abc`, `[[source:abc]]`, or `[source:a, note:b]` comma-grouped).
// This panel is scoped to a single source, so unlike ChatPanel.tsx there's no
// sources/notes list to resolve a title from -- just replace any citation of
// *this* source with its real title, and anything else with a generic label,
// so the raw id never leaks into the rendered message.
const REF_RE = /(source_insight|note|source):([A-Za-z0-9_]+)/g;

const cleanCitations = (raw: string, source: SourceListItem): string => {
    REF_RE.lastIndex = 0;
    let out = '';
    let pos = 0;
    let m: RegExpExecArray | null;
    while ((m = REF_RE.exec(raw)) !== null) {
        const [full, type, id] = m;
        const start = m.index;
        const end = start + full.length;
        const before = raw.substring(Math.max(0, start - 2), start);
        const after = raw.substring(end, Math.min(raw.length, end + 2));
        let from = start;
        let to = end;
        if (before === '[[' && after.startsWith(']]')) {
            from = start - 2;
            to = end + 2;
        } else if (before.endsWith('[') && after.startsWith(']')) {
            from = start - 1;
            to = end + 1;
        }
        if (from > pos) out += raw.substring(pos, from);
        const fullId = `${type}:${id}`;
        const label =
            type === 'source' && fullId === source.id
                ? source.title || 'this source'
                : type === 'note'
                  ? 'a note'
                  : type === 'source_insight'
                    ? 'an insight'
                    : 'this source';
        out += `*(${label})*`;
        pos = to;
    }
    if (pos < raw.length) out += raw.substring(pos);
    return out;
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
export const SourceChatPanel = ({ source }: Props) => {
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
    // IME composition guard — don't submit on the Enter that confirms a
    // composition (matches the main chat input).
    const [isTyping, setIsTyping] = useState<boolean>(false);

    const scrollRef = useRef<HTMLDivElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    // Sessions we created locally in this tab — skip the fetch-on-mount
    // for them so the optimistic user message isn't wiped.
    const locallyCreatedRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        let cancelled = false;
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
            if (session) setMessages(session.messages || []);
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
        setIsSending(true);

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
                // The optimistic message is now persisted; safe to fetch on
                // future revisits of this session.
                locallyCreatedRef.current.delete(sessionId);
            }
        } catch (e: any) {
            setError(e?.message || 'Failed to send message.');
            setMessages((prev) => prev.filter((m) => !m.id.startsWith('temp-')));
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
                        <MessageBubble key={m.id} message={m} source={source} />
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
                <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Model</span>
                    <ChatModelSelect
                        value={modelOverride}
                        onChange={setModelOverride}
                        disabled={isSending}
                    />
                </div>
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
}: {
    message: ChatMessage;
    source: SourceListItem;
}) => {
    const isHuman = message.type === 'human';
    const [copied, setCopied] = useState<boolean>(false);

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
                        <MemoizedReactMarkdown
                            className="prose prose-sm dark:prose-invert max-w-none break-words"
                            remarkPlugins={[remarkGfm]}
                        >
                            {cleanCitations(message.content, source)}
                        </MemoizedReactMarkdown>
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
