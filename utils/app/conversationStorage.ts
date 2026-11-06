import { ConversationStorage, DEFAULT_CONVERSATION_STORAGE } from "@/types/conversationStorage";
import { Conversation } from "@/types/chat";
import { cancelPendingUpload, getHeldBlankConversationIds, releaseHeldBlankConversations, deleteMultipleRemoteConversations, deleteRemoteConversation, fetchMultipleRemoteConversations, getPendingDeleteIds, getUnsavedConversations, uploadConversation } from "@/services/remoteConversationService";
import { storageGet } from "./storage";
import cloneDeep from 'lodash/cloneDeep';
import { conversationWithCompressedMessages, conversationWithUncompressedMessages, isConversationDeleted, isLocalConversation, isRemoteConversation, remoteForConversationHistory, saveConversations, saveConversationsAsync } from "./conversation";
import { FolderInterface } from "@/types/folder";
import { baseAgentFolder } from "./basePrompts";


//handle all local,
const handleAllLocal = async (conversations: Conversation[], statsService: any, onProgress?: (current: number, total: number) => void) => {
    const remoteConversations = conversations.filter(isRemoteConversation);

    const totalConversations = conversations.length;
    const remoteCount = remoteConversations.length;

    // Report initial progress
    if (onProgress && remoteCount > 0) {
        onProgress(0, totalConversations);
    }

    // Fetch remote conversation data (happens quickly as batch operation)
    let updatedConversations = await includeRemoteConversationData(conversations, "move back to local storage.", false);

    // include remote conversation returns all the local + remote conversation
    // if a conversation fails to fetch then it will be missing from updatedConversations
    const fetchedIds = new Set(updatedConversations.map(c => c.id));
    const missingConversations = remoteConversations.filter(rc => !fetchedIds.has(rc.id));
    // ONLY the chats we really hold a local copy of may be removed from the cloud
    const movedRemoteIds = remoteConversations.filter(rc => fetchedIds.has(rc.id)).map(rc => rc.id);
    movedRemoteIds.forEach(id => statsService.moveConversationFromRemoteEvent(remoteConversations.find(rc => rc.id === id)));

    // Process ALL conversations with progress updates
    let processedCount = 0;
    const movedRemoteIdSet = new Set(movedRemoteIds);

    const finalConversations: Conversation[] = [];
    for (const c of updatedConversations) {
        // Check if this conversation was originally remote (before includeRemoteConversationData modified it)
        if (movedRemoteIdSet.has(c.id)) {
            // Re-compress since includeRemoteConversationData already compressed, but ensure isLocal=true
            finalConversations.push(conversationWithCompressedMessages({...c, isLocal: true}));
        } else {
            // Local conversation - no compression needed, just pass through
            finalConversations.push(c);
        }

        processedCount++;
        if (onProgress) {
            onProgress(processedCount, totalConversations);
        }

        // Add small delay every 5 conversations to allow UI to update
        if (processedCount % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 30));
        }
    }
    // conversations that could not be downloaded stay in the cloud, untouched
    updatedConversations = [...finalConversations, ...missingConversations];

    // 1) make sure the local copies are durably written ...
    const savedLocally = await saveConversationsAsync(updatedConversations);
    if (!savedLocally) {
        // The browser refused the write (storage full / unavailable). Nothing may be removed from the cloud.
        alert("Your conversations could not be saved in this browser, so nothing was moved. Your conversations are still safe in the cloud. Free up browser storage (or export first) and try again.");
        return conversations;
    }
    // 2) ... and only then remove the cloud copies of the chats we hold locally
    if (movedRemoteIds.length > 0) {
        // a save that was still queued for these chats must not bring them back into the cloud later
        movedRemoteIds.forEach((id) => cancelPendingUpload(id));
        const deleted = await deleteMultipleRemoteConversations(movedRemoteIds);
        if (!deleted) {
            // retried (and remembered across reloads) one by one; the chats are safe locally meanwhile
            movedRemoteIds.forEach(id => { void deleteRemoteConversation(id); });
        }
    }

    if (missingConversations.length === 0) {
        alert("Successfully moved all conversations to local storage.");
    } else {
        alert(`Moved your conversations to local storage, except ${missingConversations.length} conversation(s) that could not be retrieved. They are still safe in the cloud; try again later.`);
    }
    return updatedConversations;
}

const handleAllCloud = async (conversations: Conversation[], folders: FolderInterface[], statsService: any, onProgress?: (current: number, total: number) => void) => {
    const localConversations = conversations.filter(isLocalConversation);
    const remoteConversations = conversations.filter(isRemoteConversation);

    const failedToUpload: string[] = [];
    const totalConversations = conversations.length;
    let processedCount = 0;

    // Separate local and remote conversations
    const conversationsToUpload = conversations.filter(isLocalConversation);
    const alreadyRemoteConversations = conversations.filter(isRemoteConversation);

    const updatedConversations: Conversation[] = [];

    // FIRST: Process local conversations (slow uploads)
    for (const conversation of conversationsToUpload) {
        const uncompressMessageConv = conversationWithUncompressedMessages(conversation);

        //Send localConversation to the cloud
        const uploadResult = await uploadConversation(uncompressMessageConv, folders, null, { recreate: true });
        if (!uploadResult) {
            // the chat stays local: its queued upload must not quietly send it to the cloud later
            cancelPendingUpload(conversation.id);
            failedToUpload.push(conversation.name);
            updatedConversations.push(conversation);
        } else {
            statsService.moveConversationRemoteEvent(conversation);
            //strip conversation
            const newCloudConversation = remoteForConversationHistory(conversation);
            newCloudConversation.isLocal = false;
            updatedConversations.push(newCloudConversation);
        }
        processedCount++;
        if (onProgress) onProgress(processedCount, totalConversations);
    }

    // SECOND: Process already-remote conversations (fast, just add to list)
    for (const conversation of alreadyRemoteConversations) {
        updatedConversations.push(conversation);
        processedCount++;
        if (onProgress) onProgress(processedCount, totalConversations);
    }

    if (failedToUpload.length > 0) {
        const conversationList = failedToUpload.length <= 5
            ? failedToUpload.join(", ")
            : `${failedToUpload.slice(0, 5).join(", ")} and ${failedToUpload.length - 5} more`;

        const message = failedToUpload.length === 1
            ? `Conversation "${failedToUpload[0]}" failed to move to the cloud.\n\nThis is usually because the conversation is too large. Consider:\n- Deleting some messages from this conversation\n- Keeping it stored locally instead`
            : `${failedToUpload.length} conversations failed to move to the cloud: ${conversationList}.\n\nThese conversations are likely too large. They will remain stored locally.`;

        alert(message);
    } else {
        alert("Successfully moved all conversations to the cloud.");
    }
    return updatedConversations;
    
}

// when individual conversation is changed to be sent to the cloud
const handleConversationLocalToCloud = async (selectedConversation: Conversation, folders: FolderInterface[], statsService: any) => {
    const copyConv = cloneDeep(selectedConversation)
    const uploadResult = await uploadConversation({...copyConv, isLocal: false}, folders, null, { recreate: true })
    if (!uploadResult) {
        cancelPendingUpload(copyConv.id);
        alert("Failed to send conversation to the cloud. Please try again later...");
        return selectedConversation;
    }
    statsService.moveConversationRemoteEvent(copyConv);
    selectedConversation.isLocal = false;
    return selectedConversation;
}

// when individual conversation is changed to be saved in local.
// The cloud copy is NOT deleted here: the caller first persists the local copy and then calls
// finishMoveToLocal, so a crash in between can never leave the chat nowhere.
const handleConversationCloudToLocal = (selectedConversation: Conversation) => {
    selectedConversation.isLocal = true;
    return selectedConversation;
}

/** Second half of a single-chat cloud -> local move: removes the cloud copy (retried until confirmed). */
export const finishMoveToLocal = async (conversationId: string): Promise<boolean> => {
    // Writes are applied in order, so reading the stored history back shows whether the local copy really made it.
    let persisted = false;
    try {
        const raw = await storageGet('conversationHistory');
        const stored: Conversation[] = raw ? JSON.parse(raw) : [];
        const entry = stored.find((c) => c.id === conversationId);
        // the entry was a cloud stub before the move, so seeing it flagged local proves the new write landed
        persisted = !!entry && !!isLocalConversation(entry);
    } catch (e) {
        console.error('Could not verify the local copy before removing the cloud copy', e);
    }
    if (!persisted) {
        alert("This conversation could not be saved in this browser, so its cloud copy was kept. Please free up browser storage and try again.");
        return false;
    }
    return deleteRemoteConversation(conversationId);
};

/**
 * After a bulk storage change the open chat must stay the full in-memory conversation (the entries in
 * the list are metadata stubs / compressed). Only the storage-related fields are taken from the list.
 */
export const reconcileSelectedAfterStorageChange = (selected: Conversation | null | undefined, updatedList: Conversation[]) => {
    if (!selected) return selected;
    const entry = updatedList.find((c) => c.id === selected.id);
    if (!entry) return selected;
    return { ...selected, isLocal: entry.isLocal, folderId: entry.folderId };
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


/**
 * Applies the result of a bulk move to the list as it is NOW: the move works on a snapshot and can take a long
 * time, so chats created or changed meanwhile would otherwise be dropped (and that loss persisted).
 */
export const mergeStorageChangeWithLiveList = (result: Conversation[], live: Conversation[]): Conversation[] => {
    const resultIds = new Set(result.map((c) => c.id));
    const addedMeanwhile = live.filter((c) => !resultIds.has(c.id) && !isConversationDeleted(c.id));
    return addedMeanwhile.length === 0 ? result : [...result, ...addedMeanwhile];
};

export const handleStorageSelection = async (selection: String, conversations: Conversation[], folders:FolderInterface[], statsService: any, onProgress?: (current: number, total: number) => void, getCurrentConversations?: () => Conversation[]) => {
    // future storage options is taken care of by saving the storage settings in local storage.
    let result: Conversation[] | undefined;
    if (selection === 'local-only') {
        result = await handleAllLocal(conversations, statsService, onProgress);

    } else if (selection === 'cloud-only') {
        result = await handleAllCloud(conversations, folders, statsService, onProgress);
    }
    if (result && getCurrentConversations) return mergeStorageChangeWithLiveList(result, getCurrentConversations());
    return result;
}


// Whether a conversation created now is stored locally. With no selection yet (a new user, or the
// moments before a saved/admin preference has loaded) the system default applies, which is
// "Cloud going forward" — it used to fall back to local, so a new user's first conversations
// were kept in the browser even though the default says cloud.
export const getIsLocalStorageSelection = (storageSelection: string | null) => {
    return (storageSelection || DEFAULT_CONVERSATION_STORAGE).includes('local')
}

  
export const saveStorageSettings = (storage: ConversationStorage) => {
    localStorage.setItem('storageSelection', storage);
};



export interface remoteConvData {
    conversation: Conversation;
    folder: FolderInterface | null;
}

/**
 * Merge the cloud list into the local one.
 *
 * `getCurrentConversations` must return the LIVE list (e.g. a ref): the cloud download can take many
 * seconds, and merging into the list captured before it started would drop every chat created or
 * changed in the meantime (and persist that loss). Without it, `conversations` is used as before.
 */
export const updateWithRemoteConversations = async (remoteConversations: remoteConvData[] | null, conversations: Conversation[], folders:FolderInterface[], dispatch:any, getCurrentConversations?: () => Conversation[]) => {
    if (!remoteConversations) alert("Unable to sync local conversations with those stored in the cloud. Please refresh the page to try again...");

    // chats deleted here whose cloud delete is not confirmed yet must not come back
    const pendingDeletes = remoteConversations && remoteConversations.length > 0 ? await getPendingDeleteIds() : new Set<string>();
    const remoteList = (remoteConversations ?? []).filter((cd: remoteConvData) => cd?.conversation && !pendingDeletes.has(cd.conversation.id));

    // A blank chat held only in this browser that the cloud lists after all (another device wrote to it): the
    // cloud copy is the real one now.
    if (remoteList.length > 0) {
        const held = await getHeldBlankConversationIds();
        const inCloud = remoteList.map((cd: remoteConvData) => cd.conversation.id).filter((id: string) => held.has(id));
        if (inCloud.length > 0) releaseHeldBlankConversations(inCloud);
    }

    if (remoteList.length > 0 ) {
        let updatedFolders = cloneDeep(folders);
        const newFolders: FolderInterface[] = [];
        // read AFTER the awaits above, right before it is used
        const baseConversations = getCurrentConversations ? getCurrentConversations() : conversations;
        const currentConversationsMap = new Map();
        baseConversations.forEach(conv => currentConversationsMap.set(conv.id, conv));

        const agentfolderId = baseAgentFolder.id;
        const convHasAgentFolder = remoteList.find((cd: remoteConvData) => cd.conversation.folderId === agentfolderId);
        if (convHasAgentFolder) {
            const hasAgentFolder = updatedFolders.find((f:FolderInterface) => f.id === agentfolderId);
            if (!hasAgentFolder) {
                updatedFolders = [...updatedFolders,  baseAgentFolder];
                newFolders.push(baseAgentFolder);
            }
        }

        let remappedFolderCount = 0;
        remoteList.forEach((cd: remoteConvData)=> {
            const remoteConv = cd.conversation;
            // NOTE: conversations with no `model` are intentionally NOT backfilled here. Doing so cost a
            // get + upload per conversation on every sync; the chat send path already falls back to the
            // default model when a conversation has none (see useChatSendService).
            // check if there is record of this conversation in the current browser
            const existsLocally = currentConversationsMap.get(remoteConv.id);
            // A chat this browser holds as private/local has its messages here; the cloud list only
            // carries metadata. Replacing it with that stub (e.g. after a failed cloud delete) would
            // wipe the messages, so the local chat always wins.
            if (existsLocally && isLocalConversation(existsLocally)) return;

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
                        // Re-point the chat at this browser's folder of the same name. This is applied to the copy merged
                        // into the local list below and is NOT written back to the cloud: doing so downloaded and
                        // re-uploaded every affected chat on each sync (a get + upload burst at startup). Every place
                        // that loads a full cloud chat for editing keeps the local folderId instead of the cloud one.
                        remoteConv.folderId = similarFolderExists.id;
                        remappedFolderCount++;
                    }
                }
            }   else if  (existsLocally && folderExists && existsLocally.folderId !== folderExists?.id) {
                remoteConv.folderId = folderExists.id;
            }
            const merged: Conversation = {...remoteConv, isLocal: false};  // in case
            // fields the list response may not carry must not be wiped from what we already know
            if (existsLocally) {
                if (merged.date == null && existsLocally.date) merged.date = existsLocally.date;
                if (merged.codeInterpreterRecordId == null && existsLocally.codeInterpreterRecordId) {
                    merged.codeInterpreterRecordId = existsLocally.codeInterpreterRecordId;
                }
            }
            currentConversationsMap.set(remoteConv.id, merged);
        });
        
        if (remappedFolderCount > 0) console.log(`[folder-remap] ${remappedFolderCount} cloud chat(s) point at a folder id this browser lacks; remapped to same-named local folder (not re-uploaded)`);
        const updatedConversations = Array.from(currentConversationsMap.values());
        // console.log("updated conv len: ", updatedConversations.length);

        dispatch({field: 'conversations', value: updatedConversations});
        saveConversations(updatedConversations);
        return {newfolders: newFolders};

    } 

    return {newfolders: []};
    
};


export interface IncludeRemoteResult extends Array<Conversation> {
    /** ids of cloud chats that could not be downloaded (and are therefore missing from the result) */
    missingRemoteIds?: string[];
}

export const includeRemoteConversationData = async (conversationHistory: Conversation[], failMessage: string, uncompressLocal: boolean, onProgress?: (current: number, total: number) => void): Promise<IncludeRemoteResult> => {
    if (!conversationHistory) return [];
    // Filter and get the ids of remote conversations
    const remoteConversationIds = conversationHistory.filter(c => isRemoteConversation(c)).map(c => c.id);

    const localOnly = (c: Conversation) => uncompressLocal ? conversationWithUncompressedMessages(c) : c;
    if (remoteConversationIds.length === 0) return conversationHistory.map(localOnly);

    const totalToFetch = remoteConversationIds.length;

    const fetchedRemoteConversations = await fetchMultipleRemoteConversations(remoteConversationIds);
    // Report progress - fetching is complete
    if (onProgress) onProgress(totalToFetch, totalToFetch);

    // Create a map of remote conversation ids to fetched conversations for quick lookup
    // Use safe access - if data is null, treat as empty array
    const fetchedRemoteConversationsMap = new Map<string, Conversation>((fetchedRemoteConversations?.data || []).map((c:Conversation) => [c.id, c]));
    // A save that has not reached the cloud yet is newer than the cloud copy: it must win
    const unsaved = await getUnsavedConversations(remoteConversationIds);
    unsaved.forEach((conversation, id) => fetchedRemoteConversationsMap.set(id, conversation));

    const failedToFetch: string[] = fetchedRemoteConversations?.failed || [];
    const wholeRequestFailed = !fetchedRemoteConversations || fetchedRemoteConversations.data === null;

    const alertFailed: string[] = [];
    const missing: string[] = [];

    const combinedConversations = conversationHistory.map(c => {
        if (isRemoteConversation(c)) {
            const cloudConversation = fetchedRemoteConversationsMap.get(c.id);
            if (!cloudConversation) {
                missing.push(c.id);
                alertFailed.push(c.name);
                return undefined;
            }
            return { ...(uncompressLocal ? cloudConversation : conversationWithCompressedMessages(cloudConversation as Conversation)), isLocal: true };
        } else {
            return localOnly(c);
        }

    }).filter((c): c is Conversation => c !== undefined);

    if (alertFailed.length > 0) {
        const names = alertFailed.length <= 5 ? alertFailed.join(", ") : `${alertFailed.slice(0, 5).join(", ")} and ${alertFailed.length - 5} more`;
        alert(wholeRequestFailed
            ? `Your cloud conversations could not be downloaded to ${failMessage}`
            : `Conversation${alertFailed.length === 1 ? '' : 's'}: ${names} failed to ${failMessage}`);
    }
    const result = combinedConversations as IncludeRemoteResult;
    result.missingRemoteIds = missing;
    return result;
};
