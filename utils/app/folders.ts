import { FolderInterface } from '@/types/folder';
import { storageSet } from './storage';

export const saveFolders = (folders: FolderInterface[]) => {
  // ensure no duplicate folders 
  const seenIds = new Map<string, FolderInterface>();
  folders.forEach(folder => {
    if (!seenIds.has(folder.id)) {
      seenIds.set(folder.id, folder);
    }
  });

  // Convert the map values to an array for storage
  const uniqueFolders = Array.from(seenIds.values());
  storageSet('folders', JSON.stringify(uniqueFolders));
};


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
    return a.name.localeCompare(b.name);
  }
};

export const sortFoldersByName = (a: FolderInterface, b: FolderInterface) => {
  return a.name.localeCompare(b.name);
}

export const hideGroupFolder = (hideFolder:FolderInterface) => {
  const savedHiddenFolders = localStorage.getItem('hiddenGroupFolders');
  const hiddenFolders = savedHiddenFolders ? JSON.parse(savedHiddenFolders) : [];
    // check its not already there
  const present = hiddenFolders.find((f:FolderInterface) => f.id == hideFolder.id);
  if (!present) localStorage.setItem('hiddenGroupFolders', JSON.stringify([...hiddenFolders, hideFolder]));

}


export const getHiddenGroupFolders = () => {
  const savedHiddenFolders = localStorage.getItem('hiddenGroupFolders');
  return savedHiddenFolders ? JSON.parse(savedHiddenFolders) : [];
}


export const getArchiveNumOfDays = () => {
  const archiveNumOfDays = localStorage.getItem('archiveConversationPastNumOfDays');
  if (archiveNumOfDays) {
    return parseInt(archiveNumOfDays);
  }
  return 14;
}

export const saveArchiveNumOfDays = (numOfDays: number) => {
  localStorage.setItem('archiveConversationPastNumOfDays', numOfDays.toString());
}