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
                  })
                  .map((folder:FolderInterface, index:number) => (
                    <Folder
                      key={index}
                      searchTerm={searchTerm}
                      currentFolder={folder}
                      handleDrop={handleDrop}
                      folderComponent={ChatFolders(folder)}
                    />
                  ));
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

  // ARCHIVE BUTTON
  const renderArchiveButton = () => (
    <div className="sticky bottom-[40px] mt-2 mb-3 bg-white dark:bg-[#202123] border border-gray-200 dark:border-gray-800 rounded-lg">
      <div className="py-2 text-center relative">
        <button
          className={`enhanced-archive-toggle relative py-2.5 px-6 rounded-full text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 ${isShowingAllFolders ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-700' : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700'} transition-all duration-300 shadow-sm group overflow-hidden ${olderFolders.length === 0 ? 'opacity-75' : ''}`}
          onClick={() => {
            if (olderFolders.length > 0) {
              setIsShowingAllFolders(!isShowingAllFolders);
            }
          }}
          title={`Folders older than ${archiveConversationPastNumOfDays} days are automatically hidden. Click to toggle visibility.`}
          disabled={olderFolders.length === 0}
        >
          <span className='relative z-10 text-xs cursor-pointer flex flex-row gap-2 items-center font-medium'> 
            {olderFolders.length > 0 ? 
              `${isShowingAllFolders ? "Hide" : "Show"} Older Folders (${olderFolders.length})` : 
              "No Older Folders"}
            {!isShowingAllFolders && olderFolders.length > 0 && <IconCaretDown size={12} className="text-blue-500 transition-transform duration-300 group-hover:translate-y-[2px]" />}
            {isShowingAllFolders && olderFolders.length > 0 && <IconCaretUp size={12} className="text-blue-500 transition-transform duration-300 group-hover:-translate-y-[2px]" />}
          </span>
          <div className="absolute inset-0 bg-gradient-to-r from-blue-100/0 via-blue-200/20 to-blue-100/0 dark:from-blue-700/0 dark:via-blue-700/20 dark:to-blue-700/0 opacity-0 group-hover:opacity-100 -translate-x-full group-hover:translate-x-0 transition-all duration-700 rounded-full"></div>
        </button>
        
        <div className='right-2 absolute top-1'>
          <button
            className={`enhanced-action-button outline-none focus:outline-none p-1.5 rounded-full ${isArchiveMenuOpen ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsArchiveMenuOpen(!isArchiveMenuOpen);
            }}
            title="Configure archive settings">
            <IconDotsVertical size={16} className="flex-shrink-0 transition-colors duration-200"/>
          </button>
          {isArchiveMenuOpen && 
            <div ref={menuRef}
              className="fade-in flex flex-col items-start gap-3 p-4 ml-[-400%] absolute bg-white dark:bg-[#202123] text-neutral-900 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-600 dark:text-white z-50"
              style={{ top: '100%', pointerEvents: 'auto', minWidth: '200px' }}>
              <div className="w-full flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-blue-600 dark:text-blue-400">Folder Age Threshold</label>
              </div>
              <div className="flex flex-row items-center gap-2 w-full">
                <select 
                  className="flex-1 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-md px-3 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none text-sm transition-all duration-200"
                  value={archiveConversationPastNumOfDays}
                  onChange={(e) => {
                    const days = parseInt(e.target.value);
                    setArchiveConversationPastNumOfDays(days);
                    saveArchiveNumOfDays(days);
                  }}
                >
                  {[7, 14, 30, 60, 90].map((days) => (
                    <option key={days} value={days}>{days} days</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Folders older than this will be hidden by default. Pinned folders are always visible.  
              </p>
            </div>
          }
        </div>
      </div>
    </div>
  );

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
        // Normal folders view with archive button
        <>
          {renderFoldersView()}
          {renderArchiveButton()}
        </>
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
};