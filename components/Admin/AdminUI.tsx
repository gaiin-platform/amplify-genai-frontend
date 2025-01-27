import { useSession } from "next-auth/react";
import { FC, useContext, useEffect, useRef, useState } from "react";
import { Modal } from "../ReusableComponents/Modal";
import HomeContext from "@/pages/api/home/home.context";
import InputsMap from "../ReusableComponents/InputMap";
import { deletePptx, getAdminConfigs, getInFlightEmbeddings, terminateEmbedding, testEmbeddingEndpoint, testEndpoint, updateAdminConfigs, uploadPptx } from "@/services/adminService";
import { AdminConfigTypes, Embedding, EmbeddingsConfig, Endpoint, FeatureFlag, FeatureFlagConfig, OpenAIModelsConfig, providers, SupportedModel, SupportedModelsConfig } from "@/types/admin";
import ExpansionComponent from "../Chat/ExpansionComponent";
import { IconCheck, IconPlus, IconRefresh,  IconTrash, IconX, IconEdit, IconKey, IconCircleX, IconFileUpload, IconFileTypeDocx, IconFileTypePpt, IconChevronRight, IconChevronLeft, IconFileTypeCsv, IconFileTypeJs, IconTags, IconMessage, IconFileTypePdf } from "@tabler/icons-react";
import { EmailsAutoComplete } from "../Emails/EmailsAutoComplete";
import { LoadingIcon } from "../Loader/LoadingIcon";
import Checkbox from "../ReusableComponents/CheckBox";
import { generateTimestamp, userFriendlyDate } from "@/utils/app/date";
import toast from "react-hot-toast";
import React from "react";
import { InfoBox } from "../ReusableComponents/InfoBox";
import { ActiveTabs } from "../ReusableComponents/ActiveTabs";
import ActionButton from "../ReusableComponents/ActionButton";
import { OpDef } from "@/types/op";
import { AMPLIFY_ASSISTANTS_GROUP_NAME, amplifyAssistants } from "@/utils/app/amplifyAssistants";
import { RateLimiter } from "../Settings/AccountComponents/RateLimit";
import { noRateLimit, PeriodType, RateLimit, rateLimitObj } from "@/types/rateLimit";
import { adminTabHasChanges, calculateMd5, uploadFileAsAdmin } from "@/utils/app/admin";
import { GroupUpdateType } from "@/types/groups";
import { AssistantDefinition } from "@/types/assistant";
import { createAmplifyAssistants, replaceAstAdminGroupKey, updateGroupAssistants } from "@/services/groupsService";
import { buildStyles, CircularProgressbar } from "react-circular-progressbar";
import { deleteOp, registerOps } from "@/services/opsService";
import { fetchApiDocTemplates, uploadApiDoc } from "@/services/apiKeysService";
import { IconFileCode } from "@tabler/icons-react";
import { uploadDataDisclosure } from "@/services/dataDisclosureService";
import { Model } from "@/types/model";
import Search from "../Search";
import { HTTPRequestSelect } from "../CustomAPI/CustomAPIEditor";

interface Props {
    open: boolean;
    onClose: () => void;
}


export const AdminUI: FC<Props> = ({ open, onClose }) => {
    const { state: { statsService, amplifyUsers}, dispatch: homeDispatch, setLoadingMessage } = useContext(HomeContext);
    const { data: session } = useSession();
    const userEmail = session?.user?.email;

    const [loadData, setLoadData] = useState<boolean>(true);  
    const [isLoading, setIsLoading] = useState<boolean>(true);  

    const [unsavedConfigs, setUnsavedConfigs] = useState<Set<AdminConfigTypes>>(new Set());

//////////////////// Vars for Configs Tab ////////////////////
    const [admins, setAdmins] = useState<string[]>([]);  
    const [allEmails, setAllEmails] = useState<Array<string> | null>(null);

    const [rateLimit, setRateLimit] = useState<{period: PeriodType, rate: string}>({...noRateLimit, rate: '0'});
    const [promptCostAlert, setPromptCostAlert] = useState<PromptCostAlert>({isActive:false, alertMessage: '', cost: 0});

    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const [deleteUsersList, setDeleteUsersList] = useState<string[]>([]);
    const [hoveredUser, setHoveredUser] = useState<string | null>(null);

    const [availableModels, setAvailableModels] = useState<SupportedModelsConfig>({});   
    const supportedModelsRef = useRef<HTMLDivElement>(null);  // to help control the scroll bar 
    const [isAddingAvailModel, setIsAddingAvailModel] = useState< { model: SupportedModel, 
                                                                    action: 'Adding' | 'Editing'} | null>(null);  
    const [hoveredAvailModel, setHoveredAvailModel] = useState<string>('');  
    const [modelsSearchTerm, setModelsSearchTerm] = useState<string>(''); 
    const [showModelsSearch, setShowModelsSearch] = useState<boolean>(true); 


    const [features, setFeatures] = useState<FeatureFlagConfig>({}); 
    const [hoveredException, setHoveredException] = useState<{ feature: string; username: string } | null>(null);
    const [addingExceptionTo, setAddingExceptionTo] = useState<string | null>(null);
    const [isAddingFeature, setIsAddingFeature] = useState<{name: string, featureData: FeatureFlag} | null>(null); 
    const [featureSearchTerm, setFeatureSearchTerm] = useState<string>(''); 
    const [showFeatureSearch, setShowFeatureSearch] = useState<boolean>(true); 


    const [appVars, setAppVars] = useState<{ [key: string]: string }>({});    
    const [appSecrets, setAppSecrets] = useState<{ [key: string]: string }>({});  
    const [refreshingTypes, setRefreshingTypes] = useState< AdminConfigTypes[]>([]);


    const [openAiEndpoints, setOpenAiEndpoints] = useState<OpenAIModelsConfig>({models: []}); 
    const [isDeletingEndpoint, setIsDeletingEndpoint] = useState<string | null>(null);
    const [deleteEndpointsList, setDeleteEndpointsList] = useState<number[]>([]);
    const [hoveredEndpoint, setHoveredEndpoint] = useState<{ model: string; index: number } | null>(null);
    const testEndpointsRef = useRef<{ url: string; key: string, model:string}[]>([]);


//////////////////// Vars for Data Tab //////////////////////////


    const [ops, setOps] = useState<OpDef[]>([]);
    const [hoveredOp, setHoveredOp] = useState<number>(-1);  
    const [newOps, setNewOps] = useState<OpDef[]>([]);
    const [isRegisteringOps, setIsRegisteringOps] = useState<boolean>(false);
    const [hoveredNewOp, setHoveredNewOp] = useState<number>(-1);  
    const [hoveredParam, setHoveredParam] = useState<{opIdx:number, paramIdx:number} | null>(null); 
    const [isDeletingOp, setIsDeletingOp] = useState<number>(-1);
    const [opSearchTerm, setOpSearchTerm] = useState<string>(''); 
    const [showOpSearch, setShowOpSearch] = useState<boolean>(true);  
    const [opSearchBy, setOpSearchBy] = useState<"name" | 'tag'>('name'); 


    const [astGroups, setAstGroups] = useState<Ast_Group_Data[]>([]);
    const [changedAstGroups, setChangedAstGroups] = useState<string[]>([]);
    const [hoveredAstGroup, setHoveredAstGroup] = useState<string>('');  
    const [keyReplacementLoading, setKeyReplacementLoading] = useState<string>(''); 
    const [astGroupSearchTerm, setAstGroupSearchTerm] = useState<string>(''); 
    const [showAstGroupSearch, setShowAstGroupsSearch] = useState<boolean>(true);      
    const [amplifyAstGroupId, setAmplifyAstGroupId] = useState<string>('');
    const [creatingAmpAsts, setCreatingAmpAsts] = useState<string[] | null>(null);
    const [isCreatingAmpAstGroup, setIsCreatingAmpAstGroup] = useState<boolean>(false);
    const [isAddingAst, setIsAddingAst] = useState<string>('');      


    const [templates, setTemplates] = useState<Pptx_TEMPLATES[]>([]);
    const [changedTemplates, setChangedTemplates] = useState<string[]>([]);
    const [hoveredTemplate, setHoveredTemplate] = useState<string>('');  
    const [deletingTemplate, setDeletingTemplate] = useState<string>(''); 
    const [isAddingTemplate, setIsAddingTemplate] = useState<Pptx_TEMPLATES | null>(null);
    const [uploadedTemplate, setUploadedTemplate] = useState<File | null>(null);
    const [isUploadingTemplate, setIsUploadingTemplate] = useState<boolean>(false);


    const [dataDisclosureUploaded, setDataDisclosureUploaded] = useState<boolean>(false);
    

    const [showUploadApiDocs, setShowUploadApiDocs] = useState<boolean>(false);
    const [apiDocsUploaded, setApiDocsUploaded] = useState<{csv: boolean, pdf: boolean, json: boolean}>(
                                                           {csv: false, pdf: false, json: false});


    const [ampGroups, setAmpGroups] = useState<Amplify_Groups>({});
    const [addingMembersTo, setAddingMembersTo] = useState<string | null>(null);
    const [hoveredAmpGroup, setHoveredAmpGroup] = useState<string>('');  
    const [hoveredAmpMember, setHoveredAmpMember] = useState<{ ampGroup: string; username: string } | null>(null);
    const [isAddingAmpGroups, setIsAddingAmpGroups] = useState<Amplify_Group | null>(null);
    const [ampGroupSearchTerm, setAmpGroupSearchTerm] = useState<string>(''); 
    const [showAmpGroupSearch, setShowAmpGroupsSearch] = useState<boolean>(true);  


//////////////////// Vars for Embeedings Tab ////////////////////

    const [embeddings, setEmbeddings] = useState<EmbeddingsConfig>({embeddings: []});  
    const [hasRetrievedEmbeddings, setHasRetrievedEmbeddings] = useState<boolean>(false);
    const [loadingEmbeddings, setLoadingEmbeddings] = useState<boolean>(false);
    const [terminatingEmbeddings, setTerminatingEmbeddings] = useState<string[]>([]);
  
    useEffect(() => {
       
        const getConfigs = async () => {
            setLoadData(false);
                //   statsService.openSettingsEvent(); 
            setLoadingMessage("Loading Admin Interface...");
            const result = await getAdminConfigs();
            if (result.success) {
                const data = result.data;
                setAdmins(data[AdminConfigTypes.ADMINS] || []);
                setFeatures(data[AdminConfigTypes.FEATURE_FLAGS] || {});
                setAppVars(data[AdminConfigTypes.APP_VARS] || {});
                setAppSecrets(data[AdminConfigTypes.APP_SECRETS] || {});
                const ops:OpDef[] = data[AdminConfigTypes.OPS] || [];
                setOps(ops.sort((a: OpDef, b: OpDef) => a.name.localeCompare(b.name)))
                setOpenAiEndpoints(data[AdminConfigTypes.OPENAI_ENDPONTS] || { models: [] });
                const availableModels = data[AdminConfigTypes.AVAILABLE_MODELS] || {};
                const baseModel = emptySupportedModel();
                const updatedModels = Object.entries(availableModels).map(([key, model]) => {
                    // Create a new object where null values are replaced with baseModel's values
                    const updatedModel = Object.fromEntries(
                        Object.entries(model as SupportedModel).map(([prop, value]) => [
                            prop,
                            value === null ? baseModel[prop as keyof SupportedModel] : value,
                        ])
                    );
                    return [key, updatedModel];
                });
                setAvailableModels(Object.fromEntries(updatedModels));
                const astAdminGroups: Ast_Group_Data[] = data[AdminConfigTypes.AST_ADMIN_GROUPS] || [];
                const amplifyAstGroupFound = astAdminGroups.find((g: Ast_Group_Data) => 
                                                                  g.groupName === AMPLIFY_ASSISTANTS_GROUP_NAME);
                if (amplifyAstGroupFound) setAmplifyAstGroupId(amplifyAstGroupFound.group_id);
                setAstGroups(astAdminGroups);
                setAmpGroups(data[AdminConfigTypes.AMPLIFY_GROUPS] || {})
                setTemplates(data[AdminConfigTypes.PPTX_TEMPLATES] || []);
                setRateLimit(data[AdminConfigTypes.RATE_LIMIT || rateLimit]);
                setPromptCostAlert(data[AdminConfigTypes.PROMPT_COST_ALERT || promptCostAlert]);


            } else {
                alert("Unable to fetch admin configurations at this time. Please try again.");
                onClose();
            }
        
            setLoadingMessage("");
            setIsLoading(false);
        }
        if (open && loadData) getConfigs();

        const fetchEmails = async () => {
            setAllEmails(amplifyUsers);
        };
        if (!allEmails) fetchEmails();
      
      }, [open, loadData])
  


      function camelToTitleCase(str: string) {
        return str
            .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between lowercase and uppercase letters
            .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // Keep consecutive uppercase letters together
            .replace(/\$/g, ' $') // Add a space before any dollar sign
            .replace(/^./, char => char.toUpperCase()); // Capitalize the first letter
    }
    
    
    const handleGetEmbeddings = async () => {
        setLoadingEmbeddings(true);
        const resultData = await getInFlightEmbeddings();
        if (resultData) {
            setHasRetrievedEmbeddings(true);
            setEmbeddings({ embeddings:
                resultData as Embedding[]});
        } else {
            alert("Unable to retrieve message currently in the sqs. Please try again later...");
        }

        setLoadingEmbeddings(false);
        setRefreshingTypes(refreshingTypes.filter(t => t !== AdminConfigTypes.EMBEDDINGS));
    }

    const handleTerminateEmbedding = async (key: string) => {
        if (!terminatingEmbeddings.includes(key)) setTerminatingEmbeddings([...terminatingEmbeddings, key]);

        const result = await terminateEmbedding(key);
        if (result) {
            setEmbeddings((prevState) => ({
                embeddings: prevState.embeddings.map((embedding) =>
                    embedding.object.key === key
                        ? { ...embedding, terminated: true } // Set terminate flag to true
                        : embedding
                ),
            }));
        } else {
            alert("Unable to terminate embedding at this time.");
        }
        setTerminatingEmbeddings(terminatingEmbeddings.filter((k:string) => k !== key));
    }
    
    const getConfigTypeData = (type: AdminConfigTypes) => {
        switch (type) {
            case AdminConfigTypes.ADMINS:
                return admins;
            case AdminConfigTypes.RATE_LIMIT:
                return rateLimitObj(rateLimit.period, rateLimit.rate);
            case AdminConfigTypes.PROMPT_COST_ALERT:
                return promptCostAlert;
            case AdminConfigTypes.APP_SECRETS:
                return appSecrets;
            case AdminConfigTypes.APP_VARS:
                return appVars;
            case AdminConfigTypes.FEATURE_FLAGS:
                return features;
            case AdminConfigTypes.AVAILABLE_MODELS:
                return availableModels;
            case AdminConfigTypes.AST_ADMIN_GROUPS:
                return astGroups.filter((g:Ast_Group_Data) => changedAstGroups.includes(g.group_id))
                                .map((g:Ast_Group_Data) =>  ({ group_id: g.group_id, 
                                                              isPublic : g.isPublic,
                                                              amplifyGroups : g.amplifyGroups,
                                                              supportConvAnalysis: g.supportConvAnalysis
                                                            }));
            case AdminConfigTypes.AMPLIFY_GROUPS:
                return ampGroups;
            case AdminConfigTypes.PPTX_TEMPLATES:
                return templates.filter((pptx:Pptx_TEMPLATES) => changedTemplates.includes(pptx.name));
            case AdminConfigTypes.OPENAI_ENDPONTS:
                const toTest:{key: string, url: string, model:string}[] = [];
                const cleanedOpenAiEndpoints: OpenAIModelsConfig = {
                    models: openAiEndpoints.models.map(model => {
                        const newModel: Record<string, { endpoints: Endpoint[] }>= {};
                        Object.keys(model).forEach(modelName => {
                            const endpoints = model[modelName].endpoints
                            .filter(endpoint => endpoint.url !== '' && endpoint.key !== '')
                            .map(endpoint => {
                                // Destructure to exclude 'isNew' from the endpoint
                                const { isNew, ...rest } = endpoint;
                                if (isNew) toTest.push({...rest, model: modelName});
                                return rest; 
                            });
                            newModel[modelName] = { endpoints };
                        });
                        return newModel;
                    })
                };
                if (toTest.length > 0) testEndpointsRef.current = toTest;
                return cleanedOpenAiEndpoints;
        }   
    }

    const processUrl = (url: string) => {
        return url.endsWith('/') ? url : `${url}/`;
    }


    const callTestEndpoints = async () => {
        for (const endpoint of testEndpointsRef.current) {
          const label = `Url: ${endpoint.url}\nKey: ${endpoint.key}`;
          setLoadingMessage(`Testing Endpoint:\n${label}`);
          let result:any = null;
          const model = endpoint.model;
          if (model.includes('embed')) {
            const url = processUrl(endpoint.url);
            const completion = `openai/deployments/${endpoint.model}/embeddings?api-version=2024-02-01`;
            result =  await testEmbeddingEndpoint(`${url}${completion}`, endpoint.key);

          } else if (model === "code-interpreter") {
            const url = processUrl(endpoint.url);
            const completion = "openai/deployments/gpt-4o/chat/completions?api-version=2024-08-01-preview";
            result =  await testEndpoint(`${url}${completion}`, endpoint.key, "gpt-4o");

          } else {
            result =  await testEndpoint(endpoint.url, endpoint.key, model);
          }
         
          if (!result) {
            alert(`Failed to make contact with the new endpoint:\n${label}\n\nPlease check the endpoint data and try saving changes again.`);
            setLoadingMessage(``);
            return false;
          }
        }
        return true;
      };

    const saveUpdateAvailableModels = () => {
        const updatedModels = Object.values(availableModels)
        const defaultId = updatedModels.find((m:SupportedModel) => m.isDefault);
        homeDispatch({ field: 'defaultModelId', value: defaultId });
        const cheapestId = updatedModels.find((m:SupportedModel) => m.defaultCheapestModel);
        homeDispatch({ field: 'cheapestModelId', value: cheapestId });
        const advancedId = updatedModels.find((m:SupportedModel) => m.defaultAdvancedModel);
        homeDispatch({ field: 'advancedModelId', value: advancedId });

        const availModels: Model[] = updatedModels.filter((m:SupportedModel) => m.isAvailable)
                                     .map((m:SupportedModel) => ({ id: m.id,
                                                            "name": m.name,
                                                            "description": m.description ?? '',
                                                            "inputContextWindow": m.inputContextWindow,
                                                            "supportsImages": m.supportsImages,
                                                            } as Model));
        homeDispatch({ field: 'availableModels', value: availModels}); 
    }
      
      

    const handleSave = async () => {
        if (Array.from(unsavedConfigs).length === 0) {
            toast("No Changes to Save");
            return;
        }
        const collectUpdateData =  Array.from(unsavedConfigs).map((type: AdminConfigTypes) => ({type: type, data: getConfigTypeData(type)}));
        // console.log("Saving... ", collectUpdateData);
        // console.log(" testing: ", testEndpointsRef.current);
        if (testEndpointsRef.current.length > 0) {
            setLoadingMessage('Testing New Endpoints...');
            const success = await callTestEndpoints();
            if (!success) {
                setLoadingMessage('');
                if (!confirm("Do you want to continue applying your changes anyway?")) return;
            }
        }
        
        setLoadingMessage('Saving Configurations');
        const result = await updateAdminConfigs(collectUpdateData);
        if (result.success) {
            if (unsavedConfigs.has(AdminConfigTypes.FEATURE_FLAGS)) {
                // to do doesnt account for exclusives think about pulling them again from home same with groups
                homeDispatch({ field: 'featureFlags',
                               value: { ...features, 'adminInterface': admins.includes(userEmail ?? '')} });
                localStorage.setItem('mixPanelOn', JSON.stringify(features.mixPanel ?? false));
            }
            if (unsavedConfigs.has(AdminConfigTypes.AVAILABLE_MODELS)) saveUpdateAvailableModels();
            toast("Configurations successfully saved");
            setUnsavedConfigs(new Set());
            testEndpointsRef.current = [];
        } else {
            if (result.data && Object.keys(result.data).length !== unsavedConfigs.size) {
                const unsucessful: AdminConfigTypes[] = [];
                Array.from(unsavedConfigs).forEach(key => {
                    if ((!(key in result.data)) || (!result.data[key].success)) unsucessful.push(key);
                });
                // should always be true
                if (unsucessful.length > 0) alert(`The following configurations were unable to be saved: \n${unsucessful}`);
            } else {
                alert("We are unable to save the configurations at this time. Please try again later...");
            }
        }

        setLoadingMessage('');
    }

    const updateUnsavedConfigs = (configType: AdminConfigTypes) => {
        setUnsavedConfigs(prevChanges => new Set(prevChanges).add(configType));
    }

    const handleUpdateAdmins = (updatedAdmins: string[]) => {
        setAdmins(updatedAdmins);
        updateUnsavedConfigs(AdminConfigTypes.ADMINS);
    }

    const handleUpdateRateLimit = (updatedRateLimit: {period: PeriodType, rate: string }) => {
        setRateLimit(updatedRateLimit);
        updateUnsavedConfigs(AdminConfigTypes.RATE_LIMIT);
    }

    const handleUpdatePromptCostAlert = (updatedPromptCostAlert: PromptCostAlert) => {
        setPromptCostAlert(updatedPromptCostAlert);
        updateUnsavedConfigs(AdminConfigTypes.PROMPT_COST_ALERT);
    }

    const handleUpdateEndpoints = (updatedModels: OpenAIModelsConfig) => {
        setOpenAiEndpoints(updatedModels);
        updateUnsavedConfigs(AdminConfigTypes.OPENAI_ENDPONTS);
    }

    const handleUpdateAmpGroups = (updatedGroups: Amplify_Groups) => {
        setAmpGroups(updatedGroups);
        updateUnsavedConfigs(AdminConfigTypes.AMPLIFY_GROUPS);
    }
    
    const handleUpdateFeatureFlags = (featureName:string, updatedData: {enabled: boolean,
                                                                        userExceptions?: string[],
                                                                        amplifyGroupExceptions?: string[]}) => {
        setFeatures({
            ...features,
            [featureName]: updatedData,
        });
        updateUnsavedConfigs(AdminConfigTypes.FEATURE_FLAGS);
    }

    const titleLabel = (title: string, textSize: string = "lg") => 
        <div className={`mt-4 text-${textSize} font-bold text-black dark:text-neutral-200`}>
            {title}
        </div>;

    const refresh = (type: AdminConfigTypes, click: () => void, loading: boolean, title:string = 'Refresh Variables', top: string = 'mt-1') => 
        <button
            title={title}
            disabled={refreshingTypes.includes(type)} 
            className={`${top} flex-shrink-0 items-center gap-3 rounded-md border border-neutral-300 dark:border-white/20 px-2 dark:text-white transition-colors duration-200 ${refreshingTypes.includes(type) ? "" : "cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10"}`}
            onClick={() => {
                setRefreshingTypes([...refreshingTypes, type]);
                click();
            }}
        >
            {refreshingTypes.includes(type) ?  <LoadingIcon style={{ width: "16px", height: "16px" }}/> : <IconRefresh size={16}/>}
        </button>
   
    const modelActiveCheck = (key: string, isActive: boolean, title: string) => 
        isAddingAvailModel ? 
        <button title={title} id={key}
                className="cursor-pointer flex flex-row gap-7 dark:text-neutral-200 text-neutral-900"
                onClick={() => {
                    let updated = {...isAddingAvailModel.model, [key]: !isActive};
                    setIsAddingAvailModel({...isAddingAvailModel, model: updated});
                }}>
            {isActive ? <IconCheck className= 'w-[84px] text-green-600 hover:opacity-60' size={18} /> 
                      : <IconX  className='w-[84px] text-red-600 hover:opacity-60' size={18} />}
            {camelToTitleCase(key)}          
        </button>  : null;

    
    const isAvailableCheck = (isAvailable: boolean, handleClick: () => void, styling: string = '') => 
        <button title={isAvailable ? "Click to set as unavailable"        
                                   : "Click to set as available" } 
            className={`cursor-pointer dark:text-neutral-200 text-neutral-900 ${styling}`} 
            onClick={handleClick}>
            {isAvailable ? <IconCheck className='text-green-600 hover:opacity-60' size={18} /> 
                         : <IconX  className='text-red-600 hover:opacity-60' size={18} />}       
        </button>
                                                                                                            // parsing should happen in the change
    const modelNumberInputs = (key: string, value: number | null, step: number, parseInteger: boolean, description: string) => 
        isAddingAvailModel ? <div id={key} title={description} className="flex flex-row gap-3 dark:text-neutral-200 text-neutral-900">
        <input type="number" id={key} title={description}
                className="text-center w-[100px] dark:bg-[#40414F] bg-gray-200"
                min={0} step={step} value={value ?? 0 }
                onChange={(e) => {
                    const value = e.target.value;
                    const val = parseInteger ? parseInt(value) : parseFloat(value);
                    let updated = {...isAddingAvailModel.model, [key]: val};
                    setIsAddingAvailModel({...isAddingAvailModel, model: updated});
                }}
        /> 
        {camelToTitleCase(key.replace('Cost', 'Cost$'))} </div>: null;
    
    
    const scrollToWithOffset = () => {
        const element = supportedModelsRef.current;
        if (!element) return;
      
        // Check if element is already in viewport
        const rect = element.getBoundingClientRect();
        const isInViewport = (
          rect.top >= 0 &&
          rect.top <= window.innerHeight - 300
        );
      
        if (!isInViewport) {
          element.style.position = 'relative';
          element.style.top = '-55px';
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          
          setTimeout(() => {
            element.style.position = '';
            element.style.top = '';
          }, 50);
        }
      };
  

    useEffect(() => {
        if (isAddingAvailModel && supportedModelsRef.current) {
            scrollToWithOffset();
            // supportedModelsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });

        }
      }, [isAddingAvailModel]); // Run when isAddingAvailModel changes
    

    const handleAddOrUpdateAvailableModels = () => {
        if (isAddingAvailModel) {
            const newModel = {...isAddingAvailModel.model};
            if (isAddingAvailModel.action === 'Adding') {
                // check required fields
                if (!newModel.id || !newModel.name || !newModel.provider ||
                      // for availabel models we require inputcontent windonw and token limit otehrwise we dont
                    !(newModel.isAvailable ? newModel.inputContextWindow && newModel.outputTokenLimit : true)
                ) {
                alert("Required fields missing: Please provide ID, name, and provider. If the model is available, include input context window and output token limit. Ensure all required data is set and try again.");
                    return;
                }
            }
            setAvailableModels({...availableModels, [newModel.id]: newModel})
            updateUnsavedConfigs(AdminConfigTypes.AVAILABLE_MODELS);
        }
    }


    const handleUpdateDefaultModel = (modelId: string, selectedKey:  keyof SupportedModel) => {
        setAvailableModels((prevAvailableModels) => {
            const updatedModels: SupportedModelsConfig = {};
    
            Object.keys(prevAvailableModels).forEach((key) => {
                const model = prevAvailableModels[key];
                updatedModels[key] = { // Update the selectedKey property
                    ...model,
                    [selectedKey]: model.id === modelId, // Set to true if it's the selected model, otherwise false
                };
            });
    
            return updatedModels;
        });
        updateUnsavedConfigs(AdminConfigTypes.AVAILABLE_MODELS);
    }

    const handleAstGroupChange = (groupId: string, astGroupData: Ast_Group_Data[]) => {
        setAstGroups(astGroupData);
        if (!changedAstGroups.includes(groupId)) setChangedAstGroups([...changedAstGroups, groupId]);
        updateUnsavedConfigs(AdminConfigTypes.AST_ADMIN_GROUPS);
    }

    const handleTemplateUpload = async (fileName: string) => {
        if (isAddingTemplate && uploadedTemplate ) {
            setIsUploadingTemplate(true);
            try {
                const md5 = await calculateMd5(uploadedTemplate);
                const result = await uploadPptx({fileName: fileName,
                                                isAvailable: isAddingTemplate.isAvailable, 
                                                amplifyGroups : isAddingTemplate.amplifyGroups,
                                                contentType: uploadedTemplate.type,
                                                md5: md5
                                            });
                if (result.success && result.presigned_url) {
                    const presigned = result.presigned_url;
                    const uploadResult = await uploadFileAsAdmin(presigned, uploadedTemplate, md5,
                        {'x-amz-meta-isavailable': String(isAddingTemplate.isAvailable),  
                        'x-amz-meta-amplifygroups': isAddingTemplate.amplifyGroups.join(",") }
                    );

                    if (uploadResult) {
                        setTemplates([...templates, isAddingTemplate]);
                        setIsAddingTemplate(null);
                        setUploadedTemplate(null);
                        setIsUploadingTemplate(false);
                        toast("PowerPoint template was successfully added."); 
                        return;
                    }
                } 
            } catch (error) {
                console.log("Error getting presigned url and uploading.", error);
            }
        }
        alert("Unable to add the PowerPoint template at this time. Please try again later.");
        setIsUploadingTemplate(false);
        
    }

    const handleDataDisclosureUpload = async (file:File) => {
        const type =  file.type;
        const latestName = `data_disclosure_${generateTimestamp()}.pdf`;
        const pdfFile = new File([file], latestName, { type: type });
        try {
            const md5 = await calculateMd5(pdfFile);
            console.log(md5);  
            const result = await uploadDataDisclosure({ fileName: latestName,
                                                        contentType : type,
                                                        md5: md5,
                                                     });
            if (result.success && result.presigned_url) {
                const uploadResult = await uploadFileAsAdmin(result.presigned_url, pdfFile, md5);
                if (uploadResult) {
                    setDataDisclosureUploaded(true);
                    return;  
            }  
        }
        } catch (error) {
            console.log("Error getting presigned url and uploading.", error);
        } 
        alert("Unable to upload the Data Disclosure file at this time. Please try again later."); 
    }

    const handleApiDocUpload = async (file: File) => {
        try {
            const md5 = await calculateMd5(file);
            const result = await uploadApiDoc(file.name, md5);
            if (result.success && result.presigned_url) {
                const uploadResult = await uploadFileAsAdmin(result.presigned_url, file, md5);
                if (uploadResult) {
                    const fileType = file.name.split('.').pop()?.toLowerCase();
                    setApiDocsUploaded({...apiDocsUploaded, [fileType as 'csv' | 'docx' | 'json']: true});
                    return;
                }
            }
        } catch (error) {
            console.log(`Failed to get presigned url api doc. ${error}`);
        }
        alert("Unable to upload the API Documentation at this time. Please remove the document and try uploading again.");
    }


    const handleDownloadApiDocTemplates = async () => {
        setLoadingMessage("Preparing to Download...");
        const result = await fetchApiDocTemplates();
        if (result && result.presigned_url) {
            try {
                const link = document.createElement('a');
                link.href = result.presigned_url;
                link.download = 'Amplify_API_Templates.zip';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setLoadingMessage("");
                return
            } catch (error) {
                console.error("Download error:", error);
            } 
        } 
        alert("Failed to download API Documentation Templates. Please try again later...");
        setLoadingMessage("");
    }

    const handleTemplateChange = (name: string, updatedTemplates: Pptx_TEMPLATES[]) => {
        setTemplates(updatedTemplates);
        if (!changedTemplates.includes(name)) setChangedTemplates([...changedTemplates, name]);
        updateUnsavedConfigs(AdminConfigTypes.PPTX_TEMPLATES);
    }

    const handleRegisterOps = async () => {
        setIsRegisteringOps(true);
        const updatedNewOps = [...newOps];
        for (let i = 0; i < updatedNewOps.length; i++) {
            const op:OpDef = updatedNewOps[i];
            if (!op.id || !op.url || (op.tags && op.tags.length === 0)) {
                alert('One or more operations have missing function name, endpoint path, or empty tags.');
                setIsRegisteringOps(false);
                return;
            } else if (op.method && ["GET", "DELETE"].includes(op.method)) {
                // ensure get and delete do not have params 
                updatedNewOps[i] = {...op, params: []}
            }
        }
        const result = await registerOps(updatedNewOps);
        if (result.success) {
            setOpSearchTerm('');
            setOps([...ops, ...updatedNewOps]);
            setNewOps([]);
            toast("Successfully registered ops");
        } else {
            alert("Failed to register ops. Please try again later...");
        }
        setIsRegisteringOps(false);
    }

    const handleDeleteOp = async (op: OpDef, index: number) => {
        setIsDeletingOp(index);
        if (confirm("Are you sure you want to delete this Op? You will not be able to undo this change.")) {
            // call delete and if successfull toast and setTemplates to filter our 
            const result = await deleteOp({
                                    id: op.id,
                                    name: op.name,
                                    tags: op.tags, 
                                    url: op.url
                                 });
            if (result.success) {
                toast("Successfully deleted OP");
                setOps((prevItems) => prevItems.filter((i) => i.id !== op.id));
            } else {
                alert("Unable to delete the Op. Please try again...");
            }
        }  
        setIsDeletingOp(-1);
    }
    

    const handleReplaceGroupKey = async (groupId: string) => {
        setKeyReplacementLoading(groupId);
        const result = await replaceAstAdminGroupKey(groupId);
        if (result) {
            
            toast("Group API key successfully replaced.");
        } else {
            alert("Unable to replace the groups API key. Please try again...");
        }
        setKeyReplacementLoading('');

    }



    const handleCreateAmpAsts = async ( ) => {
        if (creatingAmpAsts) {
            if (creatingAmpAsts.length === 0) {
                alert("You must select at least one Amplify assistant to continue.");
                return;
            }
            setIsCreatingAmpAstGroup(true);
            const astDefs = creatingAmpAsts.map((ast: string) => (amplifyAssistants as any)[ast]);
            const result = await createAmplifyAssistants(astDefs, admins);
            if (result.success) {
                const groupId = result.data.id;
                setAmplifyAstGroupId(groupId);
                const ampAstGroup = {
                    group_id : groupId, 
                    groupName : "Amplify Assistants", 
                    amplifyGroups : [],
                    createdBy : userEmail,
                    isPublic : false,
                    numOfAssistants: astDefs.length,
                    supportConvAnalysis: false
                } as Ast_Group_Data;
                setAstGroups([...astGroups, ampAstGroup]);
                toast("Successfully created Amplify Assistants group");
                setIsCreatingAmpAstGroup(false);
                return;
            }
        }
        alert("Failed to create Amplify Assistant group. Please try again later...");
        setIsCreatingAmpAstGroup(false);
    }

    const handleAddAssistant = async (astDefs: AssistantDefinition[] ) => {
        const asts = astDefs.map((ast: any) => {
            const updatedData = {...ast.data, groupId: amplifyAstGroupId};
            return {...ast, groupId: amplifyAstGroupId, data: updatedData};
        });
        const updateAstData = { "group_id": amplifyAstGroupId, 
                                "update_type": GroupUpdateType.ADD, 
                                "assistants": asts };
        statsService.updateGroupAssistantsEvent(updateAstData);
        const result = await updateGroupAssistants(updateAstData);
        setIsAddingAst('');
        if (result.success) {
            toast("Successfully added assistant");
        } else {
            alert("Unable to add a copy of the assistant at this time. Please try again later...");
        }
    }

    const handleDeleteTemplate = async (name: string) => {
        if (confirm("Are you sure you want to delete this PowerPoint Template? You will not be able to undo this change.")) {
            setDeletingTemplate(name);
            const result = await deletePptx(name);

            if (result) {
                toast(`Successfully deleted PowerPoint template ${name}`);
                setTemplates(templates.filter((t:Pptx_TEMPLATES) => t.name !== name));
            } else {
                alert("Unable to delete the PowerPoint template at this time. Please try again later...");
            }
            setDeletingTemplate('');
        }  
    }
    

        
    if (!open || isLoading) return <></>;

    return <Modal 
    width={() => window.innerWidth - 100}
    height={() => window.innerHeight * 0.95}
    title={`Admin Interface${unsavedConfigs.size > 0 ? " * " : ""}`}
    onCancel={() => {
        if (unsavedConfigs.size === 0 || confirm("You have unsaved changes!\n\nYou will lose any unsaved data, would you still like to close the Admin Interface?"))  onClose();
       
    }} 
    onSubmit={() => handleSave()
    }
    submitLabel={"Save Changes"}
    content={
      <div className="text-black dark:text-white overflow-x-hidden">
         <button
            title={`Reload Admin Interface. ${unsavedConfigs.size > 0 ? "Any unsaved changes will be lost.": ""}`}
            className={` fixed top-4 left-[205px] flex-shrink-0 items-center gap-3 rounded-md border border-neutral-300 dark:border-white/20 p-2 dark:text-white transition-colors duration-200 cursor-pointer hover:bg-neutral-200  dark:hover:bg-gray-500/10`}
            onClick={() => {
                setIsLoading(true);
                setLoadData(true);
                setUnsavedConfigs(new Set());
            }}
        >
            <IconRefresh size={16}/>
        </button>

         <ActiveTabs
            width={() => window.innerWidth * 0.9}
            tabs={[


///////////////////////////////////////////////////////////////////////////////

                // Configurations Tab

                {label: `Configurations${adminTabHasChanges(Array.from(unsavedConfigs), 'config') ? " * " : ""}`, 
                 title: unsavedConfigs.size > 0 ? " Contains Unsaved Changes  " : "",
                 content:
                    <> 
                    {titleLabel('Admins')}
                    <div className="ml-10 flex flex-col gap-6 mt-2">
                            <div className="relative z-10 flex flex-row gap-2.5 h-0" style={{ transform: `translateX(160px)` }}>
                                {admins.length > 0 &&
                                <button onClick={ () => setIsDeleting(true)} style={{ display: 'flex', cursor: 'pointer' }}
                                    className="flex flex-shrink-0"
                                    title={"Remove Admins"}
                                    >
                                    <IconTrash className="mt-0.5" size={15}/>
                                    <span style={{marginLeft: '10px'}}>{"Remove Admins"}</span>
                                </button>}

                                {isDeleting && 
                                <>
                                    <UserAction
                                        label={"Remove Admins"}
                                        onConfirm={() => {
                                            if (deleteUsersList.length > 0) {
                                                const updatedAdmins = admins.filter(admin => !deleteUsersList.includes(admin));
                                                handleUpdateAdmins(updatedAdmins);
                                            }
                                        }}
                                        onCancel={() => {
                                            setIsDeleting(false);
                                            setDeleteUsersList([]);
                                        }}
                                        top="mt-[2px]"
                                    />
                                    <div className="mt-[-2px]">
                                        <Checkbox
                                            id={`selectAll${AdminConfigTypes.ADMINS}`}
                                            label=""
                                            checked={deleteUsersList.length === admins.length}
                                            onChange={(isChecked: boolean) => {
                                                if (isChecked) {
                                                    // If checked, add all user names to the list
                                                    setDeleteUsersList(admins.map((a:string) => a));
                                                } else {
                                                    setDeleteUsersList([]);
                                                }
                                            }}
                                        />
                                    </div>
                                </>
                                }
                            </div>
                            <div className='w-full pr-20 relative min-w-[300px]'
                                style={{ transform: `translateY(-24px)` }}>

                                <ExpansionComponent 
                                    title={'Add Admins'} 
                                    content={ 
                                        <AddEmailWithAutoComplete
                                        key={String(AdminConfigTypes.ADMINS)}
                                        emails={admins}
                                        allEmails={allEmails ?? []}
                                        handleUpdateEmails={(updatedAdmins: Array<string>) => handleUpdateAdmins(updatedAdmins)}
                                        />
                                    }
                                    closedWidget= { <IconPlus size={18} />}
                                />

                            </div>

                    </div>
                        
                    <div className="ml-10 pr-5 ">
                    
                        {admins.length === 0 ? (
                                <div className="ml-4">No admins to display</div>
                            ) : (
                                <div className="flex flex-wrap ">
                                {admins
                                    .map((user, index) => (
                                    <div key={index} className="border border-neutral-500 flex items-center">
                                        <div
                                        className="flex items-center"
                                        onMouseEnter={() => setHoveredUser(user)}
                                        onMouseLeave={() => setHoveredUser(null)}
                                        >
                                        <div className="min-w-[28px] flex items-center ml-2">
                                        {hoveredUser === user && !isDeleting && (
                                            <button
                                            type="button"
                                            className="p-0.5 text-sm bg-neutral-400 dark:bg-neutral-500 rounded hover:bg-red-600 dark:hover:bg-red-700 focus:outline-none"
                                            onClick={() => handleUpdateAdmins(admins.filter((u: string) => u !== user))}
                                            >
                                            <IconTrash size={16} />
                                            </button>
                                        )}
                                            {isDeleting && (
                                            <div className="ml-0.5">
                                                <Checkbox
                                                    id={`${index}${AdminConfigTypes.ADMINS}`}
                                                    label=""
                                                    checked={deleteUsersList.includes(user)}
                                                    onChange={(isChecked: boolean) => {
                                                        if (isChecked) {
                                                            setDeleteUsersList((prevList) => [...prevList, user]);
                                                } else {
                                                    setDeleteUsersList((prevList) =>
                                                    prevList.filter((name) => name !== user)
                                                    );
                                                }
                                                    }}
                                                />
                                            </div>
                                            )}
                                        </div>
                                        <span className="truncate pr-8 py-2 mr-1">{user}</span>
                                    
                                        </div>
                                    </div>
                                    ))}
                            </div>)}

                    </div>

                    <div className="flex flex-row gap-6">
                    {titleLabel('Chat Rate Limit')}
                        <span className="mt-4 h-[28px] flex flex-row gap-4">
                        <RateLimiter
                            period={rateLimit.period}
                            setPeriod={(p: PeriodType) => handleUpdateRateLimit({...rateLimit, period: p})}
                            rate={rateLimit.rate ? String(rateLimit.rate) : '0'}
                            setRate={(r: string) => handleUpdateRateLimit({...rateLimit, rate: r})}
                        /></span>
                    
                    </div>

                    {titleLabel('Prompt Cost Alert')}
                    <div className="px-6 mr-4">
                    <Checkbox
                        id="promptCostAlert"
                        label="Alert the user when the cost of their prompt exceeds the set threshold"
                        checked={promptCostAlert.isActive}
                        onChange={(isChecked: boolean) => {
                            handleUpdatePromptCostAlert({...promptCostAlert, isActive: isChecked});
                        }}
                    />
                    <div className={`ml-6 flex flex-col ${promptCostAlert.isActive ? "" :'opacity-30'}`}>
                        <div className="text-md w-full text-center">Alert Message</div>
                        <InfoBox 
                            content={
                            <span className="text-sm w-full text-center"> 
                                To include dynamic values like the total cost or the number of prompts in the alert message, use placeholders in the following format: {"<placeholderName>"}.
                                <br className="mt-1"></br>
                                    Optional Supported Tags:<br></br>
                                <div className="flex justify-center text-start">
                                    &nbsp;&nbsp;&nbsp;&nbsp; * {"<totalCost>"}: Displays the calculated cost of sending the prompt.
                                    <br></br>
                                    &nbsp;&nbsp;&nbsp;&nbsp; * {"<prompts>"}: Displays the number of prompts needed to send their prompt.
                                </div>
                            </span>
                            }
                        />
                        <textarea title="Parameter Description" className="w-full rounded-r border border-neutral-500 px-4 py-1 dark:bg-[#40414F] bg-gray-200 dark:text-neutral-100 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50"
                        placeholder={"Alert message to display when the users prompt will cost over the threshold"}
                        value={promptCostAlert.alertMessage}
                        onChange={(e) => {
                            handleUpdatePromptCostAlert({...promptCostAlert, alertMessage: e.target.value});
                        }}
                        rows={1} 
                        />
                        <div className="mt-2 flex flex-row gap-3">
                        Cost Threshold
                        <input type="number"
                                className="text-center w-[100px] dark:bg-[#40414F] bg-gray-200"
                                min={0} step={.01} value={promptCostAlert.cost as number?? 0 }
                                onChange={(e) => {
                                    const value = parseFloat(e.target.value);
                                    handleUpdatePromptCostAlert({...promptCostAlert, cost: value});
                                }}
                        /> 
                        </div>
                    </div>
                    </div>

                    <div className="flex flex-row gap-3 mb-2 ">
                    {titleLabel('Amplify Groups')}
                    <button
                        title={isAddingAmpGroups ? "" : 'Add Amplify Group'}
                        disabled={isAddingAmpGroups !== null}
                        className={`ml-1 mt-3 flex-shrink-0 items-center gap-3 rounded-md border border-neutral-300 dark:border-white/20 px-2 transition-colors duration-200  ${ isAddingAmpGroups ? "" : " cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10" }`}
                        onClick={() => setIsAddingAmpGroups(emptyAmplifyGroups(userEmail ?? 'unknown'))}
                    >
                        <IconPlus size={16}/>
                    </button>

                    {isAddingAmpGroups && 
                        <UserAction
                        top={"mt-4"}
                        label={"Add Template"}
                        clearOnConfirm={false}
                        onConfirm={() => {
                            const name = isAddingAmpGroups.groupName;
                            if (!name) {
                                alert(`Group name is required. Please enter a name and try again.`);
                                return;
                            }
                            if (Object.keys(ampGroups).includes(name)){
                                alert(`There already exists a group with the name ${name}.\n\n Please change the group name to create the Amplify Group.`);
                            } else {
                                setAmpGroupSearchTerm('');
                                handleUpdateAmpGroups({...ampGroups, [name] : isAddingAmpGroups});
                                setIsAddingAmpGroups(null);
                            }
                        }}
                        onCancel={() => {
                            setIsAddingAmpGroups(null);
                        }}
                    /> 
                    }

                    { showAmpGroupSearch && !isAddingAmpGroups && Object.keys(ampGroups).length > 0 &&
                            <div className="ml-auto mr-12" style={{transform: 'translateY(36px)'}}>
                                <Search
                                placeholder={'Search Amplify Groups...'}
                                searchTerm={ampGroupSearchTerm}
                                onSearch={(searchTerm: string) => setAmpGroupSearchTerm(searchTerm.toLocaleLowerCase())}
                                />
                            </div>}

                </div>
                
                {isAddingAmpGroups && 
                    <div className="ml-6 flex flex-row flex-shrink-0 mr-4 ">
                        <label className="flex-shrink-0 border border-neutral-400 dark:border-[#40414F] p-2 rounded-l text-[0.9rem] whitespace-nowrap text-center"
                        >Group Name </label>
                        <input
                        title={"Group names must be unique"}
                        className="w-[200px] rounded-r border border-neutral-500 px-4 py-1 dark:bg-[#40414F] bg-gray-200 dark:text-neutral-100 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50"
                        placeholder={"Group Name"}
                        onChange={(e) => {
                            setIsAddingAmpGroups({...isAddingAmpGroups, groupName: e.target.value});
                        }}
                        value={isAddingAmpGroups.groupName}
                        />
                        <div className="ml-4 flex-grow flex flex-col mt-[-32px] max-w-[40%]">
                            <AddEmailWithAutoComplete
                                            key={`${String(AdminConfigTypes.AMPLIFY_GROUPS)}_ADD`}
                                            emails={isAddingAmpGroups.members}
                                            allEmails={allEmails ?? []}
                                            handleUpdateEmails={(updatedEmails: Array<string>) => 
                                                setIsAddingAmpGroups({...isAddingAmpGroups, members : updatedEmails})
                                            }
                            />
                            <div className="h-[40px] rounded-r border border-neutral-500 pl-4 py-1 dark:bg-[#40414F] bg-gray-200 dark:text-neutral-100 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 overflow-x-auto">
                            {isAddingAmpGroups.members.map((user, idx) => (
                                <div key={idx} className="flex items-center gap-1 mr-1">
                                    <span className="flex flex-row gap-4 py-2 mr-4"> 
                                        {user} 
                                        <button
                                        className={`text-red-500 hover:text-red-800 `}
                                        onClick={() => {
                                            const updatedMembers = isAddingAmpGroups.members.filter(
                                                                    (u) => u !== user);
                                            setIsAddingAmpGroups({...isAddingAmpGroups, members : updatedMembers})
                                        }} >
                                        <IconTrash size={16} />
                                        </button>
                                    </span>
                                </div>
                                ))}
                            </div>
                                    
                        </div>
                        <div className="flex-grow ml-4 flex flex-col mt-[-32px] max-w-[40%]">
                            <InfoBox content={
                                    <span className="ml-1 text-xs w-full text-center"> 
                                    The group will include all members from the following Amplify Groups
                                    </span>
                                }/>
                              
                            <AmplifyGroupSelect 
                                groups={Object.keys(ampGroups)}
                                selected={isAddingAmpGroups.includeFromOtherGroups ?? []}
                                setSelected={(selectedGroups: string[]) => {
                                    setIsAddingAmpGroups({...isAddingAmpGroups, includeFromOtherGroups: selectedGroups});
                                }}
                            /> 
                        </div>
                    </div>
                }


                <div className="ml-6">
                    {Object.keys(ampGroups).length > 0 ?
                            <ExpansionComponent 
                            onOpen={() => setShowAmpGroupsSearch(true)}
                            onClose={() => {
                                setShowAmpGroupsSearch(false);
                                setAmpGroupSearchTerm('');
                            }}
                            title={'Manage Amplify Groups'} 
                            content={ 
                                <>
                                <table className="mt-4 border-collapse w-full mr-10" >
                                    <thead>
                                    <tr className="bg-gray-200 dark:bg-[#373844] ">
                                        {['Group Name', 'Members', 'Membership by Amplify Groups', 'Created By'
                                        ].map((title, i) => (
                                        <th key={i}
                                            className="px-1 text-center border border-gray-500 text-neutral-600 dark:text-neutral-300"
                                            style={{width: i === 0 || i === 3 ? "15%" 
                                                    : "35%", 
                                            }}> 
                                            {title}
                                        </th>
                                        ))}
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {Object.values(ampGroups)
                                            .filter((group: Amplify_Group) => ampGroupSearchTerm ? 
                                                    group.groupName.toLowerCase().includes(ampGroupSearchTerm) : true)
                                            .map((group: Amplify_Group) => 
                                        <tr key={group.groupName}
                                            onMouseEnter={() => setHoveredAmpGroup(group.groupName)}
                                            onMouseLeave={() => setHoveredAmpGroup('')}>
                                            <td className="border border-neutral-500 px-4 py-2 break-words max-w-[200px]">
                                                {group.groupName}
                                            </td>

                                            <td className="flex-grow border border-neutral-500 pl-1 pr-2 max-w-[300px]">

                                            <div className={`flex items-center ${addingMembersTo === group.groupName ? "flex-col":'flex-row'}`}>
                                            <div
                                                className={`flex items-center ${addingMembersTo === group.groupName ? "flex-wrap": "overflow-x-auto"}`} >
                                                {group.members?.map((user, idx) => (
                                                <div key={idx} className="flex items-center gap-1 mr-1"
                                                    onMouseEnter={() => {
                                                        if (group.includeFromOtherGroups !== undefined)
                                                            setHoveredAmpMember( {ampGroup: group.groupName,     
                                                                                    username: user})
                                                    }}
                                                    onMouseLeave={() => setHoveredAmpMember(null)}>
                                                    
                                                    <span className="flex flex-row gap-1 py-2 mr-4"> {idx > 0 && <label className="opacity-60">|</label>}
                                                        { hoveredAmpMember?.ampGroup === group.groupName && hoveredAmpMember?.username === user ?
                                                        <button
                                                        className={`text-red-500 hover:text-red-800 `}
                                                        onClick={() => {
                                                            const updatedMembers = group.members?.filter(
                                                            (u) => u !== user
                                                            );
                                                            const updatedGroup = {...group, members: updatedMembers}
                                                            handleUpdateAmpGroups({...ampGroups, [group.groupName] : updatedGroup});
                                                        }} >
                                                        <IconTrash size={16} />
                                                        </button> : <div className="w-[16px]"></div>}
                                                        {user} 
                                                    </span>
                                                </div>
                                                ))}
                                            </div>

                                            {addingMembersTo === group.groupName && 
                                                group.includeFromOtherGroups !== undefined ? (
                                                <div className="flex flex-row pr-3 ml-2 mt-2" style={{ width: '100%' }}>
                                                <ActionButton
                                                    title="Close"
                                                    handleClick={() => setAddingMembersTo(null)}
                                                >
                                                    <IconX size={20}/>   
                                                </ActionButton>
                                                
                                                <div className=""> <AddEmailWithAutoComplete
                                                    key={`${String(AdminConfigTypes.AMPLIFY_GROUPS)}_EDIT`}
                                                    emails={group.members ?? []}
                                                    allEmails={allEmails ?? []}
                                                    handleUpdateEmails={(updatedMembers: Array<string>) => {
                                                        const updatedGroup = {...group, members: updatedMembers}
                                                        handleUpdateAmpGroups({...ampGroups, [group.groupName] : updatedGroup});
                                                    }}
                                                /> </div>
                                                </div>
                                            ) : (
                                                (group.includeFromOtherGroups !== undefined ?
                                                <button
                                                className="ml-auto flex items-center px-2 text-blue-500 hover:text-blue-600 flex-shrink-0"
                                                onClick={() => setAddingMembersTo(group.groupName)}
                                                >
                                                <IconPlus size={18} />
                                                {!(group.members && group.members.length > 0) && (
                                                    <span>Add Members</span>
                                                )}
                                                </button> : null)
                                            )}
                                            </div>
                                        </td>

                                            <td className="border border-neutral-500 max-w-[300px]">
                                                {group.includeFromOtherGroups !== undefined ?
                                                <AmplifyGroupSelect 
                                                    groups={Object.keys(ampGroups).filter((k: string) => 
                                                                                k != group.groupName)}
                                                    selected={group.includeFromOtherGroups}
                                                    setSelected={(selectedGroups: string[]) => {
                                                        const updatedGroup = {...group, includeFromOtherGroups: selectedGroups}
                                                        handleUpdateAmpGroups({...ampGroups, [group.groupName] : updatedGroup});
                                                    }}
                                                /> : <div className="text-center">N/A</div>
                                                }
                                            </td>

                                            <td className="text-center border border-neutral-500 px-4 py-2 break-words max-w-[300px]">
                                                {group.createdBy}
                                            </td>

                                            <td>
                                                <div className="w-[50px] flex-shrink-0">
                                                {hoveredAmpGroup === group.groupName && group.includeFromOtherGroups !== undefined ?
                                                <button
                                                    title={"Delete Amplify Group"}
                                                    type="button"
                                                    className="ml-2 p-1 text-sm bg-neutral-400 dark:bg-neutral-500 rounded hover:bg-red-600 dark:hover:bg-red-700 focus:outline-none"
                                                    onClick={() => {
                                                        const { [group.groupName]: _, ...remainingGroups } = ampGroups;
                                                        handleUpdateAmpGroups(remainingGroups);
                                                    }}
                                                    >
                                                    <IconTrash size={20} />
                                                </button>
                                                
                                                : null}
                                                </div>
                                            </td>
                                        </tr>     
                                    )}
                                    </tbody>
                                </table> 
            
                                </>
                            }
                            isOpened={true}
                        />  
                            :
                            <>No Amplify Groups listed. </>
                        }
                </div>
                
                </>
            },


///////////////////////////////////////////////////////////////////////////////
            // Supported Models

            {label: 'Supported Models',
                content:
                <>
                    <div ref={supportedModelsRef} className="flex flex-row gap-3 mb-2" >
                    {titleLabel('Supported Models')}
                    <button
                        title={isAddingAvailModel ? '' : 'Add Model'}
                        disabled={isAddingAvailModel !== null}
                        className={`ml-1 mt-3 flex-shrink-0 items-center gap-3 rounded-md border border-neutral-300 dark:border-white/20 px-2 transition-colors duration-200  ${ isAddingAvailModel ? "" : " cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10" }`}
                        onClick={() => {
                            setIsAddingAvailModel({ model: emptySupportedModel(), action: 'Adding'});
                        }
                        }
                    >
                        <IconPlus size={16}/>
                    </button>

                    {isAddingAvailModel && 
                        <UserAction
                        top={"mt-4"}
                        label={"Add Model"}
                        onConfirm={() => {
                            setModelsSearchTerm('');
                            handleAddOrUpdateAvailableModels();
                        }}
                        onCancel={() => {
                            setIsAddingAvailModel(null);
                        }}
                    />
                    
                    }
                    { showModelsSearch && Object.keys(availableModels).length > 0 && !isAddingAvailModel &&
                    <div className="ml-auto mr-16" style={{transform: 'translateY(14px)'}}>
                        <Search
                        placeholder={'Search Models...'}
                        searchTerm={modelsSearchTerm}
                        onSearch={(searchTerm: string) => setModelsSearchTerm(searchTerm.toLocaleLowerCase())}
                        />
                    </div>}
                    </div>
                    <div className="mx-4"> 
                        {isAddingAvailModel && 
                         <div className="flex flex-col mx-8 mb-6">
                            <label className="text-[1.05rem] w-full text-center"> {isAddingAvailModel.action} Model</label>

                            <div className="flex flex-row gap-6 mb-4 w-full"> 
                                <div className="flex-grow">
                                    <InputsMap
                                    id = {AdminConfigTypes.AVAILABLE_MODELS}
                                    inputs={ [ {label: 'Model ID', key: 'id', placeholder: 'Model ID', disabled: isAddingAvailModel.model.isBuiltIn},
                                                {label: 'Name', key: 'name', placeholder: 'Model Name'},
                                                {label: "Description", key: 'description', placeholder: 'Description Displayed to the User'},
                                                {label: 'System Prompt', key: 'systemPrompt', placeholder: 'Additional System Prompt', 
                                                 description: "This will be appended to the system prompt as an additional set of instructions." 
                                                },
                                            ]}
                                    state = {{id : isAddingAvailModel.model.id, 
                                            description : isAddingAvailModel.model.description, 
                                            name: isAddingAvailModel.model.name, 
                                            systemPrompt: isAddingAvailModel.model.systemPrompt
                                        }}
                                    inputChanged = {(key:string, value:string) => {
                                        let updated = {...isAddingAvailModel.model, [key]: value};
                                        setIsAddingAvailModel({...isAddingAvailModel, model: updated});
                                    }}
                                    /> 
                                    <div className="flex flex-row"> 
                                        <div className="w-[122px] border border-neutral-400 dark:border-[#40414F] p-2 rounded-l text-[0.9rem] whitespace-nowrap text-center"
                                            title={"Provider"}
                                            >
                                            {"Provider"}
                                        </div>

                                        <div className="max-w-[730px]">
                                        { Object.values(providers).map((p:keyof typeof providers) => 
                                            <button key={p}
                                            className={`w-[182.5px] h-[39px] rounded-r border border-neutral-500 px-4 py-1 dark:bg-[#40414F] bg-gray-300 dark:text-neutral-100 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 
                                            ${p === isAddingAvailModel.model.provider as keyof typeof providers ? "cursor-default" : "opacity-60 hover:opacity-80"}`}
                                            disabled={p === isAddingAvailModel.model.provider as keyof typeof providers}
                                            onClick={() => {
                                                let updated = {...isAddingAvailModel.model, provider: p};
                                                setIsAddingAvailModel({...isAddingAvailModel, model: updated})
                                            }}>
                                            {p}
                                            </button>
                                            
                                        )}
                                        </div>
                                    </div>


                                </div>

                                <div className="mx-6 flex flex-col gap-1.5 mt-3"> 
                                    {modelNumberInputs('inputContextWindow', isAddingAvailModel.model.inputContextWindow, 1000, true,
                                         "Models Conversation Input Token Context Window" )}

                                    {modelNumberInputs('inputTokenCost', isAddingAvailModel.model.inputTokenCost, .0001, false,
                                         "Models Input Token Cost/1k" )}

                                    {modelNumberInputs('outputTokenLimit', isAddingAvailModel.model.outputTokenLimit, 1000, true, 
                                        "Output Token Limit Set By Models Provider" )}

                                    {modelNumberInputs('outputTokenCost', isAddingAvailModel.model.outputTokenCost, .0001, false,
                                         "Models Output Token Cost/1k" )}
                                    {modelActiveCheck('supportsSystemPrompts', isAddingAvailModel.model.supportsSystemPrompts, "Model Supports System Prompts" )}

                                    {!isAddingAvailModel.model.id.includes('embed') && <>
                                    {modelActiveCheck('supportsImages', isAddingAvailModel.model.supportsImages,
                                                      "Model Supports Base-64 Encoded Images Attached to Prompts" )}
                                    {modelActiveCheck('isAvailable', isAddingAvailModel.model.isAvailable, 
                                                      "Is Available to All Amplify Users as a Model Selection Options" )}
                                    </>}
                                </div> 

                            </div>  

                                <InfoBox content={
                                    <span className="text-xs w-full text-center"> 
                                    If the Model is not available for all users, it will be exclusively available for the following Amplify Groups
                                    </span>
                                }/>
                                
                                <AmplifyGroupSelect 
                                    groups={Object.keys(ampGroups)}
                                    selected={isAddingAvailModel.model.exclusiveGroupAvailability ?? []}
                                    setSelected={(selectedGroups: string[]) => {
                                        const updated = {...isAddingAvailModel.model, 
                                                         exclusiveGroupAvailability: selectedGroups};
                                        setIsAddingAvailModel({...isAddingAvailModel, model: updated})
                                    }}
                                />
                         </div>    
                        }

                        {Object.keys(availableModels).length > 0 ?
                        <div className="mr-4">
                            <div className="mt-4 flex flex-row justify-between mr-8"> 
                                <ModelDefaultSelect 
                                    models={Object.values(availableModels).filter((m:SupportedModel) => 
                                            m.isAvailable && !m.id.includes('embedding'))}
                                    selectedKey="isDefault"
                                    label="Default User Model"
                                    description="This will be the default selected model for user conversations"
                                    setUpdatedModels={handleUpdateDefaultModel}
                                />

                                <ModelDefaultSelect 
                                    models={Object.values(availableModels).filter((m:SupportedModel) => 
                                            m.isAvailable && !m.id.includes('embedding'))}
                                    selectedKey="defaultAdvancedModel"
                                    label={camelToTitleCase('defaultAdvancedModel')}
                                    description="The advanced model is used for requests needing more complex reasoning and is automatically utilized by Amplify when required."
                                    setUpdatedModels={handleUpdateDefaultModel}
                                />

                                <ModelDefaultSelect 
                                    models={Object.values(availableModels).filter((m:SupportedModel) => 
                                            m.isAvailable && !m.id.includes('embedding'))}
                                    selectedKey="defaultCheapestModel"
                                    label={camelToTitleCase('defaultCheapestModel')}
                                    description="The cheapest model is used for requests requiring less complex reasoning and is automatically utilized by Amplify when required."
                                    setUpdatedModels={handleUpdateDefaultModel}
                                />

                                <ModelDefaultSelect 
                                    models={Object.values(availableModels).filter((m:SupportedModel) => 
                                            m.id.includes('embed'))}
                                    selectedKey="defaultEmbeddingsModel"
                                    label={camelToTitleCase('defaultEmbeddingsModel')}
                                    description="The embedding model will be used when requesting embeddings"
                                    setUpdatedModels={handleUpdateDefaultModel}
                                />

                                <ModelDefaultSelect                     
                                    models={Object.values(availableModels).filter((m:SupportedModel) => !m.id.includes('embed'))}
                                    selectedKey="defaultQAModel"
                                    label={camelToTitleCase('defaultQ&AModel')}
                                    description="The Q&A model will be used for generating context-aware questions to enhance document embeddings"
                                    setUpdatedModels={handleUpdateDefaultModel}
                                />
                                
                                
                            </div>

                            <table className="mt-4 border-collapse w-full" >
                                <thead>
                                <tr className="bg-gray-200 dark:bg-[#373844] text-sm">
                                    {['Name', 'ID',  'Provider', 'Available', 'Supports Images',
                                        'Supports System Prompts', 'Additional System Prompt',
                                        'Description', 'Input Context Window', 'Output Token Limit', 
                                        'Input Token Cost / 1k', 'Output Token Cost / 1k', 
                                        'Available to User via Amplify Group Membership',
                                    ].map((title, i) => (
                                    <th key={i}
                                        className="text-[0.8rem] px-1 text-center border border-gray-500 text-neutral-600 dark:text-neutral-300" >
                                        {title}
                                    </th>
                                    ))}
                                        
                                </tr>
                                </thead>
                                <tbody>
                                {Object.values(availableModels)
                                        .filter((availModel: SupportedModel) => 
                                        (isAddingAvailModel?.model.id !== availModel.id) && 
                                        (modelsSearchTerm ? availModel.name.toLowerCase()
                                                            .includes(modelsSearchTerm) : true))
                                        .sort((a, b) => a.name.localeCompare(b.name))
                                        .map((availModel: SupportedModel) => 
                                    <tr key={availModel.id}  className="text-xs"
                                        onMouseEnter={() => setHoveredAvailModel(availModel.id)}
                                        onMouseLeave={() => setHoveredAvailModel('')}>
                                        <td className="border border-neutral-500 p-2">
                                            {availModel.name}
                                        </td>

                                        <td className="border border-neutral-500 p-2 break-words max-w-[160px]">
                                            {availModel.id}
                                        </td>

                                        <td className="border border-neutral-500 p-2 break-words ">
                                            <div className="flex justify-center">  {availModel.provider ?? 'Unknown Provider'} </div>
                                        </td>

                                        <td className="border border-neutral-500 p-2 w-[60px]"
                                            title="Available to All Users">
                                            {availModel.id.includes('embed') ? 
                                            <div className="text-center">N/A</div> :
                                            <div className="flex justify-center">
                                                {isAvailableCheck(availModel.isAvailable, () => {
                                                    const updatedModel = {...availableModels[availModel.id], isAvailable: !availModel.isAvailable};
                                                    setAvailableModels({...availableModels, [availModel.id]: updatedModel});
                                                    updateUnsavedConfigs(AdminConfigTypes.AVAILABLE_MODELS);
                                                })}   
                                            </div>}
                                        </td>

                                        <td className="border border-neutral-500 px-4 py-2 w-[60px]"
                                            title="Model Support for Base64-Encoded Images">
                                            {availModel.id.includes('embed') ? 
                                            <div className="text-center">N/A</div> :
                                                <div className="flex justify-center">
                                                {availModel.supportsImages ? <IconCheck className= 'text-green-600' size={18} /> 
                                                                        : <IconX  className='text-red-600' size={18} />}
                                            </div> }                          
                                        </td>


                                        <td className="border border-neutral-500 px-4 py-2 w-[74px]"
                                            title="Model Support System Prompts">
                                            <div className="flex justify-center">
                                                {availModel.supportsSystemPrompts ? <IconCheck className= 'text-green-600' size={18} /> : 
                                                <IconX  className='text-red-600' size={18} />}
                                            </div>                           
                                        </td>

                                        {["systemPrompt", "description"].map((s:string) => 
                                            <td className="border border-neutral-500 text-center" key={s}>
                                                {availModel[s as keyof SupportedModel] ?
                                                <div className=" flex justify-center break-words overflow-y-auto w-[200px]" >  
                                                    <textarea
                                                    className="w-full rounded-r border border-neutral-500 px-1 bg-transparent dark:text-neutral-100 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50"
                                                    value={availModel[s as keyof SupportedModel] as string}
                                                    disabled={true}
                                                    rows={2} 
                                                    /> 
                                                </div>: 'N/A'}
                                            </td>
                                        )}

                                        {["inputContextWindow", "outputTokenLimit"].map((s: string) => 
                                            <td className="border border-neutral-500 p-2 w-[68px]" key={s}>
                                                <div className="flex justify-center"> 
                                                    {availModel[s as keyof SupportedModel]} </div>
                                            </td>
                                        )}

                                        {["inputTokenCost", "outputTokenCost"].map((s: string) => 
                                            <td className="border border-neutral-500 p-2 w-[85px]"  key={s}>
                                                <div className="flex justify-center">  
                                                    ${availModel[s as keyof SupportedModel]} </div>
                                            </td>
                                        )}

                                        <td className="border border-neutral-500 text-center">
                                            {availModel.exclusiveGroupAvailability && availModel.exclusiveGroupAvailability.length > 0 ?
                                            <AmplifyGroupSelect 
                                                isDisabled={true}
                                                groups={Object.keys(ampGroups)}
                                                selected={availModel.exclusiveGroupAvailability ?? []}
                                                setSelected={(selectedGroups: string[]) => {}}
                                            /> : <>N/A</>
                                        }
                                        </td>
                                        <td>
                                                <div className="w-[30px]">
                                                {hoveredAvailModel === availModel.id && (!isAddingAvailModel 
                                                || (isAddingAvailModel.action === 'Adding' && JSON.stringify(isAddingAvailModel.model) === JSON.stringify(emptySupportedModel()))) ?
                                                <div className="flex flex-row gap-1"> 
                                                <ActionButton
                                                    handleClick={() => {setIsAddingAvailModel( {model: availModel, action: "Editing" })}}
                                                    title="Edit Model Data">
                                                    <IconEdit size={22} />
                                                </ActionButton> 

                                                <ActionButton
                                                    handleClick={() => {
                                                        const  { [availModel.id]: _, ...remainingModels } = availableModels;
                                                        setAvailableModels(remainingModels);
                                                        updateUnsavedConfigs(AdminConfigTypes.AVAILABLE_MODELS);
                                                    }}
                                                    title="Delete Model">
                                                    <IconTrash size={22} />
                                                </ActionButton> 
                                                </div>
                                                : null}
                                            </div>

                                        </td>
                                    </tr>     
                                )}
                                </tbody>
                            </table>
            
                                </div>
                            :
                            <>No Supported Models listed. Please add a new model.</>
                        }
                    
                    </div> 
                </>
            },
///////////////////////////////////////////////////////////////////////////////
            // Application Variables
            { label: 'Application Variables',
                content : 
                <>
                {titleLabel('Application Secrets', "[1rem]")}

                    <div className="mx-4">
                        <InputsMap
                        id = {AdminConfigTypes.APP_SECRETS}
                        inputs={Object.keys(appSecrets).sort((a, b) => b.length - a.length)
                                    .map((secret: string) => {return {label: secret, key: secret}})}
                        state = {appSecrets}
                        inputChanged = {(key:string, value:string) => {
                            setAppSecrets({...appSecrets, [key]: value});
                            updateUnsavedConfigs(AdminConfigTypes.APP_SECRETS);
                        }}
                        obscure={true}
                        />    
                    </div> 
                    
                <br className="mt-4"></br>

                {titleLabel('Application Environment Variables', "[1rem]")}
                    <div className="mx-4">
                        <InputsMap
                        id = {AdminConfigTypes.APP_VARS}
                        inputs={Object.keys(appVars)
                                    .sort((a, b) => b.length - a.length)
                                    .map((secret: string) => {return {label: secret, key: secret}})}
                        state = {appVars}
                        inputChanged = {(key:string, value:string) => {
                            setAppVars({...appVars, [key]: value});
                            updateUnsavedConfigs(AdminConfigTypes.APP_VARS);
                        }}
                        obscure={true}
                        />      
                    </div>
                </>
            },

///////////////////////////////////////////////////////////////////////////////
            // OpenAi Endpoints
            { label: 'OpenAi Endpoints',
                content : 
                <>
                {titleLabel('OpenAi Endpoints', "[1.05rem]")}
                <br></br>
                <div className="ml-2">
                 
                {openAiEndpoints.models.map((modelData: any, modelIndex: number) => {
                    return Object.keys(modelData).map((modelName: string) => {
                        return (
                            <div key={modelName} className={`ml-4 flex flex-col gap-2 ${modelIndex > 0 ? 'mt-6': 'mt-2'}`}>
                                <div className="flex flex-row gap-2">
                                    <label className="py-2 text-[0.95rem]">{modelName}</label>
                                    <button
                                        title='Add Endpoint'
                                        className={`ml-2 mt-1 flex-shrink-0 items-center gap-3 rounded-md border border-neutral-300 dark:border-white/20 px-2 transition-colors duration-200 cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10`}
                                        onClick={async () => {
                                            const newEndpoint = { url: '', key: '', isNew: true};
                                            const updatedModels = [...openAiEndpoints.models];
                                            const model = updatedModels[modelIndex];
                                            model[modelName].endpoints.push(newEndpoint);
                                            setOpenAiEndpoints({ models: updatedModels });
                                            updateUnsavedConfigs(AdminConfigTypes.OPENAI_ENDPONTS);
                                        }
                                        }
                                    >
                                        <IconPlus size={16}/>
                                    </button>

                                    { modelData[modelName].endpoints.length > 0 &&
                                    <button
                                        title="Delete Endpoints"
                                        disabled={isDeletingEndpoint === modelName}
                                        className={`mt-1 flex-shrink-0 items-center gap-3 rounded-md border border-neutral-300 dark:border-white/20 px-2 dark:text-neutral-100 transition-colors duration-200 ${isDeletingEndpoint !== modelName ? "cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10" : ""}`}
                                        onClick={() => {
                                            setIsDeletingEndpoint(modelName);
                                            setDeleteEndpointsList([]);
                                        }}
                                    >
                                        <IconTrash size={16} />
                                    </button>}
                                
                                    {isDeletingEndpoint === modelName && (
                                        <>
                                        <UserAction
                                            label={"Remove Endpoints"}
                                            onConfirm={() => {
                                                const updatedModels = [...openAiEndpoints.models];
                                                const model = updatedModels[modelIndex];
                                                model[modelName].endpoints = model[modelName].endpoints.filter(
                                                    (_, idx) => !deleteEndpointsList.includes(idx)
                                                );
                                                handleUpdateEndpoints({ models: updatedModels });

                                            }}
                                            onCancel={() => {
                                                setIsDeletingEndpoint(null);
                                                setDeleteEndpointsList([]);
                                            }}
                                        />
                                        <div className="mt-1.5">
                                            <Checkbox
                                                id={`selectAll${modelName}${AdminConfigTypes.OPENAI_ENDPONTS}`}
                                                label=""
                                                checked={deleteEndpointsList.length === modelData[modelName].endpoints.length}
                                                onChange={(isChecked: boolean) => {
                                                    if (isChecked) {
                                                        setDeleteEndpointsList(Array.from({ length: modelData[modelName].endpoints.length }, (_, i) => i));
                                                    } else {
                                                        setDeleteEndpointsList([]);
                                                    }
                                                }}
                                            />
                                        </div>
                                        </>
                                    )}
                                    
                                </div> 

                                {modelData[modelName].endpoints.map((endpoint: Endpoint, index:number) => 
                                    <div className="flex flex-row mr-10 mt-2" key={index}
                                        onMouseEnter={() => setHoveredEndpoint({ model: modelName, index })}
                                        onMouseLeave={() => setHoveredEndpoint(null)}
                                    >
                                        <div className="min-w-[30px] flex items-center"> 
                                            {isDeletingEndpoint === modelName ? (
                                                    <Checkbox
                                                        id={`${modelName}${index}${AdminConfigTypes.OPENAI_ENDPONTS}`}
                                                        label=""
                                                        checked={deleteEndpointsList.includes(index)}
                                                        onChange={(isChecked: boolean) => {
                                                            if (isChecked) {
                                                                setDeleteEndpointsList((prev) => [...prev, index]);
                                                            } else {
                                                            setDeleteEndpointsList((prev) => prev.filter((i) => i !== index));
                                                            }
                                                        }}
                                                    />
                                            ) : 
                                            <>
                                            {hoveredEndpoint &&
                                            hoveredEndpoint.model === modelName &&
                                            hoveredEndpoint.index === index && (
                                                <button
                                                    type="button"
                                                    className="p-0.5 ml-[-4px] text-sm bg-neutral-400 dark:bg-neutral-500 rounded hover:bg-red-600 dark:hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                                    onClick={() => {
                                                        const updatedModels = [...openAiEndpoints.models];
                                                        const model = updatedModels[modelIndex];
                                                        model[modelName].endpoints.splice(index, 1);
                                                        handleUpdateEndpoints({ models: updatedModels });
                                                    }}
                                                >
                                                    <IconTrash size={20} />
                                                </button>
                                            )}
                                            </>}
                                        </div>

                                        <div className="w-full">
                                            <InputsMap
                                                id = {`${AdminConfigTypes.OPENAI_ENDPONTS}-${modelName}-${index}`}
                                                inputs={[ {label: 'Url', key: 'url', placeholder: 'OpenAI Endpoint'},
                                                        {label: 'Key', key: 'key', placeholder: 'Api key'},
                                                        ]}
                                                state ={{url : endpoint.url, 
                                                        key : endpoint.key}}
                                                inputChanged = {(key:string, value:string) => {
                                                    const updatedModels = [...openAiEndpoints.models];
                                                    const model = updatedModels[modelIndex];
                                                    if (key === 'url') {
                                                        model[modelName].endpoints[index].url = value;
                                                    } else if (key === 'key') {
                                                        model[modelName].endpoints[index].key = value;
                                                    }
                                                    handleUpdateEndpoints({ models: updatedModels });
                                                }}
                                                obscure={true}
                                            />
                                        </div>
                                        
                                    </div>

                                )}
                
                            </div>)
                            
                        })
                    })}
            
                </div>
                </>
            },

///////////////////////////////////////////////////////////////////////////////
            // Feature Flags

            {label: 'Feature Flags',
                content:
                <>
                    <div className="flex flex-row gap-3 mb-2 ">
                            {titleLabel('Feature Flags')}   
                            <button
                                title={isAddingFeature ? '' : 'Add Feature'}
                                disabled={isAddingFeature !== null}
                                className={`ml-1 mt-3 flex-shrink-0 items-center gap-3 rounded-md border border-neutral-300 dark:border-white/20 px-2 transition-colors duration-200  ${ isAddingFeature ? "" : " cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10" }`}
                                onClick={() => setIsAddingFeature({name: '', featureData: emptyFeature()})
                                } >
                                <IconPlus size={16}/>
                            </button>

                            {isAddingFeature && 
                                <UserAction
                                top={"mt-4"}
                                label={"Add Feature"}
                                clearOnConfirm={false}
                                onConfirm={() => {
                                    setFeatureSearchTerm('');
                                    if (isAddingFeature.name) {
                                        const updatedName = isAddingFeature.name.replace(/\s(.)/g, (_, c) => c.toUpperCase()).replace(/^\w/, c => c.toLowerCase());
                                        if (Object.keys(features).includes(updatedName)) {
                                            alert("Feature flag names must be unique. Please try another name.");
                                            return;
                                        }
                                        handleUpdateFeatureFlags(updatedName, isAddingFeature.featureData);
                                        setIsAddingFeature(null);
                                    } else {
                                        alert("Feature name is required. Please enter a name and try again. ");
                                    }
                                }}
                                onCancel={() => {
                                    setIsAddingFeature(null);
                                }}
                            />
                            
                            }
                            { showFeatureSearch && !isAddingFeature && 
                            <div className="ml-auto mr-10" style={{transform: 'translateY(12px)'}}>
                                <Search
                                placeholder={'Search Feature Flags...'}
                                searchTerm={featureSearchTerm}
                                onSearch={(searchTerm: string) => setFeatureSearchTerm(searchTerm.toLocaleLowerCase())}
                                />
                            </div>}
                    </div>

                        {isAddingFeature && 
                        <div className="ml-6 flex flex-row flex-shrink-0 mr-4 ">
                        <label className="mt-1.5 flex-shrink-0 border border-neutral-400 dark:border-[#40414F] p-2 rounded-l text-[0.9rem] whitespace-nowrap text-center items-center h-[38px]"
                        >Feature Name </label>
                        <input title={"Feature names must be unique"}
                        className="mt-1.5 w-[160px] h-[38px] rounded-r border border-neutral-500 px-4 py-1 dark:bg-[#40414F] bg-gray-200 dark:text-neutral-100 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50"
                        placeholder={"Feature Name"}
                        onChange={(e) =>  setIsAddingFeature({...isAddingFeature, name: e.target.value})}
                        value={isAddingFeature.name}
                        />

                        <label className="ml-4 mt-1.5 h-[40px] border border-neutral-400 dark:border-[#40414F] p-2 rounded-l text-[0.9rem] whitespace-nowrap text-center"
                        >Status </label>

                        <button title={isAddingFeature.featureData.enabled ? "Click to disabled"        
                                                                            : "Click to enabled" } 
                            className={`mt-1.5 h-[40px] w-[80px] px-1 items-center cursor-pointer
                                        bg-gray-200 dark:bg-[#40414F] ${isAddingFeature.featureData.enabled
                                        ? 'text-green-500 hover:text-green-600' : 'text-red-600 hover:text-red-700' }`}
                            onClick={() => {
                                const enabled = isAddingFeature.featureData.enabled;
                                const updatedData = {...isAddingFeature.featureData, enabled: !enabled};
                                setIsAddingFeature({...isAddingFeature, featureData: updatedData});
                            }}>
                        {isAddingFeature.featureData.enabled ? 'Enabled' : 'Disabled'}       
                        </button>

                        <div className="ml-4 flex-grow flex flex-col mt-[-32px] max-w-[40%]">
                            <AddEmailWithAutoComplete
                                            key={`${String(AdminConfigTypes.FEATURE_FLAGS)}_ADD`}
                                            emails={isAddingFeature.featureData.userExceptions ?? []}
                                            allEmails={allEmails ?? []}
                                            handleUpdateEmails={(updatedEmails: Array<string>) => {
                                                const updatedData = {...isAddingFeature.featureData, userExceptions: updatedEmails};
                                                setIsAddingFeature({...isAddingFeature, featureData: updatedData});
                                            }
                                            }
                            />
                             <div className="h-[40px] rounded-r border border-neutral-500 pl-4 py-1 dark:bg-[#40414F] bg-gray-200 dark:text-neutral-100 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 overflow-x-auto">
                            {isAddingFeature.featureData.userExceptions?.map((user, idx) => (
                                <div key={idx} className="flex items-center gap-1 mr-1">
                                    <span className="flex flex-row gap-4 py-2 mr-4"> 
                                        {user} 
                                        <button
                                        className={`text-red-500 hover:text-red-800 `}
                                        onClick={() => {
                                            if (isAddingFeature.featureData.userExceptions) {
                                                const updatedUsers = isAddingFeature.featureData.userExceptions
                                                                 .filter((u: string) => u !== user);
                                                const updatedData = {...isAddingFeature.featureData, userExceptions: updatedUsers};
                                                setIsAddingFeature({...isAddingFeature, featureData: updatedData});
                                            }
                                        }} >
                                        <IconTrash size={16} />
                                        </button>
                                    </span>
                                </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex-grow ml-4 flex flex-col mt-[-32px] max-w-[40%]">
                            <InfoBox content={
                                    <span className="ml-1 text-xs w-full text-center"> 
                                    Members of the following Amplify Groups will be considered exceptions.
                                    </span>
                                }/>
                              
                            <AmplifyGroupSelect 
                                groups={Object.keys(ampGroups)}
                                selected={isAddingFeature.featureData.amplifyGroupExceptions ?? []}
                                setSelected={(selectedGroups: string[]) => {
                                    const updatedData = {...isAddingFeature.featureData,
                                                             amplifyGroupExceptions: selectedGroups};
                                    setIsAddingFeature({...isAddingFeature, featureData: updatedData});
                                }}
                            /> 
                        </div>

                         </div>}
                    
                    <div className="ml-4 mt-2">
                        <div className="mr-5 pr-4">
                            <InfoBox 
                            content={
                                <span className="text-xs w-full text-center"> 
                                    When the feature is Enabled, it is active for everyone except the users listed under User Exceptions; when Disabled, the feature is inactive for everyone except those users, who will still have access.
                                </span>
                            }
                            />
                            <table className="mt-4 border-collapse w-full" style={{ tableLayout: 'fixed' }}>
                                <thead>
                                <tr className="bg-gray-200 dark:bg-[#373844] ">
                                    {['Feature', 'Status', 'User Exceptions', 'User Exceptions by Amplify Group Membership']
                                        .map((title, index) => (
                                    <th key={index}
                                        className="text-center p-0.5 border border-gray-500 text-neutral-600 dark:text-neutral-300"
                                        style={{
                                        width: index === 0  ? '22%' // Feature column takes as much space as needed
                                                : index === 1 ? '150px' // Fixed width for the Status button column
                                                : 'auto', // User Exceptions column takes remaining space
                                        }}
                                    >
                                        {title}
                                    </th>
                                    ))}
                                </tr>
                                </thead>
                                <tbody>
                                {Object.entries(features)
                                        .filter(([featureName, featureData]) => featureSearchTerm ? featureName.toLowerCase().includes(featureSearchTerm) : true)
                                        .sort(([nameA], [nameB]) => nameA.localeCompare(nameB))
                                        .map(([featureName, featureData]) => (
                                    <tr key={featureName}>
                                        {/* Feature Name Column */}
                                        <td className="border border-neutral-500 px-4 py-2">
                                            <span className="text-[0.95rem]">{camelToTitleCase(featureName)}</span>
                                        </td>

                                        {/* Status Button Column */}
                                        <td className="border border-neutral-500 px-8 py-2 text-center">
                                            <button
                                            className={`px-2 py-1 rounded ${
                                                featureData.enabled
                                                ? 'text-green-500 hover:text-green-600'
                                                : 'text-red-600 hover:text-red-700'
                                            }`}
                                            title={featureData.enabled ? 'Click to Disable' : 'Click to Enable'}
                                            onClick={() => {
                                                // Toggle feature enabled state
                                                handleUpdateFeatureFlags(featureName, {
                                                ...featureData,
                                                enabled: !featureData.enabled,
                                                });
                                            }}
                                            >
                                            {featureData.enabled ? 'Enabled' : 'Disabled'}
                                            </button>
                                        </td>

                                        {/* User Exceptions Column */}
                                        <td className="border border-neutral-500 pl-1 pr-2">
                                            <div className={`flex items-center ${addingExceptionTo === featureName ? "flex-col":'flex-row'}`}>
                                            {/* User Exceptions List */}
                                            <div
                                                className={`flex items-center ${addingExceptionTo === featureName ? "flex-wrap w-full": "overflow-x-auto"}`}
                                                style={{ maxWidth: '100%' }}
                                            >
                                                {featureData.userExceptions?.map((user, idx) => (
                                                <div key={idx} className="flex items-center gap-1 mr-1"
                                                    onMouseEnter={() => setHoveredException({ feature: featureName, username: user })}
                                                    onMouseLeave={() => setHoveredException(null)}>
                                                    
                                                    <span className="flex flex-row gap-1 py-2 mr-4"> {idx > 0 && <label className="opacity-60">|</label>}
                                                        {hoveredException?.feature === featureName && 
                                                            hoveredException?.username === user ?
                                                        <button
                                                        className={`text-red-500 hover:text-red-800`}
                                                        onClick={() => {
                                                            // Remove user from exceptions
                                                            const updatedExceptions = featureData.userExceptions?.filter(
                                                            (u) => u !== user
                                                            );
                                                            handleUpdateFeatureFlags(featureName, {
                                                            ...featureData,
                                                            userExceptions: updatedExceptions,
                                                            });
                                                        }}
                                                        >
                                                        <IconTrash size={16} />
                                                        </button> : <div className="w-[16px]"></div>}

                                                        {user} 
                                                    </span>
                                                </div>
                                                ))}
                                            </div>

                                            {/* Add Exception Input or Button */}
                                            {addingExceptionTo === featureName ? (
                                                <div className="flex flex-row pr-3 ml-2 mt-2" style={{ width: '100%' }}>
                                                <ActionButton
                                                    title="Close"
                                                    handleClick={() => setAddingExceptionTo(null)}
                                                >
                                                    <IconX size={20}/>   
                                                </ActionButton>
                                                
                                                <div className="flex-grow"> <AddEmailWithAutoComplete
                                                    key={String(AdminConfigTypes.FEATURE_FLAGS)}
                                                    emails={featureData.userExceptions ?? []}
                                                    allEmails={allEmails ?? []}
                                                    handleUpdateEmails={(updatedExceptions: Array<string>) => {
                                                    handleUpdateFeatureFlags(featureName, {
                                                        ...featureData,
                                                        userExceptions: updatedExceptions,
                                                    });
                                                    }}
                                                /> </div>
                                                </div>
                                            ) : (
                                                <button
                                                className="ml-auto flex items-center px-2 text-blue-500 hover:text-blue-600 flex-shrink-0"
                                                onClick={() => {
                                                    setAddingExceptionTo(featureName);
                                                }}
                                                >
                                                <IconPlus size={18} />
                                                {!(featureData.userExceptions && featureData.userExceptions.length > 0) && (
                                                    <span>Add Exceptions</span>
                                                )}
                                                </button>
                                            )}
                                            </div>
                                        </td>

                                        <td className="border border-neutral-500">
                                                <AmplifyGroupSelect 
                                                groups={Object.keys(ampGroups)}
                                                selected={featureData.amplifyGroupExceptions ?? []}
                                                setSelected={(selectedGroups: string[]) => {
                                                    handleUpdateFeatureFlags(featureName, {
                                                        ...featureData,
                                                        amplifyGroupExceptions: selectedGroups,
                                                    });
                                                }}
                                                />
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                            </div>
                        
                    </div>
                </>
            },
///////////////////////////////////////////////////////////////////////////////

            // Manage Feature Data Tab
                    
            {label: `Manage Feature Data${adminTabHasChanges(Array.from(unsavedConfigs), 'feature_data') ? " * " : ""}`,
             content:
                <>
                {titleLabel('Upload Documents' )}
                <div className="mx-6 flex flex-row gap-20">
                        <div className="flex flex-row gap-2">
                            <IconFileTypePdf className="ml-1 mt-1" size={18}/>
                            <label className="mt-0.5 text-[1rem]" title="Upload pdf file"> Data Disclosure</label>
                            <div className="max-h-20"> 
                                <FileUpload
                                id={"data_disclosure"}
                                allowedFileExtensions={['pdf']}
                                onAttach={(file:File, fileName: string) => {
                                    handleDataDisclosureUpload(file);
                                }}
                                completeCheck={() => dataDisclosureUploaded}
                                onRemove={() => {
                                    setDataDisclosureUploaded(false);
                                }}
                            /> </div>
                            
                        </div>

                    <div className="flex flex-col gap-2">
                        <div className="flex flex-row gap-1">
                            <label className="ml-1  mt-0.5 text-[1rem] mb-1.5"> API Documentation</label>
                            <button className="mt-[-2px] rounded-sm p-1 text-black dark:text-white hover:opacity-80"
                                onClick={() => {
                                    // if (!showUploadApiDocs && !apiPresignedUrls) handleApiDocPresigned();
                                    setShowUploadApiDocs(!showUploadApiDocs);
                                }}
                                title="Upload API Documents"
                                > 
                                {showUploadApiDocs ? <IconChevronLeft size={20} /> : <IconChevronRight size={20} />}
                            </button>
                            {showUploadApiDocs && 
                            <>
                            <> <IconFileTypePdf className="flex-shrink-0 mt-1 ml-3" size={18}/>
                            <FileUpload
                                id={"api_documentation_pdf"}
                                allowedFileExtensions={['pdf']}
                                onAttach={(file:File, fileName: string) => {
                                    const overriddenFile = new File([file], "Amplify_API_Documentation.pdf", { type: file.type });
                                    handleApiDocUpload(overriddenFile);
                                }}
                                completeCheck={() => apiDocsUploaded.pdf}

                                onRemove={() => {
                                    setApiDocsUploaded({...apiDocsUploaded, pdf: false});
                                }}
                                label="API PDF"
                            /></>
                            <> <IconFileTypeCsv className="flex-shrink-0 mt-1 ml-5" size={18}/>
                            <FileUpload
                                id={"api_documentation_csv"}
                                allowedFileExtensions={['csv']}
                                onAttach={(file:File, fileName: string) => {
                                    const overriddenFile = new File([file], "Amplify_API_Documentation.csv", { type: file.type });
                                    handleApiDocUpload(overriddenFile);
                                }}
                                completeCheck={() => apiDocsUploaded.csv}
                                onRemove={() => {
                                    setApiDocsUploaded({...apiDocsUploaded, csv: false});
                                }}
                                label="API CSV"
                            /></>

                            <> <label className="mt-1 ml-5" title="Postman Collection JSON File">
                                <IconFileCode className="flex-shrink-0" size={19}/></label> 
                            <FileUpload
                                id={"api_documentation_json"}
                                allowedFileExtensions={['json']}
                                onAttach={(file:File, fileName: string) => {
                                    const overriddenFile = new File([file], "Postman_Amplify_API_Collection.json", { type: file.type });
                                    handleApiDocUpload(overriddenFile);
                                }}
                                completeCheck={() => apiDocsUploaded.json}
                                onRemove={() => {
                                    setApiDocsUploaded({...apiDocsUploaded, json: false});
                                }}
                                label="Postman Collection"
                            /></>
                            
                            </>}
                             
                            
                        </div>
                        <button className="max-w-[216px] mt-[-10px] text-start cursor-pointer ml-1 text-xs text-blue-500 hover:opacity-70"
                            onClick={handleDownloadApiDocTemplates}> 
                            {'(Need the API docs? Download here)'}
                        </button>
                        

                    </div>
                </div>
                {titleLabel('Assistant Admin Groups')}

                <div className="ml-6">
                    <div className="flex flex-row gap-2">
                        <label className="text-[1rem] font-bold"> Amplify Group Assistants</label>
                        {amplifyAstGroupId || isCreatingAmpAstGroup ?
                                <div className={`mt-1.5 ml-0.5 ${isCreatingAmpAstGroup ? "bg-gray-400 dark:bg-gray-500 animate-pulse" : "bg-green-400 dark:bg-green-300"}`} 
                                 style={{width: '8px', height: '8px', borderRadius: '50%'}}
                                 title="The Amplify Assistants Group exists."> </div>
                        :
                        (!creatingAmpAsts ?
                        <button 
                            className="ml-2 mt-[-2px] py-1 px-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 hover:dark:bg-gray-700 mr-[-16px] rounded transition-colors duration-100 cursor-pointer" 
                            onClick={() => {
                                setCreatingAmpAsts([]);
                                }}
                            // title="It appears you currently do not have an Amplify Assistants group. If this is a mistake you will not be able to successfully create another one."
                            >
                            {"Create Amplify Assistants Group"}
                                
                        </button> :
                            <UserAction
                            top={"mt-[1px]"}
                            label={"Create Amplify Assistants Group With Selected Assistants"}
                            onConfirm={() => {
                                handleCreateAmpAsts();
                                setAstGroupSearchTerm('');
                            }}
                            onCancel={() => {
                                setCreatingAmpAsts(null);
                            }}
                        />
                        )
                        }
                    </div>
                    <div className="ml-8 pr-10 mb-6 mt-4">
                        <InfoBox content={
                            <span className="ml-1 text-xs w-full px-4 text-center"> 
                            {!creatingAmpAsts 
                                ? "Amplify Assistants are accessible to all users. You can modify these assistants through the Assistant Admin Interface. To access this interface, make sure the required feature flag is enabled under the Configurations tab. Navigate to the Assistant Admin Interface by clicking on the gear icon located in the left sidebar menu on the main Home screen. If you do not see the Assistant Admin Interface option, try to refresh the page and/or double-check the Assistant Admin Interface feature flag."
                                : "Please select the assistants you want to include in the Amplify Assistants group. Once you've made your selections, click the green checkmark to create the group."}
                            </span>
                        }/>
                        <div className="mt-4"></div>
                        {Object.keys(amplifyAssistants).map((ast: any) =>
                            <div key={ast} className="mt-2 flex flex-row">
                                <div className="flex flex-row gap-2"> 
                                    {creatingAmpAsts && 
                                        <Checkbox
                                        id={`amplifyAsts_${ast}`}
                                        label=""
                                        checked={creatingAmpAsts.includes(ast)}
                                        onChange={(isChecked: boolean) => {
                                            if (isChecked) {
                                                setCreatingAmpAsts([...creatingAmpAsts, ast]);
                                            } else {
                                                setCreatingAmpAsts(creatingAmpAsts
                                                                        .filter((a: string) => a !== ast));
                                            }
                                        }}
                                    />
                                    }
                                    <label className="mt-0.5 text-[0.9rem]"> {ast} :</label> 
                                </div>
                                <label className="mt-0.5 ml-3"> 
                                    {(amplifyAssistants as any)[ast].description}
                                </label>

                                {!creatingAmpAsts && amplifyAstGroupId && 
                                 <button 
                                    className={`ml-4 mb-1 mt-[-2px] py-1 px-2 bg-gray-300 dark:bg-gray-600 ${isAddingAst === '' ? "hover:bg-gray-400 hover:dark:bg-gray-700" : ""} mr-[-16px] rounded transition-colors duration-100 cursor-pointer flex flex-row gap-2`}
                                    onClick={() => {
                                        setIsAddingAst(ast);
                                        handleAddAssistant([(amplifyAssistants as any)[ast]]);
                                    }}
                                    title="Adds a copy of this assistant to the existing Amplify Assistants Group"
                                    disabled={isAddingAst !== ''}
                                    >
                                    {isAddingAst === ast ? <LoadingIcon style={{ width: "16px", height: "16px" }}/>
                                    : <IconPlus className="text-blue-400" size={18}/> }
                                    {"Assistant Copy"}
                                        
                                </button>}
                            </div>
                        )
                            
                        }
                    </div>

                    <label className="text-[1rem] font-bold"> Groups</label>
                    <div className="ml-6 mt-4">
                        
                    {astGroups.length > 0 ?
                        <>
                            {showAstGroupSearch && 
                            <div className="h-[0px] ml-auto mr-14 w-[278px]" style={{transform: 'translateY(-30px)'}}>
                                <Search
                                placeholder={'Search Assistant Admin Groups...'}
                                searchTerm={astGroupSearchTerm}
                                onSearch={(searchTerm: string) => setAstGroupSearchTerm(searchTerm.toLocaleLowerCase())}
                                />
                            </div>}
                            <ExpansionComponent 
                            onOpen={() => setShowAstGroupsSearch(true)}
                            onClose={() => {
                                setShowAstGroupsSearch(false);
                                setAstGroupSearchTerm('');
                            }}
                            title={'Manage Assistant Admin Groups'} 
                            content={ 
                                <>
                                    <table className="mt-4 border-collapse w-full" >
                                        <thead>
                                        <tr className="bg-gray-200 dark:bg-[#373844] ">
                                            {['Group Name', 'Created By', 'Support Conversation Analysis', 'Public', 'Membership by Amplify Groups', 'Number of Assistants',
                                            ].map((title, i) => (
                                            <th key={i}
                                                className="px-1 text-center border border-gray-500 text-neutral-600 dark:text-neutral-300"
                                            > {title}
                                            </th>
                                            ))}
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {astGroups.filter((group: Ast_Group_Data) => astGroupSearchTerm ? 
                                                   group.groupName.toLowerCase().includes(astGroupSearchTerm) : true)
                                                  .map((group: Ast_Group_Data) => 
                                            <tr key={group.group_id}
                                                onMouseEnter={() => setHoveredAstGroup(group.group_id)}
                                                onMouseLeave={() => setHoveredAstGroup('')}>
                                                <td className="text-center border border-neutral-500 p-2">
                                                    {group.groupName}
                                                </td>
                                                <td className="text-center border border-neutral-500 p-2 break-words max-w-[200px]">
                                                    {group.createdBy}
                                                </td>

                                                <td className="w-[164px] border border-neutral-500 px-4 py-2"
                                                    title="All Amplify Users Can Chat and Interact With the Assistants In the Group">
                                                    <div className="flex justify-center">
                                                        <button title={ `Click to ${group.supportConvAnalysis ?"disable" : "enable"} analysis of assistant conversations`} 
                                                        className="cursor-pointer flex flex-row gap-7 dark:text-neutral-200 text-neutral-900"
                                                        onClick={() => {
                                                            const updatedGroups = astGroups.map((g: Ast_Group_Data) => 
                                                                 g.group_id === group.group_id ? 
                                                                          {...group, supportConvAnalysis: !group.supportConvAnalysis} : g)
                                                            handleAstGroupChange(group.group_id, updatedGroups);
                                                        }}>
                                                    {group.supportConvAnalysis ? <IconCheck className='text-green-600 hover:opacity-60' size={18} /> 
                                                            : <IconX  className='text-red-600 hover:opacity-60' size={18} />}       
                                                    </button>

                                                    </div>                           
                                                </td>


                                                <td className="border border-neutral-500 px-4 py-2"
                                                    title="All Amplify Users Can Chat and Interact With the Assistants In the Group">
                                                    <div className="flex justify-center">
                                                        <button title={group.isPublic ? "Click to set group as private"        
                                                                                      : "Click to set group as public" } 
                                                        className="cursor-pointer flex flex-row gap-7 dark:text-neutral-200 text-neutral-900"
                                                        onClick={() => {
                                                            const updatedGroups = astGroups.map((g: Ast_Group_Data) => 
                                                                g.group_id === group.group_id ? 
                                                                          {...group, isPublic: !group.isPublic} : g)
                                                            handleAstGroupChange(group.group_id, updatedGroups);
                                                        }}>
                                                    {group.isPublic ? <IconCheck className='text-green-600 hover:opacity-60' size={18} /> 
                                                            : <IconX  className='text-red-600 hover:opacity-60' size={18} />}       
                                                    </button>

                                                    </div>                           
                                                </td>


                                                <td className="border border-neutral-500">
                                                <AmplifyGroupSelect 
                                                    groups={Object.keys(ampGroups)}
                                                    selected={group.amplifyGroups}
                                                    setSelected={(selectedGroups: string[]) => {
                                                        const updatedGroups = astGroups.map((g: Ast_Group_Data) => 
                                                                                g.group_id === group.group_id ? 
                                                                        {...group, amplifyGroups: selectedGroups} : g)
                                                        handleAstGroupChange(group.group_id, updatedGroups);
                                                    }}
                                                />
                                                </td>

                                            
                                                <td className="border border-neutral-500 px-4 py-2 text-center w-[100px]">
                                                    {group.numOfAssistants ?? 0}
                                                </td>

                                                <td>
                                                    <div className="w-[30px] flex-shrink-0">
                                                    {hoveredAstGroup === group.group_id || 
                                                     keyReplacementLoading === group.group_id ?
                                                    <button
                                                        title={"Replace Group API Key"}
                                                        type="button"
                                                        disabled={keyReplacementLoading !== ''}
                                                        className="ml-2 p-1 text-sm bg-neutral-400 dark:bg-neutral-500 rounded hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
                                                        onClick={() => {handleReplaceGroupKey(group.group_id)}}>
                                                        {keyReplacementLoading === group.group_id ? 
                                                             <LoadingIcon style={{ width: "20px", height: "20px" }}/> : <IconKey size={20}/>} 
                                                    </button>  
                                                     
                                                    : null}
                                                    </div>
                                                </td>
                                            </tr>     
                                        )}
                                        </tbody>
                                    </table>
            
                                </>
                            }
                            isOpened={true}
                        />  </>
                            :
                            <>No Assistant Admin Groups listed. </>
                        }
                    </div>
                   
                </div>

                <div className="flex flex-row gap-3 mb-2 ">
                    {titleLabel('PowerPoint Templates')}
                    <button
                        title={isAddingTemplate ? "" : 'Add PowerPoint Templates'}
                        disabled={isAddingTemplate !== null}
                        className={`ml-1 mt-3 flex-shrink-0 items-center gap-3 rounded-md border border-neutral-300 dark:border-white/20 px-2 transition-colors duration-200  ${ isAddingTemplate ? "" : " cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10" }`}
                        onClick={() => setIsAddingTemplate(emptyPptx())}
                    >
                        {isUploadingTemplate ? <LoadingIcon style={{ width: "16px", height: "16px" }}/> 
                                             :  <IconPlus size={16}/>}
                    </button>

                    {isAddingTemplate && !isUploadingTemplate &&
                        <UserAction
                        top={"mt-4"}
                        label={"Add Template"}
                        onConfirm={() => {
                            if (uploadedTemplate) {
                                if (templates.find((t: Pptx_TEMPLATES) => t.name === isAddingTemplate.name)) {
                                    alert("PowerPoint template names must be unique. Please rename your file and try again.");
                                    return;
                                }
                                handleTemplateUpload(isAddingTemplate.name);
                            } else {
                                alert("Please upload a powerpoint template.");
                            }
                        }}
                        clearOnConfirm={false}
                        onCancel={() => {
                            setIsAddingTemplate(null);
                            setUploadedTemplate(null);
                        }}
                    />
                    }

                </div>

                {isAddingTemplate && 
                    <div className="ml-6 flex flex-row flex-shrink-0">
                        <div className="mt-1">
                        <FileUpload
                            id={"pptx_upload"}
                            allowedFileExtensions={['pptx']}
                            onAttach={(file:File, fileName: string) => {
                                setUploadedTemplate(file);
                                setIsAddingTemplate({...isAddingTemplate, name: fileName});
                            }}
                            completeCheck={() => isAddingTemplate.name != ''}
                            onRemove={() => {
                                setUploadedTemplate(null);
                                setIsAddingTemplate({...isAddingTemplate, name: ''});
                            }}
                        /></div>
                        <label className="h-[40px] border border-neutral-400 dark:border-[#40414F] p-2 rounded-l text-[0.9rem] whitespace-nowrap text-center"
                        >Template Name </label>
                        <input
                        title={!uploadedTemplate ? "Template name will auto-populate once a template has been uploaded"
                                                 : "" }
                        className="h-[40px] w-[250px] rounded-r border border-neutral-500 px-4 py-1 dark:bg-[#40414F] bg-gray-200 dark:text-neutral-100 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50"
                        placeholder={"Template Name"}
                        value={isAddingTemplate.name}
                        disabled={true}
                        />
                        <label className="ml-4 h-[40px] border border-neutral-400 dark:border-[#40414F] p-2 rounded-l text-[0.9rem] whitespace-nowrap text-center"
                        >Available </label>

                        
                        {isAvailableCheck(isAddingTemplate.isAvailable, () => {
                            setIsAddingTemplate({...isAddingTemplate, isAvailable: !isAddingTemplate.isAvailable});
                        }, "h-[40px] px-1 items-center bg-gray-200 dark:bg-[#40414F]")} 

                        <div className="ml-4 flex flex-col mt-[-32px]">
                            <InfoBox content={
                                    <span className="ml-1 text-xs w-full text-center"> 
                                    If the template is not available for all users, it will be exclusively available for the following Amplify Groups
                                    </span>
                                }/>
                           
                            <AmplifyGroupSelect 
                                groups={Object.keys(ampGroups)}
                                selected={isAddingTemplate.amplifyGroups}
                                setSelected={(selectedGroups: string[]) => {
                                    setIsAddingTemplate({...isAddingTemplate, amplifyGroups: selectedGroups});
                                }}
                            /> 
                        </div>

                </div>
                }


                <div className="ml-6">
                    {templates.length > 0 ?
                            <ExpansionComponent 
                            title={'Manage PowerPoint Templates'} 
                            content={ 
                                <>
                                    <table className="mt-4 border-collapse w-full" >
                                        <thead>
                                        <tr className="bg-gray-200 dark:bg-[#373844] ">
                                            {['Template Name', 'Public', 'Available to User via Amplify Group Membership'
                                            ].map((title, i) => (
                                            <th key={i}
                                                className="px-1 text-center border border-gray-500 text-neutral-600 dark:text-neutral-300"
                                                style={{width: i === 0 ? "25%" 
                                                             : i === 1 ? "20" :"55%", 
                                                }}>
                                                {title}
                                            </th>
                                            ))}
                                             
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {templates.map((pptx: Pptx_TEMPLATES) => 
                                            <tr key={pptx.name}
                                                onMouseEnter={() => setHoveredTemplate(pptx.name)}
                                                onMouseLeave={() => setHoveredTemplate('')}>
                                                <td className="text-center border border-neutral-500 px-4 py-2 break-words max-w-[200px]">
                                                    {pptx.name}
                                                </td>

                                                <td className="border border-neutral-500 px-4 py-2"
                                                    title="Available to All Amplify Users">
                                                    <div className="flex justify-center">
                                                    {isAvailableCheck(pptx.isAvailable, () => {
                                                        const updatedTemplate = {...pptx, isAvailable: !pptx.isAvailable};
                                                            handleTemplateChange(pptx.name, 
                                                                                templates.map((t:Pptx_TEMPLATES) =>
                                                                                t.name === pptx.name ?      
                                                                                     updatedTemplate : t ));
                                                    })} 
                                                    </div>                           
                                                </td>

                                                <td className="border border-neutral-500">
                                                    <AmplifyGroupSelect 
                                                    groups={Object.keys(ampGroups)}
                                                    selected={pptx.amplifyGroups}
                                                    setSelected={(selectedGroups: string[]) => {
                                                        const updatedTemplate = {...pptx, amplifyGroups: selectedGroups};
                                                        handleTemplateChange(pptx.name, 
                                                                            templates.map((t:Pptx_TEMPLATES) =>
                                                                            t.name === pptx.name ?      
                                                                                 updatedTemplate : t ))
                                                    }}
                                                    />
                                                </td>

                                                <td>
                                                    <div className="w-[30px] flex-shrink-0">
                                                    {hoveredTemplate === pptx.name || deletingTemplate == pptx.name ?
                                                    <button
                                                        title={"Delete Template"}
                                                        type="button"
                                                        className="ml-2 p-1 text-sm bg-neutral-400 dark:bg-neutral-500 rounded hover:bg-red-600 dark:hover:bg-red-700 focus:outline-none"
                                                        onClick={() => {handleDeleteTemplate(pptx.name)}}
                                                        >
                                                        {deletingTemplate == pptx.name ? 
                                                        <LoadingIcon style={{ width: "20px", height: "20px" }}/> : <IconTrash size={20} />} 
                                                    </button>
                                                    
                                                    : null}
                                                    </div>
                                                </td>
                                            </tr>     
                                        )}
                                        </tbody>
                                    </table>
            
                                </>
                            }
                            isOpened={true}
                        />  
                            :
                            <>No PowerPoint Templates listed. </>
                        }
                </div>
                
                </>
            },


///////////////////////////////////////////////////////////////////////////////

            // Ops

            {label: 'Ops',
                content:
                <>
                <div className="flex flex-row gap-3 mb-2 ">
                        {titleLabel('OPs')}
                        <button
                            title={'Add Op'} disabled={isRegisteringOps}
                            className={`ml-1 mt-3 flex-shrink-0 items-center gap-3 rounded-md border border-neutral-300 dark:border-white/20 px-2 transition-colors duration-200 ${isRegisteringOps ? "" : "cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10"}`}
                            onClick={() => setNewOps([...newOps, emptyOps()])}>
                            <IconPlus size={16}/>
                        </button>

                        {newOps.length > 0 && 
                            <button
                                title={'Register Ops'} disabled={isRegisteringOps}
                                className={`mt-3 flex-shrink-0 items-center gap-3 rounded-md border border-neutral-300 dark:border-white/20 px-2 transition-colors duration-200 ${isRegisteringOps ? "" : "cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10"}`}
                                onClick={handleRegisterOps}
                            >
                               {isRegisteringOps ? "Registering..." : "Register Ops" }
                            </button>
                        }

                </div>

                <div className="mx-6 mr-4">
                    
                    { newOps.length > 0 && 
                    <div className="mb-4 flex flex-col gap-4">
                            {newOps.map((op: OpDef, i:number) => 
                                <div key={i} onMouseEnter={() => setHoveredNewOp(i)}
                                             onMouseLeave={() => setHoveredNewOp(-1)}
                                >
                                    <div className="flex flex-col gap-2">
                                        {i > 0 && <hr></hr>}
                                        <div className="flex flex-row items-center"> 
                                        <div className="flex-grow"> <InputsMap
                                            splitView={true}
                                            id = {`OPS${i}`}
                                            inputs={ [ {label: 'Tags', key: 'tags', 
                                                        placeholder:"Op identifiers separated by commas"},
                                                    {label: 'Function Name', key: 'name', 
                                                     placeholder:"Arbitrary function name"},
                                                    {label: 'Request Path', key: 'url', 
                                                     placeholder:"Amplify Enpoint Path"},
                                                    {label: 'Description', key: 'description', 
                                                     placeholder:"Ops overview or purpose"},  
                                                    ]}
                                            state = {{tags : newOps[i].tags?.join(',') ?? '', 
                                                    name: newOps[i].name, 
                                                    description : newOps[i].description, 
                                                    url: newOps[i].url}}
                                            inputChanged = {(key:string, value:string) => {
                                                const updateOps = [...newOps];
                                                let updatedOp = {...newOps[i], [key]: value};
                                                if (key === 'name') updatedOp['id'] = value;
                                                if (key === 'tags') updatedOp['tags'] = value.split(',')
                                                                                        .map((t: string) => t.trim());
                                                updateOps[i] = updatedOp;
                                                setNewOps(updateOps);
                                            }}
                                        /> </div>
                                       
                                        <button
                                            title={"Remove OP"}
                                            type="button"
                                            className={`w-[28px] h-[28px] ml-auto p-1 text-sm bg-neutral-400 dark:bg-neutral-500 rounded hover:bg-red-600 dark:hover:bg-red-700 focus:outline-none ${hoveredNewOp === i ? "" : "opacity-0"}`}
                                            onClick={() => setNewOps((prevItems) => 
                                                           prevItems.filter((_, idx) => i !== idx))}
                                            >
                                            <IconTrash size={20} />
                                        </button>
                                        
                                        </div>
                                        <div className="flex flex-row gap-10 justify-between">
                                            <div className="w-[140px] flex-shrink-0">
                                            <HTTPRequestSelect
                                                requestType={op.method ?? "POST"}
                                                handleChange={(val) => {
                                                    const updateOps = [...newOps];
                                                    updateOps[i].method = val;
                                                    setNewOps(updateOps);
                                                }}
                                            />
                                            </div>

                                            {["POST", "PUT", "PATCH"].includes(op.method ?? '') && 
                                            <>
                                            <div className="flex flex-row gap-2">
                                                <label className="text-md text-black dark:text-neutral-200">Parameters</label>
                                                <button 
                                                    title={'Add OP Parameter'} disabled={isRegisteringOps}
                                                    className={`h-[28px] mt-[-1] ml-1 flex-shrink-0 rounded-md border border-neutral-300 dark:border-white/20 px-2 transition-colors duration-200 ${isRegisteringOps ? "" : "cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10"}`}
                                                    onClick={() => {
                                                        const updateOps = [...newOps];
                                                        updateOps[i].params.push({ name: "", description: "" });
                                                        setNewOps(updateOps);
                                                    }
                                                    }
                                                >
                                                    <IconPlus size={14}/>
                                                </button>

                                            </div>
                                            <div className="flex flex-row gap-2 flex-grow flex-wrap">
                                                {newOps[i].params.map((p: Record<string, string>, pIndex:number) => 
                                                   
                                                    <div className="flex flex-col" key={pIndex}
                                                    onMouseEnter={() => setHoveredParam({opIdx: i, paramIdx: pIndex})}
                                                    onMouseLeave={() => setHoveredParam(null)}>
                                                        <div className="relative flex flex-row flex-shrink-0">
                                                            <label className="border border-neutral-400 dark:border-[#40414F] p-2 rounded-l text-[0.9rem] whitespace-nowrap text-center"
                                                            >{"Name"} </label>
                                                            <input
                                                            className="w-full rounded-r border border-neutral-500 px-4 py-1 dark:bg-[#40414F] bg-gray-200 dark:text-neutral-100 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50"
                                                            placeholder={"Parameter Name"}
                                                            value={p.name}
                                                            onChange={(e) => {
                                                                const newParams = [...newOps[i].params];
                                                                newParams[pIndex].name = e.target.value;
                                                                setNewOps((prevOps) =>
                                                                    prevOps.map((op, opIndex) =>
                                                                      opIndex === i ? {...op, params: newParams }
                                                                                  : op
                                                                    )
                                                                  )
                                                            }}
                                                            />
                                                            { hoveredParam?.opIdx === i && 
                                                              hoveredParam?.paramIdx === pIndex &&
                                                            <button
                                                                title={"Remove Parameter"}
                                                                type="button"
                                                                className={`absolute right-2 top-1/2 transform -translate-y-1/2 z-20 p-1 text-sm bg:transparent rounded hover:bg-red-600 dark:hover:bg-red-700 focus:outline-none`}
                                                                onClick={() => {
                                                                    const newParams = newOps[i].params.filter((_, index) => index !== pIndex);
                                                                    setNewOps((prevOps) =>
                                                                        prevOps.map((op, opIndex) =>
                                                                            opIndex === i ? { ...op, params: newParams } : op
                                                                        )
                                                                    );
                                                                }}
                                                                >
                                                                <IconTrash size={16} />
                                                           </button>}
                                                        
                                                        </div>
                                                        <textarea title="Parameter Description"
                                                            className="w-full rounded-r border border-neutral-500 px-4 py-1 dark:bg-[#40414F] bg-gray-200 dark:text-neutral-100 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50"
                                                            placeholder={"Parameter Description"}
                                                            value={p.description}
                                                            onChange={(e) => {
                                                                const newParams = [...newOps[i].params];
                                                                newParams[pIndex].description = e.target.value;
                                                                setNewOps((prevOps) =>
                                                                    prevOps.map((op, opIndex) =>
                                                                      opIndex === i ? {...op, params: newParams }
                                                                                  : op
                                                                    )
                                                                  )
                                                            }}
                                                            rows={2} disabled={isRegisteringOps}
                                                        />
             
                                                    </div>

                                                )}
                                            </div>
                                            </>
                                            }
                                        </div>
                                    </div>

                                </div>
                            )
                                }

                    </div>}
                    <ExpansionComponent
                            title={"Understanding Ops"}
                            content={
                            <InfoBox content={
                                
                                <span className="text-xs w-full mr-12"> 
                                    <div className='mt-1 flex flex-row gap-2'>  
                                        <span className='mb-2 ml-5 text-[0.8rem] font-bold'> {"What are Ops?"}  </span>        
                                        Ops allow assistants to send requests to Amplify internal API functions.
                                    </div>

                                    <div className='flex flex-col gap-1'> 
                                        <div className='mt-1 flex flex-row gap-2'>  
                                            <span className='ml-5 text-[0.8rem] font-bold'> 
                                                {"How do Ops work"} 
                                            </span>        
                                            The Op will need to be registered in the Ops dynamo table with the information needed to make the API requets. To do this, you will need the following information: 
                                        </div> 
                                        {[{tag:'Tags', description: 'Identifers used to retrieve the cooresponding ops. Multiple ops can be grouped together by setting them with the same tag name.'},
                                          {tag:'Function Name', description: 'An arbitrary function name (no parentheses) an assistant can use in an auto block to execute the associated op request.'}, 
                                          {tag:'Path', description: 'The endpoint path for the Amplify API request.'}, 
                                          {tag:'Method', description: 'Specifies the HTTP request method required to interact with the endpoint.'},
                                          {tag:'Description', description: 'Overview of the ops purpose and functionality, designed to guide an assististant in determining when to create an auto block for executing an op.'}, 
                                          {tag:'Parameters', description: 'Details the required request parameters, including their names and descriptions. It is recommended to include the expected data type or a sample value to ensure the parameters adhere to validation rules.'},
                                        ].map((el: any, index: number) =>  <span key={index} className='ml-[138px]'> * {el.tag} - {el.description}</span> )}
                                        
                                    </div>
                                    
                                    <div className='flex flex-col gap-1'> 
                                        <div className='mt-1 flex flex-row gap-2'>  
                                            <span className='mb-2 ml-5 text-[0.8rem] font-bold'> {"How to use Ops in Assistants"}  </span>        
                                            
                                        </div>
                                        <span className='mb-1 ml-5'> * It is required to add the ops tag in your assistant instructions in the format: {"{{ops <op_tag>}}" }</span> 
                                        <span className='mb-2 ml-5'> &nbsp;&nbsp; {'The assistant will automatically be instructed to produce an auto block with the function name in order to execute the op request. The auto block will be in the format):'}  </span> 
                                        <span className='mb-2 flex justify-center'> ```auto
                                                                                        <br></br>
                                                                                        {"<function_name()>"}
                                                                                        <br></br>
                                                                                    ``` 
                                        </span> 
                                    </div>  
                                </span>
                            }

                            />
                        }
                        isOpened={true}
                    />

                    { ops.length > 0 && 
                    <div className="mt-8">
                    { showOpSearch && 
                        <div className="h-[0px] items-center ml-[200px] mr-14 flex flex-row gap-4"
                             style={{transform: 'translateY(6px)'}}>
                         <div className="ml-auto"> Search by</div>
                         <div className="w-[140px] flex items-center rounded-md border border-neutral-600 bg-neutral-200 dark:bg-[#39394a] p-1">
                         {["name", "tag"].map((search: string) => 
                         <button onMouseDown={(e) =>  e.preventDefault()}
                                key={search}
                                className={`flex flex-row gap-2 py-1 px-2 text-[12px] rounded-md focus:outline-none ${ opSearchBy === search ? 'bg-white dark:bg-[#1f1f29] text-neutral-900 dark:text-neutral-100 font-bold transform scale-105' : 'bg-transparent text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-[#31313f]'
                                }`}
                                disabled={opSearchBy === search}
                                onClick={(e) => {  
                                e.preventDefault();
                                e.stopPropagation();
                                setOpSearchBy(search as "name" | "tag");
                                }}
                            > <div className="mt-0.5">{ search === "tag" ?
                                <IconTags size={14}/> : <IconMessage size={14} />}</div>
                                <label className={`${opSearchBy === search ? "" : "cursor-pointer"} mt-[-1px] mr-0.5`}>{search}</label>
                            </button>
                         ) }
                        </div>
                        <div className="w-[200px]" >
                            <Search
                            placeholder={'Search Ops...'}
                            searchTerm={opSearchTerm}
                            onSearch={(searchTerm: string) => setOpSearchTerm(searchTerm.toLocaleLowerCase())}
                            />
                        </div>
                    </div>}
                    <ExpansionComponent
                        onOpen={() => setShowOpSearch(true)}
                        onClose={() => {
                            setShowOpSearch(false);
                            setOpSearchTerm('');
                        }}
                        title={"Manage Ops"}
                        content={
                        <div style={{ maxHeight: '500px', overflowY: 'auto', overflowX: 'hidden'}}>
                        <table className="mt-4 border-collapse w-full" >
                            <thead className="sticky top-0">
                            <tr className="bg-gray-200 dark:bg-[#373844]">
                                {['Function Name', 'Tags', 'Path', 'Method', 'Parameters', 'Description']
                                 .map((title, i) => (
                                <th key={i}
                                    className=" text-center border border-gray-500 text-neutral-600 dark:text-neutral-300"
                                > {title}
                                </th>
                                ))}
                                    
                            </tr>
                            </thead>
                            <tbody>
                            {ops.filter((op: OpDef) => opSearchTerm ? 
                                (opSearchBy === 'name' ? op.name : (op.tags?.join("") ?? '')).toLowerCase().includes(opSearchTerm) : true)
                                .map((op: OpDef, opIdx: number) => 
                                <tr key={op.id} 
                                    onMouseEnter={() => setHoveredOp(opIdx)}
                                    onMouseLeave={() => setHoveredOp(-1)}>
                                    <td className="text-center border border-neutral-500 p-2">
                                        {op.name}
                                    </td>
                                    
                                    <td className="text-center border border-neutral-500 px-0.5 py-1 break-words">
                                        <div className="flex flex-row gap-1 items-center justify-center" >
                                            {op.tags?.filter((t: string) => t !== 'all')
                                                     .map((t : string) => 
                                                        <div key={t}
                                                     className="my-0.5 p-0.5 text-center bg-white dark:bg-neutral-300 rounded-md h-[24px] min-w-[55px] shadow-lg text-gray-800 font-medium text-sm"> {t} </div>)
                                            }
                                        </div>
                                    </td>

                                    <td className="border border-neutral-500 px-2 py-2 text-start">
                                        {op.url}
                                    </td>

                                    <td className="text-center border border-neutral-500 px-4 py-2">
                                        {op.method}
                                    </td>
                                
                                    <td className="flex-grow text-center border border-neutral-500 p-2 max-w-[300px]">
                                        {op.params.length > 0 ? 
                                        <div className="flex flex-col gap-1 items-start w-full"> 
                                            {op.params.map((p: Record<string, string>, i: number) => 
                                            <div className="flex flex-row gap-1 items-start w-full" key={i}> 
                                                <div
                                                key={p.name + p.url}
                                                className="my-0.5 px-1 py-0.5 bg-white dark:bg-neutral-300 rounded-md h-[24px] shadow-lg text-gray-800 font-medium text-sm flex-shrink-0"> 
                                                {p.name} 
                                                </div>
                                                <textarea
                                                className="flex-grow w-full rounded-r border border-neutral-500 px-1 bg-transparent dark:text-neutral-100 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50"
                                                value={p.description ?? 'N/A'}
                                                disabled={true}
                                                rows={1} 
                                                />
                                            </div>
                                            )}
                                        </div> : 'No Parameters'}
                                    </td>

                                    <td className="text-center border border-neutral-500 max-w-[250px]">
                                        <textarea className="w-full rounded-r border border-neutral-500 px-1 bg-transparent dark:text-neutral-100 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50"
                                            value={op.description ?? 'N/A'}
                                            disabled={true}
                                            rows={3} 
                                        />
                                    </td>


                                    <td>
                                        <div className="w-[30px] flex-shrink-0 mr-6">
                                        {hoveredOp === opIdx  || isDeletingOp === opIdx ?
                                        <button
                                            title={"Delete Op"}
                                            type="button"
                                            disabled={isDeletingOp !== -1}
                                            className="ml-2 p-1 text-sm bg-neutral-400 dark:bg-neutral-500 rounded hover:bg-red-600 dark:hover:bg-red-700 focus:outline-none"
                                            onClick={() => {
                                                handleDeleteOp(op, opIdx);
                                            }}>
                                            {isDeletingOp === opIdx ? 
                                                    <LoadingIcon style={{ width: "20px", height: "20px" }}/> : <IconTrash size={20}/>}
                                        </button>  
                                            
                                        : null}
                                        </div>
                                    </td>
                                </tr>     
                            )}
                            </tbody>
                        </table>
                        </div>
                        }
                        isOpened={true}
                    /> </div>}
                </div>
                </>
            },

            // Embeddings Tab
                    // currently this tab doesnt have changes to report, when it does change to 
                    // `Embeddings${adminTabHasChanges(Array.from(unsavedConfigs), 'embeddings') ? " * " : ""}`
            {label: 'Embeddings',
                content:
                   <>
                   <div className="flex flex-row gap-4">
                        {titleLabel('Embeddings Circuit Breaker')}
                        {hasRetrievedEmbeddings && refresh(AdminConfigTypes.EMBEDDINGS, () => {
                            setHasRetrievedEmbeddings(false);
                            handleGetEmbeddings()}, false, "Retrieve Embeddings", "mt-2")} 
                    </div>

                    {hasRetrievedEmbeddings ? 
                        <div className="mx-10 max-w-full mt-4 ">
                            {embeddings.embeddings.length > 0 ? 
                            <table className="border-collapse w-full" style={{ tableLayout: 'fixed' }}>
                                <thead>
                                    <tr className="bg-gray-200 dark:bg-[#373844] text-center">
                                        {["Message ID", "Event Time", "User", "Key", "Size", "Terminate"].map((i) => (
                                            <th
                                                key={i}
                                                className="p-0.5 border border-gray-500 text-neutral-600 dark:text-neutral-300"
                                                style={{width:
                                                        i === "Message ID" ? "18%"
                                                            : i === "Event Time" ? "12%"
                                                            : i === "User" ? "25%"
                                                            : i === "Key" ? "28%"
                                                            : i === "Size" ? "8%"
                                                            : "10%", // terminated
                                                }}>
                                                {i}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {embeddings.embeddings.map((embedding: Embedding, i: number) => (
                                        <tr key={i}>
                                            <td className="border border-neutral-500 px-4 py-2 break-words">
                                                {embedding.messageId}
                                            </td>
                                            <td className="border border-neutral-500 px-4 py-2 text-center break-words">
                                                {userFriendlyDate(embedding.eventTime)}
                                            </td>
                                            <td className="border border-neutral-500 px-4 py-2 text-center">
                                                {embedding.object.user}
                                            </td>
                                            <td className="border border-neutral-500 px-4" style={{ overflow: 'hidden' }}>
                                                <div className="overflow-x-auto py-4" style={{ whiteSpace: 'nowrap' }}>
                                                    {embedding.object.key}
                                                </div>
                                            </td>
                                            <td className="border border-neutral-500 px-2 py-2 text-center">
                                                {embedding.object.size}
                                            </td>
                                            <td className="border border-neutral-500 py-2 text-center">
                                                <button
                                                    className={` ${
                                                        embedding.terminated || terminatingEmbeddings.includes(embedding.object.key) ? 'text-red-600' : 'hover:text-red-800'
                                                    }`}
                                                    disabled={embedding.terminated || terminatingEmbeddings.includes(embedding.object.key)}
                                                    title={embedding.terminated ? '' : 'Terminate'}
                                                    onClick={() => {
                                                        handleTerminateEmbedding(embedding.object.key);
                                                    }}
                                                >
                                                    {embedding.terminated ? 'Terminated' 
                                                                        : terminatingEmbeddings.includes(embedding.object.key) 
                                                                        ? 'Terminating...' :'Terminate'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table> : <>It looks like Embbeddings is operating correctly. There are no embeddings currently backed up in SQS.</>}
                        </div>
                        : 
                        ( loadingEmbeddings?
                            <label className="flex flex-row items-center ml-6  mt-2 py-1 px-2"> 
                                    <LoadingIcon style={{ width: "16px", height: "16px" }}/>
                                    <span className="ml-2">{'Loading Embeddings...'}</span>
                                
                            </label>
                        :
                        <button 
                            className="ml-8 mt-2 py-1 px-2 w-[200px] bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 hover:dark:bg-gray-700 mr-[-16px] rounded transition-colors duration-100 cursor-pointer" 
                            onClick={() => {
                                handleGetEmbeddings();
                                }}
                            title="Retrieve in-flight embeddings"
                            >
                            {"Retrieve SQS Embeddings"}
                                
                        </button>)
                    }
                   
                   </>
            },

        ]
        }
        />

    </div>

    }
  />
    
}



interface actionProps {
    label: string;
    onConfirm: () => void;
    onCancel: () => void;
    top?: string;
    clearOnConfirm?: boolean
}

export const UserAction: FC<actionProps> = ({ label, onConfirm, onCancel, top, clearOnConfirm = true}) => {
    
    return ( 
        <div className={`my-2.5 flex flex-row gap-1.5 transparent ${top}`}>
        <button 
                className="text-green-500 hover:text-green-700 cursor-pointer" 
                onClick={(e) => {
                    e.stopPropagation();
                    onConfirm();
                    if (clearOnConfirm) onCancel(); // clears
                }}
                
                title={label} 
            >
                <IconCheck size={16} />
        </button>
        
        <button
            className="text-red-500 hover:text-red-700 cursor-pointer"
            onClick={(e) => {
            e.stopPropagation();
                onCancel();

            }}
            title={"Cancel"}
        >
            <IconX size={16} />
        </button>
    </div>
    )
}



interface AddEmailsProps {
    key: String;
    emails: string[];
    allEmails: string[]
    handleUpdateEmails: (e: Array<string>) => void;
}

const AddEmailWithAutoComplete: FC<AddEmailsProps> = ({ key, emails, allEmails, handleUpdateEmails}) => {
    const [input, setInput] = useState<string>('');

    const handleAddEmails = () => {
        const entries = input.split(',').map(email => email.trim()).filter(email => email);

        const newEmails = entries.filter(email => /^\S+@\S+\.\S+$/.test(email) && !emails.includes(email));
        if (newEmails.length > 0) handleUpdateEmails([...emails, ...newEmails]);
        setInput('');
    };

    return ( 
    <div className='flex flex-row gap-2' key={JSON.stringify(key)}>
        <div className='w-full relative'>
            <EmailsAutoComplete
                input = {input}
                setInput =  {setInput}
                allEmails = {allEmails.filter((e:string) => !emails.includes(e))}
                alreadyAddedEmails = {emails}
            /> 
        </div>
        <div className="flex-shrink-0 ml-[-6px]">
            <button
                type="button"
                title='Add User'
                className="ml-2 mt-0.5 px-2 py-2 rounded-md border border-neutral-300 dark:border-white/20 px-2 transition-colors duration-200 cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10 "
                 
                onClick={handleAddEmails}
            >
                <IconPlus size={18} />
            </button>
        </div>
    
    </div>
    )
}



interface SelectProps {
    models: SupportedModel[],
    selectedKey:  keyof SupportedModel,
    label: string, 
    description: string,
    setUpdatedModels: (id: string, selectedKey:  keyof SupportedModel) => void;
}

const ModelDefaultSelect: FC<SelectProps> = ({models, selectedKey, label, description, setUpdatedModels}) => {

    const [selected, setSelected] = useState<SupportedModel | undefined>(models.find((model:SupportedModel) => !!model[selectedKey]));


    if (!models || models.length === 0) return null;


    return (
        <div className="flex flex-col gap-2 text-center">
            {label}
            <select className={"mb-2 text-center rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100  shadow-[0_2px_4px_rgba(0,0,0,0.1)] dark:shadow-[0_2px_4px_rgba(0,0,0,0.3)]"} 
                value={selected?.name ?? ''}
                title={description}
                onChange={(e) => {
                    const newSelected = models.find((model) => model.name === e.target.value);
                    if (newSelected) {
                        setSelected(newSelected);
                        setUpdatedModels(newSelected.id, selectedKey);
                    }
                }}
            > 
                {/* Placeholder option when no model is selected */}
                <option value="" disabled hidden>
                    Select Model
                </option>
                {models.map((model:SupportedModel) => (
                    <option key={model.id} value={model.name}>
                        {model.name}
                    </option>
                ))}
                
            </select>
        </div>
        
    );
}


interface AmplifyGroupSelectProps {
    groups: string[];
    selected: string[];
    setSelected: (s: string[]) => void;
    isDisabled? : boolean;
  }
  
  const AmplifyGroupSelect: React.FC<AmplifyGroupSelectProps> = ({ groups, selected, setSelected, isDisabled = false}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedGroups, setSelectedGroups] = useState<string[]>(selected);
    const dropdownRef = useRef<HTMLDivElement>(null);
  
    
      // Close dropdown when clicking outside
      useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
          if (
            dropdownRef.current &&
            !dropdownRef.current.contains(event.target as Node)
          ) {
            setIsOpen(false);
          }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
          document.removeEventListener('mousedown', handleClickOutside);
        };
      }, []);

      const toggleGroup = (group: string) => {
        const updatedSelectedGroups = selectedGroups.includes(group) 
                    ? selectedGroups.filter(item => item !== group) 
                    : [...selectedGroups, group];
        setSelectedGroups(updatedSelectedGroups);
        setSelected(updatedSelectedGroups);
      };
    
      return (
        <div className="relative w-full" ref={dropdownRef}>
          <button
            type="button"
            className="text-center w-full overflow-x-auto px-4 py-2 text-left text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100 flex-grow-0"
            style={{ whiteSpace: 'nowrap' }}
            onClick={() => setIsOpen(!isOpen)}
            disabled={isDisabled}
          >
            {selectedGroups.length > 0 || isDisabled
              ? selectedGroups.join(', ')
              : ('Select Amplify Groups')}
          </button>
    
          {isOpen && !isDisabled && (
            <ul className="absolute z-10 mt-0.5 max-h-60 w-full overflow-auto rounded-lg border-2 border-neutral-500 bg-white shadow-xl dark:border-neutral-900 dark:bg-[#40414F]">
              {groups.sort((a, b) => a.localeCompare(b))
                     .map((g) => (
                <li
                  key={g}
                  className="flex cursor-pointer items-center justify-between px-4 py-2 text-neutral-900 hover:bg-gray-200 dark:hover:bg-gray-500 dark:text-neutral-100 "
                  onClick={() => toggleGroup(g)}
                >
                  <span>{g}</span>
                  {selectedGroups.includes(g) && (
                    <IconCheck className="text-gray-500 dark:text-gray-200" size={18} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      );
  };


interface FileUploadProps {
    id: string
    label?: string;
    allowedFileExtensions: string[];
    onAttach: (file:File, fileName: string) => void;
    completeCheck: () => boolean;
    onRemove: () => void;
}


const FileUpload: FC<FileUploadProps> = ({id, label, allowedFileExtensions, onAttach, 
                                          completeCheck, onRemove}) => {
    const [uploadedDocument, setUploadedDocument] = useState<{name: string, extension: string} | null>(null);
    const [documentState, setDocumentState] = useState<number>(0);

    const getProgress = () => {
        if (uploadedDocument) {
            const percentage = documentState;
            return (
                <div className="mr-1 flex items-center justify-center w-6 dark:text-black" style={{minWidth:"20px"}}>
                <CircularProgressbar
                    styles={buildStyles({
                        textSize: '32px',
                        pathTransitionDuration: 0.5,
                        pathColor: `rgba(62, 152, 199})`,
                        textColor: '#000000',
                        trailColor: '#d6d6d6',
                        backgroundColor: '#3e98c7',
                    })}
                    value={percentage} text={`${percentage}`} />
                </div>
            );
        }
        return <LoadingIcon/>;
    }


    const isComplete = () => {
        return uploadedDocument && documentState == 100 && completeCheck();
    }

useEffect(() => {
    if (uploadedDocument && documentState >= 5 && documentState < 100) {
        if (completeCheck()) {
            setDocumentState(100);
        } else {
            setTimeout( () => {
              setDocumentState(documentState +5);
            }, 200
            );            
        }
    }

}, [documentState]);
    


const handleFile = async (file:File, name: string) => {
    try {
        setDocumentState(5); // starts simulation 
        onAttach(file, name);
    } catch (error) {
        console.error("Failed to handle file:", error);
    }
}

    return ( uploadedDocument ?
        <div className="flex pb-2 mr-1" key={id}>
            <div
                className={`${isComplete() ? 'bg-white' : 'bg-yellow-400'} text-black flex flex-row items-center justify-between border bg-white rounded-md px-1 py-1 ml-1 mr-1 shadow-md dark:shadow-lg`}
                style={{ maxWidth: '220px' }}
            >

                {!isComplete() ?
                    getProgress() : 
                    <IconCheck className="text-green-500" />
                }

                <div className="ml-1" title={uploadedDocument.name}>
                    <p className={`truncate font-medium text-sm ${isComplete() ? 'text-gray-800' : 'text-gray-800'}`}
                        style={{ maxWidth: '160px' }}>
                            {uploadedDocument.name}
                    </p>
                </div>

                 <button
                        className=" text-gray-400 hover:text-gray-600 transition-all"
                        onClick={(e) =>{
                            e.preventDefault();
                            e.stopPropagation();
                            setUploadedDocument(null);
                            setDocumentState(0);
                            onRemove();
                        }}>
                        <IconCircleX/>
                </button>
            </div>
            
        </div> :
        <>
            <input
            id={id}
            className="sr-only"
            tabIndex={-1}
            type="file"
            accept={allowedFileExtensions.map(ext => `.${ext}`).join(',')}
            onChange={(e) => {
                if (!e.target.files || e.target.files.length === 0) return;
                const file = e.target.files[0];
                const fileName = file.name;
                const extension = fileName.split('.').pop() || '';
                setUploadedDocument({name: fileName.replace(/[_\s]+/g, '_'),
                                     extension: extension});

                if (!allowedFileExtensions.includes(extension)) {
                    alert(`This file type is not supported. Please upload a file of type: ${allowedFileExtensions.join(', ')}`);
                    return;
                }
                handleFile(file, fileName);
                e.target.value = ''; // Clear the input after files are handled
            }}
            />
    
            <button
            className="flex flex-row gap-1 left-2 top-2 rounded-sm p-1 text-neutral-800 opacity-60 hover:bg-neutral-200 hover:text-neutral-900 dark:bg-opacity-50 dark:text-neutral-100 dark:hover:text-neutral-200"
            onClick={() => {
                const importFile = document.querySelector('#' + id) as HTMLInputElement;
                if (importFile) {
                importFile.click();
                }
            }}
            title="Upload File"
            >
            {<IconPlus size={20}/>}
            {label}
            </button>
        </>
    );
};






// empty data 
const emptySupportedModel = () => {
    return {
    id: '',
    name: '',
    provider: '',
    inputContextWindow: 0, // maximum length of a message
    outputTokenLimit: 0, // max num of tokens a model will respond with (most models have preset max of 4096)
    outputTokenCost: 0.0,
    inputTokenCost: 0.0,
    description: '',
    exclusiveGroupAvailability: [],
    supportsImages: false,
    supportsSystemPrompts: false, 
    systemPrompt: '',

    defaultCheapestModel: false, // recommend cheaper model
    defaultAdvancedModel: false,// recommend more expensive 
    defaultEmbeddingsModel: false,
    defaultQAModel: false,
    isDefault: false,

    isAvailable: false,
    isBuiltIn: false
    } as SupportedModel;
};

const emptyOps = () => {
    return {
        id: '', // same as name
        name: '',
        url: '',
        method: 'POST',
        description: '',
        type: 'custom',
        params: [],
        tag: '',
    } as OpDef;
}

const emptyFeature = () => {
    return {
        enabled: false,
        userExceptions: [],
        amplifyGroupExceptions: []
    } as FeatureFlag;
}


const emptyPptx = () => {
    return {
        name : '',
        isAvailable : false,
        amplifyGroups : []
    } as Pptx_TEMPLATES;
}

const emptyAmplifyGroups = (currentUser: string) => {
    return {
        groupName : '', // can be a cognito group per say
        members : [],
        createdBy : currentUser,
        includeFromOtherGroups : []
    } as Amplify_Group
}


interface Ast_Group_Data {
    group_id : string;
    groupName : string;
    amplifyGroups : string[];
    createdBy : string;
    isPublic : boolean;
    numOfAssistants: number;
    supportConvAnalysis: boolean;
}


interface Pptx_TEMPLATES {
    name : string;
    isAvailable : boolean;
    amplifyGroups : string[];
}


interface Amplify_Group { // can be a cognito group 
    groupName : string; 
    members : string[];
    createdBy : string;
    includeFromOtherGroups? : string[]; // if is a cognito group, this will always be Absent
}

interface Amplify_Groups {
    [groupName: string] : Amplify_Group;
}

interface PromptCostAlert {
    isActive: boolean;
    alertMessage: string;
    cost: Number;
}
