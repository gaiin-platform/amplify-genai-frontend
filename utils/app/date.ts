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
    const now = new Date();
    // Format as YYYY-MM-DD but using local date values instead of UTC
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export const getFullTimestamp = () => {
    return new Date().toISOString();
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
    const newDate = new Date(date);
    return  newDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }) + ' at ' + newDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
    });
}


export const formatDateYMDToMDY = (date: string) => {
    const dateInUTC = `${date}T00:00:00Z`;
    const newDate = new Date(dateInUTC);

    const formatter = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC' // Make sure to format the date in UTC
    });
    return formatter.format(newDate);
}


export function generateTimestamp() {
    const now = new Date();
    const yyyymmddhhmmssfff = 
      now.getFullYear().toString() + 
      String(now.getMonth()+1).padStart(2,'0') +
      String(now.getDate()).padStart(2,'0') +
      String(now.getHours()).padStart(2,'0') +
      String(now.getMinutes()).padStart(2,'0') +
      String(now.getSeconds()).padStart(2,'0') +
      String(now.getMilliseconds()).padStart(3,'0');
    return yyyymmddhhmmssfff;
  }