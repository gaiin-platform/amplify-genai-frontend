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
import {VariableModal} from "@/components/Chat/VariableModal";
import {parsePromptVariables} from "@/utils/app/prompts";

import {executeOp} from "@/utils/sparc/sparc";
import {OpenAIModel} from "@/types/openai";
import {Prompt} from "@/types/prompt";
import Workflow from "@/components/Chat/Workflow";

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
        postProcessingCallbacks,
        dispatch: homeDispatch,
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


    const [messageQueue, setMessageQueue] = useState<Message[]>([]);

    // enqueueMessage function to add a new message to the queue
    const enqueueWorkflowMessages = (messages: Message[]) => {
        setMessageQueue(currentQueue => [...currentQueue, ...messages]);
    };

    useEffect(() => {
        if (messageQueue.length > 0) {
            // There is a message in the queue, send it.
            const message = messageQueue[0]; // Get the first message.
            handleSend(message).then(() => {
                // After message is sent, remove it from the queue.
                setMessageQueue(currentQueue => currentQueue.slice(1));
            });
        }
    }, [messageQueue]);

    const handleWorkflow = useCallback(async (workflow:Workflow) => {
        enqueueWorkflowMessages(workflow.messages);
    }, [
        selectedConversation
    ]);


    const handleSend = useCallback(
        async (message: Message, deleteCount = 0, plugin: Plugin | null = null) => {
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
                // const endpoint = getEndpoint(plugin);
                // let body;
                // if (!plugin) {
                //   body = JSON.stringify(chatBody);
                // } else {
                //   body = JSON.stringify({
                //     ...chatBody,
                //     googleAPIKey: pluginKeys
                //       .find((key) => key.pluginId === 'google-search')
                //       ?.requiredKeys.find((key) => key.key === 'GOOGLE_API_KEY')?.value,
                //     googleCSEId: pluginKeys
                //       .find((key) => key.pluginId === 'google-search')
                //       ?.requiredKeys.find((key) => key.key === 'GOOGLE_CSE_ID')?.value,
                //   });
                // }


                const controller = new AbortController();
                try {
                    const response = await sendChatRequest(chatBody, plugin, controller.signal);

                    // ...rest of your current implementation...

                    //     await fetch(endpoint, {
                    //   method: 'POST',
                    //   headers: {
                    //     'Content-Type': 'application/json',
                    //   },
                    //   signal: controller.signal,
                    //   body,
                    // });
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
                                    newMessage({role: 'assistant', content: chunkValue}),
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


                    }
                } catch (error: any) {
                    if (error.name === 'AbortError') {
                        // The request has been aborted. Clear out the queue.
                        setMessageQueue([]);
                    }
                    // Handle any other errors, as required.
                }
            }
        },
        [
            apiKey,
            conversations,
            pluginKeys,
            selectedConversation,
            stopConversationRef,
        ],
    );

    const handleSubmit = (updatedVariables: string[]) => {
        console.log(updatedVariables);

        let template = selectedConversation?.promptTemplate?.content;

        const newContent = template?.replace(/{{(.*?)}}/g, (match, variable) => {
            console.log(variable);

            const index = variables.indexOf(variable);
            return updatedVariables[index];
        });

        let message = {
            role: 'user',
            content: newContent
        }

        // @ts-ignore
        setCurrentMessage(message);
        handleSend(message as Message, 0, null);
    };

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
        executeOp({
            "op": "sequential",
            "output": "sequenceResult",
            "ops": [
                {
                    "op": "input",
                    "variables": {
                        "message1": "This is the first message",
                        "message2": "This is the second message"
                    },
                    "output": "inputStep"
                },
                {
                    "op": "parallel",
                    "output": "parallelResult",
                    "ops": [
                        {
                            "op": "consoleLog",
                            "message": "Second consoleLog: {{inputStep.message2}}"
                        },
                        {
                            "op": "consoleLog",
                            "message": "Third consoleLog: {{inputStep.message1}}"
                        }
                    ]
                }
            ]
        }, {});
    }, []);

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
                <div className="mx-auto flex h-full w-[300px] flex-col justify-center space-y-6 sm:w-[600px]">
                    <div className="text-center text-4xl font-bold text-black dark:text-white">
                        Welcome to Amplify
                    </div>
                    <div className="text-center text-lg text-black dark:text-white">
                        <div className="mb-8">{`Amplify is an open source clone of OpenAI's ChatGPT UI.`}</div>
                        <div className="mb-2 font-bold">
                            Important: Amplify is 100% unaffiliated with OpenAI.
                        </div>
                    </div>
                    <div className="text-center text-gray-500 dark:text-gray-400">
                        <div className="mb-2">
                            Amplify allows you to plug in your API key to use this UI with
                            their API.
                        </div>
                        <div className="mb-2">
                            It is <span className="italic">only</span> used to communicate
                            with their API.
                        </div>
                        <div className="mb-2">
                            {t(
                                'Please set your OpenAI API key in the bottom left of the sidebar.',
                            )}
                        </div>
                        <div>
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
                                            'Amplify'
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
                                            handleSend(message[0], 0, null);
                                        }}
                                        handleWorkflow={handleWorkflow}
                                        onEdit={(editedMessage) => {
                                            setCurrentMessage(editedMessage);
                                            // discard edited message and the ones that come after then resend
                                            handleSend(
                                                editedMessage,
                                                selectedConversation?.messages.length - index,
                                            );
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
                        onSend={(message, plugin) => {
                            setCurrentMessage(message);
                            handleSend(message, 0, plugin);
                        }}
                        onScrollDownClick={handleScrollDown}
                        onRegenerate={() => {
                            if (currentMessage) {
                                handleSend(currentMessage, 2, null);
                            }
                        }}
                        showScrollDownButton={showScrollDownButton}
                    />
                </>
            )}
        </div>
    );
});
Chat.displayName = 'Chat';
