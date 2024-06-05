import { useContext } from 'react';

import { FolderInterface, SortType } from '@/types/folder';

import HomeContext from '@/pages/api/home/home.context';

import Folder from '@/components/Folder';

import { ConversationComponent } from './Conversation';
import ChatbarContext from "@/components/Chatbar/Chatbar.context";
import {Conversation} from "@/types/chat";
import { sortFoldersByDate, sortFoldersByName } from '@/utils/app/folders';

interface Props {
  sort: SortType
  searchTerm: string;
  conversations: Conversation[];
}

export const ChatFolders = ({ sort, searchTerm, conversations }: Props) => {
  const {
    state: { folders, selectedConversation},
    handleUpdateConversation,
  } = useContext(HomeContext);

  const { handleShareFolder } = useContext(ChatbarContext);


    const filteredFolders = searchTerm ?
        folders.filter((folder:FolderInterface) => {
          return conversations.some((conversation) => conversation.folderId === folder.id);
        }) :
        folders;




  const handleDrop = (e: any, folder: FolderInterface) => {
    if (e.dataTransfer) {
      const conversation = JSON.parse(e.dataTransfer.getData('conversation'));
      handleUpdateConversation(conversation, {
        key: 'folderId',
        value: folder.id,
      });
    }
  };

  const ChatFolders = (currentFolder: FolderInterface) => {
    return (
      conversations &&
      conversations
        .filter((conversation) => conversation.folderId && conversation.folderId === currentFolder.id)
        .map((conversation, index) => {
            return (
              <div key={index} className="ml-5 gap-2 border-l pl-2">
                <ConversationComponent conversation={conversation}/>
              </div>
            );
        })
    );
  };


  return (
    <div className="flex w-full flex-col">
      {filteredFolders
        .filter((folder) => folder.type === 'chat')
        .sort(sort === 'date' ? sortFoldersByDate : sortFoldersByName) // currently doing this since folders have been created without the new date attribute. 
        .map((folder, index) => (
          <Folder
            key={index}
            searchTerm={searchTerm}
            currentFolder={folder}
            handleDrop={handleDrop}
            folderComponent={ChatFolders(folder)}
          />
        ))}
    </div>
  );
};
