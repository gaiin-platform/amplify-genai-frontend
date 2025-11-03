import { IconBaselineDensityLarge, IconBaselineDensityMedium, IconBaselineDensitySmall, IconCamera, IconCameraOff, IconCurrencyDollar, IconInfoCircle } from '@tabler/icons-react';
import { useContext, useEffect, useState, useRef } from 'react';

import { useTranslation } from 'next-i18next';

import { Model } from '@/types/model';

import HomeContext from '@/pages/api/home/home.context';
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
  showPricingBreakdown?: boolean;
}

export const ModelSelect: React.FC<Props> = ({
  modelId,
  isDisabled = false,
  handleModelChange,
  isTitled = true,
  applyModelFilter = true,
  disableMessage = 'Model has been predetermined and cannot be changed',
  models: presetModels, defaultModelId: backupDefaultModelId,
  outlineColor, showPricingBreakdown = true
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
  const [dropdownPosition, setDropdownPosition] = useState<{top: number, left: number, width: number} | null>(null);

  const selectRef = useRef<HTMLDivElement>(null);

  const models = presetModels ? presetModels : 
             applyModelFilter ? filterModels(availableModels, getSettings(featureFlags).hiddenModelIds)
                              : Object.values(availableModels);


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
        setDropdownPosition(null);
      }
    };
    
    const handleResize = () => {
      if (isOpen) {
        const position = calculateDropdownPosition();
        setDropdownPosition(position);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleResize);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  // Calculate dropdown position to avoid clipping
  const calculateDropdownPosition = () => {
    if (!selectRef.current) return null;
    
    const rect = selectRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const dropdownMaxHeight = viewportHeight * 0.55;
    
    // Calculate available space below and above
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    let top = rect.bottom;
    
    // If not enough space below, show above if there's more space there
    if (spaceBelow < dropdownMaxHeight && spaceAbove > spaceBelow) {
      top = rect.top - Math.min(dropdownMaxHeight, spaceAbove);
    }
    
    return {
      top: Math.max(0, top),
      left: rect.left,
      width: rect.width
    };
  };

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
    setDropdownPosition(null);
  };

  const selectedModel:Model | undefined = models.find((model) => model.id === selectModel);

  const defaultModelLabel =  (name: string) => {
    return <>
      <span>{name}</span>
      <span className="text-blue-500 ml-2 text-xs">{"(Default)"}</span>
    </>
  }
  
const getIcons = (model: Model) => {
  return <div className="ml-auto flex flex-row gap-1 opacity-70">
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
          <div id="legendHover" className='ml-auto relative' onMouseEnter={() => setShowLegend(true) } onMouseLeave={() => setShowLegend(false)}>
            <IconInfoCircle size={19} className='mr-1 mt-[-4px] flex-shrink-0 text-gray-600 dark:text-gray-300' />
            {showLegend && legend(showPricingBreakdown, featureFlags)}
            {showLegend && legend(showPricingBreakdown, featureFlags)}
          </div>
        </div>
      )}
      <div ref={selectRef} className="relative w-full">
        <button
          disabled={isDisabled}
          onClick={() => {
            if (!isOpen) {
              const position = calculateDropdownPosition();
              setDropdownPosition(position);
            } else {
              setDropdownPosition(null);
            }
            setIsOpen(!isOpen);
          }}
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
        {isOpen && dropdownPosition && (
          <ul id="modelList" className="fixed mt-1 overflow-auto rounded-lg border border-neutral-200 bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:border-neutral-600 dark:bg-[#343541] sm:text-sm"
              style={{
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: dropdownPosition.width,
                maxHeight: window.innerHeight * 0.55,
                zIndex: 9999
              }}>
            {models.sort((a, b) => a.name.localeCompare(b.name))
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
                {getIcons(model)}
              </li>
            ))}
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

const Legend = ({ showPricingBreakdown, featureFlags }: { showPricingBreakdown: boolean, featureFlags: any }) => {
  const legendRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState({ top: 0, left: 0, shouldFlipUp: false });
  const [isPositioned, setIsPositioned] = React.useState(false);

  React.useEffect(() => {
    const calculatePosition = () => {
      if (legendRef.current) {
        const triggerElement = legendRef.current.parentElement;
        if (triggerElement) {
          const triggerRect = triggerElement.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const viewportWidth = window.innerWidth;
          
          // Calculate legend dimensions (approximate if not rendered yet)
          const legendHeight = legendRef.current.offsetHeight || 350;
          const legendWidth = 260;
          
          // Calculate space available
          const spaceBelow = viewportHeight - triggerRect.bottom;
          const spaceAbove = triggerRect.top;
          const bufferSpace = 20;
          
          // Determine if should flip up
          const shouldFlipUp = (spaceBelow < legendHeight + bufferSpace) && (spaceAbove > legendHeight + bufferSpace);
          
          // Calculate horizontal position (similar to translateX(-85%))
          let left = triggerRect.left - (legendWidth * 0.85);
          
          // Ensure legend doesn't go off-screen horizontally
          if (left < 10) left = 10;
          if (left + legendWidth > viewportWidth - 10) left = viewportWidth - legendWidth - 10;
          
          // Calculate vertical position
          let top;
          if (shouldFlipUp) {
            top = triggerRect.top - legendHeight - 2;
          } else {
            top = triggerRect.bottom - 2;
          }
          
          // Ensure legend doesn't go off-screen vertically
          if (top < 10) top = 10;
          if (top + legendHeight > viewportHeight - 10) top = viewportHeight - legendHeight - 10;
          
          setPosition({ top, left, shouldFlipUp });
          setIsPositioned(true);
        }
      }
    };

    // Multiple attempts to ensure proper positioning
    const timeouts: NodeJS.Timeout[] = [];
    timeouts.push(setTimeout(calculatePosition, 0));
    timeouts.push(setTimeout(calculatePosition, 10));
    timeouts.push(setTimeout(calculatePosition, 50));
    
    window.addEventListener('resize', calculatePosition);
    window.addEventListener('scroll', calculatePosition);
    
    return () => {
      timeouts.forEach(clearTimeout);
      window.removeEventListener('resize', calculatePosition);
      window.removeEventListener('scroll', calculatePosition);
    };
  }, []);

  return (
    <div 
      ref={legendRef}
      className='text-black dark:text-white fixed w-[260px] rounded-lg border border-neutral-200 bg-white p-4 text-sm shadow-lg z-[9999] dark:border-neutral-600 dark:bg-[#343541] max-h-[min(350px,calc(100vh-100px))] overflow-y-auto'
      style={{
        top: position.top,
        left: position.left,
        opacity: isPositioned ? 1 : 0,
        transition: 'opacity 0.1s ease-in-out',
      }}>
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
      {showPricingBreakdown && featureFlags.modelPricing && 
      <div className='mt-2 text-sm text-gray-500 dark:text-gray-400'>
       View the full pricing breakdown: Click on the gear icon on the left sidebar, go to <strong>Settings</strong>, and scroll down to  
       <strong className='text-blue-500 dark:text-blue-400 cursor-pointer hover:underline'
       onClick={() => {window.dispatchEvent(new CustomEvent('openSettingsTrigger', {detail: {openToTab: "Configurations"}}));
                     }}>{" View Model Pricing"}
       </strong> tab.
      </div>}
    </div>
  );
};

const legend = (showPricingBreakdown: boolean, featureFlags: any) => {
  return <Legend showPricingBreakdown={showPricingBreakdown} featureFlags={featureFlags} />;
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