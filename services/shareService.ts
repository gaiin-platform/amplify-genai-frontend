import { ExportFormatV4, ShareItem } from "@/types/export";
import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/state";
const SERVICE_NAME = "share";

export const shareItems = async (user: string, sharedWith: string[], note: string, sharedData: ExportFormatV4, abortSignal = null) => {

    const op = {
        method: 'POST',
        path: URL_PATH,
        data: { note, sharedWith, sharedData },
        op: "/share",
        service: SERVICE_NAME
    };

    return await doRequestOp(op);
};

export const getSharedItems = async () => {

    const op = {
        method: 'GET',
        path: URL_PATH,
        op: "/share",
        service: SERVICE_NAME
    };

    return await doRequestOp(op);
};

export const loadSharedItem = async (key: string) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        data: { key },
        op: "/share/load",
        service: SERVICE_NAME
    };

    return await doRequestOp(op);

};

export const deleteShareItem = async (shareItem: ShareItem, abortSignal = null) => {
    if ('sharedAt' in shareItem) shareItem.sharedAt;
    const response = await fetch('/api/share/delete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ op: "/delete", data: shareItem }),
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

export const deleteYouSharedItem = async (data: { id: string, shared_users: any }, abortSignal = null) => {
    const response = await fetch('/api/share/deleteyoushared', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ op: "/delete", data: data }),
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

export const getYouSharedItems = async (user: string, abortSignal = null) => {

    const response = await fetch('/api/share/youshared', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        signal: abortSignal,
    });

    return response;
};
