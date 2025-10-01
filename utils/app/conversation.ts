import { Conversation, Message } from '@/types/chat';
import { lzwCompress, lzwUncompress } from '@/utils/app/lzwCompression';
import { compressMessages, uncompressMessages } from './messages';
import { deleteCodeInterpreterConversation } from '@/services/codeInterpreterService';
import { deleteRemoteConversation } from '@/services/remoteConversationService';
import { storageSet } from './storage';

export const updateConversation = (
  updatedConversation: Conversation, // expected to be the complete conversation 
  allConversations: Conversation[],
) => {
  const updatedConversations = allConversations.map((c) => {
    if (c.id === updatedConversation.id) {
      return condenseForConversationHistory(updatedConversation);
    }
    return c;
  });
  
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


export const deleteConversationCleanUp = (conversation: Conversation) => {
  if (conversation.codeInterpreterAssistantId) deleteCodeInterpreterConversation(conversation);
  if (isRemoteConversation(conversation)) deleteRemoteConversation(conversation.id);
}



export const saveConversations = (conversations: Conversation[]) => {
  // TODO ensure all conversations are compressed or stripped
  try {
    storageSet('conversationHistory', JSON.stringify(conversations));
  } catch (error) {
    alert("You have exceeded your available storage space for conversations. Please delete some converations before continuing. You can export your current conversations before deleting them.");
  }
};

export const saveConversationDirect = (conversation: Conversation) => {
  try {
    storageSet('selectedConversation', JSON.stringify(conversation));
  } catch (error) {
    alert("You have exceeded your available storage space for conversations. Please delete some converations before continuing. You can export your current conversations before deleting them.");
  }
};

export const saveConversationsDirect = (conversations: Conversation[]) => {
  try {
    storageSet('conversationHistory', JSON.stringify(conversations));
  } catch (error) {
    alert("You have exceeded your available storage space for conversations. Please delete some converations before continuing. You can export your current conversations before deleting them.");
  }
};



export const conversationWithCompressedMessages = (conversation: Conversation) => {
  //already compresed
  if ((!conversation.messages || conversation.messages.length === 0) && conversation.compressedMessages) return conversation;
  const compressedMessages = compressMessages(conversation.messages);
  return {...conversation, messages: [], compressedMessages: compressedMessages} as Conversation;
}

export const conversationWithUncompressedMessages = (conversation: Conversation) => {
  if (!conversation.compressedMessages && conversation.messages) return conversation;
  const compressedMessage = conversation.compressedMessages ?? [];
  const uncompressedMessages = uncompressMessages(compressedMessage);
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
  } 
}

export const remoteForConversationHistory = (conversation: Conversation) => {
  const CloudConvAttr: (keyof Conversation)[] =  ['id', 'name', 'model', 'folderId', 'tags', 'isLocal', 'groupType', 'codeInterpreterAssistantId' ];
  return pickConversationAttributes(conversation, CloudConvAttr) as Conversation;
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