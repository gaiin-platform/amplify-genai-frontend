import { FolderInterface } from '@/types/folder';

export const saveFolders = (folders: FolderInterface[]) => {
  localStorage.setItem('folders', JSON.stringify(folders));
};


export const getFolders= () => {
  return JSON.parse(localStorage.getItem('folders') || '[]').filter((f:FolderInterface) => f);

}