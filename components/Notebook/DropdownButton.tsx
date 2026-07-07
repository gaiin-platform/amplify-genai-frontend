import { ReactNode, useEffect, useRef, useState } from 'react';

export interface DropdownItem {
    label: string;
    icon?: ReactNode;
    onClick: () => void;
}

interface Props {
    trigger: ReactNode;
    items: DropdownItem[];
    title?: string;
    variant?: 'solid' | 'ghost';
}

// Small button that opens a menu of items on click, closing on selection or
// on an outside click. Shared by the "Add Source" and bulk context-mode
// menus in NotebookDetail's SourcesPanel/NotesPanel.
export const DropdownButton = ({ trigger, items, title, variant = 'ghost' }: Props) => {
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
                className={triggerClass}
            >
                {trigger}
            </button>

            {open && (
                <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-neutral-600 dark:bg-[#2b2c36]">
                    {items.map((item, i) => (
                        <button
                            key={i}
                            onClick={() => {
                                setOpen(false);
                                item.onClick();
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-neutral-700"
                        >
                            {item.icon}
                            {item.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DropdownButton;
