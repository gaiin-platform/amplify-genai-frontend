import React, { useRef } from 'react';
import ReactDOM from 'react-dom';
import { IconX } from '@tabler/icons-react';
import { useDialogA11y } from './useDialogA11y';

interface DialogShellProps {
    title: string;
    onClose: () => void;
    children: React.ReactNode;
    footer?: React.ReactNode;
    /** Tailwind max-width class, default max-w-[480px]. */
    widthClass?: string;
}

/** Accessible modal used by the project editors: labelled, focus-trapped, Escape closes. */
export const DialogShell: React.FC<DialogShellProps> = ({ title, onClose, children, footer, widthClass = 'max-w-[480px]' }) => {
    const panelRef = useRef<HTMLDivElement>(null);
    const titleId = useRef(`dialog-title-${Math.random().toString(36).slice(2)}`).current;
    useDialogA11y(true, panelRef, onClose);
    if (typeof document === 'undefined') return null;

    return ReactDOM.createPortal(
        <div
            className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/45 p-4"
            onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                className={`flex max-h-[85vh] w-full ${widthClass} flex-col rounded-2xl outline-none`}
                style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            >
                <div className="flex flex-shrink-0 items-center justify-between px-5 pb-2 pt-5">
                    <h2 id={titleId} className="text-base font-semibold">{title}</h2>
                    <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 hover:bg-[--bg-hover] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]">
                        <IconX size={18} aria-hidden="true" />
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
                {footer && <div className="flex flex-shrink-0 items-center justify-end gap-2 border-t px-5 py-3" style={{ borderColor: 'var(--border-subtle)' }}>{footer}</div>}
            </div>
        </div>,
        document.body,
    );
};

export const primaryBtnCls = 'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-40';
export const ghostBtnCls = 'rounded-lg px-3 py-1.5 text-sm hover:bg-[--bg-hover] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] disabled:opacity-40';
export const fieldStyle: React.CSSProperties = { background: 'var(--bg-app)', border: '1px solid var(--border-subtle)' };
export const fieldCls = 'w-full rounded-lg px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[--accent]';
