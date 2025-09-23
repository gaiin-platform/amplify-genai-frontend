import React from 'react';
import { createPortal } from 'react-dom';
import { IconX, IconTool } from '@tabler/icons-react';
import { ToolSelectorCore, ToolItem } from './ToolSelectorCore';

export interface ToolSelectorModalProps {
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


export const ToolSelectorModal: React.FC<ToolSelectorModalProps> = ({
  isOpen, onClose, onSelect, tools, title,
  showAdvancedFiltering = true,
  showClearSearch = true,
  defaultToolType = 'all',
  allowMultiSelect = false,
  showSelectionPreview = false,
  selectedTools = [],
  onMultiSelectChange
}) => {
  // Detect dark mode from the main app
  const isDarkMode = typeof window !== 'undefined' && 
    (document.documentElement.classList.contains('dark') || 
     document.body.classList.contains('dark') ||
     document.querySelector('main')?.classList.contains('dark'));

  // Contextual button text based on mode
  const closeButtonText = allowMultiSelect ? 'Save Selection' : 'Cancel';

  if (!isOpen) return null;

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
        
        {/* Use ToolSelectorCore for all the content */}
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
            variant="modal"
          />
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

export default ToolSelectorModal;

// Re-export ToolItem for backward compatibility
export type { ToolItem } from './ToolSelectorCore';