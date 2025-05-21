import { useContext, useEffect, useRef, useState } from 'react';

import { FolderInterface, SortType } from '@/types/folder';

import HomeContext from '@/pages/api/home/home.context';

import Folder from '@/components/Folder';

import { ConversationComponent } from './Conversation';
import ChatbarContext from "@/components/Chatbar/Chatbar.context";
import {Conversation} from "@/types/chat";
import { sortFoldersByDate, sortFoldersByName } from '@/utils/app/folders';
import { IconCirclePlus, IconDotsVertical, IconCaretDown, IconCaretUp } from '@tabler/icons-react';
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

  const getArchiveNumOfDays = () => {
    const archiveNumOfDays = localStorage.getItem('archiveConversationPastNumOfDays');
    if (archiveNumOfDays) {
      return parseInt(archiveNumOfDays);
    }
    return 14;
  }

  const saveArchiveNumOfDays = (numOfDays: number) => {
    localStorage.setItem('archiveConversationPastNumOfDays', numOfDays.toString());
  }

  const { handleShareFolder } = useContext(ChatbarContext);
  const [isNullFolderHovered, setIsNullFolderHovered] = useState<boolean>(false);
  const [isShowingAllFolders, setIsShowingAllFolders] = useState<boolean>(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [archiveConversationPastNumOfDays, setArchiveConversationPastNumOfDays] = useState<number>(getArchiveNumOfDays());
  const [isArchiveMenuOpen, setIsArchiveMenuOpen] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: { target: any; }) {
        if (isArchiveMenuOpen && menuRef.current && !menuRef.current.contains(event.target)) {
            setIsArchiveMenuOpen(false);
        }
    }
    document.addEventListener('click', handleClickOutside);
    return () => {
        document.removeEventListener('click', handleClickOutside);
    };
  }, [isArchiveMenuOpen, setIsArchiveMenuOpen, menuRef]);

  const handleDrop = (e: any, folder?: FolderInterface) => {
    if (e.dataTransfer && e.dataTransfer.getData('conversation')) {
      const conversation = JSON.parse(e.dataTransfer.getData('conversation'));
      handleUpdateConversation(conversation, {
        key: 'folderId',
        value: folder && folder.id !== 'uncategorized' ? folder.id : null,
      });
    }
  };

  const renderFolderConversations = (currentFolder: FolderInterface) => {
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
    const folderComponents = folders.filter((folder:FolderInterface) => folder.type === 'chat')
                  .sort((a, b) => {
                    if (a.pinned && !b.pinned) {
                        return -1;
                    }
                    if (!a.pinned && b.pinned) {
                        return 1;
                    }
                    // If both are pinned or neither is pinned, use the original sort criteria
                    return sort === 'date' ? sortFoldersByDate(a, b) : sortFoldersByName(a, b);
                  })
                  .map((folder:FolderInterface, index:number) => (
                    <Folder
                      key={index}
                      searchTerm={searchTerm}
                      currentFolder={folder}
                      handleDrop={handleDrop}
                      folderComponent={renderFolderConversations(folder)}
                    />
                  ));

    // Add uncategorized folder at the end if there are conversations without valid folders
    const conversationsWithoutFolders = conversations.filter((conversation) => {
      // No folder assigned
      if (!conversation.folderId) return true;
      
      // Folder assigned but folder doesn't exist in current folder list
      return !folders.find((f: FolderInterface) => f.id === conversation.folderId);
    });

    if (conversationsWithoutFolders.length > 0) {
      const uncategorizedFolder: FolderInterface = {
        id: 'uncategorized',
        name: 'Uncategorized',
        type: 'chat',
        pinned: false
      };

      const renderUncategorizedConversations = () => {
        return conversationsWithoutFolders.map((conversation, index) => (
          <div key={index} id="chat" className="ml-5 gap-2 border-l pl-2">
            <ConversationComponent conversation={conversation}/>
          </div>
        ));
      };

      folderComponents.push(
        <Folder
          key="uncategorized"
          searchTerm={searchTerm}
          currentFolder={uncategorizedFolder}
          handleDrop={handleDrop}
          folderComponent={renderUncategorizedConversations()}
        />
      );
    }

    return folderComponents;
  };

  // Compute folder lists for archive functionality
  const [recentOrPinnedFolders, setRecentOrPinnedFolders] = useState<FolderInterface[]>([]);
  const [olderFolders, setOlderFolders] = useState<FolderInterface[]>([]);

  // Separate folders into recent and archived
  useEffect(() => {
    if (!searchTerm) {
      const now = new Date();
      const thresholdDate = new Date(now);
      thresholdDate.setDate(now.getDate() - archiveConversationPastNumOfDays);
      
      const recent: FolderInterface[] = [];
      const older: FolderInterface[] = [];
      
      // Sort folders into the appropriate lists
      folders.forEach(folder => { 
        if (folder.type !== 'chat') return;
        
        if (folder.pinned || folder.id === baseAgentFolder.id) {
          recent.push(folder);
          return;
        }
        // Check if folder has a date
        const folderDate = folder.date ? new Date(folder.date) : now;
        if (folderDate >= thresholdDate) {
          recent.push(folder);
        } else {
          older.push(folder);
        }
      });

      // Sort folders according to current sort setting
      const sortFunction = sort === 'date' ? sortFoldersByDate : sortFoldersByName;
      
      // Apply sorting with pinned folders at the top
      recent.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return sortFunction(a, b);
      });
      
      older.sort(sortFunction);
      
      // Save scroll position before updating
      const scrollContainer = scrollContainerRef.current;
      const scrollTop = scrollContainer?.scrollTop || 0;
      
      setRecentOrPinnedFolders(recent);
      setOlderFolders(older);
      
      // Restore scroll position after the component updates
      if (scrollContainer) {
        setTimeout(() => {
          if (scrollContainer) {
            scrollContainer.scrollTop = scrollTop;
          }
        }, 10);
      }
    }
  }, [folders, archiveConversationPastNumOfDays, searchTerm, sort]);
  
  // Reset scroll position when hiding older folders
  useEffect(() => {
    if (!isShowingAllFolders) {
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
  }, [isShowingAllFolders]);

  // Listen for archive toggle events from KebabMenu
  useEffect(() => {
    const handleToggleArchived = (event: CustomEvent) => {
      setIsShowingAllFolders(event.detail.isShowing);
    };

    const handleUpdateArchiveThreshold = (event: CustomEvent) => {
      setArchiveConversationPastNumOfDays(event.detail.threshold);
      saveArchiveNumOfDays(event.detail.threshold);
    };

    window.addEventListener('toggleArchivedFolders', handleToggleArchived as EventListener);
    window.addEventListener('updateArchiveThreshold', handleUpdateArchiveThreshold as EventListener);

    return () => {
      window.removeEventListener('toggleArchivedFolders', handleToggleArchived as EventListener);
      window.removeEventListener('updateArchiveThreshold', handleUpdateArchiveThreshold as EventListener);
    };
  }, []);
  
  // SEARCH VIEW
  const renderSearchView = () => (
    <div style={{ height: 'calc(100vh - 200px)' }}>
      <div className="h-full overflow-y-auto overflow-x-hidden">
        {displayFolders(folders.filter((folder:FolderInterface) => {
          return folder.type === 'chat' && conversations.some((conversation) => conversation.folderId === folder.id);
        }))}
      </div>
    </div>
  );

  // Archive functionality has been moved to kebab menu

  // MAIN FOLDERS VIEW
  const renderFoldersView = () => (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 290px)' }}>
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden pb-2">
        {/* Show all visible folders: always show recent/pinned, conditionally show older ones */}
        {recentOrPinnedFolders.length > 0 && displayFolders(recentOrPinnedFolders)}
        
        {/* Show archive divider if showing archived folders and there are some */}
        {isShowingAllFolders && olderFolders.length > 0 && (
          <div className="h-[1px] bg-gradient-to-r from-transparent via-neutral-200 dark:via-neutral-700 to-transparent my-2"></div>
        )}
        
        {/* Archived folders */}
        {isShowingAllFolders && olderFolders.length > 0 && displayFolders(olderFolders)}
        
        {/* Show empty state when there are no archived folders but the toggle is on */}
        {isShowingAllFolders && olderFolders.length === 0 && (
          <div className="text-center text-xs text-neutral-500 dark:text-neutral-400 py-2 mt-2">No archived folders</div>
        )}
      </div>
    </div>
  );
  
  // MAIN RENDER
  return (
    <div className="flex w-full flex-col h-full">
      {searchTerm ? (
        // Search view
        renderSearchView()
      ) : (
        // Normal folders view
        renderFoldersView()
      )}

      {/* Droppable Zone for setting folderId to null */}
      <div
        onDragEnter={() => setIsNullFolderHovered(true)}
        onDragLeave={() => setIsNullFolderHovered(false)}
        onMouseLeave={() => setIsNullFolderHovered(false)}
        className="h-[4px] mt-2"
        onDrop={(e) => handleDrop(e, undefined)} 
        onDragOver={(e) => e.preventDefault()} 
      >
        {isNullFolderHovered && <IconCirclePlus className="text-green-400" size={16}/>}
      </div>
    </div>
  );
}