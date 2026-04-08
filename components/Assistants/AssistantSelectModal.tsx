import { FC, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { IconRobot, IconX, IconLayoutGrid, IconUsers } from '@tabler/icons-react';
import { Assistant, AssistantProviderID } from '@/types/assistant';
import { LayeredAssistant } from '@/types/layeredAssistant';
import Search from '@/components/Search/Search';

interface Props {
    assistant: Assistant | null;
    availableAssistants: Assistant[];
    layeredAssistants?: LayeredAssistant[];
    onAssistantChange: (assistant: Assistant) => void;
    onLayeredAssistantChange?: (la: LayeredAssistant) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
    onClose: () => void;
}

export const AssistantSelectModal: FC<Props> = ({
    assistant,
    availableAssistants,
    layeredAssistants = [],
    onAssistantChange,
    onLayeredAssistantChange,
    onKeyDown,
    onClose,
}) => {
    const { t } = useTranslation('chat');
    const [search, setSearch] = useState('');
    const firstButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        firstButtonRef.current?.focus();
    }, []);

    const term = search.toLowerCase();

    const filteredAssistants = availableAssistants.filter(a =>
        a.definition.name.toLowerCase().includes(term) ||
        (a.definition.description ?? '').toLowerCase().includes(term)
    );

    const filteredLayered = layeredAssistants.filter(la =>
        la.name.toLowerCase().includes(term) ||
        (la.description ?? '').toLowerCase().includes(term)
    );

    const currentId = assistant?.definition?.data?.isLayeredAssistant
        ? assistant.id
        : assistant?.id ?? AssistantProviderID.AMPLIFY;

    const isSelected = (id: string) => currentId === id;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        } else {
            onKeyDown(e);
        }
    };

    return (
        <div
            className="flex flex-col rounded-xl border border-neutral-300 dark:border-neutral-600
                       bg-white dark:bg-gray-800 shadow-2xl overflow-hidden"
            style={{ width: window.innerWidth / 2, maxHeight: '480px' }}
            onKeyDown={handleKeyDown}
        >
            {/* Header with single search bar */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-200 dark:border-neutral-600 bg-white dark:bg-gray-900 flex-shrink-0">
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider whitespace-nowrap">
                    Select Assistant
                </span>
                <div className="flex-1">
                    <Search
                        placeholder="Search assistants..."
                        searchTerm={search}
                        onSearch={setSearch}
                        paddingY="py-1"
                    />
                </div>
                <button
                    onClick={onClose}
                    className="p-0.5 rounded text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors flex-shrink-0"
                >
                    <IconX size={14} stroke={2.5} />
                </button>
            </div>

            {/* Two columns — layered column only shown if any exist */}
            <div className="flex flex-1 min-h-0 divide-x divide-neutral-200 dark:divide-neutral-600">

                {/* Left — Assistants */}
                <div className={`flex flex-col min-h-0 ${layeredAssistants.length > 0 ? 'w-1/2' : 'w-full'}`}>
                    <div className="px-3 pt-2.5 pb-1.5 flex-shrink-0 flex items-center gap-1.5">
                        <IconRobot size={16} className="text-neutral-400 dark:text-neutral-500" />
                        <span className="text-[12px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                            Assistants
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
                        {/* Standard conversation — only show when search is empty or matches */}
                        {(!term || 'standard conversation'.includes(term)) && (
                            <button
                                ref={firstButtonRef}
                                onClick={() => onAssistantChange({ id: AssistantProviderID.AMPLIFY, definition: { name: 'Standard Conversation', description: '', assistantId: '', instructions: '', tools: [], tags: [], fileKeys: [], dataSources: [], provider: AssistantProviderID.AMPLIFY } } as unknown as Assistant)}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors
                                    ${isSelected(AssistantProviderID.AMPLIFY)
                                        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium'
                                        : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700/50'
                                    }`}
                            >
                                Standard Conversation
                            </button>
                        )}
                        {filteredAssistants.length === 0 && term ? (
                            <p className="text-center text-xs text-neutral-400 dark:text-neutral-500 py-4">No match</p>
                        ) : filteredAssistants.length === 0 && !term ? (
                            <p className="text-center text-xs text-neutral-400 dark:text-neutral-500 py-4">No assistants available</p>
                        ) : (
                            filteredAssistants.map(a => (
                                <button
                                    key={a.id}
                                    onClick={() => onAssistantChange(a)}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors
                                        ${isSelected(a.id)
                                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium'
                                            : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700/50'
                                        }`}
                                >
                                    <span className="flex items-center gap-1 truncate">
                                        {a.definition.groupId && (
                                            <IconUsers size={11} className="flex-shrink-0 text-purple-500 dark:text-purple-400" />
                                        )}
                                        <span className="truncate">{a.definition.name}</span>
                                    </span>
                                    {a.definition.description && (
                                        <span className="block truncate text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                                            {a.definition.description}
                                        </span>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Right — Layered Assistants (only rendered if any exist) */}
                {layeredAssistants.length > 0 && (
                <div className="flex flex-col w-1/2 min-h-0">
                    <div className="px-3 pt-2.5 pb-1.5 flex-shrink-0 flex items-center gap-1.5">
                        <IconLayoutGrid size={16} className="text-purple-400 dark:text-purple-500" />
                        <span className="text-[12px] font-bold text-purple-500 dark:text-purple-400 uppercase tracking-wider">
                            Layered Assistants
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
                        {filteredLayered.length === 0 && term ? (
                            <p className="text-center text-xs text-neutral-400 dark:text-neutral-500 py-4">No match</p>
                        ) : (
                            filteredLayered.map(la => (
                                <button
                                    key={la.assistantId ?? la.name}
                                    onClick={() => onLayeredAssistantChange?.(la)}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors
                                        ${isSelected(la.assistantId ?? '')
                                            ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-medium'
                                            : 'text-neutral-700 dark:text-neutral-300 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                                        }`}
                                >
                                    <span className="flex items-center gap-1 truncate">
                                        {la.groupId && (
                                            <IconUsers size={11} className="flex-shrink-0 text-purple-500 dark:text-purple-400" />
                                        )}
                                        <span className="truncate">{la.name}</span>
                                    </span>
                                    {la.description && (
                                        <span className="block truncate text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                                            {la.description}
                                        </span>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
                )}

            </div>
        </div>
    );
};
