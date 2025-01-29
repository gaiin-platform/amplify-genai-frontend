import { Dispatch, createContext } from 'react';

//import { ActionType } from '@/hooks/useCreateReducer';
import { ActionType, ConversationAction } from '@/hooks/useHomeReducer';

import {Conversation, Message} from '@/types/chat';
import { KeyValuePair } from '@/types/data';
import { FolderInterface, FolderType } from '@/types/folder';

import { HomeInitialState } from './home.state';
import {Account} from "@/types/accounts";
import { DefaultModels, Model } from '@/types/model';

export type Processor = (data:any) => {};

export interface ClickContext {
  message?: Message;
  conversation?: Conversation;
  [key:string] : any
}

export interface HomeContextProps {
  state: HomeInitialState;
  dispatch: Dispatch<ActionType<HomeInitialState>>;
  handleNewConversation: (params: {}) => void;
  handleCreateFolder: (name: string, type: FolderType) => FolderInterface;
  handleDeleteFolder: (folderId: string) => void;
  handleUpdateFolder: (folderId: string, name: string) => void;
  handleForkConversation: (messageIndex: number, setAsSelected?: boolean) => Promise<void>;
  shouldStopConversation: () => boolean;
  handleSelectConversation: (conversation: Conversation) => void;
  handleUpdateConversation: (
    conversation: Conversation,
    data: KeyValuePair,
  ) => void;
  handleUpdateSelectedConversation: (conversation: Conversation,) => void;
  handleAddMessages: (selectedConversation: Conversation | undefined, messages: any[]) => void;
  handleConversationAction: (conversationAction: ConversationAction) => Promise<void>;
  getCompleteConversation: (selectedConversation: Conversation) => Promise<Conversation | null | undefined>;
  // New callback-related operations.
  preProcessingCallbacks: Processor[];
  postProcessingCallbacks: Processor[];
  addPreProcessingCallback: (callback: Processor) => void;
  removePreProcessingCallback: (callback: Processor) => void;
  addPostProcessingCallback: (callback: Processor) => void;
  removePostProcessingCallback: (callback: Processor) => void;
  clearWorkspace: () => Promise<void>;
  setLoadingMessage: (s:string) => void;
  getDefaultModel: (defaultType: DefaultModels) => Model;
}

const HomeContext = createContext<HomeContextProps>(undefined!);

export default HomeContext;
