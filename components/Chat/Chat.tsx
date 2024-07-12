import {
    IconClearAll,
    IconSettings,
    IconShare,
    IconDownload,
    IconRocket,
} from '@tabler/icons-react';
import {
    MutableRefObject,
    memo,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';

import {useTranslation} from 'next-i18next';

import { saveConversations} from '@/utils/app/conversation';
import {throttle} from '@/utils/data/throttle';

import {Conversation, Message, MessageType, newMessage} from '@/types/chat';
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
import {VariableModal} from "@/components/Chat/VariableModal";
import {parseEditableVariables} from "@/utils/app/prompts";
import {v4 as uuidv4} from 'uuid';
import {fillInTemplate} from "@/utils/app/prompts";
import {OpenAIModel, OpenAIModelID, OpenAIModels} from "@/types/openai";
import {Prompt} from "@/types/prompt";
import {WorkflowDefinition} from "@/types/workflow";
import {AttachedDocument} from "@/types/attacheddocument";
import {DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE} from "@/utils/app/const";
import {TagsList} from "@/components/Chat/TagsList";
import {ShareAnythingModal} from "@/components/Share/ShareAnythingModal";
import {DownloadModal} from "@/components/Download/DownloadModal";
import {MemoizedRemoteMessages} from "@/components/Chat/MemoizedRemoteMessages";
import {ResponseTokensSlider} from "@/components/Chat/ResponseTokens";
import {getAssistant, getAssistantFromMessage, isAssistant} from "@/utils/app/assistants";
import {useSendService} from "@/hooks/useChatSendService";
import { DEFAULT_ASSISTANT } from '@/types/assistant';
import {CloudStorage} from './CloudStorage';
import { getIsLocalStorageSelection, isRemoteConversation } from '@/utils/app/conversationStorage';
import { deleteRemoteConversation, uploadConversation } from '@/services/remoteConversationService';
import { callRenameChat } from './RenameChat';

interface Props {
    stopConversationRef: MutableRefObject<boolean>;
}

type ChatRequest = {
    message: Message;
    deleteCount?: number;
    endpoint?: string;
    plugin: Plugin | null;
    existingResponse?: any;
    rootPrompt: string | null;
    documents?: AttachedDocument[] | null;
    uri?: string | null;
    options?: { [key: string]: any };
    assistantId?: string;
    prompt?: Prompt;
};

export const Chat = memo(({stopConversationRef}: Props) => {
        const {t} = useTranslation('chat');

        const {
            state: {
                selectedConversation,
                selectedAssistant,
                conversations,
                models,
                modelError,
                loading,
                prompts,
                defaultModelId,
                workspaceMetadata,
                statsService,
                featureFlags,
                storageSelection,
                messageIsStreaming,
                chatEndpoint,
                folders
            },
            handleUpdateConversation,
            handleCustomLinkClick,
            dispatch: homeDispatch,
            handleAddMessages: handleAddMessages
        } = useContext(HomeContext);

        const foldersRef = useRef(folders);

        useEffect(() => {
            foldersRef.current = folders;
          }, [folders]);
    

        const promptsRef = useRef(prompts);

        useEffect(() => {
            promptsRef.current = prompts;
          }, [prompts]);
    
    
        const conversationsRef = useRef(conversations);
    
        useEffect(() => {
            conversationsRef.current = conversations;
        }, [conversations]);

        const [isRenaming, setIsRenaming] = useState<boolean>(false);

        useEffect(() => {

            const renameConversation = async() => {
                setIsRenaming(true);
                if (selectedConversation) {
                    let updatedConversation = {...selectedConversation}
                    // will always return a string whether call was successful or not 
                    callRenameChat(chatEndpoint || '', [updatedConversation.messages[0]], statsService).then(customName => {
                        updatedConversation = {
                            ...updatedConversation,
                            name: customName, 
                        };
                        homeDispatch({
                            field: 'selectedConversation',
                            value: updatedConversation,
                        });
                        console.log("Rename chat: ", customName)
                        
                        if (isRemoteConversation(updatedConversation)) uploadConversation(updatedConversation, foldersRef.current);

                        const updatedConversations: Conversation[] = conversationsRef.current.map(
                            (c:Conversation) => {
                                if (c.id === selectedConversation.id) {
                                    return updatedConversation;
                                }
                                return c;
                            },
                        );
                        homeDispatch({field: 'conversations', value: updatedConversations});
                        saveConversations(updatedConversations);
                        setIsRenaming(false);
                    })
                }
            }
            if (selectedConversation?.messages.length === 2 && !messageIsStreaming && selectedConversation.name === "New Conversation" && !isRenaming ) renameConversation();

        }, [selectedConversation]);
    

        const {handleSend:handleSendService} = useSendService();


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

            const updatedConversations: Conversation[] = conversationsRef.current.map(
                (conversation:Conversation) => {
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

        const handleChatRewrite = useCallback(async (message: Message, updateIndex: number, toRewrite: string, prefix: string, suffix: string, feedback: string) => {

        }, []);

        const createChatRequest =
            (
                message: Message,
                deleteCount = 0,
                plugin: Plugin | null = null,
                existingResponse = null,
                rootPrompt: string | null = null,
                documents?: AttachedDocument[] | null,
                uri?: string | null,
                options?: { [key: string]: any }
            ): ChatRequest => {
                return {
                    message,
                    deleteCount,
                    plugin,
                    existingResponse,
                    rootPrompt,
                    documents,
                    uri,
                    options,
                };
        };

        const handleSend = useCallback(
            async (request:ChatRequest) => {
                return handleSendService(request, ()=>{
                    return stopConversationRef.current === true;
                });
            },
            [stopConversationRef, handleSendService]
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

        // This function is primarily used by follow-up buttons and custom links to
        // run a prompt template.
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

                if (category === "chat") {
                    if (action === "send") {
                        const content = path;
                        const request = createChatRequest(newMessage({role: 'user', content: content}), 0, null);
                        handleSend(request);
                    } else if (action === "template") {
                        const name = path;

                        const prompt = promptsRef.current.find((p:Prompt) => p.name === name);

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

        // This is typically the entry point for messages where the user has typed something
        // into ChatInput or is editing an existing message. Most interactions with chat that
        // do not involve a prompt template start here.
        const routeMessage = (message: Message, deleteCount: number | undefined, plugin: Plugin | null | undefined, documents: AttachedDocument[] | null) => {

            if (message.type == MessageType.PROMPT
                || message.type == MessageType.ROOT
                || message.type == "chat" //Unfortunate hack to support old messages
            ) {

                const existingDatasources = message.data?.dataSources || [];
                const newDatasources = documents?.filter((doc) => doc.key).map((doc) => {
                    if (doc.key && doc.key.indexOf("://") === -1) {
                        return {id: "s3://" + doc.key, name: doc.name, type: doc.type, metadata: doc.metadata || {}};
                    } else {
                        return {id: doc.key, name: doc.name, type: doc.type, metadata: doc.metadata || {}};
                    }
                }) || [];

                console.log("Building data sources");
                const dataSources = [...existingDatasources, ...newDatasources];

                if (dataSources && dataSources.length > 0) {
                    console.log("Attaching datasource's to message");
                    message.data.dataSources = dataSources;
                }

                const assistantInUse = getAssistantFromMessage(message) ||
                    (selectedAssistant ? selectedAssistant?.definition : null);

                console.log("Assistant in use", assistantInUse, message);

                if (assistantInUse) {
                    let options = {
                        assistantName: assistantInUse.name,
                        assistantId: assistantInUse.assistantId,
                    };

                    message.data = {...message.data, assistant: {definition: {
                        assistantId: assistantInUse.assistantId,
                                name: assistantInUse.name,
                            ...(assistantInUse.uri ? {uri: assistantInUse.uri} : {}),
                    }}};

                    const request = createChatRequest(
                        message,
                        deleteCount,
                        plugin,
                        null,
                        null,
                        documents,
                        null,
                        options);

                    if(assistantInUse.uri) {
                        request.endpoint = assistantInUse.uri;
                    }

                    handleSend(request);
                } else {
                    const request = createChatRequest(message, deleteCount, plugin, null, null, documents);
                    handleSend(request);
                }
            } else {
                console.log("Unknown message type", message.type);
            }
        }

        //homeDispatch({field: 'handleSend', value: handleSend});

        // Most (all?) interactions that start with a prompt template end up here. This
        // function is typically called from the PromptDialog.
        const handleSubmit = (updatedVariables: string[], documents: AttachedDocument[] | null, promptTemplate?: Prompt) => {

            let templateData = promptTemplate || selectedConversation?.promptTemplate;

            console.log("Template Data", templateData);

            if (templateData) {
                let template = templateData?.content;
                const variables = parseEditableVariables(template);

                const doWorkflow = templateData.type === "automation";

                const fillInDocuments = !(doWorkflow ||
                    (documents && documents?.some((doc) => doc.key)));

                const newContent = fillInTemplate(template || "", variables, updatedVariables, documents, fillInDocuments);

                let label = null;

                if (templateData.type === MessageType.PREFIX_PROMPT) {
                    const labelPrefix = fillInTemplate(template || "", variables, [], [], false);
                    label = newContent.substring(labelPrefix.length);
                }


                // Create a map with variable mapped to updatedVariables
                const variablesByName: { [key: string]: any } = {};
                variables.forEach((v, index) => {
                    variablesByName[v] = updatedVariables[index];
                });

                const dataSources = documents?.filter((doc) => doc.key).map((doc) => {
                    if (doc.key && doc.key.indexOf("://") === -1) {
                        return {id: "s3://" + doc.key, name: doc.name, type: doc.type};
                    } else {
                        return {id: doc.key, name: doc.name, type: doc.type};
                    }
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

                    const request = createChatRequest(message, 0, null, null, null, documents);
                    request.prompt = templateData;

                    let assistantId = null;
                    let assistantName = null;

                    if(isAssistant(templateData)){
                        const assistant = getAssistant(templateData);
                        console.log("Assistant from template", assistant);
                        assistantId = assistant.assistantId;
                        assistantName = assistant.name;

                        if(assistant.uri){
                            request.endpoint = assistant.uri;
                        }
                    }
                    else if(selectedAssistant){
                        console.log("Selected Assistant", selectedAssistant);
                        assistantName = selectedAssistant.definition.name;
                        assistantId = selectedAssistant.definition.assistantId;

                        if(selectedAssistant.definition.uri){
                            request.endpoint = selectedAssistant.definition.uri;
                        }
                    }

                    if(assistantId) {
                        request.assistantId = assistantId;
                        request.options = {assistantName: assistantName, assistantId: assistantId};
                        message.data = {...message.data, assistant: {definition: {assistantId: assistantId, name: assistantName}}};
                    }

                    handleSend(request);
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

        const handleScrollUp = () => {
            chatContainerRef.current?.scrollTo({
                top: 30,
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
            if (isRemoteConversation(conversation)) deleteRemoteConversation(conversation.id);
            const updatedConversations = conversationsRef.current.filter(
                (c:Conversation) => c.id !== conversation.id,
            );

            homeDispatch({field: 'conversations', value: updatedConversations});

            saveConversations(updatedConversations);

            if (updatedConversations.length > 0) {
                homeDispatch({
                    field: 'selectedConversation',
                    value: updatedConversations[updatedConversations.length - 1],
                });

            } else {
                defaultModelId &&
                homeDispatch({
                    field: 'selectedConversation',
                    value: {
                        id: uuidv4(),
                        name: t('New Conversation'),
                        messages: [],
                        model: OpenAIModels[defaultModelId as OpenAIModelID],
                        prompt: DEFAULT_SYSTEM_PROMPT,
                        temperature: DEFAULT_TEMPERATURE,
                        folderId: null,
                        isLocal: getIsLocalStorageSelection(storageSelection)
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
            if (selectedConversation
                && selectedConversation.promptTemplate
                && isAssistant(selectedConversation.promptTemplate)
                && selectedConversation.messages.length == 0) {
                    
                if (isAssistant(selectedConversation.promptTemplate) && selectedConversation.promptTemplate.data) {
                    const assistant = selectedConversation.promptTemplate.data.assistant;
                    // make sure assistant hasnt been deleted 
                    if (prompts.some((prompt: Prompt) => prompt?.data?.assistant?.definition.assistantId === assistant.definition.assistantId)) homeDispatch({field: 'selectedAssistant', value: assistant});
                }
            }
            else if (selectedConversation && selectedConversation.promptTemplate && selectedConversation.messages.length == 0) {
                if (isAssistant(selectedConversation.promptTemplate) && selectedConversation.promptTemplate.data) {
                    const assistant = selectedConversation.promptTemplate.data.assistant;
                    // make sure assistant hasnt been deleted 
                    if (prompts.some((prompt:Prompt) => prompt?.data?.assistant?.definition.assistantId === assistant.definition.assistantId)) homeDispatch({field: 'selectedAssistant', value: assistant});
                }

                setVariables(parseEditableVariables(selectedConversation.promptTemplate.content))
                setIsPromptTemplateDialogVisible(true);
            } else if (selectedConversation && selectedConversation.workflowDefinition && selectedConversation.messages.length == 0) {
                //alert("Prompt Template");
                const workflowVariables = Object.entries(selectedConversation.workflowDefinition.inputs.parameters)
                    .map(([k, v]) => k);

                setVariables(workflowVariables);
                setIsPromptTemplateDialogVisible(true);
            } 
        }, [selectedConversation, prompts]);

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
            <div className="relative flex-1 overflow-hidden bg-neutral-100 dark:bg-[#343541]">
                { modelError ? (
                    <ErrorMessageDiv error={modelError}/>
                ) : (
                    <>
                        <div
                            className="container max-h-full overflow-x-hidden"
                            ref={chatContainerRef}
                            onScroll={handleScroll}
                        >
                            {selectedConversation && selectedConversation?.messages.length === 0 ? (
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
                                                
                                                <div className="relative flex flex-row w-full items-center"> 
                                                    <div className="flex-grow">
                                                        <ModelSelect/>
                                                    </div>

                                                    {featureFlags.storeCloudConversations && <div className="mt-[-5px] absolute top-0 right-0 flex justify-end items-center">
                                                        <CloudStorage iconSize={20} />
                                                    </div>}
                                                    
                                                </div>
                                                
                                                
                                                <SystemPrompt
                                                    models={models}
                                                    handleUpdateModel={handleUpdateModel}
                                                    conversation={selectedConversation}
                                                    prompts={promptsRef.current}
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

                                                <ResponseTokensSlider
                                                    label={t('Response Length')}
                                                    onResponseTokenRatioChange={(r) => {
                                                        if (selectedConversation && selectedConversation.model) {

                                                            const tokens = Math.floor(1000 * (r / 3.0)) + 1;

                                                            handleUpdateConversation(selectedConversation, {
                                                                key: 'maxTokens',
                                                                value: tokens,
                                                            })
                                                        }
                                                    }}
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
                                        className="items-center sticky top-2 z-10 flex justify-center border border-b-neutral-300 bg-neutral-100 py-3 text-sm text-neutral-500 dark:border-none dark:bg-[#444654] dark:text-neutral-200">

                                        {t('Workspace: ' + workspaceMetadata.name)} | {selectedConversation?.model.name} | {t('Temp')}
                                        : {selectedConversation?.temperature} |
                                        <button
                                            className="ml-2 cursor-pointer hover:opacity-50"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleSettings();

                                                if (!showSettings) {
                                                    handleScrollUp();
                                                } else {
                                                    handleScrollDown();
                                                } 
                                                
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
                                        {featureFlags.storeCloudConversations &&
                                        <CloudStorage iconSize={18} />
                                        }

                                        |
                                        <button
                                            className="ml-2 mr-2 cursor-pointer hover:opacity-50"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                homeDispatch({field: 'page', value: 'home'});
                                            }}
                                            title="Files"
                                        >
                                            <div className="flex flex-row items-center ml-2
                                            bg-[#9de6ff] dark:bg-[#8edffa] rounded-lg text-gray-600 p-1">
                                                <div><IconRocket size={18}/></div>
                                                <div className="ml-1">Files </div>
                                            </div>
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


                                    {selectedConversation?.messages.map((message: Message, index: number) => (
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
    });
    
Chat.displayName = 'Chat';
