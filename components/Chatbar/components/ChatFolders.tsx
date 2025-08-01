import { useContext, useEffect, useRef, useState } from 'react';

import { FolderInterface, SortType } from '@/types/folder';

import HomeContext from '@/pages/api/home/home.context';

import Folder from '@/components/Folder';

import { ConversationComponent } from './Conversation';
import ChatbarContext from "@/components/Chatbar/Chatbar.context";
import {Conversation} from "@/types/chat";
import { getArchiveNumOfDays, sortFoldersByDate, sortFoldersByName } from '@/utils/app/folders';
import { IconCirclePlus } from '@tabler/icons-react';
import { baseAgentFolder } from '@/utils/app/basePrompts';

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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [archiveConversationPastNumOfDays, setArchiveConversationPastNumOfDays] = useState<number>(getArchiveNumOfDays());
  

    // Listen for archive toggle events from KebabMenu
    useEffect(() => {

      const handleUpdateArchiveThreshold = (event: CustomEvent) => {
        console.log("updateArchiveThreshold", event.detail.threshold);
        setArchiveConversationPastNumOfDays(event.detail.threshold);
      };
      window.addEventListener('updateArchiveThreshold', handleUpdateArchiveThreshold as EventListener);

      return () => {
        window.removeEventListener('updateArchiveThreshold', handleUpdateArchiveThreshold as EventListener);
      };
    }, []);


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
              <div key={index} id="chat" className="ml-5 gap-2 border-l pl-2">
                <ConversationComponent conversation={conversation}/>
              </div>
            );
        })
    );
  };

  const displayFolders = (folders:FolderInterface[]) => {
    return folders.filter((folder:FolderInterface) => folder.type === 'chat')
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
                  ))
  }

  const isShowingAllFolders = () => archiveConversationPastNumOfDays === 0;

  const oragnizeFolders = (folders: FolderInterface[]) => {
    if (isShowingAllFolders()) return displayFolders(folders);

    const now = new Date();
    const fiveDaysAgo = new Date(now.setDate(now.getDate() - archiveConversationPastNumOfDays));
    
    const recentOrPinnedFolders: FolderInterface[] = [];
    const olderFolders: FolderInterface[] = [];
    
    // Sort folders into the appropriate lists
    folders.forEach(folder => { 
      if (folder.pinned || folder.id === baseAgentFolder.id) {
        recentOrPinnedFolders.push(folder);
        return;
      }
      // Check if folder has a date
      const folderDate = folder.date ? new Date(folder.date) : now;
      if (folderDate >= fiveDaysAgo) {
        recentOrPinnedFolders.push(folder);
      } else {
        olderFolders.push(folder);
      }
    });

    // Save scroll position before updating
    const scrollContainer = scrollContainerRef.current;
    const scrollTop = scrollContainer?.scrollTop || 0;

    setTimeout(() => {
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollTop;
      }
    }, 250); // 250ms delay to ensure the DOM is updated


    return (<> {displayFolders(recentOrPinnedFolders)} </>);
  };

   // Reset scroll position when hiding older folders to prevent over-scrolling
   useEffect(() => {
    if (!isShowingAllFolders()) {
      const scrollContainer = scrollContainerRef.current;
      
      // Give time for the DOM to update
      setTimeout(() => {
        if (scrollContainer) {
          // Ensure we're not scrolled beyond the available content
          const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
          if (scrollContainer.scrollTop > maxScroll) {
            scrollContainer.scrollTop = Math.max(0, maxScroll);
          }
        }
      }, 50);
    }
  }, [archiveConversationPastNumOfDays]);
  
  return (
    <div ref={scrollContainerRef} className="flex w-full flex-col">
      {searchTerm ? displayFolders(folders.filter((folder:FolderInterface) => {
                      return conversations.some((conversation) => conversation.folderId === folder.id)
                    }))  : oragnizeFolders(folders) }


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
