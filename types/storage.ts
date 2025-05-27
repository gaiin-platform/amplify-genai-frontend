import { Conversation } from './chat';
import { ConversationStorage } from './conversationStorage';
import { SharedItem } from './export';
import { FolderInterface, SortType } from './folder';
import { Model } from './model';
import { PluginLocation } from './plugin';
import { PluginID } from './plugin';

import { Prompt } from './prompt';

// keep track of local storage schema
export interface LocalStorage {
  conversationHistory: Conversation[];
  selectedConversation: Conversation;
  theme: 'light' | 'dark';
  folders: FolderInterface[];
  prompts: Prompt[];
  showChatbar: boolean;
  showPromptbar: boolean;
  storageSelection: ConversationStorage;
  pluginLocation: PluginLocation;
  enabledPlugins: {[key in PluginID] : boolean};
  chatFolderSort: SortType,
  promptFolderSort: SortType;
  hiddenGroupFolders: FolderInterface[];
  defaultModel: Model// curretly used for the on load conversation because the models do not come until after 
  mixPanelOn: boolean;
  archiveConversationPastNumOfDays: number;
  workspaces: SharedItem[];
  stickyChatbar: boolean;
}
