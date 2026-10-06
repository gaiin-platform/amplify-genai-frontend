import React, { useState } from 'react';
import { IconCheck, IconLock, IconPencil, IconX } from '@tabler/icons-react';
import { Project, ProjectMemory } from '@/types/project';
import { DialogShell, fieldCls, fieldStyle, ghostBtnCls, primaryBtnCls } from './DialogShell';
import type { LoadState } from './useProjectResources';

interface ProjectMemoryDialogProps {
    project: Project;
    memories: ProjectMemory[];
    state: LoadState;
    onRetry: () => void;
    onToggleMemory: () => void;
    onApprove: (memory: ProjectMemory, content?: string) => Promise<boolean>;
    onApproveAll: () => void;
    onSaveEdit: (memory: ProjectMemory, content: string) => Promise<boolean>;
    onDismiss: (memory: ProjectMemory) => void;
    onConfirmDelete: (memory: ProjectMemory) => void;
    onClose: () => void;
}

const iconBtn = 'rounded-md p-1.5 hover:bg-[--bg-hover] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]';

export const ProjectMemoryDialog: React.FC<ProjectMemoryDialogProps> = ({
    project, memories, state, onRetry, onToggleMemory, onApprove, onApproveAll, onSaveEdit, onDismiss, onConfirmDelete, onClose,
}) => {
    const archived = project.status === 'archived';
    const [editingId, setEditingId] = useState<string | null>(null);
    const [text, setText] = useState('');
    const pending = memories.filter((m) => m.status !== 'approved');
    const approved = memories.filter((m) => m.status === 'approved');

    const commit = async (memory: ProjectMemory) => {
        const value = text.trim();
        if (!value) return;
        const ok = memory.status === 'approved' ? await onSaveEdit(memory, value) : await onApprove(memory, value);
        if (ok) setEditingId(null);
    };

    const row = (memory: ProjectMemory, actions: React.ReactNode, dashed = false) => (
        <li key={memory.id} className={`rounded-xl p-3 ${dashed ? 'border border-dashed' : ''}`} style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-app)' }}>
            {editingId === memory.id ? (
                <div className="flex flex-col gap-2">
                    <label className="sr-only" htmlFor={`mem-${memory.id}`}>Edit memory</label>
                    <textarea
                        id={`mem-${memory.id}`}
                        autoFocus
                        value={text}
                        maxLength={1000}
                        rows={3}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setEditingId(null); } }}
                        className={`${fieldCls} resize-none`}
                        style={fieldStyle}
                    />
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setEditingId(null)} className={ghostBtnCls}>Cancel</button>
                        <button type="button" onClick={() => commit(memory)} disabled={!text.trim()} className={primaryBtnCls} style={{ background: 'var(--accent)' }}>
                            {memory.status === 'approved' ? 'Save' : 'Save & approve'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 break-words text-sm leading-5">{memory.content}</p>
                    <div className="flex flex-shrink-0 items-center">{actions}</div>
                </div>
            )}
        </li>
    );

    const startEdit = (m: ProjectMemory) => { setEditingId(m.id); setText(m.content); };

    return (
        <DialogShell title="Project memory" onClose={onClose} widthClass="max-w-[560px]">
            <div className="mb-4 flex items-start justify-between gap-4">
                <p className="text-sm leading-5" style={{ color: 'var(--text-muted)' }}>
                    Amplify suggests facts worth remembering from this project&apos;s chats. Only the ones you approve are used, and only in this project.
                </p>
                <span className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    <IconLock size={13} aria-hidden="true" /> Only you
                </span>
            </div>

            <label className="mb-4 flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm" style={{ background: 'var(--bg-app)' }}>
                <span>Use memory in this project</span>
                <input type="checkbox" role="switch" checked={project.memoryEnabled} disabled={archived} onChange={onToggleMemory} />
            </label>

            {state === 'loading' && <div role="status" className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading memory…</div>}
            {state === 'error' && (
                <div role="alert" className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Couldn&apos;t load memory. <button type="button" onClick={onRetry} className="font-medium underline">Retry</button>
                </div>
            )}

            {pending.length > 0 && (
                <section className="mb-5" aria-labelledby="mem-suggested">
                    <div className="mb-2 flex items-center justify-between">
                        <h3 id="mem-suggested" className="text-sm font-semibold">Suggested ({pending.length})</h3>
                        {pending.length > 1 && <button type="button" onClick={onApproveAll} className="rounded-md px-2 py-1 text-xs font-medium underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]">Approve all</button>}
                    </div>
                    <ul className="flex flex-col gap-2">
                        {pending.map((m) => row(m, (
                            <>
                                <button type="button" onClick={() => onApprove(m)} aria-label={`Approve: ${m.content}`} title="Approve" className={`${iconBtn} text-green-600`}><IconCheck size={15} aria-hidden="true" /></button>
                                <button type="button" onClick={() => startEdit(m)} aria-label={`Edit: ${m.content}`} title="Edit" className={iconBtn}><IconPencil size={14} aria-hidden="true" /></button>
                                <button type="button" onClick={() => onDismiss(m)} aria-label={`Dismiss: ${m.content}`} title="Dismiss" className={`${iconBtn} text-red-500`}><IconX size={14} aria-hidden="true" /></button>
                            </>
                        ), true))}
                    </ul>
                </section>
            )}

            {state === 'ready' && (
                <section aria-labelledby="mem-approved">
                    <h3 id="mem-approved" className="mb-2 text-sm font-semibold">Approved ({approved.length})</h3>
                    {approved.length === 0 ? (
                        <p className="rounded-xl px-3 py-3 text-sm leading-5" style={{ background: 'var(--bg-app)', color: 'var(--text-muted)' }}>
                            {pending.length > 0 ? 'Approve a suggestion above to start using it.' : project.memoryEnabled ? 'Nothing remembered yet. Suggestions appear here after a few chats.' : 'Turn on memory to get suggestions from this project’s chats.'}
                        </p>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {approved.map((m) => row(m, (
                                <>
                                    <button type="button" onClick={() => startEdit(m)} aria-label={`Edit: ${m.content}`} title="Edit" className={iconBtn}><IconPencil size={14} aria-hidden="true" /></button>
                                    <button type="button" onClick={() => onConfirmDelete(m)} aria-label={`Delete: ${m.content}`} title="Delete" className={`${iconBtn} text-red-500`}><IconX size={14} aria-hidden="true" /></button>
                                </>
                            )))}
                        </ul>
                    )}
                </section>
            )}
        </DialogShell>
    );
};

export default ProjectMemoryDialog;
