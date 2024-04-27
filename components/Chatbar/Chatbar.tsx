import { useCallback, useContext, useEffect } from 'react';

import { useTranslation } from 'next-i18next';

import { useCreateReducer } from '@/hooks/useCreateReducer';

import { DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE } from '@/utils/app/const';
import { saveConversation, saveConversations } from '@/utils/app/conversation';
import { saveFolders } from '@/utils/app/folders';
import { exportData, importData } from '@/utils/app/importExport';

import { Conversation } from '@/types/chat';
import { LatestExportFormat, SupportedExportFormats } from '@/types/export';
import { OpenAIModelID, OpenAIModels, fallbackModelID } from '@/types/openai';
import { PluginKey } from '@/types/plugin';

import HomeContext from '@/pages/api/home/home.context';

import { ChatFolders } from './components/ChatFolders';
import { RAG } from './components/RAG';
import { Conversations } from './components/Conversations';

import Sidebar from '../Sidebar';
import ChatbarContext from './Chatbar.context';
import { ChatbarInitialState, initialState } from './Chatbar.state';

import { v4 as uuidv4 } from 'uuid';
import {FolderInterface} from "@/types/folder";


export const Chatbar = () => {
  const { t } = useTranslation('sidebar');

  const chatBarContextValue = useCreateReducer<ChatbarInitialState>({
    initialState,
  });

  const {
    state: { conversations, showChatbar, defaultModelId, folders, pluginKeys, statsService},
    dispatch: homeDispatch,
    handleCreateFolder,
    handleNewConversation,
    handleUpdateConversation,
  } = useContext(HomeContext);

  const {
    state: { searchTerm, filteredConversations },
    dispatch: chatDispatch,
  } = chatBarContextValue;


  const handleApiKeyChange = useCallback(
    (apiKey: string) => {

    },
    [homeDispatch],
  );

  const handleShareFolder = (folder: FolderInterface) => {

  }

  const handlePluginKeyChange = (pluginKey: PluginKey) => {

  };

  const handleClearPluginKey = (pluginKey: PluginKey) => {

  };

  const handleExportData = () => {

  };

  const handleImportConversations = (data: SupportedExportFormats) => {

  };

  const handleClearConversations = () => {

  };

  const handleDeleteConversation = (conversation: Conversation) => {
    
    const updatedConversations = conversations.filter(
      (c) => c.id !== conversation.id,
    );

    statsService.deleteConversationEvent(conversation);

    const updatedLength = updatedConversations.length;
    if (updatedLength > 0) {
    let lastConversation = updatedConversations[updatedLength - 1];
    

    let selectedConversation: Conversation = {...lastConversation};
    if (lastConversation.name !== 'New Conversation' && (conversation.name !== 'New Conversation')) { // handle if you delete this new conversation 
      const defaultModelId =
          (process.env.DEFAULT_MODEL &&
              Object.values(OpenAIModelID).includes(
                  process.env.DEFAULT_MODEL as OpenAIModelID,
              ) &&
              process.env.DEFAULT_MODEL) ||
          fallbackModelID;
      
      const date = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const json_folders = JSON.parse(localStorage.getItem('folders') || '[]')

      // See if there is a folder with the same name as the date
      let folder = json_folders.find((f: FolderInterface) => f.name === date);
      console.log("handleNewConversation", { date, folder });
      if (!folder) {
          folder = handleCreateFolder(date, "chat");
      }
      
      const newConversation: Conversation = {
        id: uuidv4(),
        name: t('New Conversation'),
        messages: [],
        model: lastConversation?.model ?? OpenAIModels[defaultModelId as OpenAIModelID],
        prompt: DEFAULT_SYSTEM_PROMPT,
        temperature: lastConversation?.temperature ?? DEFAULT_TEMPERATURE,
        folderId: folder.id,
        promptTemplate: null
      };
      updatedConversations.push(newConversation)
      selectedConversation = {...newConversation}
    }

    localStorage.setItem('selectedConversation', JSON.stringify(selectedConversation))
    homeDispatch({ field: 'selectedConversation', value: selectedConversation});

    } else {
      defaultModelId &&
      homeDispatch({
          field: 'selectedConversation',
          value: {
              id: uuidv4(),
              name: t('New Conversation'),
              messages: [],
              model: conversation.model,
              prompt: DEFAULT_SYSTEM_PROMPT,
              temperature: conversation.temperature,
              folderId: null,
          },
      });

      localStorage.removeItem('selectedConversation');
  }

    

    homeDispatch({ field: 'conversations', value: updatedConversations });
    
    chatDispatch({ field: 'searchTerm', value: '' });
    saveConversations(updatedConversations);
  };

  const handleToggleChatbar = () => {
    homeDispatch({ field: 'showChatbar', value: !showChatbar });
    localStorage.setItem('showChatbar', JSON.stringify(!showChatbar));
  };

  const handleDrop = (e: any) => {
    if (e.dataTransfer) {
      const conversation = JSON.parse(e.dataTransfer.getData('conversation'));
      handleUpdateConversation(conversation, { key: 'folderId', value: 0 });
      chatDispatch({ field: 'searchTerm', value: '' });
      e.target.style.background = 'none';
    }
  };

  useEffect(() => {

    statsService.openConversationsEvent();

    if (searchTerm) {

      statsService.searchConversationsEvent(searchTerm);

      const results = conversations.filter((conversation) => {
        const searchable =
            conversation.name.toLocaleLowerCase() +
            ' ' +
            conversation.messages.map((message) => message.content).join(' ');
        return searchable.toLowerCase().includes(searchTerm.toLowerCase());
      });

      chatDispatch({
        field: 'filteredConversations',
        value: results,}
      );
    } else {

      chatDispatch({
        field: 'filteredConversations',
        value: conversations,
      });
    }
  }, [searchTerm, conversations]);

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
        handleShareFolder,
      }}
    >
      <Sidebar<Conversation>
        side={'left'}
        isOpen={showChatbar}
        addItemButtonTitle={t('New Chat')}
        itemComponent={<Conversations conversations={filteredConversations} />}
        folderComponent={<ChatFolders searchTerm={searchTerm} conversations={filteredConversations}/>}
        items={filteredConversations}
        searchTerm={searchTerm}
        handleSearchTerm={(searchTerm: string) =>
          chatDispatch({ field: 'searchTerm', value: searchTerm })
        }
        toggleOpen={handleToggleChatbar}
        handleCreateItem={() => {
          handleNewConversation({})}}
        handleCreateFolder={() => {
          const name = window.prompt("Folder name:");
          handleCreateFolder(name || "New Folder", 'chat')
        }}
        handleDrop={handleDrop}
        footerComponent={
          <>

          </>
        }
      />
    </ChatbarContext.Provider>
  );
};
