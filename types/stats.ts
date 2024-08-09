import {ExportFormatV4} from "@/types/export";
import {ConversionOptions} from "@/services/downloadService";
import {MarketItem} from "@/types/market";
import {Prompt} from "@/types/prompt";
import {ChatBody, Conversation, Message} from "@/types/chat";
import { ApiKey } from "./apikeys";

export interface StatsServices {
    marketItemPublishEvent: (
        publishingName: string,
        publishedDescription: string,
        selectedCategory: string,
        selectedTags: string[],
        sharedData: ExportFormatV4
    ) => void;

    downloadItemEvent: (
        conversionOptions: ConversionOptions,
        sharedData: ExportFormatV4
    ) => void;

    sharedItemEvent: (
        sharedBy: string,
        sharedWith: string[],
        sharingNote: string,
        sharedData: ExportFormatV4
    ) => void;

    sharedItemAcceptedEvent: (
        sharedBy: string,
        sharingNote: string,
        sharedData: ExportFormatV4
    ) => void;

    setThemeEvent: (theme: string) => void;

    attachFileEvent: (
        file: File,
        maxFileSizeEnforced: boolean,
        uploadDocuments: boolean
    ) => void;

    searchConversationsEvent: (searchTerm: string) => void;

    searchPromptsEvent: (searchTerm: string) => void;

    tryMarketItemEvent: (item: MarketItem) => void;

    installMarketItemEvent: (item: MarketItem) => void;

    viewMarketItemEvent: (item: MarketItem) => void;

    openMarketEvent: () => void;

    openSharedItemsEvent: () => void;

    openSettingsEvent: () => void;

    openWorkspacesEvent: () => void;

    openConversationsEvent: () => void;

    newConversationEvent: () => void;

    startConversationEvent: (prompt: Prompt) => void;

    deleteConversationEvent: (conversation: Conversation) => void;

    createConversationEvent: (conversation: Conversation) => void;

    moveConversationRemoteEvent: (conversation: Conversation) => void;

    moveConversationFromRemoteEvent: (conversation: Conversation) => void;

    sendChatEvent: (chatBody: ChatBody) => void;

    sendChatRewriteEvent: (chatBody: ChatBody, updateIndex: number) => void;

    runPromptEvent: (prompt: Prompt) => void;

    customLinkClickEvent: (message: Message, href: string) => void;

    createPromptEvent: (prompt: Prompt) => void;

    editPromptStartedEvent: (prompt: Prompt) => void;

    deletePromptEvent: (prompt: Prompt) => void;

    editPromptCanceledEvent: (prompt: Prompt) => void;

    editPromptCompletedEvent: (prompt: Prompt) => void;
    
    getApiKey: (id: string) => void;

    deactivateApiKey: (id: string) => void;

    updateApiKey: (keyEdits: any) => void;

    createApiKey: (keyData: any) => void;
}


export const noOpStatsServices:StatsServices = {

    newConversationEvent: () => {},

    marketItemPublishEvent: (
        publishingName: string,
        publishedDescription: string,
        selectedCategory: string,
        selectedTags: string[],
        sharedData: ExportFormatV4
    ) => {},

    downloadItemEvent: (
        conversionOptions: ConversionOptions,
        sharedData: ExportFormatV4
    ) => {},

    sharedItemEvent: (
        sharedBy: string,
        sharedWith: string[],
        sharingNote: string,
        sharedData: ExportFormatV4
    ) => {},

    sharedItemAcceptedEvent: (
        sharedBy: string,
        sharingNote: string,
        sharedData: ExportFormatV4
    ) => {},

    setThemeEvent: (theme: string) => {},

    attachFileEvent: (
        file: File,
        maxFileSizeEnforced: boolean,
        uploadDocuments: boolean
    ) => {},

    searchConversationsEvent: (searchTerm: string) => {},

    searchPromptsEvent: (searchTerm: string) => {},

    tryMarketItemEvent: (item: MarketItem) => {},

    installMarketItemEvent: (item: MarketItem) => {},

    viewMarketItemEvent: (item: MarketItem) => {},

    openMarketEvent: () => {},

    openSharedItemsEvent: () => {},

    openSettingsEvent: () => {},

    openWorkspacesEvent: () => {},

    openConversationsEvent: () => {},

    startConversationEvent: (prompt: Prompt) => {},

    deleteConversationEvent: (conversation: Conversation) => {},

    createConversationEvent: (conversation: Conversation) => {},

    moveConversationRemoteEvent: (conversation: Conversation) => {},

    moveConversationFromRemoteEvent: (conversation: Conversation) => {},

    sendChatEvent: (chatBody: ChatBody) => {},

    sendChatRewriteEvent: (chatBody: ChatBody, updateIndex: number) => {},

    runPromptEvent: (prompt: Prompt) => {},

    customLinkClickEvent: (message: Message, href: string) => {},

    createPromptEvent: (prompt: Prompt) => {},

    editPromptStartedEvent: (prompt: Prompt) => {},

    deletePromptEvent: (prompt: Prompt) => {},

    editPromptCanceledEvent: (prompt: Prompt) => {},

    editPromptCompletedEvent: (prompt: Prompt) => {},

    getApiKey: (id: string) => {},

    deactivateApiKey: (id: string) => {},

    updateApiKey: (keyEdits: any) => {},

    createApiKey: (keyData: any) => {},

}
