import {useCallback, useContext, useEffect, useRef, useState} from 'react';

import { useTranslation } from 'next-i18next';

import { useCreateReducer } from '@/hooks/useCreateReducer';

import { DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE } from '@/utils/app/const';
import { saveFolders } from '@/utils/app/folders';
import { exportData, importData } from '@/utils/app/importExport';

import { Conversation } from '@/types/chat';
import { LatestExportFormat, SupportedExportFormats } from '@/types/export';

import HomeContext from '@/pages/api/home/home.context';

import {ChatbarSettings} from "@/components/Chatbar/components/ChatbarSettings";

import ChatbarContext from "@/components/Chatbar/Chatbar.context";
import { ChatbarInitialState, initialState } from "@/components/Chatbar/Chatbar.state";

import { v4 as uuidv4 } from 'uuid';
import {RAG} from "@/components/Chatbar/components/RAG";
import {ShareAnythingModal} from "@/components/Share/ShareAnythingModal";
import {Prompt} from "@/types/prompt";
import {FolderInterface} from "@/types/folder";
import { getIsLocalStorageSelection } from '@/utils/app/conversationStorage';
import { getFullTimestamp } from '@/utils/app/date';
import { DefaultModels } from '@/types/model';

export const SettingsBar = () => {
    const { t } = useTranslation('sidebar');

    const chatBarContextValue = useCreateReducer<ChatbarInitialState>({
        initialState,
    });


    const [isShareDialogVisible, setIsShareDialogVisible] = useState(false);
    const [sharedConversations, setSharedConversations] = useState<Conversation[]>([])
    const [sharedFolders, setSharedFolders] = useState<FolderInterface[]>([])

    const {
        state: {  conversations, prompts, folders, statsService, storageSelection},
        dispatch: homeDispatch, getDefaultModel
    } = useContext(HomeContext);

    const foldersRef = useRef(folders);

    useEffect(() => {
        foldersRef.current = folders;
    }, [folders]);

    const promptsRef = useRef(prompts);

    useEffect(() => {
        promptsRef.current = prompts;
      }, [prompts]);


    const conversationsRef = useRef(conversations);

    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);

    const {
    } = chatBarContextValue;


    const handleExportData = () => {
        exportData(conversationsRef.current, promptsRef.current, foldersRef.current);
    };

    const handleImportConversations = (data: SupportedExportFormats) => {
        const { history, folders, prompts }: LatestExportFormat = importData(data, conversationsRef.current, promptsRef.current, foldersRef.current, getDefaultModel(DefaultModels.DEFAULT));
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
        homeDispatch({
            field: 'selectedConversation',
            value: {
                id: uuidv4(),
                name: t('New Conversation'),
                messages: [],
                model: getDefaultModel(DefaultModels.DEFAULT),
                prompt: DEFAULT_SYSTEM_PROMPT,
                temperature: DEFAULT_TEMPERATURE,
                folderId: null,
                isLocal: getIsLocalStorageSelection(storageSelection),
                date: getFullTimestamp()
            },
        });

        homeDispatch({ field: 'conversations', value: [] });

        localStorage.removeItem('conversationHistory');
        localStorage.removeItem('selectedConversation');

        const updatedFolders = foldersRef.current.filter((f: FolderInterface) => f.type !== 'chat');

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
