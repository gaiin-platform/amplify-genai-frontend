import React from 'react';
import { Checkbox } from '@/components/ReusableComponents/CheckBox';
import { TagsList } from '@/components/Chat/TagsList';
import { snakeCaseToTitleCase } from '@/utils/app/data';
import { AgentTool } from '@/types/agentTools';



interface ToolItemProps {
  toolId: string;
  toolInfo: AgentTool;
  index: number;
  onChange?: (id: string, checked: boolean) => void;
  selected: boolean;
  onClick?: (tool: any) => void;
}

const ToolItem: React.FC<ToolItemProps> = ({ toolId, toolInfo, index, selected, onChange, onClick }) => {
  // Format description - keep only the first few sentences if it's very long
  const shortDescription = toolInfo.description?.length < 120 ?  toolInfo.description : toolInfo.description.slice(0, 120) + '...';

  return (
    <div
      onClick={() => onClick && onClick(toolInfo)}
      key={toolId}
      className={`tool-item ${onClick ? 'cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-700' : ''}`}
      style={{
        border: '1px solid #ccc',
        padding: '10px',
        margin: '10px 0',
        borderRadius: '5px',
      }}
    >
      <div className='flex flex-row'>
        {onChange ?
          <Checkbox
            id={`tool-${index}`}
            label={snakeCaseToTitleCase(toolInfo.tool_name)}
            checked={selected || false}
            onChange={(e) => onChange(toolId, e)}
            bold={true}
          /> : <span className={`mt-[1px] font-bold`}>{snakeCaseToTitleCase(toolInfo.tool_name)}</span>}
        <div className='ml-auto'>
          {toolInfo.tags && toolInfo.tags.length > 0 && (
            <TagsList
              tags={toolInfo.tags}
              setTags={() => {}}
              isDisabled={true}
            />
          )}
        </div>
      </div>
      
      {toolInfo.description && (
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          {shortDescription}
        </p>
      )}
      
      <details className="mt-2">
        <summary className="cursor-pointer text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200">
          View full details
        </summary>
        <div className="mt-2 pl-2 border-l-2 border-neutral-300 dark:border-neutral-700">
          <p className="text-sm text-neutral-700 dark:text-neutral-300">{toolInfo.description}</p>
          
          {toolInfo.parameters && (
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
            </div>
          )}
        </div>
      </details>
    </div>
  );
};

export default ToolItem;
