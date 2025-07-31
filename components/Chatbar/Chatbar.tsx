import { useContext, useEffect, useRef, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { useCreateReducer } from '@/hooks/useCreateReducer';

import { DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE } from '@/utils/app/const';
import { saveConversations, isLocalConversation, isRemoteConversation, deleteConversationCleanUp } from '@/utils/app/conversation';

import { Conversation } from '@/types/chat';
import { SupportedExportFormats } from '@/types/export';

import HomeContext from '@/pages/api/home/home.context';

import { ChatFolders } from './components/ChatFolders';
import { Conversations } from './components/Conversations';

import ChatbarContext from './Chatbar.context';
import { ChatbarInitialState, initialState } from './Chatbar.state';

import { v4 as uuidv4 } from 'uuid';
import {FolderInterface, SortType} from "@/types/folder";
import { getIsLocalStorageSelection } from '@/utils/app/conversationStorage';
import { deleteRemoteConversation } from '@/services/remoteConversationService';
import { uncompressMessages } from '@/utils/app/messages';
import { getFullTimestamp, getDateName } from '@/utils/app/date';
import React from 'react';
import Sidebar from '../Sidebar/Sidebar';
import { DefaultModels } from '@/types/model';
import { getArchiveNumOfDays } from '@/utils/app/folders';


export const Chatbar = () => {
  const { t } = useTranslation('sidebar');

  const chatBarContextValue = useCreateReducer<ChatbarInitialState>({
    initialState,
  });

  const {
    state: { conversations, showChatbar, statsService, folders, storageSelection},
    dispatch: homeDispatch,
    handleCreateFolder,
    handleNewConversation,
    handleUpdateConversation,
    handleSelectConversation,
    getDefaultModel
  } = useContext(HomeContext);

  const conversationsRef = useRef(conversations);

  useEffect(() => {
      conversationsRef.current = conversations;
  }, [conversations]);

  const foldersRef = useRef(folders);

  useEffect(() => {
      foldersRef.current = folders;
  }, [folders]);

  const {
    state: { searchTerm, filteredConversations },
    dispatch: chatDispatch,
  } = chatBarContextValue;


  const sortBy = localStorage?.getItem('chatFolderSort');
  const [folderSort, setFolderSort] = useState<SortType>(sortBy ? sortBy as SortType : 'date');

  useEffect(() => {
    localStorage.setItem('chatFolderSort', folderSort);
  }, [folderSort]);


  const handleShareFolder = (folder: FolderInterface) => {

  }

  const handleExportData = () => {

  };

  const handleImportConversations = (data: SupportedExportFormats) => {

  };

  const handleClearConversations = () => {

  };

  const handleDeleteConversation = (conversation: Conversation) => {
    deleteConversationCleanUp(conversation);
    
    const updatedConversations = conversationsRef.current.filter(
      (c: Conversation) => c.id !== conversation.id,
    );

    statsService.deleteConversationEvent(conversation);

    const updatedLength = updatedConversations.length;
    if (updatedLength > 0) {
      let lastConversation = updatedConversations[updatedLength - 1];
      

      let selectedConversation: Conversation = {...lastConversation};
      if (lastConversation.name !== 'New Conversation' && (conversation.name !== 'New Conversation')) { // handle if you delete this new conversation 
        
        const date = getDateName();

        // See if there is a folder with the same name as the date
        let folder = foldersRef.current.find((f: FolderInterface) => f.name === date);
        if (!folder) {
            folder = handleCreateFolder(date, "chat");
        }

        const newConversation: Conversation = {
          id: uuidv4(),
          name: t('New Conversation'),
          messages: [],
          model: lastConversation?.model ?? getDefaultModel(DefaultModels.DEFAULT),
          prompt: DEFAULT_SYSTEM_PROMPT,
          temperature: lastConversation?.temperature ?? DEFAULT_TEMPERATURE,
          folderId: folder.id,
          promptTemplate: null,
          date: getFullTimestamp()
        };
        updatedConversations.push(newConversation)
        selectedConversation = {...newConversation}
        
      }
      handleSelectConversation(selectedConversation);

    } else {
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
              isLocal: getIsLocalStorageSelection(storageSelection),
              date: getFullTimestamp()
          },
      });

      localStorage.removeItem('selectedConversation');
  }

    homeDispatch({ field: 'conversations', value: updatedConversations });
    saveConversations(updatedConversations);
    chatDispatch({ field: 'searchTerm', value: '' });
    
  };

  const handleToggleChatbar = () => {
    homeDispatch({ field: 'showChatbar', value: !showChatbar });
    localStorage.setItem('showChatbar', JSON.stringify(!showChatbar));
  };

  const handleDrop = (e: any) => {
    if (e.dataTransfer && e.dataTransfer.getData('conversation')) {
      const conversation = JSON.parse(e.dataTransfer.getData('conversation'));
      handleUpdateConversation(conversation, { key: 'folderId', value: 0 });
      chatDispatch({ field: 'searchTerm', value: '' });
      e.target.style.background = 'none';
    }
  };

  useEffect(() => {

    if (searchTerm) {

      statsService.searchConversationsEvent(searchTerm);

      const results = conversations.filter((conversation:Conversation) => {
        let messages = '';
        if (isLocalConversation(conversation)) {
          //uncompress messages 
          const uncompressedMs = uncompressMessages(conversation.compressedMessages?? []);
          if (uncompressedMs) messages = uncompressedMs.map((message) => message.content).join(' ');
        }
        // remote messages are currently unsearchable NOTE
        const searchable =
            conversation.name.toLocaleLowerCase() +  ' ' + messages
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

  const conversationsWithNoFolders = () => {
    return filteredConversations.filter((conversation) => !conversation.folderId || 
             !foldersRef.current.find((f: FolderInterface) => f.id === conversation.folderId));
  }

  // Archive indicator component
  const ArchiveIndicator = () => {
    const [archiveDays, setArchiveDays] = useState(getArchiveNumOfDays());
    
    // console.log('ArchiveIndicator rendering, archiveDays:', archiveDays);
    
    useEffect(() => {
      const handleArchiveUpdate = (event: CustomEvent) => {
        setArchiveDays(event.detail.threshold);
      };
      
      window.addEventListener('updateArchiveThreshold', handleArchiveUpdate as EventListener);
      return () => window.removeEventListener('updateArchiveThreshold', handleArchiveUpdate as EventListener);
    }, []);

    const handleClick = () => {
      console.log('ArchiveIndicator clicked - opening kebab menu to Folders > Archive');
      // Dispatch event to open kebab menu with specific navigation
      window.dispatchEvent(new CustomEvent('openKebabMenu', { 
        detail: { 
          section: 'Folders', 
          subsection: 'Archive',
        } 
      }));
    };

    if (archiveDays <= 0) return null;

    return (
      <div 
        onClick={handleClick}
        title="Click to manage archive settings (Kebab Menu → Folders → Archive)"
        className="border-t border-b border-neutral-300 dark:border-neutral-600 py-1 px-3 cursor-pointer hover:opacity-80 transition-colors"
      >
        <div className="text-xs text-gray-500 dark:text-gray-500 text-center">
          Conversations past {archiveDays} days are archived
        </div>
      </div>
    );
  };

  return (
    <ChatbarContext.Provider
      value={{
        ...chatBarContextValue,
        handleDeleteConversation,
        handleClearConversations,
        handleImportConversations,
        handleExportData,
        handleShareFolder,
      }}
    >
      <Sidebar<Conversation>
        side={'left'}
        isOpen={showChatbar}
        addItemButtonTitle={t('New Chat')}
        itemComponent={<Conversations conversations={conversationsWithNoFolders()} />}
        folderComponent={<ChatFolders sort={folderSort} searchTerm={searchTerm} conversations={filteredConversations} />}
        items={filteredConversations}
        searchTerm={searchTerm}
        handleSearchTerm={(searchTerm: string) => chatDispatch({ field: 'searchTerm', value: searchTerm })}
        handleCreateItem={() => {
          window.dispatchEvent(new CustomEvent('openArtifactsTrigger', { detail: { isOpen: false}} ));
          handleNewConversation({});
        } }
        handleCreateFolder={() => {
          const name = window.prompt("Folder name:");
          handleCreateFolder(name || "New Folder", 'chat');
        } }
        handleDrop={handleDrop}
        footerComponent={<ArchiveIndicator />} 
        handleCreateAssistantItem={() => {}} 
        setFolderSort={setFolderSort} 
        />
    </ChatbarContext.Provider>
  );
};
