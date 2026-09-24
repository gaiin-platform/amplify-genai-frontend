import { useCallback, useEffect, useState } from 'react';
import remarkGfm from 'remark-gfm';
import {
    LucideAlertCircle,
    LucideChevronDown,
    LucideChevronRight,
    LucideEdit,
    LucideLoader2,
    LucidePlay,
    LucidePlus,
    LucideRefreshCw,
    LucideSettings,
    LucideTrash2,
    LucideWand2,
} from './LucideIcons';
import { ConfirmDialog } from '@/components/NewUI/shared/ConfirmDialog';
import { SegmentedControl, SegmentItem } from '@/components/NewUI/shared/SegmentedControl';
import { cardClass, primaryButtonClass, outlineSmButtonClass, secondaryBadgeClass } from './notebookUI';
import { MemoizedReactMarkdown } from '@/components/Markdown/MemoizedReactMarkdown';
import {
    ModelDefaults,
    NotebookModel,
    Transformation,
    deleteTransformation as deleteTransformationApi,
    executeTransformation as executeTransformationApi,
    getDefaultPrompt,
    getDefaults,
    listModels,
    listTransformations,
    updateDefaultPrompt,
} from '@/services/notebookService';
import { TransformationEditorDialog } from './TransformationEditorDialog';
import { formatModelName, prepareModelOptions } from './modelDisplay';

type Tab = 'transformations' | 'playground';

const inputClass =
    'w-full rounded-md border border-[--border-subtle] bg-[--bg-composer] px-3 py-2 text-sm shadow-sm placeholder:text-[--text-muted] outline-none focus:border-[--accent] focus:ring-1 focus:ring-[--accent] text-[--text-primary]';

const DefaultPromptEditor = () => {
    const [open, setOpen] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [prompt, setPrompt] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const dp = await getDefaultPrompt();
            if (cancelled) return;
            if (dp) setPrompt(dp.transformation_instructions || '');
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        const result = await updateDefaultPrompt({ transformation_instructions: prompt });
        setSaving(false);
        if (!result) {
            setError('Failed to save default prompt.');
        }
    };

    return (
        <div className={cardClass}>
            <button
                onClick={() => setOpen((v) => !v)}
                className="flex w-full items-center justify-between px-6 text-left"
            >
                <div className="flex items-center gap-2">
                    <LucideSettings size={20} />
                    <div>
                        <div className="text-lg font-semibold leading-none">
                            Default Transformation Prompt
                        </div>
                        <div className="mt-1.5 text-sm text-[--text-muted]">
                            This will be added to all your transformation prompts
                        </div>
                    </div>
                </div>
                {open ? (
                    <LucideChevronDown size={20} className="text-[--text-muted]" />
                ) : (
                    <LucideChevronRight size={20} className="text-[--text-muted]" />
                )}
            </button>

            {open && (
                <div className="space-y-4 px-6">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Enter your default transformation instructions..."
                        disabled={loading}
                        className={`min-h-[200px] resize-y font-mono ${inputClass}`}
                    />
                    {error && (
                        <div className="flex items-start gap-2 rounded-md border border-[--border-subtle] bg-[--bg-raised] p-2 text-sm text-[--text-error]">
                            <LucideAlertCircle size={16} className="mt-0.5 flex-none" />
                            <span>{error}</span>
                        </div>
                    )}
                    <div className="flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={loading || saving}
                            className={primaryButtonClass}
                        >
                            {saving && <LucideLoader2 size={16} className="animate-spin" />}
                            Save
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const TransformationCard = ({
    transformation,
    onEdit,
    onPlayground,
    onDelete,
}: {
    transformation: Transformation;
    onEdit: () => void;
    onPlayground: () => void;
    onDelete: () => void;
}) => {
    const [expanded, setExpanded] = useState<boolean>(false);
    return (
        <div className={cardClass}>
            <div className="px-6">
                <div className="flex items-start justify-between gap-4">
                    <button
                        onClick={() => setExpanded((v) => !v)}
                        className="flex-1 text-left"
                    >
                        <div className="flex items-center gap-3">
                            {expanded ? (
                                <LucideChevronDown size={20} className="flex-none" />
                            ) : (
                                <LucideChevronRight size={20} className="flex-none" />
                            )}
                            <div className="flex min-w-0 flex-col">
                                <span className="font-semibold">{transformation.name}</span>
                                {!expanded && transformation.description && (
                                    <span className="truncate text-sm text-[--text-muted]">
                                        {transformation.description}
                                    </span>
                                )}
                            </div>
                            {transformation.apply_default && (
                                <span className={`flex-none ${secondaryBadgeClass}`}>
                                    Default
                                </span>
                            )}
                        </div>
                    </button>

                    <div className="flex flex-none items-center gap-2">
                        <button onClick={onPlayground} className={outlineSmButtonClass}>
                            <LucideWand2 size={16} className="mr-2" />
                            Playground
                        </button>
                        <button onClick={onEdit} className={outlineSmButtonClass}>
                            <LucideEdit size={16} className="mr-2" />
                            Edit
                        </button>
                        <button
                            onClick={onDelete}
                            className="inline-flex h-8 items-center justify-center rounded-md px-3 text-[--text-error] transition-colors hover:bg-[--bg-hover]"
                        >
                            <LucideTrash2 size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {expanded && (
                <div className="space-y-4 px-6">
                    <div>
                        <p className="text-sm text-[--text-muted]">Title</p>
                        <p className="text-sm font-medium">
                            {transformation.title || 'Untitled Source'}
                        </p>
                    </div>

                    {transformation.description && (
                        <div>
                            <p className="text-sm text-[--text-muted]">
                                Description
                            </p>
                            <p className="text-sm leading-6">{transformation.description}</p>
                        </div>
                    )}

                    <div>
                        <p className="text-sm text-[--text-muted]">
                            System Prompt
                        </p>
                        <pre className="mt-2 whitespace-pre-wrap rounded-md bg-[--bg-active] p-3 font-mono text-sm">
                            {transformation.prompt}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
};

const Playground = ({
    transformations,
    initialId,
    languageModels,
    defaults,
}: {
    transformations: Transformation[];
    initialId?: string;
    languageModels: NotebookModel[];
    defaults: ModelDefaults | null;
}) => {
    const [selectedId, setSelectedId] = useState<string>(initialId || '');
    const [modelId, setModelId] = useState<string>('');
    const [inputText, setInputText] = useState<string>('');
    const [output, setOutput] = useState<string>('');
    const [running, setRunning] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (initialId) setSelectedId(initialId);
    }, [initialId]);

    // Preselect this deployment's default transformation/chat model so Run is
    // one click away (the reference leaves it unselected, but its model list
    // is user-managed; ours is fixed server-side).
    useEffect(() => {
        if (modelId) return;
        if (defaults?.default_transformation_model) {
            setModelId(defaults.default_transformation_model);
        } else if (defaults?.default_chat_model) {
            setModelId(defaults.default_chat_model);
        } else if (languageModels.length > 0) {
            setModelId(languageModels[0].id);
        }
    }, [defaults, languageModels, modelId]);

    const canRun = !running && !!selectedId && !!modelId && inputText.trim().length > 0;

    const handleRun = async () => {
        if (!canRun) return;
        setRunning(true);
        setError(null);
        setOutput('');
        const result = await executeTransformationApi({
            transformation_id: selectedId,
            input_text: inputText,
            model_id: modelId,
        });
        setRunning(false);
        if (!result) {
            setError(
                'Failed to run transformation. Verify the transformation and a language model are configured.',
            );
            return;
        }
        setOutput(result.output || '');
    };

    return (
        <div className={cardClass}>
            <div className="flex flex-col gap-1.5 px-6">
                <h2 className="text-lg font-semibold leading-none">Playground</h2>
                <p className="text-sm text-[--text-muted]">
                    Transformations are prompts that will be used by the LLM to process a
                    source and extract insights, summaries, etc.
                </p>
            </div>

            <div className="space-y-6 px-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <label className="text-sm font-medium leading-none">
                            Transformation
                        </label>
                        <select
                            value={selectedId}
                            onChange={(e) => setSelectedId(e.target.value)}
                            className={`mt-2 ${inputClass}`}
                        >
                            <option value="">Select a transformation to start</option>
                            {transformations.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-medium leading-none">Model</label>
                        <select
                            value={modelId}
                            onChange={(e) => setModelId(e.target.value)}
                            className={`mt-2 ${inputClass}`}
                        >
                            <option value="">Select a model</option>
                            {languageModels.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {formatModelName(m.name)}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="text-sm font-medium leading-none">Input Text</label>
                    <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Enter some text to transform..."
                        rows={8}
                        className={`mt-2 resize-y font-mono ${inputClass}`}
                    />
                </div>

                <div className="flex justify-center">
                    <button
                        onClick={handleRun}
                        disabled={!canRun}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[--accent] px-6 text-sm font-medium text-[--accent-fg] shadow-sm transition-colors hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
                    >
                        {running ? (
                            <>
                                <LucideLoader2 size={16} className="animate-spin" />
                                Running...
                            </>
                        ) : (
                            <>
                                <LucidePlay size={16} />
                                Run Transformation
                            </>
                        )}
                    </button>
                </div>

                {error && (
                    <div className="flex items-start gap-2 rounded-md border border-[--border-subtle] bg-[--bg-raised] p-3 text-sm text-[--text-error]">
                        <LucideAlertCircle size={16} className="mt-0.5 flex-none" />
                        <span>{error}</span>
                    </div>
                )}

                {output && (
                    <div className="space-y-2">
                        <span className="text-sm font-medium leading-none">Output</span>
                        <div className="rounded-xl border border-[--border-subtle] shadow-sm">
                            <div className="h-[400px] overflow-y-auto p-6">
                                <MemoizedReactMarkdown
                                    className="prose prose-sm dark:prose-invert max-w-none break-words"
                                    remarkPlugins={[remarkGfm]}
                                >
                                    {output}
                                </MemoizedReactMarkdown>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export const TransformationsPage = () => {
    const [tab, setTab] = useState<Tab>('transformations');
    const [transformations, setTransformations] = useState<Transformation[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const [editing, setEditing] = useState<Transformation | null>(null);
    const [creating, setCreating] = useState<boolean>(false);
    const [pendingDelete, setPendingDelete] = useState<Transformation | null>(null);
    const [deleting, setDeleting] = useState<boolean>(false);

    const [playgroundId, setPlaygroundId] = useState<string | undefined>();

    const [defaults, setDefaults] = useState<ModelDefaults | null>(null);
    const [languageModels, setLanguageModels] = useState<NotebookModel[]>([]);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const list = await listTransformations();
            setTransformations(list);
        } catch (e: any) {
            setError(e?.message || 'Failed to load transformations.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [d, models] = await Promise.all([getDefaults(), listModels('language')]);
            if (cancelled) return;
            setDefaults(d);
            setLanguageModels(prepareModelOptions(models));
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const handleOpenInPlayground = (t: Transformation) => {
        setPlaygroundId(t.id);
        setTab('playground');
    };

    const handleSaved = (t: Transformation) => {
        setTransformations((prev) => {
            const idx = prev.findIndex((x) => x.id === t.id);
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = t;
                return next;
            }
            return [...prev, t];
        });
    };

    const handleConfirmDelete = async () => {
        if (!pendingDelete) return;
        setDeleting(true);
        const ok = await deleteTransformationApi(pendingDelete.id);
        setDeleting(false);
        if (!ok) {
            setError(`Couldn't delete "${pendingDelete.name}".`);
            setPendingDelete(null);
            return;
        }
        setTransformations((prev) => prev.filter((t) => t.id !== pendingDelete.id));
        setPendingDelete(null);
    };

    const tabItems: SegmentItem[] = [
        { id: 'transformations', label: 'Transformations', icon: <LucideWand2 size={16} /> },
        { id: 'playground', label: 'Playground', icon: <LucidePlay size={16} /> },
    ];

    return (
        <div className="w-full space-y-6 text-[--text-primary]">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-[16px] font-semibold">Transformations</h1>
                    <button
                        onClick={refresh}
                        title="Refresh"
                        className={outlineSmButtonClass}
                    >
                        <LucideRefreshCw size={16} />
                    </button>
                </div>
            </div>

            <div className="max-w-5xl">
                <p className="text-[--text-muted]">
                    Transformations are prompts that will be used by the LLM to process a
                    source and extract insights, summaries, etc.
                </p>
            </div>

            <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[--text-muted]">
                    Choose a workspace
                </p>
                <div className="w-full max-w-xl">
                    <SegmentedControl
                        items={tabItems}
                        value={tab}
                        onChange={(id) => setTab(id as Tab)}
                        aria-label="Transformations workspace"
                    />
                </div>
            </div>

            {error && (
                <div className="flex items-start gap-2 rounded-lg border border-[--border-subtle] bg-[--bg-raised] p-3 text-sm text-[--text-error]">
                    <LucideAlertCircle size={16} className="mt-0.5 flex-none" />
                    <span>{error}</span>
                </div>
            )}

            {tab === 'transformations' && (
                <div className="space-y-6">
                    <DefaultPromptEditor />

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <LucideLoader2 size={32} className="animate-spin text-[--text-muted]" />
                        </div>
                    ) : transformations.length === 0 ? (
                        <div className="py-12 text-center">
                            <LucideWand2
                                size={48}
                                className="mx-auto mb-4 text-[--text-muted] opacity-60"
                            />
                            <h3 className="mb-2 text-lg font-medium">
                                No transformations yet
                            </h3>
                            <p className="mb-4 text-[--text-muted]">
                                Create a transformation to get started
                            </p>
                            <button
                                onClick={() => setCreating(true)}
                                className={primaryButtonClass}
                            >
                                <LucidePlus size={16} />
                                Create New
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold">
                                    Custom Transformations
                                </h2>
                                <button
                                    onClick={() => setCreating(true)}
                                    className={primaryButtonClass}
                                >
                                    <LucidePlus size={16} />
                                    Create New
                                </button>
                            </div>

                            <div className="space-y-4">
                                {transformations.map((t) => (
                                    <TransformationCard
                                        key={t.id}
                                        transformation={t}
                                        onEdit={() => setEditing(t)}
                                        onPlayground={() => handleOpenInPlayground(t)}
                                        onDelete={() => setPendingDelete(t)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {tab === 'playground' && (
                <Playground
                    transformations={transformations}
                    initialId={playgroundId}
                    defaults={defaults}
                    languageModels={languageModels}
                />
            )}

            {(creating || editing) && (
                <TransformationEditorDialog
                    transformation={editing}
                    onClose={() => {
                        setCreating(false);
                        setEditing(null);
                    }}
                    onSaved={handleSaved}
                />
            )}

            <ConfirmDialog
                isOpen={!!pendingDelete}
                title="Delete Transformation"
                message="Are you sure you want to delete this transformation?"
                confirmLabel={deleting ? 'Deleting…' : 'Delete'}
                cancelLabel="Cancel"
                variant="danger"
                onConfirm={handleConfirmDelete}
                onCancel={() => setPendingDelete(null)}
            />
        </div>
    );
};

export default TransformationsPage;
