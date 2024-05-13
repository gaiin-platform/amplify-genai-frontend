import { Dispatch, createContext } from 'react';

import { ActionType } from '@/hooks/useCreateReducer';

import { Conversation } from '@/types/chat';
import { SupportedExportFormats } from '@/types/export';

import { ChatbarInitialState } from './Chatbar.state';
import {FolderInterface} from "@/types/folder";

export interface ChatbarContextProps {
  state: ChatbarInitialState;
  dispatch: Dispatch<ActionType<ChatbarInitialState>>;
  handleDeleteConversation: (conversation: Conversation) => void;
  handleClearConversations: () => void;
  handleExportData: () => void;
  handleImportConversations: (data: SupportedExportFormats) => void;
  handleShareFolder: (folder: FolderInterface) => void;
}

const ChatbarContext = createContext<ChatbarContextProps>(undefined!);

export default ChatbarContext;
