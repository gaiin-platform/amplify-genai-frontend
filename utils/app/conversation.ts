import { Conversation, Message } from '@/types/chat';
import { lzwCompress, lzwUncompress } from '@/utils/app/lzwCompression';
import { compressMessages, uncompressMessages } from './messages';
import { isLocalConversation } from './conversationStorage';

export const updateConversation = (
  updatedConversation: Conversation,
  allConversations: Conversation[],
) => {
  const updatedConversations = allConversations.map((c) => {
    if (c.id === updatedConversation.id) {
      return conversationWithCompressedMessages(updatedConversation);
    }
    return c;
  });

  saveConversations(updatedConversations);

  return {
    single: updatedConversation,
    all: updatedConversations,
  };
};

export const saveConversations = (conversations: Conversation[]) => {
  try {
    localStorage.setItem('conversationHistory', JSON.stringify(conversations));
  } catch (error) {
    alert("You have exceeded your available storage space for conversations. Please delete some converations before continuing. You can export your current conversations before deleting them.");
  }
};

export const saveConversationDirect = (conversation: Conversation) => {
  try {
    localStorage.setItem('selectedConversation', JSON.stringify(conversation));
  } catch (error) {
    alert("You have exceeded your available storage space for conversations. Please delete some converations before continuing. You can export your current conversations before deleting them.");
  }
};

export const saveConversationsDirect = (conversations: Conversation[]) => {
  try {
    localStorage.setItem('conversationHistory', JSON.stringify(conversations));
  } catch (error) {
    alert("You have exceeded your available storage space for conversations. Please delete some converations before continuing. You can export your current conversations before deleting them.");
  }
};

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


export const compressAllConversationMessages = (conversations: Conversation[]) => {
  try {
    return conversations.map((c) => {
      if (isLocalConversation(c) && c.compressedMessages === undefined) {
         const compressed = compressMessages(c.messages);
         return {...c, messages: [], compressedMessages : compressed}
      }
      return c; 
    });
  } catch {
    console.log("Failed to compress all messages");
    return conversations;
  }
}

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
