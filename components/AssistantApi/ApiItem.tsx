import React, { useState } from 'react';
import { Checkbox } from '@/components/ReusableComponents/CheckBox';
import { TagsList } from '../Chat/TagsList';
import { camelCaseToTitle } from '@/utils/app/data';
import { getOperationIcon } from '@/utils/app/integrations';
import { IconAdjustments, IconX } from '@tabler/icons-react';
import { OpBindings, OpBindingMode, OpDef } from '@/types/op';
import ActionButton from '../ReusableComponents/ActionButton';
import ApiParameterBindingEditor from './ApiParameterBindingEditor';


interface ApiItemProps {
  api: OpDef;
  index: number;
  onChange?: (id: string, checked: boolean, bindings?: OpBindings) => void;
  selected: boolean;
  onClick?: (api: any) => void;
  showDetails?: boolean;
  allowConfiguration?: boolean;
}

const filterTags = (tags: string[]) => {
  return tags.filter((t:string) => !['default', 'all'].includes(t));
}

const getIcon = (name: string | undefined) => {
  const IconComponent = getOperationIcon(name);
  return <IconComponent size={18} />
}

const ApiItem: React.FC<ApiItemProps> = ({ 
  api, 
  index, 
  selected, 
  onChange, 
  onClick, 
  showDetails = true,
  allowConfiguration = false
}) => {
  const [isConfigExpanded, setIsConfigExpanded] = useState(false);
  const [paramModes, setParamModes] = useState<Record<string, OpBindingMode>>({});
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  const handleParamModeChange = (param: string, mode: OpBindingMode) => {
    const newParamModes = { ...paramModes, [param]: mode };
    setParamModes(newParamModes);
    const updatedBindings = updateApiWithBindings(newParamModes, paramValues);
    
    // Notify parent of the change if selected
    if (selected && onChange) onChange(api.id, true, updatedBindings);
  };

  const handleParamValueChange = (param: string, value: string) => {
    const newParamValues = { ...paramValues, [param]: value };
    setParamValues(newParamValues);
    const updatedBindings = updateApiWithBindings(paramModes, newParamValues);
    
    // Notify parent of the change if selected
    if (selected && onChange) onChange(api.id, true, updatedBindings);
  };

  const updateApiWithBindings = (modes: Record<string, OpBindingMode>, values: Record<string, string>): OpBindings => {
    const paramSource = api.parameters;
    if (!paramSource?.properties) return {};

    const bindings: OpBindings = {};
    Object.keys(paramSource.properties).forEach((paramName) => {
      const mode = modes[paramName] || 'ai';
      const value = values[paramName] || '';
      if (value || mode === 'manual') {
        bindings[paramName] = { value, mode };
      }
    });

    // Update the api object with bindings
    api.bindings = bindings;
    return bindings;
  };

  const hasConfiguration = () => {
    const paramSource = api.parameters;
    return paramSource?.properties && Object.keys(paramSource.properties).length > 0;
  };


  const handleConfigToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConfigExpanded(!isConfigExpanded);
  };

  const handleMainClick = () => {
    if (onClick) {
      onClick(api);
    }
  };


  return (
    <div
      className="api-item border border-gray-400 dark:border-gray-500 bg-gradient-to-br from-gray-200 via-gray-100 to-gray-300 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 shadow-lg hover:shadow-xl transition-all duration-200 ease-in-out text-gray-800 dark:text-gray-100"
      style={{
        padding: '10px',
        margin: '10px 0',
        borderRadius: '8px',
      }}
    >
      <div 
        className={`flex flex-row ${onClick ? 'cursor-pointer hover:bg-gray-200/70 dark:hover:bg-gray-600/50 rounded-md transition-colors duration-150' : ''}`}
        onClick={handleMainClick}
      >
        { onChange ?
        <Checkbox
          id={`api-${index}`}
          label={camelCaseToTitle(api.name)}
          checked={selected || false}
          onChange={(e) => onChange(api.id, e, api.bindings)}
          bold={true}
        /> : 
        <span className={`flex flex-row gap-2 mt-[1px] font-bold`}>{
              getIcon(api.name)} {camelCaseToTitle(api.name)}</span>}
        {/* Configuration button - only show if allowConfiguration and has parameters */}
        {allowConfiguration && hasConfiguration() && (
            <button
              onClick={handleConfigToggle}
              className="-mt-5 ml-2  text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1"
              title="Configure API parameters"
            >
              <IconAdjustments size={18} />
            </button>
          )} 

        <div className="ml-auto flex items-center gap-2">
          
          {showDetails && api.tags && filterTags(api.tags).length > 0 &&
          <div>
            <TagsList
              tags={filterTags(api.tags)}
              setTags={() => {}}
              isDisabled={true}
            />
          </div>}
        </div>
      </div>

      {/* Configuration Section - Expandable */}
      {allowConfiguration && isConfigExpanded && hasConfiguration() && (
        <div className="relative py-3 mb-4 border-t border-b border-neutral-200 dark:border-neutral-600 800/80 bg-gray-100 dark:bg-gray-700 rounded-md mt-2" onClick={(e) => e.stopPropagation()}>
          <div className="absolute right-2 top-2 z-10">
            {isConfigExpanded && 
            <ActionButton
              title="Collapse Configurations"
              handleClick={handleConfigToggle}
            >
              <IconX size={18}/>
            </ActionButton>}
          </div>
          <ApiParameterBindingEditor
            paramSource={api.parameters}
            paramModes={paramModes}
            paramValues={paramValues}
            onParamModeChange={handleParamModeChange}
            onParamValueChange={handleParamValueChange}
          />
        </div>
      )}

      {showDetails && <>
        {api.description && <p className="break-words">{api.description}</p>}
        <details className="mt-2" onClick={(e) => e.stopPropagation()}>
          <summary className="cursor-pointer text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200">Specification</summary>
          <pre className="whitespace-pre-wrap break-words overflow-x-auto max-w-full text-sm">{JSON.stringify(api, null, 2)}</pre>
        </details>
      </>}
    </div>
  );
};

export default ApiItem;