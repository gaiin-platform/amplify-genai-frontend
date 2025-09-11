// src/hooks/useChatService.js
import { useCallback, useContext, useEffect, useRef } from 'react';
import HomeContext from '@/pages/api/home/home.context';
import { killRequest as killReq, MetaHandler } from '../services/chatService';
import { ChatBody, Conversation, CustomFunction, JsonSchema, Message, newMessage } from "@/types/chat";
import { ColumnsSpec, } from "@/utils/app/csv";
import { Plugin, PluginID } from '@/types/plugin';
import { useSession } from "next-auth/react"
import json5 from "json5";
import { DefaultModels, Model } from "@/types/model";
import { newStatus } from "@/types/workflow";
import { ReservedTags } from "@/types/tags";
import { deepMerge } from "@/utils/app/state";
import toast from "react-hot-toast";
import { OutOfOrderResults } from "@/utils/app/outOfOrder";
import { conversationWithCompressedMessages, remoteForConversationHistory, saveConversations } from "@/utils/app/conversation";
import { getHook } from "@/utils/app/chathooks";
import { AttachedDocument } from "@/types/attacheddocument";
import { Prompt } from "@/types/prompt";
import { usePromptFinderService } from "@/hooks/usePromptFinderService";
import { useChatService } from "@/hooks/useChatService";
import { ARTIFACTS_PROMPT, DEFAULT_TEMPERATURE } from "@/utils/app/const";
import { uploadConversation } from "@/services/remoteConversationService";
import { getFocusedMessages } from '@/services/prepareChatService';
import { doReadMemoryOp } from '@/services/memoryService';
import {
    ExtractedFact,
    Memory,
} from '@/types/memory';
import { getSettings } from '@/utils/app/settings';
import { isBasePrompt } from '@/utils/app/basePrompts';
import { promptForData } from '@/utils/app/llm';
import {
    buildExtractFactsPrompt,
    getRelevantMemories,
    buildMemoryContextPrompt
} from '@/utils/app/memory';
import { handleAgentRun, handleAgentRunResult, isWaitingForAgentResponse } from '@/utils/app/agent';
import { lzwCompress } from '@/utils/app/lzwCompression';

export type ChatRequest = {
    message: Message;
    endpoint?: string;
    deleteCount?: number;
    plugins?: Plugin[];
    existingResponse?: any;
    rootPrompt?: string | null;
    documents?: AttachedDocument[] | null;
    uri?: string | null;
    options?: { [key: string]: any };
    assistantId?: string;
    prompt?: Prompt;
    conversationId?: string;
};

export function useSendService() {
    const {
        state: { selectedConversation, conversations, featureFlags, folders, chatEndpoint, statsService, extractedFacts, memoryExtractionEnabled, defaultAccount },
        getDefaultModel, handleUpdateSelectedConversation,
        postProcessingCallbacks,
        dispatch: homeDispatch,
    } = useContext(HomeContext);

    const { data: session } = useSession();

    const conversationsRef = useRef(conversations);
    const messageTimestampRef = useRef<string | undefined>(undefined);
    
    // Add ref to track running agent sessions
    const runningAgentSessions = useRef<Set<string>>(new Set());

    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);

    const foldersRef = useRef(folders);

    useEffect(() => {
        foldersRef.current = folders;
    }, [folders]);

    const cleanupHomeState = () => {
        homeDispatch({ field: 'messageIsStreaming', value: false });
        homeDispatch({ field: 'loading', value: false });
        homeDispatch({ field: 'status', value: [] });
    }

    const {
        sendChatRequest,
        sendJsonChatRequestWithSchemaLoose,
        sendFunctionChatRequest,
        sendJsonChatRequest,
        sendJsonChatRequestWithSchema,
        sendCSVChatRequest
    } = useChatService();

    const { getPrefix } = usePromptFinderService();

    // const calculateTokenCost = (chatModel: Model, datasources: AttachedDocument[]) => {
    //     let cost = 0;

    //     datasources.forEach((doc) => {
    //         if (doc.metadata?.totalTokens) {
    //             cost += doc.metadata.totalTokens;
    //         }
    //     });

    //     const model = Models[chatModel.id as ModelID];
    //     if (!model) {
    //         return {
    //             prompts: -1,
    //             inputTokens: cost,
    //             inputCost: -1,
    //             outputCost: -1,
    //             totalCost: -1
    //         };
    //     }

    //     const contextWindow = model.actualTokenLimit;
    //     // calculate cost / context window rounded up
    //     const prompts = Math.ceil(cost / contextWindow);

    //     console.log("Prompts", prompts, "Cost", cost, "Context Window", contextWindow);

    //     const outputCost = prompts * model.outputCost;
    //     const inputCost = (cost / 1000) * model.inputCost;

    //     console.log("Input Cost", inputCost, "Output Cost", outputCost);

    //     return {
    //         prompts: prompts,
    //         inputCost: inputCost.toFixed(2),
    //         inputTokens: cost,
    //         outputCost: outputCost.toFixed(2),
    //         totalCost: (inputCost + outputCost).toFixed(2)
    //     };
    // }

    useEffect(() => {
        const awaitAgentRun = async (sessionId: string) => {
            // Check if this session is already running
            if (runningAgentSessions.current.has(sessionId)) {
                console.log(`Agent run for session ${sessionId} is already in progress`);
                return;
            }
            
            // Mark this session as running
            runningAgentSessions.current.add(sessionId);
            
            try {
                homeDispatch({field: 'messageIsStreaming', value: true}); 
                const agentResult = await handleAgentRun(sessionId, (status: any) => homeDispatch({ field: "status", value: [newStatus(status)] }));
                if (agentResult && selectedConversation) {
                    const lastIndex = selectedConversation.messages.length - 1;
                    selectedConversation.messages[lastIndex].data.state.agentLog = lzwCompress(JSON.stringify(agentResult));
                    const updatedConversation = await handleAgentRunResult(agentResult, selectedConversation, getDefaultModel(DefaultModels.CHEAPEST), defaultAccount, homeDispatch, statsService, chatEndpoint || '');
                    handleUpdateSelectedConversation(updatedConversation);
                } else {
                    console.error("Agent run failed");
                    const updatedMessages = selectedConversation?.messages;
                    if (updatedMessages) {
                        const lastMsgIndex = updatedMessages.length - 1;
                        updatedMessages[lastMsgIndex].content = "No response from the agent. Please try again later.";
                        updatedMessages[lastMsgIndex].data.state.agentRun.endTime = new Date();
                        handleUpdateSelectedConversation({...selectedConversation, messages: updatedMessages});
                    }
                }
            } finally {
                // Always remove the session from running set when done
                runningAgentSessions.current.delete(sessionId);
                cleanupHomeState();
            }
        }

        if (selectedConversation) {
            const agentRunData =  isWaitingForAgentResponse(selectedConversation);
            if (agentRunData?.sessionId) awaitAgentRun(agentRunData.sessionId);
        }
    }, [selectedConversation?.messages]);
    

    const handleSend = useCallback(
        async (request: ChatRequest, shouldAbort: () => boolean) => {
            return new Promise(async (resolve, reject) => {
                if (selectedConversation) {

                    let {
                        message,
                        deleteCount,
                        plugins,
                        existingResponse,
                        rootPrompt,
                        documents,
                        uri,
                        options,
                        conversationId
                    } = request;
                    messageTimestampRef.current = new Date().toISOString();

                    const featureOptions = getSettings(featureFlags).featureOptions;
                    const pluginActive = featureOptions.includePluginSelector;
                    const pluginIds: string[] | null = pluginActive ? plugins?.map((plugin: Plugin) => plugin.id) ?? [] : null;

                    const { content, label } = getPrefix(selectedConversation, message);
                    if (content) {
                        message.content = content + " " + message.content;
                        message.label = label;
                    }

                    if (selectedConversation
                        && selectedConversation?.model
                        && !options?.ragOnly) {

                        // const {prompts, inputCost, inputTokens, outputCost, totalCost} =
                        //     calculateTokenCost(selectedConversation.model, documents || []);

                        // if (totalCost === -1 && inputTokens > 4000) {
                        //     const go = confirm(`This request will require ${inputTokens} input tokens at an unknown cost.`);
                        //     if (!go) {
                        //         return;
                        //     }
                        // }
                        // if (+totalCost > 0.5) {
                        //     const go = confirm(`This request will cost an estimated $${totalCost} (the actual cost may be more) and require ${prompts} prompt(s).`);
                        //     if (!go) {
                        //         return;
                        //     }
                        // }
                    }
                    console.log("Model in use: ", selectedConversation.model.name);
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
                    // console.log("updated: ", updatedConversation.messages);

                    if (!updatedConversation.model) {
                        const defaultModel = getDefaultModel(DefaultModels.DEFAULT)
                        console.log("WARNING: MODEL IS UNDEFINED SETTING TO DEFAULT: ", defaultModel);
                        updatedConversation.model = defaultModel;
                    }

                    homeDispatch({
                        field: 'selectedConversation',
                        value: updatedConversation,
                    });

                    homeDispatch({ field: 'loading', value: true });
                    homeDispatch({ field: 'messageIsStreaming', value: true });

                    let isArtifactsOn = featureFlags.artifacts && featureOptions.includeArtifacts &&
                        // we only consider whats in the plugins if we have the feature option for it on.
                        (!pluginIds || (pluginIds.includes(PluginID.ARTIFACTS) && !pluginIds.includes(PluginID.CODE_INTERPRETER))) &&
                        // turn off artifacts for base prompt templates
                        !(selectedConversation?.promptTemplate && isBasePrompt(selectedConversation.promptTemplate.id));
                    console.log("Artifacts on: ", isArtifactsOn)
                    if (selectedConversation?.promptTemplate && isBasePrompt(selectedConversation.promptTemplate.id)) {
                        console.log("Artifacts disabled for base prompt template: ", selectedConversation.promptTemplate.name);
                    }
                    const isSmartMessagesOn = featureOptions.includeFocusedMessages && (!pluginIds || (pluginIds.includes(PluginID.SMART_MESSAGES)));
                    console.log("Smart Messageson: ", isSmartMessagesOn)

                    const isMemoryOn = featureFlags.memory && featureOptions.includeMemory && (!pluginIds || (pluginIds.includes(PluginID.MEMORY)));
                    console.log("Memory on: ", isMemoryOn)

                    // if both artifact and smart messages is off then it returnes with the messages right away 
                    const {focusedMessages, includeArtifactInstr} = await getFocusedMessages(chatEndpoint || '', updatedConversation, statsService,
                        isArtifactsOn, isSmartMessagesOn, homeDispatch, getDefaultModel(DefaultModels.ADVANCED), getDefaultModel(DefaultModels.CHEAPEST), defaultAccount);

                    if (isArtifactsOn && !includeArtifactInstr) {
                        isArtifactsOn = false;
                        console.log("Turning Artifacts off - llm determined it is not needed")
                    }

                    console.log("Conversation tokens: ", updatedConversation.maxTokens);
                    const chatBody: ChatBody = {
                        model: updatedConversation.model,
                        messages: focusedMessages, //updatedConversation.messages,
                        prompt: rootPrompt || updatedConversation.prompt || "",
                        temperature: updatedConversation.temperature || DEFAULT_TEMPERATURE,
                        maxTokens: updatedConversation.maxTokens || (Math.round(updatedConversation.model.outputTokenLimit / 2)),
                        conversationId
                    };


                    if (selectedConversation?.projectId) {
                        // console.log("Selected Project Memory ID:", selectedConversation.projectId);
                        chatBody.projectId = selectedConversation.projectId;
                    }

                    // Handle memory operations in parallel with the main request flow
                    if (isMemoryOn) {
                        // For memory context, use a short timeout to keep the request moving
                        // if memory retrieval takes too long
                        try {
                            // Create a promise with a timeout
                            const memoriesPromise = Promise.race([
                                doReadMemoryOp({}),
                                new Promise<any>((_, reject) =>
                                    setTimeout(() => reject(new Error('Memory fetch timeout')), 500) // 500ms timeout
                                )
                            ]);

                            const memoriesResponse = await memoriesPromise;
                            const allMemories = JSON.parse(memoriesResponse.body).memories || [];
                            const relevantMemories = getRelevantMemories(allMemories);
                            const memoryContext = buildMemoryContextPrompt(relevantMemories);

                            if (memoryContext) {
                                chatBody.prompt += '\n\n' + memoryContext;
                            }
                        } catch (error) {
                            // If memory fetching times out or fails, just proceed without it
                            console.log("Skipping memory context due to timeout or error:", error);
                        }
                    }

                    if (isArtifactsOn) {
                        // account for plugin on/off features 
                        const astFeatureOptions = message.data?.assistant?.definition?.featureOptions;

                        // ast feature option trumps 
                        // either no ast feature option exists
                        // or the assistant has it turned on
                        if ((!astFeatureOptions) || (astFeatureOptions.IncludeArtifactsInstr)) {
                            chatBody.prompt += '\n\n' + ARTIFACTS_PROMPT;
                            //  console.log("ARTIFACT PROMPT ADDED")
                        }
                    }

                    if (uri) {
                        chatBody.endpoint = uri;
                    }

                    if (documents && documents.length > 0) {

                        const dataSources = documents.map((doc) => {
                            if (doc.key && doc.key.indexOf("://") === -1) {
                                return { id: "s3://" + doc.key, type: doc.type, name: doc.name || "", metadata: doc.metadata || {} };
                            } else if (doc.key && doc.key.indexOf("://") > -1) {
                                return { id: doc.key, type: doc.type, name: doc.name || "", metadata: doc.metadata || {} };
                            } else {
                                return doc;
                            }
                        });
                        chatBody.dataSources = dataSources;
                    } else if (message.data && message.data.dataSources && message.data.dataSources.length > 0) {
                        chatBody.dataSources = message.data.dataSources.map((doc: any) => {
                            return { id: doc.id, type: doc.type, name: doc.name || "", metadata: doc.metadata || {} };
                        });
                    }


                    //PLUGINS before options is assigned
                    //in case no plugins are defined, we want to keep the default behavior
                    if (!featureFlags.ragEnabled || (plugins && pluginActive && !pluginIds?.includes(PluginID.RAG))) {
                        options = { ...(options || {}), skipRag: true, ragOnly: false, ragEvaluation: false };
                        console.log('skipping rag');
                    } else if (featureFlags.ragEnabled && featureFlags.ragEvaluation && (pluginIds?.includes(PluginID.RAG) && pluginIds?.includes(PluginID.RAG_EVAL))) {
                        options = { ...(options || {}), ragEvaluation: true };
                    }
                                                      // Advanced Rag is default off for assistant use 
                    if (!featureFlags.cachedDocuments || options?.assistantId || options?.groupId) {
                        options = { ...(options || {}), skipDocumentCache : true};
                    }


                    if (!featureFlags.codeInterpreterEnabled) {
                        //check if we need
                        options = { ...(options || {}), skipCodeInterpreter: true };
                    } else {
                        if (pluginIds?.includes(PluginID.CODE_INTERPRETER)) {
                            chatBody.codeInterpreterAssistantId = updatedConversation.codeInterpreterAssistantId;
                            options = { ...(options || {}), skipRag: true, codeInterpreterOnly: true };
                            statsService.codeInterpreterInUseEvent();
                        }
                    }

                    if (selectedConversation && selectedConversation.tags) {
                        const tags = selectedConversation.tags;
                        if (tags.includes(ReservedTags.ASSISTANT_BUILDER)) {
                            // In assistants, this has the effect of
                            // disabling the use of documents so that we
                            // can just add the document to the list of documents
                            // the assistant is using.
                            options = {
                                ...(options || {}),
                                skipRag: true,
                                ragOnly: false
                            };
                        }
                    }

                    if (selectedConversation.model?.supportsReasoning) {
                        // console.log("model supports reasoning: ", selectedConversation.data?.reasoningLevel)
                        options = {
                            ...(options || {}),
                            reasoningLevel: selectedConversation.data?.reasoningLevel
                        };
                    }

                    if (options) {
                        Object.assign(chatBody, options);
                    }

                    // console.log("Chatbody:", chatBody);

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

                        return { prefix: "chat", body: message, options: {} }; // Return null if the message does not match the expected format
                    }

                    const controller = new AbortController();
                    const handleStopGenerationEvent = () => {
                        controller.abort();
                        console.log("Kill chat event trigger, control signal aborted value: ", controller.signal.aborted);
                    }

                    window.addEventListener('killChatRequest', handleStopGenerationEvent);
                    try {

                        const { prefix, body, options } = parseMessageType(message.content);
                        let updated = { ...message, content: body };
                        chatBody.messages = [...chatBody.messages.slice(0, -1), updated];

                        if (request.endpoint) {
                            chatBody.endpoint = request.endpoint;
                        }

                        // console.log(`Prompt:`, { prefix: prefix, options, message });

                        const generateJsonLoose = (): Promise<Response> => {
                            if (options.length === 0) {
                                return sendJsonChatRequest(chatBody, controller.signal);
                            } else {
                                return sendJsonChatRequestWithSchemaLoose(chatBody, options as JsonSchema, controller.signal)
                            }
                        }

                        let outOfOrder = false;
                        let currentState: any = {};
                        let reasoningText = "";
                        let reasoningMode = false; // support gemini reasoning

                        const metaHandler: MetaHandler = {
                            status: (meta: any) => {
                                //capture reasoning to compress and save in state at the end of the astresponse
                                if (meta.id === "reasoning") reasoningText += meta.message;
                                homeDispatch({ type: "append", field: "status", value: newStatus(meta) })
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
                            "fn": () => sendFunctionChatRequest(chatBody, options.functions as CustomFunction[], options.call, controller.signal, metaHandler),
                            "chat": () => sendChatRequest(chatBody, controller.signal, metaHandler),
                            "csv": () => sendCSVChatRequest(chatBody, options as ColumnsSpec, controller.signal, metaHandler),
                            "json": () => generateJsonLoose(),
                            "json!": () => sendJsonChatRequestWithSchema(chatBody, options as JsonSchema, controller.signal, metaHandler)
                        }

                        const response = (existingResponse) ?
                            existingResponse :
                            await invokers[prefix]();


                        if (!response || !response.ok) {
                            cleanupHomeState();
                            toast.error(response.statusText);
                            try {
                                // Clone the response to read the body (streams can only be read once)
                                const clonedResponse = response.clone();
                                // Read the body as text
                                const bodyText = await clonedResponse.text();
                                if (bodyText)  alert(bodyText);
                            } catch (readError) {
                                console.error("Error reading response body:", readError);
                            }
                            return;
                        }
                        const data = response.body;
                        if (!data) {
                            cleanupHomeState();
                            return;
                        }
                        homeDispatch({ field: 'loading', value: false });
                        const reader = data.getReader();
                        const decoder = new TextDecoder();
                        let done = false;
                        let text = '';

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
                                data: { state: currentState }
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
                                const { value, done: doneReading } = await reader.read();
                                done = doneReading;
                                const chunkValue = decoder.decode(value);

                                if (!outOfOrder) {
                                    // check if codeInterpreterAssistantId
                                    const assistantIdMatch = chunkValue.match(/codeInterpreterAssistantId=(.*)/);

                                    if (assistantIdMatch) {
                                        const assistantIdExtracted = assistantIdMatch[1];
                                        //update conversation
                                        updatedConversation = {
                                            ...updatedConversation,
                                            codeInterpreterAssistantId: assistantIdExtracted
                                        };
                                        //move onto the next iteration
                                        continue;
                                    }
                                    if (text.includes("<thought>")) reasoningMode = true;
                        
                                    // Split by reasoning tags and process alternately
                                    const parts = chunkValue.split(/(<\/?thought>)/);
                                    
                                    for (const part of parts) {
                                        if (part === '<thought>') {
                                            reasoningMode = true;
                                        } else if (part === '</thought>') {
                                            reasoningMode = false;
                                        } else if (part) {
                                            if (reasoningMode) {
                                                reasoningText += part;
                                                homeDispatch({ type: "append", field: "status", value: newStatus({id: "reasoning", summary: "Thinking Details:", message: part, icon: "bolt", inProgress: true, animated: true}) });
                                            } else {
                                                text += part;
                                            }
                                        }
                                    }

                                    if (text.includes("</thought>")) reasoningMode = false;
                                } else {
                                    let event = { s: "0", d: chunkValue };
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
                                            {
                                                ...message,
                                                content: text,
                                                data: { ...(message.data || {}), state: currentState }
                                            };
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
                                if (selectedConversation.isLocal) {
                                    const updatedConversations: Conversation[] = conversationsRef.current.map(
                                        (conversation: Conversation) => {
                                            if (conversation.id === selectedConversation.id) {
                                                return conversationWithCompressedMessages(updatedConversation);
                                            }
                                            return conversation;
                                        },
                                    );
                                    if (updatedConversations.length === 0) {
                                        updatedConversations.push(conversationWithCompressedMessages(updatedConversation));
                                    }
                                    homeDispatch({ field: 'conversations', value: updatedConversations });
                                    saveConversations(updatedConversations);
                                } else {
                                    uploadConversation(updatedConversation, foldersRef.current);
                                    if (conversationsRef.current.length === 0) {
                                        const updatedConversations: Conversation[] = [remoteForConversationHistory(updatedConversation)];
                                        homeDispatch({ field: 'conversations', value: updatedConversations });
                                        saveConversations(updatedConversations);
                                    }
                                }
                                cleanupHomeState();
                                return;
                            }
                        }
                      

                        //console.log("Dispatching post procs: " + postProcessingCallbacks.length);
                        postProcessingCallbacks.forEach(callback => callback({
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
                                        const disclaimer = message.data.state.currentAssistantDisclaimer;
                                        let astMsg = updatedText;
                                        if (disclaimer) astMsg += "\n\n" + disclaimer;
                                        if (reasoningText) message.data.state.reasoning = lzwCompress(reasoningText);

                                        return {
                                            ...message,
                                            content: astMsg,
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

                        if (selectedConversation.isLocal) {
                            const updatedConversations: Conversation[] = conversationsRef.current.map(
                                (conversation: Conversation) => {
                                    if (conversation.id === selectedConversation.id) {
                                        return conversationWithCompressedMessages(updatedConversation);
                                    }
                                    return conversation;
                                },
                            );
                            if (updatedConversations.length === 0) {
                                updatedConversations.push(conversationWithCompressedMessages(updatedConversation));
                            }
                            homeDispatch({ field: 'conversations', value: updatedConversations });
                            saveConversations(updatedConversations);
                        } else {
                            uploadConversation(updatedConversation, foldersRef.current);

                            if (conversationsRef.current.length === 0) {
                                const updatedConversations: Conversation[] = [remoteForConversationHistory(updatedConversation)];
                                homeDispatch({ field: 'conversations', value: updatedConversations });
                                saveConversations(updatedConversations);
                            }
                        }
            
                        if (!isWaitingForAgentResponse(updatedConversation)) homeDispatch({ field: 'messageIsStreaming', value: false });

                        // Run memory extraction after main response is processed
                        if (isMemoryOn && memoryExtractionEnabled) {
                            // This runs completely independently and doesn't affect the main response flow
                            (async () => {
                                try {
                                    // get the last user message
                                    const userInput = updatedConversation.messages[updatedConversation.messages.length - 2]?.content || '';

                                    // console.log("User input: ", userInput);

                                    // Fetch existing memories for fact extraction
                                    const memoriesResponse = await doReadMemoryOp({});
                                    let existingMemories: Memory[] = [];

                                    try {
                                        const allMemories = JSON.parse(memoriesResponse.body).memories || [];
                                        existingMemories = getRelevantMemories(allMemories);
                                    } catch (error) {
                                        console.error("Error fetching existing memories for fact extraction:", error);
                                    }

                                    // Build and send fact extraction prompt
                                    const extractFactsPrompt = buildExtractFactsPrompt(userInput, existingMemories);

                                    // console.log("Extract facts prompt: ", extractFactsPrompt);

                                    const extractFactsResult = await promptForData(
                                        chatEndpoint || '',
                                        [], // Send empty array instead of conversation messages
                                        getDefaultModel(DefaultModels.CHEAPEST),
                                        extractFactsPrompt,
                                        defaultAccount,
                                        statsService
                                    );

                                    console.log("Extract facts result: ", extractFactsResult);

                                    if (!extractFactsResult) {
                                        console.warn('Fact extraction returned null response');
                                        return;
                                    }

                                    // Parse the response to extract facts
                                    const facts: ExtractedFact[] = [];
                                    const factBlocks = extractFactsResult.split('\n\n');

                                    for (const block of factBlocks) {
                                        if (!block.trim()) continue;

                                        const contentMatch = block.match(/FACT: (.*?)(?:\n|$)/);
                                        const taxonomyMatch = block.match(/TAXONOMY: (.*?)(?:\n|$)/);
                                        const reasoningMatch = block.match(/REASONING: ([\s\S]*?)(?:\n\n|$)/);

                                        if (contentMatch && taxonomyMatch) {
                                            facts.push({
                                                content: contentMatch[1].trim(),
                                                taxonomy_path: taxonomyMatch[1].trim(),
                                                reasoning: reasoningMatch ? reasoningMatch[1].trim() : "",
                                                conversation_id: conversationId || updatedConversation.id
                                            });
                                        }
                                    }

                                    // Filter out duplicates
                                    const existingContents = new Set(
                                        existingMemories.map((memory: Memory) => memory.content.toLowerCase().trim())
                                    );
                                    const uniqueFacts = facts.filter(fact =>
                                        !existingContents.has(fact.content.toLowerCase().trim())
                                    );

                                    // Update state with new facts
                                    homeDispatch({
                                        field: 'extractedFacts',
                                        value: [...(extractedFacts || []), ...uniqueFacts].filter(
                                            (fact, index, self) =>
                                                self.findIndex(f => f.content === fact.content) === index
                                        )
                                    });
                                } catch (error) {
                                    console.warn('Fact extraction process failed:', error);
                                }
                            })();
                        }

                        resolve(text);

                    } catch (error: any) {
                        cleanupHomeState();
                        return;
                        //reject(error);
                        // Handle any other errors, as required.
                    } finally {
                        window.removeEventListener('killChatRequest', handleStopGenerationEvent);
                    }
                    
                    if (!isWaitingForAgentResponse(updatedConversation))  {
                        //Reset the status display
                        homeDispatch({
                            field: 'status',
                            value: [],
                        });   
                    }
                   
                }
            });
        },
        [
            conversationsRef.current,
            selectedConversation
        ],
    );

    return {
        handleSend
    };
}
