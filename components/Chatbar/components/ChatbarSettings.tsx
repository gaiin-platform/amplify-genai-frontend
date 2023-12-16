import { IconFileExport, IconSettings, IconHelp } from '@tabler/icons-react';
import { useContext, useState } from 'react';

import { useTranslation } from 'next-i18next';

import HomeContext from '@/pages/api/home/home.context';

import { SettingDialog } from '@/components/Settings/SettingDialog';

import { Import } from '../../Settings/Import';
import { Key } from '../../Settings/Key';
import { SidebarButton } from '../../Sidebar/SidebarButton';
import ChatbarContext from '../Chatbar.context';


export const ChatbarSettings = () => {
    const { t } = useTranslation('sidebar');
    const [isSettingDialogOpen, setIsSettingDialog] = useState<boolean>(false);

    const {
        state: {
            apiKey,
            lightMode,
            serverSideApiKeyIsSet,
            serverSidePluginKeysSet,
            conversations,
        },
        dispatch: homeDispatch,
    } = useContext(HomeContext);

    const {
        handleClearConversations,
        handleImportConversations,
        handleExportData,
        handleApiKeyChange,
    } = useContext(ChatbarContext);

    return (
        <div className="flex flex-col items-center space-y-0 m-0 p-0 border-t dark:border-white/20 pt-1 text-sm">
            {/*{conversations.length > 0 ? (*/}
            {/*    <ClearConversations onClearConversations={handleClearConversations}/>*/}
            {/*) : null}*/}

            <Import onImport={handleImportConversations} />

            {/*<ImportFromUrl onImport={handleImportConversations}/>*/}


            <SidebarButton
                text={t('Export Conversations')}
                icon={<IconFileExport size={18} />}
                onClick={() => handleExportData()}
            />

            <SidebarButton
                text={t('Theme')}
                icon={<IconSettings size={18} />}
                onClick={() => {
                    //statsService.setThemeEvent();
                    setIsSettingDialog(true)
                }}
            />

            <SidebarButton
                text={t('Send Feedback')}
                icon={<IconHelp size={18} />}
                onClick={() => window.location.href = 'mailto:amplify@vanderbilt.edu'}
            />

            {!serverSideApiKeyIsSet ? (
                <Key apiKey={apiKey} onApiKeyChange={handleApiKeyChange} />
            ) : null}

            {/*{!serverSidePluginKeysSet ? <PluginKeys /> : null}*/}

            <SettingDialog
                open={isSettingDialogOpen}
                onClose={() => {
                    setIsSettingDialog(false);
                }}
            />

        </div>
    );
};
