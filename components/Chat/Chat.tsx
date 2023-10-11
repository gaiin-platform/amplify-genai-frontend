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

import {getEndpoint} from '@/utils/app/api';

import {
    saveConversation,
    saveConversations,
    updateConversation,
} from '@/utils/app/conversation';
import {throttle} from '@/utils/data/throttle';

import {ChatBody, Conversation, Message, newMessage} from '@/types/chat';
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
import {parsePromptVariables} from "@/utils/app/prompts";
import { v4 as uuidv4 } from 'uuid';

import Workflow, {
    Context,
    executeOp,
    Op,
    OpRunner,
    createWorkflowRunner,
    ops,
    WorkflowRunner,
    fillTemplate,
    executeJSWorkflow,
} from "@/utils/workflow/workflow";
import {OpenAIModel} from "@/types/openai";
import {Prompt} from "@/types/prompt";
import {InputType} from "@/types/workflow";
import {AttachedDocument} from "@/components/Chat/AttachFile";
import {Key} from "@/components/Settings/Key";

interface Props {
    stopConversationRef: MutableRefObject<boolean>;
}

export const Chat = memo(({stopConversationRef}: Props) => {
        const {t} = useTranslation('chat');

        const {
            state: {
                selectedConversation,
                conversations,
                models,
                apiKey,
                pluginKeys,
                serverSideApiKeyIsSet,
                messageIsStreaming,
                modelError,
                loading,
                prompts,
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

        const messagesEndRef = useRef<HTMLDivElement>(null);
        const chatContainerRef = useRef<HTMLDivElement>(null);
        const textareaRef = useRef<HTMLTextAreaElement>(null);

        const [isWorkflowMode, setWorkflowMode] = useState<boolean>();

        const [messageQueue, setMessageQueue] = useState<Message[]>([]);

// State variables
        const [runnerQueue, setRunnerQueue] = useState<ReturnType<typeof createWorkflowRunner>[]>([]);


        const localOps = {
            prompt: async (op: Op, context: Context) => {

                if (selectedConversation) {
                    if (!op.message) throw new Error("The 'message' property is missing in 'send' operation.");

                    let message = newMessage({
                        ...op.message,
                        content: fillTemplate(op.message.content, context)
                    });

                    const chatBody: ChatBody = {
                        model: selectedConversation.model,
                        messages: [message],
                        key: apiKey,
                        prompt: selectedConversation.prompt,
                        temperature: selectedConversation.temperature,
                    };

                    return new Promise((resolve, reject) => {
                        sendChatRequest(chatBody, null, null)
                            .then(async (result) => {
                                let data = await result.text()
                                resolve(data);
                            })
                    });
                }
            }
        };

        const [runIndex, setRunIndex] = useState<number>(0);
        const [runner, setRunner] = useState<any | undefined>();

// Enqueue workflows
        const handleRunWorkflow = useCallback(async (workflow: Workflow) => {
            let allOps = {...localOps};

            console.log("Starting workflow...", runner)

            const runResult = workflow.run(
                {},
                allOps,
                async (stage, op, data) => {
                    console.log("Executing/" + stage, op);
                    await asyncSafeHandleAddMessages([newMessage({content: "Executing/" + stage + " op:" + op.op})])
                }
            );

            let result = await runResult;
            console.log("Run result", result);

            // @ts-ignore
            let resultMessages = Object.entries(result)
                .filter(([k, v]) => !k.startsWith("_"))
                .map(([k, v]) => {
                    let result = (typeof v !== 'string') ? JSON.stringify(v) : v;
                    return newMessage({role: "assistant", content: `${k}\n------------------\n${result}`});
                });


            await asyncSafeHandleAddMessages(
                // @ts-ignore
                [
                    newMessage({role: "user", content: `Workflow completed: ${workflow.name}`}),
                    ...resultMessages
                ]
            )

        }, [selectedConversation]);

        // enqueueMessage function to add a new message to the queue
        const enqueueWorkflowMessages = (messages: Message[]) => {
            setMessageQueue(currentQueue => [...currentQueue, ...messages]);
        };

        useEffect(() => {
            if (messageQueue.length > 0) {
                // There is a message in the queue, send it.
                const message = messageQueue[0]; // Get the first message.
                handleSend(message).then((response) => {
                    // After message is sent, remove it from the queue.
                    setMessageQueue(currentQueue => currentQueue.slice(1));
                });
            }
        }, [messageQueue]);

        const handleWorkflow = useCallback(async (messages: Message[]) => {
            enqueueWorkflowMessages(messages);
        }, [
            selectedConversation
        ]);

        const updateCurrentMessage = useCallback((text: string, data={}) => {

            if (selectedConversation) {
                let toUpdate = selectedConversationRef.current || selectedConversation;

                const updatedMessages: Message[] = (toUpdate.messages.length == 0) ?
                    [newMessage({role: "assistant", content: text})] :
                    toUpdate.messages.map((message, index) => {
                        if (index === toUpdate.messages.length - 1) {
                            return {
                                ...message,
                                data: (data)? data : (message.data) ? message.data: {},
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

        const onLinkClick = (href: string) =>{
            if(selectedConversation) {
                handleCustomLinkClick(selectedConversationRef.current || selectedConversation, href);
            }
        }


        const handleJsWorkflow = useCallback(async (message: Message, documents:AttachedDocument[] | null) => {
            if (selectedConversation) {

                const workflowId = uuidv4();

                const telluser = async (msg: string) => {
                    await asyncSafeHandleAddMessages([
                        newMessage({role: "assistant", content: msg, data:{workflow:workflowId, type:"workflow:tell"}})])
                };

                let tools = {
                    "tellUser": {
                        description: "async (msg:string)=>Promise<void>//output a message to the user",
                        exec: telluser
                    }
                }

                message.data = (message.data)?
                    {...message.data, ...{workflow:workflowId, type:"workflow:prompt"}} :
                    {workflow:workflowId, type:"workflow:prompt"};

                await asyncSafeHandleAddMessages([message]);

                console.log("message.data", message.data);

                let inputTypes: InputType[] = [];

                if (documents) {

                    let docs = documents;

                    console.log("Message documents", docs);

                    // @ts-ignore
                    function describeValue(value) {
                        try {
                            //console.log("Describe", value);

                            if (value == null) {
                                return "null";
                            }

                            if (typeof value === 'string') {
                                return `string[length:${value.length}]`;
                            }

                            if (Array.isArray(value)) {
                                if (value.length > 0) {
                                    return `[${describeValue(value[0])}]`;
                                } else {
                                    return 'array[length:0]';
                                }
                            }

                            if (value instanceof Object) {
                                const kvDescriptions = [];
                                for (let key in value) {
                                    kvDescriptions.push(`${key}:${describeValue(value[key])}`);
                                }

                                if (kvDescriptions.length > 0) {
                                    return `{${kvDescriptions.join(', ')}}`;
                                } else {
                                    return 'object[children:0]';
                                }
                            }

                            // Check for presence of length property for non-string types
                            if ('length' in value) {
                                return `${typeof value}[length:${value.length}]`;
                            } else {
                                return typeof value;
                            }
                        } catch (e) {
                            return "Unknown";
                        }
                    }

                    let documentsTypes = docs.map((doc) => {
                        return {name:doc.name, type:doc.type};
                    });

                    let documentsDescription = docs.map((doc) => {
                        let rawDesc = describeValue(doc.raw);
                        let dataDesc = describeValue(doc.data);
                        return `{name:"${doc.name}", type:"${doc.type}", raw:${rawDesc}, data:${dataDesc}}`;
                    }).join(",")

                    inputTypes = docs.map((doc) => {
                        let ext = doc.name.split('.').pop() || "none";
                        let input:InputType = {fileExtension:ext, fileMimeType:doc.type};
                        return input;
                    })

                    console.log("documentsDescription", documentsDescription);

                    // @ts-ignore
                    tools["getDocuments"] = {

                        description: "():[${documentsDescription}] // Prompts can never exceed approximately 25,000 characters," +
                            "so check them carefully if you include a document in them and if the document" +
                            "is bigger, then break it up into chunks to feed to the prompt and combine" +
                            "results. If you provide a part or whole document in a prompt to the LLM, you should separate it with"+
                            "------------------ \n document data \n----------------. If the document.data is not a string, " +
                            "JSON.stringify it first.",
                        exec: () => {
                            return docs;
                        }
                    };

                    await telluser(`Using documents: \n\n${formatter({type:'table', data:documentsTypes})}`)
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

                // @ts-ignore
                executeJSWorkflow(apiKey, message.content, tools, stopper, (responseText) => {
                    if (responseText.trim().startsWith("const")) {
                        responseText = "```javascript\n" + responseText;
                    }

                    updateCurrentMessage(responseText, {workflow:workflowId, type:"workflow:code"});
                }).then((result) => {

                    let resultStr = (typeof result.result === "string") ? result.result :
                        formatter(result.result);

                    let resultMsg = (canceled) ?
                        "You stopped execution of this task." :
                        "Result\n---------------------\n" + resultStr;

                    let codeMsg = (canceled) ? "" :
                        "\n\nCode\n---------------------\n" +
                        "```javascript \n" + result?.code + "```";

                    const msg = resultMsg; //+ codeMsg;

                    asyncSafeHandleAddMessages(
                        [
                            newMessage({role:"assistant", content:msg, data:{workflow:workflowId, type:"workflow:result"}}),
                            newMessage({role:"assistant",
                                data:{workflow:workflowId, type:"workflow:post-actions"},
                                content: `Would you like to: [Save Workflow](#workflow:save-workflow/${workflowId}) or [Discard Workflow](#workflow:discard-workflow)`})
                        ]
                    )

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
            console.log("formatter",result);
            if (result == null) {
                return "The workflow didn't produce any results.";
            } else if (result.type && result.type == "text") {
                return result.data;
            } else if (result.type && Array.isArray(result.data) && result.type == "table") {
                return generateMarkdownTable(result.data);
            } else {
                return JSON.stringify(result.data, null, 2);
            }
        };

        const routeMessage = (message: Message, index: number | undefined, plugin: Plugin | null | undefined, documents:AttachedDocument[] | null) => {
            if (message.type == "prompt" || message.type == "chat") {
                handleSend(message, index, plugin);
            } else if (message.type == "automation") {
                handleJsWorkflow(message, documents);
            }
            else {
                console.log("Unknown message type", message.type);
            }
        }

        const handleSubmit = (updatedVariables: string[], documents:AttachedDocument[] | null) => {

            let template = selectedConversation?.promptTemplate?.content;

            const doWorkflow = selectedConversation?.promptTemplate?.type == "automation";

            console.log("Is automation?", doWorkflow);

            setWorkflowMode(doWorkflow);

            const newContent = template?.replace(/{{(.*?)}}/g, (match, variable) => {
                const index = variables.indexOf(variable);


                if(!doWorkflow && documents && documents.length > 0){
                    let document = documents.filter((doc) => {
                        console.log("doc.name", doc.name, variable);
                        if(doc.name == parseVariableName(variable)){
                            return "" + doc.raw;
                        }
                    })[0];

                    if(document){
                        return "" + document.raw;
                    }
                }

                return updatedVariables[index];
            });

            let message = newMessage({
                role: 'user',
                content: newContent
            });

            // @ts-ignore
            setCurrentMessage(message);

            if (!doWorkflow) {
                handleSend(message, 0, null);
            } else {
                handleJsWorkflow(message, documents);
            }

        };

        const handleApiKeyChange = useCallback(
            (apiKey: string) => {
                homeDispatch({ field: 'apiKey', value: apiKey });

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

        useEffect(() => {
            if (selectedConversation && selectedConversation.promptTemplate && selectedConversation.messages.length == 0) {
                //alert("Prompt Template");
                setVariables(parsePromptVariables(selectedConversation.promptTemplate.content))
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
                                their API. Right now, only OpenAI is supported.  It is <span className="italic">only</span> used to communicate
                                with their APIs.
                            </div>

                            {!serverSideApiKeyIsSet ? (

                                <div className="text-left text-gray-500 dark:text-gray-400 mb-6">
                                    <div className="text-left text-2xl font-bold text-black dark:text-white">
                                        Please set your OpenAI API key:
                                    </div>
                                    <div className="text-left text-4xl font-bold text-black dark:text-white">
                                        <Key apiKey={apiKey} onApiKeyChange={handleApiKeyChange} />
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
                                                        prompt={(selectedConversation.promptTemplate)}
                                                        variables={parsePromptVariables(selectedConversation?.promptTemplate.content)}
                                                        onSubmit={handleSubmit}
                                                        onClose={() => setIsPromptTemplateDialogVisible(false)}
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
                                            handleWorkflow={handleWorkflow}
                                            handleRunWorkflow={handleRunWorkflow}
                                            onEdit={(editedMessage) => {
                                                setCurrentMessage(editedMessage);
                                                // discard edited message and the ones that come after then resend
                                                // handleSend(
                                                //     editedMessage,
                                                //     selectedConversation?.messages.length - index,
                                                // );
                                                routeMessage(editedMessage, selectedConversation?.messages.length - index, null, []);
                                            }}
                                        />
                                    ))}

                                    {loading && <ChatLoader/>}

                                    <div
                                        className="h-[162px] bg-white dark:bg-[#343541]"
                                        ref={messagesEndRef}
                                    />
                                </>
                            )}
                        </div>

                        <ChatInput
                            stopConversationRef={stopConversationRef}
                            textareaRef={textareaRef}
                            onSend={(message, plugin, documents:AttachedDocument[] | null) => {
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
