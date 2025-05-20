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

  const displayFolders = (folders:FolderInterface[], isArchived = false) => {
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
                    <div key={index} className={isArchived ? 'opacity-80 hover:opacity-100 transition-opacity duration-200' : ''}>
                      <Folder
                        key={index}
                        searchTerm={searchTerm}
                        currentFolder={folder}
                        handleDrop={handleDrop}
                        folderComponent={ChatFolders(folder)}
                      />
                    </div>
                  ))
  }

  const oragnizeFolders = (folders: FolderInterface[]) => {
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

    return (
      <div>
       {displayFolders(recentOrPinnedFolders)}

       <div className={`enhanced-archive-section relative text-center my-3 ${isShowingAllFolders ? "pb-4" : ""} after:content-[''] after:absolute after:left-0 after:right-0 after:h-[1px] after:bg-gradient-to-r after:from-transparent after:via-neutral-300 after:dark:via-neutral-600 after:to-transparent after:top-1/2 after:-translate-y-1/2 after:-z-10`}
       title={`Folders older than ${archiveConversationPastNumOfDays} days are archived. Click the pin icon on any folder to move it to the top of the conversations list.`}>
        <button
          className={`enhanced-archive-toggle relative py-1.5 px-5 rounded-full text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 ${isShowingAllFolders ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-700' : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700'} transition-all duration-300 shadow-sm group overflow-hidden`}
          onClick={() => setIsShowingAllFolders(!isShowingAllFolders)}
        >
          <span className='relative z-10 text-xs cursor-pointer flex flex-row gap-2 items-center font-medium'> 
            { `${isShowingAllFolders ?  "Hide" : "Show"} Archived Folders`}
            {!isShowingAllFolders && <IconCaretDown size={12} className="text-blue-500 transition-transform duration-300 group-hover:translate-y-[2px]" />}
            {isShowingAllFolders && <IconCaretUp size={12} className="text-blue-500 transition-transform duration-300 group-hover:-translate-y-[2px]" />}
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
                    <label className="text-xs font-semibold text-blue-600 dark:text-blue-400">Archive Age Threshold</label>
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
                    Folders older than this will be automatically archived. Pinned folders are never archived.  
                  </p>
            </div>
        }
        </div>
       
       </div>
      
       {isShowingAllFolders && 
        <div className="mt-2 pt-1 pb-1 px-1 rounded-lg bg-neutral-50 dark:bg-neutral-900/30">
          {displayFolders(olderFolders, true)}
        </div>
       }

      </div>
    );

  };
  
  return (
    <div className="flex w-full flex-col">
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
