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

    const [astPath, setAstPath] = useState<string|null>(definition.astPath || null);
    const [pathError, setPathError] = useState<string|null>(null);
    const [isCheckingPath, setIsCheckingPath] = useState(false);
    const [isPathAvailable, setIsPathAvailable] = useState(false);

    const [isSaving, setIsSaving] = useState(false);
    const [astPathSaved, setAstPathSaved] = useState(false);
    const [pathAvailability, setPathAvailability] = useState({ available: false, message: "" });

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
   

    const validatePath = async (path: string): Promise<boolean> => {
        // If the feature flag is disabled, don't validate paths
        if (!featureFlags?.assistantPathPublishing) {
            return false;
        }
        
        // If path is empty, it's not valid
        if (!path || path.trim() === '') {
            setPathError('Path cannot be empty');
            return false;
        }

        // Check if the path contains any invalid characters
        const invalidCharsRegex = /[^a-zA-Z0-9-_/]/;
        if (invalidCharsRegex.test(path)) {
            setPathError('Path can only contain letters, numbers, hyphens, underscores, and forward slashes');
            return false;
        }
        
        // Check path length
        if (path.length < 3) {
            setPathError('Path must be at least 3 characters long');
            return false;
        }
        
        if (path.length > 100) {
            setPathError('Path is too long (maximum 100 characters)');
            return false;
        }
        
        // Check for leading/trailing slashes
        if (path.startsWith('/') || path.endsWith('/')) {
            setPathError('Path cannot start or end with a slash');
            return false;
        }
        
        // Check for consecutive slashes
        if (path.includes('//')) {
            setPathError('Path cannot contain consecutive slashes');
            return false;
        }
        
        // Check for common inappropriate terms
        const inappropriateTerms = [
            'profanity', 'offensive', 'obscene', 'adult', 'xxx', 'porn', 
            'explicit', 'sex', 'nsfw', 'violence', 'hate', 'racist', 
            'discriminatory', 'illegal', 'hack', 'crack', 'warez',
            'bypass', 'pirate', 'torrent', 'steal', 'nude', 'naked'
        ];
        
        const lowerPath = path.toLowerCase();
        for (const term of inappropriateTerms) {
            if (lowerPath.includes(term)) {
                setPathError(`Path contains inappropriate term: ${term}`);
                return false;
            }
        }
        
        // Check for paths pretending to be system paths
        const systemPaths = ['admin', 'system', 'login', 'signin', 'signup', 'register', 
                           'auth', 'authenticate', 'reset', 'password', 'billing', 'payment'];
        
        const pathParts = lowerPath.split('/');
        for (const part of pathParts) {
            if (systemPaths.includes(part)) {
                setPathError(`Path contains restricted system term: ${part}`);
                return false;
            }
        }

        try {
            setIsCheckingPath(true);
            setPathError(null);
            
            // Look up the path
            const result = await lookupAssistant(path.toLowerCase());
            
            // If lookup was successful, the path is already taken
            if (result.success) {
                // Get the current assistant's ID (from definition)
                const currentAssistantId = definition.assistantId;
                
                // If the path is used by the same assistant we're editing, it's valid
                if (currentAssistantId && result.assistantId === currentAssistantId) {
                    console.log(`Path "${path}" is already assigned to this assistant`);
                    setPathError(null);
                    setIsPathAvailable(true);
                    return true;
                }
                
                // Otherwise, the path is used by a different assistant
                setPathError('This path is already in use by another assistant');
                setIsPathAvailable(false);
                return false;
            }
            
            // If lookup failed with a "not found" message, the path is available
            setIsPathAvailable(true);
            return true;
        } catch (error) {
            console.error('Error validating path:', error);
            setPathError('Error checking path availability');
            setIsPathAvailable(false);
            return false;
        } finally {
            setIsCheckingPath(false);
        }
    };

    const handlePathBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
        // Skip validation if the feature flag is disabled
        if (!featureFlags?.assistantPathPublishing) {
            return;
        }
        
        const path = e.target.value.trim();
        if (path) {
            // If the path is the same as the current assistant's path, just set it as valid
            // without making unnecessary API calls
            if (definition.astPath && path.toLowerCase() === definition.astPath.toLowerCase()) {
                console.log(`Using existing path: ${path}`);
                setIsPathAvailable(true);
                setPathError(null);
                setPathAvailability({ available: true, message: "Current path" });
                return;
            }
            
            await validatePath(path);
            
            // Update the pathAvailability state based on validation results
            if (isPathAvailable) {
                // If the path is already assigned to this assistant
                if (path.toLowerCase() === definition.astPath?.toLowerCase()) {
                    setPathAvailability({ available: true, message: "Current path" });
                } else {
                    setPathAvailability({ available: true, message: "Path available" });
                }
            } else {
                setPathAvailability({ 
                    available: false, 
                    message: pathError || "Path unavailable" 
                });
            }
        } else {
            setIsPathAvailable(false);
            setPathError(null);
            setPathAvailability({ available: false, message: "" });
        }
    };

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

            // Validate path if specified and feature flag is enabled
            if (astPath && featureFlags?.assistantPathPublishing) {
                const isPathAvailable = await validatePath(astPath);
                if (!isPathAvailable) {
                    setIsLoading(false);
                    return; // Don't proceed with save if path validation fails
                }
                
                // Set the lowercase version of the path
                const formattedPath = astPath.toLowerCase();
                newAssistant.astPath = formattedPath;
                console.log(`Setting assistant path to "${formattedPath}" in definition`);
            } else if (!featureFlags?.assistantPathPublishing) {
                // If feature flag is disabled, ensure astPath is not set
                if (newAssistant.astPath) {
                    console.log(`Feature flag disabled, removing existing path "${newAssistant.astPath}" from definition`);
                    delete newAssistant.astPath;
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
                        setPathAvailability({ available: true, message: "" });
                        setPathError(null);
                        
                        // Update the newAssistant definition with the path
                        newAssistant.astPath = formattedPath;
                        
                        // Create a new prompt with the updated assistant definition
                        const updatedPrompt = createAssistantPrompt(newAssistant);
                        
                        // Update the assistant in the UI
                        onUpdateAssistant(updatedPrompt);
                        
                        alert(`Assistant successfully published at: ${formattedPath}`);
                    } else {
                        setAstPathSaved(false);
                        setPathError(pathResult.message || 'Failed to save assistant path');
                        console.error('Failed to save path:', pathResult);
                        alert(`Error saving path: ${pathResult.message || 'Failed to save assistant path. Please try again.'}`);
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error('Exception when saving path:', errorMessage);
                    setAstPathSaved(false);
                    setPathError(errorMessage);
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

    // Add a useEffect to initialize path-related state based on feature flag
    useEffect(() => {
        // Initialize path-related state only if the feature flag is enabled
        if (featureFlags?.assistantPathPublishing) {
            // Initialize with existing path from the definition, if available
            if (definition.astPath) {
                setAstPath(definition.astPath);
                
                // If there's an existing path, set it as available and mark it as the current path
                setIsPathAvailable(true);
                setPathError(null);
                setPathAvailability({ available: true, message: "Current path" });
                setAstPathSaved(true); // Mark as already saved
            }
        } else {
            // If feature flag is disabled, ensure path-related state is reset
            setAstPath(null);
            setIsPathAvailable(false);
            setPathError(null);
            setIsCheckingPath(false);
            setPathAvailability({ available: false, message: "" });
            setAstPathSaved(false);
        }
    }, [featureFlags?.assistantPathPublishing, definition.astPath]);

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
                                                <>
                                                    <div className="mt-4 text-sm font-bold text-black dark:text-neutral-200">
                                                        Publish Assistant Path
                                                    </div>
                                                    <p className="text-xs text-black dark:text-neutral-200 mt-2 mb-1">
                                                        Assistants will be accessible at {window.location.origin}/assistants/<span className="font-semibold">YourAssistantName</span>
                                                    </p>
                                                    <div className="relative">
                                                        <input
                                                            className={`mt-2 w-full rounded-lg border ${pathError ? 'border-red-500' : isPathAvailable ? 'border-green-500' : 'border-neutral-500'} px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100`}
                                                            placeholder="Enter a name for the path where you want to publish your assistant"
                                                            value={astPath || ''}
                                                            onChange={(e) => {
                                                                setAstPath(e.target.value);
                                                                setPathError(null);
                                                                setIsPathAvailable(false);
                                                            }}
                                                            onBlur={handlePathBlur}
                                                            disabled={disableEdit}
                                                        />
                                                        {astPath && (
                                                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                                                {isCheckingPath && (
                                                                    <IconLoader2 className="animate-spin h-5 w-5 text-gray-400" />
                                                                )}
                                                                {isPathAvailable && !isCheckingPath && !pathError && (
                                                                    <div className="flex items-center text-green-500">
                                                                        <IconCheck className="h-5 w-5 mr-1" />
                                                                        <span className="text-xs">{pathAvailability.message || "Available"}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {pathError && (
                                                        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-md">
                                                            <p className="text-xs text-red-600 dark:text-red-400 flex items-start">
                                                                <IconAlertTriangle className="h-4 w-4 mr-1 flex-shrink-0 mt-0.5" />
                                                                <span>{pathError}</span>
                                                            </p>
                                                            <ul className="text-xs text-red-600 dark:text-red-400 mt-1 ml-5 list-disc">
                                                                {pathError.includes('invalid characters') && (
                                                                    <li>Use only letters, numbers, hyphens, underscores, and forward slashes</li>
                                                                )}
                                                                {pathError.includes('restricted system term') && (
                                                                    <li>Choose a different name that doesn't include system-reserved terms</li>
                                                                )}
                                                                {pathError.includes('inappropriate term') && (
                                                                    <li>Choose a business-appropriate path name</li>
                                                                )}
                                                                {pathError.includes('already in use') && (
                                                                    <li>This path is already assigned to a different assistant</li>
                                                                )}
                                                            </ul>
                                                        </div>
                                                    )}
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                                        <span className="font-medium">Path requirements:</span> 3-100 characters, letters, numbers, hyphens, underscores, and forward slashes.
                                                        <br />No leading/trailing slashes or consecutive slashes. No reserved or inappropriate terms.
                                                    </p>
                                                </>
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



