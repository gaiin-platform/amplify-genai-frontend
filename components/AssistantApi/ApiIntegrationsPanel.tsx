import React, { useContext, useState } from 'react';
import { IconPlus, IconHomeBolt, IconWorldBolt, IconTools, IconTool } from '@tabler/icons-react';
import AgentToolsSelector from '../Agent/AgentToolsSelector';
import { ApiItemSelector } from './ApiSelector';
import APIComponent, { API } from './CustomAPIEditor';
import HomeContext from '@/pages/api/home/home.context';
import { PythonFunctionModal } from '../Operations/PythonFunctionModal';


interface ApiIntegrationsPanelProps {
  // API-related props
  availableApis: any[] | null;

  selectedApis?: any[];
  setSelectedApis?: (apis: any[]) => void;
  onClickApiItem?: (api: any) => void;
  
  // External API props
  apiInfo?: API[];
  setApiInfo?: React.Dispatch<React.SetStateAction<API[]>>;
  
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
}

const buttonClassName = (shown: boolean) => 
  `mt-2 mb-4 flex items-center gap-2 rounded border border-neutral-500 px-3 py-2 text-sm text-neutral-800 dark:border-neutral-700 dark:text-neutral-100 ${shown ? "bg-neutral-300 dark:bg-[#40414F]" : "hover:bg-neutral-200 dark:hover:bg-neutral-700"}`;

const ApiIntegrationsPanel: React.FC<ApiIntegrationsPanelProps> = ({
  availableApis, selectedApis=[], setSelectedApis, apiInfo=[], setApiInfo,
  availableAgentTools, builtInAgentTools=[], setBuiltInAgentTools,
  pythonFunctionOnSave = (fn: { name: string; code: string; schema: string; testJson: string }) => {}, 
  allowCreatePythonFunction = true, onClickApiItem, onClickAgentTool, hideApisPanel=[], disabled=false
}) => {
  const { state: {featureFlags} } = useContext(HomeContext);
  const [shownAPIComponent, setShownAPIComponent] = useState<string>("");
  const [addFunctionOpen, setAddFunctionOpen] = useState(false);

  
  const renderApiComponent = () => {
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
                className={`${buttonClassName(false)} absolute -top-2 mt-0 z-10`}
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
            />
            
            {addFunctionOpen && 
              <PythonFunctionModal
              onCancel={() => setAddFunctionOpen(false)}
              onSave={pythonFunctionOnSave}
            />}
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
          />
        );
    }
    return <></>;
  };

  return (
    <div className="mt-4">
      <div className="flex flex-row gap-4 items-center">
        {featureFlags.pythonFunctionApis && !hideApisPanel?.includes("custom") && (
          <button className={buttonClassName(shownAPIComponent === "custom")}
            onClick={() => setShownAPIComponent(shownAPIComponent === "custom" ? "" : "custom")}
            disabled={!availableApis}
          >
            <IconTools size={18} />
            {!availableApis ?   'Loading APIs...' : 'Manage Custom APIs'}
          </button>
        )}

        {featureFlags.integrations && !hideApisPanel?.includes("internal") && (
          <button className={buttonClassName(shownAPIComponent === "internal")}
            onClick={() => setShownAPIComponent(shownAPIComponent === "internal" ? "" : "internal")}
            disabled={!availableApis}
          >
            <IconHomeBolt size={18} />
            {!availableApis ? "Loading APIs..." : "Manage Internal APIs"}
          </button>
        )}

        {featureFlags.assistantApis && !hideApisPanel?.includes("external") && (
          <button className={buttonClassName(shownAPIComponent === "external")}
            onClick={() => setShownAPIComponent(shownAPIComponent === "external" ? "" : "external")}
          >
            <IconWorldBolt size={18} />
            Manage External APIs
          </button>
        )}

        {featureFlags.agentTools && !hideApisPanel?.includes("tools") && (
          <button className={buttonClassName(shownAPIComponent === "tools")}
            onClick={() => setShownAPIComponent(shownAPIComponent === "tools" ? "" : "tools")}
            disabled={!availableAgentTools}
          >
            <IconTool size={18} />
            {!availableAgentTools ? 'Loading Agent Tools...' : 'Manage Agent Tools'}
          </button>
        )}
      </div>
      
      {renderApiComponent()}
    </div>
  );
};

export default ApiIntegrationsPanel; 