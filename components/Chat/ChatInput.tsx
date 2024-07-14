import {
    IconArrowDown,
    IconPlayerStop,
    IconAt,
    IconWand,
    IconFiles,
    IconSend,
} from '@tabler/icons-react';
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
import {Plugin} from '@/types/plugin';
import {Prompt} from '@/types/prompt';
import {AttachFile} from "@/components/Chat/AttachFile";
import {FileList} from "@/components/Chat/FileList";
import {AttachedDocument, AttachedDocumentMetadata} from "@/types/attacheddocument";
import {setAssistant as setAssistantInMessage} from "@/utils/app/assistants";
import HomeContext from '@/pages/api/home/home.context';
import {PromptList} from './PromptList';
import {VariableModal} from './VariableModal';
import {OpenAIModel} from "@/types/openai";
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
import FeaturePlugins from './FeaturePlugins';
import {optimizePrompt} from "@/services/promptOptimizerService";

interface Props {
    onSend: (message: Message, plugin: Plugin | null, documents: AttachedDocument[]) => void;
    onRegenerate: () => void;
    handleUpdateModel: (model: OpenAIModel) => void;
    onScrollDownClick: () => void;
    stopConversationRef: MutableRefObject<boolean>;
    textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
    showScrollDownButton: boolean;
}

export const ChatInput = ({
                              onSend,
                              onRegenerate,
                              onScrollDownClick,
                              stopConversationRef,
                              textareaRef,
                              handleUpdateModel,
                              showScrollDownButton,
                          }: Props) => {
    const {t} = useTranslation('chat');

    const {killRequest} = useChatService();

    const {
        state: {selectedConversation, selectedAssistant, messageIsStreaming, prompts, models, featureFlags, currentRequestId, chatEndpoint, statsService},

        dispatch: homeDispatch
    } = useContext(HomeContext);

    const promptsRef = useRef(prompts);

    useEffect(() => {
        promptsRef.current = prompts;
      }, [prompts]);

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
    const [isPromptOptimizerRunning, setIsPromptOptimizerRunning] = useState<boolean>(false);
    const [qiSummary, setQiSummary] = useState<QiSummary | null>(null)


    const [showDataSourceSelector, setShowDataSourceSelector] = useState(false);
    const [plugin, setPlugin] = useState<Plugin | null>(null);
    //const [assistant, setAssistant] = useState<Assistant>(selectedAssistant || DEFAULT_ASSISTANT);
    const [availableAssistants, setAvailableAssistants] = useState<Assistant[]>([DEFAULT_ASSISTANT]);
    const [showAssistantSelect, setShowAssistantSelect] = useState(false);
    const [documents, setDocuments] = useState<AttachedDocument[]>();
    const [documentState, setDocumentState] = useState<{ [key: string]: number }>({});
    const [documentMetadata, setDocumentMetadata] = useState<{ [key: string]: AttachedDocumentMetadata }>({});
    const [documentAborts, setDocumentAborts] = useState<{ [key: string]: AbortController }>({});

    const promptListRef = useRef<HTMLUListElement | null>(null);
    const dataSourceSelectorRef = useRef<HTMLDivElement | null>(null);
    const assistantSelectorRef = useRef<HTMLDivElement | null>(null);

    const [isWorkflowOn, setWorkflowOn] = useState(false);

    const extractDocumentsLocally = featureFlags.extractDocumentsLocally;

    const filteredPrompts =  promptsRef.current.filter((prompt:Prompt) =>
        prompt.name.toLowerCase().includes(promptInputValue.toLowerCase()),
    );

    const handleShowAssistantSelector = () => {
        setShowAssistantSelect(!showAssistantSelect);
    };

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
    homeDispatch({field: 'selectedAssistant', value: assistant});
    setShowAssistantSelect(false);

    if (selectedConversation) {
        const tags = assistant.definition.data?.conversationTags || [];
        if (tags) {
            selectedConversation.tags = selectedConversation.tags ?
                                    [...selectedConversation.tags, ...tags] :
                                    [...tags];
        }
        //remove duplicates if any
        selectedConversation.tags = Array.from(new Set(selectedConversation.tags));

        let assistantPrompt: Prompt | undefined = undefined;
        // Assistant creator is treated differently in the backend, so we need to treat it differently here
        // User defined assistants are retrieved and applied to the conversation in the back end as a UserDefinedAssistant whereas assistant creator is not user defined per say
        // when you click on assistant creator on the right hand side, it triggers handleStartConversationWithPrompt in utils/app/prompts.ts
        // where it creates a new conversation with the root prompt being the assistant creator. This is what is missing here.
        
        if (assistant.id === 'ast/assistant-builder') {
            assistantPrompt =  promptsRef.current.find((prompt:Prompt) => prompt.id === assistant.id);
            selectedConversation.prompt += "\n\nCURRENT ASSISTANT CREATOR CUSTOM INSTRUCTIONS: " + assistantPrompt?.content + "Address only the Current Assistant Creator custom Instructions.";
        } else {  
            assistantPrompt =  promptsRef.current.find((prompt:Prompt) => prompt?.data?.assistant?.definition.assistantId === assistant.definition.assistantId);
        }      
         //I do not get the impression that promptTemplates are currently used nonetheless the bases are covered in case they ever come into play (as taken into account in handleStartConversationWithPrompt)
        selectedConversation.promptTemplate = assistantPrompt ?? null;
        
    } 
    
}

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        const maxLength = selectedConversation?.model.maxLength;

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

        if (messageIsStreaming) {
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

        const maxLength = selectedConversation?.model.maxLength;

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
        let msg = newMessage({role: 'user', content: content, type: type});

        msg = setAssistantInMessage(msg, selectedAssistant || DEFAULT_ASSISTANT);

        if (documents && documents?.length > 0) {

            if (!isWorkflowOn) {

                msg.content = extractDocumentsLocally ?
                    handleAppendDocumentsToContent(content, documents) : content;

                const maxLength = selectedConversation?.model.maxLength;

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

        onSend(msg, plugin, updatedDocuments || []);
        setContent('');
        setPlugin(null);
        setDocuments([]);
        setDocumentState({});
        setDocumentMetadata({});

        if (window.innerWidth < 640 && textareaRef && textareaRef.current) {
            textareaRef.current.blur();
        }
    };

    const handleStopConversation = () => {
        stopConversationRef.current = true;

        if (currentRequestId) {
            killRequest(currentRequestId);
        }

        setTimeout(() => {
            stopConversationRef.current = false;

            homeDispatch({field: 'loading', value: false});
            homeDispatch({field: 'messageIsStreaming', value: false});
            homeDispatch({field: 'status', value: []});
        }, 1000);
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
        } else if (e.key === 'Enter' && !isTyping && !isMobile() && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        } 
        // else if (e.key === '/' && e.metaKey) {
        //     e.preventDefault();
        //     setShowPluginSelect(!showPluginSelect);
        // }
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
            if (
                promptListRef.current &&
                !promptListRef.current.contains(e.target as Node)
            ) {
                setShowPromptList(false);
            }


            if (dataSourceSelectorRef.current && !dataSourceSelectorRef.current.contains(e.target as Node)) {
                setShowDataSourceSelector(false);
            }
           
            if (assistantSelectorRef.current && !assistantSelectorRef.current.contains(e.target as Node)) {
                setShowAssistantSelect(false);
            }
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
        const summary = await createQiSummary(chatEndpoint || '', conversation, QiSummaryType.CONVERSATION, statsService);
        setQiSummary(summary);
        setIsQiLoading(false); 
    }

    useEffect(() => {
        if (plugin)  homeDispatch({field: 'selectedAssistant', value: DEFAULT_ASSISTANT});
      }, [plugin]);

      useEffect(() => {
        if (selectedAssistant !== DEFAULT_ASSISTANT) setPlugin(null);
      }, [selectedAssistant]);

      

    return (
        <>
        { featureFlags.pluginsOnInput &&
            <div className='relative z-20'>
                <FeaturePlugins
                plugin={plugin}
                setPlugin={setPlugin}
                />
            </div>
            }
        <div
            className="absolute bottom-0 left-0 w-full border-transparent bg-gradient-to-b from-transparent via-white to-white pt-6 dark:border-white/20 dark:via-[#343541] dark:to-[#343541] md:pt-2 z-15">
            
            
            <div
                className="flex flex-col justify-center items-center stretch mx-2 mt-4 flex flex-row gap-3 last:mb-2 md:mx-4 md:mt-[52px] md:last:mb-6 lg:mx-auto lg:max-w-3xl">
               
               {!showScrollDownButton && !messageIsStreaming && featureFlags.qiSummary && !showDataSourceSelector &&
               (selectedConversation && selectedConversation.messages.length > 0) &&  (
               <div className="fixed flex flex-row absolute top-0 group prose dark:prose-invert  hover:text-neutral-900 dark:hover:text-neutral-100">
                <button
                    className="mt-5 cursor-pointer border border-gray-300 dark:border-gray-600 rounded px-2 py-1"
                    style={{ fontSize: '0.9rem' }} 
                    onClick={async () => {
                        // setShowPromptList(false);
                        if (selectedConversation && selectedConversation.messages.length > 2) {
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


                    {messageIsStreaming && (
                        <>
                            <button
                                className="mb-3 flex w-fit items-center gap-3 rounded border border-neutral-200 bg-white py-2 px-4 text-black hover:opacity-50 dark:border-neutral-600 dark:bg-[#343541] dark:text-white md:mb-0 md:mt-2"
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

                <div
                    className="relative mx-2 flex w-full flex-grow flex-col rounded-md border border-black/10 bg-white shadow-[0_0_10px_rgba(0,0,0,0.10)] dark:border-gray-900/50 dark:bg-[#40414F] dark:text-white dark:shadow-[0_0_15px_rgba(0,0,0,0.10)] sm:mx-4">

                    <div className="flex flex-row items-center">
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

                        <FileList documents={documents}
                                  documentStates={documentState}
                                  onCancelUpload={onCancelUpload}
                                  setDocuments={setDocuments}/>
                    </div>

                    <div className="flex items-center">

                        {featureFlags.dataSourceSelectorOnInput && (
                            <button
                                className="left-1 top-2 rounded-sm p-1 text-neutral-800 opacity-60 hover:bg-neutral-200 hover:text-neutral-900 dark:bg-opacity-50 dark:text-neutral-100 dark:hover:text-neutral-200"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowDataSourceSelector(!showDataSourceSelector);
                                    setShowAssistantSelect(false);

                                }}
                                onKeyDown={(e) => {
                                }}
                                title="Files"
                            >
                                <IconFiles size={20}/>
                            </button>
                        )}


                        {/*<button*/}
                        {/*    className="left-1 top-2 rounded-sm p-1 text-neutral-800 opacity-60 hover:bg-neutral-200 hover:text-neutral-900 dark:bg-opacity-50 dark:text-neutral-100 dark:hover:text-neutral-200"*/}
                        {/*    onClick={() => setShowAssistantSelect(!showAssistantSelect)}*/}
                        {/*    onKeyDown={(e) => {*/}
                        {/*    }}*/}
                        {/*>*/}
                        {/*    <IconRobot size={20}/>*/}
                        {/*</button>*/}

                        <AttachFile id="__attachFile"
                                    disallowedFileExtensions={COMMON_DISALLOWED_FILE_EXTENSIONS}
                                    onAttach={addDocument}
                                    onSetMetadata={handleSetMetadata}
                                    onSetKey={handleSetKey}
                                    onSetAbortController={handleDocumentAbortController}
                                    onUploadProgress={handleDocumentState}
                        />

                        {featureFlags.assistants && (
                            <button
                                className={buttonClasses}
                                onClick={ () => {
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
                        )}

                        {featureFlags.promptOptimizer && (
                            <>
                                {isPromptOptimizerRunning && (
                                    <LoadingDialog open={isPromptOptimizerRunning} message={"Optimizing Prompt..."}/>
                                )}
                            <button
                                className={buttonClasses}
                                onClick={ () => {

                                    const value = textareaRef.current?.value;
                                    if(value) {
                                        setIsPromptOptimizerRunning(true);
                                        const optimizeIt = async () => {
                                            try {
                                                if(textareaRef.current) {
                                                    console.log("Calling prompt optimizer...");
                                                    const result = await optimizePrompt(value);
                                                    console.log("Optimization result: ", result);
                                                    setContent(result.data.prompt_template);
                                                    textareaRef.current.focus();
                                                }


                                            } catch (e) {
                                                console.log(e);
                                                alert("Error optimizing prompt. Please try again.")
                                            }
                                            finally {
                                                setIsPromptOptimizerRunning(false);
                                            }
                                        };

                                        optimizeIt();

                                    }
                                }
                                }
                                onKeyDown={(e) => {

                                }}
                                title="Optimize Prompt"

                            >
                                <IconWand size={20}/>
                            </button>
                            </>
                        )}

                        {showAssistantSelect && (
                            <div className="absolute left-0 bottom-14 rounded bg-white dark:bg-[#343541]">
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

                        {showDataSourceSelector && (
                            <div ref={dataSourceSelectorRef} className="absolute left-0 bottom-16 mb-6 rounded bg-white dark:bg-[#343541]">
                                <DataSourceSelector
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
                                />
                            </div>
                        )}

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

                        <textarea
                            ref={textareaRef}
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
                            className="right-2 top-2 rounded-sm p-1 text-neutral-800 opacity-60 hover:bg-neutral-200 hover:text-neutral-900 dark:bg-opacity-50 dark:text-neutral-100 dark:hover:text-neutral-200"
                            onClick={handleSend}
                            title="Send Prompt"
                        >
                            {messageIsStreaming ? (
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
                            models={models}
                            handleUpdateModel={handleUpdateModel}
                            prompt={filteredPrompts[activePromptIndex]}
                            variables={variables}
                            onSubmit={handleSubmit}
                            onClose={() => setIsModalVisible(false)}
                        />
                    )}
                </div>
            </div>

        </div>
        </>
    );
};
