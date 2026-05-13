import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    IconAlertCircle,
    IconChevronDown,
    IconChevronRight,
    IconEdit,
    IconLoader2,
    IconPlayerPlay,
    IconPlus,
    IconRefresh,
    IconSettings,
    IconSparkles,
    IconTrash,
    IconWand,
} from '@tabler/icons-react';
import { ConfirmModal } from '@/components/ReusableComponents/ConfirmModal';
import {
    DefaultPrompt,
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
} from '@/services/notebookConfigService';
import { TransformationEditorDialog } from './TransformationEditorDialog';

type Tab = 'transformations' | 'playground';

const TabsHeader = ({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) => (
    <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Workspace
        </p>
        <div className="inline-flex w-full max-w-md rounded-lg border border-gray-200 bg-white p-1 shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36]">
            <button
                onClick={() => onTab('transformations')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    tab === 'transformations'
                        ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-700'
                }`}
            >
                <IconWand size={16} />
                Transformations
            </button>
            <button
                onClick={() => onTab('playground')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    tab === 'playground'
                        ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-700'
                }`}
            >
                <IconPlayerPlay size={16} />
                Playground
            </button>
        </div>
    </div>
);

const DefaultPromptEditor = () => {
    const [open, setOpen] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [savedAt, setSavedAt] = useState<number | null>(null);
    const [prompt, setPrompt] = useState<string>('');
    const [original, setOriginal] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        const dp = await getDefaultPrompt();
        if (dp) {
            const text = dp.transformation_instructions || '';
            setPrompt(text);
            setOriginal(text);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const dirty = prompt !== original;

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        const result = await updateDefaultPrompt({ transformation_instructions: prompt });
        setSaving(false);
        if (!result) {
            setError('Failed to save default prompt.');
            return;
        }
        setOriginal(result.transformation_instructions || '');
        setSavedAt(Date.now());
    };

    return (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36]">
            <button
                onClick={() => setOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
                <div className="flex items-center gap-2">
                    <IconSettings size={18} className="text-purple-600 dark:text-purple-400" />
                    <div>
                        <div className="text-sm font-semibold">Default prompt</div>
                        <div className="text-[12px] text-gray-500 dark:text-gray-400">
                            Instructions prepended to every transformation run.
                        </div>
                    </div>
                </div>
                {open ? (
                    <IconChevronDown size={18} className="text-gray-400" />
                ) : (
                    <IconChevronRight size={18} className="text-gray-400" />
                )}
            </button>

            {open && (
                <div className="border-t border-gray-200 px-4 py-3 dark:border-neutral-700">
                    {loading ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <IconLoader2 size={16} className="animate-spin" />
                            Loading default prompt…
                        </div>
                    ) : (
                        <>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="e.g. Always respond in markdown. Use the structure provided."
                                className="min-h-[200px] w-full resize-y rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-[12.5px] leading-5 dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100"
                            />
                            {error && (
                                <div className="mt-2 flex items-start gap-2 rounded border border-red-200 bg-red-50 p-2 text-[12px] text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                                    <IconAlertCircle size={14} className="mt-0.5 flex-none" />
                                    <span>{error}</span>
                                </div>
                            )}
                            <div className="mt-3 flex items-center justify-end gap-2">
                                {savedAt && !dirty && !error && (
                                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                                        Saved.
                                    </span>
                                )}
                                <button
                                    onClick={handleSave}
                                    disabled={saving || !dirty}
                                    className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors ${
                                        saving || !dirty
                                            ? 'cursor-not-allowed bg-gray-200 text-gray-500 dark:bg-neutral-700 dark:text-neutral-400'
                                            : 'bg-purple-500 text-white hover:bg-purple-600'
                                    }`}
                                >
                                    {saving ? (
                                        <>
                                            <IconLoader2 size={14} className="animate-spin" />
                                            Saving…
                                        </>
                                    ) : (
                                        'Save'
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

interface CardProps {
    transformation: Transformation;
    onEdit: () => void;
    onPlayground: () => void;
    onDelete: () => void;
}

const TransformationCard = ({ transformation, onEdit, onPlayground, onDelete }: CardProps) => {
    const [open, setOpen] = useState<boolean>(false);
    return (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36]">
            <div className="flex items-start gap-3 px-4 py-3">
                <button
                    onClick={() => setOpen((v) => !v)}
                    className="flex flex-1 items-start gap-2 text-left"
                >
                    {open ? (
                        <IconChevronDown size={18} className="mt-0.5 text-gray-400" />
                    ) : (
                        <IconChevronRight size={18} className="mt-0.5 text-gray-400" />
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{transformation.name}</span>
                            {transformation.apply_default && (
                                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                                    Default
                                </span>
                            )}
                        </div>
                        {!open && transformation.description && (
                            <div className="mt-0.5 line-clamp-1 text-[12px] text-gray-500 dark:text-gray-400">
                                {transformation.description}
                            </div>
                        )}
                    </div>
                </button>

                <div className="flex items-center gap-1">
                    <button
                        onClick={onPlayground}
                        title="Open in playground"
                        className="flex h-8 items-center gap-1 rounded-md border border-gray-200 px-2 text-[12px] text-gray-700 hover:bg-gray-100 dark:border-neutral-600 dark:text-gray-200 dark:hover:bg-neutral-700"
                    >
                        <IconPlayerPlay size={14} />
                        Playground
                    </button>
                    <button
                        onClick={onEdit}
                        title="Edit"
                        className="flex h-8 items-center gap-1 rounded-md border border-gray-200 px-2 text-[12px] text-gray-700 hover:bg-gray-100 dark:border-neutral-600 dark:text-gray-200 dark:hover:bg-neutral-700"
                    >
                        <IconEdit size={14} />
                        Edit
                    </button>
                    <button
                        onClick={onDelete}
                        title="Delete"
                        className="flex h-8 w-8 items-center justify-center rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                        <IconTrash size={14} />
                    </button>
                </div>
            </div>

            {open && (
                <div className="space-y-3 border-t border-gray-200 px-4 py-3 dark:border-neutral-700">
                    {transformation.title && (
                        <div>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Title
                            </div>
                            <div className="text-[13px]">{transformation.title}</div>
                        </div>
                    )}
                    {transformation.description && (
                        <div>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Description
                            </div>
                            <div className="text-[13px] leading-5">{transformation.description}</div>
                        </div>
                    )}
                    <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            System prompt
                        </div>
                        <pre className="mt-1 max-h-72 overflow-y-auto whitespace-pre-wrap rounded border border-gray-200 bg-gray-50 p-2 font-mono text-[12px] dark:border-neutral-700 dark:bg-[#343541]">
                            {transformation.prompt}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
};

interface PlaygroundProps {
    transformations: Transformation[];
    initialId?: string;
    defaults: ModelDefaults | null;
    languageModels: NotebookModel[];
}

const Playground = ({ transformations, initialId, defaults, languageModels }: PlaygroundProps) => {
    const [selectedId, setSelectedId] = useState<string>(initialId || '');
    const [modelId, setModelId] = useState<string>('');
    const [inputText, setInputText] = useState<string>('');
    const [output, setOutput] = useState<string>('');
    const [running, setRunning] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (initialId) setSelectedId(initialId);
    }, [initialId]);

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

    const canRun =
        !running && !!selectedId && !!modelId && inputText.trim().length > 0;

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
            setError('Failed to run transformation. Verify the transformation and a language model are configured.');
            return;
        }
        setOutput(result.output || '');
    };

    return (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36]">
            <div className="border-b border-gray-200 px-4 py-3 dark:border-neutral-700">
                <div className="flex items-center gap-2">
                    <IconPlayerPlay size={18} className="text-purple-600 dark:text-purple-400" />
                    <div>
                        <div className="text-sm font-semibold">Playground</div>
                        <div className="text-[12px] text-gray-500 dark:text-gray-400">
                            Test a transformation against arbitrary text before applying it to sources.
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4 p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium">Transformation</label>
                        <select
                            value={selectedId}
                            onChange={(e) => setSelectedId(e.target.value)}
                            className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100"
                        >
                            <option value="">Select a transformation…</option>
                            {transformations.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium">Model</label>
                        <select
                            value={modelId}
                            onChange={(e) => setModelId(e.target.value)}
                            className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100"
                        >
                            <option value="">Select a model…</option>
                            {languageModels.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {m.name} ({m.provider})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Input</label>
                    <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Paste the source text to transform…"
                        className="min-h-[180px] resize-y rounded border border-neutral-300 bg-white px-3 py-2 font-mono text-[12.5px] leading-5 dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100"
                    />
                </div>

                <div className="flex justify-center">
                    <button
                        onClick={handleRun}
                        disabled={!canRun}
                        className={`flex h-9 items-center gap-1.5 rounded-md px-4 text-sm font-medium transition-colors ${
                            !canRun
                                ? 'cursor-not-allowed bg-gray-200 text-gray-500 dark:bg-neutral-700 dark:text-neutral-400'
                                : 'bg-purple-500 text-white hover:bg-purple-600'
                        }`}
                    >
                        {running ? (
                            <>
                                <IconLoader2 size={16} className="animate-spin" />
                                Running…
                            </>
                        ) : (
                            <>
                                <IconPlayerPlay size={16} />
                                Run transformation
                            </>
                        )}
                    </button>
                </div>

                {error && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                        <IconAlertCircle size={16} className="mt-0.5 flex-none" />
                        <span>{error}</span>
                    </div>
                )}

                {output && (
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium">Output</label>
                        <pre className="max-h-[400px] overflow-y-auto whitespace-pre-wrap rounded border border-gray-200 bg-gray-50 p-3 text-[13px] leading-5 dark:border-neutral-700 dark:bg-[#343541]">
                            {output}
                        </pre>
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
            const [d, models] = await Promise.all([
                getDefaults(),
                listModels('language'),
            ]);
            if (cancelled) return;
            setDefaults(d);
            setLanguageModels(models);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const sorted = useMemo(
        () => [...transformations].sort((a, b) => a.name.localeCompare(b.name)),
        [transformations],
    );

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

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 text-neutral-800 dark:text-neutral-100">
            <div className="flex items-start justify-between gap-3">
                <TabsHeader tab={tab} onTab={setTab} />
                <div className="flex items-center gap-2">
                    <button
                        onClick={refresh}
                        title="Refresh"
                        className="flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-sm text-gray-700 shadow-sm hover:bg-gray-50 dark:border-neutral-700 dark:bg-[#2b2c36] dark:text-gray-200 dark:hover:bg-neutral-700"
                    >
                        <IconRefresh size={14} />
                        Refresh
                    </button>
                    {tab === 'transformations' && (
                        <button
                            onClick={() => setCreating(true)}
                            className="flex h-8 items-center gap-1.5 rounded-md bg-purple-500 px-3 text-sm font-medium text-white shadow-sm hover:bg-purple-600"
                        >
                            <IconPlus size={14} />
                            New transformation
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                    <IconAlertCircle size={16} className="mt-0.5 flex-none" />
                    <span>{error}</span>
                </div>
            )}

            {tab === 'transformations' && (
                <>
                    <DefaultPromptEditor />

                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-semibold">All transformations</h2>
                        <span className="text-[12px] text-gray-500 dark:text-gray-400">
                            {sorted.length} total
                        </span>
                    </div>

                    {loading ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <IconLoader2 size={16} className="animate-spin" />
                            Loading transformations…
                        </div>
                    ) : sorted.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-12 text-center dark:border-neutral-700 dark:bg-[#2b2c36]">
                            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-sm">
                                <IconSparkles size={22} />
                            </div>
                            <h3 className="text-base font-semibold">No transformations yet</h3>
                            <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
                                Define a system prompt to extract insights, summarize, or rewrite source content.
                            </p>
                            <button
                                onClick={() => setCreating(true)}
                                className="mt-4 flex h-8 items-center gap-1.5 rounded-md bg-purple-500 px-3 text-sm font-medium text-white shadow-sm hover:bg-purple-600"
                            >
                                <IconPlus size={14} />
                                Create the first one
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {sorted.map((t) => (
                                <TransformationCard
                                    key={t.id}
                                    transformation={t}
                                    onEdit={() => setEditing(t)}
                                    onPlayground={() => handleOpenInPlayground(t)}
                                    onDelete={() => setPendingDelete(t)}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}

            {tab === 'playground' && (
                <Playground
                    transformations={sorted}
                    initialId={playgroundId}
                    defaults={defaults}
                    languageModels={languageModels}
                />
            )}

            {creating && (
                <TransformationEditorDialog
                    onClose={() => setCreating(false)}
                    onSaved={handleSaved}
                />
            )}

            {editing && (
                <TransformationEditorDialog
                    transformation={editing}
                    onClose={() => setEditing(null)}
                    onSaved={handleSaved}
                />
            )}

            {pendingDelete && (
                <ConfirmModal
                    title="Delete transformation?"
                    message={
                        <span>
                            Delete <b>{pendingDelete.name}</b>? This can&apos;t be undone.
                        </span>
                    }
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
