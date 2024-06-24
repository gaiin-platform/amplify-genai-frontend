import {FC, useRef, useState} from 'react';

import {useTranslation} from 'next-i18next';
import {Prompt} from '@/types/prompt';
import {COMMON_DISALLOWED_FILE_EXTENSIONS} from "@/utils/app/const";
import {FileList} from "@/components/Chat/FileList";
import {DataSourceSelector} from "@/components/DataSources/DataSourceSelector";
import {createAssistantPrompt, getAssistant} from "@/utils/app/assistants";
import {AttachFile} from "@/components/Chat/AttachFile";
import {IconFiles, IconCircleX} from "@tabler/icons-react";
import {createAssistant} from "@/services/assistantService";
import {LoadingDialog} from "@/components/Loader/LoadingDialog";
import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import FlagsMap from "@/components/Promptbar/components/FlagsMap";


interface Props {
    assistant: Prompt;
    onSave: () => void;
    onCancel: () => void;
    onUpdateAssistant: (prompt: Prompt) => void;
    loadingMessage: string;
    loc: string;

}

const dataSourceFlags = [
    {
        "label": "Include Attached Documents in RAG",
        "key": "ragAttachedDocuments",
        "defaultValue": false
    },
    {
        "label": "Include Attached Documents in Prompt",
        "key": "insertAttachedDocuments",
        "defaultValue": true
    },
    {
        "label": "Include Conversation Documents in RAG",
        "key": "ragConversationDocuments",
        "defaultValue": true
    },
    {
        "label": "Include Conversation Documents in Prompt",
        "key": "insertConversationDocuments",
        "defaultValue": false
    },
    {
        "label": "Include Attached Data Source Metadata in Prompt",
        "key": "insertAttachedDocumentsMetadata",
        "defaultValue": false
    },
    {
        "label": "Include Conversation Data Source Metadata in Prompt",
        "key": "insertConversationDocumentsMetadata",
        "defaultValue": false
    },
    {
        "label": "Disable Data Source Insertion",
        "key": "disableDataSources",
        "defaultValue": false
    }
];


export const AssistantModal: FC<Props> = ({assistant, onCancel, onSave, onUpdateAssistant, loadingMessage, loc}) => {
    const {t} = useTranslation('promptbar');

    let cTags = (assistant.data && assistant.data.conversationTags) ? assistant.data.conversationTags.join(",") : "";

    const definition = getAssistant(assistant);

    const initialDs = (definition.dataSources || []).map(ds => {
        return {
            ...ds,
            key: (ds.key || ds.id)
        }
    });

    const initialStates: { [key: string]: number } = initialDs.map(ds => {
        return {[ds.id]: 100}
    }).reduce((acc, x) => {
        acc = {...acc, ...x};
        return acc;
    }, {});

    const dataSourceOptionDefaults = dataSourceFlags.reduce((acc:{[key:string]:boolean}, x) => {
        acc[x.key] = x.defaultValue;
        return acc;
    }, {});

    const initialDataSourceOptionState = {
        ...dataSourceOptionDefaults,
        ...(definition.data && definition.data.dataSourceOptions || {})
    }

    const [isLoading, setIsLoading] = useState(false);
    const [name, setName] = useState(definition.name);
    const [description, setDescription] = useState(definition.description);
    const [content, setContent] = useState(definition.instructions);
    const [dataSources, setDataSources] = useState(initialDs);
    const [dataSourceOptions, setDataSourceOptions] = useState<{ [key: string]: boolean }>(initialDataSourceOptionState);
    const [conversationTags, setConversationTags] = useState(cTags);
    const [documentState, setDocumentState] = useState<{ [key: string]: number }>(initialStates);

    const [uri, setUri] = useState<string|null>(definition.uri || null);

    const [showDataSourceSelector, setShowDataSourceSelector] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);


    const handleUpdateAssistant = async () => {
        // Check if any data sources are still uploading
        const isUploading = Object.values(documentState).some((x) => x < 100);
        if (isUploading) {
            alert(t('Please wait for all data sources to finish uploading.'));
            return;
        }

        setIsLoading(true);

        let newAssistant = getAssistant(assistant);
        newAssistant.name = name;
        newAssistant.provider = "amplify";
        newAssistant.data = newAssistant.data || {provider: "amplify"};
        newAssistant.description = description;
        newAssistant.instructions = content;

        if(uri && uri.trim().length > 0){
            // Check that it is a valid uri
            if(uri.trim().indexOf("://") === -1){
                alert("Invalid URI, please update and try again.");
                setIsLoading(false);
                return;
            }

            newAssistant.uri = uri.trim();
        }

        newAssistant.dataSources = dataSources.map(ds => {
            if(ds.key || (ds.id && ds.id.indexOf("://") > 0)){
                return ds;
            }
            else {
                return {
                    ...ds,
                    id: "s3://"+ds.id
                }
            }
        });
        newAssistant.tools = newAssistant.tools || [];
        newAssistant.data.conversationTags = conversationTags ? conversationTags.split(",").map((x: string) => x.trim()) : [];
        
        //if we were able to get to this assistant modal (only comes up with + assistant and edit buttons)
        //then they must have had read/write access.
        newAssistant.data.access = {read: true, write: true};

        newAssistant.data.dataSourceOptions = dataSourceOptions;

        const {id, assistantId, provider} = await createAssistant(newAssistant, null);

        newAssistant.id = id;
        newAssistant.provider = provider;
        newAssistant.assistantId = assistantId;

        const aPrompt = createAssistantPrompt(newAssistant);


        onUpdateAssistant(aPrompt);

        setIsLoading(false);

        onSave();
    }

    if(isLoading){
        return <LoadingDialog open={isLoading} message={loadingMessage}/>
    }


    return (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
        >


            <div className="fixed inset-0 z-10 overflow-hidden">
                <div
                    className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                    <div
                        className="hidden sm:inline-block sm:h-screen sm:align-middle"
                        aria-hidden="true"
                    />

                    <div
                        className="dark:border-netural-400 inline-block overflow-hidden rounded-lg border border-gray-300 bg-white px-4 pt-5 text-left align-bottom shadow-xl transition-all dark:bg-[#202123] sm:my-8 sm:w-full sm:max-w-[770px] sm:align-middle"
                        ref={modalRef}
                        role="dialog"
                    >

                        <div className="max-h-[calc(100vh-10rem)] overflow-y-auto">
                            <div className="text-sm font-bold text-black dark:text-neutral-200">
                                {t('Assistant Name')}
                            </div>
                            <input
                                className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                placeholder={t('A name for your prompt.') || ''}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />

                            <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
                                {t('Description')}
                            </div>
                            <textarea
                                className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                style={{resize: 'none'}}
                                placeholder={t('A description for your prompt.') || ''}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                            />

                            <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
                                {t('Instructions')}
                            </div>
                            <textarea
                                className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                style={{resize: 'none'}}
                                placeholder={
                                    t(
                                        'Prompt content. Use {{}} to denote a variable. Ex: {{name}} is a {{adjective}} {{noun}}',
                                    ) || ''
                                }
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                rows={10}
                            />

                            <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
                                {t('Data Sources')}
                            </div>
                            <div className="flex flex-row items-center">
                                <button
                                    className="left-1 top-2 rounded-sm p-1 text-neutral-800 opacity-60 hover:bg-neutral-200 hover:text-neutral-900 dark:bg-opacity-50 dark:text-neutral-100 dark:hover:text-neutral-200"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setShowDataSourceSelector(!showDataSourceSelector);
                                    }}
                                    onKeyDown={(e) => {

                                    }}
                                >
                                    <IconFiles size={20}/>
                                </button>
                                <AttachFile id={"__attachFile_assistant_" + loc}
                                            disallowedFileExtensions={COMMON_DISALLOWED_FILE_EXTENSIONS}
                                            onAttach={(doc) => {
                                                setDataSources((prev) => {
                                                    prev.push(doc as any);
                                                    return prev;
                                                });
                                            }}
                                            onSetMetadata={(doc, metadata) => {
                                                setDataSources((prev)=>{
                                                    return prev.map(x => x.id === doc.id ? {
                                                        ...x,
                                                        metadata
                                                    } : x)
                                                });
                                            }}
                                            onSetKey={(doc, key) => {
                                                setDataSources((prev)=>{
                                                    return prev.map(x => x.id === doc.id ? {
                                                        ...x,
                                                        key
                                                    } : x)
                                                });
                                            }}
                                            onSetAbortController={() => {
                                            }}
                                            onUploadProgress={(doc, progress) => {
                                                setDocumentState((prev)=>{
                                                     prev[doc.id] = progress;
                                                     return prev;
                                                });
                                            }}
                                />
                            </div>
                            <FileList documents={dataSources} documentStates={documentState} setDocuments={(docs) => {
                                setDataSources(docs as any[]);
                            }}/>
                            {showDataSourceSelector && (
                                <div
                                    className="flex flex-col justify-center"
                                >
                                    <div className="flex flex-row justify-end">
                                        <button
                                            type="button"
                                            className="rounded-t-xl dark:text-white border-neutral-500 text-neutral-900 focus:outline-none dark:border-neutral-800 dark:bg-[#343541] dark:text-black"
                                            onClick={() => {
                                                setShowDataSourceSelector(false);
                                            }}
                                        >
                                            <IconCircleX/>
                                        </button>
                                    </div>
                                    <div className="rounded bg-white dark:bg-[#343541]">
                                        <DataSourceSelector
                                            minWidth="500px"
                                            onDataSourceSelected={(d) => {
                                                const doc = {
                                                    id: d.id,
                                                    name: d.name || "",
                                                    raw: null,
                                                    type: d.type || "",
                                                    data: "",
                                                    metadata: d.metadata,
                                                };
                                                setDataSources([...dataSources, doc as any]);
                                                setDocumentState({...documentState, [d.id]: 100});
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            <ExpansionComponent title={"Advanced"} content={
                                <div>
                                    <div className="text-sm font-bold text-black dark:text-neutral-200">
                                        {t('URI')}
                                    </div>
                                    <input
                                        className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                        placeholder={t('') || ''}
                                        value={uri || ""}
                                        onChange={(e) => setUri(e.target.value)}
                                    />
                                    <div className="text-sm font-bold text-black dark:text-neutral-200 mt-2">
                                        {t('Data Source Options')}
                                    </div>
                                    {/*// Documents in past messages*/}
                                    {/*// Documents attached to prompt*/}
                                    {/*// Assistant documents*/}
                                    <FlagsMap flags={dataSourceFlags}
                                              state={dataSourceOptions}
                                              flagChanged={
                                                    (key, value) => {
                                                        setDataSourceOptions({...dataSourceOptions, [key]: value});
                                                    }
                                              }/>
                                </div>
                            }/>
                        </div>
                        <div className="flex flex-row items-center justify-end p-4 bg-white dark:bg-[#202123]">
                            <button
                                type="button"
                                className="mr-2 w-full px-4 py-2 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                                onClick={() => {
                                    onCancel();
                                }}
                            >
                                {t('Cancel')}
                            </button>
                            <button
                                type="button"
                                className="w-full px-4 py-2 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                                onClick={() => {
                                    handleUpdateAssistant();
                                }}
                            >
                                {t('Save')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
