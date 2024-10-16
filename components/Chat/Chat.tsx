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

import {Conversation, DataSource, Message, MessageType, newMessage} from '@/types/chat';
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
import {Model, ModelID, Models} from "@/types/model";
import {Prompt} from "@/types/prompt";
import {WorkflowDefinition} from "@/types/workflow";
import {AttachedDocument} from "@/types/attacheddocument";
import {DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE} from "@/utils/app/const";
import {TagsList} from "@/components/Chat/TagsList";
import {ShareAnythingModal} from "@/components/Share/ShareAnythingModal";
import {DownloadModal} from "@/components/Download/DownloadModal";
import {ResponseTokensSlider} from "@/components/Chat/ResponseTokens";
import {getAssistant, getAssistantFromMessage, isAssistant} from "@/utils/app/assistants";
import {useSendService} from "@/hooks/useChatSendService";
import {CloudStorage} from './CloudStorage';
import { getIsLocalStorageSelection, isRemoteConversation } from '@/utils/app/conversationStorage';
import { deleteRemoteConversation, uploadConversation } from '@/services/remoteConversationService';
import { renameChat } from './RenameChat';
import { doMtdCostOp } from '@/services/mtdCostService'; // MTDCOST
import { GroupTypeSelector } from './GroupTypeSelector';
import { Artifacts } from '../Artifacts/Artifacts';
import { downloadDataSourceFile } from '@/utils/app/files';
import { ArtifactsSaved } from './ArtifactsSaved';
import React from 'react';
import { PromptHighlightedText } from './PromptHighlightedText';
import { AccountDialog } from '../Settings/AccountComponents/AccountDialog';
import { getSettings } from '@/utils/app/settings';
import { filterModels } from '@/utils/app/models';

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
    conversationId?: string;
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
            setLoadingMessage,
            handleUpdateConversation,
            dispatch: homeDispatch,
            handleAddMessages: handleAddMessages,
            handleUpdateSelectedConversation
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
    
        const filteredModels = filterModels(models, getSettings(featureFlags).modelOptions);

        const {handleSend:handleSendService} = useSendService();
        const [selectedModelId, setSelectedModelId] = useState<ModelID | undefined>(selectedAssistant?.definition?.data?.model || selectedConversation?.model?.id );
        const [currentMessage, setCurrentMessage] = useState<Message>();
        const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(true);
        const [showSettings, setShowSettings] = useState<boolean>(false);
        const [isPromptTemplateDialogVisible, setIsPromptTemplateDialogVisible] = useState<boolean>(false);
        const [isDownloadDialogVisible, setIsDownloadDialogVisible] = useState<boolean>(false);
        const [isAccountDialogVisible, setIsAccountDialogVisible] = useState<boolean>(false);
        const [isShareDialogVisible, setIsShareDialogVisible] = useState<boolean>(false);
        const [variables, setVariables] = useState<string[]>([]);
        const [showScrollDownButton, setShowScrollDownButton] =
            useState<boolean>(false);
        const [promptTemplate, setPromptTemplate] = useState<Prompt | null>(null);
        const [mtdCost, setMtdCost] = useState<string>('Loading...'); // MTDCOST
        // const [isDownloadingFile, setIsDownloadingFile] = useState<boolean>(false);


        const messagesEndRef = useRef<HTMLDivElement>(null);
        const chatContainerRef = useRef<HTMLDivElement>(null);
        const textareaRef = useRef<HTMLTextAreaElement>(null);
        const modelSelectRef = useRef<HTMLDivElement>(null);
        const [isArtifactOpen, setIsArtifactOpen] = useState<boolean>(false);
        const [artifactIndex, setArtifactIndex] = useState<number>(0);
        const [isRenaming, setIsRenaming] = useState<boolean>(false);

        const [selectedConversationState, setSelectedConversationState] = useState<Conversation | undefined>(selectedConversation);

        useEffect(() => {
            setSelectedConversationState(selectedConversation);
            
            const renameConversation = async() => {
                setIsRenaming(true);
                if (selectedConversation) {
                    let updatedConversation = {...selectedConversation}

                    const updateName = (name: string, conversation: Conversation) => {
                        conversation = {
                            ...updatedConversation,
                            name: name, 
                        };
                        handleUpdateSelectedConversation(conversation);
                        setIsRenaming(false);
                    }

                    // will always return a string whether call was successful or not 
                    renameChat(chatEndpoint || '', updatedConversation, statsService, updateName);
                    // .then(customName => {
                    //     updatedConversation = {
                    //         ...updatedConversation,
                    //         name: customName, 
                    //     };
                        
                        
                    //     handleUpdateSelectedConversation(updatedConversation);

                    //     setIsRenaming(false);
                    // })
                }
            }
            if (selectedConversation?.messages.length === 2 && !messageIsStreaming && selectedConversation.name === "New Conversation" && !isRenaming ) renameConversation();
        }, [selectedConversation]);


        useEffect(() => {
            const handleEvent = (event:any) => {
                const detail = event.detail;
                setIsArtifactOpen(detail.isOpen);  
                setArtifactIndex(detail.artifactIndex);
            };
            window.addEventListener('openArtifactsTrigger', handleEvent);
            return () => {
                window.removeEventListener('openArtifactsTrigger', handleEvent);
            };
        }, []);


        useEffect(() =>{
            const astModel = selectedAssistant?.definition?.data?.model;
            
            if (astModel && selectedModelId !== astModel) setSelectedModelId(astModel);
            if (astModel && selectedConversation && selectedConversation.model.id !== astModel) handleUpdateConversation(selectedConversation, {
                                        key: 'model',
                                        value: models.find(
                                        (model: Model) => model.id === astModel,
                                        ),
                                    });
            
            if (selectedAssistant?.definition.name === "Standard Conversation" && selectedConversation?.model?.id) {
                if (selectedConversation?.model?.id !== selectedModelId) setSelectedModelId(selectedConversation?.model?.id as ModelID);
            }
        }, [selectedAssistant, selectedConversation]);

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

            handleUpdateSelectedConversation(updatedConversation);

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

                const conversationId = selectedConversation?.id;

                return {
                    message,
                    deleteCount,
                    plugin,
                    existingResponse,
                    rootPrompt,
                    documents,
                    uri,
                    options,
                    conversationId,
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

        const handleDownloadFile = async (message: Message, filename: string) => {
            if (!message.data.state.sources) return;

            setLoadingMessage("Downloading File...");

            const sources = Object.values(message.data.state.sources);
            let ds: DataSource | undefined= undefined;
            let groupId = undefined;
            for (const sourceType of sources as any[]) {
                const sourceValues: any = Object.values(sourceType.sources);
                for (const subSource of sourceValues) {
                    if (subSource.contentKey && !subSource.contentKey.includes("global/") && subSource.name === filename.replace(/&/g, ' ')) {
                        ds = {id: subSource.contentKey, name: subSource.name, type: subSource.type}
                        if (subSource.groupId) groupId = subSource.groupId;
                        break;
                    }
                }
                if (ds) {
                    await downloadDataSourceFile(ds, groupId);
                    break; 
                } 
            }

            if (!ds) {
                console.log("No content key found")
                alert("Unable to provide the document at this time.");
            }
            setLoadingMessage("");

        }

        // This should all be refactored into a separate module at some point
        // ...should really be looking up the handler by category/action and passing
        // --jules
        const handleCustomLinkClick = (message: Message, href: string) => {
             statsService.customLinkClickEvent(message, href);
            if (selectedConversation) {
                let [category, action_path] = href.slice(1).split(":");

                switch (true) {
                    case (category === "chat"):
                        let [action, path] = action_path.split("/");
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
                        break;
                    case (['dataSources', 'dataSource'].includes(category)):
                        handleDownloadFile(message, action_path);
                        break;
                    default:
                        console.log(`handleCustomLinkClick ${category}:${action_path}`);

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


        //     console.log("Model", model);
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

                console.log("Assistant in use", assistantInUse);
                // console.log("conv", selectedConversation);


                if (assistantInUse) {
                    let options = {
                        assistantName: assistantInUse.name,
                        assistantId: assistantInUse.assistantId,
                        groupId:  selectedAssistant?.definition.groupId,
                        groupType: selectedConversation?.groupType 
                    };

                    message.data = {...message.data, assistant: {definition: {
                        assistantId: assistantInUse.assistantId,
                        groupId: selectedAssistant?.definition.groupId,
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

        const handleUpdateModel = useCallback((model: Model) => {
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
                        model: Models[defaultModelId as ModelID],
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
    
        useEffect(() => {
            if (featureFlags.mtdCost) {
                let isFetching = false;

                const fetchMtdCost = async () => {
                    if (isFetching) return;

                    isFetching = true;

                    try {
                        const result = await doMtdCostOp();
                        if (result && result.item && result.item["MTD Cost"] !== undefined) {
                            setMtdCost(`$${result.item["MTD Cost"].toFixed(2)}`);
                        } else {
                            setMtdCost('$0.00');
                        }
                    } catch (error) {
                        console.error("Error fetching MTD cost:", error);
                        setMtdCost('$0.00');
                    } finally {
                        isFetching = false;
                    }
                };

                fetchMtdCost();

                return () => {
                    isFetching = false;
                };
            }
        }, [messageIsStreaming, featureFlags.mtdCost]);

// @ts-ignore
        return (
            <>
            {featureFlags.highlighter && 
             getSettings(featureFlags).featureOptions.includeHighlighter  && 
                <PromptHighlightedText 
                onSend={(message) => {
                    setCurrentMessage(message);
                    routeMessage(message, 0, null, []);
                }} 
                />
            }
            <div className="relative flex-1 overflow-hidden bg-neutral-100 dark:bg-[#343541]">
                { modelError ? (
                    <ErrorMessageDiv error={modelError}/>
                ) : (
                    <div >
                        <div
                            className="container max-h-full overflow-x-hidden" style={{height: window.innerHeight * 0.94}}
                            ref={chatContainerRef}
                            onScroll={handleScroll}
                        >
                            {selectedConversation && selectedConversation?.messages.length === 0 ? (
                                <>
                                    <div
                                        className="mx-auto flex flex-col space-y-1 md:space-y-8 px-3 pt-5 md:pt-10 sm:max-w-[600px]">
                                        <div
                                            className="text-center text-3xl font-semibold text-gray-800 dark:text-gray-100">
                                            {filteredModels.length === 0 ? (
                                                <div>
                                                    <Spinner size="16px" className="mx-auto"/>
                                                </div>
                                            ) : (
                                                'Start a new conversation.'
                                            )}
                                            
                                        </div>

                                        {filteredModels.length > 0 && (
                                            <div
                                                className="flex h-full flex-col space-y-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-600 shadow-[0_4px_10px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_10px_rgba(0,0,0,0.3)]">
                                                
                                                <div className="relative flex flex-row w-full items-center"> 
                                                    <div className="flex-grow">
                                                        <ModelSelect modelId={selectedModelId} isDisabled={selectedAssistant?.definition?.data?.model}/>
                                                    </div>

                                                    {featureFlags.storeCloudConversations && <div className="mt-[-5px] absolute top-0 right-0 flex justify-end items-center">
                                                        <CloudStorage iconSize={20} />
                                                    </div>}
                                                    
                                                </div>
                                                
                                                { selectedAssistant?.definition?.data?.groupTypeData && Object.keys(selectedAssistant?.definition?.data?.groupTypeData).length > 0 ? 
                                                    <>
                                                        <GroupTypeSelector
                                                            groupOptionsData={selectedAssistant.definition.data.groupTypeData}
                                                            setSelected={(type: string | undefined) => {
                                                                // set selectedConversations with type
                                                                homeDispatch({ field: 'selectedConversation', value: {...selectedConversation, groupType: type} })
                                                                handleUpdateConversation(selectedConversation, {
                                                                    key: 'groupType',
                                                                    value: type,
                                                                }) 
                                                            }}
                                                            groupUserTypeQuestion={selectedAssistant.definition.data.groupUserTypeQuestion}
                                                        />
                                                        
                                                    </> :
                                                    <>
                                                    <SystemPrompt
                                                        models={filteredModels}
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
                                                    </>
                                                }
                                                {isPromptTemplateDialogVisible && selectedConversation.promptTemplate && (
                                                    <VariableModal
                                                        models={filteredModels}
                                                        handleUpdateModel={handleUpdateModel}
                                                        prompt={(selectedConversation.promptTemplate)}
                                                        variables={parseEditableVariables(selectedConversation?.promptTemplate.content)}
                                                        onSubmit={handleSubmit}
                                                        onClose={handlePromptTemplateDialogCancel}
                                                    />
                                                )}
                                                {isPromptTemplateDialogVisible && selectedConversation.workflowDefinition && (
                                                    <VariableModal
                                                        models={filteredModels}
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
                                        selectedConversations={selectedConversationState ? [selectedConversationState] : []}
                                    />

                                    
                                    {isDownloadDialogVisible && (
                                        <DownloadModal
                                            includeConversations={true}
                                            includePrompts={false}
                                            includeFolders={false}
                                            selectedConversations={selectedConversationState ? [selectedConversationState] : []}
                                            onCancel={() => {
                                                setIsDownloadDialogVisible(false);
                                            }}
                                            onDownloadReady={function (url: string): void {

                                            }}/>
                                    )}

                                    
                                    <AccountDialog open={isAccountDialogVisible} onClose={() => setIsAccountDialogVisible(false)} />
                                    

                                    <div
                                       className="items-center sticky top-0 py-3 z-10 flex justify-center border border-b-neutral-300 bg-neutral-100  text-sm text-neutral-500 dark:border-none dark:bg-[#444654] dark:text-neutral-200">
                                        {featureFlags.mtdCost  && (
                                            <>
                                                <button
                                                    className="ml-2 mr-2 cursor-pointer hover:opacity-50"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setIsAccountDialogVisible(true);
                                                    }}
                                                    title="Month-To-Date Cost"
                                                >
                                                    <div className="flex flex-row items-center text-[0.93rem] text-[#00a1d8] dark:text-[#8edffa]">
                                                        <div className="ml-1">MTD Cost: {mtdCost}</div>
                                                    </div>
                                                </button>
                                                |
                                            </>
                                        )}
                                        { !isArtifactOpen ? `  Workspace: ${workspaceMetadata.name} | `: '' } { selectedAssistant?.definition?.data?.model ? Models[selectedAssistant.definition.data.model as ModelID].name : selectedConversation?.model.name || ''} | {t('Temp')} : {selectedConversation?.temperature} |
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

                                        {featureFlags.artifacts && 
                                        <ArtifactsSaved iconSize={18} isArtifactsOpen={isArtifactOpen}/>}
                                        
                                        {featureFlags.storeCloudConversations &&
                                        <CloudStorage iconSize={18} />
                                        }
                                        {!isArtifactOpen  &&
                                            <>
                                            |
                                            <button
                                                className="ml-2 mr-2 cursor-pointer hover:opacity-50"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    homeDispatch({field: 'page', value: 'home'});
                                                }}
                                                title="Data Sources"
                                            >
                                                <div className="flex flex-row items-center text-[0.9rem] text-[#00a1d8] dark:text-[#8edffa]">
                                                    <div><IconRocket size={18}/></div>
                                                    <div className="ml-1">Data Sources </div>
                                                </div>
                                            </button> 
                                            </>
                                        }
                                    </div>
                                    <div ref={modelSelectRef}></div>
                                    
                                        <div
                                            className="flex flex-col md:mx-auto md:max-w-xl md:gap-6 md:py-3 md:pt-6 lg:max-w-2xl lg:px-0 xl:max-w-3xl ">
                                            { showSettings && !(selectedAssistant?.definition?.data?.model) &&
                                                <div
                                                    className="border-b border-neutral-200 p-4 dark:border-neutral-600 md:rounded-lg md:border shadow-[0_2px_4px_rgba(0,0,0,0.1)] dark:shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
                                                    <ModelSelect modelId={selectedModelId}/>
                                                </div>
                                            }
                                            <div
                                                className="border-b border-neutral-200 p-2 dark:border-neutral-600 md:rounded-lg md:border shadow-[0_2px_2px_rgba(0,0,0,0.1)] dark:shadow-[0_2px_2px_rgba(0,0,0,0.3)]">
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
                                    


                                    {selectedConversationState?.messages.map((message: Message, index: number) => (
                                        <MemoizedChatMessage
                                                key={index}
                                                message={message}
                                                messageIndex={index}
                                                onChatRewrite={handleChatRewrite}
                                                onSend={(message) => {
                                                    setCurrentMessage(message[0]);
                                                    routeMessage(message[0], 0, null, []);
                                                }}
                                                onSendPrompt={runPrompt}
                                                handleCustomLinkClick={handleCustomLinkClick}
                                                onEdit={(editedMessage) => {
                                                    console.log("Editing message", editedMessage);

                                                    setCurrentMessage(editedMessage);

                                                    if (editedMessage.role != "assistant") {
                                                        routeMessage(editedMessage, selectedConversationState?.messages.length - index, null, []);
                                                    } else {
                                                        console.log("updateMessage");
                                                        updateMessage(selectedConversationState, editedMessage, index);
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
                                            models={filteredModels}
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
                    </div>
                )}
            </div>

            {/* Artifacts */}
            {(featureFlags.artifacts && isArtifactOpen) &&  (
                <Artifacts 
                    artifactIndex={artifactIndex}    
                />
            )}

            </>
        );
    });
    
Chat.displayName = 'Chat';
