import React, { useEffect, useRef, useState } from 'react';
import { IconNotebook } from '@tabler/icons-react';
import {
    LucideArrowLeft,
    LucideBook,
    LucideChevronLeft,
    LucideFileText,
    LucideMenu,
    LucideMic,
    LucidePlus,
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

type SectionGroup = 'Collect' | 'Process' | 'Create' | 'Manage';

interface SectionItem {
    id: NotebookSection;
    label: string;
    icon: React.ReactNode;
    group: SectionGroup;
}

// Mirrors the reference AppSidebar's navigation groups. "Models" is
// intentionally absent — provider credentials/models are env-configured
// server-side in the Vanderbilt deployment, not user-editable.
const SECTIONS: SectionItem[] = [
    { id: 'sources', label: 'Sources', icon: <LucideFileText size={16} />, group: 'Collect' },
    { id: 'notebooks', label: 'Notebooks', icon: <LucideBook size={16} />, group: 'Process' },
    { id: 'ask', label: 'Ask and Search', icon: <LucideSearch size={16} />, group: 'Process' },
    { id: 'podcasts', label: 'Podcasts', icon: <LucideMic size={16} />, group: 'Create' },
    {
        id: 'transformations',
        label: 'Transformations',
        icon: <LucideShuffle size={16} />,
        group: 'Manage',
    },
    { id: 'settings', label: 'Settings', icon: <LucideSettings size={16} />, group: 'Manage' },
    { id: 'advanced', label: 'Advanced', icon: <LucideWrench size={16} />, group: 'Manage' },
];

const GROUP_ORDER: SectionGroup[] = ['Collect', 'Process', 'Create', 'Manage'];

export type CreateTarget = 'source' | 'notebook' | 'podcast';

const CREATE_ITEMS: { id: CreateTarget; label: string; icon: React.ReactNode }[] = [
    { id: 'source', label: 'Source', icon: <LucideFileText size={16} /> },
    { id: 'notebook', label: 'Notebook', icon: <LucideBook size={16} /> },
    { id: 'podcast', label: 'Podcast', icon: <LucideMic size={16} /> },
];

// "New" button + dropdown mirroring the reference sidebar's create menu
// (flat primary button, w-48 menu with 16px icons), purple as our primary.
const CreateMenu: React.FC<{ collapsed: boolean; onSelect: (t: CreateTarget) => void }> = ({
    collapsed,
    onSelect,
}) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    const select = (t: CreateTarget) => {
        setOpen(false);
        onSelect(t);
    };

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen((v) => !v)}
                title={collapsed ? 'New' : undefined}
                className={`flex h-8 w-full items-center rounded-md bg-purple-500 text-sm font-medium text-white shadow-sm transition-colors hover:bg-purple-600 ${
                    collapsed ? 'justify-center px-2' : 'justify-start px-3'
                }`}
            >
                <LucidePlus size={16} className={collapsed ? '' : 'mr-2'} />
                {!collapsed && 'New'}
            </button>

            {open && (
                <div
                    className={`absolute z-30 w-48 animate-fadeInScale rounded-md border border-gray-200 bg-white p-1 shadow-md dark:border-neutral-700 dark:bg-[#2b2c36] ${
                        collapsed ? 'left-full top-0 ml-2' : 'left-0 top-full mt-1'
                    }`}
                    style={{ animationDuration: '0.15s' }}
                >
                    {CREATE_ITEMS.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => select(item.id)}
                            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-neutral-700"
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

interface NotebookSidebarProps {
    section: NotebookSection;
    onSection: (s: NotebookSection) => void;
    onCreate: (target: CreateTarget) => void;
    onBack: () => void;
    collapsed: boolean;
    onToggleCollapse: () => void;
}

// Sidebar mirroring the reference AppSidebar: h-16 logo header with collapse
// toggle, "New" create button, grouped nav (16px icons, separators between
// groups), and a footer action — "Back to Chat" here, where the reference has
// Sign Out (amplify owns auth). No Models entry (see SECTIONS comment), no
// ⌘K hint (no command palette), no theme/language toggles (amplify's are
// global).
export const NotebookSidebar: React.FC<NotebookSidebarProps> = ({
    section,
    onSection,
    onCreate,
    onBack,
    collapsed,
    onToggleCollapse,
}) => {
    const navItem = (item: SectionItem) => {
        const active = item.id === section;
        return (
            <button
                key={item.id}
                onClick={() => onSection(item.id)}
                title={collapsed ? item.label : undefined}
                className={`flex h-9 w-full items-center gap-3 rounded-md text-sm font-medium transition-colors ${
                    collapsed ? 'justify-center px-2' : 'justify-start px-4'
                } ${
                    active
                        ? 'bg-neutral-200 text-gray-900 dark:bg-neutral-700/70 dark:text-white'
                        : 'text-gray-600 hover:bg-neutral-200/70 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white'
                }`}
            >
                <span
                    className={
                        active
                            ? 'text-purple-600 dark:text-purple-400'
                            : 'text-gray-500 dark:text-gray-400'
                    }
                >
                    {item.icon}
                </span>
                {!collapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
            </button>
        );
    };

    return (
        <div
            className={`flex h-full flex-none flex-col border-r border-gray-200 bg-[#f3f3f3] transition-all duration-300 dark:border-r-[#202123] dark:bg-[#202123] ${
                collapsed ? 'w-16' : 'w-64'
            }`}
        >
            {/* Header */}
            <div
                className={`group flex h-16 flex-none items-center ${
                    collapsed ? 'justify-center px-2' : 'justify-between px-4'
                }`}
            >
                {collapsed ? (
                    <div className="relative flex w-full items-center justify-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-sm transition-opacity group-hover:opacity-0">
                            <IconNotebook size={18} />
                        </div>
                        <button
                            onClick={onToggleCollapse}
                            title="Expand sidebar"
                            className="absolute flex h-8 items-center justify-center rounded-md px-3 text-gray-500 opacity-0 transition-opacity hover:bg-gray-200 hover:text-gray-800 group-hover:opacity-100 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
                        >
                            <LucideMenu size={16} />
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-sm">
                                <IconNotebook size={18} />
                            </div>
                            <span className="text-base font-medium text-gray-800 dark:text-gray-100">
                                Notebook
                            </span>
                        </div>
                        <button
                            onClick={onToggleCollapse}
                            title="Collapse sidebar"
                            className="flex h-8 items-center justify-center rounded-md px-3 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
                        >
                            <LucideChevronLeft size={16} />
                        </button>
                    </>
                )}
            </div>

            {/* Nav */}
            <nav
                className={`flex-1 space-y-1 overflow-y-auto py-4 ${collapsed ? 'px-2' : 'px-3'}`}
            >
                <div className={`mb-4 ${collapsed ? 'px-0' : 'px-3'}`}>
                    <CreateMenu collapsed={collapsed} onSelect={onCreate} />
                </div>

                {GROUP_ORDER.map((group, index) => {
                    const items = SECTIONS.filter((s) => s.group === group);
                    if (items.length === 0) return null;
                    return (
                        <div key={group}>
                            {index > 0 && (
                                <div className="my-3 h-px bg-gray-200 dark:bg-neutral-700" />
                            )}
                            <div className="space-y-1">
                                {!collapsed && (
                                    <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                        {group}
                                    </h3>
                                )}
                                {items.map(navItem)}
                            </div>
                        </div>
                    );
                })}
            </nav>

            {/* Footer — Back to Chat sits where the reference has Sign Out */}
            <div
                className={`flex-none border-t border-gray-200 p-3 dark:border-neutral-700 ${
                    collapsed ? 'px-2' : ''
                }`}
            >
                <button
                    onClick={onBack}
                    title={collapsed ? 'Back to Chat' : undefined}
                    className={`flex h-9 w-full items-center gap-3 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-neutral-600 dark:bg-transparent dark:text-gray-200 dark:hover:bg-neutral-700 ${
                        collapsed ? 'justify-center px-2' : 'justify-start px-4'
                    }`}
                >
                    <LucideArrowLeft size={16} />
                    {!collapsed && 'Back to Chat'}
                </button>
            </div>
        </div>
    );
};

export default NotebookSidebar;
