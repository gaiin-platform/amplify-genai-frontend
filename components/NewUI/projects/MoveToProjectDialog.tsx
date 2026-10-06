import React, { useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { IconCheck, IconStack2, IconX } from '@tabler/icons-react';
import { Conversation } from '@/types/chat';
import { useDialogA11y } from './useDialogA11y';
import { useMoveConversationToProject } from './useMoveConversationToProject';
import { useProjectRegistry } from './projectRegistry';

interface MoveToProjectDialogProps {
    conversation: Conversation;
    onClose: () => void;
}

/** Pick a project for a chat (or remove it from its project). */
export const MoveToProjectDialog: React.FC<MoveToProjectDialogProps> = ({ conversation, onClose }) => {
    const panelRef = useRef<HTMLDivElement>(null);
    const [search, setSearch] = useState('');
    const { active, loaded } = useProjectRegistry(true);
    const move = useMoveConversationToProject();
    useDialogA11y(true, panelRef, onClose);

    const term = search.trim().toLowerCase();
    const visible = useMemo(
        () => active.filter((p) => !term || p.name.toLowerCase().includes(term)),
        [active, term],
    );

    const choose = async (projectId: string | null, name?: string) => {
        onClose();
        if (projectId !== (conversation.projectId ?? null)) await move(conversation, projectId, name);
    };

    if (typeof document === 'undefined') return null;
    return ReactDOM.createPortal(
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 p-4"
            onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="move-project-title"
                tabIndex={-1}
                className="flex max-h-[80vh] w-full max-w-[400px] flex-col rounded-xl p-4 outline-none"
                style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            >
                <div className="mb-3 flex items-center justify-between">
                    <h2 id="move-project-title" className="text-base font-semibold">Move to project</h2>
                    <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 hover:bg-[--bg-hover] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]">
                        <IconX size={18} aria-hidden="true" />
                    </button>
                </div>
                <p className="mb-3 truncate text-xs" style={{ color: 'var(--text-muted)' }} title={conversation.name}>
                    “{conversation.name || 'New Conversation'}”
                </p>
                {active.length > 6 && (
                    <>
                        <label htmlFor="move-project-search" className="sr-only">Search projects</label>
                        <input
                            id="move-project-search"
                            data-autofocus
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search projects…"
                            className="mb-2 w-full rounded-md p-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
                            style={{ background: 'var(--bg-app)', border: '1px solid var(--border-subtle)' }}
                        />
                    </>
                )}
                <div className="min-h-0 flex-1 overflow-y-auto">
                    {!loaded && <div role="status" className="px-2 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>Loading projects…</div>}
                    {loaded && active.length === 0 && (
                        <div className="px-2 py-3 text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
                            You have no active projects. Create one from Projects in the sidebar.
                        </div>
                    )}
                    <ul>
                        {visible.map((project) => {
                            const current = project.id === conversation.projectId;
                            return (
                                <li key={project.id}>
                                    <button
                                        type="button"
                                        onClick={() => choose(project.id, project.name)}
                                        aria-current={current ? 'true' : undefined}
                                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-[--bg-hover] focus:bg-[--bg-hover] focus:outline-none"
                                    >
                                        <IconStack2 size={15} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                                        <span className="min-w-0 flex-1 truncate">{project.name}</span>
                                        {current && <IconCheck size={14} aria-label="Current project" />}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
                {conversation.projectId && (
                    <button
                        type="button"
                        onClick={() => choose(null)}
                        className="mt-3 rounded-lg border px-3 py-2 text-sm hover:bg-[--bg-hover] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
                        style={{ borderColor: 'var(--border-subtle)' }}
                    >
                        Remove from project
                    </button>
                )}
            </div>
        </div>,
        document.body,
    );
};

export default MoveToProjectDialog;
