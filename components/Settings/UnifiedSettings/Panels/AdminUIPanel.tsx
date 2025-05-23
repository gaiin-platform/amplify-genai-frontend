import React, { FC, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import HomeContext from '@/pages/api/home/home.context';
import { IconSettings, IconCode, IconServer, IconToggleLeft, IconDatabase, IconShield, IconActivity, IconFileText, IconPlus, IconRefresh, IconX, IconCheck } from '@tabler/icons-react';
import { useSession } from 'next-auth/react';
import { getAdminConfigs, getAvailableModels, getFeatureFlags, getPowerPoints, testEmbeddingEndpoint, testEndpoint, updateAdminConfigs, getUserAmplifyGroups } from '@/services/adminService';
import { AdminConfigTypes, FeatureFlagConfig, Endpoint, OpenAIModelsConfig, SupportedModel, SupportedModelsConfig, AdminTab, DefaultModelsConfig } from '@/types/admin';
import { LoadingIcon } from '@/components/Loader/LoadingIcon';
import { ActiveTabs } from '../../../ReusableComponents/ActiveTabs';
import InputsMap from '../../../ReusableComponents/InputMap';
import { OpDef } from '@/types/op';
import { AMPLIFY_ASSISTANTS_GROUP_NAME } from '@/utils/app/amplifyAssistants';
import { noRateLimit, PeriodType, rateLimitObj } from '@/types/rateLimit';
import { adminTabHasChanges } from '@/utils/app/admin';
import { Model } from '@/types/model';
import { OpenAIEndpointsTab } from '../../../Admin/AdminComponents/OpenAIEndpoints';
import { FeatureFlagsTab } from '../../../Admin/AdminComponents/FeatureFlags';
import { emptySupportedModel, SupportedModelsTab } from '../../../Admin/AdminComponents/SupportedModels';
import { ConfigurationsTab } from '../../../Admin/AdminComponents/Configurations';
import { Integration, IntegrationProviders, integrationProvidersList, IntegrationSecretsMap, IntegrationsMap } from '@/types/integrations';
import { checkActiveIntegrations } from '@/services/oauthIntegrationsService';
import { IntegrationsTab } from '../../../Admin/AdminComponents/Integrations';
import { EmbeddingsTab } from '../../../Admin/AdminComponents/Embeddings';
import { OpsTab } from '../../../Admin/AdminComponents/Ops';
import { Pptx_TEMPLATES, Ast_Group_Data, FeatureDataTab } from '../../../Admin/AdminComponents/FeatureData';
import { ConversationStorage } from '@/types/conversationStorage';
import { fetchEmailSuggestions } from '@/services/emailAutocompleteService';
import { checkAvailableModelId } from '@/utils/app/models';
import toast from 'react-hot-toast';
import { Amplify_Group, Amplify_Groups, EmailSupport, PromptCostAlert } from '@/components/Admin/AdminUI';



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
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .replace(/\$/g, ' $')
        .replace(/^./, char => char.toUpperCase());
}

// Full AdminUI functionality in a panel
export const AdminUIPanel: FC<Props> = ({ onSave, onCancel, isDirty }) => {
  const { state: { statsService, storageSelection, amplifyUsers}, dispatch: homeDispatch, setLoadingMessage } = useContext(HomeContext);
  const { data: session } = useSession();
  const { t } = useTranslation('settings');
  const userEmail = session?.user?.email;

  const [loadData, setLoadData] = useState<boolean>(true);   
  const [stillLoadingData, setStillLoadingData] = useState<boolean>(true);  
  const [isDirtyState, setIsDirtyState] = useState(false);

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

  const [activeTab, setActiveTab] = useState<string>('configurations');

  // Notify parent about dirty state
  useEffect(() => {
    if (isDirty) {
      isDirty(isDirtyState || unsavedConfigs.size > 0);
    }
  }, [isDirty, isDirtyState, unsavedConfigs]);

  const updateUnsavedConfigs = (type: AdminConfigTypes) => {
    setUnsavedConfigs(prev => {
      const newSet = new Set(Array.from(prev));
      newSet.add(type);
      return newSet;
    });
    setIsDirtyState(true);
  };

  const admin_text = 'admin';

  const isAvailableCheck = (isAvailable: boolean, handleClick: () => void, styling: string = '') => {
    return (
      <button 
        title={isAvailable ? "Click to set as unavailable" : "Click to set as available"}
        onClick={handleClick}
        className={`px-2 py-1 text-xs rounded ${
          isAvailable 
            ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-800/20 dark:text-green-400 dark:hover:bg-green-700/30' 
            : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800/20 dark:text-gray-400 dark:hover:bg-gray-700/30'
        } ${styling}`}
      >
        {isAvailable ? 'Available' : 'Unavailable'}
      </button>
    );
  };

  const refresh = (type: AdminConfigTypes, click: () => void, loading: boolean, title?: string, top?: string) => {
    return (
      <button
        onClick={click}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        <IconRefresh size={16} className={loading ? 'animate-spin' : ''} />
        {loading ? 'Refreshing...' : 'Refresh'}
      </button>
    );
  };

  const testEndpoints = async () => {
    // Implementation for testing endpoints
    console.log('Testing endpoints...');
  };

  // Load admin data on mount
  useEffect(() => {
    if (loadData) {
      const fetchAdminData = async () => {
        try {
          setStillLoadingData(true);
          
          // Fetch admin configurations
          const configsResult = await getAdminConfigs();
          if (configsResult.success) {
            const data = configsResult.data;
            
            if (data[AdminConfigTypes.ADMINS]) {
              setAdmins(data[AdminConfigTypes.ADMINS]);
            }
            
            if (data[AdminConfigTypes.RATE_LIMIT]) {
              const rl = data[AdminConfigTypes.RATE_LIMIT];
              setRateLimit({period: rl.period, rate: rl.rate.toString()});
            }
            
            if (data[AdminConfigTypes.PROMPT_COST_ALERT]) {
              setPromptCostAlert(data[AdminConfigTypes.PROMPT_COST_ALERT]);
            }
            
            if (data[AdminConfigTypes.EMAIL_SUPPORT]) {
              setEmailSupport(data[AdminConfigTypes.EMAIL_SUPPORT]);
            }
            
            if (data[AdminConfigTypes.DEFAULT_CONVERSATION_STORAGE]) {
              setDefaultConversationStorage(data[AdminConfigTypes.DEFAULT_CONVERSATION_STORAGE]);
            }
            
            if (data[AdminConfigTypes.APP_SECRETS]) {
              setAppSecrets(data[AdminConfigTypes.APP_SECRETS]);
            }
            
            if (data[AdminConfigTypes.APP_VARS]) {
              setAppVars(data[AdminConfigTypes.APP_VARS]);
            }
            
            if (data[AdminConfigTypes.OPENAI_ENDPOINTS]) {
              setOpenAiEndpoints(data[AdminConfigTypes.OPENAI_ENDPOINTS]);
            }
            
            if (data[AdminConfigTypes.OPS]) {
              setOps(data[AdminConfigTypes.OPS]);
            }
          }

          // Fetch models
          const modelsResult = await getAvailableModels();
          if (modelsResult.success) {
            setAvailableModels(modelsResult.data.models.reduce((acc: any, model: any) => ({...acc, [model.id]: model}), {}));
            setDefaultModels({
              user: modelsResult.data.default?.id || '',
              advanced: modelsResult.data.advanced?.id || '',
              cheapest: modelsResult.data.cheapest?.id || '',
              agent: modelsResult.data.agent?.id || '',
              embeddings: modelsResult.data.embeddings?.id || '',
              qa: modelsResult.data.qa?.id || ''
            });
          }

          // Fetch feature flags
          const flagsResult = await getFeatureFlags();
          if (flagsResult.success) {
            setFeatures(flagsResult.data);
          }

          // Fetch email suggestions
          if (amplifyUsers) {
            setAllEmails(amplifyUsers);
          } else {
            const emailsResult = await fetchEmailSuggestions("*");
            if (emailsResult && emailsResult.emails) {
              setAllEmails(emailsResult.emails);
            }
          }

          // Fetch Amplify groups
          const groupsResult = await getUserAmplifyGroups();
          if (groupsResult.success) {
            setAmpGroups(groupsResult.data);
          }

          // Fetch integrations
          const integrationsResult = await checkActiveIntegrations(integrationProvidersList);
          if (integrationsResult) {
            setIntegrations(integrationsResult.integrationLists);
          }

        } catch (error) {
          console.error('Error loading admin data:', error);
          toast.error('Failed to load admin data');
        } finally {
          setStillLoadingData(false);
          setLoadData(false);
        }
      };

      fetchAdminData();
    }
  }, [loadData, amplifyUsers]);

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    setIsDirtyState(false);
    setUnsavedConfigs(new Set());
  };

  const handleSave = () => {
    if (onSave) {
      onSave();
    }
    setIsDirtyState(false);
    setUnsavedConfigs(new Set());
  };

  // Define tabs like in original AdminUI
  const tabs = [
    {
      id: 'configurations',
      label: 'Configurations',
      hasChanges: unsavedConfigs.size > 0
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
      hasChanges: changedAstGroups.length > 0 || changedTemplates.length > 0
    }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'configurations':
        return (
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
            allEmails={allEmails}
            admin_text={admin_text}
            updateUnsavedConfigs={updateUnsavedConfigs}
          />
        );
      case 'models':
        return stillLoadingData ? loading : (
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
        );
      case 'variables':
        return stillLoadingData ? loading : (
          <div className="admin-configurations-content">
            <div className="admin-config-section">
              <div className="admin-config-header">Application Secrets</div>
              {Object.keys(appSecrets).length > 0 ? (
                <InputsMap
                  id={AdminConfigTypes.APP_SECRETS}
                  inputs={Object.keys(appSecrets).sort((a, b) => b.length - a.length)
                    .map((secret: string) => ({label: secret, key: secret}))}
                  state={appSecrets}
                  inputChanged={(key: string, value: string) => {
                    setAppSecrets({...appSecrets, [key]: value});
                    updateUnsavedConfigs(AdminConfigTypes.APP_SECRETS);
                  }}
                  obscure={true}
                />
              ) : <div>No Application Secrets Retrieved</div>}
            </div>

            <div className="admin-config-section">
              <div className="admin-config-header">Application Environment Variables</div>
              {Object.keys(appVars).length > 0 ? (
                <InputsMap
                  id={AdminConfigTypes.APP_VARS}
                  inputs={Object.keys(appVars)
                    .sort((a, b) => b.length - a.length)
                    .map((variable: string) => ({label: variable, key: variable}))}
                  state={appVars}
                  inputChanged={(key: string, value: string) => {
                    setAppVars({...appVars, [key]: value});
                    updateUnsavedConfigs(AdminConfigTypes.APP_VARS);
                  }}
                  obscure={true}
                />
              ) : <div>No Application Variables Retrieved</div>}
            </div>
          </div>
        );
      case 'endpoints':
        return stillLoadingData ? loading : (
          <OpenAIEndpointsTab
            openAiEndpoints={openAiEndpoints}
            setOpenAiEndpoints={setOpenAiEndpoints}
            updateUnsavedConfigs={updateUnsavedConfigs}
          />
        );
      case 'features':
        return stillLoadingData ? loading : (
          <FeatureFlagsTab
            features={features}
            setFeatures={setFeatures}
            ampGroups={ampGroups}
            allEmails={allEmails}
            admin_text={admin_text}
            updateUnsavedConfigs={updateUnsavedConfigs}
          />
        );
      case 'integrations':
        return stillLoadingData ? loading : (
          integrations ? (
            <IntegrationsTab
              integrations={integrations}
              setIntegrations={setIntegrations}
              integrationSecrets={integrationSecrets}
              setIntegrationSecrets={setIntegrationSecrets}
              updateUnsavedConfigs={updateUnsavedConfigs}
            />
          ) : (
            <div>No integrations available</div>
          )
        );
      case 'embeddings':
        return stillLoadingData ? loading : (
          <EmbeddingsTab
            refresh={refresh}
            refreshingTypes={refreshingTypes}
            setRefreshingTypes={setRefreshingTypes}
          />
        );
      case 'ops':
        return stillLoadingData ? loading : (
          <OpsTab
            ops={ops}
            setOps={setOps}
            admin_text={admin_text}
          />
        );
      case 'data':
        return (
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
        );
      default:
        return <div>Tab content not found</div>;
    }
  };

  if (stillLoadingData && loadData) {
    return (
      <div className="flex justify-center items-center h-full">
        <LoadingIcon />
        <span className="ml-2">Loading Admin Interface...</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <div className="admin-interface-content">
        {/* Tab Navigation */}
        <div className="admin-tab-bar mb-4">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id 
                    ? 'bg-blue-500 text-white shadow-md' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                } ${tab.hasChanges ? 'ring-2 ring-orange-400' : ''}`}
              >
                {tab.label}
                {tab.hasChanges && <span className="ml-1 text-orange-300">*</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="admin-scrollable-content">
          <div className="admin-content-area">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};