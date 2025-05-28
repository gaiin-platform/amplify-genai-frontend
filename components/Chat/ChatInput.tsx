import {
    IconArrowDown,
    IconPlayerStop,
    IconAt,
    IconFiles,
    IconSend,
    IconBrain,
    IconBulb,
    IconScale, IconSettingsAutomation, IconFolderOpen
} from '@tabler/icons-react';
import SaveActionsModal from './SaveActionsModal';
import LoadActionSetModal from './LoadActionSetModal';
import {
    KeyboardEvent,
    MutableRefObject,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';

import {useTranslation} from 'next-i18next';
import {parsePromptVariables} from "@/utils/app/prompts";
import {Conversation, Message, MessageType, newMessage} from '@/types/chat';
import {Plugin, PluginID, PluginList, Plugins} from '@/types/plugin';
import {Prompt} from '@/types/prompt';
import {AttachFile, handleFile} from "@/components/Chat/AttachFile";
import {FileList} from "@/components/Chat/FileList";
import {AttachedDocument, AttachedDocumentMetadata} from "@/types/attacheddocument";
import {setAssistant as setAssistantInMessage} from "@/utils/app/assistants";
import HomeContext from '@/pages/api/home/home.context';
import {PromptList} from './PromptList';
import {VariableModal} from './VariableModal';
import {DefaultModels, Model, REASONING_LEVELS, ReasoningLevels} from "@/types/model";
import {Assistant, DEFAULT_ASSISTANT} from "@/types/assistant";
import {COMMON_DISALLOWED_FILE_EXTENSIONS} from "@/utils/app/const";
import {useChatService} from "@/hooks/useChatService";
import {DataSourceSelector} from "@/components/DataSources/DataSourceSelector";
import {getAssistants} from "@/utils/app/assistants";
import AssistantsInUse from "@/components/Chat/AssistantsInUse";
import {AssistantSelect} from "@/components/Assistants/AssistantSelect";
import QiModal from './QiModal';
import { QiSummary, QiSummaryType } from '@/types/qi';
import {LoadingDialog} from "@/components/Loader/LoadingDialog";
import { createQiSummary } from '@/services/qiService';
import MessageSelectModal from './MesssageSelectModal';
import cloneDeep from 'lodash/cloneDeep';
import FeaturePlugin from './FeaturePluginSelector/FeaturePlugins';
import PromptOptimizerButton from "@/components/Optimizer/PromptOptimizerButton";
import { filterModels } from '@/utils/app/models';
import { getSettings } from '@/utils/app/settings';
import { MemoryPresenter } from "@/components/Chat/MemoryPresenter";
// import { ProjectList } from './ProjectList';
import { useSession } from 'next-auth/react';
import {  } from '../../services/memoryService';
import { ProjectInUse } from './ProjectInUse';
import { Settings } from '@/types/settings';
import { ToggleOptionButtons } from '../ReusableComponents/ToggleOptionButtons';
import { capitalize } from '@/utils/app/data';
import { getOpsForUser } from '@/services/opsService';
import { filterSupportedIntegrationOps } from '@/utils/app/ops';
import OperationSelector from "@/components/Chat/OperationSelector";
import ActionsList from "@/components/Chat/ActionsList";



interface Props {
    onSend: (message: Message, documents: AttachedDocument[]) => void;
    onRegenerate: () => void;
    handleUpdateModel: (model: Model) => void;
    onScrollDownClick: () => void;
    stopConversationRef: MutableRefObject<boolean>;
    textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
    showScrollDownButton: boolean;
    plugins: Plugin[];
    setPlugins: (p: Plugin[]) => void;
}

// interface Project {
//     ProjectID: string;
//     ProjectName: string;
// }

export const ChatInput = ({
                              onSend,
                              onRegenerate,
                              onScrollDownClick,
                              stopConversationRef,
                              textareaRef,
                              handleUpdateModel,
                              showScrollDownButton,
                              plugins,
                              setPlugins
                          }: Props) => {
    const {t} = useTranslation('chat');

    const {killRequest} = useChatService();

    const {
        state: {selectedConversation, selectedAssistant, messageIsStreaming, artifactIsStreaming,
            prompts,  featureFlags, currentRequestId, chatEndpoint, statsService, availableModels,
            extractedFacts, memoryExtractionEnabled},
        getDefaultModel, handleUpdateConversation,
        dispatch: homeDispatch
    } = useContext(HomeContext);


    const updateSize = () => {
        const container = document.querySelector(".chatcontainer");
        if (container) {
            return `${container.getBoundingClientRect().width}px`;
        }
        return '100%';
    };

    let settingRef = useRef<Settings | null>(null);
    // prevent recalling the getSettings function
    if (settingRef.current === null) settingRef.current = getSettings(featureFlags);
    const [filteredModels, setFilteredModels] = useState<Model[]>([]);

    useEffect(() => {
        const handleEvent = (event:any) => {
            settingRef.current = getSettings(featureFlags);
            if (Object.keys(availableModels).length > 0) {
                setFilteredModels(filterModels(availableModels, settingRef.current.hiddenModelIds));
            }
        };

        window.addEventListener('updateFeatureSettings', handleEvent);
        return () => {
            window.removeEventListener('updateFeatureSettings', handleEvent);
        };
    }, []);

    useEffect(() => {
        settingRef.current = getSettings(featureFlags);
        setFilteredModels(filterModels(availableModels, settingRef.current.hiddenModelIds));
    }, [availableModels]);

    const [chatContainerWidth, setChatContainerWidth] = useState(updateSize());
    const [isFactsVisible, setIsFactsVisible] = useState(false);
    // const [showProjectList, setShowProjectList] = useState(false);
    // const projectListRef = useRef<HTMLDivElement | null>(null);
    const { data: session } = useSession();
    // const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    // const [projects, setProjects] = useState<Project[]>([]);

    // useEffect(() => {
    //     if (!featureFlags.memory) return; // Early return if feature flag is off

    //     const fetchProjects = async () => {
    //         if (session?.user?.email) {
    //             try {
    //                 const response = await doGetProjectsOp(session.user.email);
    //                 const parsedBody = JSON.parse(response.body);
    //                 const projectsData = parsedBody.projects.map((p: any) => ({
    //                     ProjectID: p.id,
    //                     ProjectName: p.project
    //                 }));
    //                 setProjects(projectsData);
    //             } catch (error) {
    //                 console.error('Error fetching projects:', error);
    //             }
    //         }
    //     };

    //     if (featureFlags.memory) fetchProjects();
    // }, [session?.user?.email]);

    const shouldShowFactsNotification =
        featureFlags.memory &&
        !isFactsVisible &&
        selectedConversation &&
        selectedConversation.messages?.length > 0 &&
        extractedFacts?.length > 0 &&
        !messageIsStreaming &&
        !artifactIsStreaming;

    useEffect(() => {
        const updateWidth = () => {
            if (!messageIsStreaming && !artifactIsStreaming) setChatContainerWidth(updateSize());
        }
        window.addEventListener('resize', updateWidth);
        window.addEventListener('orientationchange', updateWidth);
        window.addEventListener('pageshow', updateWidth);
        window.addEventListener('pagehide', updateWidth);
        const observer = new MutationObserver(updateWidth);
        observer.observe(document, { childList: true, subtree: true, attributes: true });
        return () => {
            window.removeEventListener('resize', updateWidth);
            window.removeEventListener('orientationchange', updateWidth);
            window.removeEventListener('pageshow', updateWidth);
            window.removeEventListener('pagehide', updateWidth);
            observer.disconnect();
        };
    }, []);


    const promptsRef = useRef(prompts);

    useEffect(() => {
        promptsRef.current = prompts;
    }, [prompts]);

    const [messageIsDisabled, setMessageIsDisabled] = useState<boolean>(false);


    useEffect(() => {
        if (selectedConversation && selectedAssistant)
            setMessageIsDisabled(
                Object.keys(selectedAssistant?.definition?.data?.groupTypeData || {}).length > 0 &&
                !selectedConversation?.groupType);
    }, [selectedAssistant, selectedConversation]);

    const [content, setContent] = useState<string>();
    const [isTyping, setIsTyping] = useState<boolean>(false);
    const [showPromptList, setShowPromptList] = useState(false);
    const [activePromptIndex, setActivePromptIndex] = useState(0);
    const [promptInputValue, setPromptInputValue] = useState('');
    const [variables, setVariables] = useState<string[]>([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [showMessageSelectDialog, setShowMessageSelectDialog] = useState(false);
    const [croppedConversation, setCroppedConversation] = useState<Conversation | null>(null);

    const [showQiDialog, setShowQiDialog] = useState(false);
    const [isQiLoading, setIsQiLoading] = useState<boolean>(true);
    const [qiSummary, setQiSummary] = useState<QiSummary | null>(null)
    const [isInputInFocus, setIsInputInFocus] = useState(false);
    const [allOperations, setAllOperations] = useState<any[]>([]);
    // State to track the list of added actions
    const [addedActions, setAddedActions] = useState<{ 
        name: string; 
        customName?: string;
        customDescription?: string;
        operation?: any;
        parameters?: Record<string, { value: string; mode: 'ai' | 'manual' }>;
    }[]>([]);

    // Show Ops popup toggle state
    const [showOpsPopup, setShowOpsPopup] = useState(false);
    const [editingAction, setEditingAction] = useState<{
        name: string; 
        customName?: string;
        customDescription?: string;
        index: number;
        parameters?: Record<string, { value: string; mode: 'ai' | 'manual' }>;
    } | null>(null);
    
    // Action set modal states
    const [showSaveActionsModal, setShowSaveActionsModal] = useState(false);
    const [showLoadActionSetModal, setShowLoadActionSetModal] = useState(false);


    const [showDataSourceSelector, setShowDataSourceSelector] = useState(false);
    //const [assistant, setAssistant] = useState<Assistant>(selectedAssistant || DEFAULT_ASSISTANT);
    const [availableAssistants, setAvailableAssistants] = useState<Assistant[]>([DEFAULT_ASSISTANT]);
    const [showAssistantSelect, setShowAssistantSelect] = useState(false);
    const [documents, setDocuments] = useState<AttachedDocument[]>();
    const [documentState, setDocumentState] = useState<{ [key: string]: number }>({});
    const [documentMetadata, setDocumentMetadata] = useState<{ [key: string]: AttachedDocumentMetadata }>({});
    const [documentAborts, setDocumentAborts] = useState<{ [key: string]: AbortController }>({});

    const promptListRef = useRef<HTMLUListElement | null>(null);
    const dataSourceSelectorRef = useRef<HTMLDivElement | null>(null);
    const actionSelectorRef = useRef<HTMLDivElement | null>(null);
    const assistantSelectorRef = useRef<HTMLDivElement | null>(null);

    const [isWorkflowOn, setWorkflowOn] = useState(false);

    // const [factTypes, setFactTypes] = useState<{ [key: string]: string }>({});
    // const [selectedProjects, setSelectedProjects] = useState<{ [key: string]: string }>({});

    // const { data: session } = useSession();
    // const userEmail = session?.user?.email;

    const extractDocumentsLocally = featureFlags.extractDocumentsLocally;

    const filteredPrompts =  promptsRef.current.filter((prompt:Prompt) =>
        prompt.name.toLowerCase().includes(promptInputValue.toLowerCase()),
    );

    const handleShowAssistantSelector = () => {
        setShowAssistantSelect(!showAssistantSelect);
        // setShowProjectList(false);

    };

    // const handleShowProjectSelector = () => {
    //     setShowProjectList(!showProjectList);
    //     setShowAssistantSelect(false);
    // };

    const allDocumentsDoneUploading = () => {
        if (!documents || documents.length == 0) {
            return true;
        }

        const isComplete = (document: AttachedDocument) => {
            return !documentState || (documentState && documentState[document.id] == 100);
        }

        return documents?.every(isComplete);
    }





    const onAssistantChange = (assistant: Assistant) => {
        setShowAssistantSelect(false);

        if (selectedConversation) {
            const oldAstTags = selectedAssistant?.definition.data?.conversationTags || [];
            let updatedTags = selectedConversation.tags?.filter((t: string) => !oldAstTags.includes(t));

            const astTags = assistant ? assistant.definition.data?.conversationTags || [] : [];

            updatedTags = updatedTags ? [...updatedTags, ...astTags] : [...astTags];

            //remove duplicates if any
            selectedConversation.tags = Array.from(new Set(updatedTags));

            homeDispatch({field: 'selectedAssistant', value: assistant ? assistant : DEFAULT_ASSISTANT});
            let assistantPrompt: Prompt | undefined = undefined;

            if (assistant) assistantPrompt =  promptsRef.current.find((prompt:Prompt) => prompt?.data?.assistant?.definition.assistantId === assistant.definition.assistantId);

            //I do not get the impression that promptTemplates are currently used nonetheless the bases are covered in case they ever come into play (as taken into account in handleStartConversationWithPrompt)
            selectedConversation.promptTemplate = assistantPrompt ?? null;

        }

    }

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        const maxLength =  selectedConversation?.model?.inputContextWindow;

        if (maxLength && value.length > maxLength) {
            alert(
                t(
                    `Message limit is {{maxLength}} characters. You have entered {{valueLength}} characters.`,
                    {maxLength, valueLength: value.length},
                ),
            );
            return;
        }

        setContent(value);
        updatePromptListVisibility(value);
    };

    const addDocument = (document: AttachedDocument) => {
        let newDocuments = documents || [];
        newDocuments.push(document);
        setDocuments(newDocuments);

        console.log("Document attached.");
    }

    const handleAppendDocumentsToContent = (content: string, documents: AttachedDocument[]) => {

        if (!extractDocumentsLocally) {
            return content;
        }

        // This prevents documents that were uploaded from being jammed into the prompt here
        const toInsert = documents.filter((doc:AttachedDocument) => !doc.key && doc.raw && doc.raw.length > 0);

        if (toInsert.length > 0) {
            content =
                toInsert.map((d, i) => {
                    return "---------------Document " + (i + 1) + "--------------\n" + d.raw
                }).join("\n") +
                "\n-----------------------------\n\n" +
                content;
        }

        return content;
    }

    const handleSend = () => {
        setShowDataSourceSelector(false);
        setShowOpsPopup(false);
        setEditingAction(null);  // Clear any editing action state

        if (messageIsStreaming || artifactIsStreaming) {
            return;
        }

        if (!content) {
            alert(t('Please enter a message'));
            return;
        }

        if (!allDocumentsDoneUploading()) {
            alert(t('Please wait for all documents to finish uploading or remove them from the prompt.'));
            return;
        }

        const maxLength = selectedConversation?.model?.inputContextWindow;

        if (maxLength && content.length > maxLength) {
            alert(
                t(
                    `Message limit is {{maxLength}} characters. You have entered {{valueLength}} characters.`,
                    {maxLength, valueLength: content.length},
                ),
            );
            return;
        }

        const type = (isWorkflowOn) ? MessageType.AUTOMATION : MessageType.PROMPT;
        let msg = newMessage({
            role: 'user', 
            content: content, 
            type: type,
            configuredTools: addedActions.length > 0 ? [...addedActions] : undefined
        });

        msg = setAssistantInMessage(msg, selectedAssistant || DEFAULT_ASSISTANT);

        if (documents && documents?.length > 0) {

            if (!isWorkflowOn) {

                msg.content = extractDocumentsLocally ?
                    handleAppendDocumentsToContent(content, documents) : content;

                const maxLength = selectedConversation?.model.inputContextWindow;

                if (maxLength && msg.content.length > maxLength) {
                    alert(
                        t(
                            `Message limit is {{maxLength}} characters. Your prompt and attached documents are {{valueLength}} characters. Please remove the attached documents or choose smaller excerpts.`,
                            {maxLength, valueLength: msg.content.length},
                        ),
                    );
                    return;
                }
            }
        }

        const updatedDocuments = documents?.map((d) => {
            const metadata = documentMetadata[d.id];
            if (metadata) {
                return {...d, metadata: metadata};
            }
            return d;
        });

        statsService.userSendChatEvent(msg as Message, selectedConversation?.model?.id ?? '');

        onSend(msg, updatedDocuments || []);

        // if (selectedProject && selectedConversation) {
        //     selectedConversation.projectId = selectedProject.ProjectID;
        // }

        setContent('');
        setDocuments([]);
        setDocumentState({});
        setDocumentMetadata({});
        
        // Keep the actions list after sending - removed setAddedActions([])

        if (window.innerWidth < 640 && textareaRef && textareaRef.current) {
            textareaRef.current.blur();
        }
    };

    const handleStopConversation = () => {
        stopConversationRef.current = true;
        let timeout = 1000;
        if (currentRequestId) {
            console.log("kill request id: ", currentRequestId);
            killRequest(currentRequestId);
        }

        if (artifactIsStreaming) {
            console.log("kill artifact even trigger: ");
            const event = new Event( 'killArtifactRequest');
            window.dispatchEvent(event);
            timeout = 100;
        } else {
            const event = new Event( 'killChatRequest');
            window.dispatchEvent(event);
        }

        setTimeout(() => {
            stopConversationRef.current = false;
            homeDispatch({field: 'loading', value: false});
            homeDispatch({field: 'messageIsStreaming', value: false});
            homeDispatch({field: 'artifactIsStreaming', value: false});
            homeDispatch({field: 'status', value: []});
        }, timeout);

    };

    const isMobile = () => {
        const userAgent =
            typeof window.navigator === 'undefined' ? '' : navigator.userAgent;
        const mobileRegex =
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i;
        return mobileRegex.test(userAgent);
    };

    const handleInitModal = () => {
        const selectedPrompt = filteredPrompts[activePromptIndex];
        if (selectedPrompt) {
            setContent((prevContent) => {
                const newContent = prevContent?.replace(
                    /\/\w*$/,
                    selectedPrompt.content,
                );
                return newContent;
            });
            handlePromptSelect(selectedPrompt);
        }
        setShowPromptList(false);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (showPromptList) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActivePromptIndex((prevIndex) =>
                    prevIndex <  promptsRef.current.length - 1 ? prevIndex + 1 : prevIndex,
                );
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActivePromptIndex((prevIndex) =>
                    prevIndex > 0 ? prevIndex - 1 : prevIndex,
                );
            } else if (e.key === 'Tab') {
                e.preventDefault();
                setActivePromptIndex((prevIndex) =>
                    prevIndex <  promptsRef.current.length - 1 ? prevIndex + 1 : 0,
                );
            } else if (e.key === 'Enter') {
                e.preventDefault();
                handleInitModal();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setShowPromptList(false);
            } else {
                setActivePromptIndex(0);
            }
        } else if (e.key === 'Enter' && !isTyping && !isMobile() && !e.shiftKey && !messageIsDisabled) {
            e.preventDefault();
            handleSend();
        }

    };

    const updatePromptListVisibility = useCallback((text: string) => {
        const match = text.match(/\/\w*$/);

        if (match) {
            // setShowPromptList(true);
            // setPromptInputValue(match[0].slice(1));
        } else {
            setShowPromptList(false);
            setPromptInputValue('');
        }
    }, []);

    const handlePromptSelect = (prompt: Prompt) => {
        const parsedVariables = parsePromptVariables(prompt.content);
        setVariables(parsedVariables);

        if (parsedVariables.length > 0) {
            setIsModalVisible(true);
        } else {
            setContent((prevContent) => {
                const updatedContent = prevContent?.replace(/\/\w*$/, prompt.content);
                return updatedContent;
            });
            updatePromptListVisibility(prompt.content);
        }
    };

    const handleSubmit = (updatedVariables: string[]) => {

        const newContent = content?.replace(/{{(.*?)}}/g, (match, variable) => {
            const index = variables.indexOf(variable);
            return updatedVariables[index];
        });

        setContent(newContent);

        if (textareaRef && textareaRef.current) {
            textareaRef.current.focus();
        }
    };

    useEffect(() => {
        if (prompts) {
            const assistants = getAssistants(prompts);
            setAvailableAssistants(assistants);
        }
    }, [prompts]);

    useEffect(() => {
        const fetchOps = async () => {
            if (!featureFlags?.integrations) return;

            const opsResponse = await getOpsForUser();
            if (opsResponse.success && Array.isArray(opsResponse.data)) {
                const filtered = await filterSupportedIntegrationOps(opsResponse.data);
                if (filtered) {
                    setAllOperations(filtered);
                }
            }
        };

        fetchOps();
    }, [featureFlags]);

    useEffect(() => {
        if (promptListRef.current) {
            promptListRef.current.scrollTop = activePromptIndex * 30;
        }
    }, [activePromptIndex]);

    useEffect(() => {
        if (textareaRef && textareaRef.current) {
            textareaRef.current.style.height = 'inherit';
            textareaRef.current.style.height = `${textareaRef.current?.scrollHeight}px`;
            textareaRef.current.style.overflow = `${
                textareaRef?.current?.scrollHeight > 400 ? 'auto' : 'hidden'
            }`;
        }

    }, [content]);

    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            if ( promptListRef.current &&
                !promptListRef.current.contains(e.target as Node)) setShowPromptList(false);

            if (dataSourceSelectorRef.current &&
                !dataSourceSelectorRef.current.contains(e.target as Node)) setShowDataSourceSelector(false);
            
            if (actionSelectorRef.current && 
                !actionSelectorRef.current.contains(e.target as Node)) setShowOpsPopup(false);

            if (assistantSelectorRef.current && !assistantSelectorRef.current.contains(e.target as Node)) setShowAssistantSelect(false);
        };

        window.addEventListener('click', handleOutsideClick);

        return () => {
            window.removeEventListener('click', handleOutsideClick);
        };
    }, []);

    let buttonClasses = "left-1 top-2 rounded-sm p-1 text-neutral-800 opacity-60 hover:bg-neutral-200 hover:text-neutral-900 dark:bg-opacity-50 dark:text-neutral-100 dark:hover:text-neutral-200";
    if (isWorkflowOn) {
        buttonClasses += " bg-green-400 text-white"; // provide your desired 'on' state style classes
    }

    const onCancelUpload = (document: AttachedDocument) => {
        try {

            if (documentAborts && documentAborts[document.id]) {
                // @ts-ignore
                documentAborts[document.id]();
            } else if (documentState && documentState[document.id]) {
                // Needt to delete from server
            }
        } catch (e) {
            console.log(e);
        }
    }

    const handleDocumentAbortController = (document: AttachedDocument, abortController: any) => {

        setDocumentAborts((prevState) => {
            let newState = {...prevState, [document.id]: abortController};
            newState[document.id] = abortController;
            return newState;
        });
    }

    const handleDocumentState = (document: AttachedDocument, progress: number) => {
        console.log("Progress: " + progress);

        setDocumentState((prevState) => {
            let newState = {...prevState, [document.id]: progress};
            newState[document.id] = progress;
            return newState;
        });

    }

    const handleSetMetadata = (document: AttachedDocument, metadata: any) => {

        setDocumentMetadata((prevState) => {
            const newMetadata = {...prevState, [document.id]: metadata};
            return newMetadata;
        });

    }

    const handleSetKey = (document: AttachedDocument, key: string) => {

        const newDocuments = documents ? documents?.map((d) => {
            if (d.id === document.id) {
                return {...d, key: key};
            }
            return d;
        }) : [{...document, key: key}];

        setDocuments(newDocuments);

    }
    const handleGetQiSummary = async (conversation:Conversation) => {
        setShowMessageSelectDialog(false);
        setIsQiLoading(true);
        setShowQiDialog(true);
        const summary = await createQiSummary(chatEndpoint || '', getDefaultModel(DefaultModels.CHEAPEST), conversation, QiSummaryType.CONVERSATION, statsService);
        setQiSummary(summary);
        setIsQiLoading(false);
    }

    const getDisallowedFileExtensions = () => {
        return [ ...COMMON_DISALLOWED_FILE_EXTENSIONS,
            ...(selectedConversation?.model?.supportsImages
                ? [] : ["jpg","png","gif", "jpeg", "webp"] ) ]
    }

    ////// Plugin Dependencies //////

    // PluginID.CODE_INTERPRETER is not compatible with Selected Assistants for now
    useEffect(() => { // if code interpreter is toggled in plugin selector, set the selected assistant to the default assistant
        const containsCodeInterpreter = plugins.map((p: Plugin) => p.id).includes(PluginID.CODE_INTERPRETER);
        if (containsCodeInterpreter) homeDispatch({field: 'selectedAssistant', value: DEFAULT_ASSISTANT});
    }, [plugins]);

    useEffect(() => { // if selected assistant change is not the default assistant, remove code interpreter from plugins
        if (selectedAssistant !== DEFAULT_ASSISTANT) setPlugins(plugins.filter((p: Plugin) => p.id !== PluginID.CODE_INTERPRETER ));
    }, [selectedAssistant]);

    // don't remove Memory plugin when extraction is disabled
    useEffect(() => {
        // ensure we dont alter the plugin when memory feature is disabled
        if (featureFlags.memory && settingRef?.current?.featureOptions.includeMemory) {
            const containsMemory = plugins.map((p: Plugin) => p.id).includes(PluginID.MEMORY);
            if (memoryExtractionEnabled && !containsMemory) {
                setPlugins([...plugins, Plugins[PluginID.MEMORY]]);
            }
        }
    }, [memoryExtractionEnabled]);

    useEffect(() => {
        // Ensure MEMORY plugin is included when memory feature is enabled
        if (featureFlags.memory &&
            settingRef?.current?.featureOptions.includeMemory) {

            const containsMemory = plugins.map((p: Plugin) => p.id).includes(PluginID.MEMORY);

            // If memory is enabled in settings but not in plugins, add it
            if (!containsMemory) {
                setPlugins([...plugins, Plugins[PluginID.MEMORY]]);
            }
        }
    }, [featureFlags.memory, settingRef?.current?.featureOptions.includeMemory]);

    // RAG EVAL is dependent on RAG
    useEffect(() => { // ensure rag being off and eval being on is not possible
        const pluginIds = plugins.map((p: Plugin) => p.id);
        const containsRag = pluginIds.includes(PluginID.RAG);
        const containsRagEval = pluginIds.includes(PluginID.RAG_EVAL);
        if (!containsRag && containsRagEval) {
            setPlugins(plugins.filter((p: Plugin) => p.id !== PluginID.RAG_EVAL));
        }
    }, [plugins]);


    return (
        <>
            { featureFlags.pluginsOnInput &&
                settingRef.current.featureOptions.includePluginSelector &&
                <div className='relative z-20' style={{height: 0}}>
                    <FeaturePlugin
                        plugins={plugins}
                        setPlugins={setPlugins}
                    />
                </div>
            }
            <div style={{width: chatContainerWidth}}
                 className="px-14 absolute bottom-0 left-0 border-transparent bg-gradient-to-b from-transparent via-white to-white pt-6 dark:border-white/20 dark:via-[#343541] dark:to-[#343541] md:pt-2 z-15">

                <div className="flex flex-col gap-2 justify-center items-center stretch mx-2 mt-4 flex flex-row gap-0 last:mb-2 md:mx-4 md:mt-[52px] md:last:mb-6 ">

                    {!showScrollDownButton && !messageIsStreaming && !artifactIsStreaming && featureFlags.qiSummary && !showDataSourceSelector &&
                        (selectedConversation && selectedConversation.messages?.length > 0) &&  (
                            <div className="fixed flex flex-row absolute top-0 group prose dark:prose-invert  hover:text-neutral-900 dark:hover:text-neutral-100">
                                <button
                                    className="mt-5 cursor-pointer border border-gray-300 dark:border-gray-600 rounded px-2 py-1"
                                    style={{ fontSize: '0.9rem' }}
                                    onClick={async () => {
                                        // setShowPromptList(false);
                                        if (selectedConversation && selectedConversation.messages?.length > 2) {
                                            setShowMessageSelectDialog(true);
                                        } else {
                                            setCroppedConversation(cloneDeep(selectedConversation));
                                            handleGetQiSummary(selectedConversation);
                                        }


                                    }}
                                    title={`Anonymously share your conversation for quality improvement`}
                                >
                                    Share for Quality Improvement
                                </button>
                            </div>)}



                    <div className='absolute top-0 left-0 right-0 mx-auto flex justify-center items-center gap-2'>


                        {(messageIsStreaming || artifactIsStreaming) &&  (
                            <>
                                <button
                                    id="stopGenerating"
                                    className="mt-10 flex w-fit items-center gap-1 rounded border border-neutral-200 bg-white py-2 px-4 text-black hover:opacity-50 dark:border-neutral-600 dark:bg-[#343541] dark:text-white md:mb-0 "
                                    onClick={handleStopConversation}
                                >
                                    <IconPlayerStop size={16}/> {t('Stop Generating')}
                                </button>

                                {/*<StatusDisplay statusHistory={status}/>*/}
                            </>
                        )}
                    </div>


                    {/*{!messageIsStreaming &&*/}
                    {/*  selectedConversation &&*/}
                    {/*  selectedConversation.messages.length > 0 && (*/}
                    {/*    <button*/}
                    {/*      className="absolute top-0 left-0 right-0 mx-auto mb-3 flex w-fit items-center gap-3 rounded border border-neutral-200 bg-white py-2 px-4 text-black hover:opacity-50 dark:border-neutral-600 dark:bg-[#343541] dark:text-white md:mb-0 md:mt-2"*/}
                    {/*      onClick={onRegenerate}*/}
                    {/*    >*/}
                    {/*      <IconRepeat size={16} /> {t('Regenerate response')}*/}
                    {/*    </button>*/}
                    {/*  )}*/}

                    {showDataSourceSelector && (
                        <div ref={dataSourceSelectorRef} className="rounded bg-white dark:bg-[#343541]"
                             style={{transform: 'translateY(70px)'}}>
                            <DataSourceSelector
                                disallowedFileExtensions={getDisallowedFileExtensions()}
                                onDataSourceSelected={(d) => {
                                    const doc = {
                                        id: d.id,
                                        name: d.name || "",
                                        raw: null,
                                        type: d.type || "",
                                        data: "",
                                        metadata: d.metadata
                                    };
                                    addDocument(
                                        doc
                                    );
                                    handleSetKey(doc, doc.id);
                                    handleSetMetadata(doc, d.metadata);
                                    handleDocumentState(doc, 100);
                                }}
                                showActionButtons={true}
                                onIntegrationDataSourceSelected={featureFlags.integrations ?
                                    (file: File) => { handleFile(file, addDocument, handleDocumentState, handleSetKey, handleSetMetadata, handleDocumentAbortController, featureFlags.uploadDocuments, undefined)}
                                    : undefined
                                }
                            />
                        </div>
                    )}

                    { featureFlags.actionSets &&  showOpsPopup && (
                            <div ref={actionSelectorRef} className="z-50 w-full" 
                                 style={{transform: 'translateY(60px)'}} >
                                <OperationSelector
                                    operations={allOperations}
                                    initialAction={editingAction ? 
                                        { 
                                          name: editingAction.name, 
                                          customName: editingAction.customName,
                                          customDescription: editingAction.customDescription,
                                          parameters: editingAction.parameters || {} 
                                        } : 
                                        undefined
                                    }
                                    editMode={!!editingAction}
                                    onCancel={() => {
                                        setShowOpsPopup(false);
                                        setEditingAction(null);
                                    }}
                                    onActionAdded={(operation, parameters, customName, customDescription) => {
                                        if (editingAction) {
                                            // Update the existing action
                                            setAddedActions((prev) => {
                                                const newActions = [...prev];
                                                newActions[editingAction.index] = { 
                                                    name: operation.name,
                                                    operation,
                                                    customName,
                                                    customDescription,
                                                    parameters
                                                };
                                                return newActions;
                                            });
                                            console.log(
                                                `Action Updated: ${operation.name}`,
                                                customName ? `Custom Name: ${customName}` : '',
                                                customDescription ? `Custom Description: ${customDescription}` : '',
                                                'Parameters:', parameters,
                                                'Operation:', operation
                                            );
                                        } else {
                                            // Add a new action
                                            setAddedActions((prev) => [...prev, { 
                                                name: operation.name,
                                                operation,
                                                customName,
                                                customDescription,
                                                parameters
                                            }]);
                                            console.log(
                                                `Action Added: ${operation.name}`,
                                                customName ? `Custom Name: ${customName}` : '',
                                                customDescription ? `Custom Description: ${customDescription}` : '',
                                                'Parameters:', parameters,
                                                'Operation:', operation
                                            );
                                        }
                                        // Clear editing state and close the popup
                                        setEditingAction(null);
                                        // setShowOpsPopup(false);
                                    }}
                                />
                            </div>
                        )}

                    {//TODO: feature flag this
                    }
                    {featureFlags.memory &&
                        <div ref={dataSourceSelectorRef} className="rounded bg-white dark:bg-[#343541]"
                             style={{transform: 'translateY(50px)'}}>
                            <MemoryPresenter
                                isFactsVisible={isFactsVisible}
                                setIsFactsVisible={setIsFactsVisible}
                            />
                        </div>    }



                    <div className="relative mx-2 flex w-full flex-grow sm:mx-4" style={{transform: 'translateY(16px)'}}>

                        <AssistantsInUse assistants={[selectedAssistant || DEFAULT_ASSISTANT]} assistantsChanged={(asts)=>{
                            if(asts.length === 0){
                                //setAssistant(DEFAULT_ASSISTANT);
                                homeDispatch({field: 'selectedAssistant', value: DEFAULT_ASSISTANT});
                            }
                            else {
                                //setAssistant(asts[0]);
                                homeDispatch({field: 'selectedAssistant', value: asts[0]});
                            }
                        }}/>

                        {//TODO: feature flag this
                        }
                        {/* {featureFlags.memory &&
                    <ProjectInUse
                        project={selectedProject}
                        projectChanged={(project) => {
                            setSelectedProject(project);
                            setShowProjectList(false);
                        }}/>} */}

                        <FileList documents={documents}
                                  documentStates={documentState}
                                  onCancelUpload={onCancelUpload}
                                  setDocuments={setDocuments}/>

                    </div>

                    <div className="relative mx-2 flex w-full flex-grow flex-col rounded-md border border-black/10 bg-white shadow-[0_0_10px_rgba(0,0,0,0.10)] dark:border-gray-900/50 dark:bg-[#40414F] dark:text-white dark:shadow-[0_0_15px_rgba(0,0,0,0.10)] sm:mx-4" >

                        {/* Render ActionsList above the input area */}
                        {featureFlags.actionSets && addedActions.length > 0 && (
                            <div className="w-full px-2 py-2 border-b border-black/10 dark:border-gray-700/50">
                                <ActionsList actions={addedActions}
                                             onActionClick={
                                                 (a)=>{
                                                     // Handle action click
                                                     console.log("Action clicked:", a);
                                                 }
                                             }

                                             onConfigureAction={(a, index)=>{
                                                    // Set the action being edited
                                                    setEditingAction({
                                                        ...a, 
                                                        index,
                                                        // Get parameters from addedActions if they exist
                                                        parameters: addedActions[index].parameters
                                                    });
                                                    // Open the operations popup with this specific action
                                                    setShowOpsPopup(true);
                                                    console.log("Configure action:", a, "at index", index, "with parameters:", addedActions[index].parameters);
                                             }}

                                             onRemoveAction={
                                                 (i) =>{
                                                     // Remove the action from added actions without alert
                                                     setAddedActions((prevActions) => {
                                                         const newActions = [...prevActions];
                                                         newActions.splice(i, 1);
                                                         return newActions;
                                                     });
                                                 }
                                             }
                                             
                                             onSaveActions={
                                                 () => {
                                                     setShowSaveActionsModal(true);
                                                 }
                                             }

                                             onClearActions={
                                                 () => {
                                                     setAddedActions([]);
                                                 }
                                             }
                                />
                            </div>
                        )}

                        <div className="px-2 flex items-center">


                            {featureFlags.promptOptimizer && isInputInFocus && (
                                <div className='relative mr-[-32px]'>
                                    <PromptOptimizerButton
                                        prompt={content || ""}
                                        onOptimized={(optimizedPrompt:string) => {
                                            setContent(optimizedPrompt);
                                            textareaRef.current?.focus();
                                        }}
                                    />
                                </div>
                            )}

                            {featureFlags.qiSummary && <>
                                {showMessageSelectDialog &&
                                    <MessageSelectModal
                                        setConversation={setCroppedConversation}
                                        onCancel={() => {
                                            setShowMessageSelectDialog(false);
                                        }}
                                        onSubmit={handleGetQiSummary}
                                    />}

                                {showQiDialog && (
                                    isQiLoading ? (  <LoadingDialog open={isQiLoading} message={"Creating Summary..."}/>) :
                                        <QiModal
                                            qiSummary={qiSummary}
                                            onCancel={() => {
                                                setShowQiDialog(false)
                                                setQiSummary(null);
                                                setIsQiLoading(true);
                                            }}
                                            onSubmit={() => {
                                                setShowQiDialog(false)
                                                setQiSummary(null);
                                                setIsQiLoading(true);
                                            }}
                                            type={QiSummaryType.CONVERSATION}
                                            conversation={croppedConversation}
                                        />
                                )}
                            </>}

                            <textarea
                                ref={textareaRef}
                                onFocus={() => setIsInputInFocus(true)}
                                onBlur={() => setIsInputInFocus(false)}
                                id="messageChatInputText"
                                className="m-0 w-full resize-none border-0 bg-transparent p-0 py-2 pr-8 pl-10 text-black dark:bg-transparent dark:text-white md:py-3 md:pl-10"
                                style={{
                                    resize: 'none',
                                    bottom: `${textareaRef?.current?.scrollHeight}px`,
                                    maxHeight: '400px',
                                    overflow: `${
                                        textareaRef.current && textareaRef.current.scrollHeight > 400
                                            ? 'auto'
                                            : 'hidden'
                                    }`,
                                }}
                                placeholder={
                                    // t('Type a message or type "/" to select a prompt...') || ''
                                    "Type a message to chat with Amplify..."
                                }
                                value={content}
                                rows={1}
                                onCompositionStart={() => setIsTyping(true)}
                                onCompositionEnd={() => setIsTyping(false)}
                                onChange={handleChange}
                                onKeyDown={handleKeyDown}
                            />

                            <button
                                id="sendMessage"
                                className={`right-2 top-2 rounded-sm p-1 text-neutral-800 mx-1 
                                ${messageIsDisabled || !content? 'cursor-not-allowed ' : 'opacity-60 hover:bg-neutral-200 hover:text-neutral-900'} 
                                dark:bg-opacity-50 dark:text-neutral-100 dark:hover:text-neutral-200`}
                                onClick={handleSend}
                                title={messageIsDisabled ? "Please address missing information to enable chat"
                                    : !content ? "Enter a message to start chatting" : "Send Prompt"}
                                disabled={messageIsDisabled || !content }
                            >
                                {messageIsStreaming || artifactIsStreaming ? (
                                    <div
                                        className="h-4 w-4 animate-spin rounded-full border-t-2 border-neutral-800 opacity-60 dark:border-neutral-100"></div>
                                ) : (
                                    <IconSend size={18}/>
                                )}
                            </button>


                            {showScrollDownButton && (
                                <div className="absolute bottom-12 right-0 lg:bottom-0 lg:-right-10">
                                    <button
                                        className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-300 text-gray-800 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-neutral-200"
                                        onClick={onScrollDownClick}
                                        title="Scroll Down"
                                    >
                                        <IconArrowDown size={18}/>
                                    </button>
                                </div>
                            )}

                        </div>


                        {showPromptList && filteredPrompts.length > 0 && (
                            <div className="absolute bottom-12 w-full">
                                <PromptList
                                    activePromptIndex={activePromptIndex}
                                    prompts={filteredPrompts}
                                    onSelect={handleInitModal}
                                    onMouseOver={setActivePromptIndex}
                                    promptListRef={promptListRef}
                                />
                            </div>
                        )}

                        {isModalVisible && (
                            <VariableModal
                                models={filteredModels}
                                handleUpdateModel={handleUpdateModel}
                                prompt={filteredPrompts[activePromptIndex]}
                                variables={variables}
                                onSubmit={handleSubmit}
                                onClose={() => setIsModalVisible(false)}
                            />
                        )}
                    </div>


                    <div className="h-6 w-full flex flex-row gap-2 items-center ">


                        {featureFlags.dataSourceSelectorOnInput && (
                            <button
                                className="left-1 top-2 rounded-sm p-1 text-neutral-800 opacity-60 hover:bg-neutral-200 hover:text-neutral-900 dark:bg-opacity-50 dark:text-neutral-100 dark:hover:text-neutral-200"
                                id="viewFiles"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowDataSourceSelector(!showDataSourceSelector);
                                    setShowOpsPopup(false); // Close operation selector when opening data source selector
                                    setIsFactsVisible(false);
                                }}
                                onKeyDown={(e) => {
                                }}
                                title="Files"
                            >
                                <IconFiles size={20}/>
                            </button>
                        )}



                        { featureFlags.uploadDocuments &&
                            <AttachFile id="__attachFile"
                                        disallowedFileExtensions={getDisallowedFileExtensions()}
                                        onAttach={addDocument}
                                        onSetMetadata={handleSetMetadata}
                                        onSetKey={handleSetKey}
                                        onSetAbortController={handleDocumentAbortController}
                                        onUploadProgress={handleDocumentState}
                            />}

                        
                        { featureFlags.actionSets && 
                        <>
                        {/* Add Action button toggles the operations popup */}
                        <button
                            className="left-1 top-2 rounded-sm p-1 text-neutral-800 opacity-60 hover:bg-neutral-200 hover:text-neutral-900 dark:bg-opacity-50 dark:text-neutral-100 dark:hover:text-neutral-200"
                            id="addAction"
                            onClick={(e) => {
                                e.stopPropagation();
                                // If popup is being closed, reset editing state
                                if (showOpsPopup) {
                                    setEditingAction(null);
                                }
                                setShowOpsPopup(!showOpsPopup);
                                setShowDataSourceSelector(false); // Close data source selector when opening operation selector
                            }}
                            onKeyDown={(e) => {
                            }}
                            title="Add Action"
                        >
                            <IconSettingsAutomation size={20}/>
                        </button>
                        
                        {/* Load Action Set button */}
                        <button
                            className="left-1 top-2 rounded-sm p-1 text-neutral-800 opacity-60 hover:bg-neutral-200 hover:text-neutral-900 dark:bg-opacity-50 dark:text-neutral-100 dark:hover:text-neutral-200"
                            id="loadActionSet"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowLoadActionSetModal(true);
                                setShowOpsPopup(false);
                                setShowDataSourceSelector(false);
                            }}
                            onKeyDown={(e) => {
                            }}
                            title="Load Saved Action Set"
                        >
                            <IconFolderOpen size={20}/>
                        </button>
                        </>}

                        <div className='flex flex-row gap-2'>

                            <button
                                id="selectAssistants"
                                className={buttonClasses}
                                onClick={ (e) => {
                                    e.preventDefault();
                                    handleShowAssistantSelector();
                                    setShowDataSourceSelector(false);
                                }
                                }
                                onKeyDown={(e) => {
                                }}
                                title="Select Assistants"

                            >
                                <IconAt size={20}/>
                            </button>

                            {showAssistantSelect && (
                                <div className="absolute rounded bg-white dark:bg-[#343541]"
                                     style={{transform: 'translateX(30px) translateY(-2px)', zIndex: 10}}>
                                    <AssistantSelect
                                        assistant={selectedAssistant || DEFAULT_ASSISTANT}
                                        availableAssistants={availableAssistants}
                                        onKeyDown={(e: any) => {
                                            if (e.key === 'Escape') {
                                                e.preventDefault();
                                                setShowAssistantSelect(false);
                                                textareaRef.current?.focus();
                                            }
                                        }}
                                        onAssistantChange={(assistant: Assistant) => {
                                            onAssistantChange(assistant);
                                            if (textareaRef && textareaRef.current) {
                                                textareaRef.current.focus();
                                            }
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                        {/*<div className='flex flex-row gap-2'>
                         {featureFlags.memory && projects.length > 0  &&
                        // settingRef.current.featureOptions.includeMemory &&
                        (
                            <button
                                className={buttonClasses}
                                onClick={handleShowProjectSelector}
                                title="Project Memory"
                            >
                                <IconDeviceSdCard size={20} />
                            </button>
                        )}

                        {featureFlags.memory && projects.length > 0 && showProjectList && session?.user?.email && (
                            <div className="absolute rounded bg-white dark:bg-[#343541]"
                                 style={{transform: 'translateX(30px) translateY(-2px)', zIndex: 10}}

                                >
                                <ProjectList
                                    currentProject={selectedProject}
                                    availableProjects={projects}
                                    onKeyDown={(e: any) => {
                                        if (e.key === 'Escape') {
                                            e.preventDefault();
                                            setShowProjectList(false);
                                            textareaRef.current?.focus();
                                        }
                                    }}
                                    onProjectChange={(project: Project) => {
                                        setSelectedProject(project);
                                        setShowProjectList(false);
                                        if (textareaRef && textareaRef.current) {
                                            textareaRef.current.focus();
                                        }
                                    }}
                                />
                            </div>
                        )}
                    </div>*/}


                        {(!messageIsStreaming && !artifactIsStreaming) &&
                            <>
                                {featureFlags.memory && !isFactsVisible && selectedConversation &&
                                    selectedConversation.messages?.length > 0 && extractedFacts.length > 0 &&
                                    <button className='relative ml-auto mb-2 text-[1rem] text-[#1dbff5] dark:text-[#8edffa]'
                                            onClick={() => setIsFactsVisible(true)}>
                                        {extractedFacts.length} facts detected - Click to view
                                    </button>
                                }

                                {selectedConversation?.model?.supportsReasoning &&
                                    <div className='ml-auto'>
                                        <ToggleOptionButtons
                                            options={REASONING_LEVELS.map((lvl: string) => ({
                                                id: lvl,
                                                name: capitalize(lvl),
                                                title: `The model will use ${{low: "average amount of", medium: "additional", high: "more"}[lvl]} output tokens when crafting a response. \n${
                                                    {low: "Optimized for quick responses to simple questions, prioritizing speed",
                                                        medium: "Balanced approach for everyday questions, offering good accuracy without unnecessary processing time",
                                                        high: "Provides in-depth analysis for complex problems where thoroughness and precision matter most"}[lvl]}`,
                                                icon: ({low: IconBulb, medium: IconScale, high: IconBrain}[lvl])

                                            }))}
                                            selected={selectedConversation?.data?.reasoningLevel ?? 'low'}
                                            onToggle={(reasonLevel: string) => {
                                                handleUpdateConversation(selectedConversation, {
                                                    key: 'data',
                                                    value: {...selectedConversation.data, reasoningLevel: reasonLevel as ReasoningLevels},
                                                })
                                            }}
                                        />
                                    </div>
                                }

                            </>

                        }

                    </div>

                </div>

            </div>

            {/* Save Actions Modal */}
            {showSaveActionsModal && (
                <SaveActionsModal
                    actions={addedActions}
                    onSave={(name, tags) => {
                        setShowSaveActionsModal(false);
                    }}
                    onCancel={() => setShowSaveActionsModal(false)}
                />
            )}
            
            {/* Load Action Set Modal */}
            {showLoadActionSetModal && (
                <LoadActionSetModal
                    onLoad={(actionSet) => {
                        setAddedActions(actionSet.actions);
                        setShowLoadActionSetModal(false);
                        //alert(`Loaded action set "${actionSet.name}" with ${actionSet.actions.length} actions`);
                    }}
                    onCancel={() => setShowLoadActionSetModal(false)}
                />
            )}
        </>
    );
};