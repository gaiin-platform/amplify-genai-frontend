import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    IconAlertCircle,
    IconCheck,
    IconLoader2,
    IconPlug,
    IconSparkles,
    IconTrash,
    IconX,
} from '@tabler/icons-react';
import {
    ModelDefaults,
    ModelType,
    NotebookModel,
    createModel,
    deleteModel,
    getDefaults,
    listModels,
    testModel,
    updateDefaults,
} from '@/services/notebookService';
import { ConfirmModal } from '@/components/ReusableComponents/ConfirmModal';

const DEFAULT_PROVIDER = 'openai_compatible';

interface CatalogEntry {
    name: string;
    provider: string;
    type: ModelType;
    label: string;
    description: string;
    recommended?: boolean;
}

// Curated set of models the Vanderbilt notebook backend can actually route to
// (served by the gemma-lb + tei-embedding pods via openai_compatible). Edit
// this list to broaden user choice — keep it tight; the backend can't reach
// models the pods don't serve.
const NOTEBOOK_MODEL_CATALOG: CatalogEntry[] = [
    {
        name: 'gemma-3-27b-it',
        provider: DEFAULT_PROVIDER,
        type: 'language',
        label: 'Gemma 3 27B Instruct',
        description: 'Default chat + transformation model — served from nginx-gemma-lb.',
        recommended: true,
    },
    {
        name: 'nomic-embed-text-v1.5',
        provider: DEFAULT_PROVIDER,
        type: 'embedding',
        label: 'Nomic Embed Text v1.5',
        description: 'Default embedding model — served from tei-embedding.',
        recommended: true,
    },
    {
        name: 'gpt-4o-mini-tts',
        provider: DEFAULT_PROVIDER,
        type: 'text_to_speech',
        label: 'OpenAI gpt-4o-mini TTS',
        description:
            'Podcast text-to-speech. Routed via openai_compatible to OpenAI’s API with the dedicated TTS key (OPENAI_COMPATIBLE_API_KEY_TTS).',
        recommended: true,
    },
];

const TYPE_LABEL: Record<ModelType, string> = {
    language: 'Language',
    embedding: 'Embedding',
    text_to_speech: 'TTS',
    speech_to_text: 'STT',
};

const TYPE_PILL: Record<ModelType, string> = {
    language: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    embedding: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    text_to_speech: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    speech_to_text: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
};

interface DefaultSlot {
    key: keyof ModelDefaults;
    label: string;
    description: string;
    modelType: ModelType;
    required?: boolean;
}

const PRIMARY_SLOTS: DefaultSlot[] = [
    { key: 'default_chat_model', label: 'Chat', description: 'Used for chat sessions in notebooks.', modelType: 'language', required: true },
    { key: 'default_embedding_model', label: 'Embedding', description: 'Used to chunk + embed sources for retrieval.', modelType: 'embedding', required: true },
    { key: 'default_text_to_speech_model', label: 'Text-to-Speech', description: 'Used to generate podcast audio.', modelType: 'text_to_speech' },
    { key: 'default_speech_to_text_model', label: 'Speech-to-Text', description: 'Used to transcribe audio sources.', modelType: 'speech_to_text' },
];

const ADVANCED_SLOTS: DefaultSlot[] = [
    { key: 'default_transformation_model', label: 'Transformations', description: 'Used by source insights / transformations.', modelType: 'language', required: true },
    { key: 'default_tools_model', label: 'Tools', description: 'Used for tool-call routing.', modelType: 'language' },
    { key: 'large_context_model', label: 'Large Context', description: 'Used when content exceeds the default chat window.', modelType: 'language' },
];

const ALL_SLOTS = [...PRIMARY_SLOTS, ...ADVANCED_SLOTS];

const modelLabel = (m: NotebookModel) => `${m.name} · ${m.provider}`;

export const ModelsPage = () => {
    const [models, setModels] = useState<NotebookModel[]>([]);
    const [defaults, setDefaults] = useState<ModelDefaults>({});
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState<string | null>(null);
    const [pendingDelete, setPendingDelete] = useState<NotebookModel | null>(null);
    const [deleting, setDeleting] = useState<boolean>(false);
    const [testingId, setTestingId] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
    const [quickSetupRunning, setQuickSetupRunning] = useState<boolean>(false);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [mList, dObj] = await Promise.all([listModels(), getDefaults()]);
            setModels(mList);
            setDefaults(dObj || {});
        } catch (e: any) {
            setError(e?.message || 'Failed to load models');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const modelsByType = useMemo(() => {
        const acc: Record<ModelType, NotebookModel[]> = {
            language: [],
            embedding: [],
            text_to_speech: [],
            speech_to_text: [],
        };
        for (const m of models) {
            if (acc[m.type]) acc[m.type].push(m);
        }
        return acc;
    }, [models]);

    const handleDefaultChange = async (slot: DefaultSlot, value: string) => {
        setSaving(slot.key);
        const next = await updateDefaults({ [slot.key]: value || null } as Partial<ModelDefaults>);
        setSaving(null);
        if (next) setDefaults(next);
    };

    const handleDelete = async () => {
        if (!pendingDelete) return;
        setDeleting(true);
        const ok = await deleteModel(pendingDelete.id);
        setDeleting(false);
        if (!ok) {
            setError(`Couldn't delete "${pendingDelete.name}".`);
            setPendingDelete(null);
            return;
        }
        setModels((prev) => prev.filter((m) => m.id !== pendingDelete.id));
        setPendingDelete(null);
    };

    const runQuickSetup = async () => {
        setQuickSetupRunning(true);
        setError(null);
        try {
            const existingKeys = new Set(models.map((m) => `${m.provider}:${m.name}:${m.type}`));
            const created: NotebookModel[] = [];
            for (const entry of NOTEBOOK_MODEL_CATALOG.filter((c) => c.recommended)) {
                const key = `${entry.provider}:${entry.name}:${entry.type}`;
                if (existingKeys.has(key)) continue;
                const result = await createModel({
                    name: entry.name,
                    provider: entry.provider,
                    type: entry.type,
                });
                if (result) created.push(result);
            }
            const allModels = [...models, ...created];
            const language = allModels.find((m) => m.type === 'language');
            const embedding = allModels.find((m) => m.type === 'embedding');
            const tts = allModels.find((m) => m.type === 'text_to_speech');
            const updates: Partial<ModelDefaults> = {};
            if (language) {
                if (!defaults.default_chat_model) updates.default_chat_model = language.id;
                if (!defaults.default_transformation_model)
                    updates.default_transformation_model = language.id;
                if (!defaults.default_tools_model) updates.default_tools_model = language.id;
                if (!defaults.large_context_model) updates.large_context_model = language.id;
            }
            if (embedding && !defaults.default_embedding_model) {
                updates.default_embedding_model = embedding.id;
            }
            if (tts && !defaults.default_text_to_speech_model) {
                updates.default_text_to_speech_model = tts.id;
            }
            if (Object.keys(updates).length > 0) {
                await updateDefaults(updates);
            }
            await fetchAll();
        } catch (e: any) {
            setError(e?.message || 'Quick setup failed');
        } finally {
            setQuickSetupRunning(false);
        }
    };

    const handleTest = async (m: NotebookModel) => {
        setTestingId(m.id);
        setTestResult(null);
        const result = await testModel(m.id);
        setTestingId(null);
        setTestResult({ id: m.id, success: result.success, message: result.message });
    };

    const missingRequired = ALL_SLOTS.filter((s) => {
        if (!s.required) return false;
        const cur = defaults[s.key];
        if (!cur) return true;
        return !modelsByType[s.modelType].some((m) => m.id === cur);
    });

    const missingCatalogEntries = NOTEBOOK_MODEL_CATALOG.filter((entry) => {
        return !models.some(
            (m) =>
                m.provider === entry.provider &&
                m.name === entry.name &&
                m.type === entry.type,
        );
    });

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                    {error}
                </div>
            )}

            {/* Defaults */}
            <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36]">
                <div className="border-b border-gray-200 bg-gradient-to-b from-gray-50 to-white px-5 py-3 dark:border-neutral-700 dark:from-gray-800 dark:to-[#2b2c36]">
                    <h3 className="text-sm font-semibold">Default assignments</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Pick which registered model is used for each role.
                    </p>
                </div>

                {loading ? (
                    <div className="space-y-3 p-5">
                        {[0, 1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="h-9 animate-pulse rounded-lg border border-gray-200 bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800/60"
                            />
                        ))}
                    </div>
                ) : (
                    <div className="space-y-5 p-5">
                        {missingRequired.length > 0 && (
                            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-200">
                                <IconAlertCircle size={14} className="mt-0.5 flex-none" />
                                <span>
                                    Required model not set:{' '}
                                    <span className="font-medium">
                                        {missingRequired.map((s) => s.label).join(', ')}
                                    </span>
                                    . Notebook chat or embedding may fail until these are assigned.
                                </span>
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {PRIMARY_SLOTS.map((slot) => (
                                <DefaultSelector
                                    key={slot.key}
                                    slot={slot}
                                    options={modelsByType[slot.modelType]}
                                    value={defaults[slot.key] || ''}
                                    onChange={(v) => handleDefaultChange(slot, v)}
                                    saving={saving === slot.key}
                                />
                            ))}
                        </div>

                        <div className="border-t border-gray-200 pt-4 dark:border-neutral-700">
                            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                Advanced
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                {ADVANCED_SLOTS.map((slot) => (
                                    <DefaultSelector
                                        key={slot.key}
                                        slot={slot}
                                        options={modelsByType[slot.modelType]}
                                        value={defaults[slot.key] || ''}
                                        onChange={(v) => handleDefaultChange(slot, v)}
                                        saving={saving === slot.key}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {/* Registered models */}
            <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36]">
                <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-b from-gray-50 to-white px-5 py-3 dark:border-neutral-700 dark:from-gray-800 dark:to-[#2b2c36]">
                    <div>
                        <h3 className="text-sm font-semibold">Registered models</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {loading ? 'Loading…' : `${models.length} registered`}
                        </p>
                    </div>
                    {!loading && models.length > 0 && missingCatalogEntries.length > 0 && (
                        <button
                            onClick={runQuickSetup}
                            disabled={quickSetupRunning}
                            title={`Register: ${missingCatalogEntries.map((e) => e.label).join(', ')}`}
                            className="flex items-center gap-1.5 rounded-lg border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-100 disabled:opacity-50 dark:border-purple-500/40 dark:bg-purple-900/20 dark:text-purple-300 dark:hover:bg-purple-900/30"
                        >
                            {quickSetupRunning ? (
                                <IconLoader2 size={12} className="animate-spin" />
                            ) : (
                                <IconSparkles size={12} />
                            )}
                            Register {missingCatalogEntries.length} missing model
                            {missingCatalogEntries.length === 1 ? '' : 's'}
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="space-y-2 p-5">
                        {[0, 1, 2].map((i) => (
                            <div
                                key={i}
                                className="h-12 animate-pulse rounded-lg border border-gray-200 bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800/60"
                            />
                        ))}
                    </div>
                ) : models.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-sm">
                            <IconSparkles size={22} />
                        </div>
                        <div className="text-sm font-semibold">No models registered yet</div>
                        <p className="mt-1 max-w-sm text-xs text-gray-500 dark:text-gray-400">
                            Use the recommended pair (Gemma 3 27B + Nomic Embed) — the cheapest +
                            most efficient combo for this deployment.
                        </p>
                        <button
                            onClick={runQuickSetup}
                            disabled={quickSetupRunning}
                            className="mt-4 flex items-center gap-1.5 rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-purple-600 disabled:opacity-50"
                        >
                            {quickSetupRunning ? (
                                <IconLoader2 size={14} className="animate-spin" />
                            ) : (
                                <IconSparkles size={14} />
                            )}
                            Quick setup with recommended models
                        </button>
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-100 dark:divide-neutral-800">
                        {(['language', 'embedding', 'text_to_speech', 'speech_to_text'] as ModelType[])
                            .filter((t) => modelsByType[t].length > 0)
                            .map((type) => (
                                <li key={type} className="px-5 py-3">
                                    <div className="mb-2 flex items-center gap-2">
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TYPE_PILL[type]}`}
                                        >
                                            {TYPE_LABEL[type]}
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            {modelsByType[type].length} model
                                            {modelsByType[type].length === 1 ? '' : 's'}
                                        </span>
                                    </div>
                                    <ul className="space-y-1">
                                        {modelsByType[type].map((m) => {
                                            const slot = ALL_SLOTS.find((s) => defaults[s.key] === m.id);
                                            const result = testResult?.id === m.id ? testResult : null;
                                            return (
                                                <li
                                                    key={m.id}
                                                    className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-purple-50/40 dark:hover:bg-purple-900/10"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="truncate text-sm font-medium">
                                                                {m.name}
                                                            </span>
                                                            <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                                                {m.provider}
                                                            </span>
                                                            {slot && (
                                                                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                                                                    Default · {slot.label}
                                                                </span>
                                                            )}
                                                            {result && (
                                                                <span
                                                                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                                                        result.success
                                                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                                                            : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                                                    }`}
                                                                >
                                                                    {result.success ? (
                                                                        <IconCheck size={10} />
                                                                    ) : (
                                                                        <IconX size={10} />
                                                                    )}
                                                                    {result.success ? 'Test passed' : 'Test failed'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {result && !result.success && result.message && (
                                                            <div className="mt-1 text-[11px] text-red-600 dark:text-red-300">
                                                                {result.message}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-none items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                                        <button
                                                            onClick={() => handleTest(m)}
                                                            disabled={testingId === m.id}
                                                            title="Test connection"
                                                            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-neutral-700 dark:hover:text-white"
                                                        >
                                                            {testingId === m.id ? (
                                                                <IconLoader2 size={14} className="animate-spin" />
                                                            ) : (
                                                                <IconPlug size={14} />
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={() => setPendingDelete(m)}
                                                            title="Delete model"
                                                            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                                                        >
                                                            <IconTrash size={14} />
                                                        </button>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </li>
                            ))}
                    </ul>
                )}
            </section>

            {pendingDelete && (
                <ConfirmModal
                    title="Delete model?"
                    message={
                        <span>
                            Remove <b>{pendingDelete.name}</b> from the registered model list?
                            Default assignments using this model will be cleared.
                        </span>
                    }
                    confirmLabel={deleting ? 'Deleting…' : 'Delete'}
                    denyLabel="Cancel"
                    onConfirm={handleDelete}
                    onDeny={() => setPendingDelete(null)}
                />
            )}
        </div>
    );
};

interface DefaultSelectorProps {
    slot: DefaultSlot;
    options: NotebookModel[];
    value: string;
    onChange: (next: string) => void;
    saving: boolean;
}

const DefaultSelector: React.FC<DefaultSelectorProps> = ({
    slot,
    options,
    value,
    onChange,
    saving,
}) => {
    const currentMissing = !!value && !options.some((m) => m.id === value);
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">
                    {slot.label}
                    {slot.required && <span className="ml-0.5 text-red-500">*</span>}
                </label>
                {saving && (
                    <span className="flex items-center gap-1 text-[10px] text-gray-400">
                        <IconLoader2 size={10} className="animate-spin" /> saving…
                    </span>
                )}
            </div>
            <div className="relative">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={options.length === 0}
                    className={`h-9 w-full appearance-none rounded-lg border bg-white px-3 pr-8 text-sm outline-none transition-colors focus:border-purple-400 focus:ring-1 focus:ring-purple-400 disabled:bg-gray-50 disabled:text-gray-400 dark:bg-[#2b2c36] dark:disabled:bg-neutral-800 ${
                        slot.required && !value
                            ? 'border-red-300 dark:border-red-500/60'
                            : 'border-gray-200 dark:border-neutral-700'
                    }`}
                >
                    <option value="">
                        {options.length === 0
                            ? `No ${slot.modelType.replace('_', ' ')} models registered`
                            : 'Select…'}
                    </option>
                    {currentMissing && (
                        <option value={value} disabled>
                            (unknown · {value})
                        </option>
                    )}
                    {options.map((m) => (
                        <option key={m.id} value={m.id}>
                            {modelLabel(m)}
                        </option>
                    ))}
                </select>
                <IconArrowDown />
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">{slot.description}</p>
        </div>
    );
};

const IconArrowDown = () => (
    <svg
        className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400"
        viewBox="0 0 12 12"
        fill="none"
    >
        <path
            d="M2 4l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);
export default ModelsPage;
