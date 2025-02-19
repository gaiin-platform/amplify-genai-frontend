import { useContext, useEffect, useRef, useState } from 'react';

import { FolderInterface, SortType } from '@/types/folder';

import HomeContext from '@/pages/api/home/home.context';

import Folder from '@/components/Folder';

import { ConversationComponent } from './Conversation';
import ChatbarContext from "@/components/Chatbar/Chatbar.context";
import {Conversation} from "@/types/chat";
import { sortFoldersByDate, sortFoldersByName } from '@/utils/app/folders';
import { IconCirclePlus } from '@tabler/icons-react';

interface Props {
  sort: SortType
  searchTerm: string;
  conversations: Conversation[];
}

export const ChatFolders = ({ sort, searchTerm, conversations }: Props) => {
  const {
    state: { folders },
    handleUpdateConversation,
  } = useContext(HomeContext);

  const foldersRef = useRef(folders);

  useEffect(() => {
      foldersRef.current = folders;
  }, [folders]);

  const { handleShareFolder } = useContext(ChatbarContext);
  const [isNullFolderHovered, setIsNullFolderHovered] = useState<boolean>(false);

    const filteredFolders = searchTerm ?
          folders.filter((folder:FolderInterface) => {
            return conversations.some((conversation) => conversation.folderId === folder.id)
          }) : folders;


  const handleDrop = (e: any, folder?: FolderInterface) => {
    if (e.dataTransfer && e.dataTransfer.getData('conversation')) {
      const conversation = JSON.parse(e.dataTransfer.getData('conversation'));
      handleUpdateConversation(conversation, {
        key: 'folderId',
        value: folder ? folder.id : null,
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
        .filter((folder:FolderInterface) => folder.type === 'chat')
        .sort((a, b) => {
          if (a.pinned && !b.pinned) {
              return -1;
          }
          if (!a.pinned && b.pinned) {
              return 1;
          }
          // If both are pinned or neither is pinned, use the original sort criteria
          return sort === 'date' ? sortFoldersByDate(a, b) : sortFoldersByName(a, b);
        })// currently doing this since folders have been created without the new date attribute.   
        .map((folder:FolderInterface, index:number) => (
          <Folder
            key={index}
            searchTerm={searchTerm}
            currentFolder={folder}
            handleDrop={handleDrop}
            folderComponent={ChatFolders(folder)}
          />
        ))}

        {/* Droppable Zone for setting folderId to null */}
      <div
        onDragEnter={() => setIsNullFolderHovered(true)}
        onDragLeave={() => setIsNullFolderHovered(false)}
        onMouseLeave={() => setIsNullFolderHovered(false)}

        className="h-[4px]" style={{transform: "translateY(6px)"}}
        onDrop={(e) => handleDrop(e, undefined)} 
        onDragOver={(e) => e.preventDefault()} 
      >
          {isNullFolderHovered &&  <IconCirclePlus className="text-green-400" size={16}/>}
      </div>

    
    </div>
  );
};
