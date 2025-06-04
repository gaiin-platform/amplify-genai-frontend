
import React, {useContext, useEffect, useRef} from "react";
import HomeContext from "@/pages/api/home/home.context";
import {useSendService} from "@/hooks/useChatSendService";
import {Conversation, Message, newMessage} from "@/types/chat";
import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import {getOpsForUser} from "@/services/opsService";
import {useSession} from "next-auth/react";
import {getDbsForUser} from "@/services/pdbService";
import {
    getApiCalls,
    getServerProvidedOps,
    resolveOpDef,
    resolveServerHandler
} from "@/utils/app/ops";
import { FolderInterface } from '@/types/folder';
import { Prompt } from '@/types/prompt';
import {deepMerge} from "@/utils/app/state";
import { includeRemoteConversationData } from "@/utils/app/conversationStorage";
import { DefaultModels } from "@/types/model";

interface Props {
    conversation: Conversation;
    message:Message;
    onStart: (id: string, action:any) => void;
    onEnd: (id: string, action:any) => void;
    action: any;
    ready: boolean;
    id: string;
    isLast: boolean;
}


const hasExecuted:{[key:string]:boolean} = {

}

const AutonomousBlock: React.FC<Props> = (
    {action, ready, id, isLast, onEnd, onStart, message, conversation}) => {

    const {
        state: {
            selectedConversation,
            selectedAssistant,
            conversations,
            availableModels,
            folders,
            prompts,
            defaultModelId,
            advancedModelId,
            cheapestModelId,
            featureFlags,
            workspaceMetadata,
            chatEndpoint,
            defaultAccount
        },
        shouldStopConversation,
        handleCreateFolder,
        handleConversationAction,
        dispatch: homeDispatch,
        handleAddMessages,
        getCompleteConversation,
        getDefaultModel
    } = useContext(HomeContext);


    const promptsRef = useRef(prompts);

    useEffect(() => {
        promptsRef.current = prompts;
      }, [prompts]);


    const conversationsRef = useRef(conversations);

    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);


    const foldersRef = useRef(folders);

    useEffect(() => {
        foldersRef.current = folders;
    }, [folders]);


    const { data: session, status } = useSession();

    const {handleSend} = useSendService();



    const stripQuotes = (s:string) => {

        if(!s){
            return "";
        }

        s = s.trim();

        if(s.startsWith('"') && s.endsWith('"')){
            return s.substring(1, s.length-1);
        }
        else if (s.startsWith("'") && s.endsWith("'")){
            return s.substring(1, s.length-1);
        }
        return s;
    }

    const opTitles: { [key: string]: string } = {
        "/ops": "Listing the available ops",
        "/chats": "Listing all of the chats",
        "/searchChats": "Searching all of the chats",
        "/chat": "Operation for a specific chat",
        "/chatSamples": "Operation for chat samples",
        "/folders": "Listing the available folders",
        "/searchFolders": "Searching all of the folders",
        "/listDbs": "Listing all of the databases",
        "/models": "Listing the available models",
        "/prompts": "Listing the available prompts",
        "/defaultModelId": "Getting the default model ID",
        "/advancedModelId": "Getting the defautl advanced model ID",
        "/cheapestModelId": "Getting the default cheapest model ID",
        "/featureFlags": "Getting the feature flags",
        "/workspaceMetadata": "Getting the workspace metadata",
        "/selectedConversation": "Getting the selected conversation",
        "/selectedAssistant": "Getting the selected assistant",
        "/listAssistants": "Listing all assistants",
        "/createChatFolder": "Creating a chat folder",
        "/moveChatsToFolder": "Moving chats to a folder",
    };

    const handlers:{[key:string]:(params:any)=>any} = {

        "/ops": async (params:any) => {
            const tag = params[0];
            const result = await getOpsForUser(tag);
            return result;
        },
        "/chats": (params:any) => {
            return conversationsRef.current.map((c:any) => {
                return {
                    id: c.id,
                    name: c.name,
                    description: c.description,
                    createdAt: c.createdAt,
                    updatedAt: c.updatedAt,
                    workspaceId: c.workspaceId,
                    modelId: c.modelId,
                    folderId: c.folderId,
                }
            });
        },
        "/searchChats": async (params:string[]) => {
            const thisId = selectedConversation?.id || "";

            console.log('Searching for keywords', params);
            const completeConversationHistory = await includeRemoteConversationData(conversationsRef.current, "search", true);

            const results = completeConversationHistory
                .filter((c: Conversation) => c.id !== thisId)
                .filter((c: Conversation) => {
                    const matches =  c.messages.filter((m) => {
                        return params.some((k: string) => m.content.includes(k));
                    });
                    return matches.length > 0;
                });

            return results.map((c:any) => {
                return {
                    id: c.id,
                    name: c.name,
                    description: c.description,
                    createdAt: c.createdAt,
                    updatedAt: c.updatedAt,
                    workspaceId: c.workspaceId,
                    modelId: c.modelId,
                    folderId: c.folderId,
                }
            });
        },
        "/chat": async (params:any) => {
            console.log("/chat params:", params)

            const id = params[1];
            const chat = conversationsRef.current.find((c:Conversation) => c.id === id);

            if(!chat){
                return {error: "Conversation not found, try listing all of the chats to find a valid conversation id."};
            }

            console.log("chat:", chat);

            return await getCompleteConversation(chat); 
        },
        "/chatSamples": async (params:any) => {
            console.log("/chat params:", params)

            const ids = params.slice(1);
            const chats = conversationsRef.current.filter((c:any) => ids.includes(c.id));

            if(chats.length === 0){
                console.log("No conversations found for the given ids. Searching for folders with the specified ids.");
                const matchedFolders = folders.filter((f) => ids.includes(f.id));

                console.log("Matched folders:", matchedFolders);

                matchedFolders.forEach((f) => {
                    const folderChats = conversations.filter((c) => c.folderId === f.id);
                    console.log("Folder chats:", folderChats);
                    chats.push(...folderChats);
                });
                return {error: "No conversations found for the given ids. Try listing the chats to find valid ids."};
            }
            const getCompleteChats = await Promise.all(
                chats.map(async (c: Conversation) => await getCompleteConversation(c))
              );
              
              // Filter out null or undefined values
            const completeChats = getCompleteChats.filter((chat) => chat !== null && chat !== undefined);

            const sampledMessagesPerChat = completeChats.map((c:any) => {
                const messages = c.messages;
                const sampledMessages = messages.slice(0, 6);
                return {
                    id: c.id,
                    name: c.name,
                    messages: sampledMessages
                }
            });

            return sampledMessagesPerChat;
        },
        "/folders": (params:any) => {
            return foldersRef.current;
        },
        "/searchFolders": (params:string[]) => {

            params = params.slice(1);
            const found = foldersRef.current.filter((f:FolderInterface) => {
                return params.some((k: string) => f.name.includes(k));
            });

            if(found.length === 0){
                return {error: "No folders found with names that include the given keywords. Try listing all of the folders."};
            }

            return found;
        },
        "/listDbs": async (params:any) => {
            return await getDbsForUser();
        },
        "/models": (params:any) => {
            return  Object.values(availableModels);
        },
        "/prompts": (params:any) => {
            return promptsRef.current;
        },
        "/defaultModelId": (params:any) => {
            return defaultModelId;
        },
        "/advancedModelId": (params:any) => {
            return advancedModelId;
        },
        "/cheapestModelId": (params:any) => {
            return cheapestModelId;
        },
        "/featureFlags": (params:any) => {
            return featureFlags;
        },
        "/workspaceMetadata": (params:any) => {
            return workspaceMetadata;
        },
        "/selectedConversation": (params:any) => {
            return selectedConversation;
        },
        "/selectedAssistant": (params:any) => {
            return selectedAssistant;
        },
        "/listAssistants": (params:any) => {
            return promptsRef.current
                .filter((p:Prompt) => p.data && p.data.assistant)
                .map((p:Prompt) => p.data?.assistant);
        },
        "/createChatFolder": (params:any) => {

            const name = params[0];

            if(!name){
                return {error: "Folder name is required as a parameter"};
            }

            const folder = handleCreateFolder(name, "chat");
            return folder;
        },
        "/moveChatsToFolder": (params:any) => {

            const folderId = params[0];
            const chatIds = params.slice(1);
            const folder = foldersRef.current.find((f:FolderInterface) => f.id === folderId);
            if(folder){
                const moved:{[key:string]:string} = {};
                for(const chatId of chatIds){
                    const chat = conversationsRef.current.find((c:Conversation) => c.id === chatId);
                    if(chat){
                        moved[chatId] = "Moved successfully.";
                        chat.folderId = folder.id;
                        handleConversationAction( {
                                    type: 'changeFolder',
                                    conversation: chat,
                                    folderId: folder.id
                                });
                    }
                    else {
                        moved[chatId] = "Chat not found.";
                    }
                }

                return {success: true, resultByChatId: moved};
            }
            else {
                return {error: "Folder not found. Try listing the folders to find a valid folder id."};
            }
        },
    }


    const getServerSelectedAssistant = (message:Message) => {

        const aid = (message.data && message.data.state) ?
            message.data.state.currentAssistantId : null;

        console.log(`Server-set assistantId: "${aid}"`)

        return aid;
    }

    const getOpTitle = (message: Message, url: string) => {
        const opDef = resolveOpDef(message, url);

        const title =
            (opDef && opDef.name)
            || opTitles[url]
            || opTitles["/" + url];

        return title;
    }

    const runAction = async (action: any) => {
        try{
            if(!isLast || hasExecuted[id] || message.data.automation){
               console.log("Skipping execution of action:", action,
                   "isLast:", isLast,
                   "hasExecuted:", hasExecuted[id],
                   "automation:", message.data.automation);
               return;
            }
            hasExecuted[id] = true;

            handleConversationAction(
                {
                    type: 'updateMessages',
                    conversation: conversation,
                    messages: [{
                        ...message,
                        data: {
                            ...message.data,
                            automation: {
                                status: "running"
                            }
                        }
                    }]
                }
            );
            // homeDispatch({ field: 'selectedConversation', value: conversation });

            const context = {
                conversation,
            }

            const apiCalls = getApiCalls(context, message, action);

            const results = [];
            let title = "API Result";

            for(const apiCall of apiCalls) {

                console.log("apiCall:", apiCall);

                const shouldConfirm = false;
                const {functionName, params, code} = apiCall;
                const url = stripQuotes(functionName);

                const remoteOps = getServerProvidedOps(message);
                console.log("Message:", message);
                console.log("Searching for operation:", url);
                console.log(`Known keys: 
            ${remoteOps ? "Remote:" + remoteOps.map((o: any) => o.id).join(",") : ""}
            Local:${Object.keys(handlers)}`);

                const handler =
                    resolveServerHandler(message, url, chatEndpoint, getDefaultModel(DefaultModels.CHEAPEST), defaultAccount)
                    || handlers[url]
                    || handlers["/" + url];

                title = getOpTitle(message, url);

                let result:{[key:string]:any} = {
                    success: false,
                    message: "Unknown operation: " + url + ". " +
                        "Please double check that you are using the right format for invoking operations (e.g., do(someOperationName, ...)) and that" +
                        " the name of the op is correct.",
                    metaEvents:[]
                }
                if (handler && (!shouldConfirm || confirm("Allow automation to proceed?"))) {
                    homeDispatch({field: 'loading', value: true});
                    homeDispatch({field: 'messageIsStreaming', value: true});
                    result = await handler(params);

                    console.log("Result of operation:", result);

                    if(result && result.metaEvents){
                        const metaEvents = result.metaEvents;
                        delete result.metaEvents;

                        // Find all meta events with a state key
                        const states = metaEvents.filter((e:any) => e.state).map((e:any) => e.state);
                        const state  = deepMerge({}, ...states);

                        console.log("Final state from meta", state);

                        if(state.sources){
                            result.sources = state.sources;
                        }
                    }
                }

                results.push({op:code, ...result} as any);
            }

            // If the result returns a pause, we should stop sending messages to the assistant
            const pauseMessage = results.find((r:any) => r.data && r.data.pause);
            if(pauseMessage){

                homeDispatch({field: 'loading', value: false});
                homeDispatch({field: 'messageIsStreaming', value: false});

                if(pauseMessage.data.pause.message) {
                    // check if pauseMessage.pause.message is a string
                    if (typeof pauseMessage.data.pause.message === "string") {
                        // Add the message to the conversation
                        handleAddMessages(selectedConversation, [newMessage({
                            role: "assistant",
                            content: pauseMessage.data.pause.message
                        })]);
                    } else {
                        // Add the message to the conversation
                        handleAddMessages(selectedConversation, [pauseMessage.data.pause.message]);
                    }
                }
                else {
                    alert("Pause message is missing from the result of the operation.");
                }
            }
            else if(!shouldStopConversation()){

                const sourcesList = deepMerge({}, ...results.map((r:any) => r.sources).filter((s) => s));
                console.log("Sources list:", sourcesList);

                const feedbackMessage = {
                    resultOfOps: results,
                }

                const assistantId =
                    getServerSelectedAssistant(message) ||
                    selectedAssistant?.id;

                if(!shouldStopConversation()) {
                    homeDispatch({field: 'loading', value: true});
                    homeDispatch({field: 'messageIsStreaming', value: true});

                    handleSend(
                        {
                            options:{assistantId},
                            message: newMessage(
                                {
                                    "role": "user",
                                    "content": JSON.stringify(feedbackMessage),
                                    label: title || "API Result",
                                    data:{
                                        actionResult:true,
                                        state: {
                                            sources: sourcesList
                                        }
                                    }
                                })
                        },
                        shouldStopConversation);
                }
            }

        }
        catch (e) {
            console.error(e);
            return null;
        }
    }

    useEffect(() => {
        if (ready) {
            runAction(action);
        }
    }, [ready, action]);

    return <div>
        <div
            className="rounded-xl text-neutral-600 border-2 dark:border-none dark:text-white bg-neutral-100 dark:bg-[#343541] rounded-md shadow-lg mb-2 mr-2"
        >
            <ExpansionComponent 
                title={"I am working on your request..."} 
                content={<div style={{  wordWrap: 'break-word', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>
                            {action}
                        </div>}/>
    </div>
    </div>;
};

export default AutonomousBlock;
