import {
    IconClearAll,
    IconSettings,
    IconShare,
    IconDownload,
    IconRocket,
    IconBoxAlignTopFilled,
    IconBoxAlignTopRightFilled,
    IconChevronRight,
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

import { deleteConversationCleanUp, saveConversations} from '@/utils/app/conversation';
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
import {MemoizedChatMessage} from './MemoizedChatMessage';
import {VariableModal} from "@/components/Chat/VariableModal";
import {parseEditableVariables} from "@/utils/app/prompts";
import {v4 as uuidv4} from 'uuid';
import {fillInTemplate} from "@/utils/app/prompts";
import {DefaultModels, Model} from "@/types/model";
import {Prompt} from "@/types/prompt";
import {WorkflowDefinition} from "@/types/workflow";
import {AttachedDocument} from "@/types/attacheddocument";
import {DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE} from "@/utils/app/const";
import {TagsList} from "@/components/Chat/TagsList";
import {ShareAnythingModal} from "@/components/Share/ShareAnythingModal";
import {DownloadModal} from "@/components/Download/DownloadModal";
import {getAssistant, getAssistantFromMessage, isAssistant} from "@/utils/app/assistants";
import {ChatRequest, useSendService} from "@/hooks/useChatSendService";
import {CloudStorage} from './CloudStorage';
import { getIsLocalStorageSelection } from '@/utils/app/conversationStorage';
import { getFullTimestamp } from '@/utils/app/date';
import { doMtdCostOp } from '@/services/mtdCostService'; // MTDCOST
import { GroupTypeSelector } from './GroupTypeSelector';
import { Artifacts } from '../Artifacts/Artifacts';
import { downloadDataSourceFile } from '@/utils/app/files';
import { ArtifactsSaved } from './ArtifactsSaved';
import React from 'react';
import { PromptHighlightedText } from './PromptHighlightedText';
import { getSettings } from '@/utils/app/settings';
import { checkAvailableModelId, filterModels } from '@/utils/app/models';
import { promptForData } from '@/utils/app/llm';
import cloneDeep from 'lodash/cloneDeep';
import { useSession } from 'next-auth/react';
import { ConfirmModal } from '../ReusableComponents/ConfirmModal';
import { getActivePlugins } from '@/utils/app/plugin';
import { Settings } from '@/types/settings';
import { IntegrationsDialog } from '../Integrations/IntegrationsDialog';
import { TemperatureSlider } from './Sliders/Temperature';
import { ResponseTokensSlider } from './Sliders/ResponseTokens';
import { storageRemove } from '@/utils/app/storage';


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
                availableModels,
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
                folders,
                extractedFacts,
                defaultAccount,
                isStandalonePromptCreation
            },
            setLoadingMessage,
            handleUpdateConversation,
            dispatch: homeDispatch,
            handleUpdateSelectedConversation,
            getDefaultModel, handleForkConversation
        } = useContext(HomeContext);

        const { data: session } = useSession();
        const userEmail = session?.user?.email;

        // there should be a model id now since on fetchModels, I set it
        const getDefaultModelIdFromLocalStorage = () => {
            let defaultModel = localStorage.getItem('defaultModel');
            return defaultModel ? JSON.parse(defaultModel) : '';
        }

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

        let settingRef = useRef<Settings | null>(null);
        // prevent recalling the getSettings function
        if (settingRef.current === null) settingRef.current = getSettings(featureFlags);
        const [filteredModels, setFilteredModels] = useState<Model[]>([]);
            

        useEffect(() => {
                settingRef.current = getSettings(featureFlags);
                setFilteredModels(filterModels(availableModels, settingRef.current.hiddenModelIds));
        }, [availableModels]);

        const availableAstModelId = (astModelId: string | undefined) => {
            if (!astModelId) return undefined;
            return selectedAssistant?.definition?.data?.model && checkAvailableModelId(selectedAssistant.definition.data.model, availableModels);
        }

        const initSelectedModel = () => {
            const initSelectedAstModel = availableAstModelId(selectedAssistant?.definition?.data?.model);
            const id =  initSelectedAstModel || selectedConversation?.model?.id || defaultModelId || getDefaultModelIdFromLocalStorage();
            if (id && filteredModels.find((m: Model) => m.id == id)) return id;


            return undefined;
        }

        const getSelectModel = () => {
            const model: Model | undefined = Object.values(availableModels)
                                                   .find((model: Model) => model.id === selectedModelId);
            return model;
        }
        
        const [windowInnerDims, setWindowInnerDims] = useState<{width: number, height: number}>({ height: window.innerHeight, width: window.innerWidth});

        useEffect(() => {
            const updateInnerWindow = () => setWindowInnerDims({ height: window.innerHeight, width: window.innerWidth});
            window.addEventListener('resize', updateInnerWindow);
            return () => window.removeEventListener('resize', updateInnerWindow);
          }, []);

        const calculateInitSliderValue = (conversationMaxTokens: number | undefined) => {
            const model: Model | undefined = getSelectModel();
            const modelMaxTokens = model ? model.outputTokenLimit : 4096; 
            if (!conversationMaxTokens) return 3;
            
            const sliderValue = (conversationMaxTokens / modelMaxTokens) * 6;
            const initialSliderValue = Math.max(0, Math.min(6, sliderValue));
            return Math.round(initialSliderValue * 10) / 10; // Round to the nearest 0.1
        };

        const getIsBarSticky = () => {
            return localStorage.getItem('stickyChatbar') === 'true';
        }

        
        const [plugins, setPlugins] = useState<Plugin[] | null>(null);
        const {handleSend:handleSendService} = useSendService();
        const [selectedModelId, setSelectedModelId] = useState<string | undefined>(initSelectedModel());
        const [responseSliderState, setResponseSliderState] = useState<number>(calculateInitSliderValue(selectedConversation?.maxTokens));
        const [currentMessage, setCurrentMessage] = useState<Message>();
        const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(true);
        const [isUserScrolling, setIsUserScrolling] = useState<boolean>(false);
        const [lastScrollTop, setLastScrollTop] = useState<number>(0);
        const userScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
        const [showAdvancedConvSettings, setShowAdvancedConvSettings] = useState<boolean>(false);
        const [showSettings, setShowSettings] = useState<boolean>(false);
        const [isPromptTemplateDialogVisible, setIsPromptTemplateDialogVisible] = useState<boolean>(false);
        const [isDownloadDialogVisible, setIsDownloadDialogVisible] = useState<boolean>(false);
        const [isAccountDialogVisible, setIsAccountDialogVisible] = useState<boolean>(false);
        const [isShareDialogVisible, setIsShareDialogVisible] = useState<boolean>(false);
        const [variables, setVariables] = useState<string[]>([]);
        const [showScrollDownButton, setShowScrollDownButton] = useState<boolean>(false);
        const [promptTemplate, setPromptTemplate] = useState<Prompt | null>(null);
        const [mtdCost, setMtdCost] = useState<string>('Loading...'); // MTDCOST

        const [isBarSticky, setIsBarSticky] = useState(getIsBarSticky());
        const [isPillExpanded, setIsPillExpanded] = useState(false);

        const messagesEndRef = useRef<HTMLDivElement>(null);
        const chatContainerRef = useRef<HTMLDivElement>(null);
        const textareaRef = useRef<HTMLTextAreaElement>(null);
        const modelSelectRef = useRef<HTMLDivElement>(null);
        const [isArtifactOpen, setIsArtifactOpen] = useState<boolean>(false);
        const [artifactIndex, setArtifactIndex] = useState<number>(0);
        const [isRenaming, setIsRenaming] = useState<boolean>(false);

        const chat_button_blue_color = "text-[#1dbff5] dark:text-[#8edffa]"

        const [showOnEditMessagePrompt, setShowOnEditMessagePrompt] = useState< {editedMessage: Message, index: number}| null>(null);

        const [isIntegrationsOpen, setIsIntegrationsOpen] = useState<boolean>(false);
        const [selectedConversationState, setSelectedConversationState] = useState<Conversation | undefined>(selectedConversation);

        useEffect(() => {
            setSelectedConversationState(selectedConversation);
            if (selectedConversation && selectedConversation.model && selectedConversation.model.id !== selectedModelId) {
                setSelectedModelId(selectedConversation.model.id);
            }
            
            const renameConversation = async() => {
                setIsRenaming(true);
                if (selectedConversation) {
                    let updatedConversation = {...selectedConversation}

                    const promptMessages = cloneDeep(updatedConversation.messages)
                        .map(m => {return {...m, data:{}, configuredTools:[]};}); // Must zero out everything in DATA!
                    promptMessages[0].content = `Look at the following prompt: "${promptMessages[0].content}" \n\nYour task: As an AI proficient in summarization, create a short concise title for the given prompt. Ensure the title is under 30 characters.`

                    promptForData(chatEndpoint || '', promptMessages.slice(0,1), getDefaultModel(DefaultModels.CHEAPEST), "Respond with only the title name and nothing else.", defaultAccount, statsService, 10)
                                 .then(customName => {
                                    let updatedName: string = customName ?? '';
                                    if (!customName) {
                                        const content = updatedConversation.messages[0].content;
                                        updatedName = content && content.length > 30 ? content.substring(0, 30) + '...' : content;
                                    }
                                    updatedConversation = {
                                        ...updatedConversation,
                                        name: updatedName, 
                                    };
                                    
                                    handleUpdateSelectedConversation(updatedConversation);
            
                                    setIsRenaming(false);
                                })
                }
            }
            if (selectedConversation?.messages && selectedConversation.messages.length > 1 && !messageIsStreaming && selectedConversation.name === "New Conversation" && !isRenaming ) renameConversation();
        }, [selectedConversation]);

        

        useEffect(() => {
            const handleEvent = (event:any) => {
                const detail = event.detail;
                setIsArtifactOpen(detail.isOpen);  
                setArtifactIndex(detail.artifactIndex);
            };
            const handleOpenEvent = (event:any) => setIsIntegrationsOpen(true);

            const handleSettingsEvent = (event:any) => {
                settingRef.current = getSettings(featureFlags);
                if (Object.keys(availableModels).length > 0) {
                    setFilteredModels(filterModels(availableModels, settingRef.current.hiddenModelIds));
                }
            };

            window.addEventListener('openArtifactsTrigger', handleEvent);
            window.addEventListener('openIntegrationsDialog', handleOpenEvent);
            window.addEventListener('updateFeatureSettings', handleSettingsEvent);
            return () => {
                window.removeEventListener('openArtifactsTrigger', handleEvent);
                window.removeEventListener('openIntegrationsDialog', handleOpenEvent)
                window.removeEventListener('updateFeatureSettings', handleSettingsEvent);
            };
        }, []);

        useEffect(() => {
            if (!plugins && settingRef.current) setPlugins(getActivePlugins(settingRef.current, featureFlags));
        }, [featureFlags]);


        useEffect(() =>{
            let astModel = availableAstModelId(selectedAssistant?.definition?.data?.model);

            if (astModel && selectedModelId !== astModel) setSelectedModelId(astModel);
            if (astModel && selectedConversation && selectedConversation.model?.id !== astModel) {
                const model:Model | undefined = Object.values(availableModels).find(
                                                          (model: Model) => model.id === astModel,
                                                   );
                if (model) handleUpdateSelectedConversation({...selectedConversation, model: model});
            }
            
            if (selectedAssistant?.definition.name === "Standard Conversation" && selectedConversation?.model?.id) {
                if (selectedConversation?.model?.id !== selectedModelId) setSelectedModelId(selectedConversation?.model?.id);
            }
        }, [selectedAssistant, selectedConversation]);


        useEffect(() => {
            handleResponseTokenChange(responseSliderState);
        }, [selectedModelId]);


        const handleResponseTokenChange = (r: number) => {
            if (selectedConversation) {
                const model: Model | undefined = getSelectModel();
                const modelMaxTokens = model ? model.outputTokenLimit : 4096; 
                const tokens = Math.floor((r / 6) * modelMaxTokens);
                // console.log("Token change" , tokens);
                handleUpdateConversation(selectedConversation, {
                    key: 'maxTokens',
                    value: tokens,
                })
            }
        }


        const updateMessage = (selectedConversation: Conversation, updatedMessage: Message, updateIndex: number) => {
            let updatedConversation = {
                ...selectedConversation,
            }

            const updatedMessages: Message[] =
                updatedConversation.messages.map((message, index) => {
                    if (index === updateIndex) {
                        return {...message, content: updatedMessage.content};
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
                existingResponse = null,
                rootPrompt: string | null = null,
                documents?: AttachedDocument[] | null,
                uri?: string | null,
                options?: { [key: string]: any }
            ): ChatRequest => {

                const conversationId = selectedConversation?.id;

                const chatPlugins = plugins ?? [];// Plugins are set up top now, they are basically conversation configs now.

                return {
                    message,
                    deleteCount,
                    plugins : chatPlugins, 
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
                            const request = createChatRequest(newMessage({role: 'user', content: content}), 0);
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
        
        
        const routeMessage = (message: Message, deleteCount: number | undefined, documents: AttachedDocument[] | null) => {

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
                        featureOptions: selectedAssistant?.definition?.data?.featureOptions,
                        assistantId: assistantInUse.assistantId,
                        groupId: selectedAssistant?.definition.groupId,
                                name: assistantInUse.name,
                            ...(assistantInUse.uri ? {uri: assistantInUse.uri} : {}),
                    }}};

                    const request = createChatRequest(
                        message,
                        deleteCount,
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
                    const request = createChatRequest(message, deleteCount, null, null, documents);
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

                    const request = createChatRequest(message, 0, null, null, documents);
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
            if (autoScrollEnabled && !isUserScrolling) {
                messagesEndRef.current?.scrollIntoView({behavior: 'smooth'});
                textareaRef.current?.focus();
            }
        }, [autoScrollEnabled, isUserScrolling]);


        const handleScroll = () => {
            if (chatContainerRef.current) {
                const {scrollTop, scrollHeight, clientHeight} =
                    chatContainerRef.current;
                const bottomTolerance = 30;
                const scrollDelta = scrollTop - lastScrollTop;
                const isAtBottom = scrollTop + clientHeight >= scrollHeight - bottomTolerance;

                // Detect if user is actively scrolling (not auto-scroll)
                if (Math.abs(scrollDelta) > 0) {
                    setIsUserScrolling(true);
                    setLastScrollTop(scrollTop);
                    
                    // Clear existing timeout
                    if (userScrollTimeoutRef.current) {
                        clearTimeout(userScrollTimeoutRef.current);
                    }
                    
                    // Set timeout to reset user scrolling state after 500ms of no scroll
                    userScrollTimeoutRef.current = setTimeout(() => {
                        setIsUserScrolling(false);
                    }, 500);
                }

                // Update auto-scroll and button visibility
                setAutoScrollEnabled(isAtBottom);
                
                // Show scroll down button if not at bottom, OR if streaming (so user can jump to follow)
                setShowScrollDownButton(!isAtBottom || messageIsStreaming);
            }
        };

        const handleScrollDown = () => {
            // Reset user scrolling state and enable auto-scroll when button is clicked
            setIsUserScrolling(false);
            setAutoScrollEnabled(true);
            setShowScrollDownButton(false);
            
            // Clear any existing scroll timeouts
            if (userScrollTimeoutRef.current) {
                clearTimeout(userScrollTimeoutRef.current);
            }
            
            chatContainerRef.current?.scrollTo({
                top: chatContainerRef.current.scrollHeight,
                behavior: 'smooth',
            });
        };

        const handleScrollUp = () => {
            if (modelSelectRef && modelSelectRef.current) {
                const rect = modelSelectRef.current.getBoundingClientRect();
                
                // Check if the element is fully in view, partially in view, or not visible
                const inView = (
                    rect.top >= 0 &&
                    rect.left >= 0 &&
                    rect.bottom <= (windowInnerDims.height || document.documentElement.clientHeight) &&
                    rect.right <= (windowInnerDims.width || document.documentElement.clientWidth)
                );
        
                if (!inView) {
                    modelSelectRef.current.scrollIntoView({ block: 'start', behavior: 'smooth' });
                }
            }
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
            if (autoScrollEnabled && !isUserScrolling) {
                messagesEndRef.current?.scrollIntoView(true);
            }
        };
        const throttledScrollDown = throttle(scrollDown, 250);

        // Track previous message count to only scroll when messages actually change
        const prevMessageCountRef = useRef<number>(0);
        const scrollDelayTimeoutRef = useRef<NodeJS.Timeout | null>(null);

        useEffect(() => {
            if (selectedConversation && selectedConversation.messages) {
                const currentMessageCount = selectedConversation.messages.length;
                
                // Only scroll if messages were actually added and we should auto scroll
                if (currentMessageCount > prevMessageCountRef.current && 
                    autoScrollEnabled && 
                    !isUserScrolling) {
                    
                    const lastMessage = selectedConversation.messages[selectedConversation.messages.length - 1];
                    
                    // Only auto-scroll for user messages, not when AI responses start
                    // This prevents the jump when AI response begins
                    if (lastMessage && lastMessage.role === 'user') {
                        // Clear any existing timeout
                        if (scrollDelayTimeoutRef.current) {
                            clearTimeout(scrollDelayTimeoutRef.current);
                        }
                        
                        // Simple delay to let DOM update before scrolling
                        scrollDelayTimeoutRef.current = setTimeout(() => {
                            if (autoScrollEnabled && !isUserScrolling) {
                                messagesEndRef.current?.scrollIntoView(true);
                            }
                        }, 50);
                    }
                }
                
                prevMessageCountRef.current = currentMessageCount;
                
                // Update current message
                setCurrentMessage(
                    selectedConversation.messages[selectedConversation.messages.length - 2],
                );
            }
        }, [selectedConversation, autoScrollEnabled, isUserScrolling]);

        // Handle auto-scroll during streaming when user is at bottom
        useEffect(() => {
            if (messageIsStreaming && autoScrollEnabled && !isUserScrolling) {
                // Use throttled scroll to follow streaming content
                throttledScrollDown();
            }
        }, [selectedConversation?.messages, messageIsStreaming, autoScrollEnabled, isUserScrolling, throttledScrollDown]);

        // Additional effect to handle streaming content updates (not just message array changes)
        useEffect(() => {
            if (messageIsStreaming && autoScrollEnabled && !isUserScrolling) {
                const scrollToBottomImmediate = () => {
                    if (autoScrollEnabled && !isUserScrolling) {
                        messagesEndRef.current?.scrollIntoView(false); // false = no smooth scroll for better performance
                    }
                };
                
                // Set up a more frequent scroll during streaming
                const streamingScrollInterval = setInterval(scrollToBottomImmediate, 100);
                
                return () => clearInterval(streamingScrollInterval);
            }
        }, [messageIsStreaming, autoScrollEnabled, isUserScrolling]);

        const handleDeleteConversation = (conversation: Conversation) => {
            deleteConversationCleanUp(conversation);
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
                homeDispatch({
                    field: 'selectedConversation',
                    value: {
                        id: uuidv4(),
                        name: t('New Conversation'),
                        messages: [],
                        model: getDefaultModel(DefaultModels.DEFAULT),
                        prompt: DEFAULT_SYSTEM_PROMPT,
                        temperature: DEFAULT_TEMPERATURE,
                        folderId: null,
                        isLocal: getIsLocalStorageSelection(storageSelection),
                        date: getFullTimestamp()
                    },
                });
                storageRemove('selectedConversation');
            }
        };

        const handlePromptTemplateDialogCancel = (canceled: boolean) => {
            if (canceled) {
                if (selectedConversation && selectedConversation.promptTemplate && selectedConversation.messages?.length == 0) {
                    handleDeleteConversation(selectedConversation);
                }
            }
            setIsPromptTemplateDialogVisible(false);
        }

        useEffect(() => {
            if (!isStandalonePromptCreation && selectedConversation
                && selectedConversation.promptTemplate
                && isAssistant(selectedConversation.promptTemplate)
                && selectedConversation.messages?.length == 0) {
                    
                if (isAssistant(selectedConversation.promptTemplate) && selectedConversation.promptTemplate.data) {
                    const assistant = selectedConversation.promptTemplate.data.assistant;
                    // make sure assistant hasnt been deleted 
                    if (prompts.some((prompt: Prompt) => prompt?.data?.assistant?.definition.assistantId === assistant.definition.assistantId)) homeDispatch({field: 'selectedAssistant', value: assistant});
                }
            }
            else if (!isStandalonePromptCreation && selectedConversation && selectedConversation.promptTemplate && selectedConversation.messages?.length == 0) {
                if (isAssistant(selectedConversation.promptTemplate) && selectedConversation.promptTemplate.data) {
                    const assistant = selectedConversation.promptTemplate.data.assistant;
                    // make sure assistant hasnt been deleted 
                    if (prompts.some((prompt:Prompt) => prompt?.data?.assistant?.definition.assistantId === assistant.definition.assistantId)) homeDispatch({field: 'selectedAssistant', value: assistant});
                }

                setVariables(parseEditableVariables(selectedConversation.promptTemplate.content))
                setIsPromptTemplateDialogVisible(true);
            } else if (!isStandalonePromptCreation && selectedConversation && selectedConversation.workflowDefinition && selectedConversation.messages?.length == 0) {
                //alert("Prompt Template");
                const workflowVariables = Object.entries(selectedConversation.workflowDefinition.inputs.parameters)
                    .map(([k, v]) => k);

                setVariables(workflowVariables);
                setIsPromptTemplateDialogVisible(true);
            } 
        }, [selectedConversation, prompts, isStandalonePromptCreation]);

        useEffect(() => {
            const observer = new IntersectionObserver(
                ([entry]) => {
                    // Only change auto-scroll if user isn't actively scrolling
                    if (!isUserScrolling) {
                        setAutoScrollEnabled(entry.isIntersecting);
                        if (entry.isIntersecting) {
                            textareaRef.current?.focus();
                        }
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
        }, [messagesEndRef, isUserScrolling]);
    
        useEffect(() => {
            if (featureFlags.mtdCost) {
                let isFetching = false;

                const fetchMtdCost = async () => {
                    if (isFetching) return;

                    isFetching = true;

                    try {
                        const result = await doMtdCostOp(userEmail ?? '');
                        if (result && "MTD Cost" in result && result["MTD Cost"] !== undefined) {
                            setMtdCost(`$${result["MTD Cost"].toFixed(2)}`);
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

        // Cleanup timeouts on unmount
        useEffect(() => {
            return () => {
                if (userScrollTimeoutRef.current) {
                    clearTimeout(userScrollTimeoutRef.current);
                }
                if (scrollDelayTimeoutRef.current) {
                    clearTimeout(scrollDelayTimeoutRef.current);
                }
            };
        }, []);

// @ts-ignore
        return (
            <>
            {selectedConversation && selectedConversation.messages?.length > 0 && 
            featureFlags.highlighter && settingRef.current.featureOptions.includeHighlighter && 
                <PromptHighlightedText 
                onSend={(message) => {
                    setCurrentMessage(message);
                    routeMessage(message, 0, []);
                }} 
                />
            }
            
            {/* Main container with CSS Grid for strict 50/50 split when artifacts are open */}
            <div className={`flex h-full ${featureFlags.artifacts && isArtifactOpen ? 'grid grid-cols-2 gap-0' : ' w-full'}`}>
                
                {/* Chat Area */}
                <div className={`relative ${featureFlags.artifacts && isArtifactOpen ? 'overflow-hidden' : 'flex-1'} bg-neutral-100 dark:bg-[#343541]`}>
                    { modelError ? (
                        <ErrorMessageDiv error={modelError}/>  
                    ) : (
                        <> 
                            <div
                                id="chatScrollWindow"
                                className="chatcontainer max-h-full overflow-x-hidden overflow-y-auto" style={{height: windowInnerDims.height * 0.94}}
                                ref={chatContainerRef}
                                onScroll={handleScroll}
                            >
                            {selectedConversation &&(!selectedConversation.messages || selectedConversation.messages?.length === 0) && filteredModels ? (
                                <div id="overflowScroll" className='overflow-y-auto' style={{minHeight: windowInnerDims.height - 200, maxHeight: windowInnerDims.height - 100}}>
                                    <div
                                        className="mx-auto flex flex-col space-y-1 md:space-y-8 px-3 pt-5 md:pt-10 pb-20" 
                                        style={{width: windowInnerDims.width * 0.45}}>
                                        <div
                                            id="chatTitle"
                                            className="text-center text-3xl font-semibold text-gray-800 dark:text-gray-100">
                                            {filteredModels.length === 0 ? (
                                                <div className='flex flex-row gap-2 text-lg justify-center items-center'>
                                                    <Spinner size="16px" /> 
                                                    Loading Models...
                                                </div>
                                            ) : (
                                                'Start a new conversation.'
                                            )}
                                            
                                        </div>

                                        {filteredModels.length > 0 && (
                                            <div
                                                className="flex flex-col space-y-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-600 shadow-[0_4px_10px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_10px_rgba(0,0,0,0.3)]"
                                                style={{minHeight: 'fit-content'}}>
                                                
                                                <div className="relative flex flex-row w-full items-center"> 
                                                    <div className="flex-grow">
                                                        <ModelSelect modelId={selectedModelId} isDisabled={availableAstModelId(selectedAssistant?.definition?.data?.model)}/>
                                                    </div>
                                                    <div className='mt-[-5px] absolute top-0 right-7 flex justify-end items-center'>
                                                        {featureFlags.storeCloudConversations && <CloudStorage iconSize={20} /> }
                                                            
                                                        <button
                                                            className={`ml-2 ${messageIsStreaming ? "cursor-not-allowed": "cursor-pointer"} hover:opacity-50 pr-2`}
                                                            id="advancedConversationSettings"
                                                            disabled={messageIsStreaming}
                                                            onClick={(e) => {
                                                                setShowAdvancedConvSettings(!showAdvancedConvSettings);
                                                            }}
                                                            title={"Advanced Conversation Settings"}
                                                            >
                                                            { <IconSettings className="block text-neutral-500 dark:text-neutral-200" size={20} />} 
                                                        </button>
                                                    </div>
                                                    
                                                </div>
                                                
                                                { selectedAssistant?.definition?.data && Object.keys(selectedAssistant?.definition?.data?.groupTypeData || {}).length > 0 ? 
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
                                                    ( showAdvancedConvSettings && 
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
                                                            onChangeTemperature={(temperature) =>
                                                                handleUpdateConversation(selectedConversation, {
                                                                    key: 'temperature',
                                                                    value: temperature,
                                                                })
                                                            }
                                                        />

                                                        <ResponseTokensSlider
                                                            responseSliderState={responseSliderState}
                                                            onResponseTokenRatioChange={(r) => {
                                                                setResponseSliderState(r);
                                                                handleResponseTokenChange(r);
                                                            }}
                                                        />
                                                    
                                                    </>)
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
                                </div>
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
                                            selectedConversations={selectedConversationState ? [selectedConversationState] : []}
                                            onCancel={() => {
                                                setIsDownloadDialogVisible(false);
                                            }}
                                            onDownloadReady={function (url: string): void {

                                            }}/>
                                    )}

                                    
                                    {/* <AccountDialog open={isAccountDialogVisible} onClose={() => setIsAccountDialogVisible(false)} /> */}
                                    {featureFlags.integrations && <IntegrationsDialog open={isIntegrationsOpen} onClose={()=>{setIsIntegrationsOpen(false)}}/>}

                                    <div
                                       className={isBarSticky ? 
                                           "items-center sticky top-0 py-3 z-10 flex justify-center border border-b-neutral-300 bg-neutral-100 text-sm text-neutral-500 dark:border-none dark:bg-[#444654] dark:text-neutral-200 text-gray-800 dark:text-gray-200" :
                                           "sticky top-4 mt-4 flex justify-center items-center z-10"
                                       }>
                                       
                                        {isBarSticky ? (
                                            // Sticky bar content
                                            <>
                                                {featureFlags.mtdCost && (
                                                    <button
                                                        className="ml-2 mr-1 cursor-pointer hover:opacity-50 flex flex-row items-center"
                                                        disabled={messageIsStreaming}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setIsAccountDialogVisible(true);
                                                        }}
                                                        title="Month-To-Date Cost"
                                                        id="month-to-date-cost"
                                                    >
                                                        <div className={`text-[0.93rem] ${chat_button_blue_color} mr-1`}>
                                                            <div className="ml-1">MTD Cost: {mtdCost}</div>
                                                        </div> {"|"}
                                                    </button>
                                                )}          
                                                <button
                                                    className="font-medium mx-1 cursor-pointer hover:opacity-50 flex flex-row items-center"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setShowSettings(true);
                                                        if (!messageIsStreaming) handleScrollUp();
                                                        
                                                    }}
                                                >
                                                    {selectedAssistant && availableAstModelId(selectedAssistant?.definition?.data?.model)
                                                                        ? Object.values(availableModels).find(m => m.id === selectedAssistant.definition?.data?.model)?.name 
                                                                        : selectedConversation?.model?.name || ''}
                                                    {' | '}
                                                                        
                                                </button>

                                                <div className='flex flex-row'>
                                                    {t('Temp')} : {`${selectedConversation?.temperature} | `}
                                                
                                                    <button
                                                        className="ml-2 cursor-pointer hover:opacity-50"
                                                        disabled={messageIsStreaming}
                                                        onClick={onClearAll}
                                                        title="Clear Messages"
                                                        id="clearMessages"
                                                    >
                                                        <IconClearAll size={18}/>
                                                    </button>
                                                    <button
                                                        className="ml-2 cursor-pointer hover:opacity-50"
                                                        disabled={messageIsStreaming}
                                                        onClick={() => setIsShareDialogVisible(true)}
                                                        title="Share"
                                                        id="shareChatUpper"
                                                    >
                                                        <IconShare size={18}/>
                                                    </button>
                                                    <button
                                                        className="ml-2 cursor-pointer hover:opacity-50"
                                                        disabled={messageIsStreaming}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setIsDownloadDialogVisible(true)

                                                        }}
                                                        title="Download"
                                                        id="downloadUpper"
                                                    >
                                                        <IconDownload size={18}/>
                                                    </button>

                                                    {featureFlags.artifacts && 
                                                    <ArtifactsSaved iconSize={18} isArtifactsOpen={isArtifactOpen}/>}
                                                    
                                                    {featureFlags.storeCloudConversations &&
                                                    <CloudStorage iconSize={18} />
                                                    }

                                                    <button
                                                        className="ml-2 cursor-pointer hover:opacity-50"
                                                        onClick={() => {
                                                            const updatedIsBarSticky = !isBarSticky;
                                                            setIsBarSticky(updatedIsBarSticky);
                                                            localStorage.setItem('stickyChatbar', updatedIsBarSticky.toString());
                                                        }}
                                                        title={isBarSticky ? "Unpin Chatbar" : "Pin Chatbar"}
                                                    >
                                                        {isBarSticky ?  <IconBoxAlignTopRightFilled size={18}/> : <IconBoxAlignTopFilled size={18}/>}
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            // Floating pill
                                            <div 
                                                className={`
                                                    relative flex items-center transition-all duration-300 ease-in-out cursor-pointer
                                                    rounded-full bg-white dark:bg-[#454757] shadow-lg hover:shadow-xl
                                                    border border-gray-200 dark:border-gray-600 h-10 text-gray-800 dark:text-gray-200
                                                    ${isPillExpanded ? 'px-6' : 'px-3'}
                                                `}
                                                id="chatUpperMenu"
                                                onMouseEnter={() => setIsPillExpanded(true)}
                                                onMouseLeave={() => setIsPillExpanded(false)}
                                            >
                                                {/* Always visible - Model name and expand indicator */}
                                                <button
                                                    className="font-medium cursor-pointer hover:opacity-50 flex flex-row items-center"
                                                    id="modelChatSettings"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setShowSettings(true);
                                                        if (!messageIsStreaming) handleScrollUp();
                                                        
                                                    }}
                                                >
                                                    {selectedAssistant && availableAstModelId(selectedAssistant?.definition?.data?.model)
                                                                        ? Object.values(availableModels).find(m => m.id === selectedAssistant.definition?.data?.model)?.name 
                                                                        : selectedConversation?.model?.name || ''}
                                                    <IconChevronRight 
                                                        size={16} 
                                                        className={`ml-2 transition-transform duration-300 ${isPillExpanded ? 'rotate-90' : ''} text-gray-500`}
                                                    />
                                                                        
                                                </button>

                                                {/* Expanded content - appears on hover */}
                                                <div className={`flex flex-row gap-2 items-center transition-all duration-300 overflow-hidden
                                                        ${isPillExpanded ? 'max-w-[600px] opacity-100 ml-4' : 'max-w-0 opacity-0 ml-0'}
                                                    `}>

                                                    {t('Temp')} : {selectedConversation?.temperature}
                                                
                                                    <button
                                                        className="ml-2 cursor-pointer hover:opacity-50"
                                                        disabled={messageIsStreaming}
                                                        onClick={onClearAll}
                                                        title="Clear Messages"
                                                        id="clearMessages"
                                                    >
                                                        <IconClearAll size={18}/>
                                                    </button>
                                                    <button
                                                        className="ml-2 cursor-pointer hover:opacity-50"
                                                        disabled={messageIsStreaming}
                                                        onClick={() => setIsShareDialogVisible(true)}
                                                        title="Share"
                                                        id="shareChatUpper"
                                                    >
                                                        <IconShare size={18}/>
                                                    </button>
                                                    <button
                                                        className="ml-2 cursor-pointer hover:opacity-50"
                                                        disabled={messageIsStreaming}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setIsDownloadDialogVisible(true)

                                                        }}
                                                        title="Download"
                                                        id="downloadUpper"
                                                    >
                                                        <IconDownload size={18}/>
                                                    </button>

                                                    {featureFlags.artifacts && 
                                                    <ArtifactsSaved iconSize={18} isArtifactsOpen={isArtifactOpen}/>}
                                                    
                                                    {featureFlags.storeCloudConversations &&
                                                    <CloudStorage iconSize={18} />
                                                    }

                                                    <button
                                                        className="ml-2 cursor-pointer hover:opacity-50"
                                                        onClick={() => {
                                                            const updatedIsBarSticky = !isBarSticky;
                                                            setIsBarSticky(updatedIsBarSticky);
                                                            localStorage.setItem('stickyChatbar', updatedIsBarSticky.toString());
                                                        }}
                                                        title={isBarSticky ? "Unpin Chatbar" : "Pin Chatbar"}
                                                    >
                                                        {isBarSticky ?  <IconBoxAlignTopRightFilled size={18}/> : <IconBoxAlignTopFilled size={18}/>}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div ref={modelSelectRef}></div>
                                    
                                        <div 
                                            className="flex flex-col md:gap-6 md:py-3 md:pt-6 lg:px-0 mx-16 ">
                                            { showSettings && !availableAstModelId(selectedAssistant?.definition?.data?.model) &&
                                                <div
                                                    className="border-b border-neutral-200 p-4 dark:border-neutral-600 md:rounded-lg md:border custom-shadow">
                                                    <ModelSelect modelId={selectedModelId}/>
                                                </div>
                                            }
                                            {/* <div
                                                id="tagListInChat"
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
                                        </div> */}
                                        </div>
                                    


                                    {selectedConversationState?.messages?.map((message: Message, index: number) => (
                                        <MemoizedChatMessage
                                                key={index}
                                                message={message}
                                                messageIndex={index}
                                                onChatRewrite={handleChatRewrite}
                                                onSendPrompt={runPrompt}
                                                handleCustomLinkClick={handleCustomLinkClick}
                                                onEdit={(editedMessage) => {
                                                    console.log("Editing message", editedMessage);

                                                    setCurrentMessage(editedMessage);

                                                    if (editedMessage.role != "assistant") {
                                                        const lastUserMessageIndex = selectedConversationState?.messages
                                                                                                               .map(msg => msg.role)
                                                                                                               .lastIndexOf('user');                                                                                                    

                                                        if (index === lastUserMessageIndex) {
                                                            routeMessage(editedMessage, selectedConversationState?.messages.length - index, []);
                                                        } else {
                                                            // ask to fork or overwrite 
                                                            setShowOnEditMessagePrompt({editedMessage: editedMessage, index: index});
                                                        }
                                                        
                                                    } else {
                                                        console.log("updateMessage");
                                                        updateMessage(selectedConversationState, editedMessage, index);
                                                    }
                                                }}
                                            />
                                    ))}

                                    {loading && <ChatLoader/>}

                                    <div
                                        className="h-[300px] bg-white dark:bg-[#343541]"
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

                                    {showOnEditMessagePrompt && selectedConversationState?.messages &&
                                    <ConfirmModal
                                    title='Save a Copy of the Conversation?'
                                    message="Would you like to save a copy of the conversation with the original messages before finalizing your edits? Once the changes are applied, any messages following the edited one will be removed and resubmitted to the model, effectively updating and overwriting the conversation."
                                    onDeny={() => {
                                        const data = {...showOnEditMessagePrompt};
                                        setShowOnEditMessagePrompt(null);
                                        if (selectedConversationState) routeMessage(data.editedMessage, 
                                            selectedConversationState.messages.length - data.index, []);
                                     }}
                                     denyLabel='Overwrite Only'
                                     onConfirm={async () => {
                                        if (selectedConversationState) {
                                            const len = selectedConversationState?.messages.length;
                                            const data = {...showOnEditMessagePrompt};
                                            setShowOnEditMessagePrompt(null);
                                            await handleForkConversation(len - 1, false);
                                            updateMessage(selectedConversationState, data.editedMessage, data.index);
                                            routeMessage(data.editedMessage, len - data.index, []);
                                        }}}
                                        confirmLabel="Save Copy"
                                    />

                                    }

                                </>
                            )}
                        </div>

                       {filteredModels.length > 0 && 
                        <ChatInput
                            handleUpdateModel={handleUpdateModel}
                            stopConversationRef={stopConversationRef}
                            textareaRef={textareaRef}
                            onSend={(message, documents: AttachedDocument[] | null) => {
                                setCurrentMessage(message);
                                //handleSend(message, 0, plugin);
                                routeMessage(message, 0, documents);
                            }}
                            onScrollDownClick={handleScrollDown}
                            onRegenerate={() => {
                                if (currentMessage) {
                                    //handleSend(currentMessage, 2, null);
                                    routeMessage(currentMessage, 2, null);
                                }
                            }}
                            showScrollDownButton={showScrollDownButton}
                            plugins={plugins ?? []}
                            setPlugins={setPlugins}
                        />}
                    </>
                )}
            </div>

            {/* Artifacts Panel - only show when artifacts are open */}
            {(featureFlags.artifacts && isArtifactOpen) &&  (
                <Artifacts 
                    artifactIndex={artifactIndex}    
                />
            )}

            </div>

            </>
        );
    });
    
Chat.displayName = 'Chat';