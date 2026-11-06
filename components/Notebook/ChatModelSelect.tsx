import { useEffect, useMemo, useState } from 'react';
import { IconSparkles } from '@tabler/icons-react';
import { NotebookModel, getDefaults, listModels } from '@/services/notebookService';
import { filterSelectableChatModels, formatModelName, prepareModelOptions } from './modelDisplay';
import { useCanSelectNotebookModel } from './modelAccess';
import { CreationModalShell } from '@/components/NewUI/shared/CreationModalShell';

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
    // Reports whether there's actually anything to switch to (false once
    // models have loaded and there is 0 or 1 selectable model, or the
    // feature flag is off). Lets the parent hide its own "Model" label too —
    // showing a model's name next to a control that can't change it is just
    // unnecessary branding noise, not useful information, when there's no
    // real choice being made.
    onHasAlternatives?: (hasAlternatives: boolean) => void;
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
export const ChatModelSelect = ({
    value,
    onChange,
    disabled,
    onResolvedModel,
    onHasAlternatives,
}: Props) => {
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
    // would be dead UI, and naming the model next to it is just unrequested
    // branding, not a choice the user is making. The models still load, so
    // onResolvedModel (and the parent's context-window indicator) keeps
    // working even though nothing is rendered here.
    const noAlternatives = !canSelectModel || (!loading && selectableModels.length === 0);

    useEffect(() => {
        if (!onHasAlternatives || loading) return;
        onHasAlternatives(!noAlternatives);
        // onHasAlternatives is intentionally omitted, matching onResolvedModel
        // above — parents pass inline functions.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [noAlternatives, loading]);

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

    // Nothing to switch to and we already know it (not mid-load): render
    // nothing at all, and let the parent hide its own "Model" label too via
    // onHasAlternatives — naming the model when there's no real choice is
    // just unrequested branding, not information the user asked for.
    if (noAlternatives && !loading) {
        return null;
    }

    // Read-only display while models are still loading (brief, and useful —
    // tells the user something is happening — unlike the resolved
    // no-alternatives case above, which has nothing left to say).
    if (noAlternatives) {
        return (
            <span
                title="Model used to answer"
                className="flex h-[26px] items-center gap-1.5 rounded-md border border-[--border-subtle] bg-[--bg-raised] px-2 text-xs text-[--text-secondary]"
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
                className="flex h-[26px] items-center gap-1.5 rounded-md border border-[--border-subtle] bg-[--bg-raised] px-2 text-xs text-[--text-secondary] transition-colors hover:bg-[--bg-hover] disabled:cursor-not-allowed disabled:opacity-60"
            >
                <IconModelSliders size={14} />
                <span className="max-w-[160px] truncate">
                    {loading ? 'Loading models…' : currentModelName}
                </span>
            </button>

            {open && (
                <CreationModalShell
                    title="Model Configuration"
                    onClose={() => setOpen(false)}
                    onSave={handleSave}
                    saveLabel="Save Changes"
                >
                    <p className="mb-4 flex items-center gap-2 text-sm text-[--text-muted]">
                        <IconSparkles size={16} className="flex-none text-[--accent]" />
                        Override the default model for this chat session. Leave empty to use the
                        system default.
                    </p>
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label
                                    htmlFor="chat-model-select"
                                    className="text-sm font-medium text-[--text-secondary]"
                                >
                                    Model
                                </label>
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    className="text-xs font-medium text-[--text-muted] hover:text-[--text-primary]"
                                >
                                    Reset to Default
                                </button>
                            </div>
                            <select
                                id="chat-model-select"
                                value={pending}
                                onChange={(e) => setPending(e.target.value)}
                                className="w-full rounded-md border border-[--border-subtle] bg-[--bg-composer] px-3 py-2 text-sm text-[--text-primary] outline-none focus:border-[--accent] focus:ring-1 focus:ring-[--accent]"
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
                            <div className="rounded-lg bg-[--bg-active] p-3">
                                <p className="text-sm text-[--text-secondary]">
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
                </CreationModalShell>
            )}
        </>
    );
};

export default ChatModelSelect;
