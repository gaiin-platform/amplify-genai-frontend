import { useEffect, useState } from 'react';
import { CreationModalShell } from '@/components/NewUI/shared/CreationModalShell';
import {
    createNote,
    getNote,
    updateNote,
    Note,
} from '@/services/notebookService';
import { InlineEditText } from './InlineEditText';
import { MarkdownEditor } from './MarkdownEditor';

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
        <CreationModalShell
            title={isEdit ? 'Edit Note' : 'New Note'}
            onClose={onClose}
            onSave={handleSubmit}
            saveLabel={isEdit ? 'Save' : 'Create'}
            isSaving={submitting}
            saveDisabled={!canSubmit}
        >
                <div className="flex flex-col gap-4 p-2 text-[--text-primary]">
                    <InlineEditText
                        value={title}
                        placeholder="Untitled Note"
                        className="text-[16px] font-semibold"
                        onSave={setTitle}
                    />

                    <div className="flex flex-col gap-1 flex-1">
                        <label htmlFor="note-content" className="text-sm font-medium">
                            Content <span className="text-[--text-error]">*</span>
                        </label>
                        {loadingFull ? (
                            <div className="flex h-[380px] items-center justify-center rounded border border-[--border-subtle] text-sm text-[--text-muted]">
                                Loading…
                            </div>
                        ) : (
                            <MarkdownEditor
                                textareaId="note-content"
                                value={content}
                                onChange={setContent}
                                placeholder="Write your note…"
                                height={380}
                            />
                        )}
                    </div>

                    {error && (
                        <div className="text-sm text-[--text-error]">{error}</div>
                    )}
                </div>
        </CreationModalShell>
    );
};

export default NoteEditorDialog;
