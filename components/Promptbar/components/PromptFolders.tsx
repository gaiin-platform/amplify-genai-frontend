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
        folderId: folder ? (folder.id === 'uncategorized' ? null : folder.id) : null,
      };

      handleUpdatePrompt(updatedPrompt);
    }
  };

  const PromptFolders = (currentFolder: FolderInterface) => {
    if (currentFolder.id === 'uncategorized') {
      return filteredPrompts
        .filter((p) => !p.folderId || !folders.find((f: FolderInterface) => f.id === p.folderId && f.type === 'prompt'))
        .map((prompt, index) => (
          <div key={index} className="ml-3 gap-2 border-l border-neutral-200 dark:border-neutral-700 pl-2">
            <PromptComponent prompt={prompt} />
          </div>
        ));
    }
    
    return filteredPrompts
      .filter((p) => p.folderId)
      .map((prompt, index) => {
        if (prompt.folderId === currentFolder.id) {
          return (
            <div key={index} className="ml-3 gap-2 border-l border-neutral-200 dark:border-neutral-700 pl-2">
              <PromptComponent prompt={prompt} />
            </div>
          );
        }
      });
  };

  // Check if there are any uncategorized prompts
  const uncategorizedPrompts = filteredPrompts.filter(
    (p) => !p.folderId || !folders.find((f: FolderInterface) => f.id === p.folderId && f.type === 'prompt')
  );

  // Create uncategorized folder if needed
  const uncategorizedFolder: FolderInterface = {
    id: 'uncategorized',
    name: 'Uncategorized',
    type: 'prompt',
    pinned: false
  };

  const promptFolders = folders.filter((folder: FolderInterface) => folder.type === 'prompt');
  
  // Add uncategorized folder to the list if there are uncategorized prompts
  const allFolders = uncategorizedPrompts.length > 0 
    ? [...promptFolders, uncategorizedFolder]
    : promptFolders;

  return (
    <div className="flex w-full flex-col h-full">
      <div className="flex flex-col" style={{ height: 'calc(100vh - 290px)' }}>
        <div className="flex-1 overflow-y-auto overflow-x-hidden pb-2">
          {allFolders
            .sort((a, b) => {
              // Always put uncategorized last
              if (a.id === 'uncategorized') return 1;
              if (b.id === 'uncategorized') return -1;
              
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
              // Always put uncategorized last
              if (a.id === 'uncategorized') return 1;
              if (b.id === 'uncategorized') return -1;
              
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
      </div>
    </div>
  );
};
