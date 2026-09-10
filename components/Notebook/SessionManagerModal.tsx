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
import { Modal } from '@/components/ReusableComponents/Modal';
import { formatDistanceToNow } from './relativeTime';

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
        <Modal
            title="Sessions"
            onCancel={onClose}
            showSubmit={false}
            cancelLabel="Close"
            width={() => 420}
            height={() => Math.min(560, window.innerHeight * 0.85)}
            content={
                <div className="flex flex-col gap-3 p-2 text-neutral-800 dark:text-neutral-100">
                    <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 font-semibold">
                            <LucideMessageSquare size={20} />
                            Sessions
                        </span>
                        <button
                            onClick={() => setIsCreating(true)}
                            title="New session"
                            className="inline-flex h-8 items-center justify-center rounded-md border border-gray-300 bg-white px-3 shadow-sm transition-colors hover:bg-gray-50 dark:border-neutral-600 dark:bg-transparent dark:hover:bg-neutral-700"
                        >
                            <LucidePlus size={16} />
                        </button>
                    </div>

                    {isCreating && (
                        <div className="rounded-lg border border-gray-200 p-3 dark:border-neutral-700">
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
                                className="mb-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={create}
                                    className="inline-flex h-8 items-center rounded-md bg-purple-500 px-3 text-sm font-medium text-white shadow-sm hover:bg-purple-600"
                                >
                                    New
                                </button>
                                <button
                                    onClick={() => {
                                        setIsCreating(false);
                                        setNewTitle('');
                                    }}
                                    className="inline-flex h-8 items-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium shadow-sm hover:bg-gray-50 dark:border-neutral-600 dark:bg-transparent dark:hover:bg-neutral-700"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {loadingSessions ? (
                        <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                            Loading...
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="py-8 text-center text-gray-500 dark:text-gray-400">
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
                                            ? 'border-purple-400 bg-purple-500/10 dark:border-purple-500/60'
                                            : 'border-gray-200 hover:bg-gray-50 dark:border-neutral-700 dark:hover:bg-neutral-700/40'
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
                                                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100"
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={saveEdit}
                                                    className="inline-flex h-8 items-center rounded-md bg-purple-500 px-3 text-white shadow-sm hover:bg-purple-600"
                                                >
                                                    <LucideCheck size={12} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setEditingId(null);
                                                        setEditTitle('');
                                                    }}
                                                    className="inline-flex h-8 items-center rounded-md border border-gray-300 bg-white px-3 shadow-sm hover:bg-gray-50 dark:border-neutral-600 dark:bg-transparent dark:hover:bg-neutral-700"
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
                                                        className="flex h-6 w-6 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-neutral-700 dark:hover:text-white"
                                                    >
                                                        <LucidePencil size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => onDelete(session)}
                                                        title="Delete session"
                                                        className="flex h-6 w-6 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-red-600 dark:text-gray-400 dark:hover:bg-neutral-700 dark:hover:text-red-400"
                                                    >
                                                        <LucideTrash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                <LucideClock size={12} />
                                                {formatDistanceToNow(session.created)}
                                            </div>
                                            {session.message_count != null &&
                                                session.message_count > 0 && (
                                                    <span className="mt-2 inline-flex items-center rounded-md border border-transparent bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-neutral-700 dark:text-gray-200">
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
            }
        />
    );
};

export default SessionManagerModal;
