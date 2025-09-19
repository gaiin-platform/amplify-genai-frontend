import React, { useState, useEffect } from 'react';
import { IconChevronDown, IconChevronUp, IconX, IconSearch } from '@tabler/icons-react';
import { ToolItem } from '../ToolSelectorModal';

export interface SmartTagSelectorProps {
  allTags: string[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  toolItems: ToolItem[];
  clearTrigger?: number;
}

export const SmartTagSelector: React.FC<SmartTagSelectorProps> = ({
  allTags, selectedTags, onTagsChange, toolItems, clearTrigger
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [showCategories, setShowCategories] = useState(false);

  // Reset state when clearTrigger changes
  useEffect(() => {
    if (clearTrigger !== undefined && clearTrigger > 0) {
      setIsOpen(false);
      setSearchTerm('');
      setExpandedCategories([]);
      setShowCategories(false);
    }
  }, [clearTrigger]);

  // Get filtered tags based on current search
  const filteredTags = allTags.filter(tag =>
    tag.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group tags by the tools that have them (for category view)
  const tagsByCategory = React.useMemo(() => {
    const categories: Record<string, string[]> = {};
    
    filteredTags.forEach(tag => {
      const toolsWithTag = toolItems.filter(item => 
        item.tags && item.tags.includes(tag)
      );
      
      toolsWithTag.forEach(tool => {
        const category = tool.category;
        if (!categories[category]) {
          categories[category] = [];
        }
        if (!categories[category].includes(tag)) {
          categories[category].push(tag);
        }
      });
    });
    
    return categories;
  }, [filteredTags, toolItems]);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const toggleTag = (tag: string) => {
    const newSelectedTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];
    onTagsChange(newSelectedTags);
  };

  const clearSelectedTags = () => {
    onTagsChange([]);
  };

  // Check if the component should use dark mode
  const isDarkMode = 
    (document.documentElement.classList.contains('dark') || 
     document.body.classList.contains('dark') ||
     document.querySelector('main')?.classList.contains('dark'));

  if (!isOpen) {
    return (
      <div className="mb-4">
        <button
          onClick={() => setIsOpen(true)}
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm border rounded-md transition-colors ${
            isDarkMode 
              ? 'border-gray-600 text-gray-300 bg-gray-700 hover:bg-gray-600' 
              : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
          }`}
        >
          <IconSearch size={16} />
          <span>Filter by Tags</span>
          {selectedTags.length > 0 && (
            <span className={`px-2 py-1 text-xs rounded-full ${
              isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'
            }`}>
              {selectedTags.length}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className={`mb-4 border rounded-lg ${
      isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-white'
    }`}>
      {/* Header */}
      <div className={`flex items-center justify-between p-3 border-b ${
        isDarkMode ? 'border-gray-600' : 'border-gray-300'
      }`}>
        <div className="flex items-center gap-2">
          <IconSearch size={16} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
          <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Filter by Tags
          </span>
          {selectedTags.length > 0 && (
            <span className={`px-2 py-1 text-xs rounded-full ${
              isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'
            }`}>
              {selectedTags.length} selected
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedTags.length > 0 && (
            <button
              onClick={clearSelectedTags}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                isDarkMode 
                  ? 'text-red-400 hover:text-red-300 hover:bg-red-900/20' 
                  : 'text-red-600 hover:text-red-700 hover:bg-red-50'
              }`}
            >
              Clear all
            </button>
          )}
          <button
            onClick={() => setIsOpen(false)}
            className={`p-1 rounded transition-colors ${
              isDarkMode 
                ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-600' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <IconX size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Search */}
        <input
          type="text"
          placeholder="Search tags..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`w-full px-3 py-2 text-sm border rounded-md mb-3 transition-colors ${
            isDarkMode 
              ? 'border-gray-600 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-500' 
              : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:border-blue-500'
          } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
        />

        {/* View Toggle */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setShowCategories(false)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              !showCategories
                ? isDarkMode 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-blue-100 text-blue-800'
                : isDarkMode 
                  ? 'text-gray-400 hover:text-gray-300' 
                  : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            All Tags
          </button>
          <button
            onClick={() => setShowCategories(true)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              showCategories
                ? isDarkMode 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-blue-100 text-blue-800'
                : isDarkMode 
                  ? 'text-gray-400 hover:text-gray-300' 
                  : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            By Category
          </button>
        </div>

        {/* Tags Display */}
        <div className="max-h-48 overflow-y-auto">
          {!showCategories ? (
            /* All Tags View */
            <div className="flex flex-wrap gap-1">
              {filteredTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedTags.includes(tag)
                      ? isDarkMode 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-blue-100 text-blue-800'
                      : isDarkMode 
                        ? 'bg-gray-600 text-gray-300 hover:bg-gray-500' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          ) : (
            /* Category View */
            <div className="space-y-2">
              {Object.entries(tagsByCategory).map(([category, categoryTags]) => (
                <div key={category} className={`border rounded-lg ${
                  isDarkMode ? 'border-gray-600' : 'border-gray-200'
                }`}>
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className={`w-full flex items-center justify-between p-2 text-left rounded-lg transition-colors ${
                      isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className={`text-sm font-medium ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {category} ({categoryTags.length})
                    </span>
                    {expandedCategories.includes(category) ? (
                      <IconChevronUp size={16} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
                    ) : (
                      <IconChevronDown size={16} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
                    )}
                  </button>
                  
                  {/* Category Tags */}
                  {expandedCategories.includes(category) && (
                    <div className="p-2 pt-0">
                      <div className="flex flex-wrap gap-1">
                        {categoryTags.map(tag => (
                          <button
                            key={tag}
                            onClick={() => toggleTag(tag)}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              selectedTags.includes(tag)
                                ? isDarkMode 
                                  ? 'bg-blue-600 text-white' 
                                  : 'bg-blue-100 text-blue-800'
                                : isDarkMode 
                                  ? 'bg-gray-600 text-gray-300 hover:bg-gray-500' 
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
          )}
        </div>
      </div>
    </div>
  );
};