import { IconFileExport, IconPuzzle, IconDeviceSdCard, IconTools, IconAlarm, IconUsers, IconSearch } from '@tabler/icons-react';
import { useContext, useEffect, useRef, useState, useCallback } from 'react';


import { useTranslation } from 'next-i18next';

import HomeContext from '@/pages/api/home/home.context';

import { Import } from '../../Settings/Import';
import { SidebarButton } from '../../Sidebar/SidebarButton';
import ChatbarContext from '../Chatbar.context';
import toast from 'react-hot-toast';
import { getSettings } from '@/utils/app/settings';
import { MemoryDialog } from '@/components/Memory/MemoryDialog';
import { Settings } from '@/types/settings';
import { PythonFunctionModal } from '@/components/Operations/PythonFunctionModal';
import { AssistantWorkflowBuilder } from '@/components/AssistantWorkflows/AssistantWorkflowBuilder';
import { ScheduledTasks } from '@/components/Agent/ScheduledTasks';
import { ScheduledTask } from '@/types/scheduledTasks';
import { ToolApiKeysTab } from '@/components/Settings/ToolApiKeysTab';

export const ChatbarSettings = () => {
    const { t } = useTranslation('sidebar');
    const [isMemoryDialogOpen, setIsMemoryDialogOpen] = useState(false);
    const [isPyFunctionApiOpen, setIsPyFunctionApiOpen] = useState(false);
    const [isWorkflowBuilderOpen, setIsWorkflowBuilderOpen] = useState(false);
    const [isScheduledTasksOpen, setIsScheduledTasksOpen] = useState(false);
    const [isWebSearchSettingsOpen, setIsWebSearchSettingsOpen] = useState(false);
    const initTaskRef = useRef<ScheduledTask | undefined>(undefined);

    const {
        state: { featureFlags, syncingPrompts },
    } = useContext(HomeContext);

    let settingRef = useRef<Settings | null>(null);
    // prevent recalling the getSettings function
    if (settingRef.current === null) settingRef.current = getSettings(featureFlags);
    
    useEffect(() => {
        const handleFeatureFlagsEvent = (event:any) => settingRef.current = getSettings(featureFlags);
        const handleScheduledTasksEvent = (event:any) => {
            const {scheduledTask} = event.detail;
            initTaskRef.current = scheduledTask;
            setIsScheduledTasksOpen(true);
        }
        window.addEventListener('updateFeatureSettings', handleFeatureFlagsEvent);
        window.addEventListener('openScheduledTasksTrigger', handleScheduledTasksEvent);
        return () => {
            window.removeEventListener('updateFeatureSettings', handleFeatureFlagsEvent);
            window.removeEventListener('openScheduledTasksTrigger', handleScheduledTasksEvent);
        }
    }, []);

    const {
        handleClearConversations,
        handleImportConversations,
        handleExportData,
    } = useContext(ChatbarContext);

    const handleAssistantGroupInterfaceClick = useCallback(() => {
        try {
            // Dispatch the event with proper configuration
            const event = new CustomEvent('openAstAdminInterfaceTrigger', { 
                detail: { isOpen: true },
                bubbles: true,
                cancelable: true
            });
            
            window.dispatchEvent(event);
        } catch (error) {
            // console.error('Failed to dispatch openAstAdminInterfaceTrigger event:', error);
        }
    }, []);

    return (
        <div className="slide-in flex flex-col items-center space-y-0 m-0 p-0 border-t dark:border-white/20 pt-1 text-sm">   

            {featureFlags.assistantAdminInterface && 
                <SidebarButton
                    disabled={syncingPrompts}
                    text={t('Assistant Group Interface')}
                    icon={<IconUsers size={19} />}
                    onClick={handleAssistantGroupInterfaceClick}
                />
            }


            {featureFlags.createAssistantWorkflows && <> 
                <SidebarButton
                    text={t('Assistant Workflows')}
                    icon={<IconPuzzle size={20} />}
                    onClick={() => setIsWorkflowBuilderOpen(!isWorkflowBuilderOpen)}
              
                />
                <AssistantWorkflowBuilder 
                    isOpen={isWorkflowBuilderOpen} 
                    onClose={() => setIsWorkflowBuilderOpen(false)} 
                    onRegister={(template) => {}} 
            /> </> }


            {featureFlags.createPythonFunctionApis && <>
                <SidebarButton
                    text={t('Custom Function APIs')}
                    icon={<IconTools size={17} />}
                    onClick={() => setIsPyFunctionApiOpen(!isPyFunctionApiOpen)}
                />

                {isPyFunctionApiOpen && 
                <PythonFunctionModal
                    onCancel={()=>{setIsPyFunctionApiOpen(false);}}
                    onSave={()=>{}}
                    width="65%"
                />}
            </>}

            {featureFlags.scheduledTasks && <>
                <SidebarButton
                    text={t('Scheduled Tasks')}
                    icon={<IconAlarm size={19} />}
                    onClick={() => setIsScheduledTasksOpen(!isScheduledTasksOpen)}
                />
                {isScheduledTasksOpen && <ScheduledTasks
                isOpen={isScheduledTasksOpen}
                onClose={() => {
                    setIsScheduledTasksOpen(false);
                    initTaskRef.current = undefined;
                }}
                initTask={initTaskRef.current}
                 />
                }
            </>}

            {featureFlags.memory && settingRef.current?.featureOptions.includeMemory && (
                <>
                <SidebarButton
                    text={t('Memory')}
                    icon={<IconDeviceSdCard size={18} />}
                    onClick={() => setIsMemoryDialogOpen(true)}
                />
                <MemoryDialog
                    open={isMemoryDialogOpen}
                    onClose={() => setIsMemoryDialogOpen(false)}
                />
                </>
            )}

            {/* Web Search API Keys */}
            {featureFlags.webSearch && (
                <>
                    <SidebarButton
                        text={t('Web Search')}
                        icon={<IconSearch size={18} />}
                        onClick={() => setIsWebSearchSettingsOpen(true)}
                    />
                    {isWebSearchSettingsOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                            <div className="relative w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-lg bg-white dark:bg-[#343541] p-6 shadow-xl">
                                <button
                                    className="absolute top-4 right-4 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                                    onClick={() => setIsWebSearchSettingsOpen(false)}
                                >
                                    <span className="text-2xl">&times;</span>
                                </button>
                                <ToolApiKeysTab open={isWebSearchSettingsOpen} />
                            </div>
                        </div>
                    )}
                </>
            )}

            <Import onImport={handleImportConversations} />


            <SidebarButton
                text={t('Export Conversations')}
                icon={<IconFileExport size={18} />}
                onClick={() => {
                    toast("Preparing Conversation Export...");
                    handleExportData();
                }}
            />

        </div>
    );
};
