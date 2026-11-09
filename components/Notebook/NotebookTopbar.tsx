import React from 'react';
import {
    LucideBook,
    LucideFileText,
    LucideMic,
    LucideSearch,
    LucideSettings,
    LucideShuffle,
    LucideWrench,
} from './LucideIcons';

export type NotebookSection =
    | 'notebooks'
    | 'sources'
    | 'ask'
    | 'podcasts'
    | 'transformations'
    | 'settings'
    | 'advanced';

interface SectionItem {
    id: NotebookSection;
    label: string;
    icon: React.ReactNode;
    // Only shown to notebook admins — Transformations/Settings/Advanced edit
    // shared, global backend records (not per-user data), so a non-admin
    // editing them would change behavior for every user of the feature.
    adminOnly?: boolean;
}

// Same section set/order as the former vertical sidebar's Collect/Process/
// Create/Manage groups, flattened into one row — a horizontal tab bar has no
// good equivalent for stacked group headers, so a thin divider marks the
// admin-only cluster instead (see firstAdminIndex below).
const SECTIONS: SectionItem[] = [
    { id: 'sources', label: 'Sources', icon: <LucideFileText size={16} /> },
    { id: 'notebooks', label: 'Notebooks', icon: <LucideBook size={16} /> },
    { id: 'ask', label: 'Ask and Search', icon: <LucideSearch size={16} /> },
    { id: 'podcasts', label: 'Podcasts', icon: <LucideMic size={16} /> },
    { id: 'transformations', label: 'Transformations', icon: <LucideShuffle size={16} />, adminOnly: true },
    { id: 'settings', label: 'Settings', icon: <LucideSettings size={16} />, adminOnly: true },
    { id: 'advanced', label: 'Advanced', icon: <LucideWrench size={16} />, adminOnly: true },
];

interface NotebookTopbarProps {
    section: NotebookSection;
    onSection: (s: NotebookSection) => void;
    // Transformations/Settings/Advanced edit shared, global backend records —
    // not per-user data — so they're hidden unless the viewer is an admin
    // (gated by the `adminInterface` feature flag upstream).
    isAdmin: boolean;
}

// Horizontal nav bar for the Notebook feature — mirrors the sticky tab bar
// pattern in NewAssistantsView.tsx (48px, --bg-sidebar, border-b, 13px tabs
// with an accent underline on the active tab). No back/exit button: NewSidebar
// (the persistent app-level sidebar) stays visible alongside this page and
// already provides navigation back to Chats.
//
// Deliberately carries no "New" action of its own — every section that needs
// one (Notebooks, Sources, Podcasts) already puts a "New X" button in its own
// page header, and a second global create menu here duplicated it (e.g. "New
// Notebook" appearing twice at once on the Notebooks section).
export const NotebookTopbar: React.FC<NotebookTopbarProps> = ({
    section,
    onSection,
    isAdmin,
}) => {
    const visibleSections = SECTIONS.filter((s) => !s.adminOnly || isAdmin);
    const firstAdminIndex = visibleSections.findIndex((s) => s.adminOnly);

    return (
        <div className="flex h-12 flex-none items-center border-b border-[--border-subtle] bg-[--bg-sidebar] px-4">
            <nav className="flex h-full min-w-0 items-center gap-1 overflow-x-auto">
                {visibleSections.map((item, i) => {
                    const active = item.id === section;
                    return (
                        <React.Fragment key={item.id}>
                            {i > 0 && i === firstAdminIndex && (
                                <div className="mx-1 h-5 w-px flex-shrink-0 bg-[--border-subtle]" />
                            )}
                            <button
                                onClick={() => onSection(item.id)}
                                aria-current={active ? 'page' : undefined}
                                className={`group relative flex h-full flex-shrink-0 items-center gap-1.5 px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[--text-secondary] ${
                                    active
                                        ? 'text-[--text-primary]'
                                        : 'text-[--text-muted] hover:text-[--text-secondary]'
                                }`}
                            >
                                <span
                                    className={`flex-shrink-0 flex items-center transition-opacity ${
                                        active ? 'opacity-100' : 'opacity-75 group-hover:opacity-100'
                                    }`}
                                >
                                    {item.icon}
                                </span>
                                <span className="whitespace-nowrap">{item.label}</span>
                                {active && (
                                    <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full bg-[--accent]" />
                                )}
                            </button>
                        </React.Fragment>
                    );
                })}
            </nav>
        </div>
    );
};

export default NotebookTopbar;
