/**
 * NewProjectsView — the Projects workspace.
 *
 * Gallery: searchable grid of projects, most recently active first.
 * Workspace: a conversation-first project home (composer + recent chats) with
 * the project's context — instructions, files, memory — always one glance away
 * in a side panel (a slide-over drawer on narrow screens).
 *
 * Chats, attachments, assistants, skills, connectors and web search all come
 * from the standard NewHome composer. Project files reuse the existing file/RAG
 * pipeline with knowledgeBase = project id; instructions and approved memory
 * are injected server-side (amplify-lambda-js).
 *
 * Design tokens: --bg-app, --bg-raised, --bg-hover, --border-subtle,
 * --text-primary/secondary/muted, --accent (same set NewLibraryView uses).
 */

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
    IconAlertTriangle,
    IconArchiveOff,
    IconArrowLeft,
    IconLoader2,
    IconMessage2,
    IconPlus,
    IconStack2,
    IconX,
} from '@tabler/icons-react';
import {
    createProject, deleteProject, listProjectFiles, listProjects, updateProject,
} from '@/services/projectService';
import { invalidateProjectContext } from '@/services/projectContextCache';
import { deleteFile } from '@/services/fileService';
import { fetchRemoteConversation, uploadConversation } from '@/services/remoteConversationService';
import { isRemoteConversation, saveConversations } from '@/utils/app/conversation';
import { Conversation } from '@/types/chat';
import { Project, ProjectMemory } from '@/types/project';
import ConfirmDialog from '@/components/NewUI/shared/ConfirmDialog';
import { SearchInput } from '@/components/NewUI/shared/SearchInput';
import HomeContext from '@/pages/api/home/home.context';
import { NewHome } from '@/components/NewUI/home/NewHome';
import { ProjectCard } from '@/components/NewUI/projects/ProjectCard';
import { ProjectContextPanel } from '@/components/NewUI/projects/ProjectContextPanel';
import { ProjectSearchResults } from '@/components/NewUI/projects/ProjectSearchResults';
import { searchProject } from '@/components/NewUI/projects/projectSearch';
import { isLocalConversation } from '@/utils/app/conversation';
import { uncompressMessages } from '@/utils/app/messages';
import { ProjectActionsMenu } from '@/components/NewUI/projects/ProjectActionsMenu';
import { ProjectDetailsDialog } from '@/components/NewUI/projects/ProjectDetailsDialog';
import { getSelectedProjectId, setSelectedProjectId } from '@/components/NewUI/projects/projectNavigation';
import { formatRelative, latestTimestamp } from '@/components/NewUI/projects/projectFormat';
import { MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH, useProjectDrafts } from '@/components/NewUI/projects/useProjectDrafts';
import { PROJECTS_LOCAL_MODE, ProjectFileRow, useProjectResources } from '@/components/NewUI/projects/useProjectResources';
import { useDialogA11y } from '@/components/NewUI/projects/useDialogA11y';
import { useMediaQuery } from '@/components/NewUI/projects/useMediaQuery';
import { useProjectAssistant } from '@/components/NewUI/projects/useProjectAssistants';
import { invalidateProjectRegistry } from '@/components/NewUI/projects/projectRegistry';

const RECENT_CHATS_PREVIEW = 8;

type ListState = 'loading' | 'ready' | 'error';

// ── Create dialog ────────────────────────────────────────────────────────────
const CreateProjectDialog: React.FC<{
    onClose: () => void;
    onCreate: (name: string, description: string) => Promise<string | null>;
}> = ({ onClose, onCreate }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    useDialogA11y(true, panelRef, onClose);

    const submit = async () => {
        if (!name.trim() || creating) return;
        setCreating(true);
        setError(null);
        const failure = await onCreate(name.trim(), description.trim());
        if (failure) {
            setError(failure);
            setCreating(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
            onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="new-project-title"
                tabIndex={-1}
                className="w-full max-w-[420px] rounded-xl p-5 outline-none"
                style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}
            >
                <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
                    <div className="mb-4 flex items-center justify-between">
                        <h2 id="new-project-title" className="text-base font-semibold">New project</h2>
                        <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 hover:bg-[--bg-hover] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]">
                            <IconX size={18} aria-hidden="true" />
                        </button>
                    </div>
                    <label htmlFor="new-project-name" className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Name</label>
                    <input
                        id="new-project-name"
                        data-autofocus
                        value={name}
                        maxLength={MAX_NAME_LENGTH}
                        onChange={(e) => setName(e.target.value)}
                        className="mb-3 w-full rounded-md p-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
                        style={{ background: 'var(--bg-app)', border: '1px solid var(--border-subtle)' }}
                    />
                    <label htmlFor="new-project-description" className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Description (optional)</label>
                    <textarea
                        id="new-project-description"
                        value={description}
                        maxLength={MAX_DESCRIPTION_LENGTH}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={2}
                        className="mb-4 w-full resize-none rounded-md p-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
                        style={{ background: 'var(--bg-app)', border: '1px solid var(--border-subtle)' }}
                    />
                    {error && <p role="alert" className="mb-3 text-xs text-red-500">{error}</p>}
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm hover:bg-[--bg-hover] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]">Cancel</button>
                        <button
                            type="submit"
                            disabled={!name.trim() || creating}
                            className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-40"
                            style={{ background: 'var(--accent)' }}
                        >
                            {creating && <IconLoader2 size={14} className="animate-spin" aria-hidden="true" />}
                            Create
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── View ─────────────────────────────────────────────────────────────────────
export const NewProjectsView: React.FC = () => {
    const {
        state: { conversations, folders, selectedConversation },
        dispatch,
        handleNewConversation,
        handleSelectConversation,
    } = useContext(HomeContext);

    const [projects, setProjects] = useState<Project[]>([]);
    const [listState, setListState] = useState<ListState>('loading');
    const [selectedId, setSelectedIdState] = useState<string | null>(() => getSelectedProjectId());
    const [search, setSearch] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [showAllChats, setShowAllChats] = useState(false);
    const [projectQuery, setProjectQuery] = useState('');
    const [openMemorySignal, setOpenMemorySignal] = useState(0);

    const [confirmDeleteProject, setConfirmDeleteProject] = useState<Project | null>(null);
    const [deletingProject, setDeletingProject] = useState(false);
    const [confirmDeleteFile, setConfirmDeleteFile] = useState<ProjectFileRow | null>(null);
    const [confirmDeleteMemory, setConfirmDeleteMemory] = useState<ProjectMemory | null>(null);
    const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);

    const isWide = useMediaQuery('(min-width: 1024px)');

    const selectProject = useCallback((id: string | null) => {
        setSelectedProjectId(id);
        setSelectedIdState(id);
        setShowDetails(false);
        setShowAllChats(false);
        setProjectQuery('');
    }, []);

    const selected = useMemo(() => projects.find((p) => p.id === selectedId) || null, [projects, selectedId]);

    const replaceProject = useCallback((updated: Project) => {
        setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    }, []);

    const projectAssistant = useProjectAssistant(selected);
    const drafts = useProjectDrafts(selected, replaceProject);
    const resources = useProjectResources(selected);

    const refreshProjects = useCallback(async () => {
        setListState('loading');
        try {
            const result = await listProjects();
            if (result.success) {
                setProjects(result.data || []);
                setListState('ready');
            } else {
                setListState('error');
            }
        } catch (e) {
            console.error('Failed to load projects', e);
            setListState('error');
        }
    }, []);

    useEffect(() => { refreshProjects(); }, [refreshProjects]);

    // A remembered project that no longer exists (deleted elsewhere) falls back to the gallery.
    useEffect(() => {
        if (listState === 'ready' && selectedId && !projects.some((p) => p.id === selectedId)) selectProject(null);
    }, [listState, projects, selectedId, selectProject]);

    // Leaving the workspace with unsaved edits asks first.
    const guardLeave = useCallback((action: () => void) => {
        if (drafts.dirty) setPendingLeave(() => action);
        else action();
    }, [drafts.dirty]);

    useEffect(() => {
        if (!drafts.dirty) return;
        const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [drafts.dirty]);

    // ── Derived chat data ────────────────────────────────────────────────────
    const chatStats = useMemo(() => {
        const stats = new Map<string, { count: number; last: string }>();
        for (const conversation of conversations as Conversation[]) {
            if (!conversation.projectId) continue;
            const entry = stats.get(conversation.projectId) || { count: 0, last: '' };
            entry.count += 1;
            entry.last = latestTimestamp(entry.last, conversation.date);
            stats.set(conversation.projectId, entry);
        }
        return stats;
    }, [conversations]);

    const projectConversations = useMemo(
        () => (selected
            ? (conversations as Conversation[])
                .filter((c) => c.projectId === selected.id)
                .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
            : []),
        [conversations, selected],
    );

    const searchResults = useMemo(
        () => searchProject(projectQuery, {
            chats: projectConversations,
            files: resources.files,
            memories: resources.memories,
            getMessageText: (c: Conversation) => {
                if (!isLocalConversation(c)) return '';
                const messages = c.messages?.length ? c.messages : uncompressMessages(c.compressedMessages ?? []) ?? [];
                return messages.map((m: any) => (typeof m.content === 'string' ? m.content : '')).join(' ');
            },
        }),
        [projectQuery, projectConversations, resources.files, resources.memories],
    );

    const visibleProjects = useMemo(() => {
        const term = search.trim().toLowerCase();
        return projects
            .filter((p) => showArchived || p.status !== 'archived')
            .filter((p) => !term || p.name.toLowerCase().includes(term) || (p.description || '').toLowerCase().includes(term))
            .map((p) => ({ project: p, last: latestTimestamp(chatStats.get(p.id)?.last, p.updatedAt) }))
            .sort((a, b) => b.last.localeCompare(a.last));
    }, [projects, search, showArchived, chatStats]);

    // ── Actions ──────────────────────────────────────────────────────────────
    const handleOpenChat = (conversation: Conversation) => {
        guardLeave(() => {
            handleSelectConversation(conversation);
            dispatch({ field: 'page', value: 'chat' });
        });
    };

    const handleCreate = async (name: string, description: string): Promise<string | null> => {
        try {
            const result = await createProject({ name, description });
            if (result.success && result.data) {
                setProjects((prev) => [result.data as Project, ...prev]);
                invalidateProjectRegistry();
                setShowCreate(false);
                selectProject(result.data.id);
                return null;
            }
            return result.message || 'Failed to create project.';
        } catch (e) {
            console.error('Failed to create project', e);
            return 'Failed to create project.';
        }
    };

    const handleToggleArchive = async (project: Project) => {
        const nextStatus = project.status === 'archived' ? 'active' : 'archived';
        try {
            const result = await updateProject({ id: project.id, status: nextStatus });
            if (result.success && result.data) {
                invalidateProjectContext(project.id);
                invalidateProjectRegistry();
                replaceProject(result.data);
                toast.success(nextStatus === 'archived' ? 'Project archived.' : 'Project unarchived.');
            } else {
                toast.error(result.message || 'Failed to update project.');
            }
        } catch (e) {
            console.error('Failed to archive/unarchive project', e);
            toast.error('Failed to update project.');
        }
    };

    const handleToggleMemoryEnabled = async (project: Project) => {
        try {
            const result = await updateProject({ id: project.id, memoryEnabled: !project.memoryEnabled });
            if (result.success && result.data) {
                invalidateProjectContext(project.id);
                replaceProject(result.data);
            } else {
                toast.error(result.message || 'Failed to update memory setting.');
            }
        } catch (e) {
            console.error('Failed to toggle project memory', e);
            toast.error('Failed to update memory setting.');
        }
    };

    /**
     * Delete order (each step only runs if the previous one succeeded):
     *  1. list the project's files from its manifest — if that fails, stop;
     *  2. delete the project record (server also removes its memories);
     *  3. best-effort cleanup that can't strand a half-deleted project: detach
     *     chats locally and in the cloud, then remove the files.
     */
    const handleDeleteProject = async (project: Project) => {
        setDeletingProject(true);
        try {
            // The manifest lists exactly which files this project uses (no scan of the
            // user's whole file table); it is read first so nothing is left unknown.
            let projectFileIds: string[] = [];
            if (!PROJECTS_LOCAL_MODE) {
                const listed = await listProjectFiles(project.id);
                if (!listed.success) {
                    toast.error("Could not list this project's files, so the project was not deleted. Try again.");
                    return;
                }
                projectFileIds = (listed.data || []).map((f) => f.fileId);
            }

            const result = await deleteProject(project.id);
            if (!result.success) {
                toast.error(result.message || 'Failed to delete project.');
                return;
            }
            invalidateProjectContext(project.id);
            invalidateProjectRegistry();
            setProjects((prev) => prev.filter((p) => p.id !== project.id));
            if (selectedId === project.id) selectProject(null);

            // Detach chats. Local state first (cheap and immediate), then cloud copies.
            const affected = (conversations as Conversation[]).filter((c) => c.projectId === project.id);
            if (affected.length > 0) {
                const detached = (conversations as Conversation[]).map((c) =>
                    c.projectId === project.id ? { ...c, projectId: undefined } : c);
                dispatch({ field: 'conversations', value: detached });
                saveConversations(detached);
                if (selectedConversation?.projectId === project.id) {
                    dispatch({ field: 'selectedConversation', value: { ...selectedConversation, projectId: undefined } });
                }
            }
            let cloudFailures = 0;
            for (const original of affected.filter((c) => isRemoteConversation(c))) {
                try {
                    const full = await fetchRemoteConversation(original.id);
                    if (!full || !(await uploadConversation({ ...full, projectId: undefined }, folders))) cloudFailures += 1;
                } catch {
                    cloudFailures += 1;
                }
            }

            let fileFailures = 0;
            for (const fileId of projectFileIds) {
                try {
                    const deleted = await deleteFile(fileId);
                    if (!deleted.success) fileFailures += 1;
                } catch {
                    fileFailures += 1;
                }
            }

            if (fileFailures > 0) {
                toast.error(`Project deleted, but ${fileFailures} file${fileFailures === 1 ? '' : 's'} couldn't be removed. You can delete ${fileFailures === 1 ? 'it' : 'them'} from your Library.`);
            } else if (cloudFailures > 0) {
                toast(`Project deleted. ${cloudFailures} cloud chat${cloudFailures === 1 ? '' : 's'} still reference it, which is harmless.`);
            } else {
                toast.success('Project deleted.');
            }
        } catch (e) {
            console.error('Failed to delete project', e);
            toast.error('Failed to delete project.');
        } finally {
            setDeletingProject(false);
            setConfirmDeleteProject(null);
        }
    };

    // ── Confirmations shared by gallery and workspace ────────────────────────
    const confirmations = (
        <>
            {confirmDeleteProject && (
                <ConfirmDialog
                    isOpen={true}
                    title="Delete project?"
                    message={
                        `Delete "${confirmDeleteProject.name}"? Its instructions and memories are deleted, its project files are removed, ` +
                        `and its chats are kept as regular chats. This cannot be undone.`
                    }
                    confirmLabel={deletingProject ? 'Deleting…' : 'Delete'}
                    variant="danger"
                    onConfirm={() => { if (!deletingProject) handleDeleteProject(confirmDeleteProject); }}
                    onCancel={() => { if (!deletingProject) setConfirmDeleteProject(null); }}
                />
            )}
            {confirmDeleteFile && (
                <ConfirmDialog
                    isOpen={true}
                    title="Remove file?"
                    message={`Remove "${confirmDeleteFile.name}" from this project's files? It will no longer be used in project chats. This cannot be undone.`}
                    confirmLabel="Remove"
                    variant="danger"
                    onConfirm={async () => { const file = confirmDeleteFile; setConfirmDeleteFile(null); await resources.removeFile(file); }}
                    onCancel={() => setConfirmDeleteFile(null)}
                />
            )}
            {confirmDeleteMemory && (
                <ConfirmDialog
                    isOpen={true}
                    title="Delete memory?"
                    message={`Delete this remembered fact: "${confirmDeleteMemory.content}"? This cannot be undone.`}
                    confirmLabel="Delete"
                    variant="danger"
                    onConfirm={async () => { const memory = confirmDeleteMemory; setConfirmDeleteMemory(null); await resources.removeMemory(memory); }}
                    onCancel={() => setConfirmDeleteMemory(null)}
                />
            )}
            {pendingLeave && (
                <ConfirmDialog
                    isOpen={true}
                    title="Discard unsaved changes?"
                    message="You have unsaved edits to this project's instructions or details. If you leave now they will be lost."
                    confirmLabel="Discard and leave"
                    variant="warning"
                    onConfirm={() => { const action = pendingLeave; setPendingLeave(null); action(); }}
                    onCancel={() => setPendingLeave(null)}
                />
            )}
        </>
    );

    // ── Workspace ────────────────────────────────────────────────────────────
    if (selected) {
        const archived = selected.status === 'archived';
        const shownChats = showAllChats ? projectConversations : projectConversations.slice(0, RECENT_CHATS_PREVIEW);
        const contextPanel = (
            <ProjectContextPanel
                project={selected}
                drafts={drafts}
                resources={resources}
                onToggleMemory={() => handleToggleMemoryEnabled(selected)}
                onConfirmDeleteFile={setConfirmDeleteFile}
                onConfirmDeleteMemory={setConfirmDeleteMemory}
                openMemorySignal={openMemorySignal}
            />
        );

        return (
            <div className="relative flex h-full w-full flex-col overflow-hidden" style={{ background: 'var(--bg-app)', color: 'var(--text-primary)' }}>
                <header className="flex h-14 flex-shrink-0 items-center justify-between gap-3 px-4 sm:px-5">
                    <button
                        type="button"
                        onClick={() => selectProject(null)}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[--bg-hover] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        <IconArrowLeft size={16} aria-hidden="true" /> All projects
                    </button>
                    <ProjectActionsMenu
                        project={selected}
                        onEditDetails={() => setShowDetails(true)}
                        onArchiveToggle={() => handleToggleArchive(selected)}
                        onDelete={() => setConfirmDeleteProject(selected)}
                    />
                </header>

                <div className="flex min-h-0 flex-1">
                    <div className="min-w-0 flex-1 overflow-y-auto">
                        <main className="mx-auto flex w-full max-w-3xl flex-col px-4 pb-16 pt-4 sm:px-6">
                            <div className="mb-6 text-left">
                                <h1
                                    className="break-words text-[34px] leading-tight tracking-[-0.01em]"
                                    style={{ fontFamily: '"Newsreader", "Georgia", serif', fontWeight: 400 }}
                                >
                                    {selected.name}
                                </h1>
                                <p className="mt-2 max-w-xl text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                                    {selected.description || 'Chats in this project share the same instructions, files, and memory.'}
                                </p>
                            </div>

                            {archived ? (
                                <div role="status" className="mb-8 flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-raised)' }}>
                                    <span className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                                        <IconAlertTriangle size={16} aria-hidden="true" />
                                        This project is archived. Unarchive it to start new chats or add files.
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handleToggleArchive(selected)}
                                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                                        style={{ background: 'var(--accent)' }}
                                    >
                                        <IconArchiveOff size={15} aria-hidden="true" /> Unarchive
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="mb-2 w-full">
                                        <NewHome compact projectId={selected.id} placeholder={`Message ${selected.name}…`} />
                                    </div>
                                    <p className="mb-8 px-1 text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
                                        Files you attach here are used in that chat only. Add them to <strong className="font-medium">Files</strong> to share them with every chat in this project.
                                    </p>
                                </>
                            )}

                            <div className="mb-5 w-full">
                                <SearchInput
                                    value={projectQuery}
                                    onChange={setProjectQuery}
                                    placeholder="Search this project’s chats, files and memory…"
                                    aria-label="Search this project"
                                    fullWidth
                                />
                            </div>

                            {projectQuery.trim() ? (
                                <ProjectSearchResults
                                    query={projectQuery.trim()}
                                    results={searchResults}
                                    onOpenChat={handleOpenChat}
                                    onOpenMemory={() => setOpenMemorySignal((n) => n + 1)}
                                />
                            ) : (
                            <section aria-labelledby="recent-chats-heading">
                                <div className="mb-3 flex items-center justify-between">
                                    <h2 id="recent-chats-heading" className="text-base font-semibold">Chats</h2>
                                    {!archived && (
                                        <button
                                            type="button"
                                            onClick={() => handleNewConversation({
                                                projectId: selected.id,
                                                ...(projectAssistant ? { assistant: projectAssistant } : {}),
                                            })}
                                            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium hover:bg-[--bg-hover] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
                                            style={{ color: 'var(--accent)' }}
                                        >
                                            <IconPlus size={14} aria-hidden="true" /> New chat
                                        </button>
                                    )}
                                </div>
                                {projectConversations.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed px-6 py-10 text-center" style={{ borderColor: 'var(--border-subtle)' }}>
                                        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }} aria-hidden="true">
                                            <IconMessage2 size={18} />
                                        </div>
                                        <div className="text-sm font-medium">No chats in this project yet</div>
                                        <div className="mt-1 text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
                                            Ask something above to start one.
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <ul className="flex flex-col divide-y overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-raised)' }}>
                                            {shownChats.map((conversation) => (
                                                <li key={conversation.id} style={{ borderColor: 'var(--border-subtle)' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenChat(conversation)}
                                                        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-[--bg-hover] focus:bg-[--bg-hover] focus:outline-none"
                                                    >
                                                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{conversation.name || 'Untitled chat'}</span>
                                                        <span className="flex-shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>{formatRelative(conversation.date)}</span>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                        {projectConversations.length > RECENT_CHATS_PREVIEW && (
                                            <button
                                                type="button"
                                                onClick={() => setShowAllChats((v) => !v)}
                                                className="mx-auto mt-3 block rounded-lg px-3 py-1.5 text-xs font-medium underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
                                            >
                                                {showAllChats ? 'Show fewer' : `Show all ${projectConversations.length} chats`}
                                            </button>
                                        )}
                                    </>
                                )}
                            </section>
                            )}

                            {/* Narrow screens: the project's context sits under the chats instead of beside them. */}
                            {!isWide && <div className="mt-8">{contextPanel}</div>}
                        </main>
                    </div>

                    {isWide && (
                        <aside aria-label="Project context" className="w-[380px] flex-shrink-0 overflow-y-auto pb-8 pl-2 pr-6 pt-4">
                            {contextPanel}
                        </aside>
                    )}
                </div>

                {showDetails && (
                    <ProjectDetailsDialog
                        name={selected.name}
                        description={selected.description || ''}
                        saving={drafts.saving === 'details'}
                        onSave={drafts.saveDetailsValues}
                        onClose={() => setShowDetails(false)}
                    />
                )}
                {confirmations}
            </div>
        );
    }

    // ── Gallery ──────────────────────────────────────────────────────────────
    return (
        <div className="flex h-full w-full flex-col" style={{ background: 'var(--bg-app)', color: 'var(--text-primary)' }}>
            <div className="flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
                    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
                            <p className="mt-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                Keep related chats, files, and instructions together in one workspace.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowCreate(true)}
                            className="flex h-10 flex-shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                            style={{ backgroundColor: 'var(--accent)' }}
                        >
                            <IconPlus size={16} aria-hidden="true" />
                            New project
                        </button>
                    </div>

                    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                        <div className="w-full max-w-sm">
                            <SearchInput value={search} onChange={setSearch} placeholder="Search projects…" aria-label="Search projects" />
                        </div>
                        <label className="flex flex-shrink-0 items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                            Show archived
                        </label>
                    </div>

                    {listState === 'loading' && (
                        <div role="status" aria-label="Loading projects" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="h-[176px] animate-pulse rounded-2xl border motion-reduce:animate-none" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-raised)' }} />
                            ))}
                        </div>
                    )}

                    {listState === 'error' && (
                        <div role="alert" className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed px-6 text-center" style={{ borderColor: 'var(--border-subtle)' }}>
                            <IconAlertTriangle size={22} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                            <div className="mt-3 text-sm font-medium">Couldn&apos;t load your projects</div>
                            <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Check your connection and try again.</div>
                            <button type="button" onClick={refreshProjects} className="mt-4 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2" style={{ background: 'var(--accent)' }}>
                                Retry
                            </button>
                        </div>
                    )}

                    {listState === 'ready' && visibleProjects.length === 0 && (
                        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed px-6 text-center" style={{ borderColor: 'var(--border-subtle)' }}>
                            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }} aria-hidden="true">
                                <IconStack2 size={23} />
                            </div>
                            <div className="text-sm font-medium">
                                {search ? 'No projects match your search' : projects.length > 0 ? 'All your projects are archived' : 'No projects yet'}
                            </div>
                            {!search && projects.length === 0 && <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Create a workspace for an ongoing task or topic.</div>}
                            {!search && projects.length === 0 && (
                                <button type="button" onClick={() => setShowCreate(true)} className="mt-4 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2" style={{ background: 'var(--accent)' }}>
                                    Create your first project
                                </button>
                            )}
                            {!search && projects.length > 0 && (
                                <button type="button" onClick={() => setShowArchived(true)} className="mt-4 rounded-lg px-3 py-2 text-sm underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]">
                                    Show archived
                                </button>
                            )}
                        </div>
                    )}

                    {listState === 'ready' && visibleProjects.length > 0 && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {visibleProjects.map(({ project, last }) => (
                                <ProjectCard
                                    key={project.id}
                                    project={project}
                                    chatCount={chatStats.get(project.id)?.count || 0}
                                    lastActivity={last}
                                    onOpen={() => selectProject(project.id)}
                                    onArchiveToggle={() => handleToggleArchive(project)}
                                    onDelete={() => setConfirmDeleteProject(project)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {showCreate && <CreateProjectDialog onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
            {confirmations}
        </div>
    );
};

export default NewProjectsView;
