import React, { useState } from 'react';
import { IconChevronDown, IconChevronUp, IconX, IconClipboard } from '@tabler/icons-react';
import { LargeTextData, generateSummaryText, generatePreviewText } from '@/utils/app/largeText';
import { Message } from '@/types/chat';
import { ExpandedTextDisplay } from './ExpandedTextDisplay';

interface LargeTextDisplayProps {
  // Flexible data input - either direct data or message
  data?: LargeTextData;
  message?: Message;
  messageIndex?: number;
  
  // Optional overrides
  displayName?: string;
  blockId?: string;
  
  // Interaction controls  
  showRemoveButton?: boolean;
  onRemove?: () => void;
}

export const LargeTextDisplay: React.FC<LargeTextDisplayProps> = ({
  data,
  message,
  messageIndex,
  displayName,
  blockId,
  showRemoveButton = false,
  onRemove
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Extract large text data from either prop or message
  const largeTextData: LargeTextData | null = data || message?.data?.largeTextData || null;
  
  // Early return if no data available
  if (!largeTextData) {
    return null;
  }

  // Extract the actual large text content
  const extractLargeText = (): string => {
    if (data) {
      // Direct data usage (input preview case)
      return largeTextData.originalText;
    } else if (message) {
      // Message case (chat history) - extract from message data
      return largeTextData.originalText || message.content;
    }
    return largeTextData.originalText;
  };

  const fullText = extractLargeText();

  // Get placeholder character for header display
  const placeholderChar = data?.placeholderChar || message?.data?.largeTextData?.placeholderChar || '⑴';
  
  // Extract number from placeholder character for display
  const getNumberFromPlaceholder = (char: string): string => {
    const charCode = char.charCodeAt(0);
    if (charCode >= 0x2474 && charCode <= 0x247D) {
      // ⑴ ⑵ ⑶ ... ⑽ (Unicode range)
      return (charCode - 0x2473).toString();
    }
    return '1'; // fallback
  };
  
  const numberText = getNumberFromPlaceholder(placeholderChar);
  const customDisplayName = `Input Text (${numberText})`;

  // Generate display text using utility functions  
  const summaryText = generateSummaryText(largeTextData, customDisplayName);
  const previewText = generatePreviewText(largeTextData);

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="large-text-display border border-gray-200 dark:border-gray-600 rounded-md p-3 my-2 bg-gray-50 dark:bg-gray-700">
      {/* Header with summary and controls */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {summaryText}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleToggleExpand}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded flex items-center gap-1 text-sm"
            title={isExpanded ? "Hide full text" : "Show full text"}
          >
            {isExpanded ? (
              <>
                <IconChevronUp size={16} />
                Hide
              </>
            ) : (
              <>
                <IconChevronDown size={16} />
                Show full text
              </>
            )}
          </button>
          {showRemoveButton && onRemove && (
            <button
              onClick={onRemove}
              className="p-1 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 rounded"
              title="Remove"
            >
              <IconX size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Preview text (when collapsed) */}
      {!isExpanded && (
        <div className="mt-2 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md">
          <div className="text-sm text-gray-700 dark:text-gray-300 break-words whitespace-pre-wrap overflow-hidden">
            {previewText}
          </div>
        </div>
      )}

      {/* Full text display (when expanded) */}
      {isExpanded && (
        <ExpandedTextDisplay text={fullText} />
      )}
    </div>
  );
};

/**
 * Simplified version for inline display within textarea content
 * This creates a visual representation that can be mixed with regular text
 */
interface InlineLargeTextDisplayProps {
  data: LargeTextData;
  onRemove: () => void;
  onClick?: () => void;
}

export const InlineLargeTextDisplay: React.FC<InlineLargeTextDisplayProps> = ({
  data,
  onRemove,
  onClick
}) => {
  const summaryText = generateSummaryText(data);
  const previewText = generatePreviewText(data);

  return (
    <div 
      className="inline-large-text-display cursor-pointer border border-blue-200 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded px-2 py-1 my-1 inline-block max-w-full"
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
          {summaryText}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200"
          title="Remove"
        >
          <IconX size={12} />
        </button>
      </div>
      <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 break-words overflow-hidden">
        <div className="whitespace-pre-wrap line-clamp-2">
          {previewText}
        </div>
      </div>
    </div>
  );
};