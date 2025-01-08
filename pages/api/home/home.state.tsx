import { Conversation, Message } from '@/types/chat';
import { ErrorMessage } from '@/types/error';
import { FolderInterface} from '@/types/folder';
import { Model, Models } from '@/types/model';
import { Prompt } from '@/types/prompt';
import { WorkflowDefinition } from "@/types/workflow";
import { Status } from "@/types/workflow";
import { Workspace } from "@/types/workspace";
import { v4 as uuidv4 } from 'uuid';
import { Assistant } from "@/types/assistant";
import { noOpStatsServices, StatsServices } from "@/types/stats";
import { Account } from "@/types/accounts";
import {Op} from "@/types/op";
import {CheckItemType} from "@/types/checkItem";
import { PluginLocation } from '@/types/plugin';
import { Group } from '@/types/groups';
import { Artifact } from '@/types/artifacts';


export interface HomeInitialState {
  defaultAccount: Account | undefined;
  chatEndpoint: string | null;
  conversationStateId: string;
  loading: boolean;
  lightMode: 'light' | 'dark';
  messageIsStreaming: boolean;
  artifactIsStreaming: boolean
  modelError: ErrorMessage | null;
  status: Status[];

  // models: Model[]; // models shown to the user 
  availableModels: Models, 
  defaultModelId: string | undefined; // user settings will have priority over this value else come from admin settings
  cheapestModelId: string | undefined;
  advancedModelId: string | undefined;

  folders: FolderInterface[];
  conversations: Conversation[];
  artifacts: any[];
  workflows: WorkflowDefinition[];
  selectedConversation: Conversation | undefined;
  currentMessage: Message | undefined;
  selectedArtifacts: Artifact[] | undefined;
  prompts: Prompt[];
  temperature: number;
  showChatbar: boolean;
  showPromptbar: boolean;
  workspaceDirty: boolean;
  currentFolder: FolderInterface | undefined;
  messageError: boolean;
  searchTerm: string;
  featureFlags: { [key: string]: boolean },
  workspaceMetadata: Workspace;
  selectedAssistant: Assistant | null;
  page: string;
  statsService: StatsServices;
  currentRequestId: string | null;
  inputEmail: string;
  hasScrolledToBottom: boolean;
  storageSelection: string | null;
  ops: { [key: string]: Op };
  allFoldersOpenConvs: boolean;
  allFoldersOpenPrompts: boolean;
  checkedItems: Array<any>;
  checkingItemType: CheckItemType | null;
  pluginLocation: PluginLocation;
  groups: Group[];
  syncingConversations: boolean;
  syncingPrompts: boolean;
  hiddenGroupFolders: FolderInterface[];
  powerPointTemplateOptions: string[];
  amplifyUsers: string[];

}

export const initialState: HomeInitialState = {
  defaultAccount: undefined,
  chatEndpoint: null,
  conversationStateId: "init",
  loading: false,
  lightMode: 'dark',
  status: [],
  workspaceDirty: false,
  messageIsStreaming: false,
  artifactIsStreaming: false,
  modelError: null,
  // models: [],
  availableModels: {},
  defaultModelId: undefined,
  cheapestModelId: undefined,
  advancedModelId: undefined,
  folders: [],
  conversations: [],
  artifacts:[], // for saved/remote artifacts
  workflows: [],
  ops: {},
  workspaceMetadata: {
    name: '',
    description: '',
    id: uuidv4(),
    // populate with date tiem string in iso format
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    tags: [],
    data: {},
  },
  selectedConversation: undefined,
  currentMessage: undefined,
  selectedArtifacts: undefined,
  prompts: [],
  temperature: 1,
  showPromptbar: true,
  showChatbar: true,
  currentFolder: undefined,
  messageError: false,
  searchTerm: '',
  selectedAssistant: null,
  page: 'chat',
  currentRequestId: null,

  featureFlags: {},

  statsService: noOpStatsServices,
  inputEmail: '',
  hasScrolledToBottom: false,
  storageSelection: null,
  allFoldersOpenConvs: false,
  allFoldersOpenPrompts: false,
  checkedItems: [],
  checkingItemType: null,
  pluginLocation: {x:100, y:-250},
  groups: [],
  syncingConversations: true,
  syncingPrompts: true,
  hiddenGroupFolders: [],
  powerPointTemplateOptions: [],
  amplifyUsers: []
};
