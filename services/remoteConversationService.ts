import { Conversation } from "@/types/chat";
import { FolderInterface } from "@/types/folder";
import { compressConversation, saveConversations, uncompressConversation } from "@/utils/app/conversation";
import { remoteConvData } from "@/utils/app/conversationStorage";


export const uploadConversation = async (conversation: Conversation, folders: FolderInterface[], abortSignal = null) => {
    // always ensure isLocal is false just in case
    conversation.isLocal = false;
    const compressedConversation = compressConversation(conversation);
    const folder = conversation.folderId ? folders.find((f: FolderInterface) => conversation.folderId ===f.id) : null;
    const data = {op: "/upload", data: {conversation: compressedConversation,
                                        conversationId: conversation.id,
                                        folder: folder
                                        }   
                 }

    const response = await fetch('/api/remoteconversation/op', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        signal: abortSignal,
    });

    const result = await response.json();

    try {

        if (JSON.parse(result.body).success) {
            return true;
        } else {
            console.error("Error fetching conversation: ", result.message);
            return false;
        }
    } catch (e) {
        console.error("Error fetching conversation: ", e);
        return false;
    }
};


export const fetchRemoteConversation = async (conversationId: string, conversations: Conversation[], dispatch: any, abortSignal = null) => {
    
    const response = await fetch('/api/remoteconversation/op' + `?conversationId=${encodeURIComponent(conversationId)}&path=${encodeURIComponent("/get")}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        signal: abortSignal,
    });

    const result = await response.json();
    const resultBody = result ? JSON.parse(result.body || '{}') : {"success": false};
    if (resultBody.success) {
        return uncompressConversation(resultBody.conversation);
    } else {
        console.error("Error fetching conversation: ", result.message);
        let message = "Unfortunately, we are unable to get your cloud-stored conversation at this time. Please try again later...";
        if (resultBody.type === 'NoSuchKey') {
            message =  "This conversation is no longer accessible, it has been made private in another browser or has been removed by another device.";
            //remove conv
            const updatedConversations = conversations.filter((c: Conversation) => c.id !== conversationId);
            dispatch({ field: 'conversations', value: updatedConversations });
            saveConversations(updatedConversations);
        }
        alert(message)
        return null;
    }
};

export const fetchAllRemoteConversations = async (abortSignal = null) => {
    const response = await fetch(`/api/remoteconversation/op?path=${encodeURIComponent("/get_all")}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        signal: abortSignal,
    });

    const result = await response.json();
    const resultBody = result ? JSON.parse(result.body || '{}') : {"success": false};
    if (resultBody.success) { // folders needed for first fetch 
        const remoteConversations = resultBody.conversationsData.map((cd: any) => ({
                          conversation: uncompressConversation(cd.conversation) as Conversation,
                          folder: cd.folder as FolderInterface
                        }))as remoteConvData[];
        return remoteConversations.filter((cd: remoteConvData)  => cd.conversation !== undefined) 
    } else {
        console.error("Error fetching conversations: ", result.message);
        return null;
    }
};


export const fetchMultipleRemoteConversations = async (conversationIds: string[], abortSignal = null) => {
    if (conversationIds.length === 0) return [];

    const data = {op: "/get_multiple", data: {conversationIds: conversationIds}}

    const response = await fetch('/api/remoteconversation/op', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        signal: abortSignal,
    });

    const result = await response.json();
    const resultBody = result ? JSON.parse(result.body || '{}') : {"success": false};
    if (resultBody.success) {
        return resultBody.conversations.map((c:number[]) => uncompressConversation(c)); // list of conversations
    } else {
        console.error("Error fetching conversation: ", result.message);
        return [];
    }
};



export const deleteRemoteConversation = async (conversationId: string, abortSignal = null) => {
    const response = await fetch('/api/remoteconversation/op' + `?conversationId=${encodeURIComponent(conversationId)}&path=${encodeURIComponent("/delete")}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
        signal: abortSignal,
    });

    const result = await response.json();

    try {
        return result && JSON.parse(result.body).success;  
    } catch(e) {
        console.error("Error deleting conversation: ", result.message || e);
        return false;
    }
};




export const deleteMultipleRemoteConversations = async (ConversationIds: string[], abortSignal = null) => {
    const data = {op: "/delete_multiple", data: {conversationIds: ConversationIds}}

    const response = await fetch('/api/remoteconversation/op', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        signal: abortSignal,
    });

    const result = await response.json();
    try {
        return result && JSON.parse(result.body).success
    } catch (e) {
        console.error("Error deleting conversations: ", result.message || e);
        return false;
    }
};

