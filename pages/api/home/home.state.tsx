import { Conversation, Message } from '@/types/chat';
import { ErrorMessage } from '@/types/error';
import { FolderInterface, SortType } from '@/types/folder';
import { OpenAIModel, OpenAIModelID } from '@/types/openai';
import { Prompt } from '@/types/prompt';
import { WorkflowDefinition } from "@/types/workflow";
import { Status } from "@/types/workflow";
import { Workspace } from "@/types/workspace";
import { v4 as uuidv4 } from 'uuid';
import { Assistant } from "@/types/assistant";
import { noOpStatsServices, StatsServices } from "@/types/stats";
import { Account } from "@/types/accounts";


type HandleSend = (request: any) => void;

export interface HomeInitialState {
  defaultAccount: Account | undefined;
  chatEndpoint: string | null;
  conversationStateId: string;
  loading: boolean;
  lightMode: 'light' | 'dark';
  messageIsStreaming: boolean;
  modelError: ErrorMessage | null;
  status: Status[];
  models: OpenAIModel[];
  folders: FolderInterface[];
  conversations: Conversation[];
  workflows: WorkflowDefinition[];
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
  featureFlags: { [key: string]: boolean },
  workspaceMetadata: Workspace;
  selectedAssistant: Assistant | null;
  page: string;
  defaultFunctionCallModel: string | null;
  statsService: StatsServices;
  currentRequestId: string | null;
  latestDataDisclosureUrlPDF: string;
  latestDataDisclosureHTML: string;
  inputEmail: string;
  hasAcceptedDataDisclosure: boolean | null;
  hasScrolledToBottom: boolean;
  checkFolders: boolean;
  allFoldersOpenConvs: boolean;
  checkConversations: boolean;
  convFolderSort: SortType;
  allFoldersOpenPrompts: boolean;
  checkPrompts: boolean;
  promptFolderSort: SortType;
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
  modelError: null,
  models: [],
  folders: [],
  conversations: [],
  workflows: [

  ],
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
  prompts: [],
  temperature: 1,
  showPromptbar: true,
  showChatbar: true,
  currentFolder: undefined,
  messageError: false,
  searchTerm: '',
  defaultModelId: undefined,
  selectedAssistant: null,
  page: 'chat',
  currentRequestId: null,

  featureFlags: {
    assistantsEnabled: true,
    ragEnabled: true,
    sourcesEnabled: true,
    uploadDocuments: true,
    assistantCreator: true,
    assistants: true,
    overrideUneditablePrompts: false,
    overrideInvisiblePrompts: false,
    extractDocumentsLocally: false,
    enableMarket: false,
    promptPrefixCreate: false,
    outputTransformerCreate: false,
    workflowRun: true,
    workflowCreate: false,
    rootPromptCreate: true,
    pluginsOnInput: false,
    dataSourceSelectorOnInput: true,
    followUpCreate: true,
    marketItemDelete: false,
    automation: false,
    codeInterpreterEnabled: true,
    dataDisclosure: false,
    inCognitoGroup: true
  },

  statsService: noOpStatsServices,
  defaultFunctionCallModel: null,
  latestDataDisclosureUrlPDF: '',
  latestDataDisclosureHTML: '',
  inputEmail: '',
  hasAcceptedDataDisclosure: null,
  hasScrolledToBottom: false,
  checkFolders: false,
  allFoldersOpenConvs: false,
  checkConversations: false,
  convFolderSort: 'date',
  allFoldersOpenPrompts: false,
  checkPrompts: false,
  promptFolderSort: 'name'

};
