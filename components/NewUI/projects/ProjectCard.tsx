import React, { useEffect, useRef, useState } from 'react';
import { IconArchive, IconArchiveOff, IconDots, IconStack2, IconTrash } from '@tabler/icons-react';
import { Project } from '@/types/project';
import { formatRelative } from './projectFormat';

interface ProjectCardProps {
    project: Project;
    chatCount: number;
    /** ISO timestamp of the latest project chat or project edit. */
    lastActivity: string;
    onOpen: () => void;
    onArchiveToggle: () => void;
    onDelete: () => void;
}

/**
 * Gallery card. The whole card is one real <button> (keyboard + screen-reader
 * reachable); the "more" menu is a sibling control layered above it, so the two
 * never nest interactive elements.
 */
export const ProjectCard: React.FC<ProjectCardProps> = ({
    project, chatCount, lastActivity, onOpen, onArchiveToggle, onDelete,
}) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const archived = project.status === 'archived';

    useEffect(() => {
        if (!menuOpen) return;
        const onPointerDown = (event: MouseEvent) => {
            if (!menuRef.current?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setMenuOpen(false);
                triggerRef.current?.focus();
            }
        };
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [menuOpen]);

    return (
        <div
            className="group relative rounded-2xl border transition-all hover:-translate-y-0.5 hover:shadow-sm motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus-within:shadow-sm"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-raised)', opacity: archived ? 0.75 : 1 }}
        >
            <button
                type="button"
                onClick={onOpen}
                className="flex min-h-[176px] w-full flex-col rounded-2xl p-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
            >
                <span
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ background: 'color-mix(in srgb, var(--accent) 14%, transparent)', color: 'var(--accent)' }}
                    aria-hidden="true"
                >
                    <IconStack2 size={20} />
                </span>
                <span className="mt-4 flex min-w-0 items-center gap-2 pr-8">
                    <span className="truncate text-[15px] font-semibold">{project.name}</span>
                    {archived && (
                        <span className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px]" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                            Archived
                        </span>
                    )}
                </span>
                <span className="mt-1 line-clamp-2 min-h-[36px] text-[13px] leading-[18px]" style={{ color: 'var(--text-secondary)' }}>
                    {project.description || 'No description'}
                </span>
                <span className="mt-auto flex w-full items-center justify-between pt-4 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    <span>{chatCount} {chatCount === 1 ? 'chat' : 'chats'}</span>
                    <span>{lastActivity ? `Active ${formatRelative(lastActivity)}` : ''}</span>
                </span>
            </button>

            <div className="absolute right-3 top-3">
                <button
                    ref={triggerRef}
                    type="button"
                    aria-label={`More actions for ${project.name}`}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((open) => !open)}
                    // Visible by default so touch users can reach it; fades to hover/focus on pointer devices.
                    className="rounded-lg p-1.5 opacity-70 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                    style={{ color: 'var(--text-muted)' }}
                >
                    <IconDots size={16} aria-hidden="true" />
                </button>
                {menuOpen && (
                    <div
                        ref={menuRef}
                        role="menu"
                        aria-label={`Actions for ${project.name}`}
                        className="absolute right-0 z-10 mt-1 w-40 overflow-hidden rounded-md border shadow-lg"
                        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-raised)' }}
                    >
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => { setMenuOpen(false); onArchiveToggle(); }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[--bg-hover] focus:bg-[--bg-hover] focus:outline-none"
                        >
                            {archived ? <IconArchiveOff size={14} aria-hidden="true" /> : <IconArchive size={14} aria-hidden="true" />}
                            {archived ? 'Unarchive' : 'Archive'}
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => { setMenuOpen(false); onDelete(); }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-[--bg-hover] focus:bg-[--bg-hover] focus:outline-none"
                        >
                            <IconTrash size={14} aria-hidden="true" /> Delete
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProjectCard;
