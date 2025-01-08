import { useMemo, useReducer } from 'react';
import {HomeInitialState} from "@/pages/api//home/home.state";
import {Conversation, Message} from "@/types/chat";
import {condenseForConversationHistory} from "@/utils/app/conversation";
import {v4 as uuidv4} from "uuid";

// Extracts property names from initial state of reducer to allow typesafe dispatch objects
export type FieldNames<T> = {
  [K in keyof T]: T[K] extends string ? K : K;
}[keyof T];


type ConversationActionType =
    | "addMessage"
    | "deleteMessage"
    | "updateMessage";


type DeleteMessageData = {
  messsageId: string
}

export type UpdateMessageData = {
  messsage: Message
}

type ConversationAddMessageAction = {
  type: "addMessages",
  conversation: Conversation,
  afterMessageId?: string,
  messages: Message[],
}

type ConversationDeleteMessageAction = {
  type: "deleteMessages",
  conversation: Conversation,
  messages: Message[],
}

type ConversationUpdateMessageAction = {
  type: "updateMessages",
  conversation: Conversation,
  messages: Message[],
}

type ConversationChangeFolderAction = {
  type: "changeFolder",
  conversation: Conversation,
  folderId: string,
}

export type ConversationAction =
    ConversationAddMessageAction |
    ConversationDeleteMessageAction |
    ConversationUpdateMessageAction |
    ConversationChangeFolderAction;

// Returns the Action Type for the dispatch object to be used for typing in things like context
export type ActionType<T> =
    | { type: 'reset' }
    | { type: 'conversation', action: ConversationAction }
    | { type: 'append'; field: FieldNames<T>; value: any  }
    | { type?: 'change'; field: FieldNames<T>; value: any };

// Returns a typed dispatch and state
export const useHomeReducer = ({ initialState }: { initialState: HomeInitialState }) => {
  type Action =
      | { type: 'reset' }
      | { type: 'conversation', action: ConversationAction }
      | { type: 'append'; field: FieldNames<HomeInitialState>; value: any  }
      | { type?: 'change'; field: FieldNames<HomeInitialState>; value: any };

  const updateConversation = (conversation:Conversation, messages:Message[], editStart:number, editEnd:number) => {
    if (editStart === -1) return conversation;

    let limit = editEnd > -1 ? editEnd : conversation.messages.length;

    const updatedMessages = [
      ...conversation.messages.slice(0, editStart),
      ...messages,
      ...conversation.messages.slice(editEnd)];

    return {
      ...conversation,
      messages: updatedMessages,
    };
  }

  const updateMessage = (conversation:Conversation, message:Message) => {
    // Find the index of the message with the given id in the conversation
    const insertIndex = conversation.messages.findIndex(
        (m) => message.id === m.id,
    );

    return updateConversation(conversation, [message], insertIndex, insertIndex + 1);
  }

  const addMessage = (conversation:Conversation, message:Message, afterMessageId?:string) => {
    // Find the index of the message with the given id in the conversation
    const messageIndex = afterMessageId ? conversation.messages.findIndex(
        (message) => message.id === afterMessageId,
    ) : -1;

    // If the message is not found, append the message to the end of the conversation
    const insertIndex = messageIndex === -1 ? conversation.messages.length : messageIndex;
    return updateConversation(conversation, [message], insertIndex, insertIndex);
  }

  const deleteMessage = (conversation:Conversation, messageId:string) => {
    // Find the index of the message with the given id in the conversation
    const messageIndex = conversation.messages.findIndex(
        (message) => message.id === messageId,
    );

    if (messageIndex === -1) return conversation;

    return updateConversation(conversation, [], messageIndex, messageIndex);
  }

  const handleConversationAction = (state: HomeInitialState,
                          action: ConversationAction) => {

    const {conversations, selectedConversation} = state;

    // Find the conversation with the given id
    const conversationFound = conversations.find(
        (conversation) => conversation.id === action.conversation.id,
    );

    if(!conversationFound) return state;

    let conversation = action.conversation;

    const doUpdate = (action:ConversationAction) => {
      switch (action.type) {
        case "addMessages":
            return action.messages.reduce(
                (conversation, message) => addMessage(conversation, message, action.afterMessageId),
                conversation,
            );
        case "deleteMessages":
          return action.messages.reduce(
              (conversation, message) => deleteMessage(conversation, message.id),
              conversation,
          );
        case "updateMessages":
          return action.messages.reduce(
              (conversation, message) => updateMessage(conversation, message),
              conversation,
          );
        case "changeFolder":
            return {
                ...conversation,
                folderId: action.folderId,
            };
      }
    };

    const updatedConversation = doUpdate(action);
    // console.log("updated: ", updatedConversation);

    const updatedConversationForHistory  = condenseForConversationHistory(updatedConversation);


    const updatedConversations = conversations.map(
        (c) => {
          if (c.id === conversation.id) return updatedConversationForHistory;
          return c;
        },
    );

    if (updatedConversations.length === 0) updatedConversations.push(updatedConversationForHistory);

    const updatedSelectedConversation = selectedConversation && selectedConversation.id === conversation.id ? updatedConversation : selectedConversation;
    // console.log("selected new: ", updatedSelectedConversation);

    return {
        ...state,
        conversationStateId: uuidv4(),
        conversations: updatedConversations,
        selectedConversation: updatedSelectedConversation,
    }
  }

  const reducer = (state: HomeInitialState, action: Action) => {

    let dirty = (action.type === 'reset') ||
        (action.type === 'conversation') ||
        (action.field && action.field === 'prompts') ||
        (action.field && action.field === 'folders') ||
        (action.field && action.field === 'conversations');

    if (!action.type){
      let stateId = state.conversationStateId;
      if(stateId !== 'init' && action.field === 'selectedConversation' || action.field === 'conversations') {
         stateId = uuidv4();
      }
      return { ...state, conversationStateId: stateId, [action.field]: action.value, workspaceDirty: dirty};
    }

    if (action.type === 'append') {
      const curr = state[action.field] as [];
      return { ...state, [action.field]: [...curr, action.value], workspaceDirty: dirty };
    }

    if (action.type === 'reset') return initialState;

    if (action.type === 'conversation') return handleConversationAction(state, action.action);

    throw new Error();
  };

  const [state, dispatch] = useReducer(reducer, initialState);

  return useMemo(() => ({ state, dispatch }), [state, dispatch]);
};
