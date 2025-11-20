import React from 'react';
import { IconTools } from '@tabler/icons-react';
import { ToolSelectorCore, ToolItem } from './ToolSelectorCore';

export interface ToolSelectorPanelProps {
  tools: ToolItem[];
  onSelect: (tool: ToolItem) => void;
  title?: string;
  showAdvancedFiltering?: boolean;
  showClearSearch?: boolean;
  defaultToolType?: string;
  
  // Multi-select props
  allowMultiSelect?: boolean;
  showSelectionPreview?: boolean;
  selectedTools?: ToolItem[];
  onMultiSelectChange?: (tools: ToolItem[]) => void;
  
  // Panel-specific props
  width?: number;
  className?: string;
  
  // Custom rendering for drag and drop
  renderTool?: (tool: ToolItem, handleSelect: () => void, isSelected: boolean) => React.ReactNode;
}

export const ToolSelectorPanel: React.FC<ToolSelectorPanelProps> = ({
  tools,
  onSelect,
  title = "Tool Selection",
  showAdvancedFiltering = true,
  showClearSearch = true,
  defaultToolType = 'all',
  allowMultiSelect = false,
  showSelectionPreview = false,
  selectedTools = [],
  onMultiSelectChange,
  width,
  className = "",
  renderTool
}) => {
  // Detect dark mode from the main app
  const isDarkMode = typeof window !== 'undefined' && 
    (document.documentElement.classList.contains('dark') || 
     document.body.classList.contains('dark') ||
     document.querySelector('main')?.classList.contains('dark'));


  return (
    <div 
      className={`border-r border-gray-200 dark:border-gray-700 flex flex-col flex-shrink-0 ${className}`}
      style={width ? { width: `${width}px` } : undefined}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <IconTools size={20} className="text-blue-600 dark:text-blue-400" />
          {title}
        </h3>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          {allowMultiSelect ? 'Select tools for your workflow' : 'Drag tools to the canvas to build your workflow'}
        </p>
      </div>
      
      {/* Tool Selector Core */}
      <div className="flex-1 overflow-hidden">
        <ToolSelectorCore
          tools={tools}
          onSelect={onSelect}
          showAdvancedFiltering={showAdvancedFiltering}
          showClearSearch={showClearSearch}
          defaultToolType={defaultToolType}
          allowMultiSelect={allowMultiSelect}
          showSelectionPreview={showSelectionPreview}
          selectedTools={selectedTools}
          onMultiSelectChange={onMultiSelectChange}
          isDarkMode={isDarkMode}
          variant="panel"
          renderTool={renderTool}
        />
      </div>
    </div>
  );
};

export default ToolSelectorPanel;