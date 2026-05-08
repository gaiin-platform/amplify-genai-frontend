import { useState } from 'react';
import { Modal } from '@/components/ReusableComponents/Modal';
import {
    createSourceFromText,
    createSourceFromUrl,
    SourceListItem,
} from '@/services/notebookSourcesService';

type SourceType = 'url' | 'text';

interface Props {
    notebookId: string;
    onClose: () => void;
    onCreated: (source: SourceListItem) => void;
}

export const AddSourceDialog = ({ notebookId, onClose, onCreated }: Props) => {
    const [tab, setTab] = useState<SourceType>('url');
    const [url, setUrl] = useState('');
    const [content, setContent] = useState('');
    const [title, setTitle] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const trimmedUrl = url.trim();
    const trimmedContent = content.trim();
    const trimmedTitle = title.trim();

    const canSubmit = !submitting && (
        (tab === 'url' && trimmedUrl.length > 0) ||
        (tab === 'text' && trimmedContent.length > 0)
    );

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        setError(null);

        const result = tab === 'url'
            ? await createSourceFromUrl({
                notebookId,
                url: trimmedUrl,
                title: trimmedTitle || undefined,
            })
            : await createSourceFromText({
                notebookId,
                content: trimmedContent,
                title: trimmedTitle || undefined,
            });

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
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
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
            height={() => 460}
            content={
                <div className="flex flex-col gap-3 p-2 text-neutral-800 dark:text-neutral-100">
                    <div className="flex border-b border-neutral-200 dark:border-neutral-700">
                        <button type="button" className={tabClass(tab === 'url')} onClick={() => setTab('url')}>
                            URL
                        </button>
                        <button type="button" className={tabClass(tab === 'text')} onClick={() => setTab('text')}>
                            Text
                        </button>
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

                    {error && (
                        <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
                    )}
                </div>
            }
        />
    );
};

export default AddSourceDialog;
