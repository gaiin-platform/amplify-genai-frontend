import { FC, useContext, useEffect, useRef, useState } from "react";
import { Modal } from "../ReusableComponents/Modal";
import HomeContext from "@/pages/api/home/home.context";
import InputsMap from "../ReusableComponents/InputMap";
import {  getAdminConfigs, getAvailableModels, getFeatureFlags, getPowerPoints, testEmbeddingEndpoint, testEndpoint, updateAdminConfigs } from "@/services/adminService";
import { AdminConfigTypes, Endpoint, FeatureFlagConfig, OpenAIModelsConfig, SupportedModel, SupportedModelsConfig, AdminTab, DefaultModelsConfig } from "@/types/admin";
import { IconCheck, IconRefresh, IconX} from "@tabler/icons-react";
import { LoadingIcon } from "../Loader/LoadingIcon";
import toast from "react-hot-toast";
import React from "react";
import { ActiveTabs } from "../ReusableComponents/ActiveTabs";
import { OpDef } from "@/types/op";
import { AMPLIFY_ASSISTANTS_GROUP_NAME } from "@/utils/app/amplifyAssistants";
import { noRateLimit, PeriodType, RateLimit, rateLimitObj } from "@/types/rateLimit";
import { adminTabHasChanges} from "@/utils/app/admin";
import { OpenAIEndpointsTab } from "./AdminComponents/OpenAIEndpoints";
import { FeatureFlagsTab } from "./AdminComponents/FeatureFlags";
import { emptySupportedModel, SupportedModelsTab } from "./AdminComponents/SupportedModels";
import { ConfigurationsTab } from "./AdminComponents/Configurations";
import { Integration, IntegrationProviders, integrationProvidersList, IntegrationSecretsMap, IntegrationsMap } from "@/types/integrations";
import { checkActiveIntegrations } from "@/services/oauthIntegrationsService";
import { IntegrationsTab } from "./AdminComponents/Integrations";
import { EmbeddingsTab } from "./AdminComponents/Embeddings";
import { OpsTab } from "./AdminComponents/Ops";
import { Pptx_TEMPLATES, Ast_Group_Data, FeatureDataTab, } from "./AdminComponents/FeatureData";
import { ConversationStorage } from "@/types/conversationStorage";


export const titleLabel = (title: string, textSize: string = "lg") => 
                <div className={`mt-4 text-${textSize} font-bold text-black dark:text-neutral-200`}>
                    {title}
                </div>;

export const loadingIcon = (size: number = 16) => <LoadingIcon style={{ width: `${size}px`, height: `${size}px` }}/>


export const loading = <div className="flex flex-row gap-2 ml-10 text-[1.2rem] text-gray-500"> 
                        <>{loadingIcon(22)}</> Loading...
                      </div>;

export function camelToTitleCase(str: string) {
    return str
        .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between lowercase and uppercase letters
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // Keep consecutive uppercase letters together
        .replace(/\$/g, ' $') // Add a space before any dollar sign
        .replace(/^./, char => char.toUpperCase()); // Capitalize the first letter
}
interface Props {
    open: boolean;
    onClose: () => void;
}


export const AdminUI: FC<Props> = ({ open, onClose }) => {
    const { state: { statsService, storageSelection, amplifyUsers, featureFlags}, dispatch: homeDispatch, setLoadingMessage } = useContext(HomeContext);

    const [loadData, setLoadData] = useState<boolean>(true);   
    const [stillLoadingData, setStillLoadingData] = useState<boolean>(true);  


    const [unsavedConfigs, setUnsavedConfigs] = useState<Set<AdminConfigTypes>>(new Set());

    const [admins, setAdmins] = useState<string[]>([]);  
    const [allEmails, setAllEmails] = useState<Array<string> | null>(null);

    const [rateLimit, setRateLimit] = useState<{period: PeriodType, rate: string}>({...noRateLimit, rate: '0'});
    const [promptCostAlert, setPromptCostAlert] = useState<PromptCostAlert>({isActive:false, alertMessage: '', cost: 0});
    const [emailSupport, setEmailSupport] = useState<EmailSupport>({isActive:false, email:''});
    const [aiEmailDomain, setAiEmailDomain] = useState<string>('');

    const [defaultConversationStorage, setDefaultConversationStorage] = useState<ConversationStorage>('future-local');

    const [availableModels, setAvailableModels] = useState<SupportedModelsConfig>({});   
    const [defaultModels, setDefaultModels] = useState<DefaultModelsConfig>({user: '', advanced: '', cheapest: '', agent: '', documentCaching: '', embeddings: ''});

    const [features, setFeatures] = useState<FeatureFlagConfig>({}); 

    const [appVars, setAppVars] = useState<{ [key: string]: string }>({});    
    const [appSecrets, setAppSecrets] = useState<{ [key: string]: string }>({});  
    const [refreshingTypes, setRefreshingTypes] = useState< AdminConfigTypes[]>([]);


    const [openAiEndpoints, setOpenAiEndpoints] = useState<OpenAIModelsConfig>({models: []}); 
    const testEndpointsRef = useRef<{ url: string; key: string, model:string}[]>([]);

    const [ops, setOps] = useState<OpDef[]>([]);

    const [astGroups, setAstGroups] = useState<Ast_Group_Data[]>([]);
    const [changedAstGroups, setChangedAstGroups] = useState<string[]>([]);    
    const [amplifyAstGroupId, setAmplifyAstGroupId] = useState<string>('');

    const [templates, setTemplates] = useState<Pptx_TEMPLATES[]>([]);
    const [changedTemplates, setChangedTemplates] = useState<string[]>([]);

    const [ampGroups, setAmpGroups] = useState<Amplify_Groups>({});

    const [integrations, setIntegrations] = useState<IntegrationsMap | null >(null);
    const [integrationSecrets, setIntegrationSecrets] = useState<IntegrationSecretsMap>({});
    const [hasChildModalOpen, setHasChildModalOpen] = useState<boolean>(false);

    const mergeIntegrationLists = ( supported: Integration[] | undefined,
                                    baseIntegrations: Integration[] | undefined ): Integration[] => {
        if (!supported) return baseIntegrations || [];
        if (!baseIntegrations) return [];
      
        const supportedLookup = new Map(supported.map((integration) => [integration.id, integration]));
        const mergedIntegrations = baseIntegrations.map((i: Integration) => supportedLookup.get(i.id) ?? i );
        return mergedIntegrations;
      };
    
    const getActiveIntegrations = async (supportedIntegrations: IntegrationsMap | null) => {
        const integrationsResult = await checkActiveIntegrations(integrationProvidersList);
        
        const integrationMap: IntegrationsMap  = integrationsResult.integrationLists;
        if (supportedIntegrations) {
            // update the integrations to reflect changes in the base integrations compared to the saved ones in the admin table
           Object.keys(integrationMap).forEach((integrationKey: string) => {
                const key = integrationKey as IntegrationProviders
                integrationMap[key] = mergeIntegrationLists(supportedIntegrations[key], integrationMap[key]);
            }); 
        }

        // console.log("integrations map:\n\n", integrationMap)
        if (Object.keys(integrationMap).length > 0) {
            setIntegrations(integrationMap);
            setIntegrationSecrets(integrationsResult.secrets)
        }
    }
    // for cases when adding the integration feature flag manually 
    useEffect(() => {
        if (!stillLoadingData && !integrations && Object.keys(features).includes('integrations' )) {
            getActiveIntegrations(null);
        }
    }, [features])

  
    useEffect(() => {
       
        const getConfigs = async () => {
            setLoadData(false);
                //   statsService.openSettingsEvent(); 
            setLoadingMessage("Loading Admin Interface...");
            setStillLoadingData(true);
            const nonlazyReq = getAdminConfigs(); // start longer call
           
            const lazyResult = await getAdminConfigs(true);
            if (lazyResult.success) {
                const data = lazyResult.data;
                setAdmins(data[AdminConfigTypes.ADMINS] || []);
                const featureData = data[AdminConfigTypes.FEATURE_FLAGS];
                setFeatures(featureData || {});
                // handle calls to integrations 
                if (Object.keys(featureData).includes('integrations')) getActiveIntegrations(data[AdminConfigTypes.INTEGRATIONS]); // async no need to wait

                setAmpGroups(data[AdminConfigTypes.AMPLIFY_GROUPS] || {})
                setTemplates(data[AdminConfigTypes.PPTX_TEMPLATES] || []);
                setRateLimit(data[AdminConfigTypes.RATE_LIMIT || rateLimit]);
                setPromptCostAlert(data[AdminConfigTypes.PROMPT_COST_ALERT || promptCostAlert]);
                setDefaultConversationStorage(data[AdminConfigTypes.DEFAULT_CONVERSATION_STORAGE] || defaultConversationStorage);
                setEmailSupport(data[AdminConfigTypes.EMAIL_SUPPORT || emailSupport]);
                setAiEmailDomain(data[AdminConfigTypes.AI_EMAIL_DOMAIN] || aiEmailDomain);
                setDefaultModels(data[AdminConfigTypes.DEFAULT_MODELS] || {});
                setLoadingMessage("");
            
                const nonlazyResult = await nonlazyReq;
                if (nonlazyResult.success) {
                    const data = nonlazyResult.data;
                
                    setAppVars(data[AdminConfigTypes.APP_VARS] || {});
                    setAppSecrets(data[AdminConfigTypes.APP_SECRETS] || {});
                    const ops:OpDef[] = data[AdminConfigTypes.OPS] || [];
                    setOps(ops.sort((a: OpDef, b: OpDef) => a.name.localeCompare(b.name)))
                    setOpenAiEndpoints(data[AdminConfigTypes.OPENAI_ENDPOINTS] || { models: [] });
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
                    setStillLoadingData(false);
                    return;
                } 
            } 
            alert("Unable to fetch admin configurations at this time. Please try again.");
            console.log("Error: ", lazyResult);

            setLoadingMessage("");
            onClose();
            
        }
        if (open && loadData) getConfigs();

        const fetchEmails = async () => {
            setAllEmails(amplifyUsers);
        };
        if (!allEmails) fetchEmails();
      
      }, [open, loadData])
  

    const getConfigTypeData = (type: AdminConfigTypes) => {
        switch (type) {
            case AdminConfigTypes.ADMINS:
                return admins;
            case AdminConfigTypes.RATE_LIMIT:
                return rateLimitObj(rateLimit.period, rateLimit.rate);
            case AdminConfigTypes.PROMPT_COST_ALERT:
                return {
                    ...promptCostAlert,
                    cost: typeof promptCostAlert.cost === 'string' 
                        ? parseFloat(promptCostAlert.cost as string) || 0 
                        : Number(promptCostAlert.cost) || 0
                };
            case AdminConfigTypes.DEFAULT_CONVERSATION_STORAGE:
                return defaultConversationStorage;
            case AdminConfigTypes.EMAIL_SUPPORT:
                return emailSupport;
            case AdminConfigTypes.AI_EMAIL_DOMAIN:
                return aiEmailDomain;
            case AdminConfigTypes.APP_SECRETS:
                return appSecrets;
            case AdminConfigTypes.APP_VARS:
                return appVars;
            case AdminConfigTypes.FEATURE_FLAGS:
                return features;
            case AdminConfigTypes.AVAILABLE_MODELS:
                // Sanitize and enforce types for available models
                const sanitizedModels: SupportedModelsConfig = {};
                Object.entries(availableModels).forEach(([key, model]) => {
                    const sanitizedModel = { ...model } as SupportedModel;
                    
                    // Ensure numeric fields are numbers, not strings
                    const numericFields = ["inputContextWindow", "outputTokenLimit"] as const;
                    numericFields.forEach((field) => {
                        const value = typeof model[field] === 'string' 
                            ? parseInt(String(model[field]), 10) || 0 
                            : (model[field] as number) || 0;
                        (sanitizedModel as any)[field] = value;
                    });
                    
                    const floatFields = ["outputTokenCost", "inputTokenCost", "cachedTokenCost"] as const;
                    floatFields.forEach((field) => {
                        const value = typeof model[field] === 'string' 
                            ? parseFloat(String(model[field])) || 0.0 
                            : (model[field] as number) || 0.0;
                        (sanitizedModel as any)[field] = value;
                    });
                    
                    // Ensure boolean fields are booleans
                    const booleanFields = ["supportsImages", "supportsReasoning", "supportsSystemPrompts", "isAvailable", "isBuiltIn"] as const;
                    booleanFields.forEach((field) => {
                        (sanitizedModel as any)[field] = Boolean(model[field]);
                    });
                    
                    // Ensure string fields are strings
                    const stringFields = ["id", "name", "provider", "description", "systemPrompt"] as const;
                    stringFields.forEach((field) => {
                        (sanitizedModel as any)[field] = String(model[field] || "");
                    });
                    
                    // Ensure array field is an array
                    sanitizedModel.exclusiveGroupAvailability = Array.isArray(model.exclusiveGroupAvailability) 
                        ? model.exclusiveGroupAvailability : [];
                    
                    sanitizedModels[key] = sanitizedModel;
                });
                return sanitizedModels;
            case AdminConfigTypes.DEFAULT_MODELS:
                const nonEmptyStrDefaults: any = {...defaultModels};
                Object.keys(nonEmptyStrDefaults).forEach((key: string) => {
                    if (nonEmptyStrDefaults[key] === '') nonEmptyStrDefaults[key] = null;
                });
                return nonEmptyStrDefaults;
            case AdminConfigTypes.AST_ADMIN_GROUPS:
                return astGroups.filter((g:Ast_Group_Data) => changedAstGroups.includes(g.group_id))
                                .map((g:Ast_Group_Data) =>  ({ group_id: g.group_id, 
                                                              isPublic : g.isPublic,
                                                              amplifyGroups : g.amplifyGroups,
                                                              supportConvAnalysis: g.supportConvAnalysis
                                                            }));
            case AdminConfigTypes.AMPLIFY_GROUPS:
                Object.keys(ampGroups).forEach((key: string) => {
                    if (!ampGroups[key].isBillingGroup) ampGroups[key].isBillingGroup = false;
                    if (!ampGroups[key].rateLimit) ampGroups[key].rateLimit = noRateLimit;
                });
                return ampGroups;
            case AdminConfigTypes.PPTX_TEMPLATES:
                return templates.filter((pptx:Pptx_TEMPLATES) => changedTemplates.includes(pptx.name));
            case AdminConfigTypes.INTEGRATIONS:
                return integrations;
            case AdminConfigTypes.OPENAI_ENDPOINTS:
                const toTest:{key: string, url: string, model:string}[] = [];
                
                // Track removed models for toast notifications
                const originalModelNames = new Set<string>();
                openAiEndpoints.models.forEach(model => {
                    Object.keys(model).forEach(modelName => originalModelNames.add(modelName));
                });
                
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
                            // Only include models that have at least one endpoint
                            if (endpoints.length > 0) {
                                newModel[modelName] = { endpoints };
                            }
                        });
                        return newModel;
                    }).filter(model => Object.keys(model).length > 0) // Remove empty model objects
                };
                
                // Track cleaned model names and show toast for removed models
                const cleanedModelNames = new Set<string>();
                cleanedOpenAiEndpoints.models.forEach(model => {
                    Object.keys(model).forEach(modelName => cleanedModelNames.add(modelName));
                });
                
                // Show toast for each removed model
                originalModelNames.forEach(modelName => {
                    if (!cleanedModelNames.has(modelName)) {
                        toast(`Removed ${modelName} (no endpoints configured)`);
                    }
                });
                
                // Update UI state to match cleaned data
                setOpenAiEndpoints(cleanedOpenAiEndpoints);
                
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

    const saveUpdateAvailableModels = async () => {
        try {
            const response = await getAvailableModels();
            if (response.success && response.data && response.data?.models.length > 0) {
                const defaultModel = response.data.default;
                const models = response.data.models;
                if (defaultModel) homeDispatch({ field: 'defaultModelId', value: defaultModel.id });
                if (response.data.cheapest) homeDispatch({ field: 'cheapestModelId', value: response.data.cheapest.id });
                if (response.data.advanced) homeDispatch({ field: 'advancedModelId', value: response.data.advanced.id });
                const modelMap = models.reduce((acc:any, model:any) => ({...acc, [model.id]: model}), {});
                homeDispatch({ field: 'availableModels', value: modelMap});  

                //save default model 
                localStorage.setItem('defaultModel', JSON.stringify(defaultModel));
                return;
            } 
        } catch (e) {
            console.log("Failed to fetch models: ", e);
        } 
    }
      
    const saveUpdateFeatureFlags = async () => {
        const result = await getFeatureFlags();
        if (result.success && result.data) {
            let flags: any = result.data;
            homeDispatch({ field: 'featureFlags', value: flags});
            localStorage.setItem('mixPanelOn', JSON.stringify(flags.mixPanel ?? false));
        }
    }

    const saveUpdatePptx = async () => {
        const result = await getPowerPoints();
        let pptx: any = result.success && result.data ? result.data :  
                        templates.filter((pptx:Pptx_TEMPLATES) => pptx.isAvailable).map((pptx:Pptx_TEMPLATES) => pptx.name);
        homeDispatch({ field: 'powerPointTemplateOptions', value: pptx});
    }

    const validateSavedData = () => {
        const models = Object.values(availableModels);
        if (models.filter((m:SupportedModel) => m.isAvailable && !m.id.includes('embedding'))
                  .length === 0) {
            alert("No models were made available. To enable chat, update the models under the 'Supported Models' tab.");
        }
        if (Object.keys(defaultModels).some((key:string) => defaultModels[key as keyof DefaultModelsConfig] === '' && key !== 'agent'))  {
            alert("Ensure all default models are set in the 'Supported Models' tab.");
            return false;
        }

        if (emailSupport.isActive && !emailSupport.email) {
            alert("The Support Email feature cannot be activated without providing an email address. Please add an email address or disable the feature.");
            return false;
        }
        return true;
    }

    const updateOnSave = () => {
        const saveAction = (types: AdminConfigTypes[], action: () => void) => {
            if (types.some(type => unsavedConfigs.has(type))) action();
        }

        saveAction([AdminConfigTypes.FEATURE_FLAGS], saveUpdateFeatureFlags);
        saveAction([AdminConfigTypes.AVAILABLE_MODELS, AdminConfigTypes.DEFAULT_MODELS], saveUpdateAvailableModels);
        saveAction([AdminConfigTypes.PPTX_TEMPLATES], saveUpdatePptx); 
        saveAction([AdminConfigTypes.EMAIL_SUPPORT], () => homeDispatch({ field: 'supportEmail', value: emailSupport.email}));
        saveAction([AdminConfigTypes.AI_EMAIL_DOMAIN], () => homeDispatch({ field: 'aiEmailDomain', value: aiEmailDomain}));
        if (!storageSelection) saveAction([AdminConfigTypes.DEFAULT_CONVERSATION_STORAGE], () => homeDispatch({ field: 'storageSelection', value: defaultConversationStorage})); 
    }

    const handleSave = async () => {
        if (Array.from(unsavedConfigs).length === 0) {
            toast("No Changes to Save");
            return;
        }
        const collectUpdateData =  Array.from(unsavedConfigs).map((type: AdminConfigTypes) => ({type: type, data: getConfigTypeData(type)}));
        console.log("Saving...", collectUpdateData);
        
        // Enhanced logging for admin data
        const adminData = collectUpdateData.find(item => item.type === AdminConfigTypes.ADMINS);

        if (!validateSavedData()) return;
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
            
            // Check for detailed admin-specific response
            if (result.data && result.data[AdminConfigTypes.ADMINS]) {
                const adminResult = result.data[AdminConfigTypes.ADMINS];
                
                if (adminResult.success) {
                    
                    // VERIFY WHAT ACTUALLY GOT SAVED
                    if (adminData && adminData.data.length > 0) {
                        // Delay to allow backend processing to complete
                        setTimeout(async () => {
                            try {
                                // Fetch current admin configurations to see what's actually saved
                                const response = await getAdminConfigs(true); // Use existing service
                                
                                if (response.success && response.data) {
                                    const actualSavedAdmins = response.data[AdminConfigTypes.ADMINS] || [];
                                    
                                    // Compare what was sent vs what's actually saved
                                    const sentSet = new Set(adminData.data);
                                    const savedSet = new Set(actualSavedAdmins);
                                    
                                    const notSaved = adminData.data.filter((admin: string) => !savedSet.has(admin));
                                    const unexpectedlyAdded = actualSavedAdmins.filter((admin: string) => !sentSet.has(admin));
                                    
                                    if (notSaved.length > 0) {
                                        toast(`⚠️ ${notSaved.length} admin(s) were rejected: ${notSaved.join(', ')}`, {
                                            icon: '⚠️',
                                            duration: 8000
                                        });
                                    }
                                    
                                    // Update local state to match what's actually in the database
                                    if (actualSavedAdmins.length !== adminData.data.length) {
                                        setAdmins(actualSavedAdmins);
                                    }
                                } else {
                                    console.error("❌ Failed to fetch current admin configs for verification:", response);
                                }
                            } catch (error) {
                                console.error("❌ Verification error:", error);
                            }
                        }, 1000); // 1 second delay
                    }
                } else {
                    console.warn("⚠️ Admin validation issues:", adminResult);
                    toast(`Admin save completed with warnings. Check console for details.`, {
                        icon: '⚠️',
                        duration: 5000
                    });
                }
            }
            
            // update ui affecting changes 
            updateOnSave();
            toast("Configurations successfully saved");
            setUnsavedConfigs(new Set());
            testEndpointsRef.current = [];
        } else {
            // Enhanced error logging
            console.error("❌ Save failed. Full response:", result);
            
            if (adminData) {
                console.error("❌ Failed to save admin emails:", adminData.data);
            }
            
            if (result.data && Object.keys(result.data).length !== unsavedConfigs.size) {
                const unsucessful: AdminConfigTypes[] = [];
                Array.from(unsavedConfigs).forEach(key => {
                    if ((!(key in result.data)) || (!result.data[key].success)) {
                        unsucessful.push(key);
                        
                        // Log specific failure details for admins
                        if (key === AdminConfigTypes.ADMINS && result.data[key]) {
                            console.error("❌ Admin save failure details:", result.data[key]);
                            if (result.data[key].error) {
                                console.error("📝 Admin validation error:", result.data[key].error);
                            }
                            if (result.data[key].message) {
                                console.error("💬 Admin save message:", result.data[key].message);
                            }
                        }
                    }
                });
                
                // should always be true
                if (unsucessful.length > 0) {
                    const errorMsg = `The following configurations were unable to be saved: \n${unsucessful.join(', ')}`;
                    console.error("❌ Unsuccessful saves:", errorMsg);
                    alert(errorMsg);
                    
                    // Additional admin-specific error display
                    if (unsucessful.includes(AdminConfigTypes.ADMINS) && result.data[AdminConfigTypes.ADMINS]) {
                        const adminError = result.data[AdminConfigTypes.ADMINS];
                        if (adminError.error || adminError.message) {
                            toast(`Admin validation failed: ${adminError.error || adminError.message}`, {
                                icon: '❌',
                                duration: 8000
                            });
                        }
                    }
                }
            } else {
                console.error("❌ Complete save failure. Result:", result);
                alert("We are unable to save the configurations at this time. Please try again later...");
            }
        }

        setLoadingMessage('');
    }

    const updateUnsavedConfigs = (configType: AdminConfigTypes) => {
        setUnsavedConfigs(prevChanges => new Set(prevChanges).add(configType));
    }



    const refresh = (type: AdminConfigTypes, click: () => void, loading: boolean, title:string = 'Refresh Variables', top: string = 'mt-1') => 
        <button
            title={title}
            disabled={refreshingTypes.includes(type)} 
            className={`${top} py-1.5 flex-shrink-0 items-center gap-3 rounded-md border border-neutral-300 dark:border-white/20 px-2 dark:text-white transition-colors duration-200 ${refreshingTypes.includes(type) ? "" : "cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10"}`}
            onClick={() => {
                setRefreshingTypes([...refreshingTypes, type]);
                click();
            }}
        >
            {refreshingTypes.includes(type) ? <>{loadingIcon()}</> : <IconRefresh size={16}/>}
        </button>

    const isAvailableCheck = (isAvailable: boolean, handleClick: () => void, styling: string = '') => 
        <button title={isAvailable ? "Click to set as unavailable"        
                                   : "Click to set as available" } 
            className={`cursor-pointer dark:text-neutral-200 text-neutral-900 ${styling}`} 
            onClick={handleClick}>
            {isAvailable ? <IconCheck className='text-green-600 hover:opacity-60' size={18} /> 
                         : <IconX  className='text-red-600 hover:opacity-60' size={18} />}       
        </button>
                                                                                                            // parsing should happen in the change
    

    
    const admin_text = 'rounded-r border border-neutral-500 px-4 py-1 dark:bg-[#40414F] bg-gray-200 dark:text-neutral-100 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50'

    const tabTitle = (tab: AdminTab) => {
        return  `${tab}${adminTabHasChanges(Array.from(unsavedConfigs), tab) ? " * " : ""}`;
    }
        
    if (!open) return <></>;

    return <Modal 
    fullScreen={true}
    disableClickOutside={hasChildModalOpen}
    title={`Admin Interface${unsavedConfigs.size > 0 ? " * " : ""}`}
    onCancel={() => {
        if (unsavedConfigs.size === 0 || confirm("You have unsaved changes!\n\nYou will lose any unsaved data, would you still like to close the Admin Interface?"))  onClose();
       
    }} 
    onSubmit={() => handleSave()
    }
    cancelLabel={"Close"}
    submitLabel={"Save Changes"}
    disableSubmit={unsavedConfigs.size === 0 || stillLoadingData}
    content={
      <div className="text-black dark:text-white overflow-x-hidden">
         <button
            title={`Reload Admin Interface. ${unsavedConfigs.size > 0 ? "Any unsaved changes will be lost.": ""}`}
            className={` fixed top-4 left-[205px] flex-shrink-0 items-center gap-3 rounded-md border border-neutral-300 dark:border-white/20 p-2 dark:text-white transition-colors duration-200 cursor-pointer hover:bg-neutral-200  dark:hover:bg-gray-500/10`}
            id="adminModalReloadButton"
            onClick={() => {
                setLoadData(true);
                setUnsavedConfigs(new Set());
            }}
        >
            <IconRefresh size={16}/>
        </button>

        { open &&
         <ActiveTabs
            id="AdminInterfaceTabs"
            tabs={[


///////////////////////////////////////////////////////////////////////////////

                // Configurations Tab

            {label: tabTitle("Configurations"), 
                title: unsavedConfigs.size > 0 ? " Contains Unsaved Changes  " : "",
                content:
                <ConfigurationsTab
                    admins={admins}
                    setAdmins={setAdmins}
                    ampGroups={ampGroups}
                    setAmpGroups={setAmpGroups}
                    rateLimit={rateLimit}
                    setRateLimit={setRateLimit}
                    promptCostAlert={promptCostAlert}
                    setPromptCostAlert={setPromptCostAlert}
                    defaultConversationStorage={defaultConversationStorage}
                    setDefaultConversationStorage={setDefaultConversationStorage}
                    emailSupport={emailSupport}
                    setEmailSupport={setEmailSupport}
                    aiEmailDomain={aiEmailDomain}
                    setAiEmailDomain={featureFlags.assistantEmailEvents ? setAiEmailDomain : undefined}
                    allEmails={allEmails}
                    admin_text={admin_text}
                    updateUnsavedConfigs={updateUnsavedConfigs}
                    onModalStateChange={setHasChildModalOpen}
                />
            },


///////////////////////////////////////////////////////////////////////////////
            // Supported Models

            {label: tabTitle('Supported Models'),
                content:
                stillLoadingData ? loading :
                <SupportedModelsTab
                    availableModels={availableModels}
                    setAvailableModels={setAvailableModels}
                    defaultModels={defaultModels}
                    setDefaultModels={setDefaultModels}
                    ampGroups={ampGroups}
                    isAvailableCheck={isAvailableCheck}
                    updateUnsavedConfigs={updateUnsavedConfigs}
                    featureFlags={features}
                />
            },
///////////////////////////////////////////////////////////////////////////////
            // Application Variables
            { label: tabTitle('Application Variables'),
                content : 
                stillLoadingData ? loading :
                <>
                <div className="admin-style-settings-card">
                    <div className="admin-style-settings-card-header">
                        <div className="flex flex-row items-center gap-3 mb-2">
                            <h3 className="admin-style-settings-card-title">Application Secrets</h3>
                        </div>
                        <p className="admin-style-settings-card-description">Manage sensitive application configuration secrets</p>
                    </div>

                    { Object.keys(appSecrets).length > 0 && true ?
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
                    </div> : <>No Application Secrets Retrieved</>}
                </div>
                    
                <br className="mt-4"></br>

                <div className="admin-style-settings-card">
                    <div className="admin-style-settings-card-header">
                        <div className="flex flex-row items-center gap-3 mb-2">
                            <h3 className="admin-style-settings-card-title">Application Environment Variables</h3>
                        </div>
                        <p className="admin-style-settings-card-description">Configure application environment variables and settings</p>
                    </div>

                    { Object.keys(appSecrets).length > 0 ?
                        <div className="mx-4 truncate">
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
                        </div> : <>No Application Variables Retrieved</>}
                </div>
                </>
            },

///////////////////////////////////////////////////////////////////////////////
            // OpenAi Endpoints
            { label: tabTitle('OpenAi Endpoints'),
                content : 
                stillLoadingData ? loading :
                <OpenAIEndpointsTab
                    openAiEndpoints={openAiEndpoints}
                    setOpenAiEndpoints={setOpenAiEndpoints}
                    updateUnsavedConfigs={updateUnsavedConfigs}
                />

            },

///////////////////////////////////////////////////////////////////////////////
            // Feature Flags

            {label: tabTitle('Feature Flags'),
                content:
                <FeatureFlagsTab
                    features={features}
                    setFeatures={setFeatures}
                    ampGroups={ampGroups}
                    allEmails={allEmails}
                    admin_text={admin_text}
                    updateUnsavedConfigs={updateUnsavedConfigs}
                />
            },
///////////////////////////////////////////////////////////////////////////////

            // Manage Feature Data Tab
                    
            {label: tabTitle("Feature Data"),
             content:
                <FeatureDataTab
                    stillLoadingData={stillLoadingData}
                    admins={admins}
                    ampGroups={ampGroups}
                    astGroups={astGroups}
                    setAstGroups={setAstGroups}
                    amplifyAstGroupId={amplifyAstGroupId}
                    setAmplifyAstGroupId={setAmplifyAstGroupId}
                    changedAstGroups={changedAstGroups}
                    setChangedAstGroups={setChangedAstGroups}
                    templates={templates}
                    setTemplates={setTemplates}
                    changedTemplates={changedTemplates}
                    setChangedTemplates={setChangedTemplates}
                    isAvailableCheck={isAvailableCheck}
                    admin_text={admin_text}
                    updateUnsavedConfigs={updateUnsavedConfigs}
                />
            },

///////////////////////////////////////////////////////////////////////////////

            // Ops

            {label: tabTitle('Ops'),
                content:
                stillLoadingData ? loading :
                <OpsTab
                    ops={ops}
                    setOps={setOps}
                    admin_text={admin_text}
                />
                
            },

            // Embeddings Tab
                    // currently this tab doesnt have changes to report, when it does change to 
                    // tabTitle("Embeddings")
            {label: 'Embeddings',
                content: 
                <EmbeddingsTab
                    refresh={refresh}
                    refreshingTypes={refreshingTypes}
                    setRefreshingTypes={setRefreshingTypes}
                />
            },

            ///////////////////////////////////////////////////////////////////////////////
  
            // Integrations Tab - only included if included in the feature flags list
            ...(integrations ? 
                [
                {label: tabTitle("Integrations"),
                    content:
                    stillLoadingData ? loading :
                    <IntegrationsTab
                        integrations={integrations}
                        setIntegrations={setIntegrations}
                        integrationSecrets={integrationSecrets}
                        setIntegrationSecrets={setIntegrationSecrets}
                        updateUnsavedConfigs={updateUnsavedConfigs}
                    />
                }
                ] : []),

        ]
        }
        /> }

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
                className="text-green-500 hover:text-green-700 cursor-pointer p-0.5"
                id="confirmAction" 
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
            className="text-red-500 hover:text-red-700 cursor-pointer p-0.5"
            onClick={(e) => {
            e.stopPropagation();
                onCancel();

            }}
            title={"Cancel"}
            id="cancelAction"
        >
            <IconX size={16} />
        </button>
    </div>
    )
}




interface AmplifyGroupSelectProps {
    groups: string[];
    selected: string[];
    setSelected: (s: string[]) => void;
    isDisabled? : boolean;
    label?: string;
  }
  
export const AmplifyGroupSelect: React.FC<AmplifyGroupSelectProps> = ({ groups, selected, setSelected, isDisabled = false, label = 'Amplify Groups'}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedGroups, setSelectedGroups] = useState<string[]>(selected);
    const [dropdownDirection, setDropdownDirection] = useState<'down' | 'up'>('down');
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

      const handleDropdownToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        
        if (!isOpen && dropdownRef.current) {
          // Check if there's enough space below for the dropdown
          const rect = dropdownRef.current.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const spaceBelow = viewportHeight - rect.bottom;
          const dropdownHeight = 240; // max-h-60 = ~240px
          
          // If not enough space below, show dropdown upward
          setDropdownDirection(spaceBelow < dropdownHeight ? 'up' : 'down');
        }
        
        setIsOpen(!isOpen);
      };

      const hasGroupOptions = groups.length > 0;
    
      return (
        <div className="relative w-full" ref={dropdownRef}>
          <button
            type="button"
            className="text-center w-full overflow-x-auto px-4 py-2 text-left text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100 flex-grow-0"
            style={{ whiteSpace: 'nowrap', cursor: hasGroupOptions ? "pointer" : 'default' }}
            onClick={handleDropdownToggle}
            onMouseEnter={(e) => e.stopPropagation()}
            onMouseLeave={(e) => e.stopPropagation()}
            disabled={isDisabled}
          >
            {selectedGroups.length > 0 || isDisabled ? selectedGroups.join(', ') 
                 : hasGroupOptions ? `Select ${label}` : `No ${label} Available`}
          </button>
    
          {isOpen && !isDisabled && hasGroupOptions && (
            <ul className={`absolute z-[99999] max-h-60 w-full overflow-auto rounded-lg border-2 border-neutral-500 bg-white shadow-xl dark:border-neutral-900 dark:bg-[#40414F] ${
                dropdownDirection === 'up' ? 'bottom-full mb-0.5' : 'top-full mt-0.5'
              }`}
                style={{ 
                  zIndex: 99999,
                  isolation: 'isolate',
                  transform: 'translateZ(0)'
                }}
                onMouseEnter={(e) => e.stopPropagation()}
                onMouseLeave={(e) => e.stopPropagation()}>
              {groups.sort((a, b) => a.localeCompare(b))
                     .map((g) => (
                <li
                  key={g}
                  className="flex cursor-pointer items-center justify-between px-4 py-2 text-neutral-900 hover:bg-gray-200 dark:hover:bg-gray-500 dark:text-neutral-100 "
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleGroup(g);
                  }}
                  onMouseEnter={(e) => e.stopPropagation()}
                  onMouseLeave={(e) => e.stopPropagation()}
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





export interface Amplify_Group { // can be a cognito group 
    groupName : string; 
    members : string[];
    createdBy : string;
    includeFromOtherGroups? : string[]; // if is a cognito group, this will always be Absent
    rateLimit? : RateLimit;
    isBillingGroup? : boolean;
}

export interface Amplify_Groups {
    [groupName: string] : Amplify_Group;
}

export interface PromptCostAlert {
    isActive: boolean;
    alertMessage: string;
    cost: Number;
}

export interface EmailSupport {
    isActive: boolean;
    email: string;
}
