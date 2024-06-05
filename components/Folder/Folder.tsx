import {
  IconCaretDown,
  IconCaretRight,
  IconCheck,
  IconPencil,
  IconTrash,
  IconShare,
  IconX,
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

import SidebarActionButton from '@/components/Buttons/SidebarActionButton';

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
  const { handleDeleteFolder, handleUpdateFolder, state: {selectedConversation, allFoldersOpenPrompts, allFoldersOpenConvs, checkingItemType, checkedItems},
          dispatch: homeDispatch,} = useContext(HomeContext);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [checkFolders, setCheckFolders] = useState(false);
  const [isChecked, setIsChecked] = useState(false);

  const handleEnterDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRename();
    }
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
    e.preventDefault();
  };

  const highlightDrop = (e: any) => {
    e.target.style.background = '#343541';
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


  return (
    <>
        <div className="relative flex items-center"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
          {isRenaming ? (
            <div className="flex w-full items-center gap-3 bg-neutral-200 dark:bg-[#343541]/90 p-3 rounded">
              {isOpen ? (
                <IconCaretDown size={18} />
              ) : (
                <IconCaretRight size={18} />
              )}
              <input
                className="mr-12 flex-1 overflow-hidden overflow-ellipsis border-neutral-400 bg-transparent text-left text-[12.5px] leading-3 dark:text-white outline-none focus:border-neutral-100"
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

              <div className="relative max-h-5 flex-1 overflow-hidden text-ellipsis whitespace-nowrap break-all text-left text-[12.5px] leading-3">
                {currentFolder.name}
              </div>
            </button>
          )}

          {(isDeleting || isRenaming) && (
            <div className="absolute right-1 z-10 flex bg-neutral-200 dark:bg-[#343541]/90 rounded">
              <SidebarActionButton
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
              </SidebarActionButton>
              <SidebarActionButton
                handleClick={(e) => {
                  e.stopPropagation();
                  setIsDeleting(false);
                  setIsRenaming(false);
                }}
              >
                <IconX size={18} />
              </SidebarActionButton>
            </div>
          )}

          { checkFolders && (
            <div className="relative flex items-center">
              <div key={currentFolder.id} className="absolute right-1 z-10">
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
              <SidebarActionButton
                handleClick={(e) => {
                  e.stopPropagation();
                  setIsRenaming(true);
                  setRenameValue(currentFolder.name);
                }}
                title="Rename Folder"
              >
                <IconPencil size={18} />
              </SidebarActionButton>

              <SidebarActionButton
                handleClick={(e) => {
                  e.stopPropagation();
                  setIsDeleting(true);
                }}
                title="Delete Folder"
              >
                <IconTrash size={18} />
              </SidebarActionButton>
            </div>
          )}
        </div>

      {isOpen ? folderComponent : null}
    </>
  );
};

export default Folder;
