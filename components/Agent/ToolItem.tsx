import React from 'react';
import { Checkbox } from '@/components/ReusableComponents/CheckBox';
import { TagsList } from '@/components/Chat/TagsList';
import { snakeCaseToTitleCase } from '@/utils/app/data';
import { AgentTool } from '@/types/agentTools';
import { getOperationIcon } from '@/utils/app/integrations';

interface ToolItemProps {
  toolId: string;
  toolInfo: AgentTool;
  index: number;
  onChange?: (id: string, checked: boolean) => void;
  selected: boolean;
  onClick?: (tool: any) => void;
  showDetails?: boolean;
}

const getIcon = (name: string | undefined) => {
  const IconComponent = getOperationIcon(name);
  return <IconComponent size={18} />
}

const ToolItem: React.FC<ToolItemProps> = ({ toolId, toolInfo, index, selected, onChange, onClick, showDetails=true }) => {
  // Format description - keep only the first few sentences if it's very long
  const shortDescription = toolInfo.description?.length < 120 ?  toolInfo.description : toolInfo.description.slice(0, 120) + '...';

  const handleMainClick = () => {
    if (onClick) {
      onClick(toolInfo);
    }
  };

  return (
    <div
      className="tool-item border border-gray-400 dark:border-gray-500 bg-gradient-to-br from-gray-200 via-gray-100 to-gray-300 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 shadow-lg hover:shadow-xl transition-all duration-200 ease-in-out text-gray-800 dark:text-gray-100"
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
        {onChange ?
          <Checkbox
            id={`tool-${index}`}
            label={snakeCaseToTitleCase(toolInfo.tool_name)}
            checked={selected || false}
            onChange={(e) => onChange(toolId, e)}
            bold={true}
          /> :
          <span className={`flex flex-row gap-2 mt-[1px] font-bold`}>{
                getIcon(toolInfo.tool_name)} {snakeCaseToTitleCase(toolInfo.tool_name)}</span>}
        <div className='ml-auto flex items-center gap-2'>
          {showDetails && toolInfo.tags && toolInfo.tags.length > 0 && (
            <TagsList
              tags={toolInfo.tags}
              setTags={() => {}}
              isDisabled={true}
            />
          )}
        </div>
      </div>
    {showDetails && <>
      {toolInfo.description && (
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 leading-relaxed">
          {shortDescription}
        </p>
      )}
      
      <details className="mt-2">
        <summary className="cursor-pointer text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200">
          View full details
        </summary>
        <div className="px-3 pb-3 pt-1">
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{toolInfo.description}</p>
          
          {toolInfo.parameters && (
            Object.keys(toolInfo.parameters?.properties).length > 0 && (
              <div className="mt-3">
                <h4 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">Parameters:</h4>
              {toolInfo.parameters.properties && (
                <ul className="mt-1 list-disc pl-5 text-sm text-neutral-700 dark:text-neutral-300">
                  {Object.entries(toolInfo.parameters.properties).map(([paramName, paramInfo]: [string, any]) => (
                    <li key={paramName} className="mt-1">
                      <span className="font-semibold">{paramName}</span>
                      {paramInfo.type && <span> ({paramInfo.type})</span>}
                      {toolInfo.parameters?.required?.includes(paramName) && 
                        <span className="text-red-500 ml-1">(required)</span>
                      }
                    </li>
                  ))}
                </ul>
              )}
            </div>)
          )}
        </div>
      </details>
    </>}
    </div>
  );
};

export default ToolItem;