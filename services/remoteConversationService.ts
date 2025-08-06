import { Conversation } from "@/types/chat";
import { FolderInterface } from "@/types/folder";
import { compressConversation, saveConversations, uncompressConversation } from "@/utils/app/conversation";
import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/state/conversation";
const NO_SUCH_KEY_ERROR = 'NoSuchKey';
const SERVICE_NAME = "conversation";

export const uploadConversation = async (conversation: Conversation, folders: FolderInterface[], abortSignal = null) => {
    // always ensure isLocal is false just in case
    conversation.isLocal = false;
    const compressedConversation = compressConversation(conversation);
    const folder = conversation.folderId ? folders.find((f: FolderInterface) => conversation.folderId === f.id) : null;

    const op = {
        method: 'PUT',
        path: URL_PATH,
        op: "/upload",
        data: {
            conversation: compressedConversation,
            conversationId: conversation.id,
            folder: folder
        },
        service: SERVICE_NAME
    };

    const result = await doRequestOp(op);
    return result.success;
};

export const fetchRemoteConversation = async (conversationId: string, conversations?: Conversation[], dispatch?: any) => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: "/get",
        queryParams: { "conversationId": conversationId },
        service: SERVICE_NAME
    };
    const result = await doRequestOp(op);
    if (result.success) {
        return uncompressConversation(result.conversation);
    } else {
        console.error("Error fetching conversation: ", result.message);
        let message = "Unfortunately, we are unable to get your cloud-stored conversation at this time. Please try again later...";
        if (result.type === NO_SUCH_KEY_ERROR) {
            message = "This conversation is no longer accessible, it has been made private in another browser or has been removed by another device.";

            if (dispatch && conversations) { //remove conv from history 
                const updatedConversations = conversations.filter((c: Conversation) => c.id !== conversationId);
                dispatch({ field: 'conversations', value: updatedConversations });
                saveConversations(updatedConversations);
            }
        }
        alert(message);
        return null;
    }
};

// only used for the initial sync conversations 
export const fetchAllRemoteConversations = async (days?: number) => {
    try {
        const op = {
            method: 'GET',
            path: URL_PATH,
            op: "/get/all",
            service: SERVICE_NAME,
            queryParams: {},
        };
        if (days) {
            console.log(`Fetching all remote conversations within ${days} days`);
            op.queryParams = { "days": days.toString() };
        }

        const result = await doRequestOp(op);

        // Check if the request was successful
        if (result.success) {
            if (!result.presignedUrls) return [];
            return await fetchConversationPresignedUrls(result.presignedUrls);

        } else {
            console.error("Error fetching presigned URL: ", result.message);
            return null;
        }
    } catch (error) {
        console.error("Error during fetch: ", error);
        return null;
    }
};

export const fetchEmptyRemoteConversations = async (abortSignal = null) => {
    try {
        const op = {
            method: 'GET',
            path: URL_PATH,
            op: "/get/empty",
            service: SERVICE_NAME
        };

        const result = await doRequestOp(op);

        // Check if the request was successful
        if (result.success) {
            if (!result.presignedUrls) return { data: null };
            const conversations = await fetchConversationPresignedUrls(result.presignedUrls);
            return { data: conversations, nonEmptyIds: result.nonEmptyIds }

        } else {
            console.error("Error fetching presigned URL: ", result.message);
            return { data: null };
        }
    } catch (error) {
        console.error("Error during fetch: ", error);
        return { data: null };
    }
};

export const fetchMultipleRemoteConversations = async (conversationIds: string[], abortSignal = null) => {
    if (conversationIds.length === 0) return { data: [] };

    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/get/multiple",
        data: { conversationIds: conversationIds },
        service: SERVICE_NAME
    };

    const result = await doRequestOp(op);
    if (result.success) {
        const conversationData = await fetchConversationPresignedUrls(result.presignedUrls);
        if (!conversationData) return { data: null };
        return {
            data: conversationData.map((c: number[]) => uncompressConversation(c)),
            failedByNoSuchKey: result.noSuchKeyConversations,
            failed: result.failed
        };

    } else {
        console.error("Error fetching presigned URL: ", result.message);
        return { data: null };
    }
};

const fetchConversationPresignedUrls = async (presignedUrls: string[]) => {
    let conversationData: any = [];

    for (let i = 0; i < presignedUrls.length; i++) {
        const presigned_url = presignedUrls[i];
        const response = await fetch(presigned_url, {
            method: 'GET',
            signal: null,
        });

        if (!response.ok) {
            console.error("Error fetching presigned at index:", i);
            return null; //   continue;

        }

        const chunkData = await response.json();
        conversationData = [...conversationData, ...chunkData];
    }
    return conversationData;
}

export const deleteRemoteConversation = async (conversationId: string, abortSignal = null) => {

    const op = {
        method: 'DELETE',
        path: URL_PATH,
        op: "/delete",
        queryParams: { "conversationId": conversationId },
        service: SERVICE_NAME
    };

    const result = await doRequestOp(op);
    return result.success;
};

export const deleteMultipleRemoteConversations = async (conversationIds: string[], abortSignal = null) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/delete_multiple",
        data: { conversationIds: conversationIds },
        service: SERVICE_NAME
    };

    const result = await doRequestOp(op);
    return result.success;
};
