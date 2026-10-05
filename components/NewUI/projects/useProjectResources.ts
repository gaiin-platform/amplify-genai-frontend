import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { addFile, checkContentReady, deleteFile, queryKnowledgeBaseFiles } from '@/services/fileService';
import {
    addProjectFile,
    deleteProjectMemory,
    editProjectMemory,
    listProjectFiles,
    listProjectMemories,
    removeProjectFile,
    updateProjectFile,
} from '@/services/projectService';
import { invalidateProjectContext, prefetchProjectContext } from '@/services/projectContextCache';
import { AttachedDocument } from '@/types/attacheddocument';
import { Project, ProjectFile, ProjectMemory } from '@/types/project';

export const MAX_PROJECT_FILES = 100;
export const PROJECTS_LOCAL_MODE = process.env.NEXT_PUBLIC_PROJECTS_LOCAL_MODE === 'true';

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

/** One line in the Files list: a manifest entry, or an upload that has not been registered yet. */
export interface ProjectFileRow {
    key: string;
    /** Manifest key in the files service; absent while the first upload step is still running. */
    fileId?: string;
    name: string;
    type: string;
    status: 'uploading' | 'processing' | 'ready' | 'failed';
    totalTokens: number;
    /** Extra explanation for a failed file. */
    note?: string;
}

/** How long to wait for a freshly uploaded file to finish processing while the panel is open. */
const READY_TIMEOUT_SECONDS = 180;

const guessDocType = (file: File): string => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const map: Record<string, string> = {
        pdf: 'application/pdf',
        txt: 'text/plain',
        md: 'text/markdown',
        csv: 'text/csv',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    return map[ext] || file.type || 'application/octet-stream';
};

/**
 * Knowledge-base files and memories for one open project, with request-id guards
 * so a slow response for a previous project can never overwrite the current one.
 * Effects key off the project id (not the project object), so saving or toggling
 * a setting does not refetch or flash the lists.
 */
export function useProjectResources(project: Project | null) {
    const projectId = project?.id ?? null;
    const knowledgeBase = project?.knowledgeBase ?? null;

    const [manifest, setManifest] = useState<ProjectFile[]>([]);
    const [pendingUploads, setPendingUploads] = useState<ProjectFileRow[]>([]);
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [filesState, setFilesState] = useState<LoadState>('idle');
    const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);

    const [memories, setMemories] = useState<ProjectMemory[]>([]);
    const [memoriesState, setMemoriesState] = useState<LoadState>('idle');

    const filesRequest = useRef(0);
    const memoriesRequest = useRef(0);
    const currentProjectId = useRef<string | null>(null);
    currentProjectId.current = projectId;

    const patchManifest = useCallback((fileId: string, patch: Partial<ProjectFile>) => {
        setManifest((prev) => prev.map((f) => (f.fileId === fileId ? { ...f, ...patch } : f)));
    }, []);

    /**
     * Files still marked "processing" (e.g. the tab was closed mid-processing) are
     * checked against the files service once: it records totalTokens when processing
     * finishes, which is enough to mark them ready.
     */
    const reconcileProcessing = useCallback(async (items: ProjectFile[], project_id: string, knowledgeBaseId: string) => {
        if (PROJECTS_LOCAL_MODE || !items.some((f) => f.status === 'processing')) return;
        try {
            const records = await queryKnowledgeBaseFiles(knowledgeBaseId, null, 500);
            if (!records.success) return;
            const done = new Map(records.data.items.filter((r) => (r.totalTokens ?? 0) > 0).map((r) => [r.id, r.totalTokens as number]));
            for (const file of items.filter((f) => f.status === 'processing' && done.has(f.fileId))) {
                const totalTokens = done.get(file.fileId) as number;
                const result = await updateProjectFile({ projectId: project_id, fileId: file.fileId, status: 'ready', totalTokens });
                if (result.success && currentProjectId.current === project_id) patchManifest(file.fileId, { status: 'ready', totalTokens });
            }
        } catch (e) {
            console.warn('Could not reconcile project file status', e);
        }
    }, [patchManifest]);

    const refreshFiles = useCallback(async () => {
        if (!projectId || !knowledgeBase) return;
        const requestId = ++filesRequest.current;
        setFilesState((state) => (state === 'ready' ? state : 'loading'));
        try {
            const result = await listProjectFiles(projectId);
            if (requestId !== filesRequest.current) return;
            if (result.success) {
                const items = result.data || [];
                setManifest(items);
                setFilesState('ready');
                reconcileProcessing(items, projectId, knowledgeBase);
            } else {
                setFilesState('error');
            }
        } catch (e) {
            console.error('Failed to load project files', e);
            if (requestId === filesRequest.current) setFilesState('error');
        }
    }, [projectId, knowledgeBase, reconcileProcessing]);

    const refreshMemories = useCallback(async () => {
        if (!projectId) return;
        const requestId = ++memoriesRequest.current;
        setMemoriesState((state) => (state === 'ready' ? state : 'loading'));
        try {
            const result = await listProjectMemories(projectId);
            if (requestId !== memoriesRequest.current) return;
            if (result.success) {
                setMemories(result.data || []);
                setMemoriesState('ready');
            } else {
                setMemoriesState('error');
            }
        } catch (e) {
            console.error('Failed to load project memories', e);
            if (requestId === memoriesRequest.current) setMemoriesState('error');
        }
    }, [projectId]);

    useEffect(() => {
        filesRequest.current += 1;
        memoriesRequest.current += 1;
        setManifest([]);
        setPendingUploads([]);
        setNotes({});
        setMemories([]);
        setFilesState(projectId ? 'loading' : 'idle');
        setMemoriesState(projectId ? 'loading' : 'idle');
        if (!projectId) return;
        // Warm the send-time cache so the first message in this project's chats is fast.
        prefetchProjectContext(projectId);
        refreshFiles();
        refreshMemories();
        return () => {
            filesRequest.current += 1;
            memoriesRequest.current += 1;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

    // ── Files ────────────────────────────────────────────────────────────────
    /** After S3 upload: wait for processing, then record ready/failed (and size) on the manifest. */
    const watchReadiness = useCallback(async (
        project_id: string,
        fileId: string,
        metadataUrl: string | null,
        abortController?: AbortController,
    ) => {
        if (!metadataUrl) return;
        try {
            const ready = await checkContentReady(metadataUrl, READY_TIMEOUT_SECONDS, abortController);
            const metadata = ready?.metadata || {};
            const empty = !metadata.isImage && !metadata.isVideo && !(metadata.totalItems >= 1);
            if (empty) {
                await updateProjectFile({ projectId: project_id, fileId, status: 'failed' });
                if (currentProjectId.current === project_id) {
                    patchManifest(fileId, { status: 'failed' });
                    setNotes((prev) => ({ ...prev, [fileId]: 'No text could be extracted. If this is a scanned PDF, run OCR on it first.' }));
                }
                return;
            }
            const totalTokens = Number(metadata.totalTokens) > 0 ? Math.round(Number(metadata.totalTokens)) : 0;
            await updateProjectFile({ projectId: project_id, fileId, status: 'ready', totalTokens });
            if (currentProjectId.current === project_id) patchManifest(fileId, { status: 'ready', totalTokens });
        } catch (e) {
            // A timeout just means it is still processing (large files take a while); it stays
            // "processing" and is reconciled the next time the project is opened.
            console.warn('Project file still processing or check aborted', fileId, e);
        }
    }, [patchManifest]);

    const uploadFiles = useCallback(async (fileList: FileList | File[] | null) => {
        const list = fileList ? Array.from(fileList) : [];
        if (!project || list.length === 0) return;
        if (PROJECTS_LOCAL_MODE) {
            toast.error('Knowledge-base uploads are disabled in local Projects mode.');
            return;
        }
        if (project.status !== 'active') {
            toast.error('Unarchive this project before adding files.');
            return;
        }
        if (manifest.length + pendingUploads.filter((p) => p.status === 'uploading').length + list.length > MAX_PROJECT_FILES) {
            toast.error(`A project can contain at most ${MAX_PROJECT_FILES} files.`);
            return;
        }

        let succeeded = 0;
        const failed: string[] = [];
        setUploadProgress({ done: 0, total: list.length });
        for (const file of list) {
            const localKey = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const type = guessDocType(file);
            const fail = (message: string) => {
                failed.push(`${file.name} (${message})`);
                setPendingUploads((prev) => prev.map((row) => (row.key === localKey ? { ...row, status: 'failed', note: message } : row)));
            };
            setPendingUploads((prev) => [...prev, { key: localKey, name: file.name, type, status: 'uploading', totalTokens: 0 }]);
            try {
                // Same shape the chat composer's attach flow sends, so the files service treats both alike.
                const metadata: AttachedDocument = {
                    id: file.name, name: file.name, raw: '', type, data: {}, size: file.size, groupId: undefined,
                } as AttachedDocument;
                const { key, response, metadataUrl, abortController } = await addFile(metadata, file, undefined, true, [], null, project.knowledgeBase);
                await response;

                const registered = await addProjectFile({ projectId: project.id, fileId: key, name: file.name, type });
                if (!registered.success || !registered.data) {
                    // Don't leave an orphaned upload behind if the project refused it.
                    deleteFile(key).catch(() => undefined);
                    fail(registered.message || 'Could not add to project');
                } else {
                    succeeded += 1;
                    setPendingUploads((prev) => prev.filter((row) => row.key !== localKey));
                    setManifest((prev) => (prev.some((f) => f.fileId === key) ? prev : [...prev, registered.data as ProjectFile]));
                    watchReadiness(project.id, key, metadataUrl, abortController);
                }
            } catch (e) {
                console.error('Failed to upload project file', file.name, e);
                fail(e instanceof Error && e.message ? e.message : 'Upload failed');
            }
            setUploadProgress((progress) => progress && { ...progress, done: progress.done + 1 });
        }
        setUploadProgress(null);
        invalidateProjectContext(project.id);

        if (failed.length === 0) toast.success(succeeded === 1 ? 'File added. Processing…' : `${succeeded} files added. Processing…`);
        else toast.error(`${failed.length} file${failed.length === 1 ? '' : 's'} failed: ${failed.slice(0, 2).join('; ')}${failed.length > 2 ? '…' : ''}`);
    }, [project, manifest.length, pendingUploads, watchReadiness]);

    const dismissUpload = useCallback((key: string) => {
        setPendingUploads((prev) => prev.filter((row) => row.key !== key));
    }, []);

    /** Stop using the file in this project first, then delete the underlying upload. */
    const removeFile = useCallback(async (row: ProjectFileRow) => {
        if (!projectId || !row.fileId) {
            dismissUpload(row.key);
            return true;
        }
        try {
            const removed = await removeProjectFile(projectId, row.fileId);
            if (!removed.success) {
                toast.error(removed.message || 'Failed to remove file.');
                return false;
            }
            setManifest((prev) => prev.filter((f) => f.fileId !== row.fileId));
            invalidateProjectContext(projectId);
            const deleted = await deleteFile(row.fileId).catch(() => ({ success: false }));
            if (!deleted.success) toast('Removed from the project, but the uploaded file itself could not be deleted. You can delete it from your Library.');
            return true;
        } catch (e) {
            console.error('Failed to remove project file', e);
            toast.error('Failed to remove file.');
            return false;
        }
    }, [projectId, dismissUpload]);

    const rows: ProjectFileRow[] = useMemo(() => [
        ...manifest.map((f): ProjectFileRow => ({
            key: f.fileId, fileId: f.fileId, name: f.name, type: f.type, status: f.status, totalTokens: f.totalTokens || 0, note: notes[f.fileId],
        })),
        ...pendingUploads,
    ], [manifest, pendingUploads, notes]);

    // ── Memories ─────────────────────────────────────────────────────────────
    const replaceMemory = (updated: ProjectMemory) =>
        setMemories((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));

    const approveMemory = useCallback(async (memory: ProjectMemory, content?: string) => {
        try {
            const result = await editProjectMemory(memory.id, (content ?? memory.content).trim(), 'approved');
            if (result.success && result.data) {
                replaceMemory(result.data as ProjectMemory);
                // Approving a memory that supersedes another one retires that old
                // record server-side; refresh so a removed record also disappears
                // from this list right away instead of lingering until reopen.
                if ((result.data as ProjectMemory).supersedesIds?.length) {
                    refreshMemories();
                }
                return true;
            }
            toast.error(result.message || 'Failed to approve memory.');
        } catch (e) {
            console.error('Failed to approve memory', e);
            toast.error('Failed to approve memory.');
        }
        return false;
    }, [refreshMemories]);

    const approveAllPending = useCallback(async () => {
        const pending = memories.filter((m) => m.status !== 'approved');
        let approved = 0;
        for (const memory of pending) {
            if (await approveMemory(memory)) approved += 1;
        }
        if (approved > 0) toast.success(`${approved} memor${approved === 1 ? 'y' : 'ies'} approved.`);
    }, [memories, approveMemory]);

    const saveMemoryEdit = useCallback(async (memory: ProjectMemory, content: string) => {
        try {
            const result = await editProjectMemory(memory.id, content.trim());
            if (result.success && result.data) {
                replaceMemory(result.data as ProjectMemory);
                return true;
            }
            toast.error(result.message || 'Failed to update memory.');
        } catch (e) {
            console.error('Failed to edit memory', e);
            toast.error('Failed to update memory.');
        }
        return false;
    }, []);

    const removeMemory = useCallback(async (memory: ProjectMemory) => {
        try {
            const result = await deleteProjectMemory(memory.id);
            if (result.success) {
                setMemories((prev) => prev.filter((m) => m.id !== memory.id));
                return true;
            }
            toast.error(result.message || 'Failed to delete memory.');
        } catch (e) {
            console.error('Failed to delete memory', e);
            toast.error('Failed to delete memory.');
        }
        return false;
    }, []);

    return {
        files: rows, filesState, refreshFiles, uploadFiles, uploadProgress, removeFile, dismissUpload,
        memories, memoriesState, refreshMemories, approveMemory, approveAllPending, saveMemoryEdit, removeMemory,
    };
}
