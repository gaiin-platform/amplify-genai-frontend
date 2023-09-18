import { Dispatch, createContext } from 'react';

import { ActionType } from '@/hooks/useCreateReducer';

import { Conversation } from '@/types/chat';
import { KeyValuePair } from '@/types/data';
import { FolderType } from '@/types/folder';

import { HomeInitialState } from './home.state';

export type Processor = (data:any) => {};

export interface HomeContextProps {
  state: HomeInitialState;
  dispatch: Dispatch<ActionType<HomeInitialState>>;
  handleNewConversation: (params: {}) => void;
  handleCreateFolder: (name: string, type: FolderType) => void;
  handleDeleteFolder: (folderId: string) => void;
  handleUpdateFolder: (folderId: string, name: string) => void;
  handleSelectConversation: (conversation: Conversation) => void;
  handleUpdateConversation: (
    conversation: Conversation,
    data: KeyValuePair,
  ) => void;

  // New callback-related operations.
  preProcessingCallbacks: Processor[];
  postProcessingCallbacks: Processor[];
  addPreProcessingCallback: (callback: Processor) => void;
  removePreProcessingCallback: (callback: Processor) => void;
  addPostProcessingCallback: (callback: Processor) => void;
  removePostProcessingCallback: (callback: Processor) => void;
}

const HomeContext = createContext<HomeContextProps>(undefined!);

export default HomeContext;
