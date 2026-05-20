import { useCallback, useEffect, useState } from 'react';
import {
    IconAlertCircle,
    IconChevronDown,
    IconChevronRight,
    IconLoader2,
    IconRefresh,
    IconSettings,
} from '@tabler/icons-react';
import {
    AutoDeleteFiles,
    DocEngine,
    EmbeddingOption,
    NotebookSettings,
    UrlEngine,
    getSettings,
    updateSettings as updateSettingsApi,
} from '@/services/notebookConfigService';

interface SelectFieldProps<T extends string> {
    label: string;
    value: T | '';
    onChange: (v: T) => void;
    options: { value: T; label: string }[];
    placeholder?: string;
    helpId: string;
    helpText: string;
    expandedHelp: Set<string>;
    onToggleHelp: (id: string) => void;
}

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
        <div className="space-y-2">
            <label className="block text-sm font-medium">{label}</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value as T)}
                className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100"
            >
                {placeholder && <option value="">{placeholder}</option>}
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
            <button
                type="button"
                onClick={() => onToggleHelp(helpId)}
                className="flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
                {open ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
                Help me choose
            </button>
            {open && (
                <p className="rounded bg-gray-50 p-2 text-[12px] text-gray-600 dark:bg-[#343541] dark:text-gray-300">
                    {helpText}
                </p>
            )}
        </div>
    );
}

interface SectionCardProps {
    title: string;
    description: string;
    children: React.ReactNode;
}

const SectionCard = ({ title, description, children }: SectionCardProps) => (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-[#2b2c36]">
        <div className="border-b border-gray-200 px-4 py-3 dark:border-neutral-700">
            <div className="text-sm font-semibold">{title}</div>
            <div className="text-[12px] text-gray-500 dark:text-gray-400">{description}</div>
        </div>
        <div className="space-y-5 p-4">{children}</div>
    </div>
);

export const SettingsPage = () => {
    const [settings, setSettings] = useState<NotebookSettings | null>(null);
    const [original, setOriginal] = useState<NotebookSettings | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [savedAt, setSavedAt] = useState<number | null>(null);
    const [expandedHelp, setExpandedHelp] = useState<Set<string>>(new Set());
    // Free-text mirror of settings.youtube_preferred_languages. We keep this
    // separate so the user can type "en, " mid-edit without the trailing comma
    // being eaten by a round-trip through array.join().
    const [ytLangsInput, setYtLangsInput] = useState<string>('');

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        const data = await getSettings();
        if (!data) {
            setError('Failed to load settings.');
            setLoading(false);
            return;
        }
        setSettings(data);
        setOriginal(data);
        setYtLangsInput((data.youtube_preferred_languages || []).join(', '));
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
        setSavedAt(null);
    };

    const handleYtLangsChange = (value: string) => {
        setYtLangsInput(value);
        const arr = value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        set('youtube_preferred_languages', arr.length > 0 ? arr : null);
    };

    const dirty =
        settings && original
            ? JSON.stringify(settings) !== JSON.stringify(original)
            : false;

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        setError(null);
        const patch: NotebookSettings = {
            default_content_processing_engine_doc:
                settings.default_content_processing_engine_doc || undefined,
            default_content_processing_engine_url:
                settings.default_content_processing_engine_url || undefined,
            default_embedding_option: settings.default_embedding_option || undefined,
            auto_delete_files: settings.auto_delete_files || undefined,
            youtube_preferred_languages: settings.youtube_preferred_languages ?? undefined,
        };
        const result = await updateSettingsApi(patch);
        setSaving(false);
        if (!result) {
            setError('Failed to save settings.');
            return;
        }
        setSettings(result);
        setOriginal(result);
        setYtLangsInput((result.youtube_preferred_languages || []).join(', '));
        setSavedAt(Date.now());
    };

    return (
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 text-neutral-800 dark:text-neutral-100">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                    <IconSettings size={20} className="text-purple-600 dark:text-purple-400" />
                    <div>
                        <h2 className="text-base font-semibold">Notebook preferences</h2>
                        <p className="text-[12px] text-gray-500 dark:text-gray-400">
                            Defaults for content processing, embeddings, and file management.
                        </p>
                    </div>
                </div>
                <button
                    onClick={load}
                    title="Refresh"
                    className="flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-sm text-gray-700 shadow-sm hover:bg-gray-50 dark:border-neutral-700 dark:bg-[#2b2c36] dark:text-gray-200 dark:hover:bg-neutral-700"
                >
                    <IconRefresh size={14} />
                    Refresh
                </button>
            </div>

            {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                    <IconAlertCircle size={16} className="mt-0.5 flex-none" />
                    <span>{error}</span>
                </div>
            )}

            {loading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <IconLoader2 size={16} className="animate-spin" />
                    Loading settings…
                </div>
            ) : settings ? (
                <>
                    <SectionCard
                        title="Content processing"
                        description="Choose how documents and URLs are converted to text before indexing."
                    >
                        <SelectField<DocEngine>
                            label="Document processing engine"
                            value={(settings.default_content_processing_engine_doc as DocEngine) || ''}
                            onChange={(v) => set('default_content_processing_engine_doc', v)}
                            options={[
                                { value: 'auto', label: 'Auto (recommended)' },
                                { value: 'docling', label: 'Docling' },
                                { value: 'simple', label: 'Simple' },
                            ]}
                            placeholder="Select an engine"
                            helpId="doc"
                            helpText="Docling handles complex PDFs (tables, multi-column) better but is slower. Simple is fast but extracts plain text only. Auto picks based on content type."
                            expandedHelp={expandedHelp}
                            onToggleHelp={toggleHelp}
                        />

                        <SelectField<UrlEngine>
                            label="URL processing engine"
                            value={(settings.default_content_processing_engine_url as UrlEngine) || ''}
                            onChange={(v) => set('default_content_processing_engine_url', v)}
                            options={[
                                { value: 'auto', label: 'Auto (recommended)' },
                                { value: 'firecrawl', label: 'Firecrawl' },
                                { value: 'jina', label: 'Jina' },
                                { value: 'simple', label: 'Simple' },
                            ]}
                            placeholder="Select an engine"
                            helpId="url"
                            helpText="Firecrawl and Jina are higher-fidelity (handle JS-rendered pages, paywalls, anti-scraping). Simple fetches raw HTML. Auto picks based on the URL."
                            expandedHelp={expandedHelp}
                            onToggleHelp={toggleHelp}
                        />
                    </SectionCard>

                    <SectionCard
                        title="Embeddings and search"
                        description="Control when new sources are vectorized for semantic search."
                    >
                        <SelectField<EmbeddingOption>
                            label="When to embed new sources"
                            value={(settings.default_embedding_option as EmbeddingOption) || ''}
                            onChange={(v) => set('default_embedding_option', v)}
                            options={[
                                { value: 'ask', label: 'Ask each time' },
                                { value: 'always', label: 'Always embed' },
                                { value: 'never', label: 'Never embed' },
                            ]}
                            placeholder="Select an option"
                            helpId="embedding"
                            helpText="Embedding makes a source searchable via vector / semantic search. It costs an embedding-model call. Pick Always if you want every source searchable; Never if you only need keyword search."
                            expandedHelp={expandedHelp}
                            onToggleHelp={toggleHelp}
                        />
                    </SectionCard>

                    <SectionCard
                        title="YouTube"
                        description="Preferred transcript languages when ingesting YouTube URLs."
                    >
                        <div className="space-y-2">
                            <label className="block text-sm font-medium">
                                Preferred transcript languages
                            </label>
                            <input
                                type="text"
                                value={ytLangsInput}
                                onChange={(e) => handleYtLangsChange(e.target.value)}
                                placeholder="en, es, fr"
                                className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100"
                            />
                            <p className="text-[12px] text-gray-500 dark:text-gray-400">
                                Comma-separated ISO codes. The first available language wins. Leave
                                blank to let YouTube pick.
                            </p>
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="File management"
                        description="Decide what happens to uploaded files after processing."
                    >
                        <SelectField<AutoDeleteFiles>
                            label="Auto-delete uploaded files after processing"
                            value={(settings.auto_delete_files as AutoDeleteFiles) || ''}
                            onChange={(v) => set('auto_delete_files', v)}
                            options={[
                                { value: 'yes', label: 'Yes' },
                                { value: 'no', label: 'No' },
                            ]}
                            placeholder="Select an option"
                            helpId="files"
                            helpText="Once a file is processed and its text is stored, the original upload is no longer needed for search or chat. Auto-deleting reclaims disk space; keeping the file lets you re-process it later without re-uploading."
                            expandedHelp={expandedHelp}
                            onToggleHelp={toggleHelp}
                        />
                    </SectionCard>

                    <div className="flex items-center justify-end gap-2">
                        {savedAt && !dirty && !error && (
                            <span className="text-[12px] text-emerald-600 dark:text-emerald-400">
                                Settings saved.
                            </span>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={saving || !dirty}
                            className={`flex h-9 items-center gap-1.5 rounded-md px-4 text-sm font-medium transition-colors ${
                                saving || !dirty
                                    ? 'cursor-not-allowed bg-gray-200 text-gray-500 dark:bg-neutral-700 dark:text-neutral-400'
                                    : 'bg-purple-500 text-white hover:bg-purple-600'
                            }`}
                        >
                            {saving ? (
                                <>
                                    <IconLoader2 size={16} className="animate-spin" />
                                    Saving…
                                </>
                            ) : (
                                'Save changes'
                            )}
                        </button>
                    </div>
                </>
            ) : null}
        </div>
    );
};

export default SettingsPage;
