import {IconClearAll, IconSettings, IconShare, IconDownload} from '@tabler/icons-react';
import {
    MutableRefObject,
    memo,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';
import toast from 'react-hot-toast';

import {useTranslation} from 'next-i18next';

import {getHook} from "@/utils/app/chathooks";
import {getEndpoint} from '@/utils/app/api';
import {OutOfOrderResults} from "@/utils/app/outOfOrder";

import {
    saveConversation,
    saveConversations,
    updateConversation,
} from '@/utils/app/conversation';
import {throttle} from '@/utils/data/throttle';

import {ChatBody, Conversation, CustomFunction, JsonSchema, Message, MessageType, newMessage} from '@/types/chat';
import {Plugin} from '@/types/plugin';

import HomeContext from '@/pages/api/home/home.context';

import Spinner from '../Spinner';
import {ChatInput} from './ChatInput';
import {ChatLoader} from './ChatLoader';
import {ErrorMessageDiv} from './ErrorMessageDiv';
import {ModelSelect} from './ModelSelect';
import {SystemPrompt} from './SystemPrompt';
import {TemperatureSlider} from './Temperature';
import {MemoizedChatMessage} from './MemoizedChatMessage';

import {usePromptFinderService} from '@/hooks/usePromptFinderService';
import {useChatService} from '@/hooks/useChatService';
import {VariableModal, parseVariableName} from "@/components/Chat/VariableModal";
import {defaultVariableFillOptions, parseEditableVariables, parsePromptVariables} from "@/utils/app/prompts";
import {v4 as uuidv4} from 'uuid';

import Workflow, {
    executeJSWorkflow, findParametersInWorkflowCode, replayJSWorkflow, stripComments
} from "@/utils/workflow/workflow";
import {fillInTemplate} from "@/utils/app/prompts";
import {OpenAIModel, OpenAIModelID, OpenAIModels} from "@/types/openai";
import {Prompt} from "@/types/prompt";
import {InputDocument, newStatus, Status, WorkflowContext, WorkflowDefinition} from "@/types/workflow";
import {AttachedDocument} from "@/types/attacheddocument";
import {Key} from "@/components/Settings/Key";
import {describeAsJsonSchema} from "@/utils/app/data";
import {DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE} from "@/utils/app/const";
import {getToolMetadata} from "@/utils/app/tools";
import {findWorkflowPattern} from "@/utils/workflow/aiflow";
import {TagsList} from "@/components/Chat/TagsList";
import {ShareAnythingModal} from "@/components/Share/ShareAnythingModal";
import {Assistant, DEFAULT_ASSISTANT} from "@/types/assistant";
import {sendChat as assistantChat} from "@/services/assistantService";
import {DownloadModal} from "@/components/Download/DownloadModal";
import {ColumnsSpec} from "@/utils/app/csv";
import json5 from "json5";
import {MemoizedRemoteMessages} from "@/components/Chat/MemoizedRemoteMessages";
import {MetaHandler} from "@/services/chatService";

interface Props {
    stopConversationRef: MutableRefObject<boolean>;
}

export const Chat = memo(({stopConversationRef}: Props) => {
        const {t} = useTranslation('chat');

        const {
            state: {
                selectedConversation,
                selectedAssistant,
                conversations,
                folders,
                models,
                apiKey,
                pluginKeys,
                serverSideApiKeyIsSet,
                messageIsStreaming,
                modelError,
                loading,
                prompts,
                defaultModelId,
                featureFlags,
                workspaceMetadata,
                statsService,
            },
            handleUpdateConversation,
            handleCustomLinkClick,
            postProcessingCallbacks,
            dispatch: homeDispatch,
            handleAddMessages: handleAddMessages
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

        const [currentMessage, setCurrentMessage] = useState<Message>();
        const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(true);
        const [showSettings, setShowSettings] = useState<boolean>(false);
        const [isPromptTemplateDialogVisible, setIsPromptTemplateDialogVisible] = useState<boolean>(false);
        const [isDownloadDialogVisible, setIsDownloadDialogVisible] = useState<boolean>(false);
        const [isShareDialogVisible, setIsShareDialogVisible] = useState<boolean>(false);
        const [variables, setVariables] = useState<string[]>([]);
        const [showScrollDownButton, setShowScrollDownButton] =
            useState<boolean>(false);
        const [promptTemplate, setPromptTemplate] = useState<Prompt | null>(null);

        const messagesEndRef = useRef<HTMLDivElement>(null);
        const chatContainerRef = useRef<HTMLDivElement>(null);
        const textareaRef = useRef<HTMLTextAreaElement>(null);
        const modelSelectRef = useRef<HTMLDivElement>(null);

        const [isWorkflowMode, setWorkflowMode] = useState<boolean>();

        const [messageQueue, setMessageQueue] = useState<Message[]>([]);


        const updateMessage = (selectedConversation: Conversation, updatedMessage: Message, updateIndex: number) => {
            let updatedConversation = {
                ...selectedConversation,
            }

            const updatedMessages: Message[] =
                updatedConversation.messages.map((message, index) => {
                    if (index === updateIndex) {
                        return {...updatedMessage};
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

            return updatedConversation;
        }


        const updateCurrentMessage = useCallback((text: string, data = {}) => {

            if (selectedConversation) {
                let toUpdate = selectedConversationRef.current || selectedConversation;

                const updatedMessages: Message[] = (toUpdate.messages.length == 0) ?
                    [newMessage({role: "assistant", content: text})] :
                    toUpdate.messages.map((message, index) => {
                        if (index === toUpdate.messages.length - 1) {
                            return {
                                ...message,
                                data: (data) ? data : (message.data) ? message.data : {},
                                content: text,
                            };
                        }
                        return message;
                    });


                let updatedConversation = {
                    ...toUpdate,
                    messages: updatedMessages,
                };

                homeDispatch({
                    field: 'selectedConversation',
                    value: updatedConversation,
                });
            }
        }, [selectedConversation]);


        const handleChatRewrite = useCallback(async (message: Message, updateIndex: number, toRewrite: string, prefix: string, suffix: string, feedback: string) => {
            if (selectedConversation) {

                homeDispatch({field: 'loading', value: true});
                homeDispatch({field: 'messageIsStreaming', value: true});

                const chatBody: ChatBody = {
                    model: selectedConversation.model,
                    messages: [...selectedConversation.messages.slice(0, -1),
                        {
                            ...message,
                            content:
                                "Prefix: Mary had a little lamb\n" +
                                "ToEdit: It's fleece was white as snow\n" +
                                "Suffix: Everywhere that Mary went, the lamb was sure to go." +
                                "Feedback: Make the lamb's fleece black." +
                                "Edited: It's fleece was black as coal\n" +
                                "Prefix: Once upon a time in the faraway kingdom \n" +
                                "ToEdit: There was a wise and just queen who loved her people deeply\n" +
                                "Suffix: She ruled the kingdom with honesty and kindness, earning her people's love and respect." +
                                "Feedback: Make the queen cruel and feared." +
                                "Edited: There was a cruel and feared queen who ruled her people with an iron fist.\n" +
                                "Prefix: The forest echoed with the songs of birds\n" +
                                "ToEdit: Their sweet melodies filling the air like a symphony\n" +
                                "Suffix: Their music was a constant reminder of the vibrant life that inhabited these woods." +
                                "Feedback: Make the birdsong discordant and cacophonous." +
                                "Edited: Their discordant, cacophonous cawing filled the air with unsettling noise.\n" +
                                "Prefix: The spaceship was hurtling towards the unknown\n" +
                                "ToEdit: The team inside were excited to be the first to explore new planets\n" +
                                "Suffix: It was a historic moment for mankind, a testament to human ingenuity and ambition." +
                                "Feedback: Make the team feel fearful and uncertain." +
                                "Edited: The team inside were gripped by a fearful uncertainty as they faced the alien expanse.\n" +
                                "Prefix: Research Report on Technological Innovations\n" +
                                "ToEdit: 1. AI and Machine Learning: A comprehensive study of the integration of AI and Machine Learning in different sectors.\n" +
                                "Suffix: 2. Blockchain Technology: An examination of the groundbreaking changes Blockchain has brought to the financial industry." +
                                "Feedback: Add sub-points under AI and Machine Learning detailing its applications in healthcare and automated driving." +
                                "Edited: \\n1.1 Healthcare: Analyzing how AI is improving diagnostics, patient care, and hospital management. \\n1.2 Automated Driving: Studying the influence of Machine Learning on the development of autonomous vehicles.\n" +
                                "Prefix: function fibonacci(n){\\n   if(n<=0){\\n        return \"Input should be a positive integer.\";\\n    }else if(n==1){\\n        return [0, 1];\\n    }else{\n" +
                                "ToEdit:  let seq = [0, 1];\\n        for(let i = 2; i < n; i++){\\n" +
                                "Suffix:  seq[i] = seq[i-1] + seq[i-2];\\n        }\\n        return seq;\\n   }\\n}\n" +
                                "Feedback: Instead of the Fibonacci sequence, make it generate a sequence of the form seq[i] = seq[i-1] * 2." +
                                "Edited: let seq = [1];\\n        for(let i = 1; i < n; i++){\\n" +
                                "Prefix: " +
                                prefix.replaceAll("\n", "\\n") +
                                "\nToEdit: " +
                                toRewrite.replaceAll("\n", "\\n") +
                                "\nSuffix: " +
                                suffix.replaceAll("\n", "\\n") +
                                "Feedback: " + feedback.replaceAll("\n", "\\n") +
                                "\nEdited: "
                        }
                    ],
                    key: apiKey,
                    prompt:
                        "You are a parsimonious editor who revises text, with no more or less than indicated. You are" +
                        "going to revise just the parts of messages indicated. Do not repeat anything that" +
                        "comes before or after the indicated part to edit. For outlines, pay close attention to the formatting" +
                        " of the outline. If you are editing a list, make sure to keep the list formatting and " +
                        "numbering continuity. Remember, what comes before and after will be grafted on. Pay attention" +
                        " in an outline to what depth you are and only write from that depth down unless specifically" +
                        " requested. Make the absolute minimum changes necessary to address the feedback. Don't escape " +
                        "new lines in your output. NEVER EXPLAIN YOUR CHANGES."
                    ,
                    temperature: selectedConversation.temperature,
                };

                statsService.sendChatRewriteEvent(chatBody, updateIndex);

                const controller = new AbortController();

                try {
                    const response = await sendChatRequest(chatBody, null, controller.signal);
                    let updatedConversation = {...selectedConversation};

                    if (!response.ok) {
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

                    homeDispatch({field: 'loading', value: false});
                    const reader = data.getReader();
                    const decoder = new TextDecoder();
                    let done = false;

                    let text = '';
                    while (!done) {
                        if (stopConversationRef.current === true) {
                            controller.abort();
                            done = true;
                            break;
                        }
                        const {value, done: doneReading} = await reader.read();
                        done = doneReading;
                        const chunkValue = decoder.decode(value);
                        text += chunkValue;

                        while (text.trim().startsWith("-")) {
                            text = text.trim().substring(text.indexOf("-") + 1);
                        }

                        while (text.trim().endsWith("-")) {
                            text = text.trim().substring(0, text.length - 1);
                        }

                        updatedConversation = updateMessage(selectedConversation, newMessage(
                                {...message, content: prefix + text + suffix}),
                            updateIndex);
                    }

                    homeDispatch({field: 'selectedConversation', value: updatedConversation});
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

                    return prefix + text + suffix;

                } catch (error: any) {
                    if (error.name === 'AbortError') {
                        // The request has been aborted. Clear out the queue.
                        setMessageQueue([]);
                    }

                    homeDispatch({field: 'loading', value: false});
                    homeDispatch({field: 'messageIsStreaming', value: false});

                    throw error;
                    // Handle any other errors, as required.
                }
            }
        }, [selectedConversation]);


        const scrollToModelSelect = useCallback(() => {

            if (modelSelectRef.current) {
                modelSelectRef.current.scrollIntoView({behavior: 'smooth'});
            }
        }, []);

        const handleSend = useCallback(
            async (message: Message, deleteCount = 0, plugin: Plugin | null = null, existingResponse = null, rootPrompt: string | null = null, documents?: AttachedDocument[] | null) => {
                return new Promise(async (resolve, reject) => {
                    if (selectedConversation) {

                        const {content, label} = getPrefix(selectedConversation, message);
                        if (content) {
                            message.content = content + " " + message.content;
                            message.label = label;
                        }

                        if (selectedConversation && selectedConversation?.model) {

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

                        //console.log("Root Prompt ID", selectedConversation.prompt.)

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
                        };

                        if (documents && documents.length > 0) {

                            const dataSources = documents.map((doc) => {
                                return {id: "s3://" + doc.key, type: doc.type};
                            });
                            chatBody.dataSources = dataSources;
                        } else if (message.data && message.data.dataSources && message.data.dataSources.length > 0) {
                            chatBody.dataSources = message.data.dataSources.map((doc: any) => {
                                return {id: doc.id, type: doc.type, metadata: doc.metadata || {}};
                            });
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

                            console.log(`Prompt:`, {prefix: prefix, options, message});

                            const generateJsonLoose = (): Promise<Response> => {
                                if (options.length === 0) {
                                    return sendJsonChatRequest(chatBody, plugin, controller.signal);
                                } else {
                                    return sendJsonChatRequestWithSchemaLoose(chatBody, options as JsonSchema, plugin, controller.signal)
                                }
                            }

                            let outOfOrder = false;

                            const metaHandler:MetaHandler = {
                                status:(meta:any) => {
                                    //console.log("Chat-Status: ", meta);
                                    homeDispatch({type:"append", field:"status", value:newStatus(meta)})
                                },
                                mode:(modeName:string) => {
                                    //console.log("Chat-Mode: "+modeName);
                                    outOfOrder = (modeName === "out_of_order");
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
                                    const customName =
                                        content.length > 30 ? content.substring(0, 30) + '...' : content;
                                    updatedConversation = {
                                        ...updatedConversation,
                                        name: customName,
                                    };
                                }
                                homeDispatch({field: 'loading', value: false});
                                const reader = data.getReader();
                                const decoder = new TextDecoder();
                                let done = false;
                                let isFirst = true;
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
                                        if (stopConversationRef.current === true) {
                                            controller.abort();
                                            done = true;
                                            break;
                                        }
                                        const {value, done: doneReading} = await reader.read();
                                        done = doneReading;
                                        const chunkValue = decoder.decode(value);

                                        if(!outOfOrder) {
                                            text += chunkValue;
                                        }
                                        else {
                                            let event = {s:"0", d:chunkValue};
                                            try{
                                                event = JSON.parse(chunkValue);
                                            }catch (e) {
                                                //console.log("Error parsing event", e);
                                            }
                                            eventOrderingMgr.addEvent(event);
                                            text = eventOrderingMgr.getText();
                                        }

                                        const updatedMessages: Message[] =
                                            updatedConversation.messages.map((message, index) => {
                                                if (index === updatedConversation.messages.length - 1) {
                                                    return {
                                                        ...message,
                                                        content: text,
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
                            if (error.name === 'AbortError') {
                                // The request has been aborted. Clear out the queue.
                                setMessageQueue([]);
                            }

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
                selectedConversation,
                stopConversationRef,
            ],
        );

        const selectedConversationRef = useRef<Conversation>(null);

        useEffect(() => {
            // In your useEffect, you should keep your ref in sync with the state.
            // @ts-ignore
            selectedConversationRef.current = selectedConversation;
        }, [selectedConversation]);

        const asyncSafeHandleAddMessages = async (messages: Message[]) => {
            await handleAddMessages(selectedConversationRef.current || selectedConversation, messages)
        };

        const handlePromptSelect = (prompt: Prompt) => {
            if (selectedConversation) {
                selectedConversation.promptTemplate = prompt;

                const parsedVariables = parseEditableVariables(prompt.content);
                setVariables(parsedVariables);

                if (parsedVariables.length > 0) {
                    setIsPromptTemplateDialogVisible(true);
                } else {
                    // setContent((prevContent) => {
                    //     const updatedContent = prevContent?.replace(/\/\w*$/, prompt.content);
                    //     return updatedContent;
                    // });
                    //updatePromptListVisibility(prompt.content);
                }
            }
        };

        function runPrompt(prompt: Prompt) {

            statsService.runPromptEvent(prompt);

            const variables = parseEditableVariables(prompt.content);

            if (variables.length > 0) {
                setPromptTemplate(prompt);
                setIsPromptTemplateDialogVisible(true);
            } else {
                handleSubmit([], [], prompt);
            }
        }

        const onLinkClick = (message: Message, href: string) => {

            // This should all be refactored into a separate module at some point
            // ...should really be looking up the handler by category/action and passing

            statsService.customLinkClickEvent(message, href);

            // it some sort of context
            if (selectedConversation) {
                let [category, action_path] = href.slice(1).split(":");
                let [action, path] = action_path.split("/");

                if (category === "workflow" && action === "run-workflow") {
                    const code = findWorkflowPattern(message.content);
                    if (code) {

                        let paramNamesStr = findParametersInWorkflowCode(code);
                        //console.log("paramNamesStr", paramNamesStr);

                        const usesDocuments = stripComments(code).includes("getDocument");
                        const content = usesDocuments ?
                            paramNamesStr +
                            "{{Document 1:file(optional:true)}}" +
                            "{{Document 2:file(optional:true)}}" +
                            "{{Document 3:file(optional:true)}}" +
                            "Running your workflow..." :
                            paramNamesStr + "Running your workflow...";

                        const prompt: Prompt = {
                            id: uuidv4(),
                            folderId: null,
                            name: "Run Workflow",
                            content: content,
                            type: "automation",
                            description: "Please provide any needed documents for the workflow.",
                            data: {
                                code: code,
                                inputs: {
                                    parameters: {},
                                    documents: []
                                }
                            }
                        };
                        runPrompt(prompt);
                    }
                } else if (category === "chat") {
                    if (action === "send") {
                        const content = path;
                        handleSend(newMessage({role: 'user', content: content}), 0, null);
                    } else if (action === "template") {
                        const name = path;

                        const prompt = prompts.find((p) => p.name === name);

                        if (prompt) {
                            runPrompt(prompt);
                        }
                    }
                } else {
                    handleCustomLinkClick(selectedConversationRef.current || selectedConversation, href,
                        {message: message, conversation: selectedConversation}
                    );
                }
            }
        }

        const getWorkflowDefinitionVariables = (workflowDefinition: WorkflowDefinition) => {
            let variables = Object.entries(workflowDefinition.inputs.parameters)
                .map(([name, param]) => {
                    return name;
                });

            let documentVariables = workflowDefinition.inputs.documents.map((doc) => {
                return doc.name + " :file";
            });

            return [...documentVariables, ...variables];
        }


        const getStopper = () => {
            let canceled = false;
            const controller = new AbortController();
            const stopper = {
                shouldStop: () => {
                    canceled = stopConversationRef.current === true;
                    return stopConversationRef.current === true;
                },
                signal: controller.signal,
                isCanceled: () => {
                    return canceled;
                }
            };

            return stopper;
        }

        const handleJsWorkflow = useCallback(async (message: Message, updatedVariables: string[], variablesByName: { [key: string]: any }, documents: AttachedDocument[] | null) => {

            if (!featureFlags.workflowRun) {
                alert("Running workflows is currently disabled.");
                return;
            }

            if (selectedConversation) {

                const workflowId = uuidv4();
                let statusHistory: Status[] = [];

                const statusLogger = (status: Status | null) => {

                    if (status) {
                        statusHistory.push(status);
                    } else {
                        statusHistory = [];
                    }

                    homeDispatch({field: 'status', value: statusHistory});
                }

                const telluser = async (msg: string) => {
                    await asyncSafeHandleAddMessages([
                        newMessage({role: "assistant", content: msg, data: {workflow: workflowId, type: "workflow:tell"}})])
                };

                let tools = {
                    "tellUser": {
                        description: "async (msg:string)=>Promise<void>//output a message to the user",
                        exec: telluser
                    }
                }

                message.data = (message.data) ?
                    {...message.data, ...{workflow: workflowId, type: "workflow:prompt"}} :
                    {workflow: workflowId, type: "workflow:prompt"};

                await asyncSafeHandleAddMessages([message]);

                let inputTypes: InputDocument[] = [];

                if (documents && documents.length > 0) {

                    let docs = documents;

                    let documentsTypes = docs.map((doc) => {
                        return {name: doc.name, type: doc.type};
                    });

                    await telluser(`Using documents: \n\n${formatter({type: 'table', data: documentsTypes})}`)
                }

                message.data.inputTypes = inputTypes;

                const stopper = getStopper();

                await telluser("Starting...");

                await homeDispatch({field: 'loading', value: true});
                await homeDispatch({field: 'messageIsStreaming', value: true});

                const context: WorkflowContext = {
                    inputs: {
                        documents: documents || [],
                        parameters: variablesByName,
                        conversations: conversations,
                        prompts: prompts,
                        folders: folders,
                    }
                }

                let code = message.data?.templateData?.data?.code;
                let isReplay = code != null;

                console.log(message.data);

                let runner = (isReplay) ?
                    () => {

                        code = fillInTemplate(code, variables, updatedVariables, documents, false);

                        return replayJSWorkflow(apiKey, code, tools, stopper, statusLogger, context, (responseText) => {
                            statusLogger(null);

                            updateCurrentMessage(responseText, {workflow: workflowId, type: "workflow:code"});
                        });
                    }
                    :
                    () => {
                        return executeJSWorkflow(apiKey, message.content, tools, stopper, statusLogger, context, (responseText) => {
                            responseText = "```javascript\n" + responseText;

                            statusLogger(null);

                            updateCurrentMessage(responseText, {workflow: workflowId, type: "workflow:code"});
                        });
                    };


                // @ts-ignore
                // executeJSWorkflow(apiKey, message.content, tools, stopper, context, (responseText) => {
                //     responseText = "```javascript\n" + responseText;
                //
                //     updateCurrentMessage(responseText, {workflow: workflowId, type: "workflow:code"});
                // })

                runner().then((result) => {

                    let workflowCode = result.code;

                    let resultStr = (typeof result.result === "string") ? result.result :
                        formatter(result.result);

                    let resultMsg = (stopper.isCanceled()) ?
                        "You stopped execution of this task." :
                        "Result\n---------------------\n" + resultStr;

                    let codeMsg = (stopper.isCanceled()) ? "" :
                        "\n\nCode\n---------------------\n" +
                        "```javascript \n" + result?.code + "```";

                    const msg = resultMsg; //+ codeMsg;

                    let resultMessages = [
                        newMessage({
                            role: "assistant", content: msg, data: {
                                // @ts-ignore
                                reusableDescription: result.reuseDesc,
                                // @ts-ignore
                                inputs: result.inputs,
                                workflow: workflowId,
                                workflowCode: workflowCode,
                                type: "workflow:result"
                            }
                        }),
                    ];

                    if (!isReplay) {
                        resultMessages.push(
                            newMessage({
                                role: "assistant",
                                data: {
                                    workflow: workflowId,
                                    type: "workflow:data"
                                },
                                content: `Would you like to: [Save Workflow](#workflow:save-workflow/${workflowId})?`
                            }));
                    }

                    asyncSafeHandleAddMessages(resultMessages)

                }).finally(() => {
                    statusLogger(null);

                    homeDispatch({field: 'loading', value: false});
                    homeDispatch({field: 'messageIsStreaming', value: false});
                });
            }

        }, [
            apiKey,
            conversations,
            pluginKeys,
            selectedConversation,
            stopConversationRef,
        ]);

        function generateMarkdownTable(data: Array<Record<string, any>>): string {
            if (!data || !Array.isArray(data) || data.length === 0)
                return '';

            // Get all unique keys
            const keys = Array.from(
                new Set(data.flatMap(obj => Object.keys(obj)))
            );

            let markdown = `| ${keys.join(' | ')} |\n| ${keys.map(() => '---').join(' | ')} |\n`;

            data.forEach(obj => {
                const row = keys.map(key => {
                    if (obj.hasOwnProperty(key)) {
                        // Replace line breaks with `<br>` if they exist.
                        return String(obj[key]).replace(/\n/g, ' <br> ');
                    } else {
                        return '';
                    }
                }).join(' | ');

                markdown += `| ${row} |\n`;
            });

            return markdown;
        }

        const formatter = (result: { type: string; data: Record<string, any>[]; } | null) => {
            console.log("formatter", result);
            if (result == null) {
                return "The workflow didn't produce any results.";
            } else if (result.type && result.type == "text") {
                if (typeof result.data === "string") {
                    return result.data;
                } else {
                    return "```json\n" + JSON.stringify(result.data, null, 2) + "\n```";
                }
            } else if (result.type && result.type == "code" && typeof result.data === "string") {
                return "```javascript\n\n" + result.data + "\n\n```";
            } else if (result.type && result.type == "code") {
                return "```javascript\n\n" + JSON.stringify(result.data) + "\n\n```";
            } else if (result.type && result.type == "object") {
                return "```json\n" + JSON.stringify(result.data, null, 2) + "\n```";
            } else if (result.type && Array.isArray(result.data) && result.type == "table") {
                return generateMarkdownTable(result.data);
            } else {
                return "```json\n" + JSON.stringify(result.data, null, 2) + "\n```";
            }
        };

        const handleOpenAiAssistant = async (selectedAssistant: Assistant, message: Message, deleteCount: number) => {
            if (selectedConversation) {
                const stopper = getStopper();

                const updatedMessages = [...selectedConversation.messages];
                if (deleteCount) {
                    for (let i = 0; i < deleteCount; i++) {
                        updatedMessages.pop();
                    }
                }

                updatedMessages.push(message);

                let updatedConversation = {
                    ...selectedConversation,
                    messages: updatedMessages,
                };

                homeDispatch({
                    field: 'selectedConversation',
                    value: updatedConversation,
                });

                console.log("Assistant Chat: ", selectedConversation);

                setCurrentMessage(message);

                homeDispatch({field: 'loading', value: true});
                homeDispatch({field: 'messageIsStreaming', value: true});

                assistantChat(apiKey,
                    stopper,
                    selectedAssistant,
                    selectedConversation.prompt,
                    [...selectedConversation?.messages, message],
                    () => {
                    },
                    selectedConversation?.model)
                    .then((r) => {
                        try {
                            const {success, messages} = r;

                            if (!success || !messages || messages.length === 0 && !success) {
                                alert("The assistant failed to respond. Please try again.");
                                return;
                            }

                            const newMessages = messages.map((m: any[]) => {
                                return {...m, id: uuidv4()}
                            });

                            console.log("Assistant Chat Response", newMessages);

                            const newUpdatedConversation = {
                                ...updatedConversation,
                                messages: [...updatedMessages, ...newMessages]
                            }
                            console.log("Updated Conversation", newUpdatedConversation);

                            homeDispatch({field: 'selectedConversation', value: newUpdatedConversation});
                            saveConversation(selectedConversation);
                        } catch (e) {
                            console.log("Error updating conversation", e);
                            alert("Unable to reach the assistant. Please try again.");
                        }
                    })
                    .finally(() => {
                        homeDispatch({field: 'loading', value: false});
                        homeDispatch({field: 'messageIsStreaming', value: false});
                    });
            }
        }

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


            console.log("Model", model);
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

        const routeMessage = (message: Message, deleteCount: number | undefined, plugin: Plugin | null | undefined, documents: AttachedDocument[] | null) => {

            if (message.type == MessageType.PROMPT
                || message.type == MessageType.ROOT
                || message.type == "chat" //Unfortunate hack to support old messages
            ) {

                const existingDatasources = message.data?.dataSources || [];
                const newDatasources = documents?.filter((doc) => doc.key).map((doc) => {
                    return {id: "s3://" + doc.key, name: doc.name, type: doc.type, metadata: doc.metadata || {}};
                }) || [];

                console.log("Building data sources");
                const dataSources = [...existingDatasources, ...newDatasources];

                if (dataSources && dataSources.length > 0) {
                    console.log("Attaching datasource's to message");
                    message.data.dataSources = dataSources;
                }

                if (selectedAssistant && selectedAssistant?.id !== DEFAULT_ASSISTANT.id) {
                    if (selectedConversation) {

                        if (selectedAssistant.definition.provider === "openai") {
                            try {
                                handleOpenAiAssistant(selectedAssistant, message, deleteCount || 0);
                            } catch (e) {
                                alert("Error reaching OpenAI. Please retry your request.");
                            }
                        } else {
                            handleSend(message, deleteCount, plugin, null, selectedAssistant.definition.instructions, documents);
                        }
                    }
                } else {
                    handleSend(message, deleteCount, plugin, null, null, documents);
                }
            } else if (message.type == MessageType.AUTOMATION) {
                handleJsWorkflow(message, [], {}, documents);
            } else {
                console.log("Unknown message type", message.type);
            }
        }


        const handleSubmit = (updatedVariables: string[], documents: AttachedDocument[] | null, promptTemplate?: Prompt) => {

            let templateData = promptTemplate || selectedConversation?.promptTemplate;

            console.log("Template Data", templateData);

            if (templateData) {
                let template = templateData?.content;
                const variables = parseEditableVariables(template);

                const doWorkflow = templateData.type === "automation";

                const fillInDocuments = !(doWorkflow ||
                    (documents && documents?.some((doc) => doc.key)));

                // console.log("Do Workflow", doWorkflow);
                console.log("Fill In Documents", fillInDocuments);

                setWorkflowMode(doWorkflow);

                const newContent = fillInTemplate(template || "", variables, updatedVariables, documents, fillInDocuments);

                let label = null;

                if (templateData.type === MessageType.PREFIX_PROMPT) {
                    const labelPrefix = fillInTemplate(template || "", variables, [], [], false);
                    label = newContent.substring(labelPrefix.length);
                }


                // Create a map with variable mapped to updatedVariables
                const variablesByName: { [key: string]: any } = {};
                const updatedVariablesMap = variables.forEach((v, index) => {
                    variablesByName[v] = updatedVariables[index];
                });


                console.log("Building data sources");
                const dataSources = documents?.filter((doc) => doc.key).map((doc) => {
                    return {id: "s3://" + doc.key, name: doc.name, type: doc.type};
                });

                let message = newMessage({
                    role: 'user',
                    content: newContent,
                    data: {templateData: templateData},
                    type: templateData?.type || MessageType.PROMPT,
                    label: label
                });

                if (dataSources && dataSources.length > 0) {
                    console.log("Attaching datasources to message");
                    message.data.dataSources = dataSources;
                }

                // @ts-ignore
                setCurrentMessage(message);

                if (message.type === MessageType.PROMPT ||
                    message.type === MessageType.ROOT ||
                    message.type === MessageType.PREFIX_PROMPT) {
                    if (documents && documents.length > 0) {
                        handleSend(message, 0, null, null, null, documents);
                    } else {
                        handleSend(message, 0, null);
                    }
                } else if (message.type === MessageType.AUTOMATION) {
                    console.log("Workflow", message);
                    handleJsWorkflow(message, updatedVariables, variablesByName, documents);
                } else {
                    if (documents && documents.length > 0) {
                        handleSend(message, 0, null, null, null, documents);
                    } else {
                        handleSend(message, 0, null);
                    }
                }
            }

        };

        const handleUpdateModel = useCallback((model: OpenAIModel) => {
            if (selectedConversation) {
                handleUpdateConversation(selectedConversation, {
                    key: 'model',
                    value: model,
                });
            }
        }, [selectedConversation]);

        const handleApiKeyChange = useCallback(
            (apiKey: string) => {
                homeDispatch({field: 'apiKey', value: apiKey});

                localStorage.setItem('apiKey', apiKey);
            },
            [homeDispatch],
        );


        const scrollToBottom = useCallback(() => {
            if (autoScrollEnabled) {
                messagesEndRef.current?.scrollIntoView({behavior: 'smooth'});
                textareaRef.current?.focus();
            }
        }, [autoScrollEnabled]);

        const handleScroll = () => {
            if (chatContainerRef.current) {
                const {scrollTop, scrollHeight, clientHeight} =
                    chatContainerRef.current;
                const bottomTolerance = 30;

                if (scrollTop + clientHeight < scrollHeight - bottomTolerance) {
                    setAutoScrollEnabled(false);
                    setShowScrollDownButton(true);
                } else {
                    setAutoScrollEnabled(true);
                    setShowScrollDownButton(false);
                }
            }
        };

        const handleScrollDown = () => {
            chatContainerRef.current?.scrollTo({
                top: chatContainerRef.current.scrollHeight,
                behavior: 'smooth',
            });
        };

        const handleSettings = () => {
            setShowSettings(!showSettings);
        };

        const onClearAll = () => {
            if (
                confirm(t<string>('Are you sure you want to clear all messages?')) &&
                selectedConversation
            ) {
                handleUpdateConversation(selectedConversation, {
                    key: 'messages',
                    value: [],
                });
            }
        };

        const scrollDown = () => {
            if (autoScrollEnabled) {
                messagesEndRef.current?.scrollIntoView(true);
            }
        };
        const throttledScrollDown = throttle(scrollDown, 250);

        useEffect(() => {
            throttledScrollDown();
            selectedConversation &&
            setCurrentMessage(
                selectedConversation.messages[selectedConversation.messages.length - 2],
            );
        }, [selectedConversation, throttledScrollDown]);

        const handleDeleteConversation = (conversation: Conversation) => {
            const updatedConversations = conversations.filter(
                (c) => c.id !== conversation.id,
            );

            homeDispatch({field: 'conversations', value: updatedConversations});

            saveConversations(updatedConversations);

            if (updatedConversations.length > 0) {
                homeDispatch({
                    field: 'selectedConversation',
                    value: updatedConversations[updatedConversations.length - 1],
                });

                saveConversation(updatedConversations[updatedConversations.length - 1]);
            } else {
                defaultModelId &&
                homeDispatch({
                    field: 'selectedConversation',
                    value: {
                        id: uuidv4(),
                        name: t('New Conversation'),
                        messages: [],
                        model: OpenAIModels[defaultModelId],
                        prompt: DEFAULT_SYSTEM_PROMPT,
                        temperature: DEFAULT_TEMPERATURE,
                        folderId: null,
                    },
                });

                localStorage.removeItem('selectedConversation');
            }
        };

        const handlePromptTemplateDialogCancel = (canceled: boolean) => {
            if (canceled) {
                if (selectedConversation && selectedConversation.promptTemplate && selectedConversation.messages.length == 0) {
                    handleDeleteConversation(selectedConversation);
                }
            }
            setIsPromptTemplateDialogVisible(false);
        }

        useEffect(() => {

            if (selectedConversation && selectedConversation.promptTemplate && selectedConversation.messages.length == 0) {
                //alert("Prompt Template");
                setVariables(parseEditableVariables(selectedConversation.promptTemplate.content))
                setIsPromptTemplateDialogVisible(true);
            } else if (selectedConversation && selectedConversation.workflowDefinition && selectedConversation.messages.length == 0) {
                //alert("Prompt Template");
                const workflowVariables = Object.entries(selectedConversation.workflowDefinition.inputs.parameters)
                    .map(([k, v]) => k);

                setVariables(workflowVariables);
                setIsPromptTemplateDialogVisible(true);
            }
        }, [selectedConversation]);

        useEffect(() => {
            const observer = new IntersectionObserver(
                ([entry]) => {
                    setAutoScrollEnabled(entry.isIntersecting);
                    if (entry.isIntersecting) {
                        textareaRef.current?.focus();
                    }
                },
                {
                    root: null,
                    threshold: 0.5,
                },
            );
            const messagesEndElement = messagesEndRef.current;
            if (messagesEndElement) {
                observer.observe(messagesEndElement);
            }
            return () => {
                if (messagesEndElement) {
                    observer.unobserve(messagesEndElement);
                }
            };
        }, [messagesEndRef]);

// @ts-ignore
        return (
            <div className="relative flex-1 overflow-hidden bg-white dark:bg-[#343541]">
                {!(apiKey || serverSideApiKeyIsSet) ? (
                    <div className="mx-auto flex h-full w-[300px] flex-col justify-center space-y-1 sm:w-[600px]">
                        <div className="text-left text-4xl font-bold text-black dark:text-white">
                            Welcome
                        </div>
                        <div className="text-left text-gray-500 dark:text-gray-400 mb-6">
                            <div className="text-left text-gray-500 dark:text-gray-400 mb-6">
                                The tool allows you to plug in your API keys to use this UI with
                                their API. Right now, only OpenAI is supported. It is <span
                                className="italic">only</span> used to communicate
                                with their APIs.
                            </div>

                            {!serverSideApiKeyIsSet ? (

                                <div className="text-left text-gray-500 dark:text-gray-400 mb-6">
                                    <div className="text-left text-2xl font-bold text-black dark:text-white">
                                        Please set your OpenAI API key:
                                    </div>
                                    <div className="text-left text-4xl font-bold text-black dark:text-white">
                                        <Key apiKey={apiKey} onApiKeyChange={handleApiKeyChange}/>
                                    </div>
                                </div>
                            ) : null}

                            <div className="text-left text-gray-500 dark:text-gray-400">
                                {t("If you don't have an OpenAI API key, you can get one here: ")}
                                <a
                                    href="https://platform.openai.com/account/api-keys"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-500 hover:underline"
                                >
                                    openai.com
                                </a>
                            </div>
                            <div className="text-left text-gray-500 dark:text-gray-400">
                                <div>
                                    Important: This tool is 100% unaffiliated with OpenAI, Anthropic, Google, etc.
                                </div>
                            </div>

                        </div>
                    </div>
                ) : modelError ? (
                    <ErrorMessageDiv error={modelError}/>
                ) : (
                    <>
                        <div
                            className="max-h-full overflow-x-hidden"
                            ref={chatContainerRef}
                            onScroll={handleScroll}
                        >
                            {selectedConversation?.messages.length === 0 ? (
                                <>
                                    <div
                                        className="mx-auto flex flex-col space-y-5 md:space-y-10 px-3 pt-5 md:pt-12 sm:max-w-[600px]">
                                        <div
                                            className="text-center text-3xl font-semibold text-gray-800 dark:text-gray-100">
                                            {models.length === 0 ? (
                                                <div>
                                                    <Spinner size="16px" className="mx-auto"/>
                                                </div>
                                            ) : (
                                                'Start a new conversation.'
                                            )}
                                        </div>

                                        {models.length > 0 && (
                                            <div
                                                className="flex h-full flex-col space-y-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-600">
                                                <ModelSelect/>

                                                <SystemPrompt
                                                    models={models}
                                                    handleUpdateModel={handleUpdateModel}
                                                    conversation={selectedConversation}
                                                    prompts={prompts}
                                                    onChangePrompt={(prompt) =>
                                                        handleUpdateConversation(selectedConversation, {
                                                            key: 'prompt',
                                                            value: prompt,
                                                        })
                                                    }
                                                />

                                                <TemperatureSlider
                                                    label={t('Temperature')}
                                                    onChangeTemperature={(temperature) =>
                                                        handleUpdateConversation(selectedConversation, {
                                                            key: 'temperature',
                                                            value: temperature,
                                                        })
                                                    }
                                                />

                                                {isPromptTemplateDialogVisible && selectedConversation.promptTemplate && (
                                                    <VariableModal
                                                        models={models}
                                                        handleUpdateModel={handleUpdateModel}
                                                        prompt={(selectedConversation.promptTemplate)}
                                                        variables={parseEditableVariables(selectedConversation?.promptTemplate.content)}
                                                        onSubmit={handleSubmit}
                                                        onClose={handlePromptTemplateDialogCancel}
                                                    />
                                                )}
                                                {isPromptTemplateDialogVisible && selectedConversation.workflowDefinition && (
                                                    <VariableModal
                                                        models={models}
                                                        handleUpdateModel={handleUpdateModel}
                                                        workflowDefinition={selectedConversation.workflowDefinition}
                                                        variables={getWorkflowDefinitionVariables(selectedConversation.workflowDefinition)}
                                                        onSubmit={handleSubmit}
                                                        onClose={handlePromptTemplateDialogCancel}
                                                    />
                                                )}

                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* eslint-disable-next-line react/jsx-no-undef */}
                                    <ShareAnythingModal
                                        open={isShareDialogVisible}
                                        onCancel={() => {
                                            setIsShareDialogVisible(false)
                                        }}
                                        onShare={() => {
                                            setIsShareDialogVisible(false);
                                        }}
                                        includePrompts={false}
                                        includeConversations={true}
                                        includeFolders={false}
                                        selectedConversations={selectedConversation ? [selectedConversation] : []}
                                    />
                                    {isDownloadDialogVisible && (
                                        <DownloadModal
                                            includeConversations={true}
                                            includePrompts={false}
                                            includeFolders={false}
                                            selectedConversations={selectedConversation ? [selectedConversation] : []}
                                            onCancel={() => {
                                                setIsDownloadDialogVisible(false);
                                            }}
                                            onDownloadReady={function (url: string): void {

                                            }}/>
                                    )}
                                    <div
                                        className="sticky top-0 z-10 flex justify-center border border-b-neutral-300 bg-neutral-100 py-2 text-sm text-neutral-500 dark:border-none dark:bg-[#444654] dark:text-neutral-200">
                                        {t('Workspace: ' + workspaceMetadata.name)} | {t('Model')}: {selectedConversation?.model.name} | {t('Temp')}
                                        : {selectedConversation?.temperature} |
                                        <button
                                            className="ml-2 cursor-pointer hover:opacity-50"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                scrollToModelSelect();
                                                handleSettings();
                                            }}
                                            title="Chat Settings"
                                        >
                                            <IconSettings size={18}/>
                                        </button>
                                        <button
                                            className="ml-2 cursor-pointer hover:opacity-50"
                                            onClick={onClearAll}
                                            title="Clear Messages"
                                        >
                                            <IconClearAll size={18}/>
                                        </button>
                                        <button
                                            className="ml-2 cursor-pointer hover:opacity-50"
                                            onClick={() => setIsShareDialogVisible(true)}
                                            title="Share"
                                        >
                                            <IconShare size={18}/>
                                        </button>
                                        <button
                                            className="ml-2 cursor-pointer hover:opacity-50"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setIsDownloadDialogVisible(true)

                                            }}
                                            title="Download"
                                        >
                                            <IconDownload size={18}/>
                                        </button>
                                    </div>
                                    <div ref={modelSelectRef}></div>
                                    {showSettings && (
                                        <div
                                            className="flex flex-col space-y-10 md:mx-auto md:max-w-xl md:gap-6 md:py-3 md:pt-6 lg:max-w-2xl lg:px-0 xl:max-w-3xl">
                                            <div
                                                className="flex h-full flex-col space-y-4 border-b border-neutral-200 p-4 dark:border-neutral-600 md:rounded-lg md:border">
                                                <ModelSelect/>
                                            </div>
                                        </div>
                                    )}

                                    <div
                                        className="flex flex-col space-y-10 md:mx-auto md:max-w-xl md:gap-6 md:py-3 md:pt-6 lg:max-w-2xl lg:px-0 xl:max-w-3xl">

                                        <div
                                            className="flex h-full flex-col space-y-4 border-b border-neutral-200 p-2 dark:border-neutral-600 md:rounded-lg md:border">

                                            <TagsList tags={selectedConversation?.tags || []} setTags={
                                                (tags) => {
                                                    if (selectedConversation) {
                                                        handleUpdateConversation(selectedConversation, {
                                                            key: 'tags',
                                                            value: tags,
                                                        });

                                                    }
                                                }
                                            }/>


                                        </div>
                                    </div>


                                    {selectedConversation?.messages.map((message, index) => (
                                        (message.type === MessageType.REMOTE) ?
                                            <MemoizedRemoteMessages
                                                key={index}
                                                message={message}
                                                messageIndex={index}
                                                onChatRewrite={handleChatRewrite}
                                                onSend={(message) => {
                                                    setCurrentMessage(message[0]);
                                                    //handleSend(message[0], 0, null);
                                                    routeMessage(message[0], 0, null, []);
                                                }}
                                                onSendPrompt={runPrompt}
                                                handleCustomLinkClick={onLinkClick}
                                                onEdit={(editedMessage) => {
                                                    console.log("Editing message", editedMessage);

                                                    setCurrentMessage(editedMessage);
                                                    // discard edited message and the ones that come after then resend
                                                    // handleSend(
                                                    //     editedMessage,
                                                    //     selectedConversation?.messages.length - index,
                                                    // );
                                                    if (editedMessage.role != "assistant") {
                                                        routeMessage(editedMessage, selectedConversation?.messages.length - index, null, []);
                                                    } else {
                                                        console.log("updateMessage");
                                                        updateMessage(selectedConversation, editedMessage, index);
                                                    }
                                                }}
                                            />
                                            :
                                            <MemoizedChatMessage
                                                key={index}
                                                message={message}
                                                messageIndex={index}
                                                onChatRewrite={handleChatRewrite}
                                                onSend={(message) => {
                                                    setCurrentMessage(message[0]);
                                                    //handleSend(message[0], 0, null);
                                                    routeMessage(message[0], 0, null, []);
                                                }}
                                                onSendPrompt={runPrompt}
                                                handleCustomLinkClick={onLinkClick}
                                                onEdit={(editedMessage) => {
                                                    console.log("Editing message", editedMessage);

                                                    setCurrentMessage(editedMessage);
                                                    // discard edited message and the ones that come after then resend
                                                    // handleSend(
                                                    //     editedMessage,
                                                    //     selectedConversation?.messages.length - index,
                                                    // );
                                                    if (editedMessage.role != "assistant") {
                                                        routeMessage(editedMessage, selectedConversation?.messages.length - index, null, []);
                                                    } else {
                                                        console.log("updateMessage");
                                                        updateMessage(selectedConversation, editedMessage, index);
                                                    }
                                                }}
                                            />
                                    ))}

                                    {loading && <ChatLoader/>}

                                    <div
                                        className="h-[162px] bg-white dark:bg-[#343541]"
                                        ref={messagesEndRef}
                                    />

                                    {isPromptTemplateDialogVisible && promptTemplate && (
                                        <VariableModal
                                            models={models}
                                            prompt={promptTemplate}
                                            handleUpdateModel={handleUpdateModel}
                                            variables={parseEditableVariables(promptTemplate.content)}
                                            onSubmit={(updatedVariables, documents, prompt) => {
                                                handleSubmit(updatedVariables, documents, prompt);
                                            }}
                                            onClose={(e) => {
                                                setIsPromptTemplateDialogVisible(false);
                                            }}
                                        />
                                    )}
                                </>
                            )}
                        </div>

                        <ChatInput
                            handleUpdateModel={handleUpdateModel}
                            stopConversationRef={stopConversationRef}
                            textareaRef={textareaRef}
                            onSend={(message, plugin, documents: AttachedDocument[] | null) => {
                                setCurrentMessage(message);
                                //handleSend(message, 0, plugin);
                                routeMessage(message, 0, plugin, documents);
                            }}
                            onScrollDownClick={handleScrollDown}
                            onRegenerate={() => {
                                if (currentMessage) {
                                    //handleSend(currentMessage, 2, null);
                                    routeMessage(currentMessage, 2, null, null);
                                }
                            }}
                            showScrollDownButton={showScrollDownButton}
                        />
                    </>
                )}
            </div>
        );
    })
;
Chat.displayName = 'Chat';
