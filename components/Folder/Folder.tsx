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
import ActionButton from '../ReusableComponents/ActionButton';
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
        <div className="relative flex items-center"
            id="folderContainer"  
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
          {isRenaming ? (
            <div className="flex w-full items-center gap-3 bg-neutral-200 dark:bg-[#343541]/90 p-3 rounded">
              {isOpen ? (
                <IconCaretDown className='flex flex-shrink-0' size={18} />
              ) : (
                <IconCaretRight className='flex flex-shrink-0' size={18} />
              )}
              <input
                className="mr-12 flex-1 overflow-hidden overflow-ellipsis border-neutral-400 bg-transparent text-left text-[12.5px] leading-3 dark:text-white outline-none focus:border-neutral-100"
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
              className={`flex w-full cursor-pointer items-center gap-3 rounded-lg p-3 text-sm transition-colors duration-200 hover:bg-neutral-200 dark:hover:bg-[#343541]/90`}
              id={"dropDown"}
              onClick={() => setIsOpen(!isOpen)}
              onDrop={(e) => dropHandler(e)}
              onDragOver={allowDrop}
              onDragEnter={highlightDrop}
              onDragLeave={removeHighlight}
              title={isOpen ? "Collapse folder" : "Expand folder"}
            >
              {isOpen ? (
                <IconCaretDown size={18} />
              ) : (
                <IconCaretRight size={18} />
              )}

              <div 
                id={"dropName"}
                className="relative max-h-5 flex-1 overflow-hidden text-ellipsis whitespace-nowrap break-all text-left text-[12.5px] leading-4">
                {currentFolder.name}
              </div>
            </button>
          )}

          {(isDeleting || isRenaming) && (
            <div className="absolute right-1 z-10 flex bg-neutral-200 dark:bg-[#343541]/90 rounded">
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
            <div className="absolute right-1 z-10 flex bg-neutral-200 dark:bg-[#343541]/90 rounded">
              <ActionButton
                handleClick={(e) => {
                  e.stopPropagation();
                  handlePinFolder(currentFolder.id);
                }}
                title="Pin Folder To The Top"
                id="pinButton"
              >
                { currentFolder.pinned ?
                  <IconPinFilled className={"text-blue-500"} size={18} /> :
                  <IconPin size={18} /> 
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
                >
                    <IconSettingsBolt size={18} /> 
                </ActionButton>}

                <ActionButton
                handleClick={(e) => {
                  e.stopPropagation();
                  handleHideGroupFolder(currentFolder);
                }}
                title="Hide Folder"
                id="hideButton"
              >
                  <IconEyeOff size={18} /> 
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
              >
                <IconPencil size={18} />
              </ActionButton>

              <ActionButton
                handleClick={(e) => {
                  e.stopPropagation();
                  setIsDeleting(true);
                }}
                title="Delete Folder"
                id="deleteButton"
              >
                <IconTrash size={18} />
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
