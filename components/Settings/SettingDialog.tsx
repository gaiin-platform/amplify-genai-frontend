import { FC, useContext, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { featureOptionFlags, getSettings, saveSettings } from '@/utils/app/settings';

import { Settings, Theme } from '@/types/settings';

import HomeContext from '@/pages/api/home/home.context';
import React from 'react';
import { StorageDialog } from './StorageDialog';
import FlagsMap, { Flag } from '../ReusableComponents/FlagsMap';
import { Modal } from '../ReusableComponents/Modal';
import { saveUserSettings } from '@/services/settingsService';
import { Model } from '@/types/model';
import toast from 'react-hot-toast';

  interface Props {
  open: boolean;
  onClose: () => void;
}

export const modelOptionFlags = [
  {
    "label": "OpenAI",
    "key": "allOpenAI",
    "defaultValue": false
  },
  {
      "label": "Claude",
      "key": "allClaude",
      "defaultValue": false
  },
  {
      "label": "Mistral",
      "key": "allMistral",
      "defaultValue": false
  },
  ];
  
type ModelKey = (typeof modelOptionFlags)[number]["key"];

export const SettingDialog: FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation('settings');
  const { dispatch: homeDispatch, state:{statsService, featureFlags, availableModels: allAvailableModels} } = useContext(HomeContext);
  const initSettings: Settings = getSettings(featureFlags);
  const [hiddenModelIds, setHiddenModelIds] = useState<string[]>(initSettings.hiddenModelIds);

  const getAvailableModels = () => {
    const models: Model[] = Object.values(allAvailableModels);
    const sortedModels = models.reduce((accumulator: { anthropic: any[], mistral: any[], gpt: any[] }, model: Model) => {
          if (model.id.includes('anthropic')) {
              accumulator.anthropic.push({ id: model.id, name: model.name });
          } else if (model.id.includes('mistral')) {
              accumulator.mistral.push({ id: model.id, name: model.name });
          } else if (model.id.includes('gpt')) {
              accumulator.gpt.push({ id: model.id, name: model.name });
          }
          return accumulator;
      }, { anthropic: [], mistral: [], gpt: [] });

      sortedModels.anthropic.sort((a:any, b:any) => b.name.length - a.name.length);
      sortedModels.mistral.sort((a:any, b:any) => b.name.length - a.name.length);
      sortedModels.gpt.sort((a:any, b:any) => b.name.length - a.name.length);

      return {allOpenAI : sortedModels.gpt, 
              allClaude : sortedModels.anthropic, 
              allMistral : sortedModels.mistral
      } as Record<ModelKey, any[]>;
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
  
  const [featureOptions, setFeatureOptions] = useState<{ [key: string]: boolean }>(initSettings.featureOptions);
  const [theme, setTheme] = useState<Theme>(initSettings.theme);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [modelOptions, setModelOptions] = useState<{ [key: string]: boolean }>(initModelOption());

  useEffect(() => {
    if (open) statsService.openSettingsEvent();
  }, [open])

  useEffect(()=> {

    const hasChanges = theme !== initSettings.theme || 
                       JSON.stringify(featureOptions) !== JSON.stringify(initSettings.featureOptions) ||
                       JSON.stringify(hiddenModelIds) !== JSON.stringify(initSettings.hiddenModelIds);
    setHasUnsavedChanges(hasChanges);

  }, [theme, featureOptions, hiddenModelIds])




  const handleSave = async () => {
    if (theme !== initSettings.theme) statsService.setThemeEvent(theme);
    homeDispatch({ field: 'lightMode', value: theme });

    const updatedSettings: Settings = { theme: theme, 
                                        featureOptions: featureOptions, 
                                        hiddenModelIds: hiddenModelIds
                                      }
    statsService.saveSettingsEvent(updatedSettings);
    console.log(updatedSettings);
    saveSettings(updatedSettings);
    onClose();

   const result = await saveUserSettings(updatedSettings);
    if (!result) {
      alert("Settings failed to update in the cloud at the time. However, your changes have been saved and applied locally within this browser. ");
    } else {
      toast("Settings saved succsessully");
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
    console.log(hiddenModelIds);
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
  return <div key={modelId} className={` text-sm ${isVisible ? "text-blue-600":""}`}> 
          <button
            title={`${isVisible ? "Hide" : "Show"} model from selection menus`}
            className="p-1 hover:opacity-70"
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

  // Render nothing if the dialog is not open.
  if (!open) {
    return <></>;
  }

  // Render the dialog.
  return <Modal 
      width={() => window.innerWidth * 0.62}
      height={() => window.innerHeight * 0.88}
      title={`Settings${hasUnsavedChanges ? " * " : ""}`}
      onCancel={() => onClose()} 
      onSubmit={() => handleSave()
      }
      submitLabel={"Save"}
      content={
        <>
            <div className="flex flex-row text-lg font-bold mb-2 text-black dark:text-neutral-200">
              {t('Theme')}
            </div>

            <div className="flex flex-row gap-6">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="theme"
                  value="dark"
                  checked={theme === 'dark'}
                  onChange={(event) => {
                    setTheme(event.target.value as Theme);
                  }}
                  className="form-radio cursor-pointer"
                />
                <span className="ml-2 text-neutral-700 dark:text-neutral-200">{t('Dark mode')}</span>
              </label>
                    
              <label className="flex items-center">
                <input
                  type="radio"
                  name="theme"
                  value="light"
                  checked={theme === 'light'}
                  onChange={(event) => {
                    setTheme(event.target.value as Theme);
                  }}
                  className="form-radio cursor-pointer"
                />
                <span className="ml-2 text-neutral-700 dark:text-neutral-200">{t('Light mode')}</span>
              </label>
            </div>

            {featureFlags.storeCloudConversations && 
              <StorageDialog open={open} />
            }
            { Object.keys(allAvailableModels).length > 0 && <>
            <div className="mt-2 text-lg font-bold text-black dark:text-neutral-200">
              {t('Models')}
            </div>
            
            <div className='flex flex-row w-full'>
                  <label className='ml-5 mt-[12px] text-[0.75rem]'>Include All</label>
                  <div className='flex-grow'>
                    <div className='flex flex-col text-center mt-[-4px]'> Available Models 
                        <label className='ml-2 text-xs mb-2 mt-[-4px]'>{"(Displayed models are shown in blue)"}</label>
                    </div>
                  </div> 
            </div>      
            <div className='flex flex-row pr-8'>
              <div className='w-[96px] border border-gray-300 mr-[-1px] mt-[-2px] dark:border-neutral-700 px-2'>
              <div className='mt-1'>
                <FlagsMap 
                  id={'modelOptionFlags'}
                  flags={modelOptionFlags.filter((f: Flag) => availableModels[f.key].length > 0 )}
                  state={modelOptions}
                  flagChanged={(key, value) => {
                    handleModelOptionChange(key as ModelKey, value);
                  }}
                /> 
                </div> 
              </div>
              <table className="mt-[-2px] flex-grow mr-4 overflow-x-auto table-auto border-collapse border border-gray-300 dark:border-neutral-700">
                <tbody>

                  {Object.values(availableModels).map((modelsArray, rowIndex) => (
                    modelsArray.length > 0 && (
                      <tr key={rowIndex}>
                        {modelsArray.map((m: { id: string; name: string }) => (
                          <td key={m.id} className="px-4 border border-gray-300 dark:border-neutral-700">
                            {modelLabel(m.id, m.name)}
                          </td>
                        ))}
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>
                  
            </>}
            <div className="mt-4 text-lg font-bold text-black dark:text-neutral-200">
              {t('Features')}
            </div>
            <div className='pr-4'>
            <FlagsMap 
              id={'featureOptionFlags'}
              flags={featureOptionFlags}
              state={featureOptions}
              flagChanged={(key, value) => {
                setFeatureOptions({...featureOptions, [key]: value});
              }}
            />
            </div>
          
        </>
      }
    />
                
};



