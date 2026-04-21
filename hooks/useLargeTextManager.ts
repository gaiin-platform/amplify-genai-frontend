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

  /**
   * Memoized text processing for performance optimization
   */
  const memoizedProcessText = useCallback((text: string) => {
    return processLargeText(text);
  }, []);

  /**
   * Handle pasting large text - creates new block and updates content
   */
  const handleLargeTextPaste = useCallback((
    pastedText: string,
    currentContent: string,
    cursorPosition: number,
    textareaRef: React.RefObject<HTMLTextAreaElement>
  ): { newContent: string; hasLargeText: boolean } => {
    const processedText = memoizedProcessText(pastedText);
    
    if (!processedText.isLarge) {
      return { newContent: currentContent, hasLargeText: false };
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