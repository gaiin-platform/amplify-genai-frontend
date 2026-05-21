import React, { useState } from 'react';
import {
    IconArrowBarRight,
    IconArrowLeft,
    IconFileText,
    IconMicrophone,
    IconNotebook,
    IconPlus,
    IconSettings,
} from '@tabler/icons-react';
import { CloseSidebarButton } from '@/components/Sidebar/components/OpenCloseButton';
import { LucideBook, LucideBot, LucideSearch, LucideShuffle } from './LucideIcons';

export type NotebookSection =
    | 'notebooks'
    | 'sources'
    | 'ask'
    | 'podcasts'
    | 'models'
    | 'transformations'
    | 'settings';

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
    { id: 'models', label: 'Models', icon: <LucideBot size={22} />, group: 'MANAGE' },
    { id: 'transformations', label: 'Transformations', icon: <LucideShuffle size={22} />, group: 'MANAGE' },
    { id: 'settings', label: 'Settings', icon: <IconSettings size={22} />, group: 'MANAGE' },
];

const GROUP_ORDER: SectionGroup[] = ['COLLECT', 'PROCESS', 'CREATE', 'MANAGE'];

interface NotebookSidebarProps {
    section: NotebookSection;
    onSection: (s: NotebookSection) => void;
    onCreate: () => void;
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
                <button
                    onClick={onCreate}
                    title="New notebook"
                    className="mt-1 flex h-8 w-8 items-center justify-center rounded-md bg-purple-500 text-white shadow-sm transition-colors hover:bg-purple-600"
                >
                    <IconPlus size={16} />
                </button>
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
