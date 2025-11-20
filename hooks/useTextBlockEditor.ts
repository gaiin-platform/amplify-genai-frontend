import { useState, useCallback, MutableRefObject } from 'react';
import { LargeTextBlock } from '@/utils/app/largeText';
import { TEXT_PROCESSING_CONFIG, UI_CONFIG } from '@/constants/largeText';

/**
 * Edit mode state interface
 */
interface EditMode {
  isEditing: boolean;
  blockId: string | null;
  originalConversationContent: string; // The original conversation content before any editing
  editContent: string;
}

/**
 * Hook configuration interface
 */
interface UseTextBlockEditorConfig {
  largeTextBlocks: LargeTextBlock[];
  setLargeTextBlocks: (blocks: LargeTextBlock[]) => void;
  content: string;
  setContent: (content: string) => void;
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
}

/**
 * Return type for the hook
 */
interface TextBlockEditorReturn {
  editMode: EditMode;
  isEditing: boolean;
  editingBlockId: string | null;
  handleEditBlock: (blockId: string) => void;
  handleSaveEdit: () => void;
  handleCancelEdit: () => void;
  shouldSkipPlaceholderDeletion: boolean;
}

/**
 * Custom hook for managing text block editing functionality
 * 
 * This hook encapsulates all the logic for editing large text blocks including:
 * - Edit mode state management
 * - Entering and exiting edit mode
 * - Saving and canceling edits
 * - Content restoration and preservation
 * - Textarea focus management
 */
export function useTextBlockEditor({
  largeTextBlocks,
  setLargeTextBlocks,
  content,
  setContent,
  textareaRef
}: UseTextBlockEditorConfig): TextBlockEditorReturn {
  
  // Edit mode state for large text blocks
  const [editMode, setEditMode] = useState<EditMode>({
    isEditing: false,
    blockId: null,
    originalConversationContent: '',
    editContent: ''
  });

  /**
   * Handle entering edit mode for a large text block
   */
  const handleEditBlock = useCallback((blockId: string) => {
    const block = largeTextBlocks.find(b => b.id === blockId);
    if (!block) return;
    
    // Save the original conversation content only if not already editing
    // This preserves the true original state across multiple edit sessions
    const originalConversationContent = editMode.isEditing 
      ? editMode.originalConversationContent 
      : content;
    
    setEditMode({
      isEditing: true,
      blockId,
      originalConversationContent,
      editContent: block.originalText
    });
    
    // Set textarea content to the block's text for editing
    setContent(block.originalText);
    
    // Focus textarea with cursor positioning
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(0, 0);
      }
    }, UI_CONFIG.CURSOR_UPDATE_DELAY);
  }, [largeTextBlocks, content, editMode, setContent, textareaRef]);

  /**
   * Handle saving edited text block
   */
  const handleSaveEdit = useCallback(() => {
    if (!editMode.isEditing || !editMode.blockId) return;
    
    const currentEditContent = content;
    const block = largeTextBlocks.find(b => b.id === editMode.blockId);
    if (!block) return;
    
    // Calculate updated text metrics using constants
    const lines = currentEditContent.split(TEXT_PROCESSING_CONFIG.LINE_BREAK);
    const words = currentEditContent.trim()
      .split(TEXT_PROCESSING_CONFIG.WORD_SPLIT_PATTERN)
      .filter(word => word.length > 0);
    
    // Update the block with new content and recalculated metrics
    const updatedBlocks = largeTextBlocks.map(b => 
      b.id === editMode.blockId 
        ? { 
            ...b, 
            originalText: currentEditContent, 
            charCount: currentEditContent.length,
            lineCount: lines.length,
            wordCount: words.length
          }
        : b
    );
    
    setLargeTextBlocks(updatedBlocks);
    
    // Restore original conversation content with placeholder
    setContent(editMode.originalConversationContent);
    
    // Exit edit mode - reset to initial state
    setEditMode({ 
      isEditing: false, 
      blockId: null, 
      originalConversationContent: '', 
      editContent: '' 
    });
  }, [editMode, content, largeTextBlocks, setLargeTextBlocks, setContent]);

  /**
   * Handle canceling edit mode
   */
  const handleCancelEdit = useCallback(() => {
    if (!editMode.isEditing) return;
    
    // Restore original conversation content
    setContent(editMode.originalConversationContent);
    
    // Exit edit mode - reset to initial state
    setEditMode({ 
      isEditing: false, 
      blockId: null, 
      originalConversationContent: '', 
      editContent: '' 
    });
  }, [editMode, setContent]);

  /**
   * Check if we should skip placeholder deletion logic
   * This is used in the content change handler to prevent interference during editing
   */
  const shouldSkipPlaceholderDeletion = editMode.isEditing;

  /**
   * Convenience accessor for current editing block ID
   */
  const editingBlockId = editMode.isEditing ? editMode.blockId : null;

  return {
    editMode,
    isEditing: editMode.isEditing,
    editingBlockId,
    handleEditBlock,
    handleSaveEdit,
    handleCancelEdit,
    shouldSkipPlaceholderDeletion
  };
}