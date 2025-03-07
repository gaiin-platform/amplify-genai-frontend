import { IconFileExport, IconPuzzle, IconBinaryTree2, IconApps, IconSettings, IconHelp, IconCloud, IconRobot, IconUser, IconSettingsBolt, IconDeviceSdCard } from '@tabler/icons-react';
import { useContext, useEffect, useRef, useState } from 'react';


import { useTranslation } from 'next-i18next';

import HomeContext from '@/pages/api/home/home.context';

import { SettingDialog } from '@/components/Settings/SettingDialog';

import { Import } from '../../Settings/Import';
import { SidebarButton } from '../../Sidebar/SidebarButton';
import ChatbarContext from '../Chatbar.context';
import {AccountDialog} from "@/components/Settings/AccountComponents/AccountDialog";
import toast from 'react-hot-toast';
import { IntegrationsDialog } from '@/components/Integrations/IntegrationsDialog';
import { getSettings } from '@/utils/app/settings';
import { MemoryDialog } from '@/components/Memory/MemoryDialog';
import { Settings } from '@/types/settings';

export const ChatbarSettings = () => {
    const { t } = useTranslation('sidebar');
    const [isSettingDialogOpen, setIsSettingDialog] = useState<boolean>(false);
    const [isAccountDialogVisible, setIsAccountDialogVisible] = useState<boolean>(false);
    const [isIntegrationsOpen, setIsIntegrationsOpen] = useState<boolean>(false);
    const [isMemoryDialogOpen, setIsMemoryDialogOpen] = useState(false);

    const {
        state: { featureFlags, supportEmail },
        dispatch: homeDispatch, setLoadingMessage
    } = useContext(HomeContext);

    let settingRef = useRef<Settings | null>(null);
    // prevent recalling the getSettings function
    if (settingRef.current === null) settingRef.current = getSettings(featureFlags);
    
    useEffect(() => {
        const handleEvent = (event:any) => settingRef.current = getSettings(featureFlags)
        window.addEventListener('updateFeatureSettings', handleEvent);
        return () => window.removeEventListener('updateFeatureSettings', handleEvent)
    }, []);

    const {
        handleClearConversations,
        handleImportConversations,
        handleExportData,
    } = useContext(ChatbarContext);

    return (
        <div className="flex flex-col items-center space-y-0 m-0 p-0 border-t dark:border-white/20 pt-1 text-sm">
            {/*{conversations.length > 0 ? (*/}
            {/*    <ClearConversations onClearConversations={handleClearConversations}/>*/}
            {/*) : null}*/}

            <SidebarButton
                text={t('Manage Accounts')}
                icon={<IconUser size={18} />}
                onClick={() => {
                    //statsService.setThemeEvent();
                    setIsAccountDialogVisible(true)
                }}
            />

            {featureFlags.adminInterface &&  
                <SidebarButton
                    text={t('Admin Interface')}
                    icon={<IconSettingsBolt size={18} />}
                    onClick={() => {
                        // send trigger to close side bars and open the interface 
                        window.dispatchEvent(new CustomEvent('openAdminInterfaceTrigger', { detail: { isOpen: true }} ));
                      
                    }}
                />
            }


            <SidebarButton
                text={t('Settings')}
                icon={<IconSettings size={18} />}
                onClick={() => {
                    //statsService.setThemeEvent();
                    setIsSettingDialog(true)
                }}
            />

            {featureFlags.assistantAdminInterface && 
                <SidebarButton
                    text={t('Assistant Interface')}
                    icon={<IconRobot size={18} />}
                    onClick={() => {
                        // send trigger to close side bars and open the interface 
                        window.dispatchEvent(new CustomEvent('openAstAdminInterfaceTrigger', { detail: { isOpen: true }} ));
                      
                    }}
                />
            }

            

            {featureFlags.integrations && 
            <SidebarButton
              text={t('Integrations')}
              icon={<IconBinaryTree2 size={18} />}
              onClick={() => setIsIntegrationsOpen(true)}
            />}

            {featureFlags.memory && settingRef.current?.featureOptions.includeMemory && (
                <SidebarButton
                    text={t('Memory')}
                    icon={<IconDeviceSdCard size={18} />}
                    onClick={() => setIsMemoryDialogOpen(true)}
                />
            )}


            <Import onImport={handleImportConversations} />

            {/*<ImportFromUrl onImport={handleImportConversations}/>*/}


            <SidebarButton
                text={t('Export Conversations')}
                icon={<IconFileExport size={18} />}
                onClick={() => {
                    toast("Preparing Conversation Export...");
                    handleExportData();
                }}
            />

            {supportEmail &&
            <SidebarButton
                text={t('Send Feedback')}
                icon={<IconHelp size={18} />}
                onClick={() => window.location.href = `mailto:${supportEmail}`}
            />}

            <IntegrationsDialog open={isIntegrationsOpen} onClose={()=>{setIsIntegrationsOpen(false)}}/>

            {isSettingDialogOpen && <SettingDialog
                open={isSettingDialogOpen}
                onClose={() => {
                    setIsSettingDialog(false);
                }}
            />}

            <AccountDialog
                open={isAccountDialogVisible}
                onClose={() => {
                    setIsAccountDialogVisible(false);
                }}
            />

            <MemoryDialog
                open={isMemoryDialogOpen}
                onClose={() => setIsMemoryDialogOpen(false)}
            />

        </div>
    );
};
