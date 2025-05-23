import { useSession } from "next-auth/react";
import { FC, useContext, useEffect, useRef, useState } from "react";
import { Modal } from "../ReusableComponents/Modal";
import HomeContext from "@/pages/api/home/home.context";
import InputsMap from "../ReusableComponents/InputMap";
import {  getAdminConfigs, getAvailableModels, getFeatureFlags, getPowerPoints, testEmbeddingEndpoint, testEndpoint, updateAdminConfigs } from "@/services/adminService";
import { AdminConfigTypes, Endpoint, FeatureFlagConfig, OpenAIModelsConfig, SupportedModel, SupportedModelsConfig, AdminTab, DefaultModelsConfig } from "@/types/admin";
import { IconCheck, IconPlus, IconRefresh, IconX} from "@tabler/icons-react";
import { LoadingIcon } from "../Loader/LoadingIcon";
import toast from "react-hot-toast";
import React from "react";
import { ActiveTabs } from "../ReusableComponents/ActiveTabs";
import { OpDef } from "@/types/op";
import { AMPLIFY_ASSISTANTS_GROUP_NAME } from "@/utils/app/amplifyAssistants";
import { noRateLimit, PeriodType, rateLimitObj } from "@/types/rateLimit";
import { adminTabHasChanges} from "@/utils/app/admin";
import { Model } from "@/types/model";
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


export const loading = <div className="flex flex-row gap-2 ml-10 text-[1.2rem]"> 
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
    const { state: { statsService, storageSelection, amplifyUsers}, dispatch: homeDispatch, setLoadingMessage } = useContext(HomeContext);
    const { data: session } = useSession();
    const userEmail = session?.user?.email;

    const [loadData, setLoadData] = useState<boolean>(true);   
    const [stillLoadingData, setStillLoadingData] = useState<boolean>(true);  


    const [unsavedConfigs, setUnsavedConfigs] = useState<Set<AdminConfigTypes>>(new Set());

    const [admins, setAdmins] = useState<string[]>([]);  
    const [allEmails, setAllEmails] = useState<Array<string> | null>(null);

    const [rateLimit, setRateLimit] = useState<{period: PeriodType, rate: string}>({...noRateLimit, rate: '0'});
    const [promptCostAlert, setPromptCostAlert] = useState<PromptCostAlert>({isActive:false, alertMessage: '', cost: 0});
    const [emailSupport, setEmailSupport] = useState<EmailSupport>({isActive:false, email:''});

    const [defaultConversationStorage, setDefaultConversationStorage] = useState<ConversationStorage>('future-local');

    const [availableModels, setAvailableModels] = useState<SupportedModelsConfig>({});   
    const [defaultModels, setDefaultModels] = useState<DefaultModelsConfig>({user: '', advanced: '', cheapest: '', agent: '', embeddings: '', qa: ''});

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
                setDefaultModels(data[AdminConfigTypes.DEFAULT_MODELS] || {});
                setLoadingMessage("");
            
                const nonlazyResult = await nonlazyReq;
                if (nonlazyResult.success) {
                    const data = nonlazyResult.data;
                
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
                    setStillLoadingData(false);
                    return;
                } 
            } 
            alert("Unable to fetch admin configurations at this time. Please try again.");
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
                return promptCostAlert;
            case AdminConfigTypes.DEFAULT_CONVERSATION_STORAGE:
                return defaultConversationStorage;
            case AdminConfigTypes.EMAIL_SUPPORT:
                return emailSupport;
            case AdminConfigTypes.APP_SECRETS:
                return appSecrets;
            case AdminConfigTypes.APP_VARS:
                return appVars;
            case AdminConfigTypes.FEATURE_FLAGS:
                return features;
            case AdminConfigTypes.AVAILABLE_MODELS:
                return availableModels;
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
                return ampGroups;
            case AdminConfigTypes.PPTX_TEMPLATES:
                return templates.filter((pptx:Pptx_TEMPLATES) => changedTemplates.includes(pptx.name));
            case AdminConfigTypes.INTEGRATIONS:
                return integrations;
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
        if (!storageSelection) saveAction([AdminConfigTypes.DEFAULT_CONVERSATION_STORAGE], () => homeDispatch({ field: 'storageSelection', value: defaultConversationStorage})); 
    }

    const handleSave = async () => {
        if (Array.from(unsavedConfigs).length === 0) {
            toast("No Changes to Save");
            return;
        }
        const collectUpdateData =  Array.from(unsavedConfigs).map((type: AdminConfigTypes) => ({type: type, data: getConfigTypeData(type)}));
        console.log("Saving... ", collectUpdateData);
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
            // update ui affecting changes 
            updateOnSave();
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

    return <AdminInterfaceWithTabs
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
            allEmails={allEmails}
            admin_text={admin_text}
            updateUnsavedConfigs={updateUnsavedConfigs}
            stillLoadingData={stillLoadingData}
            availableModels={availableModels}
            setAvailableModels={setAvailableModels}
            defaultModels={defaultModels}
            setDefaultModels={setDefaultModels}
            isAvailableCheck={isAvailableCheck}
            features={features}
            setFeatures={setFeatures}
            appSecrets={appSecrets}
            setAppSecrets={setAppSecrets}
            appVars={appVars}
            setAppVars={setAppVars}
            openAiEndpoints={openAiEndpoints}
            setOpenAiEndpoints={setOpenAiEndpoints}
            testEndpointsRef={testEndpointsRef}
            refreshingTypes={refreshingTypes}
            setRefreshingTypes={setRefreshingTypes}
            refresh={refresh}
            testEndpoints={callTestEndpoints}
            ops={ops}
            setOps={setOps}
            astGroups={astGroups}
            setAstGroups={setAstGroups}
            changedAstGroups={changedAstGroups}
            setChangedAstGroups={setChangedAstGroups}
            amplifyAstGroupId={amplifyAstGroupId}
            setAmplifyAstGroupId={setAmplifyAstGroupId}
            templates={templates}
            setTemplates={setTemplates}
            changedTemplates={changedTemplates}
            setChangedTemplates={setChangedTemplates}
            integrations={integrations}
            setIntegrations={setIntegrations}
            integrationSecrets={integrationSecrets}
            setIntegrationSecrets={setIntegrationSecrets}
            unsavedConfigs={unsavedConfigs}
            onClose={onClose}
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

      const hasGroupOptions = groups.length > 0;
    
      return (
        <div className="relative w-full" ref={dropdownRef}>
          <button
            type="button"
            className="text-center w-full overflow-x-auto px-4 py-2 text-left text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100 flex-grow-0"
            style={{ whiteSpace: 'nowrap', cursor: hasGroupOptions ? "pointer" : 'default' }}
            onClick={() => setIsOpen(!isOpen)}
            disabled={isDisabled}
          >
            {selectedGroups.length > 0 || isDisabled ? selectedGroups.join(', ') 
                 : hasGroupOptions ? `Select ${label}` : `No ${label} Available`}
          </button>
    
          {isOpen && !isDisabled && hasGroupOptions && (
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





export interface Amplify_Group { // can be a cognito group 
    groupName : string; 
    members : string[];
    createdBy : string;
    includeFromOtherGroups? : string[]; // if is a cognito group, this will always be Absent
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

// Beautiful Admin Interface with Tab System
interface AdminInterfaceWithTabsProps {
    admins: string[];
    setAdmins: (a: string[]) => void;
    ampGroups: Amplify_Groups;
    setAmpGroups: (g: Amplify_Groups) => void;
    rateLimit: {period: PeriodType, rate: string};
    setRateLimit: (l: {period: PeriodType, rate: string}) => void;
    promptCostAlert: PromptCostAlert;
    setPromptCostAlert: (a: PromptCostAlert) => void;
    defaultConversationStorage: ConversationStorage;
    setDefaultConversationStorage: (s: ConversationStorage) => void;
    emailSupport: EmailSupport;
    setEmailSupport: (e: EmailSupport) => void;
    allEmails: Array<string> | null;
    admin_text: string;
    updateUnsavedConfigs: (t: AdminConfigTypes) => void;
    stillLoadingData: boolean;
    availableModels: SupportedModelsConfig;
    setAvailableModels: (m: SupportedModelsConfig) => void;
    defaultModels: DefaultModelsConfig;
    setDefaultModels: (m: DefaultModelsConfig) => void;
    isAvailableCheck: any;
    features: FeatureFlagConfig;
    setFeatures: (f: FeatureFlagConfig) => void;
    appSecrets: { [key: string]: string };
    setAppSecrets: (s: { [key: string]: string }) => void;
    appVars: { [key: string]: string };
    setAppVars: (v: { [key: string]: string }) => void;
    openAiEndpoints: OpenAIModelsConfig;
    setOpenAiEndpoints: (e: OpenAIModelsConfig) => void;
    testEndpointsRef: any;
    refreshingTypes: AdminConfigTypes[];
    setRefreshingTypes: (t: AdminConfigTypes[]) => void;
    refresh: (type: AdminConfigTypes, click: () => void, loading: boolean, title?: string, top?: string) => JSX.Element;
    testEndpoints: any;
    ops: OpDef[];
    setOps: (o: OpDef[]) => void;
    astGroups: Ast_Group_Data[];
    setAstGroups: (g: Ast_Group_Data[]) => void;
    changedAstGroups: string[];
    setChangedAstGroups: (g: string[]) => void;
    amplifyAstGroupId: string;
    setAmplifyAstGroupId: (id: string) => void;
    templates: Pptx_TEMPLATES[];
    setTemplates: (t: Pptx_TEMPLATES[]) => void;
    changedTemplates: string[];
    setChangedTemplates: (t: string[]) => void;
    integrations: IntegrationsMap | null;
    setIntegrations: (i: IntegrationsMap | null) => void;
    integrationSecrets: IntegrationSecretsMap;
    setIntegrationSecrets: (s: IntegrationSecretsMap) => void;
    unsavedConfigs: Set<AdminConfigTypes>;
    onClose: () => void;
}

export const AdminInterfaceWithTabs: FC<AdminInterfaceWithTabsProps> = (props) => {
    const [activeTab, setActiveTab] = useState<string>('configurations');
    
    const tabs = [
        {
            id: 'configurations',
            label: 'Configurations',
            hasChanges: props.unsavedConfigs.size > 0
        },
        {
            id: 'models',
            label: 'Supported Models',
            hasChanges: false
        },
        {
            id: 'variables',
            label: 'App Variables',
            hasChanges: false
        },
        {
            id: 'endpoints',
            label: 'OpenAI Endpoints',
            hasChanges: false
        },
        {
            id: 'features',
            label: 'Feature Flags',
            hasChanges: false
        },
        {
            id: 'integrations',
            label: 'Integrations',
            hasChanges: false
        },
        {
            id: 'embeddings',
            label: 'Embeddings',
            hasChanges: false
        },
        {
            id: 'ops',
            label: 'Operations',
            hasChanges: false
        },
        {
            id: 'data',
            label: 'Feature Data',
            hasChanges: props.changedAstGroups.length > 0 || props.changedTemplates.length > 0
        }
    ];

    const renderTabContent = () => {
        switch (activeTab) {
            case 'configurations':
                return (
                    <ConfigurationsTab
                        admins={props.admins}
                        setAdmins={props.setAdmins}
                        ampGroups={props.ampGroups}
                        setAmpGroups={props.setAmpGroups}
                        rateLimit={props.rateLimit}
                        setRateLimit={props.setRateLimit}
                        promptCostAlert={props.promptCostAlert}
                        setPromptCostAlert={props.setPromptCostAlert}
                        defaultConversationStorage={props.defaultConversationStorage}
                        setDefaultConversationStorage={props.setDefaultConversationStorage}
                        emailSupport={props.emailSupport}
                        setEmailSupport={props.setEmailSupport}
                        allEmails={props.allEmails}
                        admin_text={props.admin_text}
                        updateUnsavedConfigs={props.updateUnsavedConfigs}
                    />
                );
            case 'models':
                return props.stillLoadingData ? loading : (
                    <SupportedModelsTab
                        availableModels={props.availableModels}
                        setAvailableModels={props.setAvailableModels}
                        defaultModels={props.defaultModels}
                        setDefaultModels={props.setDefaultModels}
                        ampGroups={props.ampGroups}
                        isAvailableCheck={props.isAvailableCheck}
                        updateUnsavedConfigs={props.updateUnsavedConfigs}
                        featureFlags={props.features}
                    />
                );
            case 'variables':
                return props.stillLoadingData ? loading : (
                    <div className="admin-configurations-content">
                        <div className="admin-config-section">
                            <div className="admin-config-header">Application Secrets</div>
                            {Object.keys(props.appSecrets).length > 0 ? (
                                <InputsMap
                                    id={AdminConfigTypes.APP_SECRETS}
                                    inputs={Object.keys(props.appSecrets).sort((a, b) => b.length - a.length)
                                        .map((secret: string) => ({label: secret, key: secret}))}
                                    state={props.appSecrets}
                                    inputChanged={(key: string, value: string) => {
                                        props.setAppSecrets({...props.appSecrets, [key]: value});
                                        props.updateUnsavedConfigs(AdminConfigTypes.APP_SECRETS);
                                    }}
                                    obscure={true}
                                />
                            ) : <div>No Application Secrets Retrieved</div>}
                        </div>

                        <div className="admin-config-section">
                            <div className="admin-config-header">Application Environment Variables</div>
                            {Object.keys(props.appVars).length > 0 ? (
                                <InputsMap
                                    id={AdminConfigTypes.APP_VARS}
                                    inputs={Object.keys(props.appVars)
                                        .sort((a, b) => b.length - a.length)
                                        .map((variable: string) => ({label: variable, key: variable}))}
                                    state={props.appVars}
                                    inputChanged={(key: string, value: string) => {
                                        props.setAppVars({...props.appVars, [key]: value});
                                        props.updateUnsavedConfigs(AdminConfigTypes.APP_VARS);
                                    }}
                                    obscure={true}
                                />
                            ) : <div>No Application Variables Retrieved</div>}
                        </div>
                    </div>
                );
            case 'endpoints':
                return props.stillLoadingData ? loading : (
                    <OpenAIEndpointsTab
                        openAiEndpoints={props.openAiEndpoints}
                        setOpenAiEndpoints={props.setOpenAiEndpoints}
                        updateUnsavedConfigs={props.updateUnsavedConfigs}
                    />
                );
            case 'features':
                return props.stillLoadingData ? loading : (
                    <FeatureFlagsTab
                        features={props.features}
                        setFeatures={props.setFeatures}
                        ampGroups={props.ampGroups}
                        allEmails={props.allEmails}
                        admin_text={props.admin_text}
                        updateUnsavedConfigs={props.updateUnsavedConfigs}
                    />
                );
            case 'integrations':
                return props.stillLoadingData ? loading : (
                    props.integrations ? (
                        <IntegrationsTab
                            integrations={props.integrations}
                            setIntegrations={props.setIntegrations}
                            integrationSecrets={props.integrationSecrets}
                            setIntegrationSecrets={props.setIntegrationSecrets}
                            updateUnsavedConfigs={props.updateUnsavedConfigs}
                        />
                    ) : (
                        <div>No integrations available</div>
                    )
                );
            case 'embeddings':
                return props.stillLoadingData ? loading : (
                    <EmbeddingsTab
                        refresh={props.refresh}
                        refreshingTypes={props.refreshingTypes}
                        setRefreshingTypes={props.setRefreshingTypes}
                    />
                );
            case 'ops':
                return props.stillLoadingData ? loading : (
                    <OpsTab
                        ops={props.ops}
                        setOps={props.setOps}
                        admin_text={props.admin_text}
                    />
                );
            case 'data':
                return (
                    <FeatureDataTab
                        stillLoadingData={props.stillLoadingData}
                        admins={props.admins}
                        ampGroups={props.ampGroups}
                        astGroups={props.astGroups}
                        setAstGroups={props.setAstGroups}
                        amplifyAstGroupId={props.amplifyAstGroupId}
                        setAmplifyAstGroupId={props.setAmplifyAstGroupId}
                        changedAstGroups={props.changedAstGroups}
                        setChangedAstGroups={props.setChangedAstGroups}
                        templates={props.templates}
                        setTemplates={props.setTemplates}
                        changedTemplates={props.changedTemplates}
                        setChangedTemplates={props.setChangedTemplates}
                        isAvailableCheck={props.isAvailableCheck}
                        admin_text={props.admin_text}
                        updateUnsavedConfigs={props.updateUnsavedConfigs}
                    />
                );
            default:
                return <div>Tab content not found</div>;
        }
    };

    return (
        <Modal
            width={() => window.innerWidth * 0.9}
            height={() => window.innerHeight * 0.92}
            title="Admin Interface"
            showClose={true}
            onCancel={props.onClose}
            showCancel={false}
            showSubmit={false}
            disableModalScroll={true}
            content={
                <div className="admin-interface-content">
                    <div className="admin-tab-bar">
                        <div className="admin-tab-pills">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`admin-tab-pill ${activeTab === tab.id ? 'active' : ''} ${tab.hasChanges ? 'has-changes' : ''}`}
                                >
                                    <span className="admin-tab-label">{tab.label}</span>
                                    <div className="admin-tab-indicator"></div>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="admin-scrollable-content">
                        <div className="admin-content-area">
                            {renderTabContent()}
                        </div>
                    </div>
                </div>
            }
        />
    );
};
