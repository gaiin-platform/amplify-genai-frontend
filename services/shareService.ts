import {ExportFormatV4, ShareItem} from "@/types/export";

export const shareItems = async (user:string, sharedWith:string[], note:string, sharedData:ExportFormatV4, abortSignal= null)=> {

    const response = await fetch('/api/share/share', {
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

    const response = await fetch('/api/share/shared', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        signal: abortSignal,
    });

    return response;
};

export const loadSharedItem = async (user:string, key:string, abortSignal= null)=> {
    const response = await fetch('/api/share/sharedload', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data:{key} }),
        signal: abortSignal,
    });

    return response;
};



export const deleteShareItem = async (shareItem: ShareItem, abortSignal = null) => {
    if ('sharedAt' in shareItem) shareItem.sharedAt;
    const response = await fetch('/api/share/delete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({op: "/delete", data: shareItem}),
        signal: abortSignal,
    });

    const result = await response.json();

    if (result.success) {
        return true;
    } else {
        console.error("Error deleting Shared Item: ", result.message);
        return false;
    }
};

export const deleteYouSharedItem = async (data:{id:string, shared_users: any}, abortSignal = null) => {
    const response = await fetch('/api/share/deleteyoushared', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({op: "/delete", data: data}),
        signal: abortSignal,
    });

    const result = await response.json();

    if (result.success) {
        return true;
    } else {
        console.error("Error deleting Shared Item: ", result.message);
        return false;
    }
};


export const getYouSharedItems = async (user:string, abortSignal= null)=> {

    const response = await fetch('/api/share/youshared', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        signal: abortSignal,
    });

    return response;
};