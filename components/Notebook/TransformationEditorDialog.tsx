import { useEffect, useState } from 'react';
import { LucideAlertCircle, LucideLoader2 } from './LucideIcons';
import { CreationModalShell } from '@/components/NewUI/shared/CreationModalShell';
import { MarkdownEditor } from './MarkdownEditor';
import {
    Transformation,
    createTransformation,
    getTransformation,
    updateTransformation,
} from '@/services/notebookService';

interface Props {
    transformation?: Transformation | null;
    onClose: () => void;
    onSaved: (t: Transformation) => void;
}

const inputClass =
    'w-full rounded-md border border-[--border-subtle] bg-[--bg-composer] px-3 py-2 text-sm text-[--text-primary] shadow-sm placeholder-[--text-muted] outline-none focus:border-[--accent] focus:ring-1 focus:ring-[--accent]';

// Mirrors the reference TransformationEditorDialog: name row, title +
// suggest-by-default row, description, then a markdown editor for the prompt.
export const TransformationEditorDialog = ({ transformation, onClose, onSaved }: Props) => {
    const isEdit = !!transformation;
    const [name, setName] = useState<string>(transformation?.name ?? '');
    const [title, setTitle] = useState<string>(transformation?.title ?? '');
    const [description, setDescription] = useState<string>(transformation?.description ?? '');
    const [prompt, setPrompt] = useState<string>(transformation?.prompt ?? '');
    const [applyDefault, setApplyDefault] = useState<boolean>(
        transformation?.apply_default ?? false,
    );
    const [loadingFull, setLoadingFull] = useState<boolean>(isEdit);
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isEdit || !transformation) return;
        let cancelled = false;
        (async () => {
            const full = await getTransformation(transformation.id);
            if (cancelled) return;
            if (full) {
                setName(full.name ?? '');
                setTitle(full.title ?? '');
                setDescription(full.description ?? '');
                setPrompt(full.prompt ?? '');
                setApplyDefault(!!full.apply_default);
            }
            setLoadingFull(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [isEdit, transformation]);

    const trimmedName = name.trim();
    const trimmedPrompt = prompt.trim();
    const canSubmit =
        !submitting && !loadingFull && trimmedName.length > 0 && trimmedPrompt.length > 0;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        setError(null);

        const payload = {
            name: trimmedName,
            title: title.trim() || trimmedName,
            description: description.trim(),
            prompt: trimmedPrompt,
            apply_default: applyDefault,
        };

        const result = isEdit
            ? await updateTransformation(transformation!.id, payload)
            : await createTransformation(payload);

        setSubmitting(false);
        if (!result) {
            setError(isEdit ? 'Failed to save transformation.' : 'Failed to create transformation.');
            return;
        }
        onSaved(result);
        onClose();
    };

    return (
        <CreationModalShell
            title={isEdit ? 'Edit Transformation' : 'Create New'}
            onClose={onClose}
            onSave={handleSubmit}
            saveLabel={isEdit ? 'Save Changes' : 'Create New'}
            isSaving={submitting}
            saveDisabled={!canSubmit}
        >
                <div className="flex flex-col gap-4 p-2 text-[--text-primary]">
                    {loadingFull ? (
                        <div className="flex items-center justify-center py-10 text-sm text-[--text-muted]">
                            Loading...
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium">Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Unique identifier, e.g. key_topics"
                                    autoComplete="off"
                                    className={inputClass}
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-medium">Title</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Displayed title, defaults to name"
                                        autoComplete="off"
                                        className={inputClass}
                                    />
                                </div>
                                <div className="flex items-center gap-2 md:pt-8">
                                    <input
                                        id="apply-default"
                                        type="checkbox"
                                        checked={applyDefault}
                                        onChange={(e) => setApplyDefault(e.target.checked)}
                                        className="h-4 w-4 accent-[--accent]"
                                    />
                                    <label htmlFor="apply-default" className="text-sm">
                                        Suggest by default on new sources
                                    </label>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium">Add description</label>
                                <textarea
                                    rows={2}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Describe what this transformation does."
                                    autoComplete="off"
                                    className={`resize-none ${inputClass}`}
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium">System Prompt</label>
                                <MarkdownEditor
                                    value={prompt}
                                    onChange={setPrompt}
                                    height={340}
                                    placeholder="Write the prompt that will power this transformation..."
                                />
                                <p className="mt-2 text-xs text-[--text-muted]">
                                    Prompts should be written with the source content in mind.
                                    You can ask the model to summarize, extract insights, or
                                    produce structured outputs such as tables.
                                </p>
                            </div>

                            {error && (
                                <div className="flex items-start gap-2 rounded-lg border border-[--border-subtle] bg-[--bg-raised] p-2 text-sm text-[--text-error]">
                                    <LucideAlertCircle size={16} className="mt-0.5 flex-none" />
                                    <span>{error}</span>
                                </div>
                            )}
                            {submitting && (
                                <div className="flex items-center gap-2 text-xs text-[--text-muted]">
                                    <LucideLoader2 size={14} className="animate-spin" />
                                    Saving…
                                </div>
                            )}
                        </>
                    )}
                </div>
        </CreationModalShell>
    );
};

export default TransformationEditorDialog;
