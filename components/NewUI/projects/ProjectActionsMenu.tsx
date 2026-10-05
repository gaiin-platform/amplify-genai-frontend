import React, { useEffect, useRef, useState } from 'react';
import { IconArchive, IconArchiveOff, IconDots, IconPencil, IconTrash } from '@tabler/icons-react';
import { Project } from '@/types/project';

interface ProjectActionsMenuProps {
    project: Project;
    onEditDetails: () => void;
    onArchiveToggle: () => void;
    onDelete: () => void;
}

/** The "⋯" menu at the top of a project: edit details, archive, delete. */
export const ProjectActionsMenu: React.FC<ProjectActionsMenuProps> = ({ project, onEditDetails, onArchiveToggle, onDelete }) => {
    const [open, setOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const archived = project.status === 'archived';

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (!menuRef.current?.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); }
        };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
    }, [open]);

    const item = 'flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[--bg-hover] focus:bg-[--bg-hover] focus:outline-none';
    const run = (fn: () => void) => () => { setOpen(false); fn(); };

    return (
        <div className="relative">
            <button
                ref={triggerRef}
                type="button"
                aria-label="Project actions"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className="rounded-lg p-2 hover:bg-[--bg-hover] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
                style={{ color: 'var(--text-secondary)' }}
            >
                <IconDots size={18} aria-hidden="true" />
            </button>
            {open && (
                <div ref={menuRef} role="menu" aria-label="Project actions" className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border shadow-lg" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-raised)' }}>
                    <button type="button" role="menuitem" onClick={run(onEditDetails)} className={item}><IconPencil size={14} aria-hidden="true" /> Edit details</button>
                    <button type="button" role="menuitem" onClick={run(onArchiveToggle)} className={item}>
                        {archived ? <IconArchiveOff size={14} aria-hidden="true" /> : <IconArchive size={14} aria-hidden="true" />}
                        {archived ? 'Unarchive' : 'Archive'}
                    </button>
                    <button type="button" role="menuitem" onClick={run(onDelete)} className={`${item} text-red-500`}><IconTrash size={14} aria-hidden="true" /> Delete project</button>
                </div>
            )}
        </div>
    );
};

export default ProjectActionsMenu;
