import { IconBaselineDensityLarge, IconBaselineDensityMedium, IconBaselineDensitySmall, IconCamera, IconCameraOff, IconCurrencyDollar, IconInfoCircle } from '@tabler/icons-react';
import { useContext, useEffect, useState, useRef } from 'react';

import { useTranslation } from 'next-i18next';

import { Model } from '@/types/model';

import HomeContext from '@/components/Home/Home.context';
import { filterModels } from '@/utils/app/models';
import { getSettings } from '@/utils/app/settings';
import React from 'react';
import { Conversation } from '@/types/chat';

interface Props {
  modelId: string | undefined;
  isDisabled?: boolean;
  handleModelChange?: (e: string) => void;
  isTitled?: boolean;
  applyModelFilter?: boolean;
  disableMessage?: string;
  models?: Model[];
  defaultModelId?: string;
  outlineColor?: string;
}

export const ModelSelect: React.FC<Props> = ({
  modelId,
  isDisabled = false,
  handleModelChange,
  isTitled = true,
  applyModelFilter = true,
  disableMessage = 'Model has been predetermined and cannot be changed',
  models: presetModels, defaultModelId: backupDefaultModelId,
  outlineColor
}) => {
  const { t } = useTranslation('chat');

  const contextValue = useContext(HomeContext);

  const handleUpdateConversation = contextValue?.handleUpdateConversation || (() => {});
  
  // Default values when context is missing
  const [selectedConversation, setSelectedConversation] = useState<Conversation | undefined>(contextValue?.state?.selectedConversation);
  useEffect(() => {
    setSelectedConversation(contextValue?.state?.selectedConversation);
  }, [contextValue?.state?.selectedConversation]);

  const [featureFlags, setFeatureFlags] = useState(contextValue?.state?.featureFlags || {});
  useEffect(() => {
    setFeatureFlags(contextValue?.state?.featureFlags || {});
  }, [contextValue?.state?.featureFlags]);


  const [availableModels, setAvailableModels] = useState(contextValue?.state?.availableModels || {});
  useEffect(() => {
    setAvailableModels(contextValue?.state?.availableModels || {});
  }, [contextValue?.state?.availableModels]);

  // Use state to track defaultModelId
  const [defaultModelId, setDefaultModelId] = useState<string | undefined>(
    contextValue?.state?.defaultModelId || backupDefaultModelId
  );

  // Update state when context changes
  useEffect(() => {
    setDefaultModelId(contextValue?.state?.defaultModelId || backupDefaultModelId);
  }, [contextValue?.state?.defaultModelId, backupDefaultModelId]);

  
  const [selectModel, setSelectModel] = useState<string | undefined>(modelId ?? defaultModelId);
  const [isOpen, setIsOpen] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  const selectRef = useRef<HTMLDivElement>(null);

  const models = presetModels ? presetModels : 
             applyModelFilter ? filterModels(availableModels, getSettings(featureFlags).hiddenModelIds)
                              : (Object.values(availableModels) as Model[]);


  useEffect(() => {
    setSelectModel(modelId);
    // Edge case in component use in Assistant Admin UI
    if (!isDisabled && handleModelChange && !modelId && defaultModelId) {
      handleModelChange(defaultModelId);
    }
  }, [modelId, isDisabled]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleOptionClick = (modelId: string) => {
    if (handleModelChange) {
      handleModelChange(modelId);
    } else {
      selectedConversation &&
        handleUpdateConversation(selectedConversation, {
          key: 'model',
          value: models.find((model: Model) => model.id === modelId),
        });
    }
    setSelectModel(modelId);
    setIsOpen(false);
  };

  const selectedModel:Model | undefined = models.find((model) => model.id === selectModel);

  const defaultModelLabel =  (name: string) => {
    return <>
      <span>{name}</span>
      <span className="text-blue-500 ml-2 text-xs">{"(Default)"}</span>
    </>
  }
  
const getProviderBadge = (provider: string) => {
  const providerColors: { [key: string]: string } = {
    'bedrock': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    'openai': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    'gemini': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'azure': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
  };
  
  const color = providerColors[provider.toLowerCase()] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color} mr-2`}>
      {provider.toUpperCase()}
    </span>
  );
};

const getIcons = (model: Model) => {
  return <div className="ml-auto flex flex-row gap-1 opacity-70">
          {getProviderBadge(model.provider)}
          <div title={model.supportsImages ? "Supports Images in Prompts": "Does Not Support Images in Prompts"}>
           {model.supportsImages ? <IconCamera size={18}/> : <IconCameraOff size={18}/>}
         </div>
          {getCostIcon(model.inputTokenCost, model.outputTokenCost)}
          {getOutputLimitIcon(model.outputTokenLimit)}
        </div>
}

  return (
    <div className="flex flex-col">
      {isTitled && (
        <div className='flex flex-row'>
          <label className="mb-2 text-left text-neutral-700 dark:text-neutral-400">
            {t('Model')}
          </label>
          <div id="legendHover" className='ml-auto' onMouseEnter={() => setShowLegend(true) } onMouseLeave={() => setShowLegend(false)}>
            <IconInfoCircle size={19} className='mr-1 mt-[-4px] flex-shrink-0 text-gray-600 dark:text-gray-300' />
            {showLegend && legend()}
          </div>
        </div>
      )}
      <div ref={selectRef} className="relative w-full">
        <button
          disabled={isDisabled}
          onClick={() => setIsOpen(!isOpen)}
          title={isDisabled ? disableMessage : 'Select Model'}
          id="modelSelect"
          className={`w-full flex items-center justify-between rounded-lg bg-transparent p-2 pr-2 text-neutral-900 dark:border-neutral-600 dark:text-white custom-shadow ${
            isDisabled ? 'opacity-50 cursor-not-allowed' : ''} ${outlineColor ? `border-2 border-${outlineColor}` : ' border border-neutral-200'}`}
        >
          { selectedModel ? 
          <>
          <span className="flex items-center">
            {selectedModel?.id === defaultModelId
              ? defaultModelLabel(selectedModel?.name)
              : selectedModel?.name}
          </span>
          {getIcons(selectedModel)}
          </> :
            t('Select a model')
          }
          
        </button>
        {isOpen && (
          <ul id="modelList" className="absolute z-10 mt-1 w-full overflow-auto rounded-lg border border-neutral-200 bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:border-neutral-600 dark:bg-[#343541] sm:text-sm"
              style={{maxHeight: window.innerHeight * 0.55}}>
            {(() => {
              // Group models by provider
              const groupedModels = models.reduce((acc: { [key: string]: Model[] }, model: Model) => {
                const provider = model.provider || 'Other';
                if (!acc[provider]) acc[provider] = [];
                acc[provider].push(model);
                return acc;
              }, {});
              
              // Sort providers
              const sortedProviders = Object.keys(groupedModels).sort();
              
              return sortedProviders.map((provider, providerIndex) => (
                <React.Fragment key={provider}>
                  {providerIndex > 0 && (
                    <div className="my-1 border-t border-neutral-200 dark:border-neutral-600" />
                  )}
                  <div className="px-4 py-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                    {provider.toUpperCase()}
                  </div>
                  {groupedModels[provider]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((model: Model) => (
                      <li
                        key={model.id}
                        id={model.id}
                        onClick={() => handleOptionClick(model.id)}
                        className="flex cursor-pointer items-center justify-between px-4 py-2 text-neutral-900 hover:bg-neutral-100 dark:text-white dark:hover:bg-neutral-600"
                        title={model.description}
                      >
                        <span>
                          {model.id === defaultModelId ? defaultModelLabel(model.name) : model.name}
                        </span>
                        <div className="ml-auto flex flex-row gap-1 opacity-70">
                          <div title={model.supportsImages ? "Supports Images in Prompts": "Does Not Support Images in Prompts"}>
                            {model.supportsImages ? <IconCamera size={18}/> : <IconCameraOff size={18}/>}
                          </div>
                          {getCostIcon(model.inputTokenCost, model.outputTokenCost)}
                          {getOutputLimitIcon(model.outputTokenLimit)}
                        </div>
                      </li>
                    ))}
                </React.Fragment>
              ));
            })()}
          </ul>
        )}
      </div>
    </div>
  );
};

const legendItem = (icon: JSX.Element, message: string) => {
  return (
    <div className='flex items-center mb-2'>
      <div className='mr-2 flex shrink-0'>{icon}</div>
      <span>{message}</span>
    </div>
  );
};

const legend = () => {
  return (
    <div className='text-black dark:text-white absolute mt-1 w-[260px] rounded-lg border border-neutral-200 bg-white p-4 text-sm shadow-lg z-20 dark:border-neutral-600 dark:bg-[#343541]'
         style={{transform: 'translateX(-85%)'}}>
      <div id="modelLegend" className='mb-2 font-semibold text-neutral-700 dark:text-neutral-300'>
        Legend
      </div>
      {legendItem(<IconCamera size={16} />, "Supports Images in Prompts")}
      {legendItem( <IconCameraOff size={16} />, "No Image Support in Prompts")}
      {legendItem( <IconCurrencyDollar size={16} className='text-green-500' />, 'Inexpensive' )}
      {legendItem( <IconCurrencyDollar size={16} className='text-yellow-500' />, 'Moderate Cost' )}
      {legendItem( <IconCurrencyDollar size={16} className='text-red-500' />, 'Expensive' )}
      {legendItem( <IconBaselineDensitySmall size={16} />, 'Large Output Token Limit : ≥ 100,000 tokens')}
      {legendItem( <IconBaselineDensityMedium size={16} />, 'Average Output Token Limit : 4,096 - 100,000 tokens' )}
      {legendItem(<IconBaselineDensityLarge size={16} />, 'Less than Average Output Token Limit : < 4,096 tokens' )}
      <div className='mt-2 text-sm text-gray-500 dark:text-gray-400'>
       View the full pricing breakdown: Click on the gear icon on the left sidebar, go to <strong>Settings</strong>, and click on the 
       <strong className='text-blue-500 dark:text-blue-400 cursor-pointer hover:underline'
       onClick={() => window.dispatchEvent(new CustomEvent('homeChatBarTabSwitch', 
                     { detail: { tab: "Settings" , side: "left", action: () => {
                      window.dispatchEvent(new CustomEvent('openSettingsTrigger', {detail: {openToTab: "Model Pricing"}}));
                     }} } ))}>{" Model Pricing"}
       </strong> tab.
      </div>
    </div>
  );
};


const getCostIcon = (inputCost: number, outputCost: number) => {
    // Threshold logic for input cost
    function categorizeInputCost(cost: number): "cheap" | "moderate" | "expensive" {
      if (cost < 0.001) return "cheap";
      if (cost <= 0.01) return "moderate";
      return "expensive";
    }

    // Threshold logic for output cost
    function categorizeOutputCost(cost: number): "cheap" | "moderate" | "expensive" {
      if (cost < 0.005) return "cheap";
      if (cost <= 0.02) return "moderate";
      return "expensive";
    }

    const inputCategory = categorizeInputCost(inputCost);
    const outputCategory = categorizeOutputCost(outputCost);

    // Combine categories so that the 'highest' level dominates.
    let finalCategory: "cheap" | "moderate" | "expensive" = "cheap";
    if (inputCategory === "expensive" || outputCategory === "expensive") {
      finalCategory = "expensive";
    } else if (inputCategory === "moderate" || outputCategory === "moderate") {
      finalCategory = "moderate";
    }

    let title = "";
    let colorClass = "";

    switch (finalCategory) {
      case "cheap":
        title = "Inexpensive";
        colorClass = "text-green-500";
        break;
      case "moderate":
        title = "Moderate Cost";
        colorClass = "text-yellow-500";
        break;
      case "expensive":
        title = "Expensive";
        colorClass = "text-red-500";
        break;
    }
    return (
      <div title={title} className={colorClass}>
        <IconCurrencyDollar size={20} />
      </div>
    );
}



export const getOutputLimitIcon = (limit: number) => {
  let title = "";
  let icon: JSX.Element = <></>;
  if (limit >= 100000) {
    title = 'Large';
    icon = <IconBaselineDensitySmall size={16} />
  } else if (limit < 4096) {
    title = 'Less than average';
    icon = <IconBaselineDensityLarge size={16} />;
  } else {
    title = 'Average';
    icon =  <IconBaselineDensityMedium size={16} />
  }

  return <div className='mt-0.5' title={`${title} output token limit: ${limit}`}> {icon} </div> 
};