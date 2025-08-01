import React, { useContext, useState, useRef, useEffect } from 'react';
import { IconPlus, IconHomeBolt, IconWorldBolt, IconTools, IconTool, IconCheck, IconChevronDown, IconLoader2 } from '@tabler/icons-react';
import AgentToolsSelector from '../Agent/AgentToolsSelector';
import { ApiItemSelector } from './ApiSelector';
import APIComponent, { ExternalAPI } from './CustomAPIEditor';
import HomeContext from '@/pages/api/home/home.context';
import { PythonFunctionModal } from '../Operations/PythonFunctionModal';
import { createPortal } from 'react-dom';
import { OpDef } from '@/types/op';

interface ApiIntegrationsPanelProps {
  // API-related props
  availableApis: OpDef[] | null;

  selectedApis?: OpDef[];
  setSelectedApis?: (apis: OpDef[]) => void;
  onClickApiItem?: (api: OpDef) => void;
  
  // External API props
  apiInfo?: ExternalAPI[];
  setApiInfo?: React.Dispatch<React.SetStateAction<ExternalAPI[]>>;
  
  // Agent tools props
  availableAgentTools?: Record<string, any> | null;
  builtInAgentTools?: string[];
  setBuiltInAgentTools?: (tools: string[]) => void;
  onClickAgentTool?: (tool: any) => void;
  
  // python function onsave
  pythonFunctionOnSave?: (fn: { name: string; code: string; schema: string; testJson: string }) => void;
  allowCreatePythonFunction?: boolean;

  hideApisPanel?: string[];
  disabled?: boolean;

  showDetails?: boolean;
  labelPrefix?: string;
  compactDisplay?: boolean;
  height?: string;
  
  // Configuration props
  allowConfiguration?: boolean;
}


const ApiIntegrationsPanel: React.FC<ApiIntegrationsPanelProps> = ({
  availableApis, selectedApis=[], setSelectedApis, apiInfo=[], setApiInfo,
  availableAgentTools, builtInAgentTools=[], setBuiltInAgentTools,
  pythonFunctionOnSave = (fn: { name: string; code: string; schema: string; testJson: string }) => {}, 
  allowCreatePythonFunction = true, onClickApiItem, onClickAgentTool, hideApisPanel=[], disabled=false, 
  labelPrefix="Manage", showDetails, compactDisplay=false, height,
  allowConfiguration = false
}) => {
  const { state: {featureFlags, lightMode} } = useContext(HomeContext);
  const [shownAPIComponent, setShownAPIComponent] = useState<string>(compactDisplay ? "internal": "");
  const [addFunctionOpen, setAddFunctionOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownButtonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  const buttonClassName = (shown: boolean) => 
  `mt-2 mb-4 flex items-center gap-2 rounded border border-neutral-500 px-3 py-2 text-sm text-neutral-800 dark:border-neutral-700 dark:text-neutral-100 whitespace-nowrap ${shown ? "bg-neutral-300 dark:bg-[#40414F]" : "hover:bg-neutral-200 dark:hover:bg-neutral-700"}`;

  // Define integration options
  const integrationOptions = [
    {
      id: "custom",
      label: `${labelPrefix} Custom APIs`,
      loadingLabel: "Loading APIs...",
      icon: <IconTools className='flex-shrink-0' size={18} />,
      isEnabled: featureFlags.pythonFunctionApis && !hideApisPanel?.includes("custom"),
      isDisabled: !availableApis
    },
    {
      id: "internal",
      label: `${labelPrefix} Internal APIs`,
      loadingLabel: "Loading APIs...",
      icon: <IconHomeBolt className='flex-shrink-0' size={18} />,
      isEnabled: featureFlags.integrations && !hideApisPanel?.includes("internal"),
      isDisabled: !availableApis
    },
    // {
    //   id: "external",
    //   label: `${labelPrefix} External APIs`,
    //   loadingLabel: null,
    //   icon: <IconWorldBolt className='flex-shrink-0' size={18} />,
    //   isEnabled: featureFlags.assistantApis && !hideApisPanel?.includes("external"),
    //   isDisabled: false
    // },
    {
      id: "tools",
      label: `${labelPrefix} Agent Tools`,
      loadingLabel: "Loading Agent Tools...",
      icon: <IconTool className='flex-shrink-0' size={18} />,
      isEnabled: featureFlags.agentTools && !hideApisPanel?.includes("tools"),
      isDisabled: !availableAgentTools
    }
  ];

  const handleOptionClick = (optionId: string, allowClose=false) => {
    setShownAPIComponent(!allowClose ? optionId :
      (shownAPIComponent === optionId ? "" : optionId)
    );
    setDropdownOpen(false);
  };

  const getCurrentSelectionDisplayName = () => {
    if (!shownAPIComponent) return <>Select Integration Type</>;
    const option = integrationOptions.find(opt => opt.id === shownAPIComponent);
    return option ? <>{option.icon} {option.label}</> : <>Select Integration Type</>;
  };

  const renderApiComponent = () => {
    const option = integrationOptions.find(opt => opt.id === shownAPIComponent);
    // Check if the option exists and if it's disabled

    if (option && option.isDisabled) {
      return (
        <div className="flex items-center justify-center py-8">
          <IconLoader2 size={24} className="animate-spin text-gray-500 mr-2" />
          <span>{option.loadingLabel ?? "Loading..."}</span>
        </div>
      );
    }
    switch (shownAPIComponent) {
      case "internal":
        if (featureFlags.integrations) return (
          <ApiItemSelector
            availableApis={availableApis}
            selectedApis={selectedApis}
            setSelectedApis={setSelectedApis ?? ((apis: any[]) => {})}
            apiFilter={(apis) => apis.filter((api) => api.type !== "custom")}
            onClickApiItem={onClickApiItem}
            disableSelection={setSelectedApis === undefined || disabled}
            showDetails={showDetails}
            allowConfiguration={allowConfiguration}
          />
        );
      case "external":
        if (featureFlags.assistantApis && setApiInfo) return (
          <APIComponent
            apiInfo={apiInfo}
            setApiInfo={setApiInfo}
            disabled={disabled}
          />
        );
      case "custom":
        if (featureFlags.pythonFunctionApis) return (
          <>
            {allowCreatePythonFunction && featureFlags.createPythonFunctionApis &&
              <div className="relative">
              {!disabled && <button 
                className={`${buttonClassName(false)} absolute -top-6 mt-0 z-10 shadow-xl`}
                onClick={() => setAddFunctionOpen(!addFunctionOpen)}
              >
                <IconPlus size={18} />
                Add Custom APIs
              </button>}
            </div>}
            <ApiItemSelector
              availableApis={availableApis}
              selectedApis={selectedApis}
              setSelectedApis={setSelectedApis ?? ((apis: any[]) => {})}
              apiFilter={(apis) => apis.filter((api) => api.type === "custom")}
              onClickApiItem={onClickApiItem}
              disableSelection={setSelectedApis === undefined || disabled}
              showDetails={showDetails}
              allowConfiguration={allowConfiguration}
            />
            
            {addFunctionOpen && createPortal(
              <div className={lightMode}>
                <PythonFunctionModal
                  onCancel={() => setAddFunctionOpen(false)}
                  onSave={pythonFunctionOnSave}
                />
              </div>,
              document.body
            )}
          </>
        );
      case "tools":
        if (featureFlags.agentTools) return (
          <AgentToolsSelector 
            availableTools={availableAgentTools || {}}
            selectedTools={builtInAgentTools}
            onToolSelectionChange={setBuiltInAgentTools ?? ((tools: string[]) => {})}
            onClickAgentTool={onClickAgentTool}
            disableSelection={setBuiltInAgentTools === undefined || disabled}
            showDetails={showDetails}
          />
        );
    }
    return <></>;
  };

  // Handle dropdown positioning and outside clicks
  useEffect(() => {
    const updatePosition = () => {
      if (dropdownButtonRef.current) {
        const rect = dropdownButtonRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width
        });
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownOpen &&
        dropdownButtonRef.current &&
        !dropdownButtonRef.current.contains(e.target as Node)
      ) {
        // Check if the click was inside the dropdown menu
        const dropdownMenu = document.getElementById('api-dropdown-menu');
        if (!dropdownMenu || !dropdownMenu.contains(e.target as Node)) {
          setDropdownOpen(false);
        }
      }
    };

    if (dropdownOpen) {
      updatePosition();
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [dropdownOpen]);

  // Create portal for dropdown
  const renderDropdown = () => {
    if (!dropdownOpen) return null;

    return createPortal(
      <div 
        id="api-dropdown-menu"
        className="fixed z-[1000] rounded-md bg-white shadow-lg dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
        style={{ 
          top: `${dropdownPosition.top}px`, 
          left: `${dropdownPosition.left}px`,
          width: `${dropdownPosition.width}px`
        }}
      >
        <div className="py-1" role="menu" aria-orientation="vertical">
          {integrationOptions.map(option => 
            option.isEnabled && (
              <button 
                key={option.id}
                className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleOptionClick(option.id);
                }}
                disabled={option.isDisabled}
              >
                {option.icon}
                {option.isDisabled && option.loadingLabel ? option.loadingLabel : option.label}
                {option.id === shownAPIComponent && <IconCheck className="text-green-500 ml-auto" size={18} />}
              </button>
            )
          )}
        </div>
      </div>,
      document.body
    );
  };

  return (
    <div className="text-black dark:text-neutral-100">
      {compactDisplay ? (
        <div className="pb-2 relative">
          <button 
            ref={dropdownButtonRef}
            className={`${buttonClassName(!!shownAPIComponent)} w-full`}
            onClick={(e) => {
              e.stopPropagation();
              setDropdownOpen(!dropdownOpen);
            }}
          >
            {getCurrentSelectionDisplayName()}
            <IconChevronDown className="ml-auto" size={18} />
          </button>
          
          {renderDropdown()}
        </div>
      ) : (
        <div className="flex flex-row gap-4 items-center">
          {integrationOptions.map(option => 
            option.isEnabled && (
              <button 
                key={option.id}
                className={buttonClassName(shownAPIComponent === option.id)}
                onClick={() => handleOptionClick(option.id, true)}
                disabled={option.isDisabled}
              >
                {option.icon}
                {option.isDisabled && option.loadingLabel ? option.loadingLabel : option.label}
              </button>
            )
          )}
        </div>
      )}
      
      <div 
        className={height ? "overflow-y-auto" : ""}
        style={height ? { maxHeight: height } : {}}
      >
        {renderApiComponent()}
      </div>
    </div>
  );
};

export default ApiIntegrationsPanel; 