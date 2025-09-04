import {FC, useContext, ReactElement, useEffect, useRef, useState} from 'react';
import HomeContext from '@/pages/api/home/home.context';
import {useTranslation} from 'next-i18next';
import {Prompt} from '@/types/prompt';
import {COMMON_DISALLOWED_FILE_EXTENSIONS} from "@/utils/app/const";
import {ExistingFileList, FileList} from "@/components/Chat/FileList";
import {DataSourceSelector} from "@/components/DataSources/DataSourceSelector";
import {createAssistantPrompt, getAssistant, isAssistant} from "@/utils/app/assistants";
import {AttachFile, handleFile} from "@/components/Chat/AttachFile";
import {createAssistant, addAssistantPath, lookupAssistant, rescanWebsites} from "@/services/assistantService";
import {IconFiles, IconArrowRight, IconMailFast, IconCaretRight, IconCaretDown, IconRefresh, IconAlertTriangle} from "@tabler/icons-react";
import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import FlagsMap from "@/components/ReusableComponents/FlagsMap";
import { AssistantDefinition, AssistantProviderID } from '@/types/assistant';
import { AstGroupTypeData } from '@/types/groups';
import React from 'react';
import { AttachedDocument } from '@/types/attacheddocument';
import { getOpsForUser } from '@/services/opsService';
import { getSettings } from '@/utils/app/settings';
import { ExternalAPI } from '@/components/AssistantApi/CustomAPIEditor';
import { filterSupportedIntegrationOps } from '@/utils/app/ops';
import  {AssistantPathEditor, AstPathData, emptyAstPathData, isAstPathDataChanged} from './AssistantModalComponents/AssistantPathEditor';
import {opLanguageOptionsMap } from '@/types/op';
import { getAgentTools } from '@/services/agentService';
import { AssistantWorkflowSelector } from '@/components/AssistantWorkflows/AssistantWorkflowSelector';
import { AstWorkflow} from '@/types/assistantWorkflows';
import { registerAstWorkflowTemplate } from '@/services/assistantWorkflowService';;
import Checkbox from '@/components/ReusableComponents/CheckBox';
import { useSession } from 'next-auth/react';
import { compareEmailEventTemplates, constructAstEventEmailAddress, EMAIL_EVENT_TAG_PREFIX, formatEmailEventTemplate, isPresetEmailEventTag, safeEmailEventTag, updateAllowedSenders } from '@/utils/app/assistantEmailEvents';
import { addEventTemplate, listAllowedSenders, removeAllowedSender, removeEventTemplate } from '@/services/emailEventService';
import toast from 'react-hot-toast';
import { AddEmailWithAutoComplete } from '@/components/Emails/AddEmailsAutoComplete';
import ApiIntegrationsPanel from '@/components/AssistantApi/ApiIntegrationsPanel';
import { AssistantEmailEvents } from '@/components/Promptbar/components/AssistantModalComponents/AssistantEmailEvents';
import { AssistantWorkflowDisplay } from './AssistantModalComponents/AssistantWorkflowDisplay';
import { isWebsiteDs, WebsiteScanScheduler, WebsiteURLInput } from '@/components/DataSources/WebsiteURLInput';
import { Modal } from '@/components/ReusableComponents/Modal';
import { ScheduledTaskButton } from '@/components/Agent/ScheduledTasks';
import { deleteFile } from '@/services/fileService';
import AssistantDriveDataSources, { cleanupRemovedDatasources, DriveRescanSchedule, hasDriveData } from './AssistantModalComponents/AssistantDriveDataSources';
import { DriveFilesDataSources } from '@/types/integrations';
import { determineWebsiteScanCron, manageScheduledTasks, updateScheduledTasks, determineDriveScanCron, AssistantScheduledTaskUses } from '@/utils/app/scheduledTasks';
import { validateUrl } from '@/utils/app/data';


interface Props {
    assistant: Prompt;
    onSave: () => void;
    onCancel: () => void;
    onUpdateAssistant: (prompt: Prompt) => void;
    loadingMessage: string;
    loc: string;
    disableEdit?: boolean;
    title?: string;
    onCreateAssistant?: (astDef: AssistantDefinition) => Promise<{ id: string; assistantId: string; provider: string, data_sources: AttachedDocument[], ast_data: any }>;
    height?: string;
    additionalTemplates?:Prompt[];
    autofillOn?:boolean;
    embed?: boolean;
    children?: ReactElement;
    additionalGroupData?: any;
    disableEmailEvents?: boolean;
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

// Only show the includeDownloadLinks flag to users, but keep all flags for default value processing
const visibleDataSourceFlags = dataSourceFlags.filter(flag => flag.key === 'includeDownloadLinks');

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
                                          disableEdit=false, title, onCreateAssistant, height, additionalTemplates, 
                                          autofillOn=false, embed=false, additionalGroupData, children}) => {
    const {t} = useTranslation('promptbar');
    const { data: session } = useSession();
    const userEmail = session?.user?.email ?? '';
    const { state: { prompts, featureFlags, amplifyUsers, aiEmailDomain } , setLoadingMessage} = useContext(HomeContext);

    const isGroupAst = loc.includes("admin");

    const definition: AssistantDefinition = getAssistant(assistant);
    // console.log("definition: ", definition);

    const initialDs: AttachedDocument[] = (definition.dataSources || []).map(ds => {
        return {
            ...ds,
            key: (ds.key || ds.id)
        }
    });
    const websiteUrlHasDs = (ds:AttachedDocument[], url: string) => ds.find((ds:any) => ds.metadata?.sourceUrl === url || ds.metadata?.fromSitemap === url);
    
    const initialWebsiteUrls = (websiteUrls: any) => {
        if (!websiteUrls || !Array.isArray(websiteUrls)) return [];
        return definition.data?.websiteUrls.filter((urlItem: any) => validateUrl(urlItem.sourceUrl, urlItem.isSitemap).isValid);

    }
    const [websiteUrls, setWebsiteUrls] = useState<any[]>(initialWebsiteUrls(definition.data?.websiteUrls));
    // console.log("websiteUrls", websiteUrls);
    websiteUrls.forEach((urlItem: any) => {
        if (!websiteUrlHasDs(initialDs, urlItem.url)) {
            // console.log("No existing ds found for", urlItem);
            // detect if a url or sitemap failed to scrape and turn into a ds 
            const websiteDocument = {
                id: urlItem.sourceUrl,
                name: urlItem.sourceUrl,
                type: urlItem.isSitemap ? 'website/sitemap' : 'website/url',
                raw: null,
                data: null,
                metadata: {
                    scanFrequency: urlItem.scanFrequency || null, // Transfer scan frequency from backend
                    lastScanned: urlItem.lastScanned || null, // Transfer last scanned timestamp from backend  
                    sourceUrl: urlItem.url,
                    isSitemap: urlItem.isSitemap,
                    totalTokens: 0,
                },
            };
            initialDs.push(websiteDocument);
        }
    })


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

    const [preexistingDocumentIds, setPreexistingDocumentIds] = useState<string[]>((definition.dataSources || []).map(ds => ds.id)); 

    const [isLoading, setIsLoading] = useState(false);
    const [name, setName] = useState(definition.name);
    const [description, setDescription] = useState(definition.description);
    const [opsLanguageVersion, setOpsLanguageVersion] = useState(definition.data?.opsLanguageVersion || "v1");
    const [content, setContent] = useState(definition.instructions);
    const [disclaimer, setDisclaimer] = useState(definition.disclaimer ?? "");
    const [dataSources, setDataSources] = useState(initialDs);
    // console.log("dataSources", dataSources);
    const [removedWebsiteDs, setRemovedWebsiteDs] = useState<AttachedDocument[]>([]);
    const [isRescanningWS, setIsRescanningWS] = useState(false);
    const [dataSourceOptions, setDataSourceOptions] = useState<{ [key: string]: boolean }>(initialDataSourceOptionState);
    const [documentState, setDocumentState] = useState<{ [key: string]: number }>(initialStates);
    const [messageOptions, setMessageOptions] = useState<{ [key: string]: boolean }>(initialMessageOptionState);
    const [featureOptions, setFeatureOptions] = useState<{ [key: string]: boolean }>(initialFeatureOptionState);

    const [integrationDataSources, setIntegrationDataSources] = useState<DriveFilesDataSources | undefined>(definition.data?.integrationDriveData);
    const [driveRescanSchedule, setDriveRescanSchedule] = useState<DriveRescanSchedule | null>(null);

    const [apiOptions, setAPIOptions] = useState<{ [key: string]: boolean }>(initialAPIOptionState);
    const [availableApis, setAvailableApis] = useState<any[] | null>(null);

    const [selectedApis, setSelectedApis] = useState<any[]>(initialSelectedApis);
    const [apiInfo, setApiInfo] = useState<ExternalAPI[]>(initialApiCapabilities || []);

    const [availableAgentTools, setAvailableAgentTools] = useState<Record<string, any> | null>(null);
    const [builtInAgentTools, setBuiltInAgentTools] = useState<string[]>(definition.data?.builtInOperations ?? []);

    const [availableOnRequest, setAvailableOnRequest] = useState(definition.data?.availableOnRequest || false);
    const [astIcon, setAstIcon] = useState<AttachedDocument | undefined>(definition.data?.astIcon);
    // Path-related state
    const [astPath, setAstPath] = useState<string|null>(featureFlags.assistantPathPublishing ? definition.astPath || definition.data?.astPath || definition.pathFromDefinition : null); // initialize in useEffect
    const [isCheckingPath, setIsCheckingPath] = useState(true);
    const [isPathAvailable, setIsPathAvailable] = useState<boolean>(!!astPath); 
    const [astPathData, setAstPathData] = useState<AstPathData | null>(null);
    const originalAstPathData = useRef<AstPathData | null>(null);
    
    useEffect(() => {
        const lookupPath = async () => {
            let pathData: AstPathData = emptyAstPathData;
            if (!astPath) {
                setAstPathData(pathData);
                return;
            };
            const result = await lookupAssistant(astPath);
            // If lookup was successful, the path is already taken
            if (result.success && result.data) {
                // console.log("result.data", result.data);
                const data = result.data;
                const astId = data.assistantId;
                if (astId !== definition.assistantId) {
                    setAstPathData(pathData);
                    setAstPath(null);
                    setIsPathAvailable(false);
                    return;
                } 

                const accessTo = data.accessTo;
                pathData = {isPublic: data.public ?? true, 
                            accessTo: {amplifyGroups: accessTo.amplifyGroups ?? [], 
                                        users: accessTo.users ?? []}};
                originalAstPathData.current = pathData;
            } 
            setAstPathData(pathData);
        }

        if (featureFlags.assistantPathPublishing && astPathData === null) {
            lookupPath();
            setIsCheckingPath(false);
        }
    }, [featureFlags.assistantPathPublishing]);

    // workflow template
    const [baseWorkflowTemplateId, setBaseWorkflowTemplateId] =  useState<string | undefined>(definition.data?.baseWorkflowTemplateId);
    const [astWorkflowTemplateId, setAstWorkflowTemplateId] =  useState<string | undefined>(definition.data?.workflowTemplateId);
    const [currentWorkflowTemplate, setCurrentWorkflowTemplate] =  useState<AstWorkflow | null>(null);

    // email events
    const [enableEmailEvents, setEnableEmailEvents] = useState<boolean>(isGroupAst ? false : !!definition.data?.emailEvents);
    const [emailEventTag, setEmailEventTag] = useState<string | undefined>(definition.data?.emailEvents?.tag);
    const [emailEventTemplate, setEmailEventTemplate] = useState<{systemPrompt?: string, userPrompt?: string} | undefined>(definition.data?.emailEvents?.template);
    const [isEmailTagAvailable, setIsEmailTagAvailable] = useState<boolean>(!!emailEventTag);
    // Use fallback function if the imported one fails
    const isPresetCheck = typeof isPresetEmailEventTag === 'function' ? isPresetEmailEventTag : isPresetEmailEventTagFallback;
    const [isCheckingEmailTag, setIsCheckingEmailTag] = useState<boolean>(!isPresetCheck(emailEventTag));
    
    const [existingAllowedSenders, setExistingAllowedSenders] = useState<string[] | null>(null);
    const [curAllowedSenders, setCurAllowedSenders] = useState<string[]>([]);


    useEffect(() => {
        const getAllowedSenders = async () => {
            const tag = definition.data?.emailEvents?.tag;
            if (!tag) {
                setExistingAllowedSenders([]);
                return;
            }
            const response = await listAllowedSenders(tag);
            if (response.success && response.data)  {
                const senders: string[] = response.data ?? [];
                setExistingAllowedSenders(senders);
                const curSenders = new Set([...senders, ...curAllowedSenders]);
                setCurAllowedSenders(Array.from(curSenders));
            }
        }
        if (existingAllowedSenders === null && enableEmailEvents) getAllowedSenders();
    }, [existingAllowedSenders, enableEmailEvents]);


    const filterOps = async (data: any[]) => {
            const filteredOps = await filterSupportedIntegrationOps(data);
            if (filteredOps) setAvailableApis(filteredOps);
        }

    useEffect(() => {
        if (featureFlags.integrations && availableApis === null) getOpsForUser().then((ops) => {
                                                                    if (ops.success) {
                                                                        // console.log("ops: ", ops.data);
                                                                        filterOps(ops.data); 
                                                                        return;
                                                                    } 
                                                                    setAvailableApis([]);
                                                                });
    }, [availableApis]);

    useEffect(() => {
        if (featureFlags.agentTools && availableAgentTools === null ) {
            getAgentTools().then((tools) => {
                // console.log("tools", tools.data);
                setAvailableAgentTools(tools.success ? tools.data : {});
            });
        }
    }, [availableAgentTools]);
    

    const additionalGroupDataRef = useRef<any>({});

    useEffect(() => {
        additionalGroupDataRef.current = additionalGroupData;
    }, [additionalGroupData]);

    useEffect(() => {
        if (baseWorkflowTemplateId) {
            setOpsLanguageVersion("v4");
        } else {
            setOpsLanguageVersion("v1");
        }
    }, [baseWorkflowTemplateId]);

    // Handle sitemap cleanup when all children are removed
    useEffect(() => {
        if (!definition.data?.websiteUrls || websiteUrls.length === 0) return;
        
        // Find sitemaps in websiteUrls that no longer have any children in dataSources
        const sitemapsToRemove: string[] = [];
        
        websiteUrls.forEach((urlItem: any) => {
            if (urlItem.isSitemap) {
                const hasRemainingChildren = dataSources.some(ds => 
                    ds.metadata?.fromSitemap === urlItem.sourceUrl
                );
                if (!hasRemainingChildren) {
                    sitemapsToRemove.push(urlItem.sourceUrl);
                }
            }
        });
        
        // Remove sitemaps that no longer have children
        if (sitemapsToRemove.length > 0) {
            const updatedWebsiteUrls = websiteUrls.filter((urlItem: any) => 
                !sitemapsToRemove.includes(urlItem.sourceUrl)
            );
            setWebsiteUrls(updatedWebsiteUrls);
        }
    }, [dataSources, websiteUrls]);

    const validateApiInfo = (api: any) => {
        return api.RequestType && api.URL && api.Description;
    };


    let cTags = (assistant.data && assistant.data.conversationTags) ? assistant.data.conversationTags.join(",") : "";
    const [tags, setTags] = useState((assistant.data && assistant.data.tags) ? assistant.data.tags.join(",") : "");
    const [conversationTags, setConversationTags] = useState(cTags);

    const getTemplates = () => { // Allows auto fill from existing assistants
        let templates = prompts.filter((p:Prompt) => isAssistant(p) && (!p.groupId));
        if (additionalTemplates) templates = [...templates, ...additionalTemplates];
        return templates.map((p:Prompt) => p.data?.assistant?.definition);
    }

    const [templates, setTemplates] =  useState<AssistantDefinition[]>(getTemplates());
    const [selectTemplateId, setSelectTemplateId] =  useState<any>("");


    const [showDataSourceSelector, setShowDataSourceSelector] = useState(false);

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

    const handleAstTemplateChange = () => {
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
                if (data.baseWorkflowTemplateId) setBaseWorkflowTemplateId(data.baseWorkflowTemplateId);
                if (data.emailEvents?.template && !isGroupAst) {
                    setEnableEmailEvents(true);
                    setEmailEventTemplate(data.emailEvents?.template);
                }
            }
            
        }
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

        if (featureFlags.assistantPathPublishing) {
            if (isCheckingPath) {
                alert("Please wait for assistant path to be cleared for use.");
                return;
            }
            if (astPath && !isPathAvailable) {
                alert("Assistant path is not available, please try a different path.");
                return;
            }
        }

        if (enableEmailEvents) {
            if (!isEmailTagAvailable) {
                alert("Email event tag is not available, please try a different tag.");
                return;
            }
            if (isCheckingEmailTag && (definition.data?.emailEvents?.tag && !emailEventTag)) {
                alert("Please wait for email event tag to be cleared for use...");
                return;
            }
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

            // Handle scheduled tasks
            const existingScheduledTasks = definition.data?.scheduledTaskIds;
            if (featureFlags.scheduledTasks && !isGroupAst) {
                try {
                    // Handle website scheduled tasks
                    const websiteCron = determineWebsiteScanCron(dataSources);
                    const needsWebsiteTask = websiteCron !== null && websiteUrls.length > 0;
                    const assistantInfo = {
                        name: newAssistant.name,
                        assistantId: definition.assistantId ?? ''
                    };

                    setLoadingMessage("Managing scheduled tasks for website data sources...");

                    const websiteTaskId = await manageScheduledTasks({
                        currentTaskId: existingScheduledTasks?.websites,
                        needsScheduledTask: needsWebsiteTask,
                        cronExpression: websiteCron,
                        scheduledUse: 'websites',
                        assistantInfo,
                        dataSources
                    });

                    // Handle drive data sources similarly when that feature is ready
                    const driveCron = driveRescanSchedule ? determineDriveScanCron(driveRescanSchedule) : null;
                    const needsDriveTask = driveCron !== null && hasDriveData(integrationDataSources ?? {});
                    const driveTaskId = await manageScheduledTasks({
                        currentTaskId: existingScheduledTasks?.driveFiles,
                        needsScheduledTask: needsDriveTask,
                        cronExpression: driveCron,
                        scheduledUse: 'driveFiles',
                        assistantInfo,
                        dataSources
                    });

                    // Update scheduled task IDs in assistant data
                    const updatedScheduledTaskIds: { [key:string] : string }= {};

                    if (websiteTaskId) updatedScheduledTaskIds.websites = websiteTaskId;
                    if (driveTaskId) updatedScheduledTaskIds.driveFiles = driveTaskId;


                    // Only set scheduledTaskIds if we have any tasks
                    if (Object.keys(updatedScheduledTaskIds).length > 0) {
                        newAssistant.data.scheduledTaskIds = updatedScheduledTaskIds;
                    } else {
                        // Remove the property if no scheduled tasks exist
                        if (newAssistant.data?.scheduledTaskIds) {
                            delete newAssistant.data.scheduledTaskIds;
                        }
                    }

                    console.log('Scheduled task management completed for assistant:', definition.name);
                } catch (error) {
                    console.error('Error managing scheduled tasks:', error);
                    // Don't fail the assistant creation for scheduled task errors
                }
                
                setLoadingMessage(loadingMessage); // Reset loading message
            }


            if (!featureFlags.assistantPathPublishing || (definition.astPath && !astPath)) {
                // If feature flag is disabled, ensure astPath is not set
                if (newAssistant.astPath) delete newAssistant.astPath;
                if (newAssistant.data ) {
                    delete newAssistant.data.astPath;
                    delete newAssistant.data.astPathData;
                }
            }

          // console.log(dataSources.map((d: any)=> d.name));

            newAssistant.dataSources = dataSources.map(ds => {
                if (isWebsiteDs(ds) && !ds.key) return ds; // signifies needs scraping
                if (assistant.groupId) {
                    if (!ds.key) ds.key = ds.id;
                    if (!ds.groupId) ds.groupId = assistant.groupId;
                    return {
                      ...ds,
                      id: "s3://"+ds.key
                    }
                }
                if (ds.key || (ds.id && ds.id.indexOf("://") > 0)) {
                    return ds;
                } else {
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
            newAssistant.data.availableOnRequest = availableOnRequest;

            newAssistant.data.astIcon = astIcon;

            newAssistant.data.websiteUrls = websiteUrls;

            const initDriveDataSources = definition.data?.integrationDriveData;
            if (integrationDataSources || initDriveDataSources) {
                if (initDriveDataSources) {
                    // compare integrationDataSources with init so we can delete files that are no longer in the assistant
                    cleanupRemovedDatasources(initDriveDataSources, integrationDataSources ?? {});
                }
                newAssistant.data.integrationDriveData = integrationDataSources;
            }
           

            if (!baseWorkflowTemplateId && definition.data?.workflowTemplateId) {
                console.log("removing workflow template")
                newAssistant.data.workflowTemplateId = undefined;
                newAssistant.data.baseWorkflowTemplateId = undefined;
            } else if (baseWorkflowTemplateId && !currentWorkflowTemplate && 
                      (astWorkflowTemplateId !== definition.data?.workflowTemplateId)) { 
                alert("Please confirm and save the worflow template before saving the assistant.");
                setIsLoading(false);
                setLoadingMessage("");
                return;
            } else if (baseWorkflowTemplateId && currentWorkflowTemplate && 
                       currentWorkflowTemplate.template && currentWorkflowTemplate.template.steps) { 
                setLoadingMessage("Registering workflow template...");

                const response = await registerAstWorkflowTemplate(currentWorkflowTemplate.template, currentWorkflowTemplate.name, currentWorkflowTemplate.description);
                if (response.success && response.data?.templateId) {
                    newAssistant.data.workflowTemplateId = response.data.templateId;
                    newAssistant.data.baseWorkflowTemplateId = baseWorkflowTemplateId;
                    setLoadingMessage(loadingMessage);
                    newAssistant.data.opsLanguageVersion = "v4";
                } else {
                    alert("Unable to register assistant workflow template, please try again later...");
                    setIsLoading(false);
                    setLoadingMessage("");
                    return;
                } 
            } else { // no changes to workflow 
                console.log("--Workflow no changes--")
                newAssistant.data.baseWorkflowTemplateId = baseWorkflowTemplateId;
                newAssistant.data.workflowTemplateId = astWorkflowTemplateId;
                if (astWorkflowTemplateId) newAssistant.data.opsLanguageVersion = "v4";
            }
            
            // Email Events
            let registerEmailEvent = false; // we have to register after we get the assistant id
            let eventTag: string = enableEmailEvents ? emailEventTag && emailEventTag !== EMAIL_EVENT_TAG_PREFIX ? emailEventTag : safeEmailEventTag(name) : "";
            const oldEventTag: string | undefined = definition.data?.emailEvents?.tag;
            if (enableEmailEvents) {
                eventTag = eventTag.replace(/^[._-]+|[._-]+$/g, '');
                const safeTemplate = {userPrompt: emailEventTemplate?.userPrompt || "", systemPrompt: emailEventTemplate?.systemPrompt || ""};
                const tagChanged = oldEventTag && eventTag !== oldEventTag;
                // register event template if 
                // 1. not registered before
                // 2. template has changed
                // 3. name has changed
                
                if (!oldEventTag || tagChanged || !newAssistant.assistantId ||
                    !compareEmailEventTemplates(definition.data?.emailEvents?.template, safeTemplate)) {
                    if (tagChanged && oldEventTag) removeAllowedSender(oldEventTag);
                    registerEmailEvent = true;
                }
                
                newAssistant.data.emailEvents = {
                    tag : eventTag,
                    template : safeTemplate,
                }
                // handle allowed sender changes
                updateAllowedSenders(eventTag, existingAllowedSenders ?? [], curAllowedSenders);
            } else if (oldEventTag) {// remove if disabling
                removeEventTemplate(oldEventTag);
                removeAllowedSender(oldEventTag);
                delete newAssistant.data.emailEvents;
            }


            // console.log("apiInfo",apiInfo);
            // console.log("selectedApis",selectedApis);

            const combinedOps = [
              ...selectedApis,
              ...(apiInfo.map((api) => {return {type:"http", ...api}}))
            ];

            newAssistant.data = {
                ...newAssistant.data,
                operations: combinedOps,
                builtInOperations: builtInAgentTools
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
            
            const {id, assistantId, provider, data_sources, ast_data} = onCreateAssistant ? await onCreateAssistant(newAssistant) : await createAssistant(newAssistant, null);
            console.log('Assistant created with ID:', assistantId);

            
            if (!id) {
                alert("Unable to save the assistant at this time, please try again later...");
                setIsLoading(false);
                setLoadingMessage("");
                return;
            }
            
            if (registerEmailEvent) { // needed assistantId to register
                setLoadingMessage("Registering email event template...");
                const response = await addEventTemplate(eventTag, formatEmailEventTemplate(emailEventTemplate), assistantId);
                if (response.success) {
                    toast("Assistant successfully setup to receive emails.");
                } else {
                    alert("Unable to register email event template. You will not be able to send emails to this assistant, please try saving again.");
                }
    
            }
            if (featureFlags.scheduledTasks && !definition.assistantId && newAssistant.data?.scheduledTaskIds) {
                // update scheduled tasks to include 
                try {
                    Object.entries(newAssistant.data.scheduledTaskIds).forEach(async ([key, taskId]) => {
                        const result = await updateScheduledTasks(taskId as string, '', key as AssistantScheduledTaskUses, {
                            name: newAssistant.name,
                            assistantId: assistantId
                        });
                    });
                } catch (error) {
                    console.error('Error updating scheduled tasks:', error);
                }
            }
            newAssistant.id = id;
            newAssistant.provider = provider;
            newAssistant.assistantId = assistantId;
            // updated datasources to account for sitemap scaping into multiple datasources
            if (data_sources) newAssistant.dataSources = data_sources;
            // ensure we have the data synced up with the backend
            
            if (newAssistant.data) {
                // console.log("ast_data", ast_data);
                newAssistant.data.websiteUrls = ast_data.websiteUrls;
                newAssistant.data.integrationDriveData = ast_data.integrationDriveData;
            }
            // on successful save we can delete any removed website datasources
            if (removedWebsiteDs.length > 0) {
                console.log("removing website datasources", removedWebsiteDs);
                removedWebsiteDs.forEach((doc) => {
                    if (doc.key) deleteFile(doc.key);
                });
            }

            // If we have an assistantId and astPath, update the path in DynamoDB
            // if path has changed or pathData has changed
            if (featureFlags.assistantPathPublishing && assistantId && astPath &&
                (astPath !== definition.astPath || isAstPathDataChanged(astPathData, originalAstPathData.current))) {
                try {
                    const formattedPath = astPath.toLowerCase();
                    setLoadingMessage(`Publishing assistant to ${window.location.origin}/assistants/${formattedPath}...`);
                    console.log(`Attempting to save path "${formattedPath}" for assistant "${assistantId}" (ID type: ${typeof assistantId})`);

                    if (!assistantId?.trim()) throw new Error('Invalid assistant ID');// Make sure the assistantId is a valid string
                    if (!formattedPath?.trim()) throw new Error('Invalid path');// Make sure the path is a valid string
                    
                    const pathResult = await addAssistantPath(assistantId, formattedPath, assistant.groupId, astPathData?.isPublic, astPathData?.accessTo);
                    // console.log('Path saving result:', pathResult);

                    if (pathResult.success) {
                        newAssistant.astPath = formattedPath;
                        
                        if (!newAssistant.data) newAssistant.data = {};

                        newAssistant.data.astPath = formattedPath;
                        newAssistant.data.astPathData = astPathData;
                        toast(`Assistant successfully published at: ${formattedPath}`);
                    } else {
                        console.error('Failed to save path:', pathResult);
                        alert(`Error saving path: ${pathResult.message || 'Failed to save assistant path. Please try again.'}`);
                    }

                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error('Exception when saving path:', errorMessage);
                    alert(`An error occurred while saving the path: ${errorMessage}`);
                } 
            }

            const aPrompt = createAssistantPrompt(newAssistant);
            onUpdateAssistant(aPrompt);


            onSave();
        } catch (error) {
            console.error('Error updating assistant:', error);
        }
        setIsLoading(false);
        setLoadingMessage("");
    }

        // handle file upload functions //
    const onAttach = (doc: AttachedDocument) => {
        setDataSources((prev) => {
            prev.push(doc as any);
            return prev;
        });
    }
    const onSetMetadata = (doc: AttachedDocument, metadata: any) => {
        setDataSources((prev)=>{
            return prev.map(x => x.id === doc.id ? {
                ...x,
                metadata
            } : x)
        });
    }
    const onSetKey = (doc: AttachedDocument, key: string) => {
        setDataSources((prev)=>{
            return prev.map(x => x.id === doc.id ? {
                ...x,
                key
            } : x)
        });
    }

    const onUploadProgress = (doc: AttachedDocument, progress: number) => {
        setDocumentState((prev)=>{
                prev[doc.id] = progress;
                return prev;
        });
    }
   
    const handleRescan = async () => {
        if (!definition.assistantId) {
            toast.error("Please save the assistant before rescannning website URLs");
            return;
        }
        setIsRescanningWS(true);
        const result = await rescanWebsites(definition.assistantId, true);
        if (result.success) {
            const newDataSources = result.data.dataSources;
            console.log("newDataSources", newDataSources);
            console.log('\n🔄 Rescan Results:', { 
                newDataSources: newDataSources.length, 
                newDataSourcesDetails: newDataSources.map((ds: any) => ({ 
                    id: ds.id, 
                    name: ds.name, 
                    sourceUrl: ds.metadata?.sourceUrl,
                    fromSitemap: ds.metadata?.fromSitemap,
                    maxPages: ds.metadata?.maxPages
                }))
            });
            
            // Create a map of existing website data sources keyed by (sourceUrl + fromSitemap)
            const existingWebsiteMap = new Map();
            const currentDataSources = [...dataSources];
            const websiteDataSources = currentDataSources.filter(ds => isWebsiteDs(ds));
            const nonWebsiteDataSources = currentDataSources.filter(ds => !isWebsiteDs(ds));
            console.log('📊 Current Data Sources:', { 
                total: currentDataSources.length,
                website: websiteDataSources.length,
                nonWebsite: nonWebsiteDataSources.length
            });
            console.log('🔒 Non-website data sources (will be preserved):', 
                nonWebsiteDataSources.map(ds => ({ name: ds.name, type: ds.type, id: ds.id }))
            );
            
            currentDataSources.forEach((ds, index) => {
                if (isWebsiteDs(ds) && ds.metadata?.sourceUrl) {
                    const key = `${ds.metadata.sourceUrl}|${ds.metadata.fromSitemap || 'null'}`;
                    existingWebsiteMap.set(key, { dataSource: ds, index });
                    console.log('🗺️ Mapped existing website DS:', { 
                        key, 
                        index, 
                        name: ds.name, 
                        id: ds.id,
                        maxPages: ds.metadata?.maxPages
                    });
                }
            });
            console.log('📋 Existing website map size:', existingWebsiteMap.size);
            
            // Process new data sources: replace existing or add new
            const updatedDataSources = [...currentDataSources];
            const addedDataSources: AttachedDocument[] = [];
            let replacedCount = 0;
            let addedCount = 0;
            
            // Track changes to preexistingDocumentIds
            const updatedPreexistingIds = [...preexistingDocumentIds];
            const idMappings: Array<{oldId: string, newId: string}> = [];
            const newIds: string[] = [];
            
            newDataSources.forEach((newDs: any) => {
                if (newDs.metadata?.sourceUrl) {
                    const key = `${newDs.metadata.sourceUrl}|${newDs.metadata.fromSitemap || 'null'}`;
                    const existing = existingWebsiteMap.get(key);
                    
                    if (existing) {
                        // Replace existing data source
                        console.log('🔄 REPLACING existing DS:', { 
                            key, 
                            oldName: existing.dataSource.name, 
                            newName: newDs.name,
                            oldId: existing.dataSource.id,
                            newId: newDs.id,
                        });
                        updatedDataSources[existing.index] = {
                            ...{...newDs, key: newDs.id},
                            // Preserve any UI-specific properties if needed
                        } as AttachedDocument;
                        
                        // Track ID mapping for preexistingDocumentIds update
                        if (existing.dataSource.id !== newDs.id) {
                            idMappings.push({oldId: existing.dataSource.id, newId: newDs.id});
                        }
                        
                        replacedCount++;
                    } else {
                        // Add new data source (handles sitemap expansion case)
                        console.log('➕ ADDING new DS:', { 
                            key, 
                            name: newDs.metadata?.sourceUrl, 
                            id: newDs.id,
                        });
                        addedDataSources.push({...newDs, key: newDs.id} as AttachedDocument);
                        
                        // Track new ID for preexistingDocumentIds update
                        newIds.push(newDs.id);
                        
                        addedCount++;
                    }
                }
            });
            
            // Update preexistingDocumentIds: replace old IDs with new IDs and add new ones
            idMappings.forEach(({oldId, newId}) => {
                const index = updatedPreexistingIds.indexOf(oldId);
                if (index !== -1) {
                    updatedPreexistingIds[index] = newId;
                    console.log('🔄 Updated preexisting ID mapping:', {oldId, newId, index});
                }
            });
            
            // Add new IDs to preexisting list (they should appear in "existing" section after rescan)
            newIds.forEach(newId => {
                if (!updatedPreexistingIds.includes(newId)) {
                    updatedPreexistingIds.push(newId);
                    console.log('➕ Added new ID to preexisting:', {newId});
                }
            });
            
            console.log('📈 Processing Summary:', { 
                replacedCount, 
                addedCount, 
                totalNewDataSources: newDataSources.length,
                finalDataSourcesCount: updatedDataSources.length + addedDataSources.length,
                idMappingsCount: idMappings.length,
                newIdsCount: newIds.length
            });
            
            console.log('🔄 PreexistingDocumentIds Update:', {
                oldPreexistingIds: preexistingDocumentIds,
                newPreexistingIds: updatedPreexistingIds,
                changed: preexistingDocumentIds.length !== updatedPreexistingIds.length || 
                        !preexistingDocumentIds.every(id => updatedPreexistingIds.includes(id))
            });
            
            // Update state with all changes
            setDataSources([...updatedDataSources, ...addedDataSources]);
            setPreexistingDocumentIds(updatedPreexistingIds);
            
            toast.success(`Successfully updated website data sources`);
        } else {
            toast.error("Unable to rescan website URLs, please try again later...");
        }
        setIsRescanningWS(false);
    }
    

    if (isLoading) return <></>;
    

    const assistantModalContainer = () => {
        return ( <>
                        <label className='w-full text-xl text-center items-center mb-2 flex justify-center'> {title} </label>  
                        <div className="overflow-y-auto"
                            id="assistantModalScroll"
                            style={{ height: height}}>
                            {children}


                            { autofillOn &&
                            <>
                            <div className="text-sm font-bold text-black dark:text-neutral-200">
                                {t('Auto-Populate From Existing Assistant')}
                            </div>
                            <div className="flex flex-row gap-2 ">
                                <select
                                    className={"my-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 bg-neutral-100 dark:bg-[#40414F] dark:text-neutral-100 custom-shadow"}
                                    id="autoPopulateSelect"
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
                                id="fillInTemplateButton"
                                onClick={() => handleAstTemplateChange()}
                                title={"Fill-In Template"}
                                >
                                    <IconArrowRight size={18} />
                                </button>
                            </div> </>}
                            <div className="mt-1 flex flex-row gap-2">
                                <div className="mt-2 text-sm font-bold text-black dark:text-neutral-200">
                                    {t('Assistant Name')}
                                </div>
                                {!isGroupAst && !disableEdit && featureFlags.scheduledTasks && definition.assistantId && 
                                    <div className="-mt-0.5 ml-auto text-sm text-gray-500 flex items-center gap-2 mr-1">
                                        Schedule Assistant
                                        <ScheduledTaskButton
                                            taskType={'assistant'} 
                                            objectInfo={{objectId: definition.assistantId, objectName: definition.name}}
                                        />
                                    </div>}
                            </div>
                            <input
                                id="assistantNameInput"
                                className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                placeholder={t('A name for your prompt.') || ''}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={disableEdit}
                                onBlur={() => setExistingAllowedSenders(null)}
                            />

                            <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
                                {t('Description')}
                            </div>
                            <textarea
                                className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                id="assistantDescription"
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
                                id="assistantInstructions"
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
                                    id="assistantDisclaimer"
                                    onChange={(e) => setDisclaimer(e.target.value)}
                                    rows={2}
                                    disabled={disableEdit}
                                />
                            </div>
                           {!disableEdit && <>
                           
                            <div className="mt-6 h-0 text-center flex items-center justify-center gap-2 w-full">
                                <IconAlertTriangle size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                <p className="text-xs text-blue-700 dark:text-blue-300">
                                {"When making changes to the assistant's data sources, please allow a few minutes after saving for the updates to take effect."}
                                </p>
                            </div>
                            <div className="font-bold text-black dark:text-neutral-200">
                                {t('Upload Data Sources')}
                            </div>
                            <div className="flex flex-row items-center">
                                <button
                                    title='Add Files'
                                    id="assistantViewFile"
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
                                            onAttach={onAttach}
                                            onSetMetadata={onSetMetadata}
                                            onSetKey={onSetKey}
                                            onUploadProgress={onUploadProgress}
                                            disableRag={false}
                                />
                            </div>
                            <FileList documents={dataSources.filter((ds:AttachedDocument) => !(preexistingDocumentIds.includes(ds.id)) && !isWebsiteDs(ds))} documentStates={documentState}
                                setDocuments={(docs) => {
                                const preexisting = dataSources.filter((ds:AttachedDocument) => (preexistingDocumentIds.includes(ds.id)));
                                const websites = dataSources.filter((ds:AttachedDocument) => isWebsiteDs(ds));
                                setDataSources([...docs, ...preexisting, ...websites] as any[]);
                            }} allowRemoval={!disableEdit} 
                               onCancelUpload={(ds:AttachedDocument) => { 
                                console.log('onCancelUpload', documentState);
                                const updatedDocState = {...documentState};
                                delete updatedDocState[ds.id];
                                setDocumentState(updatedDocState);
                               }}/>
                            {showDataSourceSelector && (
                                <div className="mt-[-8px] flex justify-center overflow-hidden transform scale-y-90 origin-top-left">
                                    <div className="rounded bg-white dark:bg-[#343541] mb-4">
                                    <DataSourceSelector
                                            disallowedFileExtensions={COMMON_DISALLOWED_FILE_EXTENSIONS}
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
                                            onClose={() =>  setShowDataSourceSelector(false)}
                                            onIntegrationDataSourceSelected={featureFlags.integrations ? 
                                                (file: File) => { handleFile(file, onAttach, onUploadProgress, onSetKey, onSetMetadata, 
                                                                  () => {}, featureFlags.uploadDocuments, assistant.groupId, featureFlags.ragEnabled)} 
                                                : undefined
                                            }
                                        />
                                    </div>
                                </div>
                            )}
                            </>}


                
                            {/* Add Website URLs Section */}
                            {featureFlags.websiteUrls && !disableEdit && (
                                <> 
                                <div className="mt-2 mb-2 font-bold text-black dark:text-neutral-200">
                                    {t('Attach Website Data Sources')}
                                </div>
                                {definition.assistantId && dataSources.find((ds:AttachedDocument) => isWebsiteDs(ds) && ds.key) &&
                                <button
                                    onClick={() => {
                                        if (definition.assistantId) {
                                            toast("Please wait a few minutes for the rescan to complete");
                                            handleRescan();
                                        }
                                    }}
                                    className={"absolute right-10 p-2 hover:bg-gray-100 dark:hover:bg-[#40414F] rounded-md transition-colors group"}
                                    style={{zIndex: "20", transform: "translateY(-30px)"}}
                                    title={"Rescan All Website URLs"}
                                    >
                                    <IconRefresh 
                                        size={22} 
                                        className={`text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300`} 
                                    />
                                </button>}
                                {featureFlags.scheduledTasks &&
                                  <WebsiteScanScheduler
                                    initAssistantDefintion={definition}
                                    websiteUrls={websiteUrls}
                                    onUpdateWebsiteUrl={(urlItem, updates) => {
                                        // Update the websiteUrls
                                        setWebsiteUrls(websiteUrls.map(item => 
                                            item.sourceUrl === urlItem.sourceUrl ? { ...item, ...updates } : item
                                        ));
                                        // If this is a sitemap, also update all its children datasources
                                        if (urlItem.isSitemap) {
                                            setDataSources(dataSources.map(ds => 
                                                [ds.metadata?.fromSitemap, ds.metadata?.sourceUrl].includes(urlItem.sourceUrl) 
                                                    ? { 
                                                        ...ds, 
                                                        metadata: { 
                                                            ...ds.metadata, 
                                                            totalTokens: ds.metadata?.totalTokens || 0,
                                                            scanFrequency: updates.scanFrequency 
                                                        } 
                                                    } : ds
                                            ));
                                        } else {
                                            // For individual URLs, update the matching datasource
                                            setDataSources(dataSources.map(ds => 
                                                ds.metadata?.sourceUrl === urlItem.sourceUrl 
                                                    ? { 
                                                        ...ds, 
                                                        metadata: { 
                                                            ...ds.metadata, 
                                                            totalTokens: ds.metadata?.totalTokens || 0,
                                                            scanFrequency: updates.scanFrequency 
                                                        } 
                                                    } : ds
                                            ));
                                        }
                                    }}
                                  />}
                                <WebsiteURLInput
                                    onAddURL={(url, isSitemap, maxPages, exclusions) => {
                                        const webType = isSitemap ? 'website/sitemap' : 'website/url';
                                        // Create a data source object for the URL
                                        const websiteSource = {
                                            id: url,
                                            name: url,
                                            type: webType,
                                            metadata: {
                                                scanFrequency: null, // Default scan frequency in days
                                                sourceUrl: url,
                                                isSitemap: isSitemap,
                                                ...(maxPages !== undefined && { maxPages }),
                                                ...(exclusions && { exclusions })
                                            },
                                        };
                                        // Add to dataSources
                                        setDataSources([...dataSources, websiteSource as any]);

                                        // Set document state to 100% (fully loaded)
                                        setDocumentState({ ...documentState, [url]: 100 });

                                        const websiteUrl = {
                                            url: url,
                                            type: webType,
                                            lastScanned: null,
                                            ...websiteSource.metadata,
                                        }
                                        setWebsiteUrls([...websiteUrls, websiteUrl]);
                                    }}
                                />

                                <FileList documents={dataSources.filter((ds:AttachedDocument) => 
                                                    !(preexistingDocumentIds.includes(ds.id)) && 
                                                     isWebsiteDs(ds))} documentStates={documentState}
                                    setDocuments={(docs) => {
                                    const preexisting = dataSources.filter((ds:AttachedDocument) => (preexistingDocumentIds.includes(ds.id)));
                                    const nonWebsites = dataSources.filter((ds:AttachedDocument) => !(preexistingDocumentIds.includes(ds.id)) && !isWebsiteDs(ds));
                                    setDataSources([...docs, ...preexisting, ...nonWebsites] as any[]);
                                }} allowRemoval={!disableEdit} 
                                   onCancelUpload={(ds:AttachedDocument) => { 
                                    const updatedDocState = {...documentState};
                                    delete updatedDocState[ds.id];
                                    setDocumentState(updatedDocState);
                                    setWebsiteUrls(websiteUrls.filter((urlItem: any) => urlItem.url !== ds.id));
                               }}/>
                                </>
                            )}

                            {featureFlags.integrations && !disableEdit &&!isGroupAst &&
                                <AssistantDriveDataSources
                                initAssistantDefintion={definition}
                                selectedDataSources={integrationDataSources ?? {}}
                                onSelectedDataSourcesChange={setIntegrationDataSources}
                                //  height?: string;
                                //  minWidth?: string;
                                disallowedFileExtensions={COMMON_DISALLOWED_FILE_EXTENSIONS}
                                initRescanSchedule={driveRescanSchedule}
                                onRescanScheduleChange={setDriveRescanSchedule}
                                />
                            }

                            { definition.dataSources?.length > 0  &&
                             <div className="mt-4">
                                <br></br>
                                <ExistingFileList 
                                    label={'Assistant Data Sources'}
                                    allowRemoval={!disableEdit}
                                    documents={dataSources.filter((ds:AttachedDocument) => (preexistingDocumentIds.includes(ds.id)))} 
                                    setDocuments={(docs) => {
                                        const newDocs = dataSources.filter((ds:AttachedDocument) => !(preexistingDocumentIds.includes(ds.id)));
                                        setDataSources([...docs, ...newDocs] as any[]);
                                    }} 
                                    onRemoval={(doc) => {
                                        // since websites are assistant specific scraped data sources we need to delete upon removal
                                        if (isWebsiteDs(doc) ) {
                                            setRemovedWebsiteDs([...removedWebsiteDs, doc]);
                                            
                                            if (definition.data && definition.data.websiteUrls) {
                                                // For regular URLs (not sitemap children), remove them directly
                                                if (!doc.metadata?.fromSitemap) {
                                                    const updatedWebsiteUrls = definition.data.websiteUrls.filter((urlItem: any) => 
                                                        urlItem.sourceUrl !== doc.metadata?.sourceUrl);
                                                    setWebsiteUrls(updatedWebsiteUrls);
                                                } else if (doc.metadata?.fromSitemap) {
                                                    // For sitemap children, add to parent sitemap's exclusions
                                                    const parentSitemapUrl = doc.metadata.fromSitemap;
                                                    const updatedWebsiteUrls = websiteUrls.map((urlItem: any) => {
                                                        if (urlItem.sourceUrl === parentSitemapUrl && urlItem.isSitemap) {
                                                            // Add to exclusions
                                                            const currentExclusions = urlItem.exclusions || {};
                                                            const excludedUrls = currentExclusions.excludedUrls || [];
                                                            
                                                            // Add this URL to excluded URLs if not already there
                                                            if (!excludedUrls.includes(doc.metadata?.sourceUrl)) {
                                                                return {
                                                                    ...urlItem,
                                                                    exclusions: {
                                                                        ...currentExclusions,
                                                                        excludedUrls: [...excludedUrls, doc.metadata?.sourceUrl]
                                                                    }
                                                                };
                                                            }
                                                        }
                                                        return urlItem;
                                                    });
                                                    setWebsiteUrls(updatedWebsiteUrls);
                                                    
                                                
                                                    console.log('🚫 Added URL to sitemap exclusions:', {
                                                        removedUrl: doc.metadata?.sourceUrl,
                                                        parentSitemap: parentSitemapUrl,
                                                        reason: 'User manually removed from assistant'
                                                    });
                                                }
                                                // Sitemap children cleanup is handled by useEffect
                                            }
                                        }
                                    }}
                                />
                              </div>
                            }

                    

                            {/* Workflow Template Selector - purposefully not featured flagged / outside ofthe advanced section */}
                            {baseWorkflowTemplateId && 
                            <AssistantWorkflowDisplay
                                baseWorkflowTemplateId={baseWorkflowTemplateId}
                                astWorkflowTemplateId={astWorkflowTemplateId}
                                onWorkflowTemplateUpdate={(workflowTemplate) => {
                                    setCurrentWorkflowTemplate(workflowTemplate);
                                }}
                            />}

                            {/* Email Events - purposefully not featured flagged / outside ofthe advanced section */}
                            {enableEmailEvents &&
                            <div className="mb-4 mt-2 flex flex-col gap-2 mr-6">
                                <label className=" text-[1.02rem]"> Email this assistant at: <span className='ml-2 text-blue-500'> {`${constructAstEventEmailAddress(emailEventTag ?? safeEmailEventTag(name), userEmail, aiEmailDomain)}`} </span></label>
                            
                                {!existingAllowedSenders ? <>Loading allowed senders...</> : 
                                <ExpansionComponent title={"Manage authorized senders who can email this assistant"} 
                                    closedWidget= { <IconMailFast size={22} />} 
                                    content={
                                    <AddEmailWithAutoComplete
                                        id={`allowedSenders`}
                                        emails={curAllowedSenders}
                                        allEmails={amplifyUsers.filter((user: string) => user !== userEmail)}
                                        handleUpdateEmails={(updatedEmails: Array<string>) => {
                                            setCurAllowedSenders(updatedEmails);
                                        }}
                                        displayEmails={true}
                                    />} 
                                />}
                            </div>}

                            <br></br>

                            <ExpansionComponent title={"Advanced"} content={
                                <div className="mb-4 text-black dark:text-neutral-200 mb-6">
                                    
                                    { definition.assistantId && 
                                    <>
                                    <div className="text-sm font-bold text-black dark:text-neutral-200 flex items-center">
                                        {t('Assistant ID:')} <span className='ml-2 font-normal'>{definition.assistantId}</span>
                                    </div>
                                    </>}

                                    { featureFlags.integrations && <>
                                    <div className="mt-4 text-sm font-bold text-black dark:text-neutral-200">
                                        Assistant Type
                                    </div>
                                    <select
                                      title={baseWorkflowTemplateId ? "This assistant is using a workflow template. You cannot change the assistant type." : ""}
                                      disabled={baseWorkflowTemplateId !== undefined || disableEdit}
                                      className={`mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100 ${baseWorkflowTemplateId ? "opacity-40" : ""}`}
                                      value={opsLanguageVersion}
                                      onChange={(e) => setOpsLanguageVersion(e.target.value)}
                                    >   
                                        {Object.entries(opLanguageOptionsMap(featureFlags)).map(([val, name]) => <option key={val} value={val}>{name as string}</option>)}
                                    </select>
                                    </>}

                                    {featureFlags.assistantPathPublishing && (
                                                <AssistantPathEditor
                                                    savedAstPath={definition.data?.astPath}
                                                    astPath={astPath}
                                                    setAstPath={setAstPath}
                                                    astIcon={astIcon}
                                                    setAstIcon={setAstIcon}
                                                    assistantId={definition.assistantId}
                                                    groupId={assistant.groupId}
                                                    astPathData={astPathData}
                                                    setAstPathData={setAstPathData}
                                                    isPathAvailable={isPathAvailable}
                                                    setIsPathAvailable={setIsPathAvailable}
                                                    disableEdit={disableEdit}
                                                    isCheckingPath={isCheckingPath}
                                                    setIsCheckingPath={setIsCheckingPath}
                                                />
                                            )}
                                            
                                    <div className='mt-4 text-[1rem]'>
                                        <Checkbox
                                            id="allowRequestAccess"
                                            label="Allow other users to request chat permissions for this assistant. "
                                            checked={availableOnRequest}
                                            onChange={(isChecked: boolean) => setAvailableOnRequest(isChecked)}
                                            disabled={disableEdit}
                                        /> 
                                    </div>

                                    <div className="text-sm font-bold text-black dark:text-neutral-200 mt-4">
                                        {t('Data Source Options')}
                                    </div>

                                    <FlagsMap id={'dataSourceFlags'}
                                                flags={visibleDataSourceFlags}
                                                state={dataSourceOptions}
                                                flagChanged={
                                                    (key, value) => {
                                                        if (!disableEdit) setDataSourceOptions({
                                                            ...dataSourceOptions,
                                                            [key]: value,
                                                        });
                                                    }
                                                } />
                                    <div className="text-sm font-bold text-black dark:text-neutral-200 mt-4">
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
                                                  disabled={disableEdit}
                                                  className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                                  placeholder={t('Tag names separated by commas.') || ''}
                                                  id="tagInput"
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
                                                  disabled={disableEdit}
                                                  className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                                  placeholder={t('Tag names separated by commas.') || ''}
                                                  id="conversationTagInput"
                                                  value={conversationTags}
                                                  title={'Tags for conversations created with this template.'}
                                                  onChange={(e) => {
                                                      setConversationTags(e.target.value);
                                                  }}
                                                />
                                            </div>

                                    {/* Workflow Template Selector */}
                                    {featureFlags.assistantWorkflows && 
                                    <AssistantWorkflowSelector
                                        selectedTemplateId={baseWorkflowTemplateId}
                                        onTemplateChange={(workflowTemplateId) => {
                                            setBaseWorkflowTemplateId(workflowTemplateId ? workflowTemplateId : undefined);
                                            setAstWorkflowTemplateId(undefined);
                                            setCurrentWorkflowTemplate(null);
                                        }}
                                        disabled={disableEdit}
                                    />}

                                    {featureFlags.assistantEmailEvents && !isGroupAst &&
                                     <AssistantEmailEvents
                                        assistantId={definition.assistantId}
                                        initialEmailEventTag={definition.data?.emailEvents?.tag}
                                        enableEmailEvents={enableEmailEvents}
                                        setEnableEmailEvents={setEnableEmailEvents}
                                        disableEdit={disableEdit}
                                        assistantName={name}
                                        emailEventTag={emailEventTag}
                                        setEmailEventTag={setEmailEventTag}
                                        emailEventTemplate={emailEventTemplate}
                                        setEmailEventTemplate={setEmailEventTemplate}
                                        isTagAvailable={isEmailTagAvailable}
                                        setIsTagAvailable={setIsEmailTagAvailable}
                                        isCheckingTag={isCheckingEmailTag}
                                        setIsCheckingTag={setIsCheckingEmailTag}
                                    />
                                    }

                                    <br></br>
                                    {/* Api Component View Selector */}
                                    { featureFlags.integrations &&
                                    <ApiIntegrationsPanel
                                        // API-related props
                                        availableApis={availableApis}
                                        selectedApis={selectedApis}
                                        setSelectedApis={setSelectedApis}
                                        
                                        // External API props
                                        apiInfo={apiInfo}
                                        setApiInfo={setApiInfo}
                                        
                                        // Agent tools props
                                        availableAgentTools={availableAgentTools}
                                        builtInAgentTools={builtInAgentTools}
                                        setBuiltInAgentTools={setBuiltInAgentTools}
                                        
                                        // Configuration
                                        allowConfiguration={true}
                                        
                                        // Refresh APIs function
                                        pythonFunctionOnSave={(fn)=>{
                                            getOpsForUser().then((ops) => {
                                            if (ops.success) filterOps(ops.data); 
                                            })
                                        }}
                                        disabled={disableEdit}
                                    />}
                                       
                                </div>
                                }
                            />
                        </div>
              { embed &&
              <div className="absolute bottom-0 right-0 flex flex-row items-center justify-end p-4 bg-transparent gap-2">
                  <button
                    id="cancelButton"
                    type="button"
                    className="px-3 py-1 text-sm border rounded-md shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                    onClick={() => {
                        onCancel();
                                }}
                            >
                                {disableEdit ? "Close" : t('Cancel')}
                            </button>
                            {!disableEdit && <button
                                id="saveButton"
                                type="button"
                                className="px-3 py-1 text-sm border rounded-md shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                                onClick={() => {
                                    handleUpdateAssistant();
                                }}
                            >
                                {t('Save')}
                            </button>}
                            
                </div>}
        </>

        )

    }


    return ( embed ? assistantModalContainer() :
        <Modal
            title={"Assistants"}
            onSubmit={handleUpdateAssistant}
            onCancel={onCancel}
            showSubmit={!disableEdit}
            submitLabel={"Save"}
            disableSubmit={isRescanningWS}
            cancelLabel={disableEdit ? "Close" : 'Cancel'}
            content={<>{assistantModalContainer()}</>}
            disableClickOutside={true}
            height={() => window.innerHeight}
        />
    );
};

// Fallback function in case the imported one is not available
const isPresetEmailEventTagFallback = (initialTag: string | undefined): boolean => {
  if (!initialTag) return false;
  return !initialTag.startsWith(EMAIL_EVENT_TAG_PREFIX);
};

