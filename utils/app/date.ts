import moment from 'moment-timezone';

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

  export const updateTimeByZone = (isoDateString: string, timeZone: string) => {
    // Parse the date as UTC and then convert it to the given timezone
    const timeInTimeZone = moment.utc(isoDateString).tz(timeZone);
    // Format the date-time string in a readable format (can be adjusted as needed)
    const formattedTime = timeInTimeZone.format('YYYY-MM-DD HH:mm:ss');
    return formattedTime;
};

export const userFriendlyDate = (date: string) => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    date = updateTimeByZone(date, timeZone)
    return  new Date(date).toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
    });
}