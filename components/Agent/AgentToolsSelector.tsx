import React, { useState } from 'react';
import ToolItem from './ToolItem';
import { opsSearchToggleButtons } from '../Admin/AdminComponents/Ops';

interface ToolInfo {
  tool_name: string;
  description: string;
  tags: string[];
  [key: string]: any; // Allow additional properties
}

interface AgentToolsSelectorProps {
  availableTools: Record<string, ToolInfo>;
  selectedTools: string[];
  onToolSelectionChange: (tools: string[]) => void;
  onClickAgentTool?: (tool: any) => void;
  disableSelection?:boolean;
  showDetails?: boolean;
}

const AgentToolsSelector: React.FC<AgentToolsSelectorProps> = ({ 
  availableTools, 
  selectedTools, 
  onToolSelectionChange,
  onClickAgentTool,
  disableSelection = false,
  showDetails
}) => {
    const [opSearchBy, setOpSearchBy] = useState<"name" | 'tag'>('name'); 
    const [searchTerm, setSearchTerm] = useState<string>(''); 


  const handleToolChange = (toolId: string, checked: boolean) => {
    if (checked) {
      onToolSelectionChange([...selectedTools, toolId]);
    } else {
      onToolSelectionChange(selectedTools.filter(id => id !== toolId));
    }
  };

  const filteredTools = Object.entries(availableTools || {}).filter(([toolId, toolInfo]) => {
    if (!searchTerm) return true;
    
    if (opSearchBy === 'name') return toolInfo.tool_name.split(/[-_.\s]+/).join(' ').toLowerCase().includes(searchTerm.toLowerCase());
    if (opSearchBy === 'tag') return toolInfo.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())) || false;
    return true;
  });

  return (
    <div className="agent-tools-selector">
      {availableTools && opsSearchToggleButtons(opSearchBy, setOpSearchBy, searchTerm, setSearchTerm, " mt-6 ml-auto mb-6", '', showDetails)}

      <div className="tool-list max-h-[500px] overflow-y-auto">
        {filteredTools.length > 0 ? (
          filteredTools.map(([toolId, toolInfo], index) => (
            <ToolItem
              key={toolId}
              toolId={toolId}
              toolInfo={toolInfo}
              index={index}
              selected={selectedTools.includes(toolId)}
              onChange={disableSelection ? undefined : handleToolChange}
              onClick={onClickAgentTool}
              showDetails={showDetails}
            />
          ))
        ) : (
          <div className="p-4 text-center text-neutral-500 dark:text-neutral-400">
            {availableTools && Object.keys(availableTools).length > 0 
              ? 'No tools match your search criteria'
              : 'No Agent Tools Available'}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentToolsSelector; 