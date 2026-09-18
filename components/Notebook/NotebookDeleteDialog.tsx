import { useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/NewUI/shared/ConfirmDialog';
import { LucideLoader2 } from './LucideIcons';
import {
    NotebookDeletePreview,
    deleteNotebook,
    getNotebookDeletePreview,
} from '@/services/notebookService';

interface Props {
    notebookId: string;
    notebookName: string;
    onClose: () => void;
    // Fired after a successful delete (the dialog closes itself via onClose
    // first). Parent removes the notebook from its list / navigates away.
    onDeleted: () => void;
}

// Wraps the shared ConfirmDialog (focus trap, Escape/backdrop handling,
// role="dialog") with the notebook-specific preview: note count, shared vs.
// exclusive sources, and the keep/delete choice for exclusive sources.
export const NotebookDeleteDialog = ({
    notebookId,
    notebookName,
    onClose,
    onDeleted,
}: Props) => {
    const [preview, setPreview] = useState<NotebookDeletePreview | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(true);
    const [previewError, setPreviewError] = useState(false);
    const [sourceAction, setSourceAction] = useState<'keep' | 'delete'>('keep');
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoadingPreview(true);
        setPreviewError(false);
        getNotebookDeletePreview(notebookId).then((data) => {
            if (cancelled) return;
            if (data) {
                setPreview(data);
            } else {
                setPreviewError(true);
            }
            setLoadingPreview(false);
        });
        return () => {
            cancelled = true;
        };
    }, [notebookId]);

    const handleConfirm = async () => {
        if (deleting) return;
        setDeleting(true);
        setDeleteError(null);
        const ok = await deleteNotebook(notebookId, sourceAction === 'delete');
        setDeleting(false);
        if (!ok) {
            setDeleteError("Couldn't delete this notebook. Please try again.");
            return;
        }
        onClose();
        onDeleted();
    };

    const message = (
        <div className="space-y-3">
            <p>
                Are you sure you want to delete &quot;{notebookName}&quot;? This action cannot be
                undone.
            </p>

            {loadingPreview ? (
                <div className="flex items-center gap-2 text-[--text-muted]">
                    <LucideLoader2 size={16} className="animate-spin" />
                    <span>Loading deletion preview...</span>
                </div>
            ) : previewError ? (
                <div className="text-[--text-error]">Failed to load deletion preview.</div>
            ) : preview ? (
                <>
                    {preview.note_count > 0 ? (
                        <p className="font-medium text-[--text-error]">
                            {preview.note_count} note(s) will be permanently deleted.
                        </p>
                    ) : (
                        <p className="text-[--text-muted]">No notes to delete.</p>
                    )}

                    {preview.shared_source_count > 0 && (
                        <p className="text-[--text-muted]">
                            {preview.shared_source_count} source(s) are shared with other
                            notebooks and will be unlinked.
                        </p>
                    )}

                    {preview.exclusive_source_count === 0 &&
                        preview.shared_source_count === 0 && (
                            <p className="text-[--text-muted]">No sources in this notebook.</p>
                        )}

                    {preview.exclusive_source_count > 0 && (
                        <div className="space-y-2 border-t border-[--border-subtle] pt-3">
                            <p className="font-medium text-[--text-error]">
                                {preview.exclusive_source_count} source(s) exist only in this
                                notebook.
                            </p>
                            <div className="flex flex-col gap-2">
                                <label className="flex cursor-pointer items-center gap-3">
                                    <input
                                        type="radio"
                                        name="source-action"
                                        value="delete"
                                        checked={sourceAction === 'delete'}
                                        onChange={() => setSourceAction('delete')}
                                        disabled={deleting}
                                        className="h-4 w-4 accent-[--accent]"
                                    />
                                    Delete exclusive sources
                                </label>
                                <label className="flex cursor-pointer items-center gap-3">
                                    <input
                                        type="radio"
                                        name="source-action"
                                        value="keep"
                                        checked={sourceAction === 'keep'}
                                        onChange={() => setSourceAction('keep')}
                                        disabled={deleting}
                                        className="h-4 w-4 accent-[--accent]"
                                    />
                                    Unlink and keep them
                                </label>
                            </div>
                        </div>
                    )}
                </>
            ) : null}

            {deleteError && <div className="text-[--text-error]">{deleteError}</div>}
        </div>
    );

    return (
        <ConfirmDialog
            isOpen
            title="Delete Notebook"
            message={message}
            confirmLabel={deleting ? 'Deleting...' : 'Delete'}
            confirmDisabled={deleting || loadingPreview}
            onConfirm={handleConfirm}
            onCancel={deleting ? () => {} : onClose}
            variant="danger"
        />
    );
};

export default NotebookDeleteDialog;
