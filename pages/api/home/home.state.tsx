import { Conversation, Message } from '@/types/chat';
import { ErrorMessage } from '@/types/error';
import { FolderInterface } from '@/types/folder';
import { OpenAIModel, OpenAIModelID } from '@/types/openai';
import { PluginKey } from '@/types/plugin';
import { Prompt } from '@/types/prompt';
import { WorkflowDefinition } from "@/types/workflow";
import { Status } from "@/types/workflow";
import {Workspace} from "@/types/workspace";
import { v4 as uuidv4 } from 'uuid';
import {Assistant, DEFAULT_ASSISTANT} from "@/types/assistant";
import {noOpStatsServices, StatsServices} from "@/types/stats";
import {Account} from "@/types/accounts";

export interface HomeInitialState {
  defaultAccount: Account|undefined;
  chatEndpoint: string|null;
  conversationStateId: string;
  apiKey: string;
  pluginKeys: PluginKey[];
  loading: boolean;
  lightMode: 'light' | 'dark';
  messageIsStreaming: boolean;
  modelError: ErrorMessage | null;
  status: Status[];
  models: OpenAIModel[];
  folders: FolderInterface[];
  conversations: Conversation[];
  workflows:WorkflowDefinition[];
  selectedConversation: Conversation | undefined;
  currentMessage: Message | undefined;
  prompts: Prompt[];
  temperature: number;
  showChatbar: boolean;
  showPromptbar: boolean;
  workspaceDirty: boolean;
  currentFolder: FolderInterface | undefined;
  messageError: boolean;
  searchTerm: string;
  defaultModelId: OpenAIModelID | undefined;
  serverSideApiKeyIsSet: boolean;
  serverSidePluginKeysSet: boolean,
  featureFlags: {[key:string]:boolean},
  workspaceMetadata: Workspace;
  selectedAssistant: Assistant | null;
  page: string;
  defaultFunctionCallModel: string | null;
  statsService: StatsServices;
}

export const initialState: HomeInitialState = {
  defaultAccount: undefined,
  chatEndpoint: null,
  conversationStateId: "init",
  apiKey: '',
  loading: false,
  pluginKeys: [],
  lightMode: 'dark',
  status: [],
  workspaceDirty: false,
  messageIsStreaming: false,
  modelError: null,
  models: [],
  folders: [],
  conversations: [],
  workflows:[

  ],
  workspaceMetadata: {
    name: '',
    description: '',
    id: uuidv4(),
    // populate with date tiem string in iso format
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    tags:[],
    data: {},
  },
  selectedConversation: undefined,
  currentMessage: undefined,
  prompts: [],
  temperature: 1,
  showPromptbar: true,
  showChatbar: true,
  currentFolder: undefined,
  messageError: false,
  searchTerm: '',
  defaultModelId: undefined,
  serverSideApiKeyIsSet: false,
  serverSidePluginKeysSet: false,
  selectedAssistant: null,
  page: 'chat',
  featureFlags: {
    uploadDocuments:true,
    overrideUneditablePrompts:false,
    overrideInvisiblePrompts: false,
    extractDocumentsLocally:false,
    enableMarket:false,
    promptPrefixCreate: false,
    outputTransformerCreate: false,
    workflowRun:true,
    workflowCreate:false,
    rootPromptCreate:true,
    pluginsOnInput:false,
    followUpCreate:true,
    marketItemDelete:false,
  },
  statsService: noOpStatsServices,
  defaultFunctionCallModel: null,
};
