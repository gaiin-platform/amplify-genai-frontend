import { useCallback, useEffect, useState } from 'react';
import {
    LucideAlertCircle,
    LucideChevronDown,
    LucideLoader2,
    LucideRefreshCw,
} from './LucideIcons';
import {
    AutoDeleteFiles,
    DocEngine,
    EmbeddingOption,
    NotebookSettings,
    UrlEngine,
    getSettings,
    updateSettings as updateSettingsApi,
} from '@/services/notebookService';
import { ConfirmModal } from '@/components/ReusableComponents/ConfirmModal';

// Shared classes mirroring the reference shadcn sizes.
const cardClass =
    'flex flex-col gap-6 rounded-xl border border-gray-200 bg-white py-6 shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36]';
const selectClass =
    'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100';

interface SelectFieldProps<T extends string> {
    label: string;
    value: T | '';
    onChange: (v: T) => void;
    options: { value: T; label: string }[];
    placeholder: string;
    helpId: string;
    helpText: string;
    expandedHelp: Set<string>;
    onToggleHelp: (id: string) => void;
}

// Label + select + "Help me choose" collapsible, mirroring one field group of
// the reference SettingsForm.
function SelectField<T extends string>({
    label,
    value,
    onChange,
    options,
    placeholder,
    helpId,
    helpText,
    expandedHelp,
    onToggleHelp,
}: SelectFieldProps<T>) {
    const open = expandedHelp.has(helpId);
    return (
        <div className="space-y-3">
            <label className="text-sm font-medium leading-none">{label}</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value as T)}
                className={selectClass}
            >
                <option value="" disabled>
                    {placeholder}
                </option>
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
            <button
                type="button"
                onClick={() => onToggleHelp(helpId)}
                className="flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
                <LucideChevronDown
                    size={16}
                    className={`transition-transform ${open ? 'rotate-180' : ''}`}
                />
                Help me choose
            </button>
            {open && (
                <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                    <p>{helpText}</p>
                </div>
            )}
        </div>
    );
}

export const SettingsPage = () => {
    const [settings, setSettings] = useState<NotebookSettings | null>(null);
    const [original, setOriginal] = useState<NotebookSettings | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedHelp, setExpandedHelp] = useState<Set<string>>(new Set());
    const [confirmRefresh, setConfirmRefresh] = useState<boolean>(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        const data = await getSettings();
        if (!data) {
            setError('Failed to load settings');
            setLoading(false);
            return;
        }
        setSettings(data);
        setOriginal(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const toggleHelp = (id: string) => {
        setExpandedHelp((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const set = <K extends keyof NotebookSettings>(key: K, value: NotebookSettings[K]) => {
        setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    };

    const dirty =
        settings && original ? JSON.stringify(settings) !== JSON.stringify(original) : false;

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        setError(null);
        const result = await updateSettingsApi({
            default_content_processing_engine_doc:
                settings.default_content_processing_engine_doc || undefined,
            default_content_processing_engine_url:
                settings.default_content_processing_engine_url || undefined,
            default_embedding_option: settings.default_embedding_option || undefined,
            auto_delete_files: settings.auto_delete_files || undefined,
        });
        setSaving(false);
        if (!result) {
            setError('Failed to save settings.');
            return;
        }
        setSettings(result);
        setOriginal(result);
    };

    const handleRefreshClick = () => {
        // Refresh silently overwrote in-progress unsaved edits with server
        // data — a user who tweaked a couple of dropdowns and then hit
        // Refresh (e.g. out of habit, or to see the current values elsewhere)
        // would lose those edits with zero warning. Only prompt when there's
        // actually something to lose.
        if (dirty) {
            setConfirmRefresh(true);
            return;
        }
        load();
    };

    return (
        <div className="max-w-4xl text-neutral-800 dark:text-neutral-100">
            <div className="mb-6 flex items-center gap-4">
                <h1 className="text-2xl font-bold">Settings</h1>
                <button
                    onClick={handleRefreshClick}
                    title="Refresh"
                    className="inline-flex h-8 items-center justify-center rounded-md border border-gray-300 bg-white px-3 shadow-sm transition-colors hover:bg-gray-50 dark:border-neutral-600 dark:bg-transparent dark:hover:bg-neutral-700"
                >
                    <LucideRefreshCw size={16} />
                </button>
            </div>

            {confirmRefresh && (
                <ConfirmModal
                    title="Discard unsaved changes?"
                    message="Refreshing will reload settings from the server and discard your unsaved changes."
                    confirmLabel="Discard and Refresh"
                    denyLabel="Cancel"
                    onConfirm={() => {
                        setConfirmRefresh(false);
                        load();
                    }}
                    onDeny={() => setConfirmRefresh(false)}
                />
            )}

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <LucideLoader2 size={32} className="animate-spin text-gray-400" />
                </div>
            ) : error && !settings ? (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                    <LucideAlertCircle size={16} className="mt-0.5 flex-none" />
                    <div>
                        <div className="font-medium">Failed to load settings</div>
                    </div>
                </div>
            ) : settings ? (
                <div className="space-y-6">
                    <div className={cardClass}>
                        <div className="flex flex-col gap-1.5 px-6">
                            <h2 className="text-lg font-semibold leading-none">
                                Content Processing
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Configure how documents and URLs are processed
                            </p>
                        </div>
                        <div className="space-y-6 px-6">
                            <SelectField<DocEngine>
                                label="Document Processing Engine"
                                value={
                                    (settings.default_content_processing_engine_doc as DocEngine) ||
                                    ''
                                }
                                onChange={(v) => set('default_content_processing_engine_doc', v)}
                                options={[
                                    { value: 'auto', label: 'Auto (Recommended)' },
                                    { value: 'docling', label: 'Docling' },
                                    { value: 'simple', label: 'Simple' },
                                ]}
                                placeholder="Select document processing engine"
                                helpId="doc"
                                helpText="· Docling is a little slower but more accurate, specially if the documents contain tables and images. · Simple will extract any content from the document without formatting it. · Auto (recommended) will try to process through docling and default to simple."
                                expandedHelp={expandedHelp}
                                onToggleHelp={toggleHelp}
                            />

                            <SelectField<UrlEngine>
                                label="URL Processing Engine"
                                value={
                                    (settings.default_content_processing_engine_url as UrlEngine) ||
                                    ''
                                }
                                onChange={(v) => set('default_content_processing_engine_url', v)}
                                options={[
                                    { value: 'auto', label: 'Auto (Recommended)' },
                                    { value: 'firecrawl', label: 'Firecrawl' },
                                    { value: 'jina', label: 'Jina' },
                                    { value: 'simple', label: 'Simple' },
                                ]}
                                placeholder="Select URL processing engine"
                                helpId="url"
                                helpText="· Firecrawl is a paid service (with a free tier), and very powerful. · Jina is a good option as well and also has a free tier. · Simple will use basic HTTP extraction and will miss content on javascript-based websites. · Auto (recommended) will try to use firecrawl then Jina, finally fallback to simple."
                                expandedHelp={expandedHelp}
                                onToggleHelp={toggleHelp}
                            />
                        </div>
                    </div>

                    <div className={cardClass}>
                        <div className="flex flex-col gap-1.5 px-6">
                            <h2 className="text-lg font-semibold leading-none">
                                Embedding and Search
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Configure search and embedding options
                            </p>
                        </div>
                        <div className="space-y-6 px-6">
                            <SelectField<EmbeddingOption>
                                label="Default Embedding Option"
                                value={
                                    (settings.default_embedding_option as EmbeddingOption) || ''
                                }
                                onChange={(v) => set('default_embedding_option', v)}
                                options={[
                                    { value: 'ask', label: 'Ask' },
                                    { value: 'always', label: 'Always' },
                                    { value: 'never', label: 'Never' },
                                ]}
                                placeholder="Select embedding option"
                                helpId="embedding"
                                helpText="Embedding the content will make it easier to find by you and by your AI agents. If you are running a local embedding model (Ollama, for example), you shouldn't worry about cost and just embed everything."
                                expandedHelp={expandedHelp}
                                onToggleHelp={toggleHelp}
                            />
                        </div>
                    </div>

                    <div className={cardClass}>
                        <div className="flex flex-col gap-1.5 px-6">
                            <h2 className="text-lg font-semibold leading-none">
                                File Management
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Configure file handling and storage options
                            </p>
                        </div>
                        <div className="space-y-6 px-6">
                            <SelectField<AutoDeleteFiles>
                                label="Auto Delete Files"
                                value={(settings.auto_delete_files as AutoDeleteFiles) || ''}
                                onChange={(v) => set('auto_delete_files', v)}
                                options={[
                                    { value: 'yes', label: 'Yes' },
                                    { value: 'no', label: 'No' },
                                ]}
                                placeholder="Select auto delete option"
                                helpId="files"
                                helpText="Once your files are uploaded and processed, they are not required anymore. Most users should allow Open Notebook to delete uploaded files from the upload folder automatically."
                                expandedHelp={expandedHelp}
                                onToggleHelp={toggleHelp}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                            <LucideAlertCircle size={16} className="mt-0.5 flex-none" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={!dirty || saving}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-purple-500 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-purple-600 disabled:pointer-events-none disabled:opacity-50"
                        >
                            {saving && <LucideLoader2 size={16} className="animate-spin" />}
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default SettingsPage;
