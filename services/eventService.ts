import {Prompt} from "@/types/prompt";
import mixpanel from 'mixpanel-browser';
import {MIXPANEL_TOKEN} from "@/utils/app/const";
import {MarketItem} from "@/types/market";
import {ChatBody, Conversation, Message} from "@/types/chat";
import {ExportFormatV4} from "@/types/export";
import {ConversionOptions} from "@/services/downloadService";
import {useSession} from "next-auth/react";
import {getType, parsePromptVariables} from "@/utils/app/prompts";

try {
    mixpanel.init(MIXPANEL_TOKEN, {debug: true, track_pageview: true, persistence: 'localStorage'});
} catch (e) {
    console.error("Error initializing mixpanel", e);
}

const useStatsService = () => {

    const {data: session} = useSession();
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

        let varCount = 0;
        let varTypes:string[] = [];
        try {
            const pvars = parsePromptVariables(prompt.content);
            varCount = pvars.length;

            varTypes = pvars.map(p => getType(p));
        }
        catch (e){}

        return {
            "Prompt Variable Types": varTypes,
            "Prompt Variable Count": varCount,
            "Prompt Size": prompt.content.length,
        };
    }

    if (user?.email) {
        // @ts-ignore
        try{
            mixpanel.identify(user.email);
        }catch (e){
            console.error("Error identifying user", e);
        }
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

    return {

        marketItemPublishEvent: async (publishingName: string,
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
                console.error("Error tracking prompt edit completed", e);
            }
        },
        downloadItemEvent: async (conversionOptions: ConversionOptions, sharedData: ExportFormatV4) => {
            try {
                mixpanel.track('Export Downloaded', {
                    ...toEventData("Item", getExportData(sharedData)),
                    ...toEventData("Conversion Options", conversionOptions),
                });
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        },
        sharedItemEvent: async (sharedBy: string, sharedWith: string[], sharingNote: string, sharedData: ExportFormatV4) => {
            try {
                mixpanel.track('Item Shared', {
                    ...toEventData("Item", getExportData(sharedData)),
                    sharedBy: sharedBy,
                    sharedWith: sharedWith,
                    sharingNote: sharingNote
                });
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        },
        sharedItemAcceptedEvent: async (sharedBy: string, sharingNote: string, sharedData: ExportFormatV4) => {
            try {
                mixpanel.track('Shared Item Imported', {
                    ...toEventData("Item", getExportData(sharedData)),
                    sharedBy: sharedBy,
                    sharingNote: sharingNote
                });
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        },
        setThemeEvent: async (theme: string) => {
            try {
                mixpanel.track('Theme Set',
                    {...toEventData("Theme", {name: theme})});
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        },
        attachFileEvent: async (file: File, maxFileSizeEnforced: boolean, uploadDocuments: boolean) => {
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
                console.error("Error tracking prompt edit completed", e);
            }
        },
        searchConversationsEvent: async (searchTerm: string) => {
            try {
                mixpanel.track('Conversations Searched',
                    {})
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        },
        searchPromptsEvent: async (searchTerm: string) => {
            try {
                mixpanel.track('Prompts Searched',
                    {})
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        },
        tryMarketItemEvent: async (item: MarketItem) => {
            try {
                mixpanel.track('Market Item Tried', {
                    ...toEventData("Market Item", item,
                        ['id', 'name', 'description', 'author', 'lastUpdated', 'created', 'tags', 'category', 'sourceUrl', 'type']
                    ),
                })
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        },
        installMarketItemEvent: async (item: MarketItem) => {
            try {
                mixpanel.track('Market Item Installed', {
                    ...toEventData("Market Item", item,
                        ['id', 'name', 'description', 'author', 'lastUpdated', 'created', 'tags', 'category', 'sourceUrl', 'type']
                    ),
                })
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        },
        viewMarketItemEvent: async (item: MarketItem) => {
            try {
                mixpanel.track('Market Item View', {
                    ...toEventData("Market Item", item,
                        ['id', 'name', 'description', 'author', 'lastUpdated', 'created', 'tags', 'category', 'sourceUrl', 'type']
                    ),
                })
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        },
        openMarketEvent: async () => {
            try {
                mixpanel.track('Market Opened', {});
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        },
        openSharedItemsEvent: async () => {
            try {
                mixpanel.track('Shared Items Opened', {});
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        },
        openSettingsEvent: async () => {
            try {
                mixpanel.track('Settings Opened', {});
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        },
        openWorkspacesEvent: async () => {
            try {
                mixpanel.track('Workspaces Opened', {});
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        },
        openConversationsEvent: async () => {
            try {
                mixpanel.track('Conversations Opened', {});
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        },
        startConversationEvent: async (prompt: Prompt) => {
            try {
                mixpanel.track('Conversation with Prompt Started', {
                    ...promptStats(prompt)
                })
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        },
        deleteConversationEvent: async (conversation: Conversation) => {
            try {
                const data = {
                    messageCount: conversation.messages.length,
                    messagesCharacters: conversation.messages.reduce((acc, m) => acc + m.content.length, 0),
                    temperature: conversation.temperature
                }

                mixpanel.track('Conversation Deleted', {
                    ...toEventData("Conversation", data)
                });
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        },
        createConversationEvent: async (conversation: Conversation) => {
            try {
                const data = {
                    messageCount: conversation.messages.length,
                    modelId: conversation.model.id,
                    messagesCharacters: conversation.messages.reduce((acc, m) => acc + m.content.length, 0),
                    temperature: conversation.temperature
                }

                mixpanel.track('Conversation Created', {
                    ...toEventData("Conversation", data)
                });
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        },
        sendChatEvent: async (chatBody: ChatBody) => {
            try {
                const data = {
                    messageCount: chatBody.messages.length,
                    modelId: chatBody.model.id,
                    messagesCharacters: chatBody.messages.reduce((acc, m) => acc + m.content.length, 0),
                }

                mixpanel.track('Chat', {
                    ...toEventData("Chat", data)
                });
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        },
        sendChatRewriteEvent: async (chatBody: ChatBody, updateIndex: number) => {
            try {
                const data = {
                    messageCount: chatBody.messages.length,
                    modelId: chatBody.model.id,
                    messagesCharacters: chatBody.messages.reduce((acc, m) => acc + m.content.length, 0),
                    updateIndex: updateIndex,
                }

                mixpanel.track('Chat Rewrite', {
                    ...toEventData("Chat Rewrite", data)
                });
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        },
        runPromptEvent: async (prompt: Prompt) => {
            try {
                mixpanel.track('Prompt Run', {
                    ...promptStats(prompt),
                });
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        },
        customLinkClickEvent: async (message: Message, href: string) => {
            try {
                mixpanel.track('Custom Link Click', {
                    ...toEventData("Message",
                        {href: href},
                        ["id", "type", "promptId"]),
                });
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        },
        createPromptEvent: async (prompt: Prompt) => {
            try {
                mixpanel.track('Prompt Created', {
                    ...promptStats(prompt),
                });
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        },
        editPromptStartedEvent: async (prompt: Prompt) => {
            try {
                mixpanel.track('Prompt Edit Started', {
                    ...promptStats(prompt),
                });
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        },
        deletePromptEvent: async (prompt: Prompt) => {
            try {
                mixpanel.track('Prompt Deleted', {
                    ...promptStats(prompt),
                });
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        },
        editPromptCanceledEvent: async (prompt: Prompt) => {
            try {
                mixpanel.track('Prompt Edit Canceled', {
                    ...promptStats(prompt),
                });
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        },
        editPromptCompletedEvent: async (prompt: Prompt) => {
            try {
                mixpanel.track('Prompt Edit Done', {
                    ...promptStats(prompt),
                });
            } catch (e) {
                console.error("Error tracking prompt edit completed", e);
            }
        },
    }
}

export default useStatsService;