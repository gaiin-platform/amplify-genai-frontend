import {
    IconFileCheck,
} from '@tabler/icons-react';
import React, {useContext, useEffect} from "react";
import JSON5 from "json5";
import HomeContext from "@/pages/api/home/home.context";
import {useSendService} from "@/hooks/useChatSendService";
import {Conversation, Message, newMessage} from "@/types/chat";
import ExpansionComponent from "@/components/Chat/ExpansionComponent";

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
        handleCustomLinkClick,
        dispatch: homeDispatch,
        handleAddMessages: handleAddMessages
    } = useContext(HomeContext);

    const {handleSend} = useSendService();

    function parseApiCall(str:string) {
        const functionName = str.split("(")[0];
        const paramsStr = str.substring(str.indexOf('(') + 1, str.lastIndexOf(')'));
        const params = JSON5.parse("["+paramsStr+"]");
        return { functionName, params };
    }


    const handlers:{[key:string]:(params:any)=>any} = {
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

            console.log("chat:", chat);

            return chat;
        },
        "/folders": (params:any) => {
            return folders;
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
    }

    const runAction = (action: any) => {
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


            // homeDispatch(
            //
            // );

            const apiCall = parseApiCall(action);
            console.log("apiCall:", apiCall);

            const shouldConfirm = false;
            const { functionName, params } = apiCall;
            const url = params[0];
            const handler = handlers[url] || handlers["/"+url];
            const result = handler(params);
            const shouldAbort = () => false;
            if(handleSend && (!shouldConfirm || confirm("Allow automation to proceed?"))){
                handleSend(
                    {message:newMessage(
                        {"role":"user","content":JSON.stringify(result), label:"API Result"})},
                    shouldAbort);
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
