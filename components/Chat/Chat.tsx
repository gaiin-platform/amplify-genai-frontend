import {IconClearAll, IconSettings} from '@tabler/icons-react';
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

import { getHook } from "@/utils/app/chathooks";
import {getEndpoint} from '@/utils/app/api';

import {
    saveConversation,
    saveConversations,
    updateConversation,
} from '@/utils/app/conversation';
import {throttle} from '@/utils/data/throttle';

import {ChatBody, Conversation, Message, MessageType, newMessage} from '@/types/chat';
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

import {useChatService} from '@/hooks/useChatService';
import {VariableModal, parseVariableName} from "@/components/Chat/VariableModal";
import {defaultVariableFillOptions, parseEditableVariables, parsePromptVariables} from "@/utils/app/prompts";
import {v4 as uuidv4} from 'uuid';

import Workflow, {
    executeJSWorkflow, replayJSWorkflow
} from "@/utils/workflow/workflow";
import { fillInTemplate } from "@/utils/app/prompts";
import {OpenAIModel, OpenAIModels} from "@/types/openai";
import {Prompt} from "@/types/prompt";
import {InputDocument, Status, WorkflowContext, WorkflowDefinition} from "@/types/workflow";
import {AttachedDocument} from "@/types/attacheddocument";
import {Key} from "@/components/Settings/Key";
import {describeAsJsonSchema} from "@/utils/app/data";
import {DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE} from "@/utils/app/const";
import {getToolMetadata} from "@/utils/app/tools";

interface Props {
    stopConversationRef: MutableRefObject<boolean>;
}

export const Chat = memo(({stopConversationRef}: Props) => {
        const {t} = useTranslation('chat');

        const {
            state: {
                selectedConversation,
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
            },
            handleUpdateConversation,
            handleCustomLinkClick,
            postProcessingCallbacks,
            dispatch: homeDispatch,
            handleAddMessages: handleAddMessages
        } = useContext(HomeContext);


        const {sendChatRequest} = useChatService();

        const [currentMessage, setCurrentMessage] = useState<Message>();
        const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(true);
        const [showSettings, setShowSettings] = useState<boolean>(false);
        const [isPromptTemplateDialogVisible, setIsPromptTemplateDialogVisible] = useState<boolean>(false);
        const [variables, setVariables] = useState<string[]>([]);
        const [showScrollDownButton, setShowScrollDownButton] =
            useState<boolean>(false);
        const [promptTemplate, setPromptTemplate] = useState<Prompt | null>(null);

        const messagesEndRef = useRef<HTMLDivElement>(null);
        const chatContainerRef = useRef<HTMLDivElement>(null);
        const textareaRef = useRef<HTMLTextAreaElement>(null);

        const [isWorkflowMode, setWorkflowMode] = useState<boolean>();

        const [messageQueue, setMessageQueue] = useState<Message[]>([]);



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


        const handleSend = useCallback(
            async (message: Message, deleteCount = 0, plugin: Plugin | null = null, existingResponse = null) => {
                return new Promise(async (resolve, reject) => {
                    if (selectedConversation) {

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
                            prompt: updatedConversation.prompt,
                            temperature: updatedConversation.temperature,
                        };

                        const controller = new AbortController();
                        try {
                            const response = (existingResponse) ? existingResponse : await sendChatRequest(chatBody, plugin, controller.signal);

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
                                    if (isFirst) {
                                        isFirst = false;
                                        const updatedMessages: Message[] = [
                                            ...updatedConversation.messages,
                                            newMessage({
                                                role: 'assistant',
                                                content: chunkValue,
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
                                    } else {
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
                                    }
                                }

                                console.log("Dispatching post procs: " + postProcessingCallbacks.length);
                                postProcessingCallbacks.forEach(callback => callback({
                                    plugin: plugin,
                                    chatBody: chatBody,
                                    response: text
                                }));

                                const hook = getHook(selectedConversation.tags || []);
                                if(hook){

                                    const result = hook.exec({}, selectedConversation, text);

                                    let updatedText = (result && result.updatedContent)? result.updatedContent : text;

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
                            reject(error);
                            // Handle any other errors, as required.
                        }
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
            if(selectedConversation) {
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

        const onLinkClick = (message:Message, href: string) => {

            if (selectedConversation) {
                let [category, action_path] = href.slice(1).split(":");
                let [action, path] = action_path.split("/");

                if(category === "chat"){
                    if(action === "send"){
                        const content = path;
                        handleSend(newMessage({role: 'user', content: content}), 0, null);
                    }
                    else if(action === "template"){
                        const name = path;

                        const prompt = prompts.find((p) => p.name === name);

                        console.log("Prompt", prompt);

                        if(prompt){

                            const variables = parseEditableVariables(prompt.content);

                            if(variables.length > 0) {
                                console.log("Showing Prompt Dialog", prompt);
                                setPromptTemplate(prompt);
                                setIsPromptTemplateDialogVisible(true);
                            }
                            else {
                                console.log("Submitting Prompt", prompt);
                                handleSubmit([], [], prompt);
                            }

                        }
                    }
                }
                else {
                    handleCustomLinkClick(selectedConversationRef.current || selectedConversation, href,
                        {message: message, conversation: selectedConversation}
                    );
                }
            }
        }

        const getWorkflowDefinitionVariables = (workflowDefinition:WorkflowDefinition) => {
            let variables = Object.entries(workflowDefinition.inputs.parameters)
                .map(([name, param]) => {
                    return name;
                });

            let documentVariables = workflowDefinition.inputs.documents.map((doc) => {
                return doc.name+" :file";
            });

            return [...documentVariables,...variables];
        }

        const handleJsWorkflow = useCallback(async (message: Message, updatedVariables: string[], documents: AttachedDocument[] | null) => {

            if(!featureFlags.workflowRun){
                alert("Running workflows is currently disabled.");
                return;
            }

            if (selectedConversation) {

                const workflowId = uuidv4();

                const statusLogger = (status: Status | null) => {
                    homeDispatch({field: 'status', value: status});
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

                let canceled = false;
                const controller = new AbortController();
                const stopper = {
                    shouldStop: () => {
                        canceled = stopConversationRef.current === true;
                        return stopConversationRef.current === true;
                    },
                    signal: controller.signal
                }

                await telluser("Creating the workflow...");

                await homeDispatch({field: 'loading', value: true});
                await homeDispatch({field: 'messageIsStreaming', value: true});

                const context:WorkflowContext = {
                    inputs: {
                        documents: documents || [],
                        parameters: {},
                        conversations: conversations,
                        prompts: prompts,
                        folders: folders,
                    }
                }

                let code = message.data?.templateData?.data?.code;
                let isReplay = code != null;

                console.log("isReplay", isReplay);
                console.log(message.data);

                let runner = (isReplay) ?
                    () => {

                    console.log("Filling in variables...");
                    code = fillInTemplate(code, variables, updatedVariables, documents, false);
                    console.log("Replaying workflow :: ", code);

                    return replayJSWorkflow(apiKey, code, tools, stopper, statusLogger, context, (responseText) => {
                        statusLogger(null);

                        updateCurrentMessage(responseText, {workflow: workflowId, type: "workflow:code"});
                    });}
                    :
                    () => {return executeJSWorkflow(apiKey, message.content, tools, stopper, statusLogger, context, (responseText) => {
                        responseText = "```javascript\n" + responseText;

                        statusLogger(null);

                        updateCurrentMessage(responseText, {workflow: workflowId, type: "workflow:code"});
                    });};


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

                    let resultMsg = (canceled) ?
                        "You stopped execution of this task." :
                        "Result\n---------------------\n" + resultStr;

                    let codeMsg = (canceled) ? "" :
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
                                workflowCode:workflowCode,
                                type: "workflow:result"
                            }
                        }),
                    ];

                    if(!isReplay){
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
                if(typeof result.data === "string") {
                    return result.data;
                }
                else {
                    return "```json\n" + JSON.stringify(result.data, null, 2) + "\n```";
                }
            } else if (result.type && result.type == "code" && typeof result.data === "string") {
                return "```javascript\n\n" + result.data + "\n\n```";
            } else if (result.type && result.type == "code") {
                return "```javascript\n\n" + JSON.stringify(result.data) + "\n\n```";
            } else if (result.type && result.type == "object") {
                return "```json\n" + JSON.stringify(result.data, null, 2) + "\n```";
            } else if (result.type && Array.isArray(result.data) && result.type == "table" ) {
                return generateMarkdownTable(result.data);
            } else {
                return "```json\n" + JSON.stringify(result.data, null, 2) + "\n```";
            }
        };

        const routeMessage = (message: Message, index: number | undefined, plugin: Plugin | null | undefined, documents: AttachedDocument[] | null) => {
            if (message.type == MessageType.PROMPT
                || message.type == "chat" //Unfortunate hack to support old messages
            ) {
                handleSend(message, index, plugin);
            } else if (message.type == MessageType.AUTOMATION) {
                handleJsWorkflow(message, [], documents);
            } else {
                console.log("Unknown message type", message.type);
            }
        }


        const handleSubmit = (updatedVariables: string[], documents: AttachedDocument[] | null, promptTemplate?:Prompt) => {

            let templateData = promptTemplate || selectedConversation?.promptTemplate;

            console.log("Template Data", templateData);

            if(templateData) {
                let template = templateData?.content;

                const doWorkflow = templateData.type == "automation";

                console.log("Do Workflow", doWorkflow);

                setWorkflowMode(doWorkflow);

                const newContent = fillInTemplate(template || "", variables, updatedVariables, documents, !doWorkflow);

                // Jules
                let message = newMessage({
                    role: 'user',
                    content: newContent,
                    data: {templateData: templateData},
                    type: templateData?.type || MessageType.PROMPT
                });

                // @ts-ignore
                setCurrentMessage(message);

                if (message.type == MessageType.PROMPT) {
                    handleSend(message, 0, null);
                } else {
                    console.log("Workflow", message);
                    handleJsWorkflow(message, updatedVariables, documents);
                }
            }

        };

        const handleUpdateModel = useCallback((model:OpenAIModel)=>{
            if(selectedConversation) {
                handleUpdateConversation(selectedConversation, {
                    key: 'model',
                    value: model,
                });
            }
        },[selectedConversation]);

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

            homeDispatch({ field: 'conversations', value: updatedConversations });

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

        const handlePromptTemplateDialogCancel = (canceled:boolean) => {
            if(canceled) {
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
            }
            else if (selectedConversation && selectedConversation.workflowDefinition && selectedConversation.messages.length == 0) {
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
                                    <div
                                        className="sticky top-0 z-10 flex justify-center border border-b-neutral-300 bg-neutral-100 py-2 text-sm text-neutral-500 dark:border-none dark:bg-[#444654] dark:text-neutral-200">
                                        {t('Model')}: {selectedConversation?.model.name} | {t('Temp')}
                                        : {selectedConversation?.temperature} |
                                        <button
                                            className="ml-2 cursor-pointer hover:opacity-50"
                                            onClick={handleSettings}
                                        >
                                            <IconSettings size={18}/>
                                        </button>
                                        <button
                                            className="ml-2 cursor-pointer hover:opacity-50"
                                            onClick={onClearAll}
                                        >
                                            <IconClearAll size={18}/>
                                        </button>
                                    </div>
                                    {showSettings && (
                                        <div
                                            className="flex flex-col space-y-10 md:mx-auto md:max-w-xl md:gap-6 md:py-3 md:pt-6 lg:max-w-2xl lg:px-0 xl:max-w-3xl">
                                            <div
                                                className="flex h-full flex-col space-y-4 border-b border-neutral-200 p-4 dark:border-neutral-600 md:rounded-lg md:border">
                                                <ModelSelect/>
                                            </div>
                                        </div>
                                    )}

                                    {selectedConversation?.messages.map((message, index) => (
                                        <MemoizedChatMessage
                                            key={index}
                                            message={message}
                                            messageIndex={index}
                                            onSend={(message) => {
                                                setCurrentMessage(message[0]);
                                                //handleSend(message[0], 0, null);
                                                routeMessage(message[0], 0, null, []);
                                            }}
                                            handleCustomLinkClick={onLinkClick}
                                            onEdit={(editedMessage) => {
                                                setCurrentMessage(editedMessage);
                                                // discard edited message and the ones that come after then resend
                                                // handleSend(
                                                //     editedMessage,
                                                //     selectedConversation?.messages.length - index,
                                                // );
                                                if (editedMessage.role != "assistant") {
                                                    routeMessage(editedMessage, selectedConversation?.messages.length - index, null, []);
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
                                            handleUpdateModel={handleUpdateModel}
                                            variables={parseEditableVariables(promptTemplate.content)}
                                            onSubmit={(updatedVariables, documents)=>{
                                                handleSubmit(updatedVariables, documents);
                                                //setPromptTemplate(null);
                                            }}
                                            onClose={(e)=>{
                                                console.log("Closing propt template dialog");
                                                setIsPromptTemplateDialogVisible(false);
                                                //setPromptTemplate(null);
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
