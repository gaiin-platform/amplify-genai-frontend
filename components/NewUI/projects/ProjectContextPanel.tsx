import React, { useContext, useRef, useState } from 'react';
import {
    IconAlertCircle,
    IconFileText,
    IconLoader2,
    IconLock,
    IconPencil,
    IconPlus,
    IconSparkles,
    IconX,
} from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import { Project, ProjectMemory } from '@/types/project';
import { AssistantPickerDialog } from './AssistantPickerDialog';
import { InstructionsDialog } from './InstructionsDialog';
import { ProjectMemoryDialog } from './ProjectMemoryDialog';
import { ProjectDrafts } from './useProjectDrafts';
import { MAX_PROJECT_FILES, PROJECTS_LOCAL_MODE, ProjectFileRow, useProjectResources } from './useProjectResources';
import { computeProjectContextUsage, formatTokens } from './projectContextUsage';

type Resources = ReturnType<typeof useProjectResources>;

interface ProjectContextPanelProps {
    project: Project;
    drafts: ProjectDrafts;
    resources: Resources;
    onToggleMemory: () => void;
    onConfirmDeleteFile: (file: ProjectFileRow) => void;
    onConfirmDeleteMemory: (memory: ProjectMemory) => void;
    /** Increment to open the memory dialog from outside (e.g. a search result). */
    openMemorySignal?: number;
}

const addBtnCls =
    'flex-shrink-0 rounded-lg p-1.5 hover:bg-[--bg-hover] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] disabled:cursor-not-allowed disabled:opacity-40';

/** Status chip for a file row: uploading, processing, ready (with size) or failed. */
const FileStatus: React.FC<{ file: ProjectFileRow }> = ({ file }) => {
    const base = 'flex flex-shrink-0 items-center gap-1 text-xs';
    if (file.status === 'uploading') return <span role="status" className={base} style={{ color: 'var(--text-muted)' }}><IconLoader2 size={12} className="animate-spin" aria-hidden="true" /> Uploading</span>;
    if (file.status === 'processing') return <span role="status" className={base} style={{ color: 'var(--text-muted)' }} title="Being read and indexed. It is used in chats as soon as it is ready."><IconLoader2 size={12} className="animate-spin" aria-hidden="true" /> Processing</span>;
    if (file.status === 'failed') return <span className={base} style={{ color: '#dc2626' }}><IconAlertCircle size={12} aria-hidden="true" /> Failed</span>;
    return <span className={base} style={{ color: 'var(--text-muted)' }}>{file.totalTokens > 0 ? `${formatTokens(file.totalTokens)} tokens` : 'Ready'}</span>;
};

/** One row of the stacked panel: title, optional trailing control, muted body. */
const Section: React.FC<{ id: string; title: React.ReactNode; trailing?: React.ReactNode; children?: React.ReactNode }> = ({
    id, title, trailing, children,
}) => (
    <section aria-labelledby={id} className="border-b px-5 py-4 last:border-b-0" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex min-h-[32px] items-center justify-between gap-3">
            <h2 id={id} className="text-[15px] font-medium">{title}</h2>
            {trailing}
        </div>
        {children}
    </section>
);

const Muted: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <p className={`text-sm leading-5 ${className}`} style={{ color: 'var(--text-muted)' }}>{children}</p>
);

/**
 * The project's context, laid out as one card of stacked sections — Instructions,
 * Memory, Files, Assistant — each with a "+" to add or edit. Editing happens in
 * small dialogs, so there is no settings form and no "Save changes" button.
 */
export const ProjectContextPanel: React.FC<ProjectContextPanelProps> = ({
    project, drafts, resources, onToggleMemory, onConfirmDeleteFile, onConfirmDeleteMemory, openMemorySignal = 0,
}) => {
    const archived = project.status === 'archived';
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dialog, setDialog] = useState<'instructions' | 'memory' | 'assistant' | null>(null);
    const [dragging, setDragging] = useState(false);
    React.useEffect(() => { if (openMemorySignal > 0) setDialog('memory'); }, [openMemorySignal]);
    const { state: { availableModels, defaultModelId } } = useContext(HomeContext);
    const model = defaultModelId ? availableModels?.[defaultModelId] : undefined;
    const usage = computeProjectContextUsage(project, resources.files, resources.memories, model?.inputContextWindow);

    const instructions = project.instructions?.trim() || '';
    const pending = resources.memories.filter((m) => m.status !== 'approved');
    const approved = resources.memories.filter((m) => m.status === 'approved');
    const filesLocked = archived || PROJECTS_LOCAL_MODE || !!resources.uploadProgress;

    const onDrop = (event: React.DragEvent) => {
        event.preventDefault();
        setDragging(false);
        if (!filesLocked && event.dataTransfer.files?.length) resources.uploadFiles(event.dataTransfer.files);
    };

    return (
        <>
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-app)' }}>
                {archived && (
                    <div role="note" className="border-b px-5 py-3 text-sm leading-5" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                        Archived. Nothing here is applied to chats until you unarchive.
                    </div>
                )}

                {/* ── Context meter ────────────────────────────────────── */}
                {(resources.files.length > 0 || usage.instructionTokens > 0 || usage.memoryTokens > 0) && (
                    <div className="border-b px-5 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
                        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                            <span>Project context</span>
                            <span>
                                {usage.retrievalOnly && usage.total === 0 ? 'searched per message' : `~${formatTokens(usage.total)} tokens${model ? ` of ${formatTokens(model.inputContextWindow ?? 0)}` : ''}`}
                            </span>
                        </div>
                        <div
                            role="meter"
                            aria-label="Share of the model's context used by this project"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(usage.fraction * 100)}
                            className="h-1.5 overflow-hidden rounded-full"
                            style={{ background: 'var(--bg-hover)' }}
                        >
                            <div className="h-full rounded-full" style={{ width: `${Math.max(usage.fraction * 100, usage.total > 0 ? 2 : 0)}%`, background: usage.fraction > 0.8 ? '#dc2626' : 'var(--accent)' }} />
                        </div>
                        <p className="mt-1.5 text-xs leading-4" style={{ color: 'var(--text-muted)' }}>
                            {usage.retrievalOnly
                                ? usage.unmeasuredFiles > 0
                                    ? `${usage.unmeasuredFiles} file${usage.unmeasuredFiles === 1 ? ' is' : 's are'} still being measured. Files are searched per message until then.`
                                    : 'Files are large, so each message searches them for the relevant passages instead of attaching them in full.'
                                : 'Files are attached in full to every chat in this project.'}
                        </p>
                    </div>
                )}

                {/* ── Instructions ─────────────────────────────────────── */}
                <Section
                    id="ctx-instructions"
                    title="Instructions"
                    trailing={
                        <button type="button" onClick={() => setDialog('instructions')} disabled={archived} className={addBtnCls} aria-label={instructions ? 'Edit instructions' : 'Add instructions'}>
                            {instructions ? <IconPencil size={17} aria-hidden="true" /> : <IconPlus size={20} aria-hidden="true" />}
                        </button>
                    }
                >
                    {instructions
                        ? <p className="mt-1 line-clamp-4 whitespace-pre-wrap break-words text-sm leading-5" style={{ color: 'var(--text-secondary)' }}>{instructions}</p>
                        : <Muted>Add instructions to tailor Amplify&apos;s responses</Muted>}
                </Section>

                {/* ── Memory ───────────────────────────────────────────── */}
                <Section
                    id="ctx-memory"
                    title="Memory"
                    trailing={
                        <span className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                            <IconLock size={13} aria-hidden="true" /> Only you
                        </span>
                    }
                >
                    {!project.memoryEnabled ? (
                        <Muted>Memory is off for this project.</Muted>
                    ) : resources.memoriesState === 'error' ? (
                        <Muted>Couldn&apos;t load memory.</Muted>
                    ) : approved.length === 0 && pending.length === 0 ? (
                        <Muted>Project memory will show here after a few chats.</Muted>
                    ) : (
                        <>
                            {approved.slice(0, 3).map((m) => (
                                <p key={m.id} className="mt-1 line-clamp-2 break-words text-sm leading-5" style={{ color: 'var(--text-secondary)' }}>{m.content}</p>
                            ))}
                            {approved.length > 3 && <Muted className="mt-1">+{approved.length - 3} more</Muted>}
                        </>
                    )}
                    {pending.length > 0 && project.memoryEnabled && (
                        <button
                            type="button"
                            onClick={() => setDialog('memory')}
                            className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
                            style={{ background: 'color-mix(in srgb, var(--accent) 12%, var(--bg-raised))', color: 'var(--text-primary)' }}
                        >
                            {pending.length} suggested {pending.length === 1 ? 'memory' : 'memories'} to review
                        </button>
                    )}
                    <button type="button" onClick={() => setDialog('memory')} className="mt-2 rounded-md text-sm underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]" style={{ color: 'var(--text-secondary)' }}>
                        {project.memoryEnabled ? 'Manage memory' : 'Turn on memory'}
                    </button>
                </Section>

                {/* ── Files ────────────────────────────────────────────── */}
                <Section
                    id="ctx-files"
                    title={<>Files{resources.files.length > 0 && <span className="ml-1.5 text-sm font-normal" style={{ color: 'var(--text-muted)' }}>{resources.files.length}/{MAX_PROJECT_FILES}</span>}</>}
                    trailing={
                        <>
                            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={filesLocked} className={addBtnCls} aria-label="Add files" title={archived ? 'Unarchive to add files' : 'Add files'}>
                                <IconPlus size={20} aria-hidden="true" />
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                className="sr-only"
                                tabIndex={-1}
                                aria-hidden="true"
                                onChange={(e) => { resources.uploadFiles(e.target.files); e.target.value = ''; }}
                            />
                        </>
                    }
                >
                    {resources.uploadProgress && (
                        <div role="status" className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm" style={{ background: 'var(--bg-raised)', color: 'var(--text-secondary)' }}>
                            <IconLoader2 size={14} className="animate-spin" aria-hidden="true" />
                            Uploading {Math.min(resources.uploadProgress.done + 1, resources.uploadProgress.total)} of {resources.uploadProgress.total}…
                        </div>
                    )}
                    {resources.filesState === 'loading' && <Muted>Loading files…</Muted>}
                    {resources.filesState === 'error' && (
                        <div role="alert" className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            Couldn&apos;t load files. <button type="button" onClick={resources.refreshFiles} className="font-medium underline">Retry</button>
                        </div>
                    )}
                    {resources.filesState === 'ready' && resources.files.length === 0 && (
                        <button
                            type="button"
                            disabled={filesLocked}
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); if (!filesLocked) setDragging(true); }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={onDrop}
                            className="mt-2 flex w-full flex-col items-center gap-3 rounded-2xl px-6 py-8 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] disabled:cursor-not-allowed disabled:opacity-60"
                            style={{ background: dragging ? 'var(--bg-hover)' : 'var(--bg-raised)', border: `1px ${dragging ? 'solid' : 'dashed'} var(--border-subtle)` }}
                        >
                            <IconFileText size={30} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                            <span className="text-sm leading-5" style={{ color: 'var(--text-muted)' }}>
                                {PROJECTS_LOCAL_MODE
                                    ? 'File sources are disabled for this local test.'
                                    : 'Add PDFs, documents, or other text to reference in every chat in this project.'}
                            </span>
                        </button>
                    )}
                    {resources.files.length > 0 && (
                        <ul
                            className="mt-2 flex flex-col gap-1"
                            onDragOver={(e) => { e.preventDefault(); }}
                            onDrop={onDrop}
                        >
                            {resources.files.map((file) => (
                                <li key={file.key} className="rounded-xl px-3 py-2 text-sm" style={{ background: 'var(--bg-raised)' }}>
                                    <div className="flex items-center gap-2">
                                        <IconFileText size={15} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                                        <span className="min-w-0 flex-1 truncate" title={file.name}>{file.name}</span>
                                        <FileStatus file={file} />
                                        <button
                                            type="button"
                                            onClick={() => (file.fileId ? onConfirmDeleteFile(file) : resources.dismissUpload(file.key))}
                                            disabled={file.status === 'uploading'}
                                            aria-label={file.fileId ? `Remove ${file.name} from project` : `Dismiss ${file.name}`}
                                            className="rounded-md p-1 text-red-500 hover:bg-[--bg-hover] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] disabled:opacity-30"
                                        >
                                            <IconX size={14} aria-hidden="true" />
                                        </button>
                                    </div>
                                    {file.status === 'failed' && file.note && (
                                        <p className="mt-1 pl-6 text-xs leading-4" style={{ color: 'var(--text-muted)' }}>{file.note}</p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </Section>

                {/* ── Assistant ────────────────────────────────────────── */}
                <Section
                    id="ctx-assistant"
                    title="Assistant"
                    trailing={
                        <button type="button" onClick={() => setDialog('assistant')} disabled={archived || drafts.saving === 'assistant'} className={addBtnCls} aria-label={project.assistantId ? 'Change assistant' : 'Attach an assistant'}>
                            {project.assistantId ? <IconPencil size={17} aria-hidden="true" /> : <IconPlus size={20} aria-hidden="true" />}
                        </button>
                    }
                >
                    {project.assistantId ? (
                        <p className="mt-1 flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            <IconSparkles size={15} style={{ color: 'var(--accent)' }} aria-hidden="true" />
                            <span className="min-w-0 truncate" title={project.assistantName || project.assistantId}>{project.assistantName || 'Assistant'}</span>
                        </p>
                    ) : (
                        <Muted>New chats can start with one of your assistants</Muted>
                    )}
                </Section>
            </div>

            {dialog === 'instructions' && (
                <InstructionsDialog
                    initial={project.instructions ?? ''}
                    saving={drafts.saving === 'instructions'}
                    onSave={drafts.saveInstructionsText}
                    onClose={() => setDialog(null)}
                />
            )}
            {dialog === 'memory' && (
                <ProjectMemoryDialog
                    project={project}
                    memories={resources.memories}
                    state={resources.memoriesState}
                    onRetry={resources.refreshMemories}
                    onToggleMemory={onToggleMemory}
                    onApprove={resources.approveMemory}
                    onApproveAll={resources.approveAllPending}
                    onSaveEdit={resources.saveMemoryEdit}
                    onDismiss={(memory) => { resources.removeMemory(memory); }}
                    onConfirmDelete={onConfirmDeleteMemory}
                    onClose={() => setDialog(null)}
                />
            )}
            {dialog === 'assistant' && (
                <AssistantPickerDialog
                    currentId={project.assistantId || undefined}
                    onClose={() => setDialog(null)}
                    onSelect={(choice) => { setDialog(null); drafts.changeAssistant(choice); }}
                />
            )}
        </>
    );
};

export default ProjectContextPanel;
