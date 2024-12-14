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
import FlagsMap from "@/components/Promptbar/components/FlagsMap";
import { AssistantDefinition } from '@/types/assistant';
import { AstGroupTypeData } from '@/types/groups';
import React from 'react';
import { AttachedDocument } from '@/types/attacheddocument';
import { executeAssistantApiCall } from '@/services/assistantAPIService';
import { getOpsForUser } from '@/services/opsService';
import Checkbox from '@/components/ReusableComponents/CheckBox';
import ApiItem from '@/components/AssistantApi/ApiItem';


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
                                          translateY, blackoutBackground=true, additionalTemplates, autofillOn=false, embed=false, children}) => {
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
            if (featureFlags.artifacts) acc[x.key] = x.defaultValue;
        } else {
            acc[x.key] = x.defaultValue;
        }
        
        return acc;
    }, {});

    const apiOptionDefaults = apiOptionFlags.reduce((acc: { [key: string]: boolean }, x) => {
        if (x.key === 'IncludeApiInstr') {
            if (featureFlags.assistantAPIs) acc[x.key] = x.defaultValue;
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

    const initialSelectedApis = definition.data?.operations || [];

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
    const [availableApis, setAvailableApis] = useState<any[]>([]);
    const [selectedApis, setSelectedApis] = useState<any[]>(initialSelectedApis);
    const [apiResponse, setApiResponse] = useState<any>(null);

    const [apiInfo, setApiInfo] = useState<Array<{
        RequestType: string;
        URL: string;
        Parameters: Record<string, string>;
        Body: string | Record<string, any>;
        Headers: Record<string, string>;
        Auth: {
            type: string;
            token?: string;
            username?: string;
            password?: string;
        };
        Description: string;
    }>>(definition.data?.apiCapabilities || []);

    const handleTestAPI = async (api: any) => {
        // Clean up the auth object to remove empty values
        const cleanAuth = {
            type: api.Auth.type,
            ...(api.Auth.token && { token: api.Auth.token }),
            ...(api.Auth.username && { username: api.Auth.username }),
            ...(api.Auth.password && { password: api.Auth.password })
        };

        // Parse the body if it's a string
        let cleanBody = api.Body;
        if (typeof api.Body === 'string') {
            try {
                cleanBody = JSON.parse(api.Body);
            } catch {
                cleanBody = {};  // If parsing fails, use empty object
            }
        }

        // Create the request object with the correct structure
        const requestData = {
            RequestType: api.RequestType,
            URL: api.URL,
            Parameters: api.Parameters || {},
            Body: cleanBody,
            Headers: api.Headers || {},
            Auth: cleanAuth
        };

        const result = await executeAssistantApiCall(requestData);
        setApiResponse(result);
    };

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


    const [additionalGroupData, setAdditionalGroupData] = useState<any>({});

    useEffect(() => {
        const handleEvent = (event:any) => {
            const detail = event.detail;
            if (assistant.id === detail.astId) setAdditionalGroupData((prevData:any) => ({ ...prevData, ...detail.data }));
        };
        window.addEventListener('astGroupDataUpdate', handleEvent);


        getOpsForUser().then((ops) => {
            if(ops.success){
                setAvailableApis(ops.data);
            }
        });

        return () => {
            window.removeEventListener('astGroupDataUpdate', handleEvent);
        };
    }, []);

    // useEffect(() => {
    //     console.log("Assistant Modal", additionalGroupData);
    // }, [additionalGroupData]);

    const [uri, setUri] = useState<string|null>(definition.uri || null);

    const [showDataSourceSelector, setShowDataSourceSelector] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);

    const allDocumentsUploaded = (documentStates: { [key: string]: number }) => {
        return Object.values(documentStates).every(state => state === 100);
    };
    
    const prepAdditionalData = () => {
        if (!additionalGroupData || !additionalGroupData.groupTypeData) {
            return additionalGroupData;
        }
    
        // Prepare the transformed groupTypeData, if available
        const updatedGroupTypeData = Object.fromEntries(
            Object.entries(additionalGroupData.groupTypeData as AstGroupTypeData).map(([type, info]) => {
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
             ...additionalGroupData,
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

            if (ast.disclaimer) setDisclaimer(ast.disclaimer);
        }
    }

    const handleUpdateApiItem = (id: string, checked: boolean) => {
        const api = availableApis.find((api) => api.id === id);
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

        const tagsList = tags.split(",").map((x: string) => x.trim());
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

        newAssistant.data = {
            ...newAssistant.data,
            apiCapabilities: apiInfo,
            operations: selectedApis
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
                                    <div className="text-sm font-bold text-black dark:text-neutral-200 mt-2 mb-2">
                                        {t('Enabled API Capabilities')}
                                    </div>
                                    <div className="h-[400px] overflow-y-auto">
                                        {availableApis.length > 0 &&
                                          availableApis.map((api, index) => (
                                            <ApiItem
                                              selected={selectedApis.some((selectedApi) => selectedApi.id === api.id)}
                                              key={index}
                                              api={api}
                                              index={index}
                                              onChange={handleUpdateApiItem} />
                                          ))}
                                    </div>
                                    {Object.keys(apiOptions).length > 0 &&
                                      <>
                                          <div className="text-sm font-bold text-black dark:text-neutral-200 mt-2">
                                              {t('API Options')}
                                          </div>
                                          <FlagsMap id={`astAPIOptionFlags-${assistant.id}`}
                                                    flags={apiOptionFlags}
                                                    state={apiOptions}
                                                    flagChanged={(key, value) => {
                                                        if (!disableEdit) setAPIOptions({
                                                            ...apiOptions,
                                                            [key]: value,
                                                        });
                                                    }}
                                          />
                                      </>
                                    }
                                    {apiOptions.IncludeApiInstr && (
                                      <div className="mt-4">
                                          {apiInfo.map((api, index) => (
                                            <div key={index} className="mb-4 p-4 border border-gray-300 rounded">
                                                <select
                                                  className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                                  value={api.RequestType}
                                                  onChange={(e) => {
                                                      const newApiInfo = [...apiInfo];
                                                      newApiInfo[index].RequestType = e.target.value;
                                                      setApiInfo(newApiInfo);
                                                  }}
                                                  required
                                                >
                                                    <option value="">Select Request Type</option>
                                                    <option value="GET">GET</option>
                                                    <option value="POST">POST</option>
                                                    <option value="PUT">PUT</option>
                                                    <option value="DELETE">DELETE</option>
                                                    <option value="PATCH">PATCH</option>
                                                </select>
                                                <input
                                                  className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                                  placeholder="URL"
                                                  value={api.URL}
                                                  onChange={(e) => {
                                                      const newApiInfo = [...apiInfo];
                                                      newApiInfo[index].URL = e.target.value;
                                                      setApiInfo(newApiInfo);
                                                  }}
                                                  required
                                                />
                                                <div className="mt-2">
                                                    <label className="text-sm font-bold">Parameters:</label>
                                                    <button
                                                      className="ml-2 px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                                                      onClick={() => {
                                                          const newApiInfo = [...apiInfo];
                                                          newApiInfo[index].Parameters = {
                                                              ...newApiInfo[index].Parameters,
                                                              '': '',
                                                          };
                                                          setApiInfo(newApiInfo);
                                                      }}
                                                    >
                                                        Add Parameter
                                                    </button>
                                                    {Object.entries(api.Parameters).map(([key, value], paramIndex) => (
                                                      <div key={paramIndex} className="flex mt-1">
                                                          <input
                                                            className="w-1/2 mr-2 rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                                            placeholder="Key"
                                                            value={key}
                                                            onChange={(e) => {
                                                                const newApiInfo = [...apiInfo];
                                                                const newParams = { ...newApiInfo[index].Parameters };
                                                                delete newParams[key];
                                                                newParams[e.target.value] = value;
                                                                newApiInfo[index].Parameters = newParams;
                                                                setApiInfo(newApiInfo);
                                                            }}
                                                          />
                                                          <input
                                                            className="w-1/2 rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                                            placeholder="Value"
                                                            value={value}
                                                            onChange={(e) => {
                                                                const newApiInfo = [...apiInfo];
                                                                newApiInfo[index].Parameters[key] = e.target.value;
                                                                setApiInfo(newApiInfo);
                                                            }}
                                                          />
                                                          <button
                                                            className="ml-2 px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                                                            onClick={() => {
                                                                const newApiInfo = [...apiInfo];
                                                                const newParams = { ...newApiInfo[index].Parameters };
                                                                delete newParams[key];
                                                                newApiInfo[index].Parameters = newParams;
                                                                setApiInfo(newApiInfo);
                                                            }}
                                                          >
                                                              Remove
                                                          </button>
                                                      </div>
                                                    ))}
                                                </div>
                                                <div className="mt-2">
                                                    <label className="text-sm font-bold">Headers:</label>
                                                    <button
                                                      className="ml-2 px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                                                      onClick={() => {
                                                          const newApiInfo = [...apiInfo];
                                                          newApiInfo[index].Headers = {
                                                              ...newApiInfo[index].Headers,
                                                              '': '',
                                                          };
                                                          setApiInfo(newApiInfo);
                                                      }}
                                                    >
                                                        Add Header
                                                    </button>
                                                    {Object.entries(api.Headers).map(([key, value], headerIndex) => (
                                                      <div key={headerIndex} className="flex mt-1">
                                                          <input
                                                            className="w-1/2 mr-2 rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                                            placeholder="Key"
                                                            value={key}
                                                            onChange={(e) => {
                                                                const newApiInfo = [...apiInfo];
                                                                const newHeaders = { ...newApiInfo[index].Headers };
                                                                delete newHeaders[key];
                                                                newHeaders[e.target.value] = value;
                                                                newApiInfo[index].Headers = newHeaders;
                                                                setApiInfo(newApiInfo);
                                                            }}
                                                          />
                                                          <input
                                                            className="w-1/2 rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                                            placeholder="Value"
                                                            value={value}
                                                            onChange={(e) => {
                                                                const newApiInfo = [...apiInfo];
                                                                newApiInfo[index].Headers[key] = e.target.value;
                                                                setApiInfo(newApiInfo);
                                                            }}
                                                          />
                                                          <button
                                                            className="ml-2 px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                                                            onClick={() => {
                                                                const newApiInfo = [...apiInfo];
                                                                const newHeaders = { ...newApiInfo[index].Headers };
                                                                delete newHeaders[key];
                                                                newApiInfo[index].Headers = newHeaders;
                                                                setApiInfo(newApiInfo);
                                                            }}
                                                          >
                                                              Remove
                                                          </button>
                                                      </div>
                                                    ))}
                                                </div>
                                                <div className="mt-2">
                                                    <label className="text-sm font-bold">Body:</label>
                                                    <textarea
                                                      className="mt-1 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                                      placeholder="Request Body (JSON)"
                                                      value={typeof api.Body === 'object' ? JSON.stringify(api.Body, null, 2) : api.Body}
                                                      onChange={(e) => {
                                                          const newApiInfo = [...apiInfo];
                                                          try {
                                                              newApiInfo[index].Body = JSON.parse(e.target.value);
                                                          } catch {
                                                              newApiInfo[index].Body = e.target.value;
                                                          }
                                                          setApiInfo(newApiInfo);
                                                      }}
                                                      rows={4}
                                                    />
                                                    <button
                                                      className="mt-1 px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                                                      onClick={() => {
                                                          const newApiInfo = [...apiInfo];
                                                          try {
                                                              const bodyString = typeof newApiInfo[index].Body === 'string'
                                                                ? newApiInfo[index].Body
                                                                : JSON.stringify(newApiInfo[index].Body);
                                                              const formattedBody = JSON.parse(bodyString as string);
                                                              newApiInfo[index].Body = JSON.stringify(formattedBody, null, 2);
                                                          } catch (error) {
                                                              // If parsing fails, leave the body as is
                                                              console.error('Failed to parse or format JSON:', error);
                                                          }
                                                          setApiInfo(newApiInfo);
                                                      }}
                                                    >
                                                        Format JSON
                                                    </button>
                                                </div>
                                                <div className="mt-2">
                                                    <label className="text-sm font-bold">Authentication:</label>
                                                    <select
                                                      className="ml-2 rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                                      value={api.Auth.type}
                                                      onChange={(e) => {
                                                          const newApiInfo = [...apiInfo];
                                                          newApiInfo[index].Auth.type = e.target.value;
                                                          newApiInfo[index].Auth.token = '';
                                                          setApiInfo(newApiInfo);
                                                      }}
                                                    >
                                                        <option value="">None</option>
                                                        <option value="basic">Basic Auth</option>
                                                        <option value="bearer">Bearer Token</option>
                                                    </select>
                                                </div>
                                                {api.Auth.type === 'basic' && (
                                                  <div className="mt-2">
                                                      <input
                                                        className="mr-2 w-1/2 rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                                        placeholder="Username"
                                                        value={api.Auth.username || ''}
                                                        onChange={(e) => {
                                                            const newApiInfo = [...apiInfo];
                                                            newApiInfo[index].Auth.username = e.target.value;
                                                            setApiInfo(newApiInfo);
                                                        }}
                                                      />
                                                      <input
                                                        className="w-1/2 rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                                        type="password"
                                                        placeholder="Password"
                                                        value={api.Auth.password || ''}
                                                        onChange={(e) => {
                                                            const newApiInfo = [...apiInfo];
                                                            newApiInfo[index].Auth.password = e.target.value;
                                                            setApiInfo(newApiInfo);
                                                        }}
                                                      />
                                                  </div>
                                                )}
                                                {api.Auth.type === 'bearer' && (
                                                  <input
                                                    className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                                    placeholder="Bearer Token"
                                                    value={api.Auth.token}
                                                    onChange={(e) => {
                                                        const newApiInfo = [...apiInfo];
                                                        newApiInfo[index].Auth.token = e.target.value;
                                                        setApiInfo(newApiInfo);
                                                    }}
                                                  />
                                                )}
                                                <textarea
                                                  className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                                  placeholder="API Description (what it does and why it's used)"
                                                  value={api.Description || ''}
                                                  onChange={(e) => {
                                                      const newApiInfo = [...apiInfo];
                                                      newApiInfo[index].Description = e.target.value;
                                                      setApiInfo(newApiInfo);
                                                  }}
                                                  rows={3}
                                                  required
                                                />

                                                <button
                                                  className="mt-2 px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                                                  onClick={() => handleTestAPI(api)}
                                                >
                                                    Test API
                                                </button>
                                                {apiResponse && (
                                                  <div
                                                    className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-auto max-h-60">
                                                      <pre
                                                        className="text-sm text-gray-800 dark:text-gray-200">{JSON.stringify(apiResponse, null, 2)}</pre>
                                                  </div>
                                                )}
                                                <div></div>
                                                <button
                                                  className="mt-2 px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                                                  onClick={() => {
                                                      const newApiInfo = apiInfo.filter((_, i) => i !== index);
                                                      setApiInfo(newApiInfo);
                                                  }}
                                                >
                                                    Remove API
                                                </button>
                                            </div>
                                          ))}
                                          <button
                                            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                                            onClick={() => setApiInfo([...apiInfo, {
                                                RequestType: '',
                                                URL: '',
                                                Parameters: {},
                                                Body: {},
                                                Headers: {},
                                                Auth: { type: '', token: '', username: '', password: '' },
                                                Description: '',
                                            }])}
                                          >
                                              Add Additional API
                                          </button>
                                      </div>
                                    )}


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
