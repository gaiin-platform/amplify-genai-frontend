import { useState } from 'react';
import { CreationModalShell } from '@/components/NewUI/shared/CreationModalShell';
import { createNotebook, NotebookSummary } from '@/services/notebookService';

interface Props {
    onClose: () => void;
    onCreated: (notebook: NotebookSummary) => void;
}

const fieldClass =
    'rounded-md border border-[--border-subtle] bg-[--bg-composer] text-sm text-[--text-primary] shadow-sm placeholder-[--text-muted] outline-none focus:border-[--accent] focus:ring-1 focus:ring-[--accent]';
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
        <CreationModalShell
            title="Create New Notebook"
            onClose={onClose}
            onSave={handleSubmit}
            saveLabel="Create New Notebook"
            isSaving={submitting}
            saveDisabled={trimmedName.length === 0}
        >
                <div className="flex flex-col gap-4 p-2 text-[--text-primary]">
                    <p className="text-sm text-[--text-muted]">
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
                            onKeyDown={(e) => {
                                // Mirrors SessionManagerModal's equivalent
                                // create-session input: Enter submits.
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSubmit();
                                }
                            }}
                            placeholder="Notebook name"
                            className={`w-full ${inputClass}`}
                        />
                        {showNameError && (
                            <p className="text-sm text-[--text-error]">
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
                        <div className="text-sm text-[--text-error]">{error}</div>
                    )}
                </div>
        </CreationModalShell>
    );
};

export default CreateNotebookDialog;
