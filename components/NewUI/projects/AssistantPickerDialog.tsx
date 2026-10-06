import React, { useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { IconCheck, IconSparkles, IconX } from '@tabler/icons-react';
import { AssistantChoice, useProjectAssistants } from './useProjectAssistants';
import { useDialogA11y } from './useDialogA11y';

interface AssistantPickerDialogProps {
    currentId?: string;
    onSelect: (choice: AssistantChoice | null) => void;
    onClose: () => void;
}

/** Choose one of the user's existing assistants to attach to a project. */
export const AssistantPickerDialog: React.FC<AssistantPickerDialogProps> = ({ currentId, onSelect, onClose }) => {
    const panelRef = useRef<HTMLDivElement>(null);
    const [search, setSearch] = useState('');
    const { choices } = useProjectAssistants();
    useDialogA11y(true, panelRef, onClose);

    const term = search.trim().toLowerCase();
    const visible = useMemo(
        () => choices.filter((c) => !term || c.name.toLowerCase().includes(term) || c.description.toLowerCase().includes(term)),
        [choices, term],
    );

    if (typeof document === 'undefined') return null;
    return ReactDOM.createPortal(
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 p-4"
            onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="assistant-picker-title"
                tabIndex={-1}
                className="flex max-h-[80vh] w-full max-w-[460px] flex-col rounded-xl p-4 outline-none"
                style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            >
                <div className="mb-1 flex items-center justify-between">
                    <h2 id="assistant-picker-title" className="text-base font-semibold">Choose an assistant</h2>
                    <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 hover:bg-[--bg-hover] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]">
                        <IconX size={18} aria-hidden="true" />
                    </button>
                </div>
                <p className="mb-3 text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
                    New chats in this project start with this assistant. You can still switch it in any chat.
                </p>
                <label htmlFor="assistant-picker-search" className="sr-only">Search assistants</label>
                <input
                    id="assistant-picker-search"
                    data-autofocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search assistants…"
                    className="mb-2 w-full rounded-md p-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
                    style={{ background: 'var(--bg-app)', border: '1px solid var(--border-subtle)' }}
                />
                <div className="min-h-0 flex-1 overflow-y-auto">
                    {choices.length === 0 && (
                        <div className="px-2 py-3 text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
                            You don&apos;t have any assistants yet. Create one from Assistants in the sidebar, then attach it here.
                        </div>
                    )}
                    {choices.length > 0 && visible.length === 0 && (
                        <div className="px-2 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>No assistants match “{search}”.</div>
                    )}
                    <ul>
                        {visible.map((choice) => (
                            <li key={choice.id}>
                                <button
                                    type="button"
                                    onClick={() => onSelect(choice)}
                                    aria-current={choice.id === currentId ? 'true' : undefined}
                                    className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-[--bg-hover] focus:bg-[--bg-hover] focus:outline-none"
                                >
                                    <IconSparkles size={15} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} aria-hidden="true" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium">{choice.name}</span>
                                        {choice.description && <span className="line-clamp-2 block text-xs leading-4" style={{ color: 'var(--text-muted)' }}>{choice.description}</span>}
                                    </span>
                                    {choice.id === currentId && <IconCheck size={14} className="mt-0.5 flex-shrink-0" aria-label="Currently attached" />}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
                {currentId && (
                    <button
                        type="button"
                        onClick={() => onSelect(null)}
                        className="mt-3 rounded-lg border px-3 py-2 text-sm hover:bg-[--bg-hover] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
                        style={{ borderColor: 'var(--border-subtle)' }}
                    >
                        Remove assistant
                    </button>
                )}
            </div>
        </div>,
        document.body,
    );
};

export default AssistantPickerDialog;
