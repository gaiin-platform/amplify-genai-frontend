import {FC, useContext, ReactElement, useEffect, useRef, useState} from 'react';
import HomeContext from '@/pages/api/home/home.context';
import {useTranslation} from 'next-i18next';
import {Prompt} from '@/types/prompt';
import {COMMON_DISALLOWED_FILE_EXTENSIONS} from "@/utils/app/const";
import {ExistingFileList, FileList} from "@/components/Chat/FileList";
import {DataSourceSelector} from "@/components/DataSources/DataSourceSelector";
import {createAssistantPrompt, getAssistant, isAssistant} from "@/utils/app/assistants";
import {AttachFile} from "@/components/Chat/AttachFile";
import {IconFiles, IconCircleX, IconArrowRight} from "@tabler/icons-react";
import {createAssistant} from "@/services/assistantService";
import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import FlagsMap from "@/components/ReusableComponents/FlagsMap";
import { AssistantDefinition } from '@/types/assistant';
import { AstGroupTypeData } from '@/types/groups';
import React from 'react';
import { AttachedDocument } from '@/types/attacheddocument';
import { executeAssistantApiCall } from '@/services/assistantAPIService';
import { getOpsForUser } from '@/services/opsService';
import ApiItem from '@/components/AssistantApi/ApiItem';
import { getSettings } from '@/utils/app/settings';
import { API, APIComponent } from '@/components/CustomAPI/CustomAPIEditor';
import Search from '@/components/Search';


interface Props {
    assistant: Prompt;
    onSave: () => void;
    onCancel: () => void;
    onUpdateAssistant: (prompt: Prompt) => void;
    loadingMessage: string;
    loc: string;
    disableEdit?: boolean;
    title?: string;
    onCreateAssistant?: (astDef: AssistantDefinition) => Promise<{ id: string; assistantId: string; provider: string }>;
    width?: string;
    height?: string;
    translateY?: string;//
    blackoutBackground?:boolean;//
    additionalTemplates?:Prompt[];
    autofillOn?:boolean;
    embed?: boolean;
    children?: ReactElement;
    additionalGroupData?: any;
}

const dataSourceFlags = [
    {
        "label": "Include Download Links for Referenced Documents",
        "key": "includeDownloadLinks",
        "defaultValue": false
    },
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
    },
];

const messageOptionFlags = [
    {
        "label": "Include Message IDs in Messages",
        "key": "includeMessageIds",
        "defaultValue": false
    },
    {
        "label": "Insert Line Numbers in User Messages",
        "key": "includeUserLineNumbers",
        "defaultValue": false
    },
    {
        "label": "Insert Line Numbers in Assistant Messages",
        "key": "includeAssistantLineNumbers",
        "defaultValue": false
    },
];

const featureOptionFlags = [
    {
        "label": "Allow Assistant to Create Artifacts",
        "key": "IncludeArtifactsInstr",
        "defaultValue": true
    },
];

const apiOptionFlags = [
    {
        "label": "Allow Assistant to Use API Capabilities",
        "key": "IncludeApiInstr",
        "defaultValue": false
    },
];


export const AssistantModal: FC<Props> = ({assistant, onCancel, onSave, onUpdateAssistant, loadingMessage, loc, 
                                          disableEdit=false, title, onCreateAssistant,height, width = `${window.innerWidth * 0.6}px`,
                                          translateY, blackoutBackground=true, additionalTemplates, autofillOn=false, embed=false, additionalGroupData, children}) => {
    const {t} = useTranslation('promptbar');

    const { state: { prompts, featureFlags} , setLoadingMessage} = useContext(HomeContext);

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

    const messageOptionDefaults = messageOptionFlags.reduce((acc:{[key:string]:boolean}, x) => {
        acc[x.key] = x.defaultValue;
        return acc;
    }, {});

    const featureOptionDefaults = featureOptionFlags.reduce((acc:{[key:string]:boolean}, x) => {
        if (x.key === 'IncludeArtifactsInstr') {
            // check settings to see if they have it turned on or off 
            const settings = getSettings(featureFlags);
            if (featureFlags.artifacts && settings.featureOptions.includeArtifacts) acc[x.key] = x.defaultValue;
        } else {
            acc[x.key] = x.defaultValue;
        }
        
        return acc;
    }, {});

    const apiOptionDefaults = apiOptionFlags.reduce((acc: { [key: string]: boolean }, x) => {
        if (x.key === 'IncludeApiInstr') {
            if (featureFlags.assistantApis) acc[x.key] = x.defaultValue;
        } else {
            acc[x.key] = x.defaultValue;
        }

        return acc;
    }, {});

    const initialDataSourceOptionState = {
        ...dataSourceOptionDefaults,
        ...(definition.data && definition.data.dataSourceOptions || {})
    }
    const initialMessageOptionState = {
        ...messageOptionDefaults,
        ...(definition.data && definition.data.messageOptions || {})
    }

    const initialFeatureOptionState = {
        ...featureOptionDefaults,
        ...(definition.data && definition.data.featureOptions || {})
    }

    const initialAPIOptionState = {
        ...apiOptionDefaults,
        ...(definition.data && definition.data.apiOptions || {})
    }

    const initialSelectedApis = definition.data?.operations?.filter(
      (api:any) => api.type !== "http") || [];

    const initialApiCapabilities = definition.data?.operations?.filter(
      (api:any) => api.type === "http") || [];

    const preexistingDocumentIds = (definition.dataSources || []).map(ds => ds.id); 

    const [isLoading, setIsLoading] = useState(false);
    const [name, setName] = useState(definition.name);
    const [description, setDescription] = useState(definition.description);
    const [opsLanguageVersion, setOpsLanguageVersion] = useState(definition.data?.opsLanguageVersion || "v1");
    const [content, setContent] = useState(definition.instructions);
    const [disclaimer, setDisclaimer] = useState(definition.disclaimer ?? "");
    const [dataSources, setDataSources] = useState(initialDs);
    const [dataSourceOptions, setDataSourceOptions] = useState<{ [key: string]: boolean }>(initialDataSourceOptionState);
    const [documentState, setDocumentState] = useState<{ [key: string]: number }>(initialStates);
    const [messageOptions, setMessageOptions] = useState<{ [key: string]: boolean }>(initialMessageOptionState);
    const [featureOptions, setFeatureOptions] = useState<{ [key: string]: boolean }>(initialFeatureOptionState);
    const [apiOptions, setAPIOptions] = useState<{ [key: string]: boolean }>(initialAPIOptionState);
    const [availableApis, setAvailableApis] = useState<any[] | null>(null);
    const [apiSearchTerm, setApiSearchTerm] = useState<string>(''); 
    const [selectedApis, setSelectedApis] = useState<any[]>(initialSelectedApis);

    const [apiInfo, setApiInfo] = useState<API[]>(initialApiCapabilities || []);

    useEffect(() => {
        
        if (availableApis === null) getOpsForUser().then((ops) => {
                                            if(ops.success){
                                                // console.log(ops.data);
                                                setAvailableApis(ops.data);
                                            }
                                        });
    }, [availableApis]);
    

    const additionalGroupDataRef = useRef<any>({});

    useEffect(() => {
        additionalGroupDataRef.current = additionalGroupData;
        // console.log(additionalGroupData)
    }, [additionalGroupData]);

    const validateApiInfo = (api: any) => {
        return api.RequestType && api.URL && api.Description;
    };

    let cTags = (assistant.data && assistant.data.conversationTags) ? assistant.data.conversationTags.join(",") : "";
    const [tags, setTags] = useState((assistant.data && assistant.data.tags) ? assistant.data.tags.join(",") : "");
    const [conversationTags, setConversationTags] = useState(cTags);

   
    const getTemplates = () => {
        let templates = prompts.filter((p:Prompt) => isAssistant(p) && (!p.groupId));
        if (additionalTemplates) templates = [...templates, ...additionalTemplates];
        return templates.map((p:Prompt) => p.data?.assistant?.definition);
    }

    const [templates, setTemplates] =  useState<AssistantDefinition[]>(getTemplates());
    const [selectTemplateId, setSelectTemplateId] =  useState<any>("");


    const [uri, setUri] = useState<string|null>(definition.uri || null);

    const [showDataSourceSelector, setShowDataSourceSelector] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);

    const allDocumentsUploaded = (documentStates: { [key: string]: number }) => {
        return Object.values(documentStates).every(state => state === 100);
    };
    
    const prepAdditionalData = () => {
        if (!additionalGroupDataRef.current || !additionalGroupDataRef.current.groupTypeData) {
            return additionalGroupDataRef.current;
        }
    
        // Prepare the transformed groupTypeData, if available
        const updatedGroupTypeData = Object.fromEntries(
            Object.entries(additionalGroupDataRef.current.groupTypeData as AstGroupTypeData).map(([type, info]) => {
                // Update the dataSources with new id formatting
                const updatedDataSources = info.dataSources.map(ds => {
                            const prefix = "s3://";
                            if (ds.id.startsWith(prefix)) return ds;
                            return {
                                ...ds,
                                id: prefix + ds.key  // Transforming the id by prefixing with 's3://'
                            }
                        });
    
                // Omit documentState from the info when rebuilding the object
                const { documentState, ...rest } = info;
    
                return [type, {
                    ...rest,
                    dataSources: updatedDataSources
                }];
            })
        );
    
 
         // Create a new object for additionalGroupData that includes the transformed groupTypeData
         return {
             ...additionalGroupDataRef.current,
             groupTypeData: updatedGroupTypeData
         };
        
    }

    const handleTemplateChange = () => {
        if (!selectTemplateId) return;
        const ast = templates.find((p:AssistantDefinition) => p.id === selectTemplateId);
        if (ast) {
            setName(ast.name + " (Copy)")
            setDescription(ast.description);
            setContent(ast.instructions);
            setDataSources([...ast.dataSources.map(ds => {
                                return {
                                    ...ds,
                                    key: (ds.key || ds.id)
                                }
                            })
            ]);
            setDocumentState(ast.dataSources.map(ds => {
                                return {[ds.id]: 100}
                            }).reduce((acc, x) => {
                                acc = {...acc, ...x};
                                return acc;
                            }, {})
                        );
            if (ast.tags) setTags(ast.tags ? ast.tags.join(", "): '');
            if (ast.disclaimer) setDisclaimer(ast.disclaimer);
        }
    }

    const handleUpdateApiItem = (id: string, checked: boolean) => {
        const api = availableApis?.find((api) => api.id === id);
        if (!api) return;
        const newSelectedApis = checked ? [...selectedApis, api] : selectedApis.filter((api) => api.id !== id);
        setSelectedApis(newSelectedApis);
    }
   

    const handleUpdateAssistant = async () => {
        // Check if any data sources are still uploading
        const isUploading = Object.values(documentState).some((x) => x < 100);
        const isUploadingGroupDS = additionalGroupData && additionalGroupData.groupTypeData ? Object.entries(additionalGroupData.groupTypeData as AstGroupTypeData).some(([type, info]) => !allDocumentsUploaded(info.documentState)) : false;
        if (isUploading || isUploadingGroupDS) {
            alert(t('Please wait for all data sources to finish uploading.'));
            return;
        }


        setIsLoading(true);
        setLoadingMessage(loadingMessage);

        let newAssistant = getAssistant(assistant);
        newAssistant.name = name;
        newAssistant.provider = "amplify";
        newAssistant.data = newAssistant.data || {provider: "amplify"};
        newAssistant.description = description;
        newAssistant.instructions = content;
        newAssistant.disclaimer = disclaimer;

        // TODO handle for groupTypes too 
        if(uri && uri.trim().length > 0){
            // Check that it is a valid uri
            if(uri.trim().indexOf("://") === -1){
                alert("Invalid URI, please update and try again.");
                setIsLoading(false);
                setLoadingMessage("");

                return;
            }

            newAssistant.uri = uri.trim();
        }

        console.log(dataSources.map((d: any)=> d.name));

        newAssistant.dataSources = dataSources.map(ds => {
            if (assistant.groupId) {
                if (!ds.key) ds.key = ds.id;
                if (!ds.groupId) ds.groupId = assistant.groupId;
                return {
                ...ds,
                id: "s3://"+ds.key
                }
            }
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
        // do the same for 
        newAssistant.tools = selectedApis || [];
        const tagsList = tags ? tags.split(",").map((x: string) => x.trim()) : [];
        newAssistant.tags = tagsList
        newAssistant.data.tags = tagsList;
        newAssistant.data.conversationTags = conversationTags ? conversationTags.split(",").map((x: string) => x.trim()) : [];
        
        //if we were able to get to this assistant modal (only comes up with + assistant and edit buttons)
        //then they must have had read/write access.
        newAssistant.data.access = {read: true, write: true};

        newAssistant.data.dataSourceOptions = dataSourceOptions;

        newAssistant.data.messageOptions = messageOptions;

        newAssistant.data.featureOptions = featureOptions;

        newAssistant.data.opsLanguageVersion = opsLanguageVersion;

        console.log("apiInfo",apiInfo);
        console.log("selectedApis",selectedApis);

        const combinedOps = [
          ...selectedApis,
          ...(apiInfo.map((api) => {return {type:"http", ...api}}))
        ];

        newAssistant.data = {
            ...newAssistant.data,
            operations: combinedOps//selectedApis
        };

        if (apiOptions.IncludeApiInstr && apiInfo.some(api => !validateApiInfo(api))) {
            alert("Please fill out all required API fields (Request Type, URL, and Description) before saving.");
            setIsLoading(false);
            setLoadingMessage("");
            return;
        }

        if (assistant.groupId) newAssistant.data.groupId = assistant.groupId;
        
        const updatedAdditionalGroupData = prepAdditionalData();
        newAssistant.data = {...newAssistant.data, ...updatedAdditionalGroupData};
        
        const {id, assistantId, provider} = onCreateAssistant ? await onCreateAssistant(newAssistant) : await createAssistant(newAssistant, null);
        if (!id) {
            alert("Unable to save the assistant at this time, please try again later...");
            setIsLoading(false);
            setLoadingMessage("");

            return;
        }

        newAssistant.id = id;
        newAssistant.provider = provider;
        newAssistant.assistantId = assistantId;

        const aPrompt = createAssistantPrompt(newAssistant);


        onUpdateAssistant(aPrompt);

        setIsLoading(false);
        setLoadingMessage("");

        onSave();
    }

    if (isLoading) return <></>;
    

    const assistantModalContainer = () => {
        return ( <div
                        className={`text-black dark:text-neutral-200 inline-block overflow-hidden ${ blackoutBackground ? 'rounded-lg border border-gray-300 dark:border-neutral-600':""} bg-white px-4 pt-5 text-left align-bottom shadow-xl transition-all dark:bg-[#22232b] sm:my-8 sm:align-middle`}
                        ref={modalRef}
                        role="dialog"
                        style={{ transform: translateY ? `translateY(${translateY})` : '0' , width: width}}
                    >
                        <label className='w-full text-xl text-center items-center mb-2 flex justify-center'> {title} </label>  
                          
                        

                        <div className=" max-h-[calc(100vh-10rem)] overflow-y-auto"
                            style={{ height: height}}>
                            {children}


                            { autofillOn &&
                            <>
                            <div className="text-sm font-bold text-black dark:text-neutral-200">
                                {t('Auto-Populate From Existing Assistant')}
                            </div>
                            <div className="flex flex-row gap-2 ">
                                <select
                                    className="my-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 bg-neutral-100 dark:bg-[#40414F] dark:text-neutral-100 shadow-[0_2px_4px_rgba(0,0,0,0.1)] dark:shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
                                    value={selectTemplateId}
                                    onChange={(e) => setSelectTemplateId(e.target.value ?? '')}
                                    >
                                    <option key={-1} value={''}>
                                            {'None'}
                                    </option>  
                                    {templates.map((ast, index) => (
                                        <option key={index} value={ast.id}>
                                            {ast.name}
                                        </option>
                                        ))}
                                </select>
                                <button
                                className={`mt-2 px-1 h-[36px] rounded border border-neutral-900 dark:border-neutral-500 px-4 py-2 text-neutral-500 dark:text-neutral-300 dark:bg-[#40414F]
                                            ${selectTemplateId ? "cursor-pointer  hover:text-neutral-900 dark:hover:text-neutral-100"  : "cursor-not-allowed"}`}
                                disabled={!selectTemplateId}
                                onClick={() => handleTemplateChange()}
                                title={"Fill-In Template"}
                                >
                                    <IconArrowRight size={18} />
                                </button>
                            </div> </>}
                            <div className="mt-2 text-sm font-bold text-black dark:text-neutral-200">
                                {t('Assistant Name')}
                            </div>
                            <input
                                className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                placeholder={t('A name for your prompt.') || ''}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={disableEdit}
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
                                disabled={disableEdit}
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
                                rows={15}
                                disabled={disableEdit}
                            />

                            <div  title={`${disableEdit? "Appended": "Append a"} disclaimer message to the end of every assistant response.`} >
                                <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
                                    {t('Disclaimer to Append to Responses')}
                                </div>
                                <textarea
                                    className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                    style={{resize: 'none'}}
                                    placeholder={
                                        t(
                                            'Assistant disclaimer message.',
                                        ) || ''
                                    }
                                    value={disclaimer}
                                    onChange={(e) => setDisclaimer(e.target.value)}
                                    rows={2}
                                    disabled={disableEdit}
                                />
                            </div>

                            <div className="mt-6 mb-2 font-bold text-black dark:text-neutral-200">
                                {t('Upload Data Sources')}
                            </div>
                            {!disableEdit && <div className="flex flex-row items-center">
                                <button
                                    title='Add Files'
                                    className={`left-1 top-2 rounded-sm p-1 text-neutral-800 opacity-60 hover:bg-neutral-200 hover:text-neutral-900 dark:hover:text-neutral-200 dark:bg-opacity-50 dark:text-neutral-100 `}
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
                                            groupId={assistant.groupId}
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
                            </div>}
                            <FileList documents={dataSources.filter((ds:AttachedDocument) => !(preexistingDocumentIds.includes(ds.id)))} documentStates={documentState}
                                setDocuments={(docs) => {
                                const preexisting = dataSources.filter((ds:AttachedDocument) => (preexistingDocumentIds.includes(ds.id)));
                                setDataSources([...docs, ...preexisting ]as any[]);
                            }} allowRemoval={!disableEdit}/>
                            {showDataSourceSelector && (
                                <div className="mt-[-34px] flex flex-col justify-center overflow-hidden">
                                    <div className="relative top-[306px] left-1">
                                        <button
                                            type="button" style={{width: "100px"}}
                                            className="px-4 py-3 rounded-lg hover:text-gray-900 hover:bg-blue-100 bg-gray-100 w-full dark:hover:bg-gray-700 dark:hover:text-white bg-50 dark:bg-gray-800"
                                            onClick={() => {
                                                setShowDataSourceSelector(false);
                                            }}
                                        >
                                            Close
                                        </button>
                                    </div>
                                    <div className="rounded bg-white dark:bg-[#343541] mb-4">
                                        <DataSourceSelector
                                            minWidth="500px"
                                            height='310px'
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

                            { definition.dataSources.length > 0  &&
                                <ExistingFileList 
                                    label={'Assistant Data Sources'}
                                    allowRemoval={!disableEdit}
                                    documents={dataSources.filter((ds:AttachedDocument) => (preexistingDocumentIds.includes(ds.id)))} 
                                    setDocuments={(docs) => {
                                        const newDocs = dataSources.filter((ds:AttachedDocument) => !(preexistingDocumentIds.includes(ds.id)));
                                        setDataSources([...docs, ...newDocs] as any[]);
                                }} />
                            }
                            
                            <ExpansionComponent title={"Advanced"} content={
                                <div className="text-black dark:text-neutral-200">
                                    <div className="text-sm font-bold text-black dark:text-neutral-200">
                                        {t('URI')}
                                    </div>
                                    <input
                                      className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                      placeholder={t('') || ''}
                                      value={uri || ''}
                                      onChange={(e) => setUri(e.target.value)}
                                      disabled={disableEdit}
                                    />

                                    <div className="mt-4 text-sm font-bold text-black dark:text-neutral-200">
                                        Assistant Ops Language Version
                                    </div>
                                    <select
                                      className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                      value={opsLanguageVersion}
                                      onChange={(e) => setOpsLanguageVersion(e.target.value)}
                                    >
                                        <option value="v1">v1</option>
                                        <option value="v2">v2</option>
                                        <option value="v3">v3</option>
                                        <option value="custom">custom</option>
                                    </select>

                                    <div className="mt-4 text-sm font-bold text-black dark:text-neutral-200">
                                        {t('Assistant ID')}
                                    </div>
                                    <input
                                      className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                      value={definition.assistantId || ''}
                                      disabled={true}
                                    />

                                    <div className="text-sm font-bold text-black dark:text-neutral-200 mt-2">
                                        {t('Data Source Options')}
                                    </div>
                                    {/*// Documents in past messages*/}
                                    {/*// Documents attached to prompt*/}
                                    {/*// Assistant documents*/}
                                    <FlagsMap id={'dataSourceFlags'}
                                              flags={dataSourceFlags}
                                              state={dataSourceOptions}
                                              flagChanged={
                                                  (key, value) => {
                                                      if (!disableEdit) setDataSourceOptions({
                                                          ...dataSourceOptions,
                                                          [key]: value,
                                                      });
                                                  }
                                              } />
                                    <div className="text-sm font-bold text-black dark:text-neutral-200 mt-2">
                                        {t('Message Options')}
                                    </div>
                                    <FlagsMap id={'messageOptionFlags'}
                                              flags={messageOptionFlags}
                                              state={messageOptions}
                                              flagChanged={
                                                  (key, value) => {
                                                      if (!disableEdit) setMessageOptions({
                                                          ...messageOptions,
                                                          [key]: value,
                                                      });
                                                  }
                                              } />

                                    {Object.keys(featureOptions).length > 0 &&
                                      <>
                                          <div className="text-sm font-bold text-black dark:text-neutral-200 mt-2">
                                              {t('Feature Options')}
                                          </div>
                                          <FlagsMap id={'astFeatureOptionFlags'}
                                                    flags={featureOptionFlags}
                                                    state={featureOptions}
                                                    flagChanged={
                                                        (key, value) => {
                                                            if (!disableEdit) setFeatureOptions({
                                                                ...featureOptions,
                                                                [key]: value,
                                                            });
                                                        }
                                                    } />
                                      </>
                                    }
                                    <div className="mt-2 mb-6 text-sm text-black dark:text-neutral-200 overflow-y">
                                        <div className="text-sm font-bold text-black dark:text-neutral-200">
                                            {t('Tags')}
                                        </div>
                                        <input
                                          className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                          placeholder={t('Tag names separated by commas.') || ''}
                                          value={tags}
                                          title={'Tags for conversations created with this template.'}
                                          onChange={(e) => {
                                              setTags(e.target.value);
                                          }}
                                        />
                                    </div>

                                    <div className="mb-6 text-sm text-black dark:text-neutral-200 overflow-y">
                                        <div className="text-sm font-bold text-black dark:text-neutral-200">
                                            {t('Conversation Tags')}
                                        </div>
                                        <input
                                          className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                          placeholder={t('Tag names separated by commas.') || ''}
                                          value={conversationTags}
                                          title={'Tags for conversations created with this template.'}
                                          onChange={(e) => {
                                              setConversationTags(e.target.value);
                                          }}
                                        />
                                    </div>


                                    {!availableApis || availableApis.length > 0 &&
                                    <div className="flex flex-row text-sm font-bold text-black dark:text-neutral-200 mt-2 mb-2">
                                        {t('Enabled API Capabilities')}
                                        {availableApis && 
                                         <div className="h-0 ml-auto" style={{transform: 'translateY(-18px)'}}>
                                            <Search
                                            placeholder={'Search APIs...'}
                                            searchTerm={apiSearchTerm}
                                            onSearch={(searchTerm: string) => setApiSearchTerm(searchTerm.toLocaleLowerCase())}
                                            />
                                        </div>}
                                    </div>
                                    }

                                    {availableApis && availableApis.length > 0 ?
                                        <div className="max-h-[400px] overflow-y-auto">
                                            {availableApis.filter((api) => (apiSearchTerm ? 
                                                                   api.name.toLowerCase().includes(apiSearchTerm) : true))
                                                          .map((api, index) => (
                                                <ApiItem
                                                selected={selectedApis.some((selectedApi) => selectedApi.id === api.id)}
                                                key={index}
                                                api={api}
                                                index={index}
                                                onChange={handleUpdateApiItem} />
                                            ))}
                                        </div> : <>Loading...</>
                                    }


                                    <div className="text-sm font-bold text-black dark:text-neutral-200 mt-8 mb-1">
                                        {t('Custom API Capabilities')}
                                    </div>

                                    <APIComponent
                                      apiInfo={apiInfo}
                                      setApiInfo={setApiInfo}
                                    />


                                </div>
                            } />
                        </div>
              <div className="flex flex-row items-center justify-end p-4 bg-white dark:bg-[#22232b]">
                  <button
                    type="button"
                    className="mr-2 w-full px-4 py-2 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                    onClick={() => {
                        onCancel();
                                }}
                            >
                                {disableEdit ? "Close" : t('Cancel')}
                            </button>
                            {!disableEdit && <button
                                type="button"
                                className="w-full px-4 py-2 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                                onClick={() => {
                                    handleUpdateAssistant();
                                }}
                            >
                                {t('Save')}
                            </button>}
                            
                        </div>
                    </div>

        )

    }


    return ( embed ? assistantModalContainer() :
        <div
            className={`fixed inset-0 flex items-center justify-center ${blackoutBackground ?'bg-black bg-opacity-50 z-50': ""} `}
            >
            <div className="fixed inset-0 z-10 overflow-hidden">
                <div
                    className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                    <div
                        className="hidden sm:inline-block sm:h-screen sm:align-middle"
                        aria-hidden="true"/>
                        {assistantModalContainer()}
                    
                </div>
            </div>
        </div>
    );
};



