import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { IconX } from '@tabler/icons-react';
import { getProject } from '@/services/projectService';
import { invalidateProjectContext } from '@/services/projectContextCache';
import { Project, ProjectMemory } from '@/types/project';
import ConfirmDialog from '@/components/NewUI/shared/ConfirmDialog';
import { ProjectContextPanel } from './ProjectContextPanel';
import { useProjectDrafts } from './useProjectDrafts';
import { ProjectFileRow, useProjectResources } from './useProjectResources';
import { useDialogA11y } from './useDialogA11y';
import HomeContext from '@/pages/api/home/home.context';
import { getLastReplyContext, summarizeReplyContext } from './lastReplyContext';

interface ProjectChatDrawerProps {
    projectId: string;
    open: boolean;
    onClose: () => void;
}

/**
 * The project's instructions, files and memory, available from inside a project
 * chat so the conversation never feels detached from its project. Loads only
 * once opened, then stays mounted so unsaved edits survive closing the drawer.
 */
const DrawerBody: React.FC<{ projectId: string; open: boolean; onClose: () => void }> = ({ projectId, open, onClose }) => {
    const [project, setProject] = useState<Project | null>(null);
    const [error, setError] = useState(false);
    const [confirmFile, setConfirmFile] = useState<ProjectFileRow | null>(null);
    const [confirmMemory, setConfirmMemory] = useState<ProjectMemory | null>(null);
    const [openMemorySignal, setOpenMemorySignal] = useState(0);
    const { state: { selectedConversation } } = useContext(HomeContext);
    const lastReply = getLastReplyContext(selectedConversation?.messages);
    const asideRef = useRef<HTMLElement>(null);

    const load = useCallback(async () => {
        setError(false);
        try {
            const result = await getProject(projectId);
            if (result.success && result.data) setProject(result.data);
            else setError(true);
        } catch {
            setError(true);
        }
    }, [projectId]);
    useEffect(() => { setProject(null); load(); }, [load]);

    const onSaved = useCallback((updated: Project) => setProject(updated), []);
    const drafts = useProjectDrafts(project, onSaved);
    const resources = useProjectResources(project);
    useDialogA11y(open, asideRef, onClose);
    const readyFiles = resources.files.filter((f) => f.status === 'ready').length;
    const processingFiles = resources.files.filter((f) => f.status === 'processing').length;
    const approvedMemories = resources.memories.filter((m) => m.status === 'approved').length;
    const pendingMemories = resources.memories.filter((m) => m.status !== 'approved').length;

    const toggleMemory = async () => {
        if (!project) return;
        const { updateProject } = await import('@/services/projectService');
        const result = await updateProject({ id: project.id, memoryEnabled: !project.memoryEnabled });
        if (result.success && result.data) {
            invalidateProjectContext(project.id);
            setProject(result.data);
        }
    };

    if (typeof document === 'undefined') return null;
    // Portalled to <body>: the chat header that mounts this creates its own
    // stacking context, which would otherwise trap the drawer beneath other layers.
    return ReactDOM.createPortal(
        <>
            {open && <div className="fixed inset-0 z-[70] bg-black/30" aria-hidden="true" onClick={onClose} />}
            <aside
                ref={asideRef}
                role="dialog"
                aria-modal={open || undefined}
                aria-label="Project context"
                aria-hidden={open ? undefined : true}
                tabIndex={-1}
                className={
                    'fixed inset-y-0 right-0 z-[80] flex w-full max-w-[400px] flex-col border-l shadow-xl outline-none ' +
                    'transition-[transform,visibility] duration-200 motion-reduce:transition-none ' +
                    (open ? 'translate-x-0 visible' : 'translate-x-full invisible')
                }
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}
            >
                <div className="flex h-14 flex-shrink-0 items-center justify-between border-b px-5" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{project?.name ?? 'Project context'}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Shared with every chat in this project</div>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close project context" className="rounded-lg p-2 hover:bg-[--bg-hover] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]">
                        <IconX size={18} aria-hidden="true" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                    {error && (
                        <div role="alert" className="rounded-xl px-3 py-3 text-xs" style={{ background: 'var(--bg-raised)', color: 'var(--text-secondary)' }}>
                            Couldn&apos;t load this project.{' '}
                            <button type="button" onClick={load} className="font-medium underline">Retry</button>
                        </div>
                    )}
                    {!project && !error && <div role="status" className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading project…</div>}
                    {project && (
                        <div className="mb-4 rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-raised)' }}>
                            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Applied to chats in this project</h3>
                            <ul className="flex flex-col gap-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                <li>Files: {resources.filesState === 'loading' ? 'loading…' : `${readyFiles} ready${processingFiles > 0 ? `, ${processingFiles} processing` : ''}`}</li>
                                <li>Instructions: {project.instructions?.trim() ? 'added' : 'none'}</li>
                                <li>Memory: {project.memoryEnabled ? `on, ${approvedMemories} approved` : 'off'}</li>
                                <li>Default assistant: {project.assistantName || 'none'}</li>
                            </ul>
                            {lastReply && lastReply.projectId === project.id && (
                                <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
                                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>The last reply used</h4>
                                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{summarizeReplyContext(lastReply) || 'No project context.'}</p>
                                    {lastReply.files.length > 0 && (
                                        <ul className="mt-1.5 flex flex-col gap-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                                            {lastReply.files.map((f, i) => (
                                                <li key={`${f.name}-${i}`} className="flex items-center gap-1.5">
                                                    <span className="min-w-0 truncate" title={f.name}>{f.name}</span>
                                                    <span className="flex-shrink-0">{f.retrievalOnly ? '· searched' : '· whole document'}</span>
                                                </li>
                                            ))}
                                            {lastReply.totalFiles > lastReply.files.length && <li>+{lastReply.totalFiles - lastReply.files.length} more</li>}
                                        </ul>
                                    )}
                                </div>
                            )}
                            {pendingMemories > 0 && project.memoryEnabled && (
                                <button
                                    type="button"
                                    onClick={() => setOpenMemorySignal((n) => n + 1)}
                                    className="mt-3 w-full rounded-lg px-3 py-2 text-left text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
                                    style={{ background: 'color-mix(in srgb, var(--accent) 12%, var(--bg-raised))' }}
                                >
                                    {pendingMemories} suggested {pendingMemories === 1 ? 'memory' : 'memories'} to review
                                </button>
                            )}
                            {project.status === 'archived' && <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>This project is archived, so none of this is applied.</p>}
                        </div>
                    )}
                    {project && (
                        <ProjectContextPanel
                            project={project}
                            drafts={drafts}
                            resources={resources}
                            onToggleMemory={toggleMemory}
                            onConfirmDeleteFile={setConfirmFile}
                            onConfirmDeleteMemory={setConfirmMemory}
                            openMemorySignal={openMemorySignal}
                        />
                    )}
                </div>
            </aside>
            {confirmFile && (
                <ConfirmDialog
                    isOpen={true}
                    title="Remove file?"
                    message={`Remove "${confirmFile.name}" from this project's files? It will no longer be used in project chats. This cannot be undone.`}
                    confirmLabel="Remove"
                    variant="danger"
                    onConfirm={async () => { const f = confirmFile; setConfirmFile(null); await resources.removeFile(f); }}
                    onCancel={() => setConfirmFile(null)}
                />
            )}
            {confirmMemory && (
                <ConfirmDialog
                    isOpen={true}
                    title="Delete memory?"
                    message={`Delete this remembered fact: "${confirmMemory.content}"? This cannot be undone.`}
                    confirmLabel="Delete"
                    variant="danger"
                    onConfirm={async () => { const m = confirmMemory; setConfirmMemory(null); await resources.removeMemory(m); }}
                    onCancel={() => setConfirmMemory(null)}
                />
            )}
        </>,
        document.body,
    );
};

export const ProjectChatDrawer: React.FC<ProjectChatDrawerProps> = ({ projectId, open, onClose }) => {
    const [everOpened, setEverOpened] = useState(false);
    useEffect(() => { if (open) setEverOpened(true); }, [open]);
    useEffect(() => { setEverOpened(false); }, [projectId]);
    if (!everOpened && !open) return null;
    return <DrawerBody projectId={projectId} open={open} onClose={onClose} />;
};

export default ProjectChatDrawer;
