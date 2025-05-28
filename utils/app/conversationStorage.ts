import { ConversationStorage } from "@/types/conversationStorage";
import { Conversation } from "@/types/chat";
import { deleteMultipleRemoteConversations, deleteRemoteConversation, fetchMultipleRemoteConversations, fetchRemoteConversation, uploadConversation } from "@/services/remoteConversationService";
import cloneDeep from 'lodash/cloneDeep';
import { conversationWithCompressedMessages, conversationWithUncompressedMessages, isLocalConversation, isRemoteConversation, remoteForConversationHistory, saveConversations } from "./conversation";
import { FolderInterface } from "@/types/folder";
import { baseAgentFolder } from "./basePrompts";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE } from "./const";
import { Model } from '@/types/model';


//handle all local, 
const handleAllLocal = async (conversations: Conversation[], statsService: any) => {
    let updatedConversations = await includeRemoteConversationData(conversations, "move back to local storage.", false);
    const remoteConversations = conversations.filter(isRemoteConversation);
    const remoteConversationIds = remoteConversations.map(c => c.id);
    deleteMultipleRemoteConversations(remoteConversationIds);

    // include remote conversation returns all the local + remote conversation 
    // if a conversation fails to fetch then it will be missing from updatedConversations
    const missingConversations = remoteConversations.filter(rc => {
            const isMissing = !updatedConversations.some(updatedC => updatedC.id === rc.id);
            if (!isMissing) statsService.moveConversationFromRemoteEvent(rc);
            return isMissing
        });
   
    // compress remote conv messages and set isLocal true 
    updatedConversations = updatedConversations.map((c: Conversation) => {
                                if (isRemoteConversation(c)) {
                                    return conversationWithCompressedMessages({...c, isLocal: true});
                                }
                                return c;
                            })
    if (!missingConversations) {
        alert("Successfully moved all conversations to local storage.");
    } else {
        updatedConversations = [...updatedConversations, ...missingConversations];
    }
    return updatedConversations;
}

const handleAllCloud = async (conversations: Conversation[], folders: FolderInterface[], statsService: any) => {
    const failedToUpload: string[] = [];
    const updatedConversations: Conversation[] = await Promise.all(conversations.map(
        async (conversation) => {
            if (isLocalConversation(conversation)) {
                const uncompressMessageConv = conversationWithUncompressedMessages(conversation);
                //Send localConversation to the cloud
                const uploadResult = await uploadConversation(uncompressMessageConv, folders);
                if (!uploadResult) {
                    failedToUpload.push(conversation.name);
                    return conversation
                }
                statsService.moveConversationRemoteEvent(conversation);
                //strip conversation
                const newCloudConversation = remoteForConversationHistory(conversation);
                newCloudConversation.isLocal = false;
                return newCloudConversation;
            }
            return conversation;
        }
    ));

    const message = failedToUpload.length > 0 ? `Conversation${failedToUpload.length === 1 ? '': 's'}: ${failedToUpload.join(", ")} failed to move to the cloud.`
                                              : "Successfully moved all conversations to the cloud."
    alert(message);
    return updatedConversations;
    
}

// when individual conversation is changed to be sent to the cloud
const handleConversationLocalToCloud = async (selectedConversation: Conversation, folders: FolderInterface[], statsService: any) => {
    const copyConv = cloneDeep(selectedConversation)
    const uploadResult = await uploadConversation({...copyConv, isLocal: false}, folders)
    if (!uploadResult) {
        alert("Failed to send conversation to the cloud. Please try again later...");
        return selectedConversation;
    }
    statsService.moveConversationRemoteEvent(copyConv);
    selectedConversation.isLocal = false;
    return selectedConversation;
}

// when individual conversation is changed to be saved in local
const handleConversationCloudToLocal = (selectedConversation: Conversation) => {
    deleteRemoteConversation(selectedConversation.id);
    selectedConversation.isLocal = true;
    return selectedConversation;
}


export const  handleSelectedConversationStorageChange = (selectedConversation: Conversation, folders:FolderInterface[], statsService: any) => {
    if (selectedConversation.isLocal) {  
        return handleConversationLocalToCloud(selectedConversation, folders, statsService)
    } else {
        // switching to local
        statsService.moveConversationFromRemoteEvent(selectedConversation);
        return handleConversationCloudToLocal(selectedConversation)
    }
   
}


export const handleStorageSelection = (selection: String, conversations: Conversation[], folders:FolderInterface[], statsService: any) => {
    // future storage options is taken care of by saving the storage settings in local storage. 

    if (selection === 'local-only') {
        return handleAllLocal(conversations, statsService);

    } else if (selection === 'cloud-only') {
        return handleAllCloud(conversations, folders, statsService);
    }
    
}


export const getIsLocalStorageSelection = (storageSelection: string | null) => { 
    return storageSelection ? storageSelection.includes('local') : true
}

  
export const saveStorageSettings = (storage: ConversationStorage) => {
    localStorage.setItem('storageSelection', storage);
};



const fillInMissingData = async (conversationId: string, defaultModel: Model, folders:FolderInterface[]) => {
    const fullConv = await fetchRemoteConversation(conversationId);
    if (fullConv) {
        fullConv.model = defaultModel;
        fullConv.prompt = DEFAULT_SYSTEM_PROMPT;
        fullConv.temperature = DEFAULT_TEMPERATURE;
        // happens for conversation upload through the register conversation api endpoint 
        console.log("Update missing data on remote conversation");
        uploadConversation(fullConv, folders);
    }
}

const updateRemoteConversation = async (conversationId: string, attributes: any, folders:FolderInterface[]) => {
    const fullConv = await fetchRemoteConversation(conversationId);
    if (fullConv) {
        const updatedConv = {...fullConv, ...attributes};
        // console.log("Update data on remote conversation: ", attributes);
        uploadConversation(updatedConv, folders);
    }
}

export interface remoteConvData {
    conversation: Conversation;
    folder: FolderInterface | null;
}

export const updateWithRemoteConversations = async (remoteConversations: remoteConvData[] | null, conversations: Conversation[], folders:FolderInterface[], dispatch:any, defaultModel: Model) => {
    if (!remoteConversations) alert("Unable to sync local conversations with those stored in the cloud. Please refresh the page to try again...");

    if (remoteConversations && remoteConversations.length > 0 ) {
        let updatedFolders = cloneDeep(folders);
        const newFolders: FolderInterface[] = [];
        const currentConversationsMap = new Map();
        conversations.forEach(conv => currentConversationsMap.set(conv.id, conv));

        const agentfolderId = baseAgentFolder.id;
        const convHasAgentFolder = remoteConversations.find((cd: remoteConvData) => cd.conversation.folderId === agentfolderId);
        if (convHasAgentFolder) {
            const hasAgentFolder = updatedFolders.find((f:FolderInterface) => f.id === agentfolderId);
            if (!hasAgentFolder) {
                updatedFolders = [...updatedFolders,  baseAgentFolder];
                newFolders.push(baseAgentFolder);
            }
        }

        remoteConversations.forEach((cd: remoteConvData)=> {
            const remoteConv = cd.conversation;
            if (!remoteConv.model) fillInMissingData(remoteConv.id, defaultModel, updatedFolders);
            // check if there is record of this conversation in the current browser
            const existsLocally = currentConversationsMap.get(remoteConv.id);
            let folderExists = remoteConv.folderId ? updatedFolders.find((f:FolderInterface) =>  f.id === remoteConv.folderId) : null;
            if (!existsLocally || (existsLocally && remoteConv.name !== existsLocally.name) 
                               || (!folderExists && cd.folder)) {
                if (!folderExists && cd.folder) {
                    //check folder exists, if not create it
                    const similarFolderExists = updatedFolders.find((f:FolderInterface) => f.name === cd.folder?.name);
                    if (!similarFolderExists) {
                        updatedFolders = [...updatedFolders,  cd.folder];
                        newFolders.push(cd.folder);
                    } else {
                        remoteConv.folderId = similarFolderExists.id;
                        // update the folder id in the remote conversation, this will ensure we are fully in sync in this browser 
                        updateRemoteConversation(remoteConv.id, {folderId: similarFolderExists.id}, updatedFolders);
                    }
                }
            }   else if  (existsLocally && folderExists && existsLocally.folderId !== folderExists?.id) {
                remoteConv.folderId = folderExists.id;
            }
            currentConversationsMap.set(remoteConv.id, {...remoteConv, isLocal: false});  // in case
        });
        
        const updatedConversations = Array.from(currentConversationsMap.values());
        // console.log("updated conv len: ", updatedConversations.length);

        dispatch({field: 'conversations', value: updatedConversations});
        saveConversations(updatedConversations);
        return {newfolders: newFolders};

    } 

    return {newfolders: []};
    
};


export const includeRemoteConversationData = async (conversationHistory: Conversation[], failMessage: string, uncompressLocal: boolean) => {
    if (!conversationHistory) return [];
    // Filter and get the ids of remote conversations
    const remoteConversationIds = conversationHistory.filter(c => isRemoteConversation(c)).map(c => c.id);
    
    if (remoteConversationIds.length === 0) return conversationHistory;
    
    const fetchedRemoteConversations = await fetchMultipleRemoteConversations(remoteConversationIds);
    // console.log(fetchedRemoteConversations);
    // Create a map of remote conversation ids to fetched conversations for quick lookup
    const fetchedRemoteConversationsMap = new Map(fetchedRemoteConversations.data.map((c:Conversation) => [c.id, c]));

    const failedToFetchByNoSuchKey: string[] = fetchedRemoteConversations.failedByNoSuchKey;
    console.log("Currently no such key conversations in history: ", failedToFetchByNoSuchKey);
    const failedToFetch: string[] = fetchedRemoteConversations.failed;

    const alertFailed: string[] = [];

    const combinedConversations = conversationHistory.map(c => {
        if (isRemoteConversation(c)) {
            const cloudConversation = fetchedRemoteConversationsMap.get(c.id);
            if (!cloudConversation) {
                // if not in  no such key then push
                if (failedToFetch.includes(c.id)) alertFailed.push(c.name);
                return undefined;
            }
            return { ...(uncompressLocal ? cloudConversation : conversationWithCompressedMessages(cloudConversation as Conversation)), isLocal: true };
        } else if (uncompressLocal) {
            return conversationWithUncompressedMessages(c);
        } else {
            //leave as is, with compressed messages 
            return c;
        }
        
    }).filter((c): c is Conversation => c !== undefined);

    if (alertFailed.length > 0) {
        alert(`Conversation${alertFailed.length === 1 ? '' : 's'}: ${alertFailed.join(", ")} failed to ${failMessage}`);
    } 
    return combinedConversations;
};
