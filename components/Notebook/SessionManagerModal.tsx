import { useState } from 'react';
import {
    LucideCheck,
    LucideClock,
    LucideMessageSquare,
    LucidePencil,
    LucidePlus,
    LucideTrash2,
    LucideX,
} from './LucideIcons';
import { CreationModalShell } from '@/components/NewUI/shared/CreationModalShell';
import { formatDistanceToNow } from './relativeTime';
import { outlineSmButtonClass, primaryButtonSmClass, secondaryBadgeClass } from './notebookUI';

export interface SessionSummary {
    id: string;
    title: string;
    created?: string;
    message_count?: number | null;
}

interface Props<T extends SessionSummary> {
    sessions: T[];
    currentSessionId: string | null;
    loadingSessions: boolean;
    onClose: () => void;
    onCreate: (title: string) => void;
    onSelect: (sessionId: string) => void;
    onRename: (sessionId: string, title: string) => void;
    onDelete: (session: T) => void;
}

// Sessions dialog mirroring the reference SessionManager: create with a title
// input, inline rename, relative created time, and message-count badges.
// Shared by the notebook ChatPanel and SourceChatPanel.
export const SessionManagerModal = <T extends SessionSummary>({
    sessions,
    currentSessionId,
    loadingSessions,
    onClose,
    onCreate,
    onSelect,
    onRename,
    onDelete,
}: Props<T>) => {
    const [isCreating, setIsCreating] = useState<boolean>(false);
    const [newTitle, setNewTitle] = useState<string>('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState<string>('');

    const create = () => {
        if (!newTitle.trim()) return;
        onCreate(newTitle.trim());
        setNewTitle('');
        setIsCreating(false);
    };

    const saveEdit = () => {
        if (editingId && editTitle.trim()) {
            onRename(editingId, editTitle.trim());
        }
        setEditingId(null);
        setEditTitle('');
    };

    return (
        <CreationModalShell title="Sessions" onClose={onClose}>
                <div className="flex flex-col gap-3 p-2 text-[--text-primary]">
                    <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 font-semibold">
                            <LucideMessageSquare size={20} />
                            Sessions
                        </span>
                        <button
                            onClick={() => setIsCreating(true)}
                            title="New session"
                            className={outlineSmButtonClass}
                        >
                            <LucidePlus size={16} />
                        </button>
                    </div>

                    {isCreating && (
                        <div className="rounded-lg border border-[--border-subtle] p-3">
                            <input
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') create();
                                    if (e.key === 'Escape') {
                                        setIsCreating(false);
                                        setNewTitle('');
                                    }
                                }}
                                placeholder="Type a title here..."
                                autoFocus
                                className="mb-2 w-full rounded-md border border-[--border-subtle] bg-[--bg-composer] px-3 py-2 text-sm text-[--text-primary]"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={create}
                                    className={primaryButtonSmClass}
                                >
                                    New
                                </button>
                                <button
                                    onClick={() => {
                                        setIsCreating(false);
                                        setNewTitle('');
                                    }}
                                    className={outlineSmButtonClass}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {loadingSessions ? (
                        <div className="py-8 text-center text-[--text-muted]">
                            Loading...
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="py-8 text-center text-[--text-muted]">
                            <LucideMessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                            <p className="text-sm">No chat sessions yet</p>
                            <p className="mt-2 text-xs">Create a session to start.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 overflow-y-auto pb-2 pr-1">
                            {sessions.map((session) => (
                                <div
                                    key={session.id}
                                    onClick={() => onSelect(session.id)}
                                    className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                                        currentSessionId === session.id
                                            ? 'border-[--accent]/60 bg-[--accent]/10'
                                            : 'border-[--border-subtle] hover:bg-[--bg-hover]'
                                    }`}
                                >
                                    {editingId === session.id ? (
                                        <div
                                            className="flex flex-col gap-2"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <input
                                                value={editTitle}
                                                onChange={(e) => setEditTitle(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') saveEdit();
                                                    if (e.key === 'Escape') {
                                                        setEditingId(null);
                                                        setEditTitle('');
                                                    }
                                                }}
                                                autoFocus
                                                className="w-full rounded-md border border-[--border-subtle] bg-[--bg-composer] px-3 py-2 text-sm text-[--text-primary]"
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={saveEdit}
                                                    className="inline-flex h-8 items-center rounded-md bg-[--accent] px-3 text-[--accent-fg] shadow-sm hover:opacity-90"
                                                >
                                                    <LucideCheck size={12} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setEditingId(null);
                                                        setEditTitle('');
                                                    }}
                                                    className={outlineSmButtonClass}
                                                >
                                                    <LucideX size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="mb-1 flex items-start justify-between">
                                                <h4 className="min-w-0 truncate text-sm font-medium">
                                                    {session.title}
                                                </h4>
                                                <div
                                                    className="flex flex-none gap-1"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <button
                                                        onClick={() => {
                                                            setEditingId(session.id);
                                                            setEditTitle(session.title);
                                                        }}
                                                        title="Rename session"
                                                        className="flex h-6 w-6 items-center justify-center rounded-md text-[--text-muted] hover:bg-[--bg-hover] hover:text-[--text-secondary]"
                                                    >
                                                        <LucidePencil size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => onDelete(session)}
                                                        title="Delete session"
                                                        className="flex h-6 w-6 items-center justify-center rounded-md text-[--text-muted] hover:bg-[--bg-hover] hover:text-[--text-error]"
                                                    >
                                                        <LucideTrash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-[--text-muted]">
                                                <LucideClock size={12} />
                                                {formatDistanceToNow(session.created)}
                                            </div>
                                            {session.message_count != null &&
                                                session.message_count > 0 && (
                                                    <span className={`mt-2 ${secondaryBadgeClass}`}>
                                                        {session.message_count} messages
                                                    </span>
                                                )}
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
        </CreationModalShell>
    );
};

export default SessionManagerModal;
