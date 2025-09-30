import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
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
   * Handle pasting large text - creates new block and updates content
   */
  const handleLargeTextPaste = useCallback((
    pastedText: string,
    currentContent: string,
    cursorPosition: number,
    textareaRef: React.RefObject<HTMLTextAreaElement>
  ): { newContent: string; hasLargeText: boolean } => {
    const processedText = processLargeText(pastedText);
    
    if (!processedText.isLarge) {
      return { newContent: currentContent, hasLargeText: false };
    }

    // Check if we've reached the maximum number of text blocks (20)
    if (largeTextBlocks.length >= 20) {
      toast.error('Maximum 20 text blocks allowed. Additional text will be pasted as regular text.');
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
  }, [largeTextBlocks, largeTextCounter]);

  /**
   * Remove a specific large text block
   */
  const removeLargeTextBlock = useCallback((
    blockId: string,
    currentContent: string
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
   * Check if there are any large text blocks
   */
  const hasLargeTextBlocks = largeTextBlocks.length > 0;

  return {
    // State
    largeTextBlocks,
    showLargeTextPreview,
    hasLargeTextBlocks,
    
    // Actions
    handleLargeTextPaste,
    removeLargeTextBlock,
    clearLargeText,
    
    // Direct state setters (for edge cases)
    setLargeTextBlocks,
    setShowLargeTextPreview
  };
}