import { Conversation, Message } from '@/types/chat';
import { lzwCompress, lzwUncompress } from '@/utils/app/lzwCompression';
import { compressMessages, tryUncompressMessages } from './messages';
import { deleteCodeInterpreterConversation } from '@/services/codeInterpreterService';
import { deleteRemoteConversation } from '@/services/remoteConversationService';
import { storageSet } from './storage';

export const updateConversation = (
  updatedConversation: Conversation, // expected to be the complete conversation 
  allConversations: Conversation[],
) => {
  // upsert: a chat that is missing from the list (e.g. dropped by a concurrent sync) is put back
  const updatedConversations = upsertConversationEntry(allConversations, condenseForConversationHistory(updatedConversation));
  
  saveConversations(updatedConversations);

  return {
    single: updatedConversation,
    all: updatedConversations,
  };
};

export const isRemoteConversation = (conversation: Conversation) => {
  return ('isLocal' in conversation && !conversation.isLocal)
}


export const isLocalConversation = (conversation: Conversation) => {
  return !('isLocal' in conversation) || conversation.isLocal;
}


export const condenseForConversationHistory = (conversation: Conversation) => {
  return isLocalConversation(conversation) ? conversationWithCompressedMessages(conversation) 
                                           : remoteForConversationHistory(conversation);
};


// Chats the user deleted in this session. A response that finishes streaming afterwards must not put the
// chat back into the list (see upsertConversationEntry).
const deletedConversationIds = new Set<string>();
export const isConversationDeleted = (id: string) => deletedConversationIds.has(id);
export const forgetDeletedConversation = (id: string) => { deletedConversationIds.delete(id); };

export const deleteConversationCleanUp = (conversation: Conversation) => {
  deletedConversationIds.add(conversation.id);
  if (conversation.codeInterpreterRecordId) deleteCodeInterpreterConversation(conversation);
  if (isRemoteConversation(conversation)) deleteRemoteConversation(conversation.id);
}



const STORAGE_FULL_MESSAGE = "Your conversations could not be saved in this browser (storage is full or unavailable). Please delete some conversations before continuing. You can export your current conversations before deleting them.";

let lastStorageAlertAt = 0;
const alertStorageProblem = (error: unknown) => {
  console.error("Failed to persist conversations locally:", error);
  // storage writes are async, so a failing write used to be swallowed (the try/catch around them could
  // never see it). Alert, but not more than once in a while, since every save would hit the same wall.
  if (Date.now() - lastStorageAlertAt > 60_000) {
    lastStorageAlertAt = Date.now();
    alert(STORAGE_FULL_MESSAGE);
  }
};

// Other tabs hold their own copy of the conversation list in memory, and `storage` events only fire
// for localStorage (the history now lives in IndexedDB), so tabs are told about writes explicitly.
// A BroadcastChannel object does not receive its own posts, but ANOTHER object in the same tab does, so every
// message carries this tab's id and the listener ignores messages from itself.
const HISTORY_CHANNEL = 'amplify-conversation-history';
const TAB_ID = typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let historyChannel: BroadcastChannel | null | undefined;
const getHistoryChannel = () => {
  if (historyChannel === undefined) {
    historyChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(HISTORY_CHANNEL) : null;
  }
  return historyChannel;
};

/** Calls back when ANOTHER tab persisted the conversation list. Returns an unsubscribe function. */
export const onConversationHistoryChangedInOtherTab = (callback: () => void) => {
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(HISTORY_CHANNEL) : null;
  if (!channel) return () => undefined;
  channel.onmessage = (event: MessageEvent) => {
    if (event?.data?.tab === TAB_ID) return; // our own write
    callback();
  };
  return () => channel.close();
};

// Set when the stored history could not be read at startup. Writing the (empty) in-memory list over it would
// destroy the real history, so writes of the conversation list are refused until the page is reloaded.
let historyWritesBlocked = false;
export const blockConversationHistoryWrites = () => { historyWritesBlocked = true; };
export const areConversationHistoryWritesBlocked = () => historyWritesBlocked;

/** Resolves true only when the value was really written. Failures are reported to the user (rate limited). */
const persist = (key: string, value: string, announce = false): Promise<boolean> => {
  return storageSet(key, value)
    .then(() => {
      if (announce) getHistoryChannel()?.postMessage({ tab: TAB_ID, type: 'updated' });
      return true;
    })
    .catch((error) => {
      alertStorageProblem(error);
      return false;
    });
};

/**
 * Same as saveConversations but lets the caller wait until the data is really written. Resolves to false if
 * the write failed (the user has been told); callers that are about to delete another copy MUST check it.
 */
export const saveConversationsAsync = (conversations: Conversation[]): Promise<boolean> => {
  if (historyWritesBlocked) {
    console.error('Refusing to write the conversation history: it could not be read at startup');
    return Promise.resolve(false);
  }
  try {
    return persist('conversationHistory', JSON.stringify(conversations), true);
  } catch (error) {
    alertStorageProblem(error);
    return Promise.resolve(false);
  }
};

export const saveConversations = (conversations: Conversation[]) => {
  void saveConversationsAsync(conversations);
};

export const saveConversationDirect = (conversation: Conversation) => {
  try {
    void persist('selectedConversation', JSON.stringify(conversation));
  } catch (error) {
    alertStorageProblem(error);
  }
};

export const saveConversationsDirect = (conversations: Conversation[]) => {
  void saveConversationsAsync(conversations);
};

/**
 * Replace the entry with the same id, or append it when the list has no such entry (e.g. the list was
 * replaced by a sync while the chat was streaming). Never silently drops the chat - except one the user
 * deleted in this session.
 */
export const upsertConversationEntry = (list: Conversation[], entry: Conversation): Conversation[] => {
  let found = false;
  const updated = list.map((c) => {
    if (c.id === entry.id) { found = true; return entry; }
    return c;
  });
  if (found) return updated;
  // a chat the user deleted meanwhile (e.g. while its answer was still streaming) must stay deleted
  if (deletedConversationIds.has(entry.id)) return list;
  return [...updated, entry];
};



export const conversationWithCompressedMessages = (conversation: Conversation) => {
  //already compresed
  if ((!conversation.messages || conversation.messages.length === 0) && conversation.compressedMessages) return conversation;
  const compressedMessages = compressMessages(conversation.messages);
  // compression failing must never turn real messages into an empty chat: keep them as they are
  if (conversation.messages?.length > 0 && compressedMessages.length === 0) return conversation;
  return {...conversation, messages: [], compressedMessages: compressedMessages} as Conversation;
}

export const conversationWithUncompressedMessages = (conversation: Conversation) => {
  if (!conversation.compressedMessages && conversation.messages) return conversation;
  const compressedMessage = conversation.compressedMessages ?? [];
  const uncompressedMessages = tryUncompressMessages(compressedMessage);
  if (uncompressedMessages === null) {
    // The stored blob could not be read. Keep it untouched (it may be recoverable later) instead of showing
    // an empty chat whose next save would overwrite it for good.
    console.error('Could not read the stored messages of conversation', conversation.id);
    return {...conversation, messages: [], compressedMessages: undefined,
            corruptCompressedMessages: conversation.corruptCompressedMessages ?? compressedMessage} as Conversation;
  }
  return {...conversation, messages: uncompressedMessages, compressedMessages: undefined} as Conversation;
}

export const compressAllConversationMessages = (conversations: Conversation[]) => {
    return conversations.map((c) => {
        try {
          if (isLocalConversation(c) && c.compressedMessages === undefined) {
            const compressed = compressMessages(c.messages);
            return {...c, messages: [], compressedMessages : compressed}
          } else if (isRemoteConversation(c) && c.messages?.length > 0) {
            return remoteForConversationHistory(c);
          }
        } catch {
          console.log("Failed to compress all messages: ", c);
        }
        return c; 
    });
}




export const compressConversation = (conversation: Conversation) => {
  try {
    const data = JSON.stringify(conversation);
    return lzwCompress(data);
  } catch {
    console.log("Failed to compress conversations")
  }
}

export const uncompressConversation = (compressedData: number[]) => {
  try {
    const converstion: string = lzwUncompress(compressedData);
    return JSON.parse(converstion) as Conversation;
  } catch {
    console.log("Failed to uncompress conversations")
    return undefined;
  }
}

export const remoteForConversationHistory = (conversation: Conversation) => {
  const CloudConvAttr: (keyof Conversation)[] =  ['id', 'name', 'model', 'folderId', 'tags', 'isLocal', 'groupType', 'codeInterpreterRecordId', 'date'];
  const stub = pickConversationAttributes(conversation, CloudConvAttr) as Conversation;
  // remember how many messages the stored chat has, so the stub is not mistaken for an empty placeholder
  // A known count of 0 is kept too: it is what tells a blank new chat (nothing in the cloud) from a stub
  // whose size is simply unknown. An unknown count stays unknown.
  const messageCount = conversation.messages?.length ? conversation.messages.length : conversation.messageCount;
  if (messageCount !== undefined) stub.messageCount = messageCount;
  return stub;
};

function pickConversationAttributes<T extends object, K extends keyof T>(obj: T, props: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  props.forEach(prop => {
      if (prop in obj) {
          result[prop] = obj[prop];
      }
  });
 
  return {...result, messages: []} ;
}