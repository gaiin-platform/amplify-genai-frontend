import { FC, useContext, useEffect } from 'react';
import { IconUsers, IconRobot, IconTemplate, IconLoader2, IconX, IconGitBranch } from '@tabler/icons-react';
import { GroupAssistantsGallery } from '@/components/GroupAssistants/GroupAssistantsGallery';
import { IndividualAssistantsGallery } from '@/components/AssistantGallery/IndividualAssistantsGallery';
import { PromptTemplatesGallery } from '@/components/AssistantGallery/PromptTemplatesGallery';
import { LayeredAssistantsGallery } from '@/components/AssistantGallery/LayeredAssistantsGallery';
import HomeContext from '@/pages/api/home/home.context';

export interface AssistantGalleryProps {}

type TabType = 'group' | 'individual' | 'templates' | 'layered';

export const AssistantGallery: FC<AssistantGalleryProps> = () => {
    const {
        state: { groups, activeAssistantGalleryTab, syncingPrompts, syncingLayeredAssistants },
        dispatch: homeDispatch
    } = useContext(HomeContext);

    // Load from localStorage on mount, default to 'group' if nothing saved
    useEffect(() => {
        const savedTab = localStorage.getItem('activeAssistantGalleryTab') as TabType | null;
        const validTabs: TabType[] = ['group', 'individual', 'templates', 'layered'];
        if (savedTab && validTabs.includes(savedTab)) {
            homeDispatch({ field: 'activeAssistantGalleryTab', value: savedTab });
        } else {
            // Ensure we default to 'group' if no saved preference
            homeDispatch({ field: 'activeAssistantGalleryTab', value: 'group' });
        }
    }, []);

    // If Group Assistants tab is hidden and user is on it, switch to 'individual' tab
    useEffect(() => {
        const shouldShowGroupTab = syncingPrompts || groups.length > 0;
        if (!shouldShowGroupTab && activeAssistantGalleryTab === 'group') {
            handleTabChange('individual');
        }
    }, [syncingPrompts, groups.length, activeAssistantGalleryTab]);

    const handleTabChange = (tab: TabType) => {
        homeDispatch({ field: 'activeAssistantGalleryTab', value: tab });
        localStorage.setItem('activeAssistantGalleryTab', tab);
    };

    // Determine if we should show the Group Assistants tab
    const shouldShowGroupTab = syncingPrompts || groups.length > 0;

    return (
        <div className="h-full w-full flex flex-col bg-white dark:bg-gray-900">
            {/* Segmented Control Style Switcher */}
            <div className="flex items-center justify-center p-4 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 relative">
                <div className="inline-flex items-center gap-2 p-1.5 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    {shouldShowGroupTab && (
                        <button
                            onClick={() => handleTabChange('group')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                activeAssistantGalleryTab === 'group'
                                    ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-600 shadow-md'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                            }`}
                        >
                            {syncingPrompts ? (
                                <IconLoader2 size={18} className="animate-spin" />
                            ) : (
                                <IconUsers size={18} />
                            )}
                            <span>{syncingPrompts ? 'Loading Group Assistants...' : 'Group Assistants'}</span>
                        </button>
                    )}

                    <button
                        onClick={() => handleTabChange('individual')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            activeAssistantGalleryTab === 'individual'
                                ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-600 shadow-md'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                    >
                        <IconRobot size={18} />
                        <span>Assistants</span>
                    </button>

                    <button
                        onClick={() => handleTabChange('templates')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            activeAssistantGalleryTab === 'templates'
                                ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-600 shadow-md'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                    >
                        <IconTemplate size={18} />
                        <span>Prompt Templates</span>
                    </button>

                    <button
                        onClick={() => handleTabChange('layered')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            activeAssistantGalleryTab === 'layered'
                                ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-600 shadow-md'
                                : 'text-gray-600 dark:text-purple-300 hover:text-gray-900 dark:hover:text-purple-200'
                        }`}
                    >
                        {syncingLayeredAssistants ? (
                            <IconLoader2 size={18} className="animate-spin" />
                        ) : (
                            <IconGitBranch size={18} />
                        )}
                        <span>{syncingLayeredAssistants ? 'Loading Layered…' : 'Layered Assistants'}</span>
                    </button>
                </div>

                {/* Close button positioned to the right, avoiding user modal area */}
                <button
                    onClick={() => homeDispatch({ field: 'page', value: 'chat' })}
                    className="absolute left-6 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
                    title="Close Assistant Gallery"
                >
                    <IconX size={18} />
                </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
                {activeAssistantGalleryTab === 'group' && <GroupAssistantsGallery />}
                {activeAssistantGalleryTab === 'individual' && <IndividualAssistantsGallery />}
                {activeAssistantGalleryTab === 'templates' && <PromptTemplatesGallery />}
                {activeAssistantGalleryTab === 'layered' && <LayeredAssistantsGallery />}
            </div>
        </div>
    );
};
