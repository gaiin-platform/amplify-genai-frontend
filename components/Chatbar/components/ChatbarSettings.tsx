import { IconFileExport, IconPuzzle, IconDeviceSdCard, IconTools, IconAlarm, IconUsers, IconSearch, IconBook, IconBrain } from '@tabler/icons-react';
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
import { SkillsLibrary } from '@/components/Skills';
import { Modal } from '@/components/ReusableComponents/Modal';

export const ChatbarSettings = () => {
    const { t } = useTranslation('sidebar');
    const [isMemoryDialogOpen, setIsMemoryDialogOpen] = useState(false);
    const [isPyFunctionApiOpen, setIsPyFunctionApiOpen] = useState(false);
    const [isWorkflowBuilderOpen, setIsWorkflowBuilderOpen] = useState(false);
    const [isScheduledTasksOpen, setIsScheduledTasksOpen] = useState(false);
    const [isSkillsLibraryOpen, setIsSkillsLibraryOpen] = useState(false);
    const initTaskRef = useRef<ScheduledTask | undefined>(undefined);

    const {
        state: { featureFlags, syncingPrompts, canAddWebSearchApiKey, userDocumentationUrl, chatEndpoint },
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

            {/* Skills Library */}
            {featureFlags.skills && (
                <>
                <SidebarButton
                    text={t('Skills')}
                    icon={<IconBrain size={18} />}
                    onClick={() => setIsSkillsLibraryOpen(true)}
                />
                {isSkillsLibraryOpen && chatEndpoint && (
                    <Modal
                        title="Skills Library"
                        onCancel={() => setIsSkillsLibraryOpen(false)}
                        showCancel={false}
                        showSubmit={false}
                        content={
                            <SkillsLibrary chatEndpoint={chatEndpoint} onClose={() => setIsSkillsLibraryOpen(false)} />
                        }
                    />
                )}
                </>
            )}

            {/* Web Search API Keys */}
            {featureFlags.webSearch && canAddWebSearchApiKey &&(
                <SidebarButton
                    text={t('Web Search')}
                    icon={<IconSearch size={18} />}
                    onClick={() => {
                        window.dispatchEvent(new CustomEvent('openSettingsTrigger', {
                            detail: { openToTab: "Integrations:Web Search" }
                        }));
                    }}
                />
            )}

            {/* User Documentation */}
            {featureFlags.userDocumentation && userDocumentationUrl && (
                <SidebarButton
                    text={t('Documentation')}
                    icon={<IconBook size={18} />}
                    onClick={() => {
                        window.open(userDocumentationUrl, '_blank', 'noopener,noreferrer');
                    }}
                />
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
