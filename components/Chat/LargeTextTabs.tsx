import React, { useState } from 'react';
import { IconCircleX, IconFileText, IconEdit, IconCheck, IconX } from '@tabler/icons-react';
import { LargeTextBlock, extractNumberFromBracketedText } from '@/utils/app/largeText';

interface LargeTextTabsProps {
  largeTextBlocks: LargeTextBlock[];
  onRemoveBlock: (blockId: string) => void;
  onEditBlock: (blockId: string) => void;
  currentlyEditingId?: string;
  showPreview?: boolean;
}

export const LargeTextTabs: React.FC<LargeTextTabsProps> = ({
  largeTextBlocks,
  onRemoveBlock,
  onEditBlock,
  currentlyEditingId,
  showPreview = true
}) => {
  const [hoveredBlock, setHoveredBlock] = useState<string>('');

  const getTabLabel = (block: LargeTextBlock): string => {
    const numberText = extractNumberFromBracketedText(block.placeholderChar);
    const sizeText = block.charCount > 1000 
      ? `${Math.round(block.charCount / 1000)}k chars`
      : `${block.charCount} chars`;
    return `Input Text (${numberText}) - ${sizeText}`;
  };

  const getShortLabel = (block: LargeTextBlock): string => {
    const numberText = extractNumberFromBracketedText(block.placeholderChar);
    return `${numberText}. Input Text`;
  };

  if (!showPreview || largeTextBlocks.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1 pb-2 mt-2">
      {largeTextBlocks.map((block) => {
        const isEditing = currentlyEditingId === block.id;
        const isHovered = hoveredBlock === block.id;
        
        return (
          <div
            key={block.id}
            className={`
              flex flex-row items-center justify-between border rounded-md px-2 py-1.5 shadow-md dark:shadow-lg
              ${isEditing 
                ? 'bg-blue-100 border-blue-400 dark:bg-blue-900/40 dark:border-blue-500' 
                : 'bg-white border-gray-200 dark:bg-[#40414F] dark:border-neutral-500'
              }
              ${!isEditing && isHovered ? 'hover:bg-gray-50 dark:hover:bg-gray-600' : ''}
              transition-colors cursor-pointer
            `}
            style={{ maxWidth: '280px', minWidth: '180px' }}
            onMouseEnter={() => setHoveredBlock(block.id)}
            onMouseLeave={() => setHoveredBlock('')}
            onClick={() => !isEditing && onEditBlock(block.id)}
            title={getTabLabel(block)}
          >
            {/* Icon */}
            <div className="flex-shrink-0 mr-2">
              {isEditing ? (
                <IconEdit className="text-blue-600 dark:text-blue-400" size={18} />
              ) : (
                <IconFileText className="text-gray-600 dark:text-gray-400" size={18} />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium text-sm text-gray-800 dark:text-white">
                {getShortLabel(block)}
              </p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                {block.charCount.toLocaleString()} characters
              </p>
            </div>

            {/* Status/Action Icons */}
            <div className="flex-shrink-0 ml-2 flex items-center gap-1">
              {isEditing && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    Editing
                  </span>
                </div>
              )}
              
              {/* Remove button */}
              <button
                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRemoveBlock(block.id);
                }}
                title="Remove text block"
              >
                <IconCircleX size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default LargeTextTabs;