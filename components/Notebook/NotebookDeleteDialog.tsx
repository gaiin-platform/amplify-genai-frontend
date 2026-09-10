import { useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import HomeContext from '@/pages/api/home/home.context';
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

// Mirror of the reference NotebookDeleteDialog: fetches a deletion preview
// (note count, shared vs. exclusive sources) and lets the user choose whether
// sources that exist only in this notebook are deleted or unlinked and kept.
export const NotebookDeleteDialog = ({
    notebookId,
    notebookName,
    onClose,
    onDeleted,
}: Props) => {
    const {
        state: { lightMode },
    } = useContext(HomeContext);

    const [mounted, setMounted] = useState(false);
    const [preview, setPreview] = useState<NotebookDeletePreview | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(true);
    const [previewError, setPreviewError] = useState(false);
    const [sourceAction, setSourceAction] = useState<'keep' | 'delete'>('keep');
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

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

    if (!mounted) return null;

    const dialog = (
        <div className={`${lightMode} fixed inset-0 z-[9999] flex items-center justify-center`}>
            <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm" onClick={deleting ? undefined : onClose} />

            <div className="relative max-h-full w-[512px] max-w-[calc(100vw-2rem)] overflow-auto rounded-lg border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-800">
                <div className="flex flex-col gap-2">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Delete Notebook
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Are you sure you want to delete &quot;{notebookName}&quot;? This action
                        cannot be undone.
                    </p>
                </div>

                <div className="space-y-3 py-4">
                    {loadingPreview ? (
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                            <LucideLoader2 size={16} className="animate-spin" />
                            <span>Loading deletion preview...</span>
                        </div>
                    ) : previewError ? (
                        <div className="text-sm text-red-600 dark:text-red-400">
                            Failed to load deletion preview.
                        </div>
                    ) : preview ? (
                        <>
                            <div className="text-sm">
                                {preview.note_count > 0 ? (
                                    <p className="font-medium text-red-600 dark:text-red-400">
                                        {preview.note_count} note(s) will be permanently deleted.
                                    </p>
                                ) : (
                                    <p className="text-gray-500 dark:text-gray-400">
                                        No notes to delete.
                                    </p>
                                )}
                            </div>

                            {preview.shared_source_count > 0 && (
                                <div className="text-sm">
                                    <p className="text-gray-500 dark:text-gray-400">
                                        {preview.shared_source_count} source(s) are shared with
                                        other notebooks and will be unlinked.
                                    </p>
                                </div>
                            )}

                            {preview.exclusive_source_count === 0 &&
                                preview.shared_source_count === 0 && (
                                    <div className="text-sm">
                                        <p className="text-gray-500 dark:text-gray-400">
                                            No sources in this notebook.
                                        </p>
                                    </div>
                                )}

                            {preview.exclusive_source_count > 0 && (
                                <div className="space-y-3 border-t border-gray-200 pt-3 dark:border-gray-700">
                                    <p className="text-sm font-medium text-red-600 dark:text-red-400">
                                        {preview.exclusive_source_count} source(s) exist only in
                                        this notebook.
                                    </p>
                                    <div className="flex flex-col gap-2">
                                        <label className="flex cursor-pointer items-center gap-3 text-sm">
                                            <input
                                                type="radio"
                                                name="source-action"
                                                value="delete"
                                                checked={sourceAction === 'delete'}
                                                onChange={() => setSourceAction('delete')}
                                                disabled={deleting}
                                                className="h-4 w-4 accent-purple-500"
                                            />
                                            Delete exclusive sources
                                        </label>
                                        <label className="flex cursor-pointer items-center gap-3 text-sm">
                                            <input
                                                type="radio"
                                                name="source-action"
                                                value="keep"
                                                checked={sourceAction === 'keep'}
                                                onChange={() => setSourceAction('keep')}
                                                disabled={deleting}
                                                className="h-4 w-4 accent-purple-500"
                                            />
                                            Unlink and keep them
                                        </label>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : null}

                    {deleteError && (
                        <div className="text-sm text-red-600 dark:text-red-400">{deleteError}</div>
                    )}
                </div>

                <div className="flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        disabled={deleting}
                        className="inline-flex h-9 items-center rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-600 dark:bg-transparent dark:text-gray-200 dark:hover:bg-neutral-700"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={deleting || loadingPreview}
                        className="inline-flex h-9 items-center gap-2 rounded-md bg-red-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 disabled:pointer-events-none disabled:opacity-50"
                    >
                        {deleting ? (
                            <>
                                <LucideLoader2 size={16} className="animate-spin" />
                                Deleting...
                            </>
                        ) : (
                            'Delete'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(dialog, document.body);
};

export default NotebookDeleteDialog;
