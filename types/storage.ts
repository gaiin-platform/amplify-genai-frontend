import { Conversation } from './chat';
import { ConversationStorage } from './conversationStorage';
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
  // added folders (3/23/23)
  folders: FolderInterface[];
  // added prompts (3/26/23)
  prompts: Prompt[];
  // added showChatbar and showPromptbar (3/26/23)
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
}
