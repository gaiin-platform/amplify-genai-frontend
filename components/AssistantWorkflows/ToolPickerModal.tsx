import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  IconX, IconSearch, IconTool, IconChevronDown, IconChevronUp,
  IconFiles, IconActivity, IconSettingsAutomation, IconMessageCircle, 
  IconBrain, IconHelp
} from '@tabler/icons-react';
import { getOperationIcon } from '@/types/integrations';
import { snakeCaseToTitleCase } from '@/utils/app/data';
import { OpDef } from '@/types/op';
import { AgentTool } from '@/types/agentTools';
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
  originalTool?: OpDef | AgentTool;
}

export interface ToolPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (tool: ToolItem) => void;
  tools: ToolItem[];
  title: string;
  showAdvancedFiltering?: boolean; // Controls SmartTagSelector visibility (default: true)
  showClearSearch?: boolean; // Controls "Clear Search" link visibility (default: true)
  defaultToolType?: string; // Default selected tool type (default: 'all')
  
  // Multi-select props
  allowMultiSelect?: boolean;
  showSelectionPreview?: boolean;
  selectedTools?: ToolItem[];
  onMultiSelectChange?: (tools: ToolItem[]) => void;
  
}


export const filterTags = (tags: string[]): string[] => {
  return tags.filter((t: string) => !['default', 'all'].includes(t));
};

export const ToolPickerModal: React.FC<ToolPickerModalProps> = ({
  isOpen, onClose, onSelect, tools, title,
  showAdvancedFiltering = true,
  showClearSearch = true,
  defaultToolType = 'all',
  allowMultiSelect = false,
  showSelectionPreview = false,
  selectedTools = [],
  onMultiSelectChange
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedToolType, setSelectedToolType] = useState(defaultToolType);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [clearAllTrigger, setClearAllTrigger] = useState(0);
  
  // Detect dark mode from the main app
  const isDarkMode = typeof window !== 'undefined' && 
    (document.documentElement.classList.contains('dark') || 
     document.body.classList.contains('dark') ||
     document.querySelector('main')?.classList.contains('dark'));

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

  // Contextual button text based on mode
  const closeButtonText = allowMultiSelect ? 'Save Selection' : 'Cancel';

  if (!isOpen) return null;

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

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-50">
      <div className={`rounded-lg shadow-xl border max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className={`px-6 py-4 border-b ${
          isDarkMode ? 'border-gray-700 bg-gray-900 text-white' : 'border-gray-200 bg-gray-50 text-gray-900'
        }`}>
          <h3 className={`text-lg font-semibold flex items-center gap-2 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            <IconTool size={20} />
            {title}
          </h3>
        </div>
        
        <div className={`px-6 py-4 border-b ${
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
            <div className="grid gap-3">
            {filteredTools.map(tool => {
              const isSelected = isToolSelected(tool);
              return (
                <div
                  key={tool.id}
                  onClick={() => handleToolSelect(tool)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? isDarkMode 
                        ? 'border-blue-600 bg-blue-900/20 text-white' 
                        : 'border-blue-500 bg-blue-50 text-gray-900'
                      : isDarkMode 
                        ? 'border-gray-700 bg-gray-800 hover:bg-gray-700 text-white' 
                        : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-900'
                  }`}
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
                    {!allowMultiSelect && (
                      <button className={`px-3 py-1 text-sm text-white rounded transition-colors ${
                        isDarkMode 
                          ? 'bg-blue-600 hover:bg-blue-500' 
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}>
                        Select
                      </button>
                    )}
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
            })}
            </div>
          </div>
        </div>
        
        <div className={`px-6 py-4 border-t flex justify-end ${
          isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
        }`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 text-sm font-medium rounded-md ${
              isDarkMode 
                ? 'text-gray-300 bg-gray-700 hover:bg-gray-600' 
                : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
            }`}
          >
{closeButtonText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ToolPickerModal;