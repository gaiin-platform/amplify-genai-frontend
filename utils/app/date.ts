import { FolderInterface } from "@/types/folder";

export const getDateName = () => {
    return new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
}


export const getDate = () => {
    return new Date().toISOString().slice(0, 10);
}


export const addDateAttribute = (folder: FolderInterface) => {
    const datePattern = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{4})$/;
    const match = folder.name.match(datePattern);
    
    if (match) {
        const date = new Date(folder.name);
  
        if (!isNaN(date.getTime())) {
            // Convert the date to ISO format and slice to get "YYYY-MM-DD".
            folder.date = date.toISOString().slice(0, 10);
        }
    }
    return folder;
  }