import {ExportFormatV4} from "@/types/export";
import {ConversionOptions} from "@/services/downloadService";
import {MarketItem} from "@/types/market";
import {Prompt} from "@/types/prompt";
import {ChatBody, Conversation, Message} from "@/types/chat";
import { ApiKey } from "./apikeys";
import { Settings } from "./settings";

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
    ) => void;

    searchConversationsEvent: (searchTerm: string) => void;

    searchPromptsEvent: (searchTerm: string) => void;

    tryMarketItemEvent: (item: MarketItem) => void;

    installMarketItemEvent: (item: MarketItem) => void;

    viewMarketItemEvent: (item: MarketItem) => void;

    openMarketEvent: () => void;

    openSharedItemsEvent: () => void;

    openSettingsEvent: () => void;

    saveSettingsEvent: (settings: Settings) => void;

    openWorkspacesEvent: () => void;

    openConversationsEvent: () => void;

    newConversationEvent: () => void;

    forkConversationEvent: () => void;

    startConversationEvent: (prompt: Prompt) => void;

    deleteConversationEvent: (conversation: Conversation) => void;

    createConversationEvent: (conversation: Conversation) => void;

    moveConversationRemoteEvent: (conversation: Conversation) => void;

    moveConversationFromRemoteEvent: (conversation: Conversation) => void;

    sendChatEvent: (chatBody: ChatBody) => void;

    userSendChatEvent: (message: Message, modelId: string) => void;

    sendChatRewriteEvent: (chatBody: ChatBody, updateIndex: number) => void;

    runPromptEvent: (prompt: Prompt) => void;

    customLinkClickEvent: (message: Message, href: string) => void;

    createPromptEvent: (prompt: Prompt) => void;

    editPromptStartedEvent: (prompt: Prompt) => void;

    deletePromptEvent: (prompt: Prompt) => void;

    editPromptCanceledEvent: (prompt: Prompt) => void;

    editPromptCompletedEvent: (prompt: Prompt) => void;
    
    getApiKeyEvent: (id: string) => void;

    deactivateApiKeyEvent: (id: string) => void;

    updateApiKeyEvent: (keyEdits: any) => void;

    createApiKeyEvent: (keyData: any) => void;

    createAstAdminGroupEvent: (data: any) => void;

    updateGroupTypesEvent: (data: any) => void;

    updateGroupMembersEvent: (data: any) => void;

    updateGroupMembersPermissionsEvent: (data: any) => void;

    updateGroupAssistantsEvent: (data: any) => void;

    deleteAstAdminGroupEvent: (groupId: string) => void;

    getGroupConversationDataEvent: (assistantId: string, conversationId: string) => void;

    getGroupAssistantConversationsEvent: (assistantId: string) => void;

    getGroupAssistantDashboardsEvent: (
        assistantId: string,
        startDate?: string,
        endDate?: string,
        includeConversationData?: boolean,
        includeConversationContent?: boolean
    ) => void;

    saveUserRatingEvent: (conversationId: string, userRating: number, userFeedback?: string) => void;

    createArtifactEvent: (type: string) => void;

    bringArtifactToAnotherConversationEvent: (artifactKey: string) => void;

    deleteArtifactFromSavedArtifactsEvent: (artifactKey: string) => void;

    saveArtifactEvent: (artifactData: any) => void;

    shareArtifactEvent: (artifactData: any, emailList: string[]) => void;

    deleteArtifactEvent: () => void;

    editArtifactEvent: () => void;

    mailArtifactEvent: () => void;

    downloadArtifactEvent: () => void;

    copyArtifactEvent: () => void;

    addCopyOfArtifactEvent: () => void;

    uploadArtifactAsFileEvent: () => void;

    previewArtifactEvent: (type: string) => void;

    codeInterpreterInUseEvent: () => void;

    promptAgaintsHighlightEvent: () => void;

    HighlightFastEditEvent: () => void;

    HighlightCompositeEvent: (numOfHighlights : number) => void;

}


export const noOpStatsServices:StatsServices = {

    newConversationEvent: () => {},

    forkConversationEvent: () => {},

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
        maxFileSizeEnforced: boolean
    ) => {},

    searchConversationsEvent: (searchTerm: string) => {},

    searchPromptsEvent: (searchTerm: string) => {},

    tryMarketItemEvent: (item: MarketItem) => {},

    installMarketItemEvent: (item: MarketItem) => {},

    viewMarketItemEvent: (item: MarketItem) => {},

    openMarketEvent: () => {},

    openSharedItemsEvent: () => {},

    openSettingsEvent: () => {},

    saveSettingsEvent: (settings: Settings) => {},

    openWorkspacesEvent: () => {},

    openConversationsEvent: () => {},

    startConversationEvent: (prompt: Prompt) => {},

    deleteConversationEvent: (conversation: Conversation) => {},

    createConversationEvent: (conversation: Conversation) => {},

    moveConversationRemoteEvent: (conversation: Conversation) => {},

    moveConversationFromRemoteEvent: (conversation: Conversation) => {},

    sendChatEvent: (chatBody: ChatBody) => {},

    userSendChatEvent: (message: Message, modelId: string) => {},

    sendChatRewriteEvent: (chatBody: ChatBody, updateIndex: number) => {},

    runPromptEvent: (prompt: Prompt) => {},

    customLinkClickEvent: (message: Message, href: string) => {},

    createPromptEvent: (prompt: Prompt) => {},

    editPromptStartedEvent: (prompt: Prompt) => {},

    deletePromptEvent: (prompt: Prompt) => {},

    editPromptCanceledEvent: (prompt: Prompt) => {},

    editPromptCompletedEvent: (prompt: Prompt) => {},

    getApiKeyEvent: (id: string) => {},

    deactivateApiKeyEvent: (id: string) => {},

    updateApiKeyEvent: (keyEdits: any) => {},

    createApiKeyEvent: (keyData: any) => {},

    createAstAdminGroupEvent: (data: any) => {},

    updateGroupTypesEvent: (data: any) => {},
    
    updateGroupMembersEvent: (data: any) => {},

    updateGroupMembersPermissionsEvent: (data: any) => {},

    updateGroupAssistantsEvent: (data: any) => {}, 

    deleteAstAdminGroupEvent: (groupId: string) => {},

    getGroupConversationDataEvent: (assistantId: string, conversationId: string) => {},

    getGroupAssistantConversationsEvent: (assistantId: string) => {},

    getGroupAssistantDashboardsEvent: (
        assistantId: string,
        startDate?: string,
        endDate?: string,
        includeConversationData?: boolean,
        includeConversationContent?: boolean
    ) => {},

    saveUserRatingEvent: (conversationId: string, userRating: number, userFeedback?: string) => {},

    createArtifactEvent: (type: string) => {},

    bringArtifactToAnotherConversationEvent: (artifactKey: string) => {},

    deleteArtifactFromSavedArtifactsEvent: (artifactKey: string) => {},

    saveArtifactEvent: (artifactData: any) => {},

    shareArtifactEvent: (artifactData: any, emailList: string[]) => {},

    deleteArtifactEvent: () => {},

    editArtifactEvent: () => {},

    mailArtifactEvent: () => {},

    downloadArtifactEvent: () => {},

    copyArtifactEvent: () => {},

    addCopyOfArtifactEvent: () => {},

    uploadArtifactAsFileEvent: () => {},

    previewArtifactEvent: (type: string) => {},

    codeInterpreterInUseEvent: () => {},

    promptAgaintsHighlightEvent: () => {},

    HighlightFastEditEvent: () => {},

    HighlightCompositeEvent: (numOfHighlights : number) => {},

}
