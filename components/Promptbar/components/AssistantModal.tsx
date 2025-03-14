import {FC, useContext, ReactElement, useEffect, useRef, useState} from 'react';
import HomeContext from '@/pages/api/home/home.context';
import {useTranslation} from 'next-i18next';
import {Prompt} from '@/types/prompt';
import {COMMON_DISALLOWED_FILE_EXTENSIONS} from "@/utils/app/const";
import {ExistingFileList, FileList} from "@/components/Chat/FileList";
import {DataSourceSelector} from "@/components/DataSources/DataSourceSelector";
import {createAssistantPrompt, getAssistant, isAssistant} from "@/utils/app/assistants";
import {AttachFile} from "@/components/Chat/AttachFile";
import {IconFiles, IconCircleX, IconArrowRight, IconTags, IconMessage, IconLoader2, IconCheck, IconAlertTriangle} from "@tabler/icons-react";
import {createAssistant, lookupAssistant, addAssistantPath} from "@/services/assistantService";
import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import FlagsMap from "@/components/ReusableComponents/FlagsMap";
import { AssistantDefinition, AssistantProviderID } from '@/types/assistant';
import { AstGroupTypeData } from '@/types/groups';
import React from 'react';
import { AttachedDocument } from '@/types/attacheddocument';
import { getOpsForUser } from '@/services/opsService';
import ApiItem from '@/components/AssistantApi/ApiItem';
import { getSettings } from '@/utils/app/settings';
import { API, APIComponent } from '@/components/CustomAPI/CustomAPIEditor';
import Search from '@/components/Search';
import { filterSupportedIntegrationOps } from '@/utils/app/ops';
import { opLanguageOptionsMap } from '@/types/op';
import { opsSearchToggleButtons } from '@/components/Admin/AdminComponents/Ops';
import toast from 'react-hot-toast';
import AssistantPathEditor from './AssistantPathEditor';

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
        "defaultValue": false,
        "description": "Assistant can include hyperlinks to relevant downloadable documents in its responses."
    },
    {
        "label": "Include Attached Documents in RAG",
        "key": "ragAttachedDocuments",
        "defaultValue": false,
        "description": "Allows Retrieval-Augmented Generation (RAG) to be performed on user-attached documents. Only the most relevant portions of the document will be provided to the assistant."
    },
    {
        "label": "Include Attached Documents in Prompt",
        "key": "insertAttachedDocuments",
        "defaultValue": true,
        "description": "The assistant will receive the full content of user-attached documents for comprehensive context. (Recommended)"

    },
    {
        "label": "Include Conversation Documents in RAG",
        "key": "ragConversationDocuments",
        "defaultValue": true,
        "description": "Applies Retrieval-Augmented Generation (RAG) to documents from earlier in the conversation. Only the most relevant portions will be provided to the assistant. (Recommended)"
    },
    {
        "label": "Include Conversation Documents in Prompt",
        "key": "insertConversationDocuments",
        "defaultValue": false,
        "description": "The assistant receives the full content of documents from earlier in the conversation for comprehensive context."
    },
    {
        "label": "Include Attached Data Source Metadata in Prompt",
        "key": "insertAttachedDocumentsMetadata",
        "defaultValue": false,
        "description": "Provides the assistant with metadata, including ID, name, type, and properties of currently attached documents for reference purposes. (NOT Recommended)"
    },
    {
        "label": "Include Conversation Data Source Metadata in Prompt",
        "key": "insertConversationDocumentsMetadata",
        "defaultValue": false,
        "description": "Provides the assistant with metadata, including ID, name, type, and properties of documents from earlier in the conversation for reference purposes. (NOT Recommended)"
    },
    {
        "label": "Disable Data Source Insertion",
        "key": "disableDataSources",
        "defaultValue": false,
        "description": "Ignores all user-provided documents, preventing their content from being seen by the assistant. (NOT Recommended)"

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

    const { state: { prompts, featureFlags }, setLoadingMessage} = useContext(HomeContext);

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
    const [opSearchBy, setOpSearchBy] = useState<"name" | 'tag'>('tag'); 
    const [apiInfo, setApiInfo] = useState<API[]>(initialApiCapabilities || []);

    // Path-related state
    const [astPath, setAstPath] = useState<string|null>(definition.astPath || null);
    const [isSaving, setIsSaving] = useState(false);
    const [astPathSaved, setAstPathSaved] = useState(false);
    const [isPathAvailable, setIsPathAvailable] = useState(false);

    useEffect(() => {
        const filterOps = async (data: any[]) => {
            const filteredOps = await filterSupportedIntegrationOps(data);
            if (filteredOps) setAvailableApis(filteredOps);
        }
        
        if (featureFlags.integrations && availableApis === null) getOpsForUser().then((ops) => {
                                            if(ops.success){
                                                // console.log("ops: ", ops.data);
                                                filterOps(ops.data);
                                                
                                            } else {
                                                setAvailableApis([]);
                                            }
                                        });
    }, [availableApis]);

    const additionalGroupDataRef = useRef<any>({});

    useEffect(() => {
        additionalGroupDataRef.current = additionalGroupData;
    }, [additionalGroupData]);

    // Initialize form with existing assistant data
    useEffect(() => {
        if (!assistant) return;
        if (!isAssistant(assistant)) return;
        const definition = getAssistant(assistant);
        
        // Log the full assistant definition to help debug path issues
        console.log('Loading assistant for edit:', {
            assistantId: definition.assistantId,
            name: definition.name,
            astPath: definition.astPath,
            pathFromDefinition: definition.pathFromDefinition,
            data: definition.data,
            completeDefinition: definition
        });
        
        // Initialize basic form fields
        setName(definition.name);
        setDescription(definition.description);
        setContent(definition.instructions);
        setDisclaimer(definition.disclaimer || "");
        
        // Format data sources properly to avoid type issues
        if (definition.dataSources) {
            const formattedDataSources = definition.dataSources.map(ds => ({
                key: ds.key || ds.id || '',  // Ensure key is always a string
                id: ds.id || '',
                name: ds.name || '',
                raw: ds.raw || null,
                type: ds.type || '',
                data: ds.data || null,
                metadata: ds.metadata,
                groupId: ds.groupId
            }));
            setDataSources(formattedDataSources);
        } else {
            setDataSources([]);
        }
        
        // Handle tags array properly
        if (definition.tags) {
            // Convert to string if it's an array
            if (Array.isArray(definition.tags)) {
                setTags(definition.tags.join(','));
            } else {
                setTags(definition.tags);
            }
        } else {
            setTags('');
        }
        
        // Initialize path-related state based on feature flag
        if (featureFlags?.assistantPathPublishing) {
            // Debug logging for path-related information
            console.log('DEBUG - Assistant path info:', {
                astPath: definition.astPath,
                dataAstPath: definition.data?.astPath,
                pathFromDefinition: definition.pathFromDefinition,
            });
            
            // Determine which path value to use (in priority order)
            if (definition.astPath) {
                setAstPath(definition.astPath);
                setIsPathAvailable(true);
                setAstPathSaved(true); // Mark as already saved
            } 
            else if (definition.data?.astPath) {
                console.log(`DEBUG - Using path from data object: ${definition.data.astPath}`);
                setAstPath(definition.data.astPath);
                setIsPathAvailable(true);
                setAstPathSaved(true);
            }
            else if (definition.pathFromDefinition) {
                console.log(`DEBUG - Using pathFromDefinition ${definition.pathFromDefinition} since astPath is not available`);
                setAstPath(definition.pathFromDefinition);
                setIsPathAvailable(true);
                setAstPathSaved(true);
            }
        } else {
            // If feature flag is disabled, ensure path-related state is reset
            setAstPath(null);
            setIsPathAvailable(false);
            setAstPathSaved(false);
        }

        // Handle options/flags
        const newFlags = { 
            ...dataSourceOptionDefaults, 
            ...dataSourceOptions, 
            ...messageOptionDefaults, 
            ...messageOptions, 
            ...featureOptionDefaults, 
            ...featureOptions, 
            ...apiOptionDefaults, 
            ...apiOptions 
        };
        
        if (definition.options) {
            Object.entries(definition.options).forEach(([key, value]) => {
                newFlags[key] = value;
            });
            
            // Update all options states
            setDataSourceOptions((prevOptions: { [key: string]: boolean }) => ({ ...prevOptions, ...newFlags }));
            setMessageOptions((prevOptions: { [key: string]: boolean }) => ({ ...prevOptions, ...newFlags }));
            setFeatureOptions((prevOptions: { [key: string]: boolean }) => ({ ...prevOptions, ...newFlags }));
            setAPIOptions((prevOptions: { [key: string]: boolean }) => ({ ...prevOptions, ...newFlags }));
        }
        
    }, [assistant, featureFlags?.assistantPathPublishing]);

    const validateApiInfo = (api: any) => {
        return api.RequestType && api.URL && api.Description;
    };

    // Handle path validation callback from the AssistantPathEditor
    const handlePathValidated = (isValid: boolean, path: string | null, error: string | null) => {
        setIsPathAvailable(isValid);
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
                            ds.groupId = assistant.groupId;
                            if (!ds.key) ds.key = ds.id;
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
            setSelectedApis(ast.tools ?? []);
            if (ast.tags) setTags(ast.tags.join(", "));
            if (ast.disclaimer) setDisclaimer(ast.disclaimer);
            if (ast.data) {
                const data = ast.data;
                if (data.conversationTags) setConversationTags(data.conversationTags.join(", "));
                setDataSourceOptions(data.dataSourceOptions);
                setMessageOptions(data.messageOptions);
                setFeatureOptions(data.featureOptions);
                setOpsLanguageVersion(data.opsLanguageVersion);
                if (data.operations) setApiInfo(data.operations.filter( (api:any) => api.type === "http") || []);
            }
            
        }
    }

    const handleUpdateApiItem = (id: string, checked: boolean) => {
        const api = availableApis?.find((api) => api.id === id);
        if (!api) return;
        const newSelectedApis = checked ? [...selectedApis, api] : selectedApis.filter((api) => api.id !== id);
        setSelectedApis(newSelectedApis);
    }
   

    const handleUpdateAssistant = async () => {
        if(!name){
            alert("Must provide a name.");
            return;
        }

        // Check if any data sources are still uploading
        const isUploading = Object.values(documentState).some((x) => x < 100);
        const isUploadingGroupDS = additionalGroupData && additionalGroupData.groupTypeData ? Object.entries(additionalGroupData.groupTypeData as AstGroupTypeData).some(([type, info]) => !allDocumentsUploaded(info.documentState)) : false;
        if (isUploading || isUploadingGroupDS) {
            alert(t('Please wait for all data sources to finish uploading.'));
            return;
        }

        setIsLoading(true);
        setLoadingMessage(loadingMessage);

        try {
            let newAssistant = getAssistant(assistant);
            newAssistant.name = name;
            newAssistant.provider = AssistantProviderID.AMPLIFY;
            newAssistant.data = newAssistant.data || {provider: AssistantProviderID.AMPLIFY};
            newAssistant.description = description;
            newAssistant.instructions = content;
            newAssistant.disclaimer = disclaimer;

            // Handle path if feature flag is enabled
            if (astPath && featureFlags?.assistantPathPublishing) {
                // Set the lowercase version of the path
                const formattedPath = astPath.toLowerCase();
                
                // Set path at both the top level and in the data object
                newAssistant.astPath = formattedPath;
                
                // Also ensure it's in the data object
                if (!newAssistant.data) {
                    newAssistant.data = {};
                }
                newAssistant.data.astPath = formattedPath;
                
                console.log(`Setting assistant path to "${formattedPath}" in both top level and data object`);
            } else if (!featureFlags?.assistantPathPublishing) {
                // If feature flag is disabled, ensure astPath is not set
                if (newAssistant.astPath) {
                    console.log(`Feature flag disabled, removing existing path "${newAssistant.astPath}" from definition`);
                    delete newAssistant.astPath;
                }
                
                // Also remove from data object if it exists
                if (newAssistant.data && newAssistant.data.astPath) {
                    delete newAssistant.data.astPath;
                }
            }
            
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

        // console.log(dataSources.map((d: any)=> d.name));

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
            
            // Handle tags whether it's a string or array
            const tagsList = Array.isArray(tags) 
                ? tags 
                : (tags ? tags.split(",").map((x: string) => x.trim()) : []);
            
            newAssistant.tags = tagsList;
            newAssistant.data.tags = tagsList;
            
            // Handle conversationTags in the same way
            newAssistant.data.conversationTags = Array.isArray(conversationTags)
                ? conversationTags
                : (conversationTags ? conversationTags.split(",").map((x: string) => x.trim()) : []);
            
            //if we were able to get to this assistant modal (only comes up with + assistant and edit buttons)
            //then they must have had read/write access.
            newAssistant.data.access = {read: true, write: true};

            newAssistant.data.dataSourceOptions = dataSourceOptions;

            newAssistant.data.messageOptions = messageOptions;

            newAssistant.data.featureOptions = featureOptions;

            newAssistant.data.opsLanguageVersion = opsLanguageVersion;

        // console.log("apiInfo",apiInfo);
        // console.log("selectedApis",selectedApis);

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
            console.log('Assistant created with ID:', assistantId);
            
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

            // If we have an assistantId and astPath, update the path in DynamoDB (but only if feature flag is enabled)
            if (assistantId && astPath && featureFlags?.assistantPathPublishing) {
                try {
                    const formattedPath = astPath.toLowerCase();
                    console.log(`Attempting to save path "${formattedPath}" for assistant "${assistantId}" (ID type: ${typeof assistantId})`);
                    setIsSaving(true);

                    // Make sure the assistantId is a valid string
                    if (!assistantId || typeof assistantId !== 'string' || assistantId.trim() === '') {
                        throw new Error('Invalid assistant ID');
                    }

                    // Make sure the path is a valid string
                    if (!formattedPath || typeof formattedPath !== 'string' || formattedPath.trim() === '') {
                        throw new Error('Invalid path');
                    }

                    const pathResult = await addAssistantPath(assistantId, formattedPath);
                    console.log('Path saving result:', pathResult);

                    if (pathResult.success) {
                        setAstPathSaved(true);
                        
                        // Update the newAssistant definition with the path
                        newAssistant.astPath = formattedPath;
                        
                        // Also ensure it's in the data object
                        if (!newAssistant.data) {
                            newAssistant.data = {};
                        }
                        newAssistant.data.astPath = formattedPath;
                        
                        // Create a new prompt with the updated assistant definition
                        const updatedPrompt = createAssistantPrompt(newAssistant);
                        
                        // Update the assistant in the UI
                        onUpdateAssistant(updatedPrompt);
                        
                        toast(`Assistant successfully published at: ${formattedPath}`);
                    } else {
                        setAstPathSaved(false);
                        console.error('Failed to save path:', pathResult);
                        alert(`Error saving path: ${pathResult.message || 'Failed to save assistant path. Please try again.'}`);
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error('Exception when saving path:', errorMessage);
                    setAstPathSaved(false);
                    alert(`An error occurred while saving the path: ${errorMessage}`);
                } finally {
                    setIsSaving(false);
                }
            }
        } catch (error) {
            console.error('Error updating assistant:', error);
            setIsLoading(false);
            setLoadingMessage("");
        }
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
                                    className="my-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 bg-neutral-100 dark:bg-[#40414F] dark:text-neutral-100 custom-shadow"
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
                                id="assistantName"
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
                                <div className="mt-[-16px] flex justify-center overflow-hidden">
                                    <div className="rounded bg-white dark:bg-[#343541] mb-4">
                                        <DataSourceSelector
                                            minWidth="500px"
                                            // height='310px'
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
                                            onClose={() =>  setShowDataSourceSelector(false)}
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
                            
                            <ExpansionComponent
                                title={"Advanced"}
                                content={
                                    <div className="text-black dark:text-neutral-200">
                                        <div className="mt-4">
                                            {featureFlags?.assistantPathPublishing && (
                                                <AssistantPathEditor
                                                    astPath={astPath}
                                                    setAstPath={setAstPath}
                                                    assistantId={definition.assistantId}
                                                    featureEnabled={!!featureFlags?.assistantPathPublishing}
                                                    onPathValidated={handlePathValidated}
                                                    disableEdit={disableEdit}
                                                />
                                            )}
                                            
                                            <div className="mt-4 text-sm font-bold text-black dark:text-neutral-200">
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
                                        {Object.entries(opLanguageOptionsMap).map(([val, name]) => <option key={val} value={val}>{name}</option>)}
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
                                            <ExpansionComponent
                                                title='Manage'
                                                content= {
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
                                            }
                                            />
                                           
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

                                    {featureFlags.integrations && <>
                                            {!availableApis && <>Loading API Capabilities...</>}

                                    {availableApis && availableApis.length > 0 &&
                                        <>
                                        <div className="flex flex-row text-sm font-bold text-black dark:text-neutral-200 mt-2 mb-2">
                                            {t('Enabled API Capabilities')}
                                            {availableApis && opsSearchToggleButtons(opSearchBy, setOpSearchBy, apiSearchTerm, setApiSearchTerm, " ml-auto mr-2", 'translateY(8px)')}
                                        </div> 

                                        <div className="max-h-[400px] overflow-y-auto">
                                            {availableApis.filter((api) => apiSearchTerm ? (opSearchBy === 'name' ? api.name 
                                                          : (api.tags?.join("") ?? '')).toLowerCase().includes(apiSearchTerm) : true)
                                                          .map((api, index) => (
                                                <ApiItem
                                                selected={!!selectedApis?.some((selectedApi) => selectedApi.id === api.id)}
                                                key={index}
                                                api={api}
                                                index={index}
                                                onChange={handleUpdateApiItem} />
                                            ))}
                                        </div>  
                                        </>
                                    }
                                    </>}

                                    {featureFlags.assistantApis && <>
                                    <div className="text-sm font-bold text-black dark:text-neutral-200 mt-8 mb-1">
                                        {t('Custom API Capabilities')}
                                    </div>

                                    <APIComponent
                                      apiInfo={apiInfo}
                                      setApiInfo={setApiInfo}
                                    />
                                    </>}


                                        </div>
                                    </div>
                                }
                            />
                        </div>
              <div className="flex flex-row items-center justify-end p-4 bg-white dark:bg-[#22232b]">
                  <button
                    id="cancelButton"
                    type="button"
                    className="mr-2 w-full px-4 py-2 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                    onClick={() => {
                        onCancel();
                                }}
                            >
                                {disableEdit ? "Close" : t('Cancel')}
                            </button>
                            {!disableEdit && <button
                                id="saveButton"
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



