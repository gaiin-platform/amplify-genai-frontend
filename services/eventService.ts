import {Prompt} from "@/types/prompt";
import {useUser} from '@auth0/nextjs-auth0/client';
import mixpanel from 'mixpanel-browser';
import {MIXPANEL_TOKEN} from "@/utils/app/const";
import {OpenAIModel} from "@/types/openai";
import {MarketItem} from "@/types/market";
import {ChatBody, Conversation, Message} from "@/types/chat";

mixpanel.init(MIXPANEL_TOKEN, {debug: true, track_pageview: true, persistence: 'localStorage'});

const useStatsService = () => {

    const {user} = useUser();

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

    return {
        // sendEvent: async (event: string, data: any) => {
        //     mixpanel.track(event, data);
        // },
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