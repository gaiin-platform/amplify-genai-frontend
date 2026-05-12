import { useEffect, useMemo, useRef, useState } from 'react';
import {
    IconPlus,
    IconSend,
    IconTrash,
    IconChevronDown,
} from '@tabler/icons-react';
import {
    ChatMessage,
    ChatSession,
    ContextSelections,
    buildChatContext,
    createChatSession,
    deleteChatSession,
    getChatSession,
    listChatSessions,
    sendChatMessage,
} from '@/services/notebookChatService';
import { SourceListItem } from '@/services/notebookSourcesService';
import { Note } from '@/services/notebookNotesService';
import { ConfirmModal } from '@/components/ReusableComponents/ConfirmModal';

interface Props {
    notebookId: string;
    contextSelections: ContextSelections;
    sources: SourceListItem[];
    notes: Note[];
}

// The LLM emits citations as raw SurrealDB record IDs (e.g. `[source:abc]`,
// `source:abc` bare, `[[source:abc]]`, or `[source:a, note:b]` comma-grouped).
// Ported from open-notebook's convertReferencesToCompactMarkdown so we cover the
// same edge cases. Output is a segment list (mix of plain text + numbered
// citation buttons) plus an ordered citation list for the footer.
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
    targetDomId: string;
}
interface RenderedMessage {
    segments: Segment[];
    citations: Citation[];
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

const renderCitations = (
    raw: string,
    sources: SourceListItem[],
    notes: Note[],
): RenderedMessage => {
    const refs = parseRefs(raw);
    if (refs.length === 0) {
        return { segments: [{ kind: 'text', text: raw }], citations: [] };
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

    return { segments, citations };
};

const focusReference = (domId: string) => {
    const el = document.getElementById(domId);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('notebook-ref-flash');
    window.setTimeout(() => el.classList.remove('notebook-ref-flash'), 1500);
};

export const ChatPanel = ({ notebookId, contextSelections, sources, notes }: Props) => {
    const sourceCount = sources.length;
    const noteCount = notes.length;
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
    const [showSessionPicker, setShowSessionPicker] = useState<boolean>(false);

    const scrollRef = useRef<HTMLDivElement | null>(null);
    const pickerRef = useRef<HTMLDivElement | null>(null);
    // Sessions we created locally in this tab — skip the fetch-on-mount
    // for them so the optimistic user message isn't wiped.
    const locallyCreatedRef = useRef<Set<string>>(new Set());

    const currentSession = useMemo(
        () => sessions.find((s) => s.id === currentSessionId) ?? null,
        [sessions, currentSessionId],
    );

    const includedCount = useMemo(() => {
        let s = 0;
        let n = 0;
        for (const m of Object.values(contextSelections.sources)) if (m !== 'off') s++;
        for (const m of Object.values(contextSelections.notes)) if (m !== 'off') n++;
        return { s, n };
    }, [contextSelections]);

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
            if (session) setMessages(session.messages || []);
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

    useEffect(() => {
        if (!showSessionPicker) return;
        const onClick = (e: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
                setShowSessionPicker(false);
            }
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [showSessionPicker]);

    const handleNewSession = async () => {
        const created = await createChatSession(notebookId);
        if (!created) {
            setError('Failed to create session.');
            return;
        }
        locallyCreatedRef.current.add(created.id);
        setSessions((prev) => [created, ...prev]);
        setCurrentSessionId(created.id);
        setMessages([]);
        setShowSessionPicker(false);
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

        let sessionId = currentSessionId;
        if (!sessionId) {
            const title = text.length > 30 ? `${text.slice(0, 30)}…` : text;
            const created = await createChatSession(notebookId, title);
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
            const ctxResp = await buildChatContext(notebookId, contextSelections);
            if (!ctxResp) {
                throw new Error('Failed to build context.');
            }
            const result = await sendChatMessage(sessionId, text, ctxResp.context);
            if (!result) {
                throw new Error('Failed to send message.');
            }
            setMessages(result.messages);
        } catch (e: any) {
            setError(e?.message || 'Failed to send message.');
            setMessages((prev) => prev.filter((m) => !m.id.startsWith('temp-')));
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36] flex flex-col h-[640px]">
            <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-neutral-700">
                <div className="text-sm font-semibold">Chat</div>

                <div ref={pickerRef} className="relative ml-auto">
                    <button
                        onClick={() => setShowSessionPicker((v) => !v)}
                        className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 dark:border-neutral-600 dark:text-gray-300 dark:hover:bg-neutral-700"
                        title="Switch session"
                    >
                        <span className="max-w-[140px] truncate">
                            {currentSession?.title || (loadingSessions ? 'Loading…' : 'New session')}
                        </span>
                        <IconChevronDown size={12} />
                    </button>
                    {showSessionPicker && (
                        <div className="absolute right-0 top-full z-20 mt-1 w-64 max-h-72 overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-[#202123]">
                            <button
                                onClick={handleNewSession}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                            >
                                <IconPlus size={12} />
                                New session
                            </button>
                            {sessions.length > 0 && (
                                <div className="my-1 border-t border-gray-100 dark:border-neutral-700/60" />
                            )}
                            {sessions.map((s) => (
                                <div
                                    key={s.id}
                                    className={`group flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-neutral-700/60 ${
                                        s.id === currentSessionId ? 'bg-gray-50 dark:bg-neutral-700/40' : ''
                                    }`}
                                >
                                    <button
                                        onClick={() => {
                                            setCurrentSessionId(s.id);
                                            setShowSessionPicker(false);
                                        }}
                                        className="flex-1 truncate text-left"
                                        title={s.title}
                                    >
                                        {s.title}
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPendingDelete(s);
                                            setShowSessionPicker(false);
                                        }}
                                        title="Delete session"
                                        className="invisible rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 group-hover:visible dark:text-gray-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                                    >
                                        <IconTrash size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50/60 px-4 py-2 text-[11px] text-gray-500 dark:border-neutral-700/60 dark:bg-neutral-800/40 dark:text-gray-400">
                <span>Context:</span>
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                    {includedCount.s}/{sourceCount} sources
                </span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    {includedCount.n}/{noteCount} notes
                </span>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {loadingMessages && messages.length === 0 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">Loading messages…</div>
                )}
                {!loadingMessages && messages.length === 0 && !isSending && (
                    <div className="flex h-full items-center justify-center text-center text-xs text-gray-500 dark:text-gray-400">
                        <div>
                            Ask a question about your sources.
                            <br />
                            <span className="opacity-70">Press Enter to send · Shift+Enter for newline</span>
                        </div>
                    </div>
                )}
                {messages.map((m) => (
                    <MessageBubble key={m.id} message={m} sources={sources} notes={notes} />
                ))}
                {isSending && (
                    <div className="flex items-start gap-2">
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
                <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-600 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                    {error}
                </div>
            )}

            <div className="border-t border-gray-200 p-3 dark:border-neutral-700">
                <div className="flex items-end gap-2">
                    <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask anything…"
                        rows={2}
                        disabled={isSending}
                        className="flex-1 resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400 dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!draft.trim() || isSending}
                        title="Send"
                        className="flex h-9 w-9 items-center justify-center rounded-md bg-purple-500 text-white shadow-sm transition-colors hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <IconSend size={16} />
                    </button>
                </div>
            </div>

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

const MessageBubble = ({
    message,
    sources,
    notes,
}: {
    message: ChatMessage;
    sources: SourceListItem[];
    notes: Note[];
}) => {
    const isHuman = message.type === 'human';
    const rendered: RenderedMessage = isHuman
        ? { segments: [{ kind: 'text', text: message.content }], citations: [] }
        : renderCitations(message.content, sources, notes);
    return (
        <div className={`flex ${isHuman ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    isHuman
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-100 text-gray-800 dark:bg-neutral-700 dark:text-neutral-100'
                }`}
            >
                {rendered.segments.map((seg, i) =>
                    seg.kind === 'text' ? (
                        <span key={i}>{seg.text}</span>
                    ) : (
                        <button
                            key={i}
                            onClick={() => focusReference(`ref-${seg.type}-${seg.id}`)}
                            className="mx-0.5 inline-flex items-baseline rounded bg-purple-100 px-1 font-mono text-[11px] font-medium text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:hover:bg-purple-900/60"
                            title={`Jump to ${seg.type}`}
                        >
                            {seg.n}
                        </button>
                    ),
                )}
                {rendered.citations.length > 0 && (
                    <div className="mt-2 border-t border-gray-300 pt-1.5 text-[11px] text-gray-600 dark:border-neutral-600 dark:text-gray-300">
                        <div className="font-medium mb-0.5">Sources</div>
                        <ol className="m-0 list-none p-0 space-y-0.5">
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
        </div>
    );
};

export default ChatPanel;
