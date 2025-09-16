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
}

interface SmartTagSelectorProps {
  allTags: string[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  toolItems: ToolItem[];
  clearTrigger?: number;
}

const SmartTagSelector: React.FC<SmartTagSelectorProps> = ({
  allTags, selectedTags, onTagsChange, toolItems, clearTrigger
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [showCategories, setShowCategories] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Clear internal state when clearTrigger changes
  useEffect(() => {
    if (clearTrigger !== undefined && clearTrigger > 0) {
      setSearchTerm('');
      setExpandedCategories([]);
      setShowCategories(false);
      setIsOpen(false);
      onTagsChange([]);
    }
  }, [clearTrigger, onTagsChange]);

  // Calculate tag frequency for popular tags
  const tagFrequency = allTags.reduce((acc, tag) => {
    const count = toolItems.filter(tool => tool.tags?.includes(tag)).length;
    acc[tag] = count;
    return acc;
  }, {} as Record<string, number>);

  // Categorize tags (simple heuristic based on common patterns)
  const categorizedTags = allTags.reduce((acc, tag) => {
    const lowerTag = tag.toLowerCase();
    let category = 'Other';
    
    if (['communication', 'notification', 'microsoft_outlook', 'google_gmail', 'email', 'slack', 'chat', 'message'].some(keyword => lowerTag.includes(keyword))) {
      category = 'Communication';
    } else if (['data', 'database', 'storage', 'file', 'document', 'analytics'].some(keyword => lowerTag.includes(keyword))) {
      category = 'Data & Files';
    } else if (['processing', 'transform', 'analysis', 'calculation', 'compute'].some(keyword => lowerTag.includes(keyword))) {
      category = 'Processing';
    } else if (['reasoning', 'planning', 'thinking', 'logic', 'decision'].some(keyword => lowerTag.includes(keyword))) {
      category = 'AI & Logic';
    } else if (['control', 'workflow', 'automation', 'trigger'].some(keyword => lowerTag.includes(keyword))) {
      category = 'Control & Flow';
    }
    
    if (!acc[category]) acc[category] = [];
    acc[category].push(tag);
    return acc;
  }, {} as Record<string, string[]>);

  // Category icons
  const categoryIcons: Record<string, JSX.Element> = {
    'Communication': <IconMessageCircle size={16} />,
    'Data & Files': <IconFiles size={16} />,
    'Processing': <IconActivity size={16} />,
    'AI & Logic': <IconBrain size={16} />,
    'Control & Flow': <IconSettingsAutomation size={16} />,
    'Other': <IconHelp size={16} />
  };

  // Filter tags based on search
  const filteredTags = allTags.filter(tag =>
    tag.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const removeTag = (tag: string) => {
    onTagsChange(selectedTags.filter(t => t !== tag));
  };

  const toggleCategory = (category: string) => {
    if (expandedCategories.includes(category)) {
      setExpandedCategories(expandedCategories.filter(c => c !== category));
    } else {
      setExpandedCategories([...expandedCategories, category]);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-3">
      {/* Collapsible Category Browser */}
      <div className="border border-gray-200 dark:border-gray-600 rounded-lg">
        {/* Section Header */}
        <button
          onClick={() => setShowCategories(!showCategories)}
          className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">📋</span>
            <span className="font-medium text-sm text-gray-900 dark:text-white">
              Browse by Category
            </span>
          </div>
          {showCategories ? 
            <IconChevronUp size={16} className="text-gray-400" /> : 
            <IconChevronDown size={16} className="text-gray-400" />
          }
        </button>
        
        {/* Expandable Category Sections */}
        {showCategories && (
          <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-600 mt-1 pt-3">
            <div className="space-y-1">
              {Object.entries(categorizedTags)
                .sort(([categoryA], [categoryB]) => categoryA.localeCompare(categoryB))
                .map(([category, tags]) => (
                <div key={category} className="border border-gray-200 dark:border-gray-600 rounded-lg">
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between p-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{categoryIcons[category]}</span>
                      <span className="font-medium text-sm text-gray-900 dark:text-white">
                        {category}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ({tags.length} tags)
                      </span>
                    </div>
                    {expandedCategories.includes(category) ? 
                      <IconChevronUp size={14} className="text-gray-400" /> : 
                      <IconChevronDown size={14} className="text-gray-400" />
                    }
                  </button>
                  
                  {/* Category Tags (when expanded) */}
                  {expandedCategories.includes(category) && (
                    <div className="px-2 pb-2 border-t border-gray-200 dark:border-gray-600 mt-1 pt-2">
                      <div className="flex flex-wrap gap-1">
                        {tags.map(tag => (
                          <button
                            key={tag}
                            onClick={() => toggleTag(tag)}
                            className={`px-2 py-1 text-xs rounded-full transition-colors ${
                              selectedTags.includes(tag)
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Selected Tags Display */}
      {selectedTags.length > 0 && (
        <div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
            Active Filters ({selectedTags.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {selectedTags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full"
              >
                #{tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="ml-1 hover:text-blue-600 dark:hover:text-blue-300"
                >
                  <IconX size={12} />
                </button>
              </span>
            ))}
            <button
              onClick={() => onTagsChange([])}
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Clear all
            </button>
          </div>
        </div>
      )}

      {/* Search All Tags */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600"
        >
          <span>🔍 Search All Tags ({allTags.length} total)</span>
          {isOpen ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
        </button>

        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-hidden">
            {/* Search */}
            <div className="p-2 border-b border-gray-200 dark:border-gray-600">
              <div className="relative">
                <IconSearch size={16} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search tags..."
                  className="w-full pl-8 pr-3 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
            </div>

            {/* Tag List */}
            <div className="max-h-48 overflow-y-auto">
              {searchTerm ? (
                // Search Results
                <div className="p-2">
                  {filteredTags.length > 0 ? (
                    <div className="space-y-1">
                      {filteredTags.map(tag => (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className={`w-full text-left px-2 py-1 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                            selectedTags.includes(tag) ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-200' : ''
                          }`}
                        >
                          #{tag} ({tagFrequency[tag]} tools)
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 dark:text-gray-400 p-2">
                      No tags found
                    </div>
                  )}
                </div>
              ) : (
                // Instructions
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                  <div className="text-sm mb-2">Type to search all {allTags.length} tags</div>
                  <div className="text-xs">Or use the categories above for browsing</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const filterTags = (tags: string[]): string[] => {
  return tags.filter((t: string) => !['default', 'all'].includes(t));
};

// Export SmartTagSelector for use in other components if needed
export { SmartTagSelector };

export const ToolPickerModal: React.FC<ToolPickerModalProps> = ({
  isOpen, onClose, onSelect, tools, title,
  showAdvancedFiltering = true,
  showClearSearch = true,
  defaultToolType = 'all'
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
          isDarkMode ? 'border-gray-700 bg-gray-800 text-white' : 'border-gray-200 bg-white text-gray-900'
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
        
        <div className={`flex-1 overflow-y-auto p-6 ${
          isDarkMode ? 'bg-gray-800' : 'bg-white'
        }`}>
          <div className="grid gap-3">
            {filteredTools.map(tool => (
              <div
                key={tool.id}
                onClick={() => onSelect(tool)}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  isDarkMode 
                    ? 'border-gray-700 bg-gray-800 hover:bg-gray-700 text-white' 
                    : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-900'
                }`}
              >
                <div className="flex items-center gap-3">
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
                  <button className={`px-3 py-1 text-sm text-white rounded transition-colors ${
                    isDarkMode 
                      ? 'bg-blue-600 hover:bg-blue-500' 
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}>
                    Select
                  </button>
                </div>
              </div>
            ))}
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
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ToolPickerModal;