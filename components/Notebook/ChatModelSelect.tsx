import { useEffect, useMemo, useState } from 'react';
import { NotebookModel, getDefaults, listModels } from '@/services/notebookService';
import { formatModelName } from './modelDisplay';

interface Props {
    // Selected model record ID; '' means "use the deployment default".
    value: string;
    onChange: (modelId: string) => void;
    disabled?: boolean;
}

// Compact model picker for chat/ask. Mirrors upstream's chat ModelSelector:
// language models restricted to the bedrock provider, sorted by name, with a
// "Default" entry that resolves to the configured default chat model.
export const ChatModelSelect = ({ value, onChange, disabled }: Props) => {
    const [models, setModels] = useState<NotebookModel[]>([]);
    const [defaultId, setDefaultId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [all, defaults] = await Promise.all([listModels('language'), getDefaults()]);
            if (cancelled) return;
            setModels(
                all
                    .filter((m) => m.provider === 'bedrock')
                    .sort((a, b) => formatModelName(a.name).localeCompare(formatModelName(b.name))),
            );
            setDefaultId(defaults?.default_chat_model ?? null);
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const defaultName = useMemo(() => {
        const m = models.find((mm) => mm.id === defaultId);
        return m ? formatModelName(m.name) : null;
    }, [models, defaultId]);

    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled || loading}
            title="Model used to answer"
            className="h-[26px] max-w-[180px] cursor-pointer truncate rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-600 outline-none transition-colors hover:bg-gray-50 focus:border-purple-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-600 dark:bg-[#2b2c36] dark:text-gray-300 dark:hover:bg-neutral-700"
        >
            <option value="">
                {loading
                    ? 'Loading models…'
                    : defaultName
                      ? `Default (${defaultName})`
                      : 'Default model'}
            </option>
            {models.map((m) => (
                <option key={m.id} value={m.id}>
                    {formatModelName(m.name)}
                </option>
            ))}
        </select>
    );
};

export default ChatModelSelect;
