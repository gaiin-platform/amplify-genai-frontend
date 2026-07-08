import { ReactNode, useEffect, useRef, useState } from 'react';

export interface DropdownItem {
    label: string;
    icon?: ReactNode;
    onClick: () => void;
    // Destructive actions (e.g. delete) render in red instead of the default
    // gray text.
    danger?: boolean;
    // Grayed out and non-clickable (e.g. "Already Embedded").
    disabled?: boolean;
    // Draws a divider line above this item, like shadcn's DropdownMenuSeparator.
    separatorAbove?: boolean;
}

interface Props {
    trigger: ReactNode;
    items: DropdownItem[];
    title?: string;
    variant?: 'solid' | 'ghost';
    // Extra classes merged onto the trigger button — e.g. "invisible
    // group-hover:visible" for a row action that only appears on hover. Forced
    // visible while the menu is open so the trigger doesn't vanish out from
    // under an open menu when the pointer leaves the row.
    triggerClassName?: string;
}

// Small button that opens a menu of items on click, closing on selection or
// on an outside click. Shared by the "Add Source" and bulk context-mode
// menus in NotebookDetail's SourcesPanel/NotesPanel, and the note row's
// overflow (⋮) menu.
export const DropdownButton = ({
    trigger,
    items,
    title,
    variant = 'ghost',
    triggerClassName = '',
}: Props) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) return;
        const onClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, [open]);

    const triggerClass =
        variant === 'solid'
            ? 'flex h-8 items-center gap-1.5 rounded-md bg-purple-500 px-3 text-sm font-medium text-white shadow-sm hover:bg-purple-600 transition-colors'
            : 'flex h-8 items-center gap-1 rounded-md px-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-neutral-700 dark:hover:text-white transition-colors';

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen((v) => !v)}
                title={title}
                aria-haspopup="true"
                aria-expanded={open}
                className={`${triggerClass} ${triggerClassName} ${open ? '!visible' : ''}`}
            >
                {trigger}
            </button>

            {open && (
                <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-neutral-600 dark:bg-[#2b2c36]">
                    {items.map((item, i) => (
                        <div key={i}>
                            {item.separatorAbove && (
                                <div className="my-1 h-px bg-gray-200 dark:bg-neutral-600" />
                            )}
                            <button
                                onClick={() => {
                                    if (item.disabled) return;
                                    setOpen(false);
                                    item.onClick();
                                }}
                                disabled={item.disabled}
                                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                                    item.disabled
                                        ? 'cursor-not-allowed opacity-50'
                                        : 'hover:bg-gray-50 dark:hover:bg-neutral-700'
                                } ${
                                    item.danger
                                        ? 'text-red-600 dark:text-red-400'
                                        : 'text-gray-700 dark:text-gray-200'
                                }`}
                            >
                                {item.icon}
                                {item.label}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DropdownButton;
