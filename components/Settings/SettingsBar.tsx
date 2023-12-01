import {useCallback, useContext, useEffect, useState} from 'react';

import { useTranslation } from 'next-i18next';

import { useCreateReducer } from '@/hooks/useCreateReducer';

import { DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE } from '@/utils/app/const';
import { saveFolders } from '@/utils/app/folders';
import { exportData, importData } from '@/utils/app/importExport';

import { Conversation } from '@/types/chat';
import { LatestExportFormat, SupportedExportFormats } from '@/types/export';
import { OpenAIModels } from '@/types/openai';
import { PluginKey } from '@/types/plugin';

import HomeContext from '@/pages/api/home/home.context';

import {ChatbarSettings} from "@/components/Chatbar/components/ChatbarSettings";


import Sidebar from '../Sidebar';
import ChatbarContext from "@/components/Chatbar/Chatbar.context";
import { ChatbarInitialState, initialState } from "@/components/Chatbar/Chatbar.state";

import { v4 as uuidv4 } from 'uuid';
import {RAG} from "@/components/Chatbar/components/RAG";
import {ShareAnythingModal} from "@/components/Share/ShareAnythingModal";
import {Prompt} from "@/types/prompt";
import {FolderInterface} from "@/types/folder";
import useStatsService from "@/services/eventService";

export const SettingsBar = () => {
    const { t } = useTranslation('sidebar');

    const chatBarContextValue = useCreateReducer<ChatbarInitialState>({
        initialState,
    });

    const statsService = useStatsService();

    const [isShareDialogVisible, setIsShareDialogVisible] = useState(false);
    const [sharedConversations, setSharedConversations] = useState<Conversation[]>([])
    const [sharedFolders, setSharedFolders] = useState<FolderInterface[]>([])

    const {
        state: {  defaultModelId, folders, pluginKeys },
        dispatch: homeDispatch,
    } = useContext(HomeContext);

    const {
        dispatch: chatDispatch,
    } = chatBarContextValue;

    useEffect(() => {
        statsService.openSettingsEvent();
    },[]);

    const handleApiKeyChange = useCallback(
        (apiKey: string) => {
            homeDispatch({ field: 'apiKey', value: apiKey });

            localStorage.setItem('apiKey', apiKey);
        },
        [homeDispatch],
    );

    const handlePluginKeyChange = (pluginKey: PluginKey) => {
        if (pluginKeys.some((key) => key.pluginId === pluginKey.pluginId)) {
            const updatedPluginKeys = pluginKeys.map((key) => {
                if (key.pluginId === pluginKey.pluginId) {
                    return pluginKey;
                }

                return key;
            });

            homeDispatch({ field: 'pluginKeys', value: updatedPluginKeys });

            localStorage.setItem('pluginKeys', JSON.stringify(updatedPluginKeys));
        } else {
            homeDispatch({ field: 'pluginKeys', value: [...pluginKeys, pluginKey] });

            localStorage.setItem(
                'pluginKeys',
                JSON.stringify([...pluginKeys, pluginKey]),
            );
        }
    };

    const handleClearPluginKey = (pluginKey: PluginKey) => {
        const updatedPluginKeys = pluginKeys.filter(
            (key) => key.pluginId !== pluginKey.pluginId,
        );

        if (updatedPluginKeys.length === 0) {
            homeDispatch({ field: 'pluginKeys', value: [] });
            localStorage.removeItem('pluginKeys');
            return;
        }

        homeDispatch({ field: 'pluginKeys', value: updatedPluginKeys });

        localStorage.setItem('pluginKeys', JSON.stringify(updatedPluginKeys));
    };

    const handleExportData = () => {
        exportData();
    };

    const handleImportConversations = (data: SupportedExportFormats) => {
        const { history, folders, prompts }: LatestExportFormat = importData(data);
        homeDispatch({ field: 'conversations', value: history });
        homeDispatch({
            field: 'selectedConversation',
            value: history[history.length - 1],
        });
        homeDispatch({ field: 'folders', value: folders });
        homeDispatch({ field: 'prompts', value: prompts });

        window.location.reload();
    };

    const handleClearConversations = () => {
        defaultModelId &&
        homeDispatch({
            field: 'selectedConversation',
            value: {
                id: uuidv4(),
                name: t('New Conversation'),
                messages: [],
                model: OpenAIModels[defaultModelId],
                prompt: DEFAULT_SYSTEM_PROMPT,
                temperature: DEFAULT_TEMPERATURE,
                folderId: null,
            },
        });

        homeDispatch({ field: 'conversations', value: [] });

        localStorage.removeItem('conversationHistory');
        localStorage.removeItem('selectedConversation');

        const updatedFolders = folders.filter((f) => f.type !== 'chat');

        homeDispatch({ field: 'folders', value: updatedFolders });
        saveFolders(updatedFolders);
    };

    const handleDeleteConversation = (conversation: Conversation) => {

    }

    const handleShareFolder = (folder: any) => {
        setSharedFolders([folder]);
        setIsShareDialogVisible(true);
    }

    return (
        <ChatbarContext.Provider
            value={{
                ...chatBarContextValue,
                handleDeleteConversation,
                handleClearConversations,
                handleImportConversations,
                handleExportData,
                handlePluginKeyChange,
                handleClearPluginKey,
                handleApiKeyChange,
                handleShareFolder
            }}
        >
            <ShareAnythingModal
                open={isShareDialogVisible}
                onCancel={()=>{setIsShareDialogVisible(false)}}
                onShare={()=>{
                    setIsShareDialogVisible(false);
                }}
                includePrompts={true}
                includeConversations={true}
                includeFolders={true}
                selectedConversations={sharedConversations}
                selectedFolders={sharedFolders}
            />

            <ChatbarSettings />
            {/*<RAG />*/}
        </ChatbarContext.Provider>
    );
};
