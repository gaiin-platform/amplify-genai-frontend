import { useEffect, useMemo, useRef, useState } from 'react';
import {
    IconClock,
    IconMessage,
    IconPlus,
    IconRobot,
    IconSend,
    IconTrash,
} from '@tabler/icons-react';
import remarkGfm from 'remark-gfm';
import {
    ChatMessage,
    SourceChatSession,
    SourceListItem,
    createSourceChatSession,
    deleteSourceChatSession,
    getSourceChatSession,
    listSourceChatSessions,
    sendSourceChatMessage,
} from '@/services/notebookService';
import { ConfirmModal } from '@/components/ReusableComponents/ConfirmModal';
import { Modal } from '@/components/ReusableComponents/Modal';
import { MemoizedReactMarkdown } from '@/components/Markdown/MemoizedReactMarkdown';
import { ChatModelSelect } from './ChatModelSelect';

interface Props {
    source: SourceListItem;
}

// Mirrors components/Chat/ChatInput.tsx: on mobile, Enter inserts a newline
// (send is via the button) rather than submitting.
const isMobile = () => {
    const userAgent = typeof window.navigator === 'undefined' ? '' : navigator.userAgent;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(
        userAgent,
    );
};

const COMPOSER_MAX_HEIGHT = 160;

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

    const currentSession = useMemo(
        () => sessions.find((s) => s.id === currentSessionId) ?? null,
        [sessions, currentSessionId],
    );

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

    const handleNewSession = () => {
        // Defer backend creation until the first message is sent, so the session
        // is named from its content (see handleSend) instead of a placeholder.
        setCurrentSessionId(null);
        setMessages([]);
        setError(null);
        setShowSessions(false);
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
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36] flex flex-col h-[640px] lg:h-full lg:min-h-0">
            <div className="flex items-center gap-2 border-b border-gray-200 px-6 py-4 dark:border-neutral-700">
                <IconRobot size={20} className="text-purple-500" />
                <div className="text-lg font-semibold">Chat</div>
                {currentSession && (
                    <span
                        className="max-w-[160px] truncate text-xs text-gray-400 dark:text-gray-500"
                        title={currentSession.title}
                    >
                        {currentSession.title}
                    </span>
                )}

                <button
                    onClick={() => setShowSessions(true)}
                    disabled={loadingSessions}
                    title="Chat sessions"
                    className="ml-auto flex h-8 items-center gap-1.5 rounded-md bg-purple-500 px-3 text-xs font-medium text-white shadow-sm hover:bg-purple-600 transition-colors disabled:opacity-50"
                >
                    <IconClock size={14} />
                    Sessions
                </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {loadingMessages && messages.length === 0 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">Loading messages…</div>
                )}
                {!loadingMessages && messages.length === 0 && !isSending && (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-xs text-gray-500 dark:text-gray-400">
                        <IconRobot size={40} className="opacity-40" />
                        <div>
                            Ask a question about this source.
                            <br />
                            <span className="opacity-70">Press Enter to send · Shift+Enter for newline</span>
                        </div>
                    </div>
                )}
                {messages.map((m) => (
                    <MessageBubble key={m.id} message={m} />
                ))}
                {isSending && (
                    <div className="flex items-start gap-2">
                        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/40">
                            <IconRobot size={16} className="text-purple-600 dark:text-purple-300" />
                        </div>
                        <div className="rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-500 dark:bg-neutral-700 dark:text-gray-300">
                            <span className="inline-flex gap-1">
                                <span className="animate-pulse">●</span>
                                <span className="animate-pulse" style={{ animationDelay: '150ms' }}>●</span>
                                <span className="animate-pulse" style={{ animationDelay: '300ms' }}>●</span>
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <div className="border-t border-red-200 bg-red-50 px-6 py-2 text-xs text-red-600 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                    {error}
                </div>
            )}

            <div className="border-t border-gray-200 p-4 dark:border-neutral-700 space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">Model</span>
                    <ChatModelSelect
                        value={modelOverride}
                        onChange={setModelOverride}
                        disabled={isSending}
                    />
                </div>
                <div className="flex items-end gap-2">
                    <textarea
                        ref={textareaRef}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onCompositionStart={() => setIsTyping(true)}
                        onCompositionEnd={() => setIsTyping(false)}
                        placeholder="Ask about this source…"
                        rows={2}
                        disabled={isSending}
                        className="flex-1 resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400 dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100 min-h-[3.5rem]"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!draft.trim() || isSending}
                        title="Send"
                        className="flex h-10 w-10 items-center justify-center rounded-md bg-purple-500 text-white shadow-sm transition-colors hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <IconSend size={16} />
                    </button>
                </div>
            </div>

            {showSessions && (
                <Modal
                    title="Chat Sessions"
                    onCancel={() => setShowSessions(false)}
                    showSubmit={false}
                    cancelLabel="Close"
                    width={() => 420}
                    height={() => Math.min(520, window.innerHeight * 0.85)}
                    content={
                        <div className="flex flex-col gap-3 p-2 text-neutral-800 dark:text-neutral-100">
                            <button
                                onClick={handleNewSession}
                                className="flex items-center justify-center gap-1 rounded-md bg-purple-500 px-2 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-purple-600 transition-colors"
                            >
                                <IconPlus size={12} />
                                New Session
                            </button>

                            {sessions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 text-center">
                                    <IconMessage
                                        size={36}
                                        className="mb-3 text-gray-300 dark:text-neutral-600"
                                    />
                                    <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                        No sessions yet
                                    </div>
                                    <p className="mt-1 max-w-[220px] text-xs text-gray-500 dark:text-gray-400">
                                        Send your first message to start a session.
                                    </p>
                                </div>
                            ) : (
                                <ul className="space-y-1 overflow-y-auto pr-1">
                                    {sessions.map((s) => (
                                        <li
                                            key={s.id}
                                            className={`group flex items-center gap-2 rounded-lg border p-2.5 transition-colors ${
                                                s.id === currentSessionId
                                                    ? 'border-purple-300 bg-purple-50/60 dark:border-purple-500/60 dark:bg-purple-900/10'
                                                    : 'border-gray-200 bg-white hover:border-purple-300 dark:border-neutral-700 dark:bg-[#343541] dark:hover:border-purple-500/60'
                                            }`}
                                        >
                                            <button
                                                onClick={() => {
                                                    setCurrentSessionId(s.id);
                                                    setShowSessions(false);
                                                }}
                                                className="min-w-0 flex-1 text-left"
                                                title={s.title}
                                            >
                                                <span className="block truncate text-sm font-medium">
                                                    {s.title}
                                                </span>
                                                <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                                                    {typeof s.message_count === 'number'
                                                        ? `${s.message_count} message${
                                                              s.message_count === 1 ? '' : 's'
                                                          }`
                                                        : ''}
                                                </span>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setPendingDelete(s);
                                                    setShowSessions(false);
                                                }}
                                                title="Delete session"
                                                className="invisible rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 group-hover:visible dark:text-gray-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                                            >
                                                <IconTrash size={14} />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    }
                />
            )}

            {pendingDelete && (
                <ConfirmModal
                    title="Delete chat session?"
                    message={
                        <span>
                            Delete <b>{pendingDelete.title}</b>? Its messages will be lost. This can&apos;t be undone.
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

const MessageBubble = ({ message }: { message: ChatMessage }) => {
    const isHuman = message.type === 'human';
    return (
        <div className={`flex items-start gap-2 ${isHuman ? 'justify-end' : 'justify-start'}`}>
            {!isHuman && (
                <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/40">
                    <IconRobot size={16} className="text-purple-600 dark:text-purple-300" />
                </div>
            )}
            <div
                className={`max-w-[85%] rounded-lg px-4 py-2 text-sm ${
                    isHuman
                        ? 'bg-purple-500 text-white whitespace-pre-wrap'
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
                        {message.content}
                    </MemoizedReactMarkdown>
                )}
            </div>
        </div>
    );
};

export default SourceChatPanel;
