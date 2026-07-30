import { useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconSparkles } from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import { NotebookModel, getDefaults, listModels } from '@/services/notebookService';
import { filterSelectableChatModels, formatModelName, prepareModelOptions } from './modelDisplay';
import { useCanSelectNotebookModel } from './modelAccess';

interface Props {
    // Selected model record ID; '' means "use the deployment default".
    value: string;
    onChange: (modelId: string) => void;
    disabled?: boolean;
    // Reports the record of the model that will actually answer (the
    // override, or the deployment default when value is ''). Null until
    // models load or when the id can't be resolved. Lets the parent derive
    // model-dependent info (e.g. context window) without re-fetching models.
    onResolvedModel?: (model: NotebookModel | null) => void;
}

// Mirrors lucide-react's Settings2 icon (2 line paths + 2 circles) used by the
// reference open-notebook ModelSelector trigger. Tabler has no equivalent
// glyph (its IconSettings2 is an unrelated gear/hexagon), so this is a custom
// inline SVG reproducing the exact path/circle data.
const IconModelSliders = ({ size = 14 }: { size?: number }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M14 17H5" />
        <path d="M19 7h-9" />
        <circle cx="17" cy="17" r="3" />
        <circle cx="7" cy="7" r="3" />
    </svg>
);

// Compact model picker for chat/ask. Mirrors upstream's chat ModelSelector:
// every registered language model, sorted by name, with a
// "Default" entry that resolves to the configured default chat model. Clicking
// the trigger opens a dialog (matching upstream's Settings2 button + Dialog)
// instead of a native <select>, so the description text has room to show.
export const ChatModelSelect = ({ value, onChange, disabled, onResolvedModel }: Props) => {
    const {
        state: { lightMode },
    } = useContext(HomeContext);
    const canSelectModel = useCanSelectNotebookModel();

    const [models, setModels] = useState<NotebookModel[]>([]);
    const [defaultId, setDefaultId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState(value);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [all, defaults] = await Promise.all([listModels('language'), getDefaults()]);
            if (cancelled) return;
            setModels(prepareModelOptions(all));
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

    useEffect(() => {
        if (!onResolvedModel) return;
        const effectiveId = value || defaultId;
        onResolvedModel(models.find((mm) => mm.id === effectiveId) ?? null);
        // onResolvedModel is intentionally omitted: parents pass inline
        // functions, and re-firing on every parent render would loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, defaultId, models]);

    const currentModelName = useMemo(() => {
        if (value && value !== defaultId) {
            const m = models.find((mm) => mm.id === value);
            return m ? formatModelName(m.name) : value;
        }
        return defaultName ? `Default (${defaultName})` : 'Default';
    }, [value, models, defaultName, defaultId]);

    // The model that will actually answer, named plainly — no "Default (…)"
    // wrapper. Used for the read-only label, where the point is to tell the user
    // which model is running, not how it was chosen.
    const resolvedModelName = useMemo(() => {
        const m = models.find((mm) => mm.id === (value || defaultId));
        return m ? formatModelName(m.name) : null;
    }, [value, models, defaultId]);

    // The default model is only offered via the "Default (X)" entry, never as a
    // second explicit row — so it can't appear twice in the dropdown.
    const selectableModels = useMemo(
        () => filterSelectableChatModels(models, canSelectModel).filter((m) => m.id !== defaultId),
        [models, defaultId, canSelectModel],
    );

    // Without the feature flag there is nothing to switch to, and even with it a
    // deployment may register only the one allowed model — either way a dropdown
    // would be dead UI. Show the resolved model as a read-only label instead. The
    // models still load, so onResolvedModel (and the parent's context-window
    // indicator) keeps working.
    const noAlternatives = !canSelectModel || (!loading && selectableModels.length === 0);

    const openDialog = () => {
        // An explicit selection equal to the default collapses back to "Default"
        // (its row is hidden from the list above).
        setPending(value === defaultId ? '' : value);
        setOpen(true);
    };

    const handleSave = () => {
        onChange(pending);
        setOpen(false);
    };

    const handleReset = () => {
        setPending('');
        onChange('');
        setOpen(false);
    };

    // Read-only display when there's nothing to switch to: no trigger, no dialog,
    // just the name of the model that will answer.
    if (noAlternatives) {
        return (
            <span
                title="Model used to answer"
                className="flex h-[26px] items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-600 dark:border-neutral-600 dark:bg-[#2b2c36] dark:text-gray-300"
            >
                <IconModelSliders size={14} />
                <span className="max-w-[160px] truncate">
                    {loading ? 'Loading model…' : resolvedModelName || currentModelName}
                </span>
            </span>
        );
    }

    return (
        <>
            <button
                type="button"
                onClick={openDialog}
                disabled={disabled || loading}
                title="Model used to answer"
                className="flex h-[26px] items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-600 dark:bg-[#2b2c36] dark:text-gray-300 dark:hover:bg-neutral-700"
            >
                <IconModelSliders size={14} />
                <span className="max-w-[160px] truncate">
                    {loading ? 'Loading models…' : currentModelName}
                </span>
            </button>

            {open &&
                createPortal(
                    <div className={`${lightMode} fixed inset-0 z-[9999] flex items-center justify-center`}>
                        <div
                            className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
                            onClick={() => setOpen(false)}
                        />
                        <div className="relative w-[420px] max-w-[92vw] rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800">
                            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                                <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                                    <IconSparkles size={18} />
                                    Model Configuration
                                </h3>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    Override the default model for this chat session. Leave empty to use
                                    the system default.
                                </p>
                            </div>
                            <div className="space-y-3 px-6 py-4">
                                <div className="space-y-1.5">
                                    <label
                                        htmlFor="chat-model-select"
                                        className="text-sm font-medium text-gray-700 dark:text-gray-200"
                                    >
                                        Model
                                    </label>
                                    <select
                                        id="chat-model-select"
                                        value={pending}
                                        onChange={(e) => setPending(e.target.value)}
                                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 dark:border-neutral-600 dark:bg-[#40414f] dark:text-gray-100"
                                    >
                                        <option value="">
                                            {defaultName ? `Default (${defaultName})` : 'System default'}
                                        </option>
                                        {loading ? (
                                            <option disabled>Loading models…</option>
                                        ) : (
                                            selectableModels.map((m) => (
                                                <option key={m.id} value={m.id}>
                                                    {formatModelName(m.name)}
                                                </option>
                                            ))
                                        )}
                                    </select>
                                </div>
                                {pending && (
                                    <div className="rounded-lg bg-gray-100 p-3 dark:bg-neutral-700/40">
                                        <p className="text-sm text-gray-600 dark:text-gray-300">
                                            This session will use{' '}
                                            <b>
                                                {models.find((m) => m.id === pending)?.name
                                                    ? formatModelName(
                                                          models.find((m) => m.id === pending)!.name,
                                                      )
                                                    : pending}
                                            </b>{' '}
                                            instead of the default.
                                        </p>
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-between border-t border-gray-200 px-6 py-4 dark:border-gray-700">
                                <button
                                    onClick={handleReset}
                                    className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                                >
                                    Reset to Default
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body,
                )}
        </>
    );
};

export default ChatModelSelect;
