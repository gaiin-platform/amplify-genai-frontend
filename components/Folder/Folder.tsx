import {
  IconCaretDown,
  IconCaretRight,
  IconCheck,
  IconPencil,
  IconTrash,
  IconShare,
  IconX,
  IconPin,
  IconPinFilled,
  IconEyeOff,
  IconSettingsBolt,
} from '@tabler/icons-react';
import {
  KeyboardEvent,
  ReactElement,
  useContext,
  useEffect,
  useState,
} from 'react';

import { FolderInterface } from '@/types/folder';

import HomeContext from '@/pages/api/home/home.context';

import React from 'react';
import { baseAssistantFolder, isBaseFolder } from '@/utils/app/basePrompts';
import ActionButton from '@/components/ReusableComponents/ActionButton';
import { hideGroupFolder, saveFolders } from '@/utils/app/folders';
import { Group, GroupAccessType } from '@/types/groups';
import { folder } from 'jszip';
import { useSession } from 'next-auth/react';
import { getSettings } from '@/utils/app/settings';

interface Props {
  currentFolder: FolderInterface;
  searchTerm: string;
  handleDrop: (e: any, folder: FolderInterface) => void;
  folderComponent: (ReactElement | undefined)[];
}

const Folder = ({
  currentFolder,
  searchTerm,
  handleDrop,
  folderComponent
  
}: Props) => {
  const { handleDeleteFolder, handleUpdateFolder, state: {selectedConversation, folders, allFoldersOpenPrompts, allFoldersOpenConvs, checkingItemType, checkedItems, groups, featureFlags},
          dispatch: homeDispatch,} = useContext(HomeContext);

  const { data: session } = useSession();
  const user = session?.user?.email;
  const theme = getSettings(featureFlags).theme;

  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [checkFolders, setCheckFolders] = useState(false);
  const [isChecked, setIsChecked] = useState(false);

  const canDropInto =  !currentFolder.isGroupFolder && !isBaseFolder(currentFolder.id);
  const showEditDelete = canDropInto && currentFolder.id !== baseAssistantFolder.id;
  

  const handleEnterDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRename();
    }
  };

  const handlePinFolder = (folderId: string) => {
    const updatedFolders = folders.map((f:FolderInterface) => {
        if (f.id === folderId) {
            return {...f, pinned: !f.pinned};
        }
        return f;
    });
    homeDispatch({ field: 'folders', value: updatedFolders });
    saveFolders(updatedFolders);
  };

  const handleHideGroupFolder = (folder: FolderInterface) => {
    const updatedFolders = folders.filter((f:FolderInterface) => (f.id !== folder.id));
    homeDispatch({ field: 'folders', value: updatedFolders });
    saveFolders(updatedFolders);
    hideGroupFolder(folder);
  };

  const handleRename = () => {
    handleUpdateFolder(currentFolder.id, renameValue);
    setRenameValue('');
    setIsRenaming(false);
  };

  const dropHandler = (e: any) => {
    if (e.dataTransfer) {
      setIsOpen(true);

      handleDrop(e, currentFolder);

      e.target.style.background = 'none';
    }
  };

  const allowDrop = (e: any) => {
    if (canDropInto) {
      e.preventDefault();
    } 
  };

  const highlightDrop = (e: any) => {
    if (canDropInto) e.target.style.background = theme === 'dark' ? '#343541' : '#e7e8e9';
  };

  const removeHighlight = (e: any) => {
    e.target.style.background = 'none';
  };

  useEffect(() => {
    if (isRenaming) {
      setIsDeleting(false);
    } else if (isDeleting) {
      setIsRenaming(false);
    }
  }, [isRenaming, isDeleting]);

  useEffect(() => {
    if (searchTerm) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    if (selectedConversation?.folderId === currentFolder.id) {
      setIsOpen(true);
    } 
  }, [selectedConversation, currentFolder]);

  useEffect(() => {
    if (currentFolder.type === 'chat') setIsOpen(allFoldersOpenConvs);
    if (currentFolder.type === 'prompt') setIsOpen(allFoldersOpenPrompts);
  }, [allFoldersOpenConvs, allFoldersOpenPrompts]);

  useEffect(() => {
      if (checkingItemType === 'ChatFolders' && currentFolder.type === 'chat') setCheckFolders(true);
      if (checkingItemType === 'PromptFolders' && currentFolder.type === 'prompt') setCheckFolders(true);
      if (checkingItemType === null) setCheckFolders(false);
  }, [checkingItemType]);

  useEffect(() => {
    setIsChecked((checkedItems.includes(currentFolder) ? true : false)); 
  }, [checkedItems]);

  const handleCheckboxChange = (checked: boolean) => {
    if (checked){
      homeDispatch({field: 'checkedItems', value: [...checkedItems, currentFolder]}); 
    } else {
      homeDispatch({field: 'checkedItems', value: checkedItems.filter((i:any) => i !== currentFolder)});
    }
  }

  const hasAccessToItsGroupAdminInterface = () =>{
    const interfaceAccessGroups: string[] = groups.filter((g: Group) => [GroupAccessType.ADMIN, GroupAccessType.WRITE ].includes(g.members[user ?? '']))
                                                  .map((g: Group) => g.id);
    return interfaceAccessGroups.includes(currentFolder.id) && featureFlags.assistantAdminInterface;
  }


  return (
    <>
        <div className="relative flex items-center enhanced-folder"
            id="folderContainer"  
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
          {isRenaming ? (
            <div className="flex w-full items-center gap-3 bg-neutral-200 dark:bg-[#343541]/90 p-3 rounded-md">
              {isOpen ? (
                <IconCaretDown className='flex flex-shrink-0 text-blue-500 transition-transform duration-200' size={18} />
              ) : (
                <IconCaretRight className='flex flex-shrink-0 text-blue-500 transition-transform duration-200' size={18} />
              )}
              <input
                className="mr-12 flex-1 overflow-hidden overflow-ellipsis border-b border-neutral-300 dark:border-neutral-600 bg-transparent text-left text-[13px] leading-5 dark:text-white outline-none focus:border-blue-500 px-1 py-0.5"
                id="renameInput"
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={handleEnterDown}
                autoFocus
              />
            </div>
          ) : (
            <button
              className={`enhanced-folder-title group flex w-full cursor-pointer items-center gap-3 rounded-lg text-sm transition-all duration-200 ${isOpen ? 'enhanced-folder-open' : ''}`}
              id={"dropDown"}
              onClick={() => setIsOpen(!isOpen)}
              onDrop={(e) => dropHandler(e)}
              onDragOver={allowDrop}
              onDragEnter={highlightDrop}
              onDragLeave={removeHighlight}
              title={isOpen ? "Collapse folder" : "Expand folder"}
            >
              <div className="transition-transform duration-200 ease-in-out transform relative">
                <div className="absolute inset-0 bg-blue-100 dark:bg-blue-900/20 rounded-full opacity-0 scale-0 transition-all duration-300 group-hover:opacity-20 group-hover:scale-100"></div>
                {isOpen ? (
                  <IconCaretDown className={`flex flex-shrink-0 ${currentFolder.pinned ? 'text-blue-500' : ''}`} size={20} />
                ) : (
                  <IconCaretRight className={`flex flex-shrink-0 ${currentFolder.pinned ? 'text-blue-500' : ''}`} size={20} />
                )}
              </div>

              <div 
                id={"dropName"}
                className="sidebar-text relative max-h-5 flex-1 overflow-hidden text-ellipsis whitespace-nowrap break-all text-left font-medium">
                {currentFolder.pinned && 
                  <span className="badge-blue mr-1.5 inline-block h-2.5 w-2.5 rounded-full 
                  shadow-sm shadow-blue-500/30"></span>
                }
                {currentFolder.name}
              </div>
            </button>
          )}

          {(isDeleting || isRenaming) && (
            <div className="absolute right-1 z-10 flex bg-neutral-200 dark:bg-[#343541]/90 rounded-md shadow-sm overflow-hidden">
              <ActionButton
                id = {"confirm"}
                handleClick={(e) => {
                  e.stopPropagation();

                  if (isDeleting) {
                    handleDeleteFolder(currentFolder.id);
                  } else if (isRenaming) {
                    handleRename();
                  }

                  setIsDeleting(false);
                  setIsRenaming(false);
                }}
                className="enhanced-action-button text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20"
              >
                <IconCheck size={18} />
              </ActionButton>
              <ActionButton
                id = {"cancel"}
                handleClick={(e) => {
                  e.stopPropagation();
                  setIsDeleting(false);
                  setIsRenaming(false);
                }}
                className="enhanced-action-button text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20"
              >
                <IconX size={18} />
              </ActionButton>
            </div>
          )}

          { checkFolders && (
            <div className="relative flex items-center">
              <div key={currentFolder.id} className="absolute right-4 z-10">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => handleCheckboxChange(e.target.checked)}
                />
              </div>
            </div>
          )}

          {!isDeleting && !isRenaming && isHovered && !checkFolders && (
            <div className="absolute right-1 z-10 flex bg-neutral-200 dark:bg-[#343541]/90 rounded-md shadow-sm overflow-hidden fade-in">
              <ActionButton
                handleClick={(e) => {
                  e.stopPropagation();
                  handlePinFolder(currentFolder.id);
                }}
                title="Pin Folder To The Top"
                id="pinButton"
                className="enhanced-action-button hover:bg-blue-100 dark:hover:bg-blue-900/20"
              >
                { currentFolder.pinned ?
                  <IconPinFilled className={"text-blue-500"} size={18} /> :
                  <IconPin size={18} className="text-gray-500 dark:text-gray-400" /> 
                }
              </ActionButton>
              {currentFolder.isGroupFolder && 
              <>
                { hasAccessToItsGroupAdminInterface() && 
                  <ActionButton
                  handleClick={(e) => {
                    e.stopPropagation();
                    window.dispatchEvent(new CustomEvent('openAstAdminInterfaceTrigger', 
                                        { detail: { isOpen: true, 
                                                    data: { 
                                                        group: groups.find((g:Group) => g.id === currentFolder.id),
                                                    } 
                                                  }} ));
                    
                    
                  }}
                  title="Open In Assistant Admin Interface"
                  className="enhanced-action-button hover:bg-purple-100 dark:hover:bg-purple-900/20"
                >
                    <IconSettingsBolt size={18} className="text-purple-500" /> 
                </ActionButton>}

                <ActionButton
                handleClick={(e) => {
                  e.stopPropagation();
                  handleHideGroupFolder(currentFolder);
                }}
                title="Hide Folder"
                id="hideButton"
                className="enhanced-action-button hover:bg-gray-200 dark:hover:bg-gray-700/50"
              >
                  <IconEyeOff size={18} className="text-gray-500 dark:text-gray-400" /> 
              </ActionButton>
              </>
              }
              { showEditDelete && <>
              <ActionButton
                handleClick={(e) => {
                  e.stopPropagation();
                  setIsRenaming(true);
                  setRenameValue(currentFolder.name);
                }}
                title="Rename Folder"
                id="renameButton"
                className="enhanced-action-button hover:bg-green-100 dark:hover:bg-green-900/20"
              >
                <IconPencil size={18} className="text-green-600 dark:text-green-400" />
              </ActionButton>

              <ActionButton
                handleClick={(e) => {
                  e.stopPropagation();
                  setIsDeleting(true);
                }}
                title="Delete Folder"
                id="deleteButton"
                className="enhanced-action-button hover:bg-red-100 dark:hover:bg-red-900/20"
              >
                <IconTrash size={18} className="text-red-500" />
              </ActionButton>
              </>}
            </div>
          )}
        </div>

      {isOpen ? folderComponent : null}
    </>
  );
};

export default Folder;
