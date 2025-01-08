import { Conversation } from "@/types/chat";
import { FolderInterface } from "@/types/folder";
import { compressConversation, saveConversations, uncompressConversation } from "@/utils/app/conversation";
import { doRequestOp } from "./doRequestOp";

const URL_PATH =  "/state/conversation";

const NO_SUCH_KEY_ERROR = 'NoSuchKey';

export const uploadConversation = async (conversation: Conversation, folders: FolderInterface[], abortSignal = null) => {
    // always ensure isLocal is false just in case
    conversation.isLocal = false;
    const compressedConversation = compressConversation(conversation);
    const folder = conversation.folderId ? folders.find((f: FolderInterface) => conversation.folderId ===f.id) : null;

    const op = {
        method: 'PUT',
        path: URL_PATH,
        op: "/upload",
        data: {conversation: compressedConversation,
            conversationId: conversation.id,
            folder: folder
            } 
    };
    
    const result = await doRequestOp(op);
    return result.success;
};


export const fetchRemoteConversation = async (conversationId: string, conversations?: Conversation[], dispatch?: any) => {
     const op = {
            method: 'GET',
            path: URL_PATH,
            op: "/get",
            queryParams: {"conversationId": conversationId}
        };
    const result = await doRequestOp(op);
    if (result.success) {
        return uncompressConversation(result.conversation);
    } else {
        console.error("Error fetching conversation: ", result.message);
        let message = "Unfortunately, we are unable to get your cloud-stored conversation at this time. Please try again later...";
        if (result.type === NO_SUCH_KEY_ERROR) {
            message =  "This conversation is no longer accessible, it has been made private in another browser or has been removed by another device.";
            
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
export const fetchAllRemoteConversations = async (abortSignal = null) => {
    try {
        const op = {
            method: 'GET',
            path: URL_PATH,
            op: "/get_all"
        };
        
        const result = await doRequestOp(op);

        // Check if the request was successful
        if (result.success) {
            const presignedUrl = result.presignedUrl;

            // Fetch the actual conversation data using the presigned URL
            const conversationResponse = await fetch(presignedUrl, {
                method: 'GET',
                signal: abortSignal,
            });

            if (!conversationResponse.ok) {
                console.error("Error fetching conversation data from presigned URL");
                return null;
            }

            const conversationData = await conversationResponse.json();
            // console.log("uncompress retrieved conversations len: ", conversationData.length);
            return conversationData;
        } else {
            console.error("Error fetching presigned URL: ", result.message);
            return null;
        }
    } catch (error) {
        console.error("Error during fetch: ", error);
        return null;
    }
};


export const fetchMultipleRemoteConversations = async (conversationIds: string[], abortSignal = null) => {
    if (conversationIds.length === 0) return {data: []};

    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/get_multiple",
        data:  {conversationIds: conversationIds}
    };
    
    const result = await doRequestOp(op);
    if (result.success) {
        const presignedUrl = result.presignedUrl;

        // Fetch the actual conversation data using the presigned URL
        const conversationResponse = await fetch(presignedUrl, {
            method: 'GET',
            signal: abortSignal,
        });

        if (!conversationResponse.ok) {
            console.error("Error fetching conversation data from presigned URL");
            return {data: null};
        }

        const conversationData = await conversationResponse.json();
        return {data: conversationData.map((c:number[]) => uncompressConversation(c)), 
                failedByNoSuchKey: result.noSuchKeyConversations,
                failed: result.failed}; 
    } else {
        console.error("Error fetching presigned URL: ", result.message);
        return {data: null};
    }
};



export const deleteRemoteConversation = async (conversationId: string, abortSignal = null) => {

    const op = {
        method: 'DELETE',
        path: URL_PATH,
        op: "/delete",
        queryParams: {"conversationId": conversationId}
    };
    
    const result = await doRequestOp(op);
    return result.success;
};




export const deleteMultipleRemoteConversations = async (conversationIds: string[], abortSignal = null) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/delete_multiple",
        data:  {conversationIds: conversationIds}
    };
    
    const result = await doRequestOp(op);
    return result.success;
};

