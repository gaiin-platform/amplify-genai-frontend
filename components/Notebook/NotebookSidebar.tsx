import React, { useEffect, useRef, useState } from 'react';
import {
    IconArrowBarRight,
    IconArrowLeft,
    IconFileText,
    IconMicrophone,
    IconNotebook,
    IconPlus,
    IconSettings,
    IconTool,
    IconWand,
} from '@tabler/icons-react';
import { CloseSidebarButton } from '@/components/Sidebar/components/OpenCloseButton';
import { LucideBook, LucideSearch } from './LucideIcons';

export type NotebookSection =
    | 'notebooks'
    | 'sources'
    | 'ask'
    | 'podcasts'
    | 'transformations'
    | 'settings'
    | 'advanced';

type SectionGroup = 'COLLECT' | 'PROCESS' | 'CREATE' | 'MANAGE';

interface SectionItem {
    id: NotebookSection;
    label: string;
    icon: React.ReactNode;
    group: SectionGroup;
    comingSoon?: boolean;
}

const SECTIONS: SectionItem[] = [
    { id: 'sources', label: 'Sources', icon: <IconFileText size={22} />, group: 'COLLECT' },
    { id: 'notebooks', label: 'Notebooks', icon: <LucideBook size={22} />, group: 'PROCESS' },
    { id: 'ask', label: 'Ask and Search', icon: <LucideSearch size={22} />, group: 'PROCESS' },
    { id: 'podcasts', label: 'Podcasts', icon: <IconMicrophone size={22} />, group: 'CREATE' },
    { id: 'transformations', label: 'Transformations', icon: <IconWand size={22} />, group: 'MANAGE' },
    { id: 'settings', label: 'Settings', icon: <IconSettings size={22} />, group: 'MANAGE' },
    { id: 'advanced', label: 'Advanced', icon: <IconTool size={22} />, group: 'MANAGE' },
];

const GROUP_ORDER: SectionGroup[] = ['COLLECT', 'PROCESS', 'CREATE', 'MANAGE'];

export type CreateTarget = 'source' | 'notebook' | 'podcast';

const CREATE_ITEMS: {
    id: CreateTarget;
    label: string;
    icon: React.ReactNode;
    chipClass: string;
}[] = [
    {
        id: 'source',
        label: 'Source',
        icon: <IconFileText size={15} />,
        chipClass: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
    },
    {
        id: 'notebook',
        label: 'Notebook',
        icon: <LucideBook size={15} />,
        chipClass: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
    },
    {
        id: 'podcast',
        label: 'Podcast',
        icon: <IconMicrophone size={15} />,
        chipClass: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
    },
];

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
        <div ref={ref} className={collapsed ? 'relative mt-1' : 'relative'}>
            {collapsed ? (
                <button
                    onClick={() => setOpen((v) => !v)}
                    title="New"
                    className="group flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-md ring-2 ring-purple-400/0 transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/30 hover:ring-purple-400/40 hover:scale-105 active:scale-95"
                >
                    <IconPlus size={17} />
                </button>
            ) : (
                <button
                    onClick={() => setOpen((v) => !v)}
                    className="group flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 px-3 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/30 hover:scale-[1.02] active:scale-95"
                >
                    <IconPlus size={16} />
                    New
                </button>
            )}
            {open && (
                <div
                    className={`absolute z-30 w-48 origin-top-left animate-fadeInScale rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl shadow-black/5 dark:border-neutral-700 dark:bg-[#2b2c36] ${
                        collapsed ? 'left-full top-0 ml-2' : 'left-0 top-full mt-1.5'
                    }`}
                    style={{ animationDuration: '0.15s' }}
                >
                    {CREATE_ITEMS.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => select(item.id)}
                            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-gray-700 transition-colors hover:bg-purple-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-white/5 dark:hover:text-white"
                        >
                            <span className={`flex h-7 w-7 items-center justify-center rounded-md ${item.chipClass}`}>
                                {item.icon}
                            </span>
                            <span className="font-medium">{item.label}</span>
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

export const NotebookSidebar: React.FC<NotebookSidebarProps> = ({
    section,
    onSection,
    onCreate,
    onBack,
    collapsed,
    onToggleCollapse,
}) => {
    const [isHovered, setIsHovered] = useState(false);

    if (collapsed) {
        return (
            <div className="flex h-full w-12 flex-none flex-col items-center gap-2 border-r border-gray-200 bg-[#f3f3f3] py-3 dark:border-r-[#202123] dark:bg-[#202123]">
                <button
                    onClick={onToggleCollapse}
                    title="Expand sidebar"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
                >
                    <IconArrowBarRight size={18} />
                </button>
                <button
                    onClick={onBack}
                    title="Back to chat"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
                >
                    <IconArrowLeft size={18} />
                </button>
                <CreateMenu collapsed onSelect={onCreate} />
                <div className="mt-2 flex flex-col gap-1">
                    {SECTIONS.map((item) => {
                        const active = item.id === section;
                        return (
                            <button
                                key={item.id}
                                onClick={() => onSection(item.id)}
                                title={item.label}
                                className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                                    active
                                        ? 'bg-neutral-200 text-purple-600 dark:bg-neutral-700/70 dark:text-purple-400'
                                        : 'text-gray-500 hover:bg-gray-200 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white'
                                }`}
                            >
                                {item.icon}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div
            className="flex h-full w-[270px] flex-none flex-col border-r border-gray-200 bg-[#f3f3f3] dark:border-r-[#202123] dark:bg-[#202123]"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                <button
                    onClick={onBack}
                    title="Back to chat"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
                >
                    <IconArrowLeft size={16} />
                </button>
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-sm">
                    <IconNotebook size={14} />
                </div>
                <span className="flex-1 truncate text-sm font-semibold text-gray-800 dark:text-gray-100">
                    Notebook
                </span>
                <CloseSidebarButton onClick={onToggleCollapse} side="left" isHovered={isHovered} />
            </div>

            <div className="px-6 pt-3">
                <CreateMenu collapsed={false} onSelect={onCreate} />
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-3 pt-1">
                {GROUP_ORDER.map((group) => {
                    const items = SECTIONS.filter((s) => s.group === group);
                    if (items.length === 0) return null;
                    return (
                        <div key={group} className="mt-5">
                            <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                {group}
                            </div>
                            <ul className="flex flex-col gap-1">
                                {items.map((item) => {
                                    const active = item.id === section;
                                    return (
                                        <li key={item.id}>
                                            <button
                                                onClick={() => onSection(item.id)}
                                                className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-[15px] transition-colors ${
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
                                                <span className="flex-1 truncate text-left">{item.label}</span>
                                                {item.comingSoon && (
                                                    <span className="rounded bg-neutral-300/60 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-gray-600 dark:bg-white/10 dark:text-gray-400">
                                                        Soon
                                                    </span>
                                                )}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default NotebookSidebar;
