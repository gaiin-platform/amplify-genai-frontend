import { FC, useContext, useEffect, useRef, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { featureOptionFlags, getSettings, saveSettings } from '@/utils/app/settings';

import { Settings, Theme } from '@/types/settings';

import HomeContext from '@/pages/api/home/home.context';
import { ThemeService } from '@/utils/whiteLabel/themeService';
import React from 'react';
import { ConversationsStorage } from './ConversationStorage';
import FlagsMap, { Flag } from '../ReusableComponents/FlagsMap';
import { Modal } from '../ReusableComponents/Modal';
import { saveUserSettings } from '@/services/settingsService';
import { Model } from '@/types/model';
import toast from 'react-hot-toast';
import { ActiveTabs } from '../ReusableComponents/ActiveTabs';
import LegacyWorkspaces from '../Workspace/LegacyWorkspace';
import { capitalize } from '@/utils/app/data';
import { IconCurrencyDollar, IconMoonStars, IconSun } from '@tabler/icons-react';
import ExpansionComponent from '../Chat/ExpansionComponent';
import { IntegrationTabs } from '../Integrations/IntegrationsTab';
import { ApiKeys } from './AccountComponents/ApiKeys';
import { Accounts } from './AccountComponents/Account';
import { Account, noCoaAccount } from '@/types/accounts';
import { getAccounts } from '@/services/accountService';
import { noRateLimit } from '@/types/rateLimit';
import { DataDisclosureViewer } from './DataDisclosureViewer';

  interface Props {
  open: boolean;
  onClose: () => void;
  openToTab?: string;
}

export const modelOptionFlags = [
  {
    "label": "OpenAI",
    "key": "allOpenAI",
    "defaultValue": false,
    "identifiers": ['gpt', 'o1', 'o3']
  },
  {
      "label": "Claude",
      "key": "allClaude",
      "defaultValue": false,
      "identifiers": ['anthropic']
  },
  {
      "label": "Mistral",
      "key": "allMistral",
      "defaultValue": false,
      "identifiers": ['mistral']
  },
  {
    "label": "Amazon",
    "key": "allAmazon",
    "defaultValue": false,
    "identifiers": ['amazon', 'nova']
  },
  {
    "label": "Meta",
    "key": "allMeta",
    "defaultValue": false,
    "identifiers": ['llama', 'meta']
  },
  {"label": "DeepSeek",
    "key": "allDeepSeek",
    "defaultValue": false,
    "identifiers": ['deepseek']
  },
  {"label": "Google",
    "key": "allGemini",
    "defaultValue": false,
    "identifiers": ['gemini']
  },


  ];



type ModelKey = (typeof modelOptionFlags)[number]["key"];


export const SettingDialog: FC<Props> = ({ open, onClose, openToTab }) => {
  const { t } = useTranslation('settings');
  const { dispatch: homeDispatch, state:{statsService, featureFlags, availableModels: allAvailableModels, defaultModelId, workspaces} } = useContext(HomeContext);
  let initSettingsRef = useRef<Settings | null>(null);
  // prevent recalling the getSettings function
  if (initSettingsRef.current === null) initSettingsRef.current = getSettings(featureFlags);

  useEffect(() => {
    initSettingsRef.current = getSettings(featureFlags);
  }, [featureFlags]);

  const [hiddenModelIds, setHiddenModelIds] = useState<string[]>(initSettingsRef.current?.hiddenModelIds.filter((id:string) => id !== defaultModelId));
  const [trackTab, setTrackTab] = useState<number | null>(null);

  const getAvailableModels = () => {
    const models: Model[] = Object.values(allAvailableModels);

    type ModelsMap = {
      [K in ModelKey]: Model[];
    };

    const modelsMap = modelOptionFlags.reduce((acc, flag) => {
      acc[flag.key] = [];
      return acc;
    }, {} as ModelsMap);

    models.forEach((model) => {
      const matchedOption = modelOptionFlags.find(flag => {
            // Check if any pattern matches the model.id
            const identifiers = flag.identifiers;

            return !!identifiers.find((identifier: string) => model.id.includes(identifier));
        }
      );

      if (matchedOption) modelsMap[matchedOption.key].push(model);
    });

      const sortModelFlags = (a: string, b: string) => {
        const bLength = modelsMap[b].length;
        const aLength = modelsMap[a].length;
        if (bLength === aLength) {
          // Find the labels for comparison
          const aFlag = modelOptionFlags.find(flag => flag.key === a);
          const bFlag = modelOptionFlags.find(flag => flag.key === b);
          return (aFlag?.label || '').localeCompare(bFlag?.label || '');
        }
        return bLength - aLength;
      }
      
      // Create a new ordered object with sorted keys
      const orderedSortedModels: Record<ModelKey, any[]> = {};
      Object.keys(modelsMap)
        .sort(sortModelFlags)
        .forEach(key => {
          orderedSortedModels[key as ModelKey] = modelsMap[key as ModelKey];
        });

      Object.entries(orderedSortedModels).forEach(([key, models]) => 
          modelsMap[key] = (models as any).sort((a: any, b: any) => a.name.localeCompare(b.name)),
      );
      
      return orderedSortedModels;
    }


  const initModelOption = () => {
      return modelOptionFlags.reduce((acc:{[key:string]:boolean}, x) => {
        const k = x.key as ModelKey;
        const allModels = availableModels && Object.keys(availableModels).includes(k) ? availableModels[k] : []; 
        acc[x.key] =  allModels.length > 0 && allModels.every((model: any) => !hiddenModelIds.includes(model.id));
        return acc;
      }, {});
  }
  const availableModels: Record<ModelKey, any[]> = getAvailableModels();
  
  const [featureOptions, setFeatureOptions] = useState<{ [key: string]: boolean }>(initSettingsRef.current?.featureOptions);
  const [theme, setTheme] = useState<Theme>(initSettingsRef.current?.theme);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [modelOptions, setModelOptions] = useState<{ [key: string]: boolean }>(initModelOption());

  const featuresChanged = () => {
    return JSON.stringify(featureOptions) !== JSON.stringify(initSettingsRef.current?.featureOptions);
  }
  useEffect(() => {
    if (open) statsService.openSettingsEvent();
  }, [open])

  useEffect(()=> {

    const hasChanges = theme !== initSettingsRef.current?.theme || featuresChanged() ||
                       JSON.stringify(hiddenModelIds) !== JSON.stringify(initSettingsRef.current?.hiddenModelIds);
    setHasUnsavedChanges(hasChanges);

  }, [theme, featureOptions, hiddenModelIds])



  const handleSave = async () => {
    window.dispatchEvent(new Event('settingsSave'));
    if (!hasUnsavedChanges) return;
    if (Object.values(allAvailableModels).every((model: Model) => hiddenModelIds.includes(model.id) || model.id === defaultModelId)) {
        alert("All models are currently set to be hidden. At least one model needs to remain visible, please adjust your selection.");
        return;
    }

    if (theme !== initSettingsRef.current?.theme) {
      statsService.setThemeEvent(theme);
      ThemeService.setTheme(theme); // Persist theme preference
    }
    homeDispatch({ field: 'lightMode', value: theme });

    const updatedSettings: Settings = { theme: theme, 
                                        featureOptions: featureOptions, 
                                        hiddenModelIds: hiddenModelIds.filter((id: string) => id !== defaultModelId)
                                      }
    statsService.saveSettingsEvent(updatedSettings);
    // console.log(updatedSettings);
    saveSettings(updatedSettings);
    onClose();
    // update plugin in selector according to new feature settings
    if (featuresChanged()) window.dispatchEvent(new Event('updateFeatureSettings'));

   const result = await saveUserSettings(updatedSettings);
    if (!result) {
      alert("Settings failed to update in the cloud at the time. However, your changes have been saved and applied locally within this browser. ");
    } else {
      toast("Settings saved successfully");
    }

  };

  useEffect(() => {
    if (availableModels) {
      const updatedModelOptions = {...modelOptions};
      Object.keys(availableModels).forEach((key: ModelKey) => {
        const allVisible =  Object.keys(availableModels).includes(key) && availableModels[key].every((model: any) => !hiddenModelIds.includes(model.id));
        updatedModelOptions[key] = allVisible;
      });
  
      if (JSON.stringify(modelOptions) !== JSON.stringify(updatedModelOptions)) setModelOptions(updatedModelOptions);
    }
    // console.log(hiddenModelIds);
  }, [hiddenModelIds])

  const handleModelOptionChange = (key: ModelKey, isChecked: boolean) => {
    setModelOptions({...modelOptions, [key]: isChecked});
    const optionModels = availableModels[key as ModelKey];
    if (isChecked) {
      const optionModelsIds = optionModels.map((m:any) => m.id);
      setHiddenModelIds(hiddenModelIds.filter((id: string) => !optionModelsIds.includes(id)));
    } else {
      const hiddenModelSet = new Set(hiddenModelIds);
      optionModels.forEach((m: any) => hiddenModelSet.add(m.id));
      setHiddenModelIds(Array.from(hiddenModelSet));
    }
  }

    const modelLabel = (modelId: string, name: string) => {
      const isVisible = !hiddenModelIds.includes(modelId);
      const isDisabled = modelId === defaultModelId;
      return <div key={modelId} className={` text-sm ${isVisible || modelId === defaultModelId ? "text-blue-600":""}`}> 
              <button
                disabled={isDisabled}
                title={isDisabled? "Default model can't be hidden": `${isVisible ? "Hide" : "Show"} model from selection menus`}
                className={`p-1.5 whitespace-nowrap overflow-hidden text-ellipsis rounded-md transition-all duration-200 ${
                  !isDisabled 
                    ? "hover:shadow-md hover:scale-105 hover:font-medium cursor-pointer" 
                    : "opacity-50 cursor-not-allowed"
                }`}
                onClick={()=>{
                  if (isVisible) {
                    setHiddenModelIds([...hiddenModelIds, modelId]);
                  } else {
                    setHiddenModelIds(hiddenModelIds.filter((id: string) => id !== modelId));
                  }
                }}
              >
                {name}
              </button>
      </div>
    }


    const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [defaultAccount, setDefaultAccount] = useState<Account>(noCoaAccount);

    const [accountsUnsavedChanges, setAccountsUnsavedChanges] = useState(false);
    const [apiUnsavedChanges, setApiUnsavedChanges] = useState(false);
   
    const handleClose = () => {
      if ((accountsUnsavedChanges || apiUnsavedChanges || hasUnsavedChanges) && !confirm("You have unsaved changes.\n\nYou will lose any unsaved data, would you still like to close Settings?")) return;
      
      // Reset all state variables to their original values when closing
      if (initSettingsRef.current) {
        setTheme(initSettingsRef.current.theme);
        setFeatureOptions(initSettingsRef.current.featureOptions);
        setHiddenModelIds(initSettingsRef.current.hiddenModelIds.filter((id: string) => id !== defaultModelId));
      }
      
      window.dispatchEvent(new Event('cleanupApiKeys'));
      setAccountsUnsavedChanges(false);
      setApiUnsavedChanges(false);
      setHasUnsavedChanges(false);
      onClose();
      
    }

    useEffect(() => {
        const fetchAccounts = async () => {
            const result = await getAccounts();
            if (!result.success) {
                alert("Unable to fetch accounts. Please try again.");
            } else {
                // Add "No COA" account to the list if not present
                if (!result.data.some((account: any) => account.id === noCoaAccount.id)) {
                    result.data.unshift(noCoaAccount);
                }

                result.data.forEach((account: any) => {
                    if (!account.rateLimit) account.rateLimit =  noRateLimit;
                })
                setAccounts(result.data);

                const updatedDefaultAccount = result.data.find((account: Account) => account.isDefault) || result.data[0];

                if (updatedDefaultAccount) {
                    setDefaultAccount(updatedDefaultAccount);
                }
            }
            setIsLoadingAccounts(false);
        }
        if (open) {
            console.log("fetching accounts");
            setIsLoadingAccounts(true);
            fetchAccounts();
        }
    }, [open]);

    useEffect(() => {
      window.dispatchEvent(new Event('cleanupApiKeys'));
    }, [trackTab]);

    const otherChanges = () => {
    return accountsUnsavedChanges || apiUnsavedChanges;
    }


  // Render nothing if the dialog is not open.
  if (!open) {
    return <></>;
  }


  // Render the dialog.
  return <Modal 
      fullScreen={true}
      title={`Settings`}
      onCancel={() => handleClose()} 
      onSubmit={() => handleSave()
      }
      submitLabel={"Save"}
      disableSubmit={!hasUnsavedChanges && !otherChanges()}
      disableClickOutside={true}
      content={
        <>
        <ActiveTabs
            id="SettingsTabs"
            initialActiveTab={openToTab}
            onTabChange={(tabIndex: number) => setTrackTab(tabIndex)}
            tabs={[
      
              ///////////////////////////////////////////////////////////////////////////////
              // Configurations Tab
                {label: `Configurations${hasUnsavedChanges ? " * " : ""}`, 
                  title: hasUnsavedChanges ? "Contains Unsaved Changes " : "Customize your Amplify experience",
                  content:
                  <>
                      <div className="settings-card">
                        <div className="settings-card-header flex flex-row items-center gap-4">
                          <h3 className="settings-card-title">{t('Theme')}</h3>
                          <p className="settings-card-description">Choose your preferred visual theme</p>
                        </div>
                        <div className="settings-card-content">
                          <div className="settings-theme-options">
                            {["dark", "light"].map((color) => (
                                <label className="settings-theme-option" id={"theme"+color} key={color}>
                                  <input
                                      type="radio"
                                      name="theme"
                                      value={color}
                                      checked={theme === color}
                                      onChange={(event) => setTheme(event.target.value as Theme)}
                                      className="settings-theme-radio"
                                  />
                                  <div className="settings-theme-option-content">
                                    <div className="settings-theme-option-icon">
                                      {color === 'dark' ? <IconMoonStars className='text-blue-700 dark:text-gray-300'/> : <IconSun className='text-amber-500 dark:text-yellow-400'/>}
                                    </div>
                                    <span className="settings-theme-option-label">
                                      {t(`${capitalize(color)} mode`)}
                                    </span>
                                  </div>
                                </label>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                    <div className="settings-card">
                      <div className="settings-card-header flex flex-row items-center gap-4">
                        <h3 className="settings-card-title">{t('Models')}</h3>
                      </div>
      
                      { Object.keys(allAvailableModels).length > 0 && <>
                      
                      <div className='py-2 flex flex-row w-full'>
                            <label className='ml-12 text-[0.75rem]'>Include All</label>
                            <div className='flex-grow'>
                              <div className='flex flex-col text-center mt-[-52px]'> Available Models 
                                  <label className='ml-2 text-xs mb-2 mt-[-4px]'>{"(Displayed models are shown in blue)"}</label>
                              </div>
                            </div> 
                      </div>      
                      <div className='flex flex-row pr-8 ml-4 mb-4'>
                    
                    <div className='w-[130px] pl-2 border-2 border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-gray-800 shadow-sm hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all duration-200 py-2
                                    [&>div>div:not(:last-child)]:mb-[10px] [&>div>div:not(:last-child)]:border-b [&>div>div:not(:last-child)]:border-gray-300 [&>div>div:not(:last-child)]:dark:border-neutral-600'>
                      <FlagsMap 
                        id={'modelOptionFlags'}
                        flags={modelOptionFlags
                              .filter((f: Flag) => availableModels[f.key].length > 0 )
                              .sort((a, b) => {
                                // Get the keys in the order they appear in availableModels
                                const orderedKeys = Object.keys(availableModels);
                                return orderedKeys.indexOf(a.key) - orderedKeys.indexOf(b.key);
                              })}
                        state={modelOptions}
                        flagChanged={(key, value) => {
                          handleModelOptionChange(key as ModelKey, value);
                        }}
                      /> 
                    </div>
      
                          <div className="overflow-x-auto w-full">
                            <table className="table-auto border-separate border-spacing-1 w-full">
                              <tbody>
                                {Object.values(availableModels).map((modelsArray, rowIndex) => (
                                  <tr key={rowIndex}>
                                    {modelsArray.map((m: { id: string; name: string }) => (
                                      <td
                                        key={m.id}
                                        className="border-2 border-gray-300 dark:border-neutral-600 px-2 rounded-md bg-white dark:bg-gray-800 shadow-sm hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all duration-200"
                                      >
                                        {modelLabel(m.id, m.name)}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
      
                    </div>
                    { featureFlags.modelPricing &&
                    <div className='mt-4 ml-3 pb-6'>
                        <ExpansionComponent
                          title={'View Model Pricing'}
                          content={renderModelPricing(availableModels)}
                          closedWidget= { <IconCurrencyDollar className='text-green-500' size={22} />} 
                          isOpened={false}
                        />
                    </div>}
                     </>}
                    </div>
                    
                    <div className="settings-card">
                        <div className="settings-card-header flex flex-row items-center gap-4">
                          <h3 className="settings-card-title">{t('Features')}</h3>
                          <p className="settings-card-description">Enable or disable features</p>
                        </div>

                      <div className='settings-card-content'>
                      <FlagsMap 
                        id={'featureOptionFlags'}
                        flags={featureOptionFlags.filter((f: Flag) => Object.keys(initSettingsRef.current ? initSettingsRef.current.featureOptions: {}).includes(f.key))}
                        state={featureOptions}
                        flagChanged={(key, value) => {
                          setFeatureOptions({...featureOptions, [key]: value});
                        }}
                      />
                      </div>
                    </div>
                    
                  </>
                },
              ///////////////////////////////////////////////////////////////////////////////
              // Accounts Tab
            
                ...(featureFlags.accounts ? [{label: `Accounts${accountsUnsavedChanges ? " *" : ""}`, 
                  title: "Manage your accounts",
                  content:
                  <Accounts
                      accounts={accounts}
                      setAccounts={setAccounts}
                      defaultAccount={defaultAccount}
                      setDefaultAccount={setDefaultAccount}
                      setUnsavedChanged={setAccountsUnsavedChanges}
                      isLoading={isLoadingAccounts}
                  />
                  }] : [] ),
              ///////////////////////////////////////////////////////////////////////////////
              // API Access Tab
              ...(featureFlags.apiKeys ? [{label: `API Access${apiUnsavedChanges ? " *" : ""}`, 
                  title: "Manage your API keys",
                  content:
                  <ApiKeys
                      setUnsavedChanges={setApiUnsavedChanges}
                      onClose={close}
                      accounts={accounts}
                      defaultAccount={defaultAccount}
                      open={open}
                  />
                  }] : []),

              ///////////////////////////////////////////////////////////////////////////////
              // Integrations Tab
              ...(featureFlags.integrations ? [{label: `Integrations`, 
                title: "Manage your integration connections",
                content: <IntegrationTabs open={open} depth={1}/>
              }] : []),

              ///////////////////////////////////////////////////////////////////////////////
              // Conversation Storage
        
                {label: `Conversation Storage`, 
                  title: "Enable conversations to sync across devices or keep them private",
                  content: <>
                    {featureFlags.storeCloudConversations && 
                          <ConversationsStorage open={open} />
                        }
                  </>
                  
                },
                 ///////////////////////////////////////////////////////////////////////////////
                // Review Data Disclosure
          
                {label: `Review Data Disclosure`, 
                  title: "Review the Amplify data disclosure",
                  content: <>
                    {featureFlags.dataDisclosure  && 
                          <DataDisclosureViewer open={open} />
                        }
                  </>
                  
                },

              ///////////////////////////////////////////////////////////////////////////////
              // Legacy Workspaces
              ...(workspaces && workspaces.length > 0 ? 
                [{ label: `Legacy Workspaces`, 
                    title: hasUnsavedChanges ? " Contains Unsaved Changes  " : "",
                    content: <LegacyWorkspaces/>
                }] : []),


                ]}
      />
      </>
      }
    />
                
};



const renderModelPricing = (availableModels: Record<ModelKey, any[]>) => {
    return <div className="settings-card">
        <div className="settings-card-header flex flex-row items-center gap-4">
          <p className="settings-card-description">View pricing information for all available models (per million tokens)</p>
        </div>
        <div className="settings-card-content">
        <table className="sleek-table mt-1 mb-3 table-auto border-collapse w-full">
          <thead>
            <tr>
              {["Model", "Input Tokens", "Output Tokens", "Cached Tokens"].map((title, index) => (
                <th
                  key={index}
                  className="text-center py-0.5 border border-gray-500 text-black dark:text-white bg-neutral-400 dark:bg-neutral-800"
                  style={{ width: index === 0 ? '200px' : 'auto'}}
                >
                  {title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modelOptionFlags
              .filter((f: Flag) => availableModels[f.key].length > 0)
              .map((f: Flag, i: number) => (
                <React.Fragment key={f.key}>
                  {/* Section label */}
                  <tr>
                    <td colSpan={4} className="text-center font-bold py-2">
                      {f.label}
                    </td>
                  </tr>
                  {/* Models in the section */}
                  {availableModels[f.key].map((model: Model) => (
                    <tr key={model.id}>
                      <td
                        className="border border-neutral-500 py-2text-start"
                        style={{ width: '260px' }}
                      >
                        <label className="px-2">{model.name}</label>
                      </td>
                      {["inputTokenCost", "outputTokenCost", "cachedTokenCost"].map((s: string, idx: number) => (
                        <td
                          key={idx}
                          className="border border-neutral-500 py-2"
                          title={model.name}
                          style={{ width: 'auto' }}
                        >
                          <div className="text-center">
                            {model[s as keyof Model] !== 0 ? (
                              `$${((model[s as keyof Model] as number) * 1000)
                                .toFixed(2)
                                .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`
                            ) : (
                              <label className="opacity-60">N/A</label>
                            )}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
          </tbody>
        </table>
        </div>
      </div>
}



