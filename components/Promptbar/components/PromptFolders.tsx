import { useContext, useEffect, useRef, useState } from 'react';

import { FolderInterface, SortType } from '@/types/folder';

import HomeContext from '@/pages/api/home/home.context';

import Folder from '@/components/Folder';
import { PromptComponent } from '@/components/Promptbar/components/Prompt';

import PromptbarContext from '../PromptBar.context';
import { sortFoldersByDate, sortFoldersByName } from '@/utils/app/folders';
import { IconCirclePlus } from '@tabler/icons-react';


interface Props {
  sort: SortType
} 


export const PromptFolders = ({sort}: Props) => {
  const {
    state: { folders},
  } = useContext(HomeContext);

  const foldersRef = useRef(folders);

  useEffect(() => {
      foldersRef.current = folders;
  }, [folders]);


  const {
    state: { searchTerm, filteredPrompts},
    handleUpdatePrompt,
    handleShareFolder,
  } = useContext(PromptbarContext);

  const [isNullFolderHovered, setIsNullFolderHovered] = useState<boolean>(false);

  const handleDrop = (e: any, folder?: FolderInterface) => {
    if (e.dataTransfer && e.dataTransfer.getData('prompt')) {

      const prompt = JSON.parse(e.dataTransfer.getData('prompt'));

      const updatedPrompt = {
        ...prompt,
        folderId: folder? folder.id : null,
      };

      handleUpdatePrompt(updatedPrompt);
    }
  };

  const PromptFolders = (currentFolder: FolderInterface) =>
    filteredPrompts
      .filter((p) => p.folderId)
      .map((prompt, index) => {
        if (prompt.folderId === currentFolder.id) {
          return (
            <div key={index} className="ml-5 gap-2 border-l pl-2">
              <PromptComponent prompt={prompt} />
            </div>
          );
        }
      });

  return (
    <div className="flex w-full flex-col">
      {folders
        .filter((folder: FolderInterface) => folder.type === 'prompt')
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
        .sort((a, b) => {
          if (a.isGroupFolder && !b.isGroupFolder) return 1;
          if (!a.isGroupFolder && b.isGroupFolder) return -1;
          return 0 })
        .map((folder: FolderInterface, index:number) => (
          <Folder
            key={index}
            searchTerm={searchTerm}
            currentFolder={folder}
            handleDrop={handleDrop}
            folderComponent={PromptFolders(folder)}
          />
        ))}

      <div
        onDragEnter={() => setIsNullFolderHovered(true)}
        onDragLeave={() => setIsNullFolderHovered(false)}
        onMouseLeave={() => setIsNullFolderHovered(false)}

        className="h-[4px]" style={{transform: "translateY(6px)"}}
        onDrop={(e) => handleDrop(e, undefined)} 
        onDragOver={(e) => e.preventDefault()} 
      >
          {isNullFolderHovered &&  <IconCirclePlus className="text-green-400"  size={16}/>}
      </div>

    </div>
  );
};
