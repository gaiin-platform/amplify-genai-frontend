import { IconExternalLink } from '@tabler/icons-react';
import { useContext, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { Model } from '@/types/model';

import HomeContext from '@/pages/api/home/home.context';
import { filterModels } from '@/utils/app/models';
import { getSettings } from '@/utils/app/settings';
interface Props {
  modelId: string | undefined;
  isDisabled?: boolean;
  handleModelChange?: (e: string) => void
  isTitled?: boolean;
  applyModelFilter?:boolean;
  disableMessage?: string;
}


export const ModelSelect: React.FC<Props> = ({modelId, isDisabled=false, handleModelChange, isTitled=true, applyModelFilter = true,
                                              disableMessage = "Model has been predetermined and can not be changed"}) => {
  const { t } = useTranslation('chat');
  const {
    state: { selectedConversation, defaultModelId, featureFlags, availableModels}, 
    handleUpdateConversation,
  } = useContext(HomeContext);

  const [selectModel, setSelectModel] = useState<string | undefined>(modelId ?? defaultModelId);
  const models = applyModelFilter ? filterModels(availableModels, getSettings(featureFlags).hiddenModelIds) : Object.values(availableModels);

  useEffect(()=>{
    setSelectModel(modelId);
    // edge case in component use in Assistant Admin ui
    if (!isDisabled && handleModelChange && !modelId && defaultModelId) {handleModelChange(defaultModelId)}; 
  }
  ,[modelId, isDisabled]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const updatedModel = e.target.value;
    if (handleModelChange) {
      handleModelChange(updatedModel);
    } else {
      selectedConversation &&
      handleUpdateConversation(selectedConversation, {
        key: 'model',
        value: models.find(
          (model: Model) => model.id === updatedModel,
        ),
      });
    }
    setSelectModel(updatedModel);
    
  };
  
  return (
    <div className="flex flex-col">
      <label className="mb-2 text-left text-neutral-700 dark:text-neutral-400">
        {isTitled? t('Model'): ""}
      </label>
      <div className="w-full rounded-lg border border-neutral-200 bg-transparent pr-2 text-neutral-900 dark:border-neutral-600 dark:text-white custom-shadow">
        <select
          disabled={isDisabled}
          className="w-full bg-transparent p-2"
          placeholder={t('Select a model') || ''}
          value={selectModel}
          onChange={handleChange}
          title={isDisabled ? disableMessage : "Select Model"}
        >
          {models.map((model: Model) => (
            <option
              key={model.id}
              value={model.id}
              className="dark:bg-[#343541] dark:text-white"
              title={model.description}
            >
              {model.id === defaultModelId
                ? `Default (${model.name})`
                : model.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};