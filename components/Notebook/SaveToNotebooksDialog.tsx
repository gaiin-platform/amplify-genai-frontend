import { useEffect, useState } from 'react';
import { IconLoader2 } from '@tabler/icons-react';
import { CreationModalShell } from '@/components/NewUI/shared/CreationModalShell';
import {
    NotebookSummary,
    createNote,
    listNotebooks,
} from '@/services/notebookService';

interface Props {
    // Used as the note title so the saved note is self-describing.
    question: string;
    answer: string;
    onClose: () => void;
    onSaved?: () => void;
}

// Saves an Ask answer as an AI note in one or more notebooks.
export const SaveToNotebooksDialog = ({ question, answer, onClose, onSaved }: Props) => {
    const [notebooks, setNotebooks] = useState<NotebookSummary[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const data = await listNotebooks({ archived: false, order_by: 'updated desc' });
            if (cancelled) return;
            setNotebooks(data);
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const toggle = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSubmit = async () => {
        if (selected.size === 0 || saving) return;
        setSaving(true);
        setError(null);
        const failures: string[] = [];
        for (const nb of notebooks) {
            if (!selected.has(nb.id)) continue;
            const note = await createNote({
                notebookId: nb.id,
                title: question,
                content: answer,
                note_type: 'ai',
            });
            if (!note) failures.push(nb.name || '(untitled)');
        }
        setSaving(false);
        if (failures.length > 0) {
            setError(`Couldn't save to: ${failures.join(', ')}.`);
            return;
        }
        onSaved?.();
        onClose();
    };

    return (
        <CreationModalShell
            title="Save to Notebooks"
            onClose={onClose}
            onSave={handleSubmit}
            saveLabel="Save"
            isSaving={saving}
            saveDisabled={selected.size === 0}
        >
                <div className="flex flex-col gap-3 p-2 text-[--text-primary]">
                    <p className="text-sm text-[--text-muted]">
                        The answer will be saved as an AI note in each selected notebook.
                    </p>

                    {loading ? (
                        <div className="flex items-center gap-2 py-6 text-sm text-[--text-muted]">
                            <IconLoader2 size={14} className="animate-spin" />
                            Loading notebooks…
                        </div>
                    ) : notebooks.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-[--border-subtle] bg-[--bg-app] p-4 text-sm text-[--text-muted]">
                            No notebooks found. Create a notebook first.
                        </div>
                    ) : (
                        <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
                            {notebooks.map((nb) => (
                                <li key={nb.id}>
                                    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[--border-subtle] bg-[--bg-raised] p-2.5 hover:border-[--accent]/60">
                                        <input
                                            type="checkbox"
                                            checked={selected.has(nb.id)}
                                            onChange={() => toggle(nb.id)}
                                            disabled={saving}
                                            className="mt-0.5 accent-[--accent]"
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium">
                                                {nb.name || '(untitled)'}
                                            </span>
                                            {nb.description && (
                                                <span className="block truncate text-xs text-[--text-muted]">
                                                    {nb.description}
                                                </span>
                                            )}
                                        </span>
                                    </label>
                                </li>
                            ))}
                        </ul>
                    )}

                    {error && (
                        <div className="text-sm text-[--text-error]">{error}</div>
                    )}
                </div>
        </CreationModalShell>
    );
};

export default SaveToNotebooksDialog;
