import { Dispatch, createContext } from 'react';

import { ActionType } from '@/hooks/useCreateReducer';

import { Prompt } from '@/types/prompt';

import { PromptbarInitialState } from './Promptbar.state';
import {FolderInterface} from "@/types/folder";

export interface PromptbarContextProps {
  state: PromptbarInitialState;
  dispatch: Dispatch<ActionType<PromptbarInitialState>>;
  handleCreatePrompt: () => void;
  handleAddPrompt: (prompt: Prompt) => void;
  handleDeletePrompt: (prompt: Prompt) => void;
  handleUpdatePrompt: (prompt: Prompt) => void;
  handleSharePrompt: (prompt: Prompt) => void;
  handleShareFolder: (folder: FolderInterface) => void;
}

const PromptbarContext = createContext<PromptbarContextProps>(undefined!);

export default PromptbarContext;
