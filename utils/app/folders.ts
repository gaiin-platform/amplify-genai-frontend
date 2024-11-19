import { FolderInterface } from '@/types/folder';

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
  localStorage.setItem('folders', JSON.stringify(uniqueFolders));
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
