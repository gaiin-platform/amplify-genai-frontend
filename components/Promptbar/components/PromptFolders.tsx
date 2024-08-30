import { useContext, useEffect, useRef } from 'react';

import { FolderInterface, SortType } from '@/types/folder';

import HomeContext from '@/pages/api/home/home.context';

import Folder from '@/components/Folder';
import { PromptComponent } from '@/components/Promptbar/components/Prompt';

import PromptbarContext from '../PromptBar.context';
import { sortFoldersByDate, sortFoldersByName } from '@/utils/app/folders';


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

  const handleDrop = (e: any, folder: FolderInterface) => {
    if (e.dataTransfer) {
      const prompt = JSON.parse(e.dataTransfer.getData('prompt'));

      const updatedPrompt = {
        ...prompt,
        folderId: folder.id,
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
        .sort(sort === 'date' ? sortFoldersByDate : sortFoldersByName)
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
    </div>
  );
};
