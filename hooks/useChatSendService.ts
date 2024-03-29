// src/hooks/useChatService.js
import {incrementalJSONtoCSV} from "@/utils/app/incrementalCsvParser";
import {useCallback, useContext} from 'react';
import HomeContext from '@/pages/api/home/home.context';
import {killRequest as killReq, MetaHandler, sendChatRequest as send, sendChatRequestWithDocuments} from '../services/chatService';
import {ChatBody, Conversation, CustomFunction, JsonSchema, Message, newMessage} from "@/types/chat";
import {ColumnsSpec, generateCSVSchema} from "@/utils/app/csv";
import {Plugin} from '@/types/plugin';
import {wrapResponse, stringChunkCallback} from "@/utils/app/responseWrapper";

import {getSession} from "next-auth/react"
import json5 from "json5";
import {OpenAIModel, OpenAIModelID, OpenAIModels} from "@/types/openai";
import {newStatus} from "@/types/workflow";
import {ReservedTags} from "@/types/tags";
import {deepMerge} from "@/utils/app/state";
import toast from "react-hot-toast";
import callRenameChatApi from "@/components/Chat/RenameChat";
import {OutOfOrderResults} from "@/utils/app/outOfOrder";
import {saveConversation, saveConversations, updateConversation} from "@/utils/app/conversation";
import {getHook} from "@/utils/app/chathooks";
import {AttachedDocument} from "@/types/attacheddocument";
import {Prompt} from "@/types/prompt";
import {usePromptFinderService} from "@/hooks/usePromptFinderService";
import {useChatService} from "@/hooks/useChatService";

export type ChatRequest = {
    message: Message;
    endpoint?: string;
    deleteCount?: number;
    plugin?: Plugin | null;
    existingResponse?: any;
    rootPrompt?: string | null;
    documents?: AttachedDocument[] | null;
    uri?: string | null;
    options?: { [key: string]: any };
    assistantId?: string;
    prompt?: Prompt;
};

export function useSendService() {
    const {
        state: {apiKey, selectedConversation, conversations, pluginKeys, featureFlags},
        postProcessingCallbacks,
        dispatch:homeDispatch,
    } = useContext(HomeContext);

    const {
        sendChatRequest,
        sendJsonChatRequestWithSchemaLoose,
        sendFunctionChatRequest,
        sendJsonChatRequest,
        sendJsonChatRequestWithSchema,
        sendCSVChatRequest
    } = useChatService();

    const {getPrefix} = usePromptFinderService();

    const calculateTokenCost = (chatModel: OpenAIModel, datasources: AttachedDocument[]) => {
        let cost = 0;

        datasources.forEach((doc) => {
            if (doc.metadata?.totalTokens) {
                cost += doc.metadata.totalTokens;
            }
        });

        const model = OpenAIModels[chatModel.id as OpenAIModelID];
        if (!model) {
            return {
                prompts: -1,
                inputTokens: cost,
                inputCost: -1,
                outputCost: -1,
                totalCost: -1
            };
        }


        console.log("Model in chatSendService!", model);
        const contextWindow = model.actualTokenLimit;
        // calculate cost / context window rounded up
        const prompts = Math.ceil(cost / contextWindow);

        console.log("Prompts", prompts, "Cost", cost, "Context Window", contextWindow);

        const outputCost = prompts * model.outputCost;
        const inputCost = (cost / 1000) * model.inputCost;

        console.log("Input Cost", inputCost, "Output Cost", outputCost);

        return {
            prompts: prompts,
            inputCost: inputCost.toFixed(2),
            inputTokens: cost,
            outputCost: outputCost.toFixed(2),
            totalCost: (inputCost + outputCost).toFixed(2)
        };
    }

    const handleSend = useCallback(
        async (request:ChatRequest, shouldAbort:()=>boolean) => {
            return new Promise(async (resolve, reject) => {
                if (selectedConversation) {

                    let {
                        message,
                        deleteCount,
                        plugin,
                        existingResponse,
                        rootPrompt,
                        documents,
                        uri,
                        options,
                    } = request;

                    console.log("Sending msg:", message)

                    const {content, label} = getPrefix(selectedConversation, message);
                    if (content) {
                        message.content = content + " " + message.content;
                        message.label = label;
                    }

                    if (selectedConversation && selectedConversation.tags && selectedConversation.tags.includes(ReservedTags.ASSISTANT_BUILDER)) {
                        // In assistants, this has the effect of
                        // disabling the use of documents so that we
                        // can just add the document to the list of documents
                        // the assistant is using.
                        options = {
                            ...(options || {}),
                            skipRag: true,
                            ragOnly: true
                        };
                    }

                    if (!featureFlags.ragEnabled) {
                        options = {...(options || {}), skipRag: true};
                    }

                    if (selectedConversation
                        && selectedConversation?.model
                        && !options?.ragOnly) {

                        const {prompts, inputCost, inputTokens, outputCost, totalCost} =
                            calculateTokenCost(selectedConversation.model, documents || []);

                        if (totalCost === -1 && inputTokens > 4000) {
                            const go = confirm(`This request will require ${inputTokens} input tokens at an unknown cost.`);
                            if (!go) {
                                return;
                            }
                        }
                        if (totalCost > 0.5) {
                            const go = confirm(`This request will cost an estimated $${totalCost} (the actual cost may be more) and require ${prompts} prompt(s).`);
                            if (!go) {
                                return;
                            }
                        }
                    }

                    let updatedConversation: Conversation;
                    if (deleteCount) {
                        const updatedMessages = [...selectedConversation.messages];
                        for (let i = 0; i < deleteCount; i++) {
                            updatedMessages.pop();
                        }
                        updatedConversation = {
                            ...selectedConversation,
                            messages: [...updatedMessages, message],
                        };
                    } else {
                        updatedConversation = {
                            ...selectedConversation,
                            messages: [...selectedConversation.messages, message],
                        };
                    }
                    homeDispatch({
                        field: 'selectedConversation',
                        value: updatedConversation,
                    });
                    homeDispatch({field: 'loading', value: true});
                    homeDispatch({field: 'messageIsStreaming', value: true});
                    const chatBody: ChatBody = {
                        model: updatedConversation.model,
                        messages: updatedConversation.messages,
                        key: apiKey,
                        prompt: rootPrompt || updatedConversation.prompt,
                        temperature: updatedConversation.temperature,
                        maxTokens: updatedConversation.maxTokens || 1000
                    };

                    if (uri) {
                        chatBody.endpoint = uri;
                    }

                    if (!featureFlags.codeInterpreterEnabled) {
                        //check if we need
                        options =  {...(options || {}), skipCodeInterpreter: true};//skipCodeInterpreter isnt used rn
                    } else{
                        if (updatedConversation.codeInterpreterAssistantId) {
                            chatBody.codeInterpreterAssistantId = updatedConversation.codeInterpreterAssistantId;
                        }
                    }

                    if (documents && documents.length > 0) {

                        const dataSources = documents.map((doc) => {
                            if (doc.key && doc.key.indexOf("://") === -1) {
                                return {id: "s3://" + doc.key, type: doc.type, metadata: doc.metadata || {}};
                            } else if (doc.key && doc.key.indexOf("://") > -1) {
                                return {id: doc.key, type: doc.type, metadata: doc.metadata || {}};
                            } else {
                                return doc;
                            }
                        });
                        chatBody.dataSources = dataSources;
                    } else if (message.data && message.data.dataSources && message.data.dataSources.length > 0) {
                        chatBody.dataSources = message.data.dataSources.map((doc: any) => {
                            return {id: doc.id, type: doc.type, metadata: doc.metadata || {}};
                        });
                    }


                    if (options) {
                        Object.assign(chatBody, options);
                    }

                    const parseMessageType = (message: string): {
                        prefix: "chat" | "json" | "json!" | "csv" | "fn";
                        body: string;
                        options: any | null
                    } => {
                        // This regular expression will match 'someXYZ' as a prefix and capture
                        // the contents inside the parentheses.
                        const regex = /^(\w+[\!]?)\(([^)]*)\).*/;

                        const match = message.trim().match(regex);

                        // @ts-ignore
                        //console.log("Match",match[0],match[1],match[2]);

                        if (match &&
                            match.length === 3 &&
                            match[1] &&
                            (match[1] === "json"
                                || match[1] === "json!"
                                || match[1] === "csv"
                                || match[1] === "fn") &&
                            match[2]) {
                            try {
                                return {
                                    prefix: match[1],
                                    body: message.trim().slice(match[1].length),
                                    options: match[2].length > 0 ? json5.parse(match[2]) : {}
                                };
                            } catch (e) {

                            }
                        }

                        return {prefix: "chat", body: message, options: {}}; // Return null if the message does not match the expected format
                    }

                    const controller = new AbortController();
                    try {

                        const {prefix, body, options} = parseMessageType(message.content);
                        let updated = {...message, content: body};
                        chatBody.messages = [...chatBody.messages.slice(0, -1), updated];

                        if(request.endpoint) {
                            chatBody.endpoint = request.endpoint;
                        }

                        console.log(`Prompt:`, {prefix: prefix, options, message});

                        const generateJsonLoose = (): Promise<Response> => {
                            if (options.length === 0) {
                                return sendJsonChatRequest(chatBody, plugin, controller.signal);
                            } else {
                                return sendJsonChatRequestWithSchemaLoose(chatBody, options as JsonSchema, plugin, controller.signal)
                            }
                        }

                        let outOfOrder = false;
                        let currentState = {};

                        const metaHandler: MetaHandler = {
                            status: (meta: any) => {
                                //console.log("Chat-Status: ", meta);
                                homeDispatch({type: "append", field: "status", value: newStatus(meta)})
                            },
                            mode: (modeName: string) => {
                                //console.log("Chat-Mode: "+modeName);
                                outOfOrder = (modeName === "out_of_order");
                            },
                            state: (state: any) => {
                                currentState = deepMerge(currentState, state);
                            },
                            shouldAbort: () => {
                                if (shouldAbort()) {
                                    controller.abort();
                                    return true;
                                }
                                return false;
                            }
                        };

                        const invokers = {
                            "fn": () => sendFunctionChatRequest(chatBody, options.functions as CustomFunction[], options.call, plugin, controller.signal, metaHandler),
                            "chat": () => sendChatRequest(chatBody, plugin, controller.signal, metaHandler),
                            "csv": () => sendCSVChatRequest(chatBody, options as ColumnsSpec, plugin, controller.signal, metaHandler),
                            "json": () => generateJsonLoose(),
                            "json!": () => sendJsonChatRequestWithSchema(chatBody, options as JsonSchema, plugin, controller.signal, metaHandler)
                        }

                        const response = (existingResponse) ?
                            existingResponse :
                            await invokers[prefix]();


                        if (!response || !response.ok) {
                            homeDispatch({field: 'loading', value: false});
                            homeDispatch({field: 'messageIsStreaming', value: false});
                            toast.error(response.statusText);
                            return;
                        }
                        const data = response.body;
                        if (!data) {
                            homeDispatch({field: 'loading', value: false});
                            homeDispatch({field: 'messageIsStreaming', value: false});
                            return;
                        }
                        if (!plugin) {
                            if (updatedConversation.messages.length === 1) {
                                const {content} = message;
                                callRenameChatApi(content).then(customName => {
                                    updatedConversation = {
                                        ...updatedConversation,
                                        name: customName, // Use the name returned by Lambda
                                    };
                                }).catch(error => {
                                    console.error('Failed to rename conversation:', error);
                                    // fallback to default naming convention
                                    const {content} = message;
                                    const customName =
                                        content.length > 30 ? content.substring(0, 30) + '...' : content;
                                    updatedConversation = {
                                        ...updatedConversation,
                                        name: customName,
                                    };
                                });
                            }

                            homeDispatch({field: 'loading', value: false});
                            const reader = data.getReader();
                            const decoder = new TextDecoder();
                            let done = false;
                            let isFirst = true;
                            let text = '';
                            let codeInterpreterData = {};

                            // Reset the status display
                            homeDispatch({
                                field: 'status',
                                value: [],
                            });

                            const updatedMessages: Message[] = [
                                ...updatedConversation.messages,
                                newMessage({
                                    role: 'assistant',
                                    content: "",
                                    data: {state: currentState}
                                }),
                            ];
                            updatedConversation = {
                                ...updatedConversation,
                                messages: updatedMessages,
                            };
                            homeDispatch({
                                field: 'selectedConversation',
                                value: updatedConversation,
                            });


                            const eventOrderingMgr = new OutOfOrderResults();

                            while (!done) {
                                try {
                                    if (shouldAbort()) {
                                        controller.abort();
                                        done = true;
                                        break;
                                    }
                                    const {value, done: doneReading} = await reader.read();
                                    done = doneReading;
                                    const chunkValue = decoder.decode(value);

                                    if (!outOfOrder) {
                                        // check if codeInterpreterAssistantId
                                        const assistantIdMatch = chunkValue.match(/codeInterpreterAssistantId=(.*)/);
                                        const responseMatch = chunkValue.match(/codeInterpreterResponseData=(.*)/);

                                        if (assistantIdMatch) {
                                            const assistantIdExtracted = assistantIdMatch[1];
                                            //update conversation
                                            updatedConversation = {
                                                ...updatedConversation,
                                                codeInterpreterAssistantId: assistantIdExtracted
                                            };
                                            //move onto the next iteration
                                            continue;
                                        } else if (responseMatch) {
                                            //if we get a match we know its a json guaranteed
                                            const responseData = JSON.parse(responseMatch[1]);
                                            if (responseData['success'] && responseData['data'] && 'textContent' in responseData['data'].data) {
                                                codeInterpreterData = responseData['data'].data;
                                                text += responseData['data'].data.textContent; //had to write this way to eliminate error

                                            } else {
                                                console.log(responseData.error);
                                                text += "Something went wrong with code interpreter... please try again.";
                                            }

                                            continue;
                                        }

                                        text += chunkValue;
                                    } else {
                                        let event = {s: "0", d: chunkValue};
                                        try {
                                            event = JSON.parse(chunkValue);
                                        } catch (e) {
                                            //console.log("Error parsing event", e);
                                        }
                                        eventOrderingMgr.addEvent(event);
                                        text = eventOrderingMgr.getText();
                                    }

                                    const updatedMessages: Message[] =
                                        updatedConversation.messages.map((message, index) => {
                                            if (index === updatedConversation.messages.length - 1) {
                                                let assistantMessage =
                                                    { ...message,
                                                        content: text,
                                                        data: {...(message.data || {}), state: currentState}
                                                    };
                                                if (Object.keys(codeInterpreterData).length !== 0) {
                                                    assistantMessage['codeInterpreterMessageData'] = codeInterpreterData;
                                                }
                                                return assistantMessage
                                            }
                                            return message;
                                        });
                                    updatedConversation = {
                                        ...updatedConversation,
                                        messages: updatedMessages,
                                    };
                                    homeDispatch({
                                        field: 'selectedConversation',
                                        value: updatedConversation,
                                    });
                                } catch (error: any) {
                                    saveConversation(updatedConversation);
                                    const updatedConversations: Conversation[] = conversations.map(
                                        (conversation) => {
                                            if (conversation.id === selectedConversation.id) {
                                                return updatedConversation;
                                            }
                                            return conversation;
                                        },
                                    );
                                    if (updatedConversations.length === 0) {
                                        updatedConversations.push(updatedConversation);
                                    }
                                    homeDispatch({field: 'conversations', value: updatedConversations});
                                    saveConversations(updatedConversations);
                                    homeDispatch({field: 'messageIsStreaming', value: false});
                                    homeDispatch({field: 'loading', value: false});
                                    homeDispatch({field: 'status', value: []});
                                    return;
                                }
                            }
                            // }

                            //console.log("Dispatching post procs: " + postProcessingCallbacks.length);
                            postProcessingCallbacks.forEach(callback => callback({
                                plugin: plugin,
                                chatBody: chatBody,
                                response: text
                            }));

                            const hook = getHook(selectedConversation.tags || []);
                            if (hook) {

                                const result = hook.exec({}, selectedConversation, text);

                                let updatedText = (result && result.updatedContent) ? result.updatedContent : text;

                                const updatedMessages: Message[] =
                                    updatedConversation.messages.map((message, index) => {
                                        if (index === updatedConversation.messages.length - 1) {
                                            return {
                                                ...message,
                                                content: updatedText,
                                            };
                                        }
                                        return message;
                                    });
                                updatedConversation = {
                                    ...updatedConversation,
                                    messages: updatedMessages,
                                };
                                homeDispatch({
                                    field: 'selectedConversation',
                                    value: updatedConversation,
                                });
                            }

                            saveConversation(updatedConversation);
                            const updatedConversations: Conversation[] = conversations.map(
                                (conversation) => {
                                    if (conversation.id === selectedConversation.id) {
                                        return updatedConversation;
                                    }
                                    return conversation;
                                },
                            );
                            if (updatedConversations.length === 0) {
                                updatedConversations.push(updatedConversation);
                            }
                            homeDispatch({field: 'conversations', value: updatedConversations});
                            saveConversations(updatedConversations);
                            homeDispatch({field: 'messageIsStreaming', value: false});

                            resolve(text);
                        } else {
                            const {answer} = await response.json();
                            const updatedMessages: Message[] = [
                                ...updatedConversation.messages,
                                newMessage({role: 'assistant', content: answer}),
                            ];
                            updatedConversation = {
                                ...updatedConversation,
                                messages: updatedMessages,
                            };
                            homeDispatch({
                                field: 'selectedConversation',
                                value: updateConversation,
                            });
                            saveConversation(updatedConversation);
                            const updatedConversations: Conversation[] = conversations.map(
                                (conversation) => {
                                    if (conversation.id === selectedConversation.id) {
                                        return updatedConversation;
                                    }
                                    return conversation;
                                },
                            );
                            if (updatedConversations.length === 0) {
                                updatedConversations.push(updatedConversation);
                            }
                            homeDispatch({field: 'conversations', value: updatedConversations});
                            saveConversations(updatedConversations);
                            homeDispatch({field: 'loading', value: false});
                            homeDispatch({field: 'messageIsStreaming', value: false});

                            resolve(answer);
                        }
                    } catch (error: any) {
                        homeDispatch({field: 'loading', value: false});
                        homeDispatch({field: 'messageIsStreaming', value: false});
                        homeDispatch({
                            field: 'status',
                            value: [],
                        });
                        return;
                        //reject(error);
                        // Handle any other errors, as required.
                    }

                    //Reset the status display
                    homeDispatch({
                        field: 'status',
                        value: [],
                    });
                }
            });
        },
        [
            apiKey,
            conversations,
            pluginKeys,
            selectedConversation
        ],
    );

    return {
        handleSend
    };
}