import { useContext, useEffect, useRef, useState } from 'react';

import { FolderInterface, SortType } from '@/types/folder';

import HomeContext from '@/pages/api/home/home.context';

import Folder from '@/components/Folder';

import { ConversationComponent } from './Conversation';
import ChatbarContext from "@/components/Chatbar/Chatbar.context";
import {Conversation} from "@/types/chat";
import { sortFoldersByDate, sortFoldersByName } from '@/utils/app/folders';
import { IconCirclePlus, IconDotsVertical } from '@tabler/icons-react';
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

       <div className={`relative text-center ${isShowingAllFolders ? "border-y pb-3 mb-1" : "border-t"} border-gray-200 dark:border-white/20`}
       title={"Folders older than 10 days are archived. Click the pin icon on any folder to move it to the top of the conversations list."}>
        <button
          className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
          onClick={() => setIsShowingAllFolders(!isShowingAllFolders)}
        >
         
          {<label className='text-xs cursor-pointer flex flex-row gap-2 items-center'
                  style = {{transform: "translateY(4px)"}}> 
            { `${isShowingAllFolders ?  "Hide" : "Show"} Archived Folders`}</label>}
        </button>

        <div className='right-2 absolute top-1'>
        <button
            className={`outline-none focus:outline-none p-0.5 ${isArchiveMenuOpen ? 'bg-neutral-200 dark:bg-[#343541]/90' : ''}`}
            onClick={(e) => {
                e.stopPropagation();
                setIsArchiveMenuOpen(!isArchiveMenuOpen);
            }}>
            <IconDotsVertical size={20} className="flex-shrink-0 text-neutral-500 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100"/>
        </button>
        {isArchiveMenuOpen && 
            <div ref={menuRef}
                className="flex flex-col items-center gap-2 p-2 ml-[-400%] absolute bg-neutral-100 dark:bg-[#202123] text-neutral-900 rounded border border-neutral-200 dark:border-neutral-600 dark:text-white z-50"
                style={{ top: '90%', pointerEvents: 'auto' }}>
                 
                  <label className="w-[102px] text-xs font-medium">Archive folders older than:</label>
                  <div className="flex flex-row items-center gap-2 mb-1">
                    <select 
                      className="bg-transparent border border-neutral-300 dark:border-neutral-600 rounded px-1"
                      value={archiveConversationPastNumOfDays}
                      onChange={(e) => {
                        const days = parseInt(e.target.value);
                        setArchiveConversationPastNumOfDays(days);
                        saveArchiveNumOfDays(days);
                      
                      }}
                    >
                      {[7, 14, 30, 60, 90].map((days) => (
                        <option key={days} value={days}>{days}</option>
                      ))}
                    </select>
                    <label className="text-xs font-medium">days</label>
                  </div>
            </div>
        }

        </div>
       
       </div>
      
       {isShowingAllFolders && displayFolders(olderFolders)}

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
