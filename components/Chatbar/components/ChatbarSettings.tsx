import { IconFileExport, IconPuzzle, IconBinaryTree2, IconApps, IconSettings, IconHelp, IconCloud, IconRobot, IconUser, IconSettingsBolt, IconDeviceSdCard, IconTools, IconAlarm, IconUsers } from '@tabler/icons-react';
import { useContext, useEffect, useRef, useState } from 'react';


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

export const ChatbarSettings = () => {
    const { t } = useTranslation('sidebar');
    const [isMemoryDialogOpen, setIsMemoryDialogOpen] = useState(false);
    const [isPyFunctionApiOpen, setIsPyFunctionApiOpen] = useState(false);
    const [isWorkflowBuilderOpen, setIsWorkflowBuilderOpen] = useState(false);
    const [isScheduledTasksOpen, setIsScheduledTasksOpen] = useState(false);

    const {
        state: { featureFlags, syncingPrompts,  },
        dispatch: homeDispatch, setLoadingMessage
    } = useContext(HomeContext);

    let settingRef = useRef<Settings | null>(null);
    // prevent recalling the getSettings function
    if (settingRef.current === null) settingRef.current = getSettings(featureFlags);
    
    useEffect(() => {
        const handleFeatureFlagsEvent = (event:any) => settingRef.current = getSettings(featureFlags);
        window.addEventListener('updateFeatureSettings', handleFeatureFlagsEvent);
        return () => {
            window.removeEventListener('updateFeatureSettings', handleFeatureFlagsEvent)
        }
    }, []);

    const {
        handleClearConversations,
        handleImportConversations,
        handleExportData,
    } = useContext(ChatbarContext);

    return (
        <div className="slide-in flex flex-col items-center space-y-0 m-0 p-0 border-t dark:border-white/20 pt-1 text-sm">   

            {featureFlags.assistantAdminInterface && 
                <SidebarButton
                    disabled={syncingPrompts}
                    text={t('Assistant Group Interface')}
                    icon={<IconUsers size={19} />}
                    onClick={() => {
                        // send trigger to close side bars and open the interface 
                        window.dispatchEvent(new CustomEvent('openAstAdminInterfaceTrigger', { detail: { isOpen: true }} ));
                      
                    }}
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
                onClose={() => setIsScheduledTasksOpen(false)}
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
