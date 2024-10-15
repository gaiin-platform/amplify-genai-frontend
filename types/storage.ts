import { Conversation } from './chat';
import { ConversationStorage } from './conversationStorage';
import { FolderInterface, SortType } from './folder';
import { PluginLocation } from './plugin';
import { Prompt } from './prompt';

// keep track of local storage schema
export interface LocalStorage {
  conversationHistory: Conversation[];
  selectedConversation: Conversation;
  theme: 'light' | 'dark';
  // added folders (3/23/23)
  folders: FolderInterface[];
  // added prompts (3/26/23)
  prompts: Prompt[];
  // added showChatbar and showPromptbar (3/26/23)
  showChatbar: boolean;
  showPromptbar: boolean;
  storageSelection: ConversationStorage;
  pluginLocation: PluginLocation;
  chatFolderSort: SortType,
  promptFolderSort: SortType;
}
