import { useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/ReusableComponents/Modal';
import {
    NotebookSummary,
    createSourceFromFile,
    createSourceFromText,
    createSourceFromUrl,
    listNotebooks,
    SourceListItem,
} from '@/services/notebookService';

type SourceType = 'url' | 'text' | 'file';

interface Props {
    // When omitted (e.g. opened from the global Create menu), the dialog shows
    // a notebook picker so the user chooses where the source lands.
    notebookId?: string;
    onClose: () => void;
    onCreated: (source: SourceListItem) => void;
}

export const AddSourceDialog = ({ notebookId, onClose, onCreated }: Props) => {
    const [tab, setTab] = useState<SourceType>('url');
    const [url, setUrl] = useState('');
    const [content, setContent] = useState('');
    const [title, setTitle] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [notebooks, setNotebooks] = useState<NotebookSummary[]>([]);
    const [notebooksLoading, setNotebooksLoading] = useState(false);
    const [selectedNotebookId, setSelectedNotebookId] = useState('');

    useEffect(() => {
        if (notebookId) return;
        let cancelled = false;
        setNotebooksLoading(true);
        (async () => {
            const nbs = await listNotebooks({ order_by: 'updated desc' });
            if (cancelled) return;
            setNotebooks(nbs);
            if (nbs.length > 0) setSelectedNotebookId(nbs[0].id);
            setNotebooksLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [notebookId]);

    const targetNotebookId = notebookId ?? selectedNotebookId;

    const trimmedUrl = url.trim();
    const trimmedContent = content.trim();
    const trimmedTitle = title.trim();

    const canSubmit = !submitting && !!targetNotebookId && (
        (tab === 'url' && trimmedUrl.length > 0) ||
        (tab === 'text' && trimmedContent.length > 0) ||
        (tab === 'file' && file !== null)
    );

    // Backend's auto-title fallback doesn't fire for plain text sources, so
    // the source ends up permanently stuck with title="Processing...". Pre-fill
    // the title from the first line of content here to avoid that.
    const deriveTextTitle = (text: string): string => {
        const firstLine = text.split('\n')[0].trim();
        if (!firstLine) return 'Untitled';
        return firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine;
    };

    // For file sources, fall back to the file's display name (minus extension).
    const deriveFileTitle = (f: File): string => {
        const name = f.name.replace(/\.[^.]+$/, '');
        return name.length > 80 ? `${name.slice(0, 77)}…` : name || 'Untitled';
    };

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        setError(null);

        let result: SourceListItem | null = null;
        if (tab === 'url') {
            result = await createSourceFromUrl({
                notebookId: targetNotebookId,
                url: trimmedUrl,
                title: trimmedTitle || undefined,
            });
        } else if (tab === 'text') {
            result = await createSourceFromText({
                notebookId: targetNotebookId,
                content: trimmedContent,
                title: trimmedTitle || deriveTextTitle(trimmedContent),
            });
        } else if (tab === 'file' && file) {
            result = await createSourceFromFile({
                notebookId: targetNotebookId,
                file,
                title: trimmedTitle || deriveFileTitle(file),
            });
        }

        setSubmitting(false);
        if (!result) {
            setError('Failed to add source.');
            return;
        }
        onCreated(result);
        onClose();
    };

    const tabClass = (active: boolean) =>
        `flex-1 px-3 py-2 text-sm border-b-2 ${
            active
                ? 'border-purple-500 text-purple-500 dark:text-purple-400'
                : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
        }`;

    return (
        <Modal
            title="Add Source"
            onCancel={onClose}
            onSubmit={handleSubmit}
            submitLabel={submitting ? 'Adding…' : 'Add'}
            disableSubmit={!canSubmit}
            width={() => 520}
            height={() => (notebookId ? 460 : 530)}
            content={
                <div className="flex flex-col gap-3 p-2 text-neutral-800 dark:text-neutral-100">
                    {!notebookId && (
                        <div className="flex flex-col gap-1">
                            <label htmlFor="source-notebook" className="text-sm font-medium">
                                Notebook <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="source-notebook"
                                value={selectedNotebookId}
                                onChange={(e) => setSelectedNotebookId(e.target.value)}
                                disabled={notebooksLoading || notebooks.length === 0}
                                className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100"
                            >
                                {notebooksLoading && <option value="">Loading notebooks…</option>}
                                {!notebooksLoading && notebooks.length === 0 && (
                                    <option value="">No notebooks — create one first</option>
                                )}
                                {notebooks.map((nb) => (
                                    <option key={nb.id} value={nb.id}>
                                        {nb.name || '(untitled)'}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="flex border-b border-neutral-200 dark:border-neutral-700">
                        <button type="button" className={tabClass(tab === 'url')} onClick={() => setTab('url')}>
                            URL
                        </button>
                        <button type="button" className={tabClass(tab === 'text')} onClick={() => setTab('text')}>
                            Text
                        </button>
                        <button type="button" className={tabClass(tab === 'file')} onClick={() => setTab('file')}>
                            File
                        </button>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label htmlFor="source-title" className="text-sm font-medium">
                            Title (optional)
                        </label>
                        <input
                            id="source-title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Auto-detected if blank"
                            className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100"
                        />
                    </div>

                    {tab === 'url' && (
                        <div className="flex flex-col gap-1">
                            <label htmlFor="source-url" className="text-sm font-medium">
                                URL <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="source-url"
                                type="url"
                                autoFocus
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://example.com/article"
                                className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100"
                            />
                        </div>
                    )}

                    {tab === 'text' && (
                        <div className="flex flex-col gap-1">
                            <label htmlFor="source-text" className="text-sm font-medium">
                                Content <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                id="source-text"
                                autoFocus
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="Paste the text you want to ingest…"
                                rows={8}
                                className="resize-none rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100"
                            />
                        </div>
                    )}

                    {tab === 'file' && (
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium">
                                File <span className="text-red-500">*</span>
                            </label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex flex-col items-center justify-center gap-1 rounded border-2 border-dashed border-neutral-300 bg-neutral-50 px-3 py-6 text-sm text-neutral-600 hover:border-purple-400 hover:bg-purple-50 dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-300 dark:hover:border-purple-400 dark:hover:bg-purple-900/20"
                            >
                                {file ? (
                                    <>
                                        <span className="font-medium text-neutral-800 dark:text-neutral-100">{file.name}</span>
                                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                            {(file.size / 1024).toFixed(1)} KB · click to change
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <span>Click to choose a file</span>
                                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                            PDF, DOCX, TXT, MD, audio, etc.
                                        </span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {error && (
                        <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
                    )}
                </div>
            }
        />
    );
};

export default AddSourceDialog;
