import { useState, useCallback, useMemo } from 'react';
import {
  LargeTextBlock,
  processLargeText,
  createLargeTextBlock,
  generatePlaceholderText,
  removeLargeTextBlockFromContent
} from '@/utils/app/largeText';

/**
 * Custom hook for managing large text state and operations
 * Encapsulates the state management for multiple large text blocks in chat input
 */
export function useLargeTextManager() {
  const [largeTextBlocks, setLargeTextBlocks] = useState<LargeTextBlock[]>([]);
  const [showLargeTextPreview, setShowLargeTextPreview] = useState(false);
  const [largeTextCounter, setLargeTextCounter] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * Memoized text processing for performance optimization
   */
  const memoizedProcessText = useCallback((text: string) => {
    return processLargeText(text);
  }, []);

  /**
   * Handle pasting large text - creates new block and updates content
   * Now includes error handling and model limit validation
   */
  const handleLargeTextPaste = useCallback((    pastedText: string,
    currentContent: string,
    cursorPosition: number,
    textareaRef: React.RefObject<HTMLTextAreaElement>,
    modelLimit?: number
  ): { newContent: string; hasLargeText: boolean; error?: string } => {
    // Prevent concurrent processing
    if (isProcessing) {
      return { newContent: currentContent, hasLargeText: false, error: 'Already processing a paste operation' };
    }

    try {
      setIsProcessing(true);
      const processedText = memoizedProcessText(pastedText);

      if (!processedText.isLarge) {
        return { newContent: currentContent, hasLargeText: false };
      }

      // Validate against model context window if provided
      if (modelLimit) {
        const estimatedFinalSize = currentContent.length + pastedText.length;

        if (estimatedFinalSize > modelLimit) {
          return {
            newContent: currentContent,
            hasLargeText: false,
            error: `This text is too large for the selected model (${pastedText.length.toLocaleString()} characters). Model limit: ${modelLimit.toLocaleString()} characters.`
          };
        }
      }

      // Create new large text block using global counter
      const newBlock = createLargeTextBlock(
        processedText,
        cursorPosition,
        largeTextCounter
      );

      // Update state
      setLargeTextCounter(prev => prev + 1);
      const updatedBlocks = [...largeTextBlocks, newBlock];
      setLargeTextBlocks(updatedBlocks);
      setShowLargeTextPreview(true);

      // Insert placeholder text at cursor position
      const beforeCursor = currentContent.substring(0, cursorPosition);
      const afterCursor = currentContent.substring(cursorPosition);
      const placeholder = generatePlaceholderText(newBlock);
      const newContent = beforeCursor + placeholder + afterCursor;

      // Update cursor position after the inserted placeholder
      if (textareaRef.current) {
        setTimeout(() => {
          const newCursorPos = cursorPosition + placeholder.length;
          textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
      }

      return { newContent, hasLargeText: true };
    } catch (error) {
      console.error('Error processing large text paste:', error);
      return {
        newContent: currentContent,
        hasLargeText: false,
        error: 'Failed to process pasted text. Please try pasting a smaller amount or contact support if the issue persists.'
      };
    } finally {
      setIsProcessing(false);
    }
  }, [largeTextBlocks, largeTextCounter, memoizedProcessText]);

  /**
   * Remove a specific large text block
   */
  const removeLargeTextBlock = useCallback((
    blockId: string,
    currentContent: string,
    onBlockRemoved?: (blockId: string) => void
  ): string => {
    const blockToRemove = largeTextBlocks.find(block => block.id === blockId);
    if (!blockToRemove) {
      return currentContent;
    }

    // Remove the placeholder from content
    const updatedContent = removeLargeTextBlockFromContent(currentContent, blockToRemove);
    
    // Remove block from array
    const updatedBlocks = largeTextBlocks.filter(block => block.id !== blockId);
    setLargeTextBlocks(updatedBlocks);
    
    // Hide preview if no blocks remain
    if (updatedBlocks.length === 0) {
      setShowLargeTextPreview(false);
    }
    
    // Notify that block was removed (for edit mode cleanup)
    if (onBlockRemoved) {
      onBlockRemoved(blockId);
    }
    
    return updatedContent;
  }, [largeTextBlocks]);

  /**
   * Remove multiple large text blocks in a single operation
   */
  const removeMultipleLargeTextBlocks = useCallback((
    blockIds: string[],
    currentContent: string
  ): string => {
    if (blockIds.length === 0) {
      return currentContent;
    }

    // Find all blocks to remove
    const blocksToRemove = largeTextBlocks.filter(block => blockIds.includes(block.id));
    if (blocksToRemove.length === 0) {
      return currentContent;
    }

    // Remove all placeholders from content in sequence
    let updatedContent = currentContent;
    blocksToRemove.forEach(block => {
      updatedContent = removeLargeTextBlockFromContent(updatedContent, block);
    });
    
    // Remove all blocks from array in a single operation
    const updatedBlocks = largeTextBlocks.filter(block => !blockIds.includes(block.id));
    setLargeTextBlocks(updatedBlocks);
    
    // Hide preview if no blocks remain
    if (updatedBlocks.length === 0) {
      setShowLargeTextPreview(false);
    }
    
    return updatedContent;
  }, [largeTextBlocks]);

  /**
   * Clear all large text blocks and reset state
   */
  const clearLargeText = useCallback(() => {
    setLargeTextBlocks([]);
    setShowLargeTextPreview(false);
    setLargeTextCounter(0); // Reset counter for next prompt
  }, []);

  /**
   * Memoized check if there are any large text blocks
   */
  const hasLargeTextBlocks = useMemo(() => largeTextBlocks.length > 0, [largeTextBlocks.length]);

  return {
    // State
    largeTextBlocks,
    showLargeTextPreview,
    hasLargeTextBlocks,
    isProcessing,

    // Actions
    handleLargeTextPaste,
    removeLargeTextBlock,
    removeMultipleLargeTextBlocks,
    clearLargeText,

    // Direct state setters (for edge cases)
    setLargeTextBlocks,
    setShowLargeTextPreview
  };
}