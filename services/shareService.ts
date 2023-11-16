import {ExportFormatV4} from "@/types/export";

export const shareItems = async (user:string, sharedWith:string[], note:string, sharedData:ExportFormatV4, abortSignal= null)=> {

    const response = await fetch('/api/share', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({name:"share", data:{note, sharedWith, sharedData} }),
        signal: abortSignal,
    });

    return response;
};

export const getSharedItems = async (user:string, abortSignal= null)=> {

    const response = await fetch('/api/shared', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        signal: abortSignal,
    });

    return response;
};

export const loadSharedItem = async (user:string, key:string, abortSignal= null)=> {

    const filesEndpoint = process.env.FILES_API_URL || "";

    const response = await fetch('/api/sharedload', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data:{key} }),
        signal: abortSignal,
    });

    return response;
};

