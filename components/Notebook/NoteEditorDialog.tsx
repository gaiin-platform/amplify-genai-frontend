import { useEffect, useState } from 'react';
import { Modal } from '@/components/ReusableComponents/Modal';
import {
    createNote,
    getNote,
    updateNote,
    Note,
} from '@/services/notebookNotesService';

interface Props {
    notebookId: string;
    note?: Note | null;
    onClose: () => void;
    onSaved: (note: Note) => void;
}

export const NoteEditorDialog = ({ notebookId, note, onClose, onSaved }: Props) => {
    const isEdit = !!note;
    const [title, setTitle] = useState(note?.title ?? '');
    const [content, setContent] = useState(note?.content ?? '');
    const [submitting, setSubmitting] = useState(false);
    const [loadingFull, setLoadingFull] = useState<boolean>(isEdit);
    const [error, setError] = useState<string | null>(null);

    // The list endpoint strips note.content, so on edit we need to refetch the full note.
    useEffect(() => {
        if (!isEdit || !note) return;
        let cancelled = false;
        (async () => {
            const full = await getNote(note.id);
            if (cancelled) return;
            if (full) {
                setTitle(full.title ?? '');
                setContent(full.content ?? '');
            }
            setLoadingFull(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [isEdit, note]);

    const trimmedContent = content.trim();
    const trimmedTitle = title.trim();
    const canSubmit = trimmedContent.length > 0 && !submitting && !loadingFull;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        setError(null);

        const result = isEdit
            ? await updateNote(note!.id, {
                title: trimmedTitle || undefined,
                content: trimmedContent,
            })
            : await createNote({
                notebookId,
                title: trimmedTitle || undefined,
                content: trimmedContent,
            });

        setSubmitting(false);
        if (!result) {
            setError(isEdit ? 'Failed to save note.' : 'Failed to create note.');
            return;
        }
        onSaved(result);
        onClose();
    };

    return (
        <Modal
            title={isEdit ? 'Edit Note' : 'New Note'}
            onCancel={onClose}
            onSubmit={handleSubmit}
            submitLabel={submitting ? 'Saving…' : isEdit ? 'Save' : 'Create'}
            disableSubmit={!canSubmit}
            width={() => 560}
            height={() => 480}
            content={
                <div className="flex flex-col gap-4 p-2 text-neutral-800 dark:text-neutral-100">
                    <div className="flex flex-col gap-1">
                        <label htmlFor="note-title" className="text-sm font-medium">
                            Title (optional)
                        </label>
                        <input
                            id="note-title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Untitled"
                            className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100"
                        />
                    </div>

                    <div className="flex flex-col gap-1 flex-1">
                        <label htmlFor="note-content" className="text-sm font-medium">
                            Content <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            id="note-content"
                            autoFocus
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder={loadingFull ? 'Loading…' : 'Write your note…'}
                            rows={12}
                            disabled={loadingFull}
                            className="resize-none rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100 disabled:opacity-60"
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

export default NoteEditorDialog;
