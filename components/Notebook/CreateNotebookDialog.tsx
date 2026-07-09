import { useState } from 'react';
import { Modal } from '@/components/ReusableComponents/Modal';
import { createNotebook, NotebookSummary } from '@/services/notebookService';

interface Props {
    onClose: () => void;
    onCreated: (notebook: NotebookSummary) => void;
}

const fieldClass =
    'rounded-md border border-gray-300 bg-white text-sm shadow-sm placeholder-gray-400 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100 dark:placeholder-gray-500';
// Reference (shadcn) sizing: inputs are a fixed h-9; textareas auto-grow with
// their content (field-sizing: content) from a 64px minimum.
const inputClass = `h-9 px-3 py-1 ${fieldClass}`;
const textareaClass = `min-h-[64px] [field-sizing:content] px-3 py-2 ${fieldClass}`;

// Mirrors the reference CreateNotebookDialog: name + optional description,
// Cancel / "Create New Notebook" footer with the primary (purple) action.
export const CreateNotebookDialog = ({ onClose, onCreated }: Props) => {
    const [name, setName] = useState('');
    const [nameTouched, setNameTouched] = useState(false);
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const trimmedName = name.trim();
    const canSubmit = trimmedName.length > 0 && !submitting;
    const showNameError = nameTouched && trimmedName.length === 0;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        setError(null);
        const result = await createNotebook({
            name: trimmedName,
            description: description.trim() || undefined,
        });
        setSubmitting(false);
        if (!result) {
            setError('Failed to create notebook.');
            return;
        }
        onCreated(result);
        onClose();
    };

    return (
        <Modal
            title="Create New Notebook"
            onCancel={onClose}
            showSubmit={false}
            showCancel={false}
            width={() => 480}
            height={() => 470}
            content={
                <div className="flex flex-col gap-4 p-2 text-neutral-800 dark:text-neutral-100">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Enter a name and optional description to get started.
                    </p>

                    <div className="space-y-2">
                        <label
                            htmlFor="notebook-name"
                            className="text-sm font-medium leading-none"
                        >
                            Name *
                        </label>
                        <input
                            id="notebook-name"
                            type="text"
                            autoFocus
                            autoComplete="off"
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                setNameTouched(true);
                            }}
                            placeholder="Notebook name"
                            className={`w-full ${inputClass}`}
                        />
                        {showNameError && (
                            <p className="text-sm text-red-600 dark:text-red-400">
                                Name is required
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label
                            htmlFor="notebook-description"
                            className="text-sm font-medium leading-none"
                        >
                            Description
                        </label>
                        <textarea
                            id="notebook-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Add more info about this notebook here..."
                            rows={4}
                            className={`w-full ${textareaClass}`}
                        />
                    </div>

                    {error && (
                        <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-medium shadow-sm transition-colors hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-600 dark:bg-transparent dark:hover:bg-neutral-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                            className="inline-flex h-9 items-center justify-center rounded-md bg-purple-500 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-purple-600 disabled:pointer-events-none disabled:opacity-50"
                        >
                            {submitting ? 'Creating...' : 'Create New Notebook'}
                        </button>
                    </div>
                </div>
            }
        />
    );
};

export default CreateNotebookDialog;
