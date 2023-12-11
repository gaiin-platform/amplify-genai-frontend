import { useMemo, useReducer } from 'react';
import {HomeInitialState} from "@/pages/api/home/home.state";
import {Conversation, Message} from "@/types/chat";
import {saveConversation} from "@/utils/app/conversation";
import {v4 as uuidv4} from "uuid";

// Extracts property names from initial state of reducer to allow typesafe dispatch objects
export type FieldNames<T> = {
  [K in keyof T]: T[K] extends string ? K : K;
}[keyof T];


// Returns the Action Type for the dispatch object to be used for typing in things like context
export type ActionType<T> =
    | { type: 'reset' }
    | { type: 'append'; field: FieldNames<T>; value: any  }
    | { type?: 'change'; field: FieldNames<T>; value: any };

// Returns a typed dispatch and state
export const useHomeReducer = ({ initialState }: { initialState: HomeInitialState }) => {
  type Action =
      | { type: 'reset' }
      | { type: 'append'; field: FieldNames<HomeInitialState>; value: any  }
      | { type?: 'change'; field: FieldNames<HomeInitialState>; value: any };


  const reducer = (state: HomeInitialState, action: Action) => {

    let dirty = (action.type === 'reset') ||
        (action.field && action.field === 'prompts') ||
        (action.field && action.field === 'folders') ||
        (action.field && action.field === 'conversations');

    if (!action.type){
      let stateId = state.conversationStateId;
      if(action.field === 'selectedConversation' || action.field === 'conversations') {
         stateId = uuidv4();
      }
      return { ...state, conversationStateId: stateId, [action.field]: action.value, workspaceDirty: dirty};
    }

    if (action.type === 'append') {
      const curr = state[action.field] as [];
      return { ...state, [action.field]: [...curr, action.value], workspaceDirty: dirty };
    }

    if (action.type === 'reset') return initialState;

    throw new Error();
  };

  const [state, dispatch] = useReducer(reducer, initialState);

  return useMemo(() => ({ state, dispatch }), [state, dispatch]);
};
