import {
    IconFileCheck,
} from '@tabler/icons-react';
import React, {useContext, useEffect} from "react";
import JSON5 from "json5";
import HomeContext from "@/pages/api/home/home.context";
import {useSendService} from "@/hooks/useChatSendService";
import {Conversation, Message, newMessage} from "@/types/chat";
import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import {execOp} from "@/services/opsService";
import {OpDef} from "@/types/op";
import {useSession} from "next-auth/react";
import {getDbsForUser} from "@/services/pdbService";

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
            folders,
            models,
            prompts,
            defaultModelId,
            featureFlags,
            workspaceMetadata
        },
        handleUpdateConversation,
        handleStopConversation,
        shouldStopConversation,
        handleCreateFolder,
        handleCustomLinkClick,
        dispatch: homeDispatch,
        handleAddMessages: handleAddMessages
    } = useContext(HomeContext);

    const { data: session, status } = useSession();

    const {handleSend} = useSendService();

    function parseApiCall(str:string) {
        const functionName = str.split("(")[0];
        const paramsStr = str.substring(str.indexOf('(') + 1, str.lastIndexOf(')'));
        const params = JSON5.parse("["+paramsStr+"]");
        return { functionName, params };
    }

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


    const handlers:{[key:string]:(params:any)=>any} = {

        "/ops": async (params:any) => {
            const tag = params[1];
            const result = await execOp("/ops/get", {
                tag
            });
            return result;
        },
        "/chats": (params:any) => {
            return conversations.map((c:any) => {
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
        "/searchChats": (params:string[]) => {
            const thisId = selectedConversation?.id || "";
            params = params.slice(1);

            console.log('Searching for keywords', params);

            const results = conversations
                .filter((c) => c.id !== thisId)
                .filter((c) => {
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
        "/chat": (params:any) => {
            console.log("/chat params:", params)

            const id = params[1];
            const chat = conversations.find((c:any) => c.id === id);

            if(!chat){
                return {error: "Conversation not found, try listing all of the chats to find a valid conversation id."};
            }

            console.log("chat:", chat);

            return chat;
        },
        "/chatSamples": (params:any) => {
            console.log("/chat params:", params)

            const ids = params.slice(1);
            const chats = conversations.filter((c:any) => ids.includes(c.id));

            if(chats.length === 0){
                return {error: "No conversations found for the given ids. Try listing the chats to find valid ids."};
            }

            const sampledMessagesPerChat = chats.map((c:any) => {
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
            return folders;
        },
        "/searchFolders": (params:string[]) => {
            params = params.slice(1);
            const found = folders.filter((f) => {
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
            return models;
        },
        "/prompts": (params:any) => {
            return prompts;
        },
        "/defaultModelId": (params:any) => {
            return defaultModelId;
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
            return prompts
                .filter(p => p.data && p.data.assistant)
                .map(p => p.data?.assistant);
        },
        "/createChatFolder": (params:any) => {
            params = params.slice(1);
            const name = params[0];

            if(!name){
                return {error: "Folder name is required as a parameter"};
            }

            const folder = handleCreateFolder(name, "chat");
            return folder;
        },
        "/moveChatsToFolder": (params:any) => {
            params = params.slice(1);
            const folderId = params[0];
            const chatIds = params.slice(1);
            const folder = folders.find((f) => f.id === folderId);
            if(folder){
                const moved:{[key:string]:string} = {};
                for(const chatId of chatIds){
                    const chat = conversations.find((c) => c.id === chatId);
                    if(chat){
                        moved[chatId] = "Moved successfully.";
                        chat.folderId = folder.id;
                        homeDispatch({
                            type: 'conversation',
                            action: {
                                type: 'changeFolder',
                                conversationId: chat.id,
                                folderId: folder.id
                            }
                        })
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

    const remoteOpHandler = (opDef:OpDef) => {

        console.log("Building remote op handler", opDef);

        const opData = opDef.data || {};

        const url = opDef.url;
        const method = opDef.method || "POST";
        const defaultErrorMessage = opData.defaultErrorMessage;
        const includeMessage = opData.includeMessage;
        const includeConversation = opData.includeConversation;
        const includeAccessToken = opData.includeAccessToken;
        const shouldConfirm = opData.shouldConfirm;
        const confirmationMessage = opData.confirmationMessage || "Do you want to allow the assistant to perform the specified operation?";

        return async (params:any) => {
            if(!shouldConfirm || confirm(confirmationMessage)){

                const headers = {
                    "Content-Type": "application/json"
                }
                if (includeAccessToken){
                    console.log("Including access token");
                    // @ts-ignore
                    headers["Authorization"] = `Bearer ${session?.accessToken}` // Assuming the API Gateway/Lambda expects a Bearer token
                }

                const req:Record<string,any> = {
                    method,
                    headers
                };

                const payload:Record<string,any> = {};

                params = params.slice(1); // The first param is the operation name
                for (let i = 0; i < opDef.params.length; i++) {
                    const paramDef = opDef.params[i];
                    console.log(`paramDef ${i}:`, paramDef);
                    try {
                        payload[paramDef.name] = JSON5.parse(params[i]);
                    } catch (e) {
                        payload[paramDef.name] = params[i];
                    }
                    console.log(`payload ${i}:`, payload[paramDef.name]);
                }

                try {

                    console.log("Sending remote op request", url, payload);

                    const response = await execOp(url, payload);

                    //const response = await fetch(url, req);
                    if (response) {
                        return response;
                    } else {
                        return {
                            success: false,
                            result: defaultErrorMessage || response.statusText
                        }
                    }
                } catch (e) {
                    console.error("Error invoking remote op:", e);
                    return {
                        success: false,
                        result: defaultErrorMessage || `${e}`
                    }
                }
            }
            else {
                return {success:false, result:"The user canceled the operation and asked you to stop."}
            }
        };
    }

    const getServerSelectedAssistant = (message:Message) => {

        const aid = (message.data && message.data.state) ?
            message.data.state.currentAssistantId : null;

        console.log(`Server-set assistantId: "${aid}"`)

        return aid;
    }

    const getServerProvidedOps = (message:Message) => {
        return (message.data && message.data.state) ?
            message.data.state.resolvedOps : [];
    }

    const resolveServerHandler = (message:Message, id:string) => {
        const serverResolvedOps = getServerProvidedOps(message);

        if(!serverResolvedOps || serverResolvedOps.length === 0){
            return null;
        }

        const opDef = serverResolvedOps.find(
            (op:any) => op.id === id || op.id === "/"+id
        );

        return opDef ? remoteOpHandler(opDef) : null;
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

            homeDispatch(
                {
                    type: 'conversation',
                    action: {
                        type: 'updateMessages',
                        conversationId: conversation.id,
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
                }
            )

            const apiCall = parseApiCall(action);
            console.log("apiCall:", apiCall);

            const shouldConfirm = false;
            const { functionName, params } = apiCall;
            const url = stripQuotes(params[0]);

            const remoteOps = getServerProvidedOps(message);
            console.log("Message:", message);
            console.log("Searching for operation:", url);
            console.log(`Known keys: 
            ${remoteOps ? "Remote:" + remoteOps.map((o:any) => o.id).join(",") : ""}
            Local:${Object.keys(handlers)}`);

            const handler =
                resolveServerHandler(message, url)
                || handlers[url]
                || handlers["/"+url];

            let result = {success:false, message:"Unknown operation: "+url+ ". " +
                    "Please double check that you are using the right format for invoking operations (e.g., do(someOperationName, ...)) and that" +
                    " the name of the op is correct."}
            if(handler){
                result = await handler(params);
            }

            if(!shouldStopConversation() && handleSend && (!shouldConfirm || confirm("Allow automation to proceed?"))){

                const feedbackMessage = {
                    op: action,
                    resultOfOp: result,
                }

                const assistantId =
                    getServerSelectedAssistant(message) ||
                    selectedAssistant?.id;

                if(!shouldStopConversation()) {

                    handleSend(
                        {
                            options:{assistantId},
                            message: newMessage(
                                {"role": "user", "content": JSON.stringify(feedbackMessage), label: "API Result"})
                        },
                        shouldStopConversation);
                }
            }
            // const handler = handlers[functionName];
            // if (handler) {
            //     handler(params).then((result: any) => {
            //         console.log("result:", result);
            //     });
            // }
            // else {
            //     console.error("No handler found for function:", functionName);
            // }
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
            <ExpansionComponent title={"I am working on your request..."} content={action}/>
        </div>
    </div>;
};

export default AutonomousBlock;
