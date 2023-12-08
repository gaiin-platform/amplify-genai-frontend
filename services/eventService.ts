import {Prompt} from "@/types/prompt";
import mixpanel from 'mixpanel-browser';
import {MIXPANEL_TOKEN} from "@/utils/app/const";
import {OpenAIModel} from "@/types/openai";
import {MarketItem} from "@/types/market";
import {ChatBody, Conversation, Message} from "@/types/chat";
import {ExportFormatV4} from "@/types/export";
import {ConversionOptions} from "@/services/downloadService";
import {useSession} from "next-auth/react";

mixpanel.init(MIXPANEL_TOKEN, {debug: true, track_pageview: true, persistence: 'localStorage'});

const useStatsService = () => {

    const { data: session } = useSession();
    const user = session?.user;

    function camelToSentenceCase(input: string): string {
        const result = input.replace(/([A-Z])/g, " $1");
        return result.charAt(0).toUpperCase() + result.slice(1);
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
        return {
            ...toEventData("Prompt", prompt, ["id", "name", "description", "folderId"]),
            "Prompt Root Prompt ID": prompt.data?.rootPromptId,
        };
    }

    if (user?.email) {
        // @ts-ignore
        mixpanel.identify(user.email);
    }

    const getExportData = (sharedData:ExportFormatV4) => {
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

    return {

        marketItemPublishEvent : async (publishingName:string,
                                        publishedDescription:string,
                                        selectedCategory:string,
                                        selectedTags:string[],
                                        sharedData:ExportFormatV4) => {
            mixpanel.track('Item Published to Market', {
                ...toEventData("Item", getExportData(sharedData)),
                publishingName:publishingName,
                publishedDescription:publishedDescription,
                selectedCategory:selectedCategory,
                selectedTags:selectedTags,
            });
        },
        downloadItemEvent: async (conversionOptions:ConversionOptions, sharedData:ExportFormatV4) => {
            mixpanel.track('Export Downloaded', {
                ...toEventData("Item", getExportData(sharedData)),
                ...toEventData("Conversion Options", conversionOptions),
            });
        },
        sharedItemEvent: async (sharedBy:string, sharedWith:string[], sharingNote:string, sharedData:ExportFormatV4) => {
            mixpanel.track('Item Shared', {
                ...toEventData("Item", getExportData(sharedData)),
                    sharedBy:sharedBy,
                    sharedWith:sharedWith,
                    sharingNote:sharingNote
            });
        },
        sharedItemAcceptedEvent: async (sharedBy:string, sharingNote:string, sharedData:ExportFormatV4) => {
            mixpanel.track('Shared Item Imported', {
                ...toEventData("Item", getExportData(sharedData)),
                sharedBy:sharedBy,
                sharingNote:sharingNote
            });
        },
        setThemeEvent: async (theme: string) => {
            mixpanel.track('Theme Set',
                {...toEventData("Theme", {name: theme})});
        },
        attachFileEvent: async (file: File, maxFileSizeEnforced:boolean, uploadDocuments:boolean) => {
            const data = {
                name: file.name,
                size: file.size,
                type: file.type,
                maxFileSizeEnforced: maxFileSizeEnforced,
                uploadDocuments: uploadDocuments,
            }
            mixpanel.track('File Attached',
                {...toEventData("File", data)})
        },
        searchConversationsEvent: async (searchTerm: string) => {
            mixpanel.track('Conversations Searched',
                {...toEventData("Search", {term: searchTerm})})
        },
        searchPromptsEvent: async (searchTerm: string) => {
            mixpanel.track('Prompts Searched',
                {...toEventData("Search", {term: searchTerm})})
        },
        tryMarketItemEvent: async (item: MarketItem) => {
            mixpanel.track('Market Item Tried', {
                ...toEventData("Market Item", item,
                    ['id', 'name', 'description', 'author', 'lastUpdated', 'created', 'tags', 'category', 'sourceUrl', 'type']
                ),
            })
        },
        installMarketItemEvent: async (item: MarketItem) => {
            mixpanel.track('Market Item Installed', {
                ...toEventData("Market Item", item,
                    ['id', 'name', 'description', 'author', 'lastUpdated', 'created', 'tags', 'category', 'sourceUrl', 'type']
                ),
            })
        },
        viewMarketItemEvent: async (item: MarketItem) => {
            mixpanel.track('Market Item View', {
                ...toEventData("Market Item", item,
                    ['id', 'name', 'description', 'author', 'lastUpdated', 'created', 'tags', 'category', 'sourceUrl', 'type']
                ),
            })
        },
        openMarketEvent: async () => {
            mixpanel.track('Market Opened', {});
        },
        openSharedItemsEvent: async () => {
            mixpanel.track('Shared Items Opened', {});
        },
        openSettingsEvent: async () => {
            mixpanel.track('Settings Opened', {});
        },
        openWorkspacesEvent: async () => {
            mixpanel.track('Workspaces Opened', {});
        },
        openConversationsEvent: async () => {
            mixpanel.track('Conversations Opened', {});
        },
        startConversationEvent: async (prompt: Prompt) => {
            mixpanel.track('Conversation with Prompt Started', {
                ...promptStats(prompt)
            })
        },
        deleteConversationEvent: async (conversation: Conversation) => {
            const data = {
                messageCount: conversation.messages.length,
                modelId: conversation.model.id,
                messagesCharacters: conversation.messages.reduce((acc, m) => acc + m.content.length, 0),
                name: conversation.name,
                tags: conversation.tags,
                folderId: conversation.folderId,
                promptTemplateId: conversation.promptTemplate?.id,
                workflowDefinitionId: conversation.workflowDefinition?.id,
                id: conversation.id,
                temperature: conversation.temperature,
                dataKeys: Object.keys(conversation.data || {}),
            }

            mixpanel.track('Conversation Deleted',{
                ...toEventData("Conversation", data)});
        },
        createConversationEvent: async (conversation: Conversation) => {
            const data = {
                messageCount: conversation.messages.length,
                modelId: conversation.model.id,
                messagesCharacters: conversation.messages.reduce((acc, m) => acc + m.content.length, 0),
                name: conversation.name,
                tags: conversation.tags,
                folderId: conversation.folderId,
                promptTemplateId: conversation.promptTemplate?.id,
                workflowDefinitionId: conversation.workflowDefinition?.id,
                id: conversation.id,
                temperature: conversation.temperature,
                dataKeys: Object.keys(conversation.data || {}),
            }

            mixpanel.track('Conversation Created',{
                ...toEventData("Conversation", data)});
        },
        sendChatEvent: async (chatBody:ChatBody) => {
            const data = {
                messageCount: chatBody.messages.length,
                modelId: chatBody.model.id,
                messagesCharacters: chatBody.messages.reduce((acc, m) => acc + m.content.length, 0),
            }

            mixpanel.track('Chat', {
                ...toEventData("Chat", data)
            });
        },
        sendChatRewriteEvent: async (chatBody:ChatBody, updateIndex:number) => {
            const data = {
                messageCount: chatBody.messages.length,
                modelId: chatBody.model.id,
                messagesCharacters: chatBody.messages.reduce((acc, m) => acc + m.content.length, 0),
                updateIndex: updateIndex,
            }

            mixpanel.track('Chat Rewrite', {
                ...toEventData("Chat Rewrite", data)
            });
        },
        runPromptEvent: async (prompt: Prompt) => {
            mixpanel.track('Prompt Run', {
                ...promptStats(prompt),
            });
        },
        customLinkClickEvent: async (message: Message, href: string) => {
            mixpanel.track('Custom Link Click', {
                ...toEventData("Message",
                    {...message, href:href},
                    ["id", "type", "promptId"]),
            });
        },
        createPromptEvent: async (prompt: Prompt) => {
            mixpanel.track('Prompt Created', {
                ...promptStats(prompt),
            });
        },
        editPromptStartedEvent: async (prompt: Prompt) => {
            mixpanel.track('Prompt Edit Started', {
                ...promptStats(prompt),
            });
        },
        deletePromptEvent: async (prompt: Prompt) => {
            mixpanel.track('Prompt Deleted', {
                ...promptStats(prompt),
            });
        },
        editPromptCanceledEvent: async (prompt: Prompt) => {
            mixpanel.track('Prompt Edit Canceled', {
                ...promptStats(prompt),
            });
        },
        editPromptCompletedEvent: async (prompt: Prompt) => {
            mixpanel.track('Prompt Edit Done', {
                ...promptStats(prompt),
            });
        },
    }
}

export default useStatsService;