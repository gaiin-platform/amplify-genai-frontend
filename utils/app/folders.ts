import { FolderInterface } from '@/types/folder';

export const saveFolders = (folders: FolderInterface[]) => {
  localStorage.setItem('folders', JSON.stringify(folders));
};


export const getFolders= () => {
  return JSON.parse(localStorage.getItem('folders') || '[]');

}


export const sortFoldersByDate = (a: FolderInterface, b: FolderInterface) => {
  if (a.date && b.date) {
    // Sort by date if both folders have a date
    return b.date.localeCompare(a.date);
    // Always put folders with a date before those without
  } else if (a.date) {
    return -1;
  } else if (b.date) {
    return 1;
  } else {
    // If neither folder has a date, sort by name
    return a.name.localeCompare(b.name);
  }
};

export const sortFoldersByName = (a: FolderInterface, b: FolderInterface) => {
  return a.name.localeCompare(b.name);
}