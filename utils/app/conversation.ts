import { Conversation } from '@/types/chat';

export const updateConversation = (
  updatedConversation: Conversation,
  allConversations: Conversation[],
) => {
  const updatedConversations = allConversations.map((c) => {
    if (c.id === updatedConversation.id) {
      return updatedConversation;
    }

    return c;
  });

  saveConversation(updatedConversation);
  saveConversations(updatedConversations);

  return {
    single: updatedConversation,
    all: updatedConversations,
  };
};

export const saveConversation = (conversation: Conversation) => {
  try {
    //localStorage.setItem('selectedConversation', JSON.stringify(conversation));
  } catch (error) {
    alert("You have exceeded your available storage space for conversations. Please delete some converations before continuing. You can export your current conversations before deleting them.");
  }
};

export const saveConversations = (conversations: Conversation[]) => {
  try {
    //localStorage.setItem('conversationHistory', JSON.stringify(conversations));
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
