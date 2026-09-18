import { useEffect, useRef, useState } from 'react';

interface Props {
    value: string;
    placeholder: string;
    multiline?: boolean;
    className?: string;
    onSave: (next: string) => void;
}

// Click-to-edit text: renders as plain text (placeholder italic when empty)
// until clicked, then swaps to an input/textarea; commits on blur or Enter
// (single-line), reverts on Escape. Used for the notebook name/description in
// NotebookDetail's header, and the note title in NoteEditorDialog.
export const InlineEditText = ({
    value,
    placeholder,
    multiline = false,
    className = '',
    onSave,
}: Props) => {
    const [editing, setEditing] = useState<boolean>(false);
    const [draft, setDraft] = useState<string>(value);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

    useEffect(() => {
        if (editing) inputRef.current?.focus();
    }, [editing]);

    const start = () => {
        setDraft(value);
        setEditing(true);
    };

    const commit = () => {
        setEditing(false);
        if (draft !== value) onSave(draft);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            setDraft(value);
            setEditing(false);
        } else if (e.key === 'Enter' && !multiline) {
            e.preventDefault();
            commit();
        } else if (e.key === 'Enter' && multiline && (e.metaKey || e.ctrlKey)) {
            // Plain Enter still inserts a newline in multiline mode (needed
            // for multi-line descriptions) — Cmd/Ctrl+Enter is the explicit
            // "save" affordance, matching the common textarea convention
            // (blur/Escape already worked, but there was previously no
            // keyboard-only way to save without leaving the field).
            e.preventDefault();
            commit();
        }
    };

    if (!editing) {
        return (
            <div
                onClick={start}
                title="Click to edit"
                className={`cursor-text rounded px-1 -mx-1 hover:bg-[--bg-hover] ${
                    value ? '' : 'italic text-[--text-muted]'
                } ${className}`}
            >
                {value || placeholder}
            </div>
        );
    }

    const shared = {
        value: draft,
        onChange: (
            e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
        ) => setDraft(e.target.value),
        onBlur: commit,
        onKeyDown: handleKeyDown,
        placeholder,
        className: `w-full rounded border border-[--accent]/40 bg-[--bg-composer] px-1 -mx-1 text-[--text-primary] outline-none focus:ring-1 focus:ring-[--accent] ${className}`,
    };

    return multiline ? (
        <textarea
            {...shared}
            ref={(el) => {
                inputRef.current = el;
            }}
            rows={2}
            title="Cmd/Ctrl+Enter to save, Escape to cancel"
        />
    ) : (
        <input
            {...shared}
            ref={(el) => {
                inputRef.current = el;
            }}
            type="text"
        />
    );
};

export default InlineEditText;
