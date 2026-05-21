import { useEffect, useState } from 'react';
import { IconAlertCircle, IconLoader2 } from '@tabler/icons-react';
import { Modal } from '@/components/ReusableComponents/Modal';
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
        !submitting &&
        !loadingFull &&
        trimmedName.length > 0 &&
        trimmedPrompt.length > 0;

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
        <Modal
            title={isEdit ? 'Edit Transformation' : 'New Transformation'}
            onCancel={onClose}
            onSubmit={handleSubmit}
            submitLabel={submitting ? 'Saving…' : isEdit ? 'Save' : 'Create'}
            disableSubmit={!canSubmit}
            width={() => 720}
            height={() => 640}
            content={
                <div className="flex flex-col gap-4 p-2 text-neutral-800 dark:text-neutral-100">
                    {loadingFull ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <IconLoader2 size={16} className="animate-spin" />
                            Loading transformation…
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-medium">
                                        Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g. Summarize key points"
                                        className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-medium">Title</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Display title (defaults to name)"
                                        className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    id="apply-default"
                                    type="checkbox"
                                    checked={applyDefault}
                                    onChange={(e) => setApplyDefault(e.target.checked)}
                                    className="text-purple-600"
                                />
                                <label htmlFor="apply-default" className="text-sm">
                                    Suggest as default when adding new sources
                                </label>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium">Description</label>
                                <textarea
                                    rows={2}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Short description shown in the list"
                                    className="resize-none rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100"
                                />
                            </div>

                            <div className="flex flex-1 flex-col gap-1">
                                <label className="text-sm font-medium">
                                    System prompt <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder={
                                        'Instruct the model on what to extract or generate from the source text.'
                                    }
                                    className="min-h-[220px] flex-1 resize-y rounded border border-neutral-300 bg-white px-3 py-2 font-mono text-[12.5px] leading-5 dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100"
                                />
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                    Combined with the default prompt at runtime. The source text is appended automatically.
                                </p>
                            </div>

                            {error && (
                                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                                    <IconAlertCircle size={16} className="mt-0.5 flex-none" />
                                    <span>{error}</span>
                                </div>
                            )}
                        </>
                    )}
                </div>
            }
        />
    );
};

export default TransformationEditorDialog;
