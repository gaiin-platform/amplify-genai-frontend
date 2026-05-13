import { useState } from 'react';
import { Modal } from '@/components/ReusableComponents/Modal';
import { createNotebook, NotebookSummary } from '@/services/notebookContentService';

interface Props {
    onClose: () => void;
    onCreated: (notebook: NotebookSummary) => void;
}

export const CreateNotebookDialog = ({ onClose, onCreated }: Props) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const trimmedName = name.trim();
    const canSubmit = trimmedName.length > 0 && !submitting;

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
            title="New Notebook"
            onCancel={onClose}
            onSubmit={handleSubmit}
            submitLabel={submitting ? 'Creating…' : 'Create'}
            disableSubmit={!canSubmit}
            width={() => 480}
            height={() => 360}
            content={
                <div className="flex flex-col gap-4 p-2 text-neutral-800 dark:text-neutral-100">
                    <div className="flex flex-col gap-1">
                        <label htmlFor="notebook-name" className="text-sm font-medium">
                            Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="notebook-name"
                            type="text"
                            autoFocus
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="My research notebook"
                            className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label htmlFor="notebook-description" className="text-sm font-medium">
                            Description
                        </label>
                        <textarea
                            id="notebook-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What's this notebook about?"
                            rows={4}
                            className="resize-none rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100"
                        />
                    </div>

                    {error && (
                        <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
                    )}
                </div>
            }
        />
    );
};

export default CreateNotebookDialog;
