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
import { ConfirmModal } from '@/components/ReusableComponents/ConfirmModal';
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

// Shared classes mirroring the reference shadcn sizes.
const cardClass =
    'flex flex-col gap-6 rounded-xl border border-gray-200 bg-white py-6 shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36]';
const primaryButtonClass =
    'inline-flex h-9 items-center justify-center gap-2 rounded-md bg-purple-500 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-purple-600 disabled:pointer-events-none disabled:opacity-50';
const outlineSmButtonClass =
    'inline-flex h-8 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium shadow-sm transition-colors hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-600 dark:bg-transparent dark:hover:bg-neutral-700';
const inputClass =
    'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder-gray-400 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100 dark:placeholder-gray-500';

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
                        <div className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
                            This will be added to all your transformation prompts
                        </div>
                    </div>
                </div>
                {open ? (
                    <LucideChevronDown size={20} className="text-gray-500" />
                ) : (
                    <LucideChevronRight size={20} className="text-gray-500" />
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
                        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
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
                                    <span className="truncate text-sm text-gray-500 dark:text-gray-400">
                                        {transformation.description}
                                    </span>
                                )}
                            </div>
                            {transformation.apply_default && (
                                <span className="inline-flex flex-none items-center rounded-md border border-transparent bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-neutral-700 dark:text-gray-200">
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
                            className="inline-flex h-8 items-center justify-center rounded-md px-3 text-red-600 transition-colors hover:bg-gray-100 hover:text-red-700 dark:text-red-400 dark:hover:bg-neutral-700"
                        >
                            <LucideTrash2 size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {expanded && (
                <div className="space-y-4 px-6">
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Title</p>
                        <p className="text-sm font-medium">
                            {transformation.title || 'Untitled Source'}
                        </p>
                    </div>

                    {transformation.description && (
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Description
                            </p>
                            <p className="text-sm leading-6">{transformation.description}</p>
                        </div>
                    )}

                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            System Prompt
                        </p>
                        <pre className="mt-2 whitespace-pre-wrap rounded-md bg-gray-100 p-3 font-mono text-sm dark:bg-neutral-700/60">
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
                <p className="text-sm text-gray-500 dark:text-gray-400">
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
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-purple-500 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-purple-600 disabled:pointer-events-none disabled:opacity-50"
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
                    <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                        <LucideAlertCircle size={16} className="mt-0.5 flex-none" />
                        <span>{error}</span>
                    </div>
                )}

                {output && (
                    <div className="space-y-2">
                        <span className="text-sm font-medium leading-none">Output</span>
                        <div className="rounded-xl border border-gray-200 shadow-sm dark:border-neutral-700">
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

    const tabButton = (value: Tab, icon: React.ReactNode, label: string) => (
        <button
            onClick={() => setTab(value)}
            className={`inline-flex h-9 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-4 text-sm font-medium transition-all ${
                tab === value
                    ? 'border-gray-200 bg-white text-gray-900 shadow-sm dark:border-neutral-600 dark:bg-[#2b2c36] dark:text-gray-100'
                    : 'border-transparent text-gray-500 dark:text-gray-400'
            }`}
        >
            {icon}
            {label}
        </button>
    );

    return (
        <div className="w-full space-y-6 text-neutral-800 dark:text-neutral-100">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold">Transformations</h1>
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
                <p className="text-gray-500 dark:text-gray-400">
                    Transformations are prompts that will be used by the LLM to process a
                    source and extract insights, summaries, etc.
                </p>
            </div>

            <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Choose a workspace
                </p>
                <div className="flex w-full max-w-xl gap-1 rounded-xl border border-gray-200 bg-gray-100/80 p-1 shadow-sm dark:border-neutral-700 dark:bg-neutral-800/80">
                    {tabButton(
                        'transformations',
                        <LucideWand2 size={16} />,
                        'Transformations',
                    )}
                    {tabButton('playground', <LucidePlay size={16} />, 'Playground')}
                </div>
            </div>

            {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                    <LucideAlertCircle size={16} className="mt-0.5 flex-none" />
                    <span>{error}</span>
                </div>
            )}

            {tab === 'transformations' && (
                <div className="space-y-6">
                    <DefaultPromptEditor />

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <LucideLoader2 size={32} className="animate-spin text-gray-400" />
                        </div>
                    ) : transformations.length === 0 ? (
                        <div className="py-12 text-center">
                            <LucideWand2
                                size={48}
                                className="mx-auto mb-4 text-gray-400/60 dark:text-gray-500/60"
                            />
                            <h3 className="mb-2 text-lg font-medium">
                                No transformations yet
                            </h3>
                            <p className="mb-4 text-gray-500 dark:text-gray-400">
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

            {pendingDelete && (
                <ConfirmModal
                    title="Delete Source"
                    message="Are you sure you want to delete this transformation?"
                    confirmLabel={deleting ? 'Deleting…' : 'Delete'}
                    denyLabel="Cancel"
                    onConfirm={handleConfirmDelete}
                    onDeny={() => setPendingDelete(null)}
                />
            )}
        </div>
    );
};

export default TransformationsPage;
