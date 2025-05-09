import {Prompt} from "@/types/prompt";
import mixpanel from 'mixpanel-browser';
import {MarketItem} from "@/types/market";
import {ChatBody, Conversation, Message} from "@/types/chat";
import {ExportFormatV4} from "@/types/export";
import {ConversionOptions} from "@/services/downloadService";
import {getType, parsePromptVariables} from "@/utils/app/prompts";
import {useSession} from "next-auth/react";
import { uncompressMessages } from "@/utils/app/messages";
import { ApiKey } from "@/types/apikeys";
import { Settings } from "@/types/settings";
import { capitalize } from "@/utils/app/data";

let eventServiceReady = false;

const useEventService = (mixPanelToken:string) => {

    const {data: session} = useSession();

    const user = session?.user;

    if(!eventServiceReady && mixPanelToken && user?.email) {
        try {
            mixpanel.init(mixPanelToken, {debug: false, track_pageview: true, persistence: 'localStorage'});
            mixpanel.identify(user.email);
            eventServiceReady = true;
        } catch (e) {
            console.error("Error initializing mixpanel", e);
        }
    }


    function camelToSentenceCase(input: string): string {
        const result = input.replace(/([A-Z])/g, " $1");
        return capitalize(result);
    }

    function keep(mapObject: any, keysToKeep: string[]): any {
        return Object.keys(mapObject)
            .filter(key => keysToKeep.includes(key))
            .reduce((obj, key) => {
                // @ts-ignore
                obj[key] = mapObject[key];
                return obj;
            }, {});
    }

    function toEventData(prefix: string, data: any, propertiesToKeep?: string[]): any {
        if (propertiesToKeep) {
            data = keep(data, propertiesToKeep);
        }
        const result = {};
        for (const [key, value] of Object.entries(data)) {
            // @ts-ignore
            result[prefix + " " + camelToSentenceCase(key)] = value;
        }
        return result;
    }

    const promptStats = (prompt: Prompt) => {

        let varCount = 0;
        let varTypes: string[] = [];
        try {
            const pvars = parsePromptVariables(prompt.content);
            varCount = pvars.length;

            varTypes = pvars.map(p => getType(p));
        } catch (e) {
        }

        return {
            "Prompt Variable Types": varTypes,
            "Prompt Variable Count": varCount,
            "Prompt Size": prompt.content ? prompt.content.length : 0,
        };
    }

    const getExportData = (sharedData: ExportFormatV4) => {
        const sharedPromptIds = sharedData.prompts.map(p => p.id);
        const sharedConversationIds = sharedData.history.map(c => c.id);
        const sharedFolderIds = sharedData.folders.map(f => f.id);

        return {
            sharedPromptCount: sharedPromptIds.length,
            sharedConversationCount: sharedConversationIds.length,
            sharedFolderCount: sharedFolderIds.length,
            sharedPromptIds: sharedPromptIds,
            sharedConversationIds: sharedConversationIds,
            sharedFolderIds: sharedFolderIds,
        };
    }

    const ifReady = (fn: any) => {
        return async (...args: any[]) => {
            // console.log("is mix panel on?", localStorage.getItem('mixPanelOn'));
            if (eventServiceReady && JSON.parse(localStorage.getItem('mixPanelOn') ?? 'false')) {
                fn(...args);
            }
        }
    }

    return {

        marketItemPublishEvent: ifReady( (publishingName: string,
                                       publishedDescription: string,
                                       selectedCategory: string,
                                       selectedTags: string[],
                                       sharedData: ExportFormatV4) => {
            try {
                mixpanel.track('Item Published to Market', {
                    ...toEventData("Item", getExportData(sharedData)),
                    publishingName: publishingName,
                    publishedDescription: publishedDescription,
                    selectedCategory: selectedCategory,
                    selectedTags: selectedTags,
                });
            } catch (e) {
                console.error("Error tracking Item Published to Market", e);
            }
        }),
        downloadItemEvent: ifReady( (conversionOptions: ConversionOptions, sharedData: ExportFormatV4) => {
            try {
                mixpanel.track('Export Downloaded', {
                    ...toEventData("Item", getExportData(sharedData)),
                    ...toEventData("Conversion Options", conversionOptions),
                });
            } catch (e) {
                console.error("Error tracking Export Downloaded", e);
            }
        }),
        sharedItemEvent: ifReady( (sharedBy: string, sharedWith: string[], sharingNote: string, sharedData: ExportFormatV4) => {
            try {
                mixpanel.track('Item Shared', {
                    ...toEventData("Item", getExportData(sharedData)),
                    sharedBy: sharedBy,
                    sharedWith: sharedWith,
                    sharingNote: sharingNote
                });
            } catch (e) {
                console.error("Error tracking Item Shared", e);
            }
        }),
        sharedItemAcceptedEvent: ifReady( (sharedBy: string, sharingNote: string, sharedData: ExportFormatV4) => {
            try {
                mixpanel.track('Shared Item Imported', {
                    ...toEventData("Item", getExportData(sharedData)),
                    sharedBy: sharedBy,
                    sharingNote: sharingNote
                });
            } catch (e) {
                console.error("Error tracking Shared Item Imported", e);
            }
        }),
        setThemeEvent: ifReady( (theme: string) => {
            try {
                mixpanel.track('Theme Set',
                    {...toEventData("Theme", {name: theme})});
            } catch (e) {
                console.error("Error tracking Theme Set", e);
            }
        }),
        attachFileEvent: ifReady( (file: File, maxFileSizeEnforced: boolean, uploadDocuments: boolean) => {
            try {
                const data = {
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    maxFileSizeEnforced: maxFileSizeEnforced,
                    uploadDocuments: uploadDocuments,
                }
                mixpanel.track('File Attached',
                    {...toEventData("File", data)})
            } catch (e) {
                console.error("Error tracking File Attached", e);
            }
        }),
        searchConversationsEvent: ifReady( (searchTerm: string) => {
            try {
                mixpanel.track('Conversations Searched',
                    {})
            } catch (e) {
                console.error("Error tracking Conversations Searched", e);
            }
        }),
        searchPromptsEvent: ifReady( (searchTerm: string) => {
            try {
                mixpanel.track('Prompts Searched',
                    {})
            } catch (e) {
                console.error("Error tracking Prompts Searched", e);
            }
        }),
        tryMarketItemEvent: ifReady( (item: MarketItem) => {
            try {
                mixpanel.track('Market Item Tried', {
                    ...toEventData("Market Item", item,
                        ['id', 'name', 'description', 'author', 'lastUpdated', 'created', 'tags', 'category', 'sourceUrl', 'type']
                    ),
                })
            } catch (e) {
                console.error("Error tracking Market Item Tried", e);
            }
        }),
        installMarketItemEvent: ifReady( (item: MarketItem) => {
            try {
                mixpanel.track('Market Item Installed', {
                    ...toEventData("Market Item", item,
                        ['id', 'name', 'description', 'author', 'lastUpdated', 'created', 'tags', 'category', 'sourceUrl', 'type']
                    ),
                })
            } catch (e) {
                console.error("Error tracking 'Market Item Installed", e);
            }
        }),
        viewMarketItemEvent: ifReady( (item: MarketItem) => {
            try {
                mixpanel.track('Market Item View', {
                    ...toEventData("Market Item", item,
                        ['id', 'name', 'description', 'author', 'lastUpdated', 'created', 'tags', 'category', 'sourceUrl', 'type']
                    ),
                })
            } catch (e) {
                console.error("Error tracking Market Item View", e);
            }
        }),
        openMarketEvent: ifReady( () => {
            try {
                mixpanel.track('Market Opened', {});
            } catch (e) {
                console.error("Error tracking Market Opened", e);
            }
        }),
        openSharedItemsEvent: ifReady( () => {
            try {
                mixpanel.track('Shared Items Opened', );
            } catch (e) {
                console.error("Error tracking Shared Items Opened", e);
            }
        }),
        openSettingsEvent: ifReady( () => {
            try {
                mixpanel.track('Settings Opened', {});
            } catch (e) {
                console.error("Error tracking open settings", e);
            }
        }),
        saveSettingsEvent: ifReady( (settings: Settings) => {
            try {
                mixpanel.track('Settings saved', {
                    ...toEventData("Saved Settings", settings)
                });
            } catch (e) {
                console.error("Error tracking save settings", e);
            }
        }),
        openWorkspacesEvent: ifReady( () => {
            try {
                mixpanel.track('Workspaces Opened', {});
            } catch (e) {
                console.error("Error tracking open workspace", e);
            }
        }),
        openConversationsEvent: ifReady( () => {
            try {
                mixpanel.track('Conversations Opened', {});
            } catch (e) {
                console.error("Error tracking open conversation", e);
            }
        }),
        newConversationEvent: ifReady( () => {
            try {
                mixpanel.track('Conversation Started', {});
            } catch (e) {
                console.error("Error tracking new conversation ", e);
            }
        }),
        forkConversationEvent: ifReady( () => {
            try {
                mixpanel.track('Fork Conversation', {});
            } catch (e) {
                console.error("Error tracking fork conversation ", e);
            }
        }),
        startConversationEvent: ifReady( (prompt: Prompt) => {
            try {
                mixpanel.track('Conversation with Prompt Started', {
                    ...promptStats(prompt)
                })
            } catch (e) {
                console.error("Error tracking start conversation with prompt", e);
            }
        }),
        deleteConversationEvent: ifReady( (conversation: Conversation) => {
            try {
                const convMessages = conversation.compressedMessages ? uncompressMessages(conversation.compressedMessages) : conversation.messages || [];
                const data = {
                    messageCount: convMessages.length,
                    messagesCharacters: convMessages.reduce((acc, m) => acc + m.content.length, 0),
                    temperature: conversation.temperature
                }

                mixpanel.track('Conversation Deleted', {
                    ...toEventData("Conversation", data)
                });
            } catch (e) {
                console.error("Error tracking delete conversation", e);
            }
        }),
        createConversationEvent: ifReady( (conversation: Conversation) => {
            try {
                const convMessages = conversation.compressedMessages ? uncompressMessages(conversation.compressedMessages) : conversation.messages || [];
                const data = {
                    messageCount: convMessages.length,
                    modelId: conversation.model.id,
                    messagesCharacters: convMessages.reduce((acc, m) => acc + m.content.length, 0),
                    temperature: conversation.temperature
                }

                mixpanel.track('Conversation Created', {
                    ...toEventData("Conversation", data)
                });
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        }),

        moveConversationRemoteEvent: ifReady( (conversation: Conversation) => {
            try {
                const convMessages = conversation.compressedMessages ? uncompressMessages(conversation.compressedMessages) : conversation.messages || [];
                const data = {
                    messageCount: convMessages.length,
                    modelId: conversation.model.id,
                    messagesCharacters: convMessages.reduce((acc, m) => acc + m.content.length, 0),
                    temperature: conversation.temperature
                }

                mixpanel.track('Conversation Moved Remote', {
                    ...toEventData("Conversation", data)
                });
            } catch (e) {
                console.error("Error tracking Conversation Moved Remote", e);
            }
        }),

        moveConversationFromRemoteEvent: ifReady( (conversation: Conversation) => {
            try {
                const convMessages = conversation.compressedMessages ? uncompressMessages(conversation.compressedMessages) : conversation.messages || [];
                const data = {
                    messageCount: convMessages.length,
                    modelId: conversation.model.id,
                    messagesCharacters: convMessages.reduce((acc, m) => acc + m.content.length, 0),
                    temperature: conversation.temperature
                }

                mixpanel.track('Conversation Moved From Remote to Local', {
                    ...toEventData("Conversation", data)
                });
            } catch (e) {
                console.error("Error tracking Conversation Moved From Remote to Local", e);
            }

        }),

        userSendChatEvent: ifReady( (message: Message, modelId: string) => {
            try {
                const data = {
                    message: message,
                    modelId: modelId,
                    messagesCharacters: message.content.length,
                }

                mixpanel.track('User Chat', {
                    ...toEventData("User Chat", data)
                });
            } catch (e) {
                console.error("Error tracking user chat sent", e);
            }
        }),


        sendChatEvent: ifReady( (chatBody: ChatBody) => {
            try {
                const data = {
                    messageCount: chatBody.messages.length,
                    modelId: chatBody.model?.id ?? 'undefined',
                    messagesCharacters: chatBody.messages.reduce((acc, m) => acc + m.content.length, 0),
                }

                mixpanel.track('Chat', {
                    ...toEventData("Chat", data)
                });
            } catch (e) {
                console.error("Error tracking send chat event", e);
            }
        }),
        sendChatRewriteEvent: ifReady( (chatBody: ChatBody, updateIndex: number) => {
            try {
                const data = {
                    messageCount: chatBody.messages.length,
                    modelId: chatBody.model?.id ?? 'undefined',
                    messagesCharacters: chatBody.messages.reduce((acc, m) => acc + m.content.length, 0),
                    updateIndex: updateIndex,
                }

                mixpanel.track('Chat Rewrite', {
                    ...toEventData("Chat Rewrite", data)
                });
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        }),
        runPromptEvent: ifReady( (prompt: Prompt) => {
            try {
                mixpanel.track('Prompt Run', {
                    ...promptStats(prompt),
                });
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        }),
        customLinkClickEvent: ifReady( (message: Message, href: string) => {
            try {
                mixpanel.track('Custom Link Click', {
                    ...toEventData("Message",
                        {href: href},
                        ["id", "type", "promptId"]),
                });
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        }),
        createPromptEvent: ifReady( (prompt: Prompt) => {
            try {
                mixpanel.track('Prompt Created', {
                    ...promptStats(prompt),
                });
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        }),
        editPromptStartedEvent: ifReady( (prompt: Prompt) => {
            try {
                mixpanel.track('Prompt Edit Started', {
                    ...promptStats(prompt),
                });
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        }),
        deletePromptEvent: ifReady( (prompt: Prompt) => {
            try {
                mixpanel.track('Prompt Deleted', {
                    ...promptStats(prompt),
                });
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        }),
        editPromptCanceledEvent: ifReady( (prompt: Prompt) => {
            try {
                mixpanel.track('Prompt Edit Canceled', {
                    ...promptStats(prompt),
                });
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        }),
        editPromptCompletedEvent: ifReady( (prompt: Prompt) => {
            try {
                mixpanel.track('Prompt Edit Done', {
                    ...promptStats(prompt),
                });
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        }),
        getApiKeyEvent: ifReady(  (id: string) => {
            try {
                mixpanel.track('Get API key ', {
                    ...toEventData("API Key id", id)
                });
            } catch (e) {
                console.error("Error tracking Get API key ", e);
            }
        }),

        deactivateApiKeyEvent: ifReady( (id: string) => {
            try {
                mixpanel.track('Deactivate API key ', {
                    ...toEventData("API KeyID ", id)
                });
            } catch (e) {
                console.error("Error tracking Deactivate API key ", e);
            }
        }),
    
        updateApiKeyEvent: ifReady( (keyEdits: any) => {
            try {
                mixpanel.track('Update API key(s) ', {
                    ...toEventData("API Key(s) edits ", keyEdits)
                });
            } catch (e) {
                console.error("Error tracking Update API key ", e);
            }
        }),
    
        createApiKeyEvent: ifReady(  (keyData: any) => {
            try {
                mixpanel.track('Create API key(s) ', {
                    ...toEventData("API Key data", keyData)
                });
            } catch (e) {
                console.error("Error tracking Create API key ", e);
            }
        }),
        

        createAstAdminGroupEvent: ifReady((data: any) => {
            try {
                mixpanel.track('Create Assistant Admin Group', {
                    ...toEventData("Group Data", data)
                });
            } catch (e) {
                console.error("Error tracking Create Assistant Admin Group", e);
            }
        }),
    
        updateGroupTypesEvent: ifReady((data: any) => {
            try {
                mixpanel.track('Update Group Types', {
                    ...toEventData("Group Types Data", data)
                });
            } catch (e) {
                console.error("Error tracking Update Group Types", e);
            }
        }),
    
        updateGroupMembersEvent: ifReady((data: any) => {
            try {
                mixpanel.track('Update Group Members', {
                    ...toEventData("Group Members Data", data)
                });
            } catch (e) {
                console.error("Error tracking Update Group Members", e);
            }
        }),
    
        updateGroupMembersPermissionsEvent: ifReady((data: any) => {
            try {
                mixpanel.track('Update Group Members Permissions', {
                    ...toEventData("Group Permissions Data", data)
                });
            } catch (e) {
                console.error("Error tracking Update Group Members Permissions", e);
            }
        }),
    
        updateGroupAssistantsEvent: ifReady((data: any) => {
            try {
                mixpanel.track('Update Group Assistants', {
                    ...toEventData("Assistants Data", data)
                });
            } catch (e) {
                console.error("Error tracking Update Group Assistants", e);
            }
        }),
    
        deleteAstAdminGroupEvent: ifReady((groupId: string) => {
            try {
                mixpanel.track('Delete Assistant Admin Group', {
                    ...toEventData("Group ID", groupId)
                });
            } catch (e) {
                console.error("Error tracking Delete Assistant Admin Group", e);
            }
        }),

        getGroupConversationDataEvent: ifReady((assistantId: string, conversationId: string) => {
            try {
                mixpanel.track('Get Group Conversation Data', {
                    ...toEventData("Assistant ID", assistantId),
                    ...toEventData("Conversation ID", conversationId)
                });
            } catch (e) {
                console.error("Error tracking Get Group Conversation Data", e);
            }
        }),
        
        getGroupAssistantConversationsEvent: ifReady((assistantId: string) => {
            try {
                mixpanel.track('Get Group Assistant Conversations', {
                    ...toEventData("Assistant ID", assistantId)
                });
            } catch (e) {
                console.error("Error tracking Get Group Assistant Conversations", e);
            }
        }),
        
        getGroupAssistantDashboardsEvent: ifReady((
            assistantId: string,
            startDate?: string,
            endDate?: string,
            includeConversationData?: boolean,
            includeConversationContent?: boolean
        ) => {
            try {
                mixpanel.track('Get Group Assistant Dashboards', {
                    ...toEventData("Assistant ID", assistantId),
                    ...(startDate && { ...toEventData("Start Date", startDate) }),
                    ...(endDate && { ...toEventData("End Date", endDate) }),
                    ...(includeConversationData !== undefined && { ...toEventData("Include Conversation Data", includeConversationData) }),
                    ...(includeConversationContent !== undefined && { ...toEventData("Include Conversation Content", includeConversationContent) })
                });
            } catch (e) {
                console.error("Error tracking Get Group Assistant Dashboards", e);
            }
        }),
        
        saveUserRatingEvent: ifReady((conversationId: string, userRating: number, userFeedback?: string) => {
            try {
                mixpanel.track('Save User Rating', {
                    ...toEventData("Conversation ID", conversationId),
                    ...toEventData("User Rating", userRating),
                    ...(userFeedback && { ...toEventData("User Feedback", userFeedback) })
                });
            } catch (e) {
                console.error("Error tracking Save User Rating", e);
            }
        }),

        createArtifactEvent: ifReady((type: string) => {
            try {
                mixpanel.track('Create Artifact', {
                ...toEventData("Artifact Type", type)
                });
            } catch (e) {
                console.error("Error tracking Create Artifact", e);
            }
        }),

        bringArtifactToAnotherConversationEvent: ifReady((artifactKey: string) => {
            try {
                mixpanel.track('Bring Artifact To Another Conversation', {
                    ...toEventData("Artifact Key", artifactKey)
                });
            } catch (e) {
                console.error("Error tracking Bring Artifact To Another Conversation", e);
            }
        }),
        
        deleteArtifactFromSavedArtifactsEvent: ifReady((artifactKey: string) => {
            try {
                mixpanel.track('Delete Artifact From Saved Artifacts', {
                    ...toEventData("Artifact Key", artifactKey)
                });
            } catch (e) {
                console.error("Error tracking Delete Artifact From Saved Artifacts", e);
            }
        }),
        
        saveArtifactEvent: ifReady((artifactData: any) => {
            try {
                mixpanel.track('Save Artifact', {
                    ...toEventData("Artifact Data", artifactData)
                });
            } catch (e) {
                console.error("Error tracking Save Artifact", e);
            }
        }),
        
        shareArtifactEvent: ifReady((artifactData: any, emailList: string[]) => {
            try {
                mixpanel.track('Share Artifact', {
                    ...toEventData("Artifact Data", artifactData),
                    ...toEventData("Shared With Emails", emailList)
                });
            } catch (e) {
                console.error("Error tracking Share Artifact", e);
            }
        }),
        

        deleteArtifactEvent: ifReady(() => {
            try {
                mixpanel.track('Delete Artifact');
            } catch (e) {
                console.error("Error tracking Delete Artifact", e);
            }
        }),
        
        editArtifactEvent: ifReady(() => {
            try {
                mixpanel.track('Edit Artifact');
            } catch (e) {
                console.error("Error tracking Edit Artifact", e);
            }
        }),
        
        mailArtifactEvent: ifReady(() => {
            try {
                mixpanel.track('Mail Artifact');
            } catch (e) {
                console.error("Error tracking Mail Artifact", e);
            }
        }),
        
        downloadArtifactEvent: ifReady(() => {
            try {
                mixpanel.track('Download Artifact');
            } catch (e) {
                console.error("Error tracking Download Artifact", e);
            }
        }),
        
        copyArtifactEvent: ifReady(() => {
            try {
                mixpanel.track('Copy Artifact');
            } catch (e) {
                console.error("Error tracking Copy Artifact", e);
            }
        }),
        
        addCopyOfArtifactEvent: ifReady(() => {
            try {
                mixpanel.track('Add Copy Of Artifact');
            } catch (e) {
                console.error("Error tracking Add Copy Of Artifact", e);
            }
        }),
        
        uploadArtifactAsFileEvent: ifReady(() => {
            try {
                mixpanel.track('Upload Artifact As File');
            } catch (e) {
                console.error("Error tracking Upload Artifact As File", e);
            }
        }),
        
        previewArtifactEvent: ifReady((type: string) => {
            try {
                mixpanel.track('Preview Artifact', {
                    ...toEventData("Artifact Type", type)
                    });
            } catch (e) {
                console.error("Error tracking Preview Artifact", e);
            }
        }),
        
        codeInterpreterInUseEvent: ifReady(() => {
            try {
                mixpanel.track('Code interpreter in use');
            } catch (e) {
                console.error("Error trackingCode interpreter in use", e);
            }
        }),

        promptAgaintsHighlightEvent: ifReady(() => {
            try {
                mixpanel.track('Prompt against highlight');
            } catch (e) {
                console.error("Error tracking Prompt against highlight", e);
            }
        }),

        HighlightFastEditEvent: ifReady(() => {
            try {
                mixpanel.track('Fast edit highlight used');
            } catch (e) {
                console.error("Error tracking fast edit highlight", e);
            }
        }),

        HighlightCompositeEvent: ifReady((numOfHighlights : number)  => {
            try {
                mixpanel.track('Composite mode in highlight tool used', {
                    ...toEventData("Number of highlights used", numOfHighlights),
                });
            } catch (e) {
                console.error("Error tracking highlight composite", e);
            }
        }),
    }
}


export default useEventService;