import React, { useState } from 'react';
import { 
  IconSearch, IconTool, IconX
} from '@tabler/icons-react';
import { snakeCaseToTitleCase } from '@/utils/app/data';
import { SmartTagSelector } from './shared/SmartTagSelector';

export interface ToolItem {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  tags: string[];
  parameters: any;
  type: 'api' | 'agent' | 'builtin';
  originalTool?: any;
}

export interface ToolSelectorCoreProps {
  tools: ToolItem[];
  onSelect: (tool: ToolItem) => void;
  showAdvancedFiltering?: boolean;
  showClearSearch?: boolean;
  defaultToolType?: string;
  
  // Multi-select props
  allowMultiSelect?: boolean;
  showSelectionPreview?: boolean;
  selectedTools?: ToolItem[];
  onMultiSelectChange?: (tools: ToolItem[]) => void;
  
  // Styling/layout props
  isDarkMode?: boolean;
  variant?: 'modal' | 'panel';
  
  // Custom rendering for drag and drop
  renderTool?: (tool: ToolItem, handleSelect: () => void, isSelected: boolean) => React.ReactNode;
}

export const filterTags = (tags: string[]): string[] => {
  return tags.filter((t: string) => !['default', 'all'].includes(t));
};

export const ToolSelectorCore: React.FC<ToolSelectorCoreProps> = ({
  tools,
  onSelect,
  showAdvancedFiltering = true,
  showClearSearch = true,
  defaultToolType = 'all',
  allowMultiSelect = false,
  showSelectionPreview = false,
  selectedTools = [],
  onMultiSelectChange,
  isDarkMode = false,
  variant = 'modal',
  renderTool
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedToolType, setSelectedToolType] = useState(defaultToolType);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [clearAllTrigger, setClearAllTrigger] = useState(0);

  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedToolType(defaultToolType);
    if (showAdvancedFiltering) {
      setSelectedTags([]);
      setClearAllTrigger(prev => prev + 1);
    }
  };

  // Handle tool selection (single or multi-select mode)
  const handleToolSelect = (tool: ToolItem) => {
    if (allowMultiSelect) {
      if (!onMultiSelectChange) return;
      
      const isSelected = selectedTools.some(t => t.id === tool.id);
      if (isSelected) {
        // Remove from selection
        onMultiSelectChange(selectedTools.filter(t => t.id !== tool.id));
      } else {
        // Add to selection
        onMultiSelectChange([...selectedTools, tool]);
      }
    } else {
      // Single select mode - use existing onSelect callback
      onSelect(tool);
    }
  };

  // Remove tool from selection (for preview section)
  const handleRemoveTool = (tool: ToolItem) => {
    if (onMultiSelectChange) {
      onMultiSelectChange(selectedTools.filter(t => t.id !== tool.id));
    }
  };

  // Check if a tool is selected (for multi-select mode)
  const isToolSelected = (tool: ToolItem) => {
    return allowMultiSelect && selectedTools.some(t => t.id === tool.id);
  };

  const categories = ['all', ...Array.from(new Set(tools.map(tool => tool.category)))];
  const allTags = Array.from(new Set(tools.flatMap(item => item.tags || [])));
  
  const filteredTools = tools.filter(tool => {
    const matchesSearch = !searchTerm || 
      tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tool.description && tool.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (tool.tags && tool.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())));
    
    const matchesToolType = selectedToolType === 'all' || tool.category === selectedToolType;
    
    // Only apply tag filtering if advanced filtering is enabled
    const matchesTags = !showAdvancedFiltering || selectedTags.length === 0 || 
      (tool.tags && selectedTags.some(tag => tool.tags.includes(tag)));
    
    return matchesSearch && matchesToolType && matchesTags;
  });

  // Unified tool renderer with consistent modal styling for both variants
  const defaultToolRenderer = (tool: ToolItem, handleSelect: () => void, isSelected: boolean) => (
    <div
      key={tool.id}
      draggable={variant === 'panel'} // Only draggable in panel mode
      onDragStart={variant === 'panel' ? (e) => {
        // Create a serializable version of the tool object (excluding React elements)
        const serializableTool = {
          id: tool.id,
          name: tool.name,
          description: tool.description,
          category: tool.category,
          tags: tool.tags,
          parameters: tool.parameters,
          type: tool.type
          // Exclude 'icon' and 'originalTool' as they contain non-serializable data
        };
        e.dataTransfer.setData('tool', JSON.stringify(serializableTool));
      } : undefined}
      onClick={handleSelect}
      className={`p-4 border rounded-lg transition-colors ${
        variant === 'panel' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      } ${
        isSelected
          ? isDarkMode 
            ? 'border-blue-600 bg-blue-900/20 text-white' 
            : 'border-blue-500 bg-blue-50 text-gray-900'
          : isDarkMode 
            ? 'border-gray-700 bg-gray-800 hover:bg-gray-700 text-white' 
            : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-900'
      }`}
      title={variant === 'panel' ? "Drag this tool to the canvas or onto existing steps to replace them" : undefined}
    >
      <div className="flex items-center gap-3">
        {allowMultiSelect && (
          <div className="flex-shrink-0">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {}} // Handled by parent click
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        )}
        <div className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
          {tool.icon}
        </div>
        <div className="flex-1">
          <h4 className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {snakeCaseToTitleCase(tool.name)}
          </h4>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {tool.description}
          </p>
          {filterTags(tool.tags).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {filterTags(tool.tags).slice(0, 3).map(tag => (
                <span key={tag} className={`px-2 py-0.5 text-xs rounded ${
                  isDarkMode 
                    ? 'bg-gray-600 text-gray-300' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
        {allowMultiSelect && isSelected && (
          <div className={`text-sm font-medium ${
            isDarkMode ? 'text-blue-400' : 'text-blue-600'
          }`}>
            Selected
          </div>
        )}
      </div>
    </div>
  );

  if (variant === 'panel') {
    // Panel variant: Single scrollable area for everything
    return (
      <div className={`flex-1 overflow-y-auto p-4 ${
        isDarkMode ? 'bg-gray-50 dark:bg-gray-900/50' : 'bg-gray-50'
      }`}>
        <div className="space-y-4">
          {/* Clear Search Button */}
          {showClearSearch && (
            <div className="flex justify-end">
              <button
                onClick={clearAllFilters}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
                title="Reset all filters to show all available tools"
              >
                Clear All
              </button>
            </div>
          )}
          
          {/* Category Filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Tool Type
            </label>
            <select
              value={selectedToolType}
              onChange={(e) => setSelectedToolType(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              title="Filter tools by type (API integrations, agent tools, etc.)"
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All Types' : category}
                </option>
              ))}
            </select>
          </div>
          
          {/* Search Filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Search Tools
            </label>
            <div className="relative">
              <IconSearch size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search tools..."
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                title="Search by tool name, description, or tags"
              />
            </div>
          </div>
          
          {/* Smart Tag Filter */}
          {showAdvancedFiltering && (
            <div title="Filter tools by functionality tags">
              <SmartTagSelector
                allTags={allTags}
                selectedTags={selectedTags}
                onTagsChange={setSelectedTags}
                toolItems={tools}
                clearTrigger={clearAllTrigger}
              />
            </div>
          )}
          
          {/* Selection Preview Section */}
          {allowMultiSelect && showSelectionPreview && (
            <div className={`border-b p-4 ${
              isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
            }`}>
              <h4 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                <IconTool size={16} />
                Selected Tools ({selectedTools.length})
              </h4>
              
              {selectedTools.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedTools.map(tool => (
                    <div
                      key={tool.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                        isDarkMode 
                          ? 'bg-blue-900/30 border border-blue-700 text-blue-200' 
                          : 'bg-blue-100 border border-blue-300 text-blue-800'
                      }`}
                    >
                      <div className="flex-shrink-0">
                        {tool.icon}
                      </div>
                      <span className="text-sm font-medium">
                        {snakeCaseToTitleCase(tool.name)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveTool(tool);
                        }}
                        className={`ml-1 hover:bg-opacity-20 hover:bg-red-500 rounded-full p-1 transition-colors ${
                          isDarkMode ? 'text-blue-300 hover:text-red-300' : 'text-blue-600 hover:text-red-600'
                        }`}
                      >
                        <IconX size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  No tools selected yet. Click on tools below to add them to your workflow.
                </div>
              )}
            </div>
          )}
          
          {/* Tool List */}
          <div className="space-y-2">
            <div className="text-sm font-semibold text-gray-900 dark:text-white border-t border-gray-300 dark:border-gray-600 pt-4 pb-2 flex items-center gap-2">
              <IconTool size={16} className="text-gray-600 dark:text-gray-400" />
              Available Tools 
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium">
                {filteredTools.length}
              </span>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredTools.map(tool => {
                const isSelected = isToolSelected(tool);
                const handleSelect = () => handleToolSelect(tool);
                
                return renderTool 
                  ? renderTool(tool, handleSelect, isSelected)
                  : defaultToolRenderer(tool, handleSelect, isSelected);
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Modal variant: Separate header and scrollable content
  return (
    <div className={`flex flex-col h-full ${
      isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
    }`}>
      {/* Search and Filters Section */}
      <div className={`p-4 border-b ${
        isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
      }`}>
        {/* Clear Search Link */}
        {showClearSearch && (
          <div className="flex justify-end mb-3">
            <button
              onClick={clearAllFilters}
              className={`text-sm underline focus:outline-none ${
                isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'
              }`}
            >
              Clear Search
            </button>
          </div>
        )}
        
        <div className="flex gap-3">
          {/* Search Input */}
          <div className="flex-1 relative">
            <IconSearch size={18} className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${
              isDarkMode ? 'text-gray-500' : 'text-gray-400'
            }`} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tools..."
              className={`w-full pl-10 pr-4 py-2 border rounded-lg ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
            />
          </div>

          {/* Category Select */}
          <div className="flex-shrink-0">
            <select
              value={selectedToolType}
              onChange={(e) => setSelectedToolType(e.target.value)}
              className={`px-3 py-2 border rounded-lg ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              {categories.map(category => (
                <option key={category} value={category} className={isDarkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'}>
                  {category === 'all' ? 'All Types' : category}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Smart Tag Filter */}
        {showAdvancedFiltering && (
          <div className="mt-4">
            <SmartTagSelector
              allTags={allTags}
              selectedTags={selectedTags}
              onTagsChange={setSelectedTags}
              toolItems={tools}
              clearTrigger={clearAllTrigger}
            />
          </div>
        )}
      </div>
      
      {/* Content Area */}
      <div className={`flex-1 overflow-y-auto ${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      }`}>
        {/* Selection Preview Section */}
        {allowMultiSelect && showSelectionPreview && (
          <div className={`border-b p-4 ${
            isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
          }`}>
            <h4 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              <IconTool size={16} />
              Selected Tools ({selectedTools.length})
            </h4>
            
            {selectedTools.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedTools.map(tool => (
                  <div
                    key={tool.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                      isDarkMode 
                        ? 'bg-blue-900/30 border border-blue-700 text-blue-200' 
                        : 'bg-blue-100 border border-blue-300 text-blue-800'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {tool.icon}
                    </div>
                    <span className="text-sm font-medium">
                      {snakeCaseToTitleCase(tool.name)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveTool(tool);
                      }}
                      className={`ml-1 hover:bg-opacity-20 hover:bg-red-500 rounded-full p-1 transition-colors ${
                        isDarkMode ? 'text-blue-300 hover:text-red-300' : 'text-blue-600 hover:text-red-600'
                      }`}
                    >
                      <IconX size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                No tools selected yet. Click on tools below to add them to your workflow.
              </div>
            )}
          </div>
        )}
        
        {/* Tools List */}
        <div className="p-6">
          <div className="grid gap-3 max-h-96 overflow-y-auto">
            {filteredTools.map(tool => {
              const isSelected = isToolSelected(tool);
              const handleSelect = () => handleToolSelect(tool);
              
              return renderTool 
                ? renderTool(tool, handleSelect, isSelected)
                : defaultToolRenderer(tool, handleSelect, isSelected);
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolSelectorCore;