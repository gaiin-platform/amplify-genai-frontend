/**
 * Utilities for handling large text pastes in the chat interface
 */

import {
  LARGE_TEXT_THRESHOLDS,
  PREVIEW_CONFIG,
  PLACEHOLDER_CONFIG,
  DISPLAY_CONFIG,
  TEXT_PROCESSING_CONFIG,
  DEFAULT_LARGE_TEXT_THRESHOLD,
  createPlaceholderText,
  extractPlaceholderNumber
} from '@/constants/largeText';

export interface LargeTextData {
  originalText: string;
  charCount: number;
  lineCount: number;
  wordCount: number;
  preview: {
    start: string;
    end: string;
  };
  placeholderChar?: string;
  isLarge: boolean;
}

export interface LargeTextBlock {
  id: string;
  displayName: string;
  placeholderChar: string;
  originalText: string;
  charCount: number;
  lineCount: number;
  wordCount: number;
  preview: {
    start: string;
    end: string;
  };
  pastePosition: number;
}

export interface LargeTextThresholds {
  characters: number;
  lines?: number;
}

// Re-export for backward compatibility
export { DEFAULT_LARGE_TEXT_THRESHOLD } from '@/constants/largeText';

/**
 * Check if text exceeds the large text threshold
 */
export function isLargeText(
  text: string, 
  thresholds: LargeTextThresholds = DEFAULT_LARGE_TEXT_THRESHOLD
): boolean {
  const charCount = text.length;
  const lineCount = text.split('\n').length;
  
  return charCount > thresholds.characters || 
         (thresholds.lines !== undefined && lineCount > thresholds.lines);
}

/**
 * Count various text metrics
 */
export function getTextMetrics(text: string) {
  const lines = text.split(TEXT_PROCESSING_CONFIG.LINE_BREAK);
  const words = text.trim().split(TEXT_PROCESSING_CONFIG.WORD_SPLIT_PATTERN).filter(word => word.length > 0);
  
  return {
    charCount: text.length,
    lineCount: lines.length,
    wordCount: words.length
  };
}

/**
 * Generate smart preview showing first and last portions of text
 */
export function generateSmartPreview(
  text: string, 
  maxPreviewLength: number = PREVIEW_CONFIG.MAX_LENGTH
): { start: string; end: string } {
  // If text is short enough, just return it as the start
  if (text.length <= maxPreviewLength * 2) {
    return {
      start: text.substring(0, maxPreviewLength),
      end: text.length > maxPreviewLength ? '...' : ''
    };
  }

  const lines = text.split(TEXT_PROCESSING_CONFIG.LINE_BREAK);
  
  // Strategy 1: Try to get meaningful first and last lines
  if (lines.length > 1) {
    const firstLine = lines[0]?.trim() || '';
    const lastLine = lines[lines.length - 1]?.trim() || '';
    
    // If first line is reasonable length, use it
    if (firstLine.length > PREVIEW_CONFIG.MIN_MEANINGFUL_LINE_LENGTH && firstLine.length <= maxPreviewLength) {
      const endPreview = lastLine.length > PREVIEW_CONFIG.MIN_MEANINGFUL_LINE_LENGTH && lastLine.length <= maxPreviewLength 
        ? lastLine 
        : text.substring(text.length - (maxPreviewLength / 2)).trim();
      
      return {
        start: firstLine,
        end: endPreview
      };
    }
  }
  
  // Strategy 2: Use character-based chunking
  const startChunk = text.substring(0, maxPreviewLength).trim();
  const endChunk = text.substring(text.length - maxPreviewLength).trim();
  
  // Try to break at word boundaries
  const startWords = startChunk.split(' ');
  const endWords = endChunk.split(' ');
  
  // Remove partial words at boundaries
  if (startWords.length > 1 && !text.substring(maxPreviewLength, maxPreviewLength + 1).match(/\s/)) {
    startWords.pop(); // Remove last partial word
  }
  
  if (endWords.length > 1 && !text.substring(text.length - maxPreviewLength - 1, text.length - maxPreviewLength).match(/\s/)) {
    endWords.shift(); // Remove first partial word
  }
  
  return {
    start: startWords.join(' '),
    end: endWords.join(' ')
  };
}

/**
 * Process pasted text and return large text data structure
 */
export function processLargeText(
  text: string,
  thresholds: LargeTextThresholds = DEFAULT_LARGE_TEXT_THRESHOLD
): LargeTextData {
  const metrics = getTextMetrics(text);
  const isLarge = isLargeText(text, thresholds);
  const preview = isLarge ? generateSmartPreview(text) : { start: text, end: '' };
  
  return {
    originalText: text,
    charCount: metrics.charCount,
    lineCount: metrics.lineCount,
    wordCount: metrics.wordCount,
    preview,
    isLarge
  };
}

/**
 * Generate display summary text with metrics (unified implementation)
 * @private - Internal function used by public summary functions
 */
function generateSummaryTextInternal(
  charCount: number,
  lineCount: number, 
  wordCount: number,
  displayName: string
): string {
  // Use most relevant metric based on content
  if (lineCount > 10) {
    return `${displayName} (${lineCount} lines, ${charCount.toLocaleString()} characters)`;
  } else if (wordCount > 50) {
    return `${displayName} (${wordCount} words, ${charCount.toLocaleString()} characters)`;
  } else {
    return `${displayName} (${charCount.toLocaleString()} characters)`;
  }
}

/**
 * Generate display summary text for large text data
 */
export function generateSummaryText(data: LargeTextData, displayName?: string): string {
  const { charCount, lineCount, wordCount } = data;
  const prefix = displayName || "Large Text";
  return generateSummaryTextInternal(charCount, lineCount, wordCount, prefix);
}

/**
 * Generate display preview text showing start and end snippets
 */
export function generatePreviewText(data: LargeTextData): string {
  const { start, end } = data.preview;
  
  if (!end || end === '...') {
    return `"${start}..."`;
  }
  
  return `"${start}..."\n"...${end}"`;
}

/**
 * Generate unique ID for large text block using global counter
 */
export function generateLargeTextId(counter: number): string {
  return `input_text_${counter + 1}`;
}

/**
 * Generate display name for large text block
 */
export function generateDisplayName(id: string): string {
  const match = id.match(/input_text_(\d+)/);
  const number = match ? match[1] : '1';
  return `${DISPLAY_CONFIG.DEFAULT_NAME_PREFIX} ${number}`;
}

/**
 * Create a large text block from processed text data
 */
export function createLargeTextBlock(
  textData: LargeTextData,
  pastePosition: number,
  counter: number
): LargeTextBlock {
  const id = generateLargeTextId(counter);
  const displayName = generateDisplayName(id);
  const placeholderChar = getBracketedTextPlaceholder(counter);
  
  return {
    id,
    displayName,
    placeholderChar,
    originalText: textData.originalText,
    charCount: textData.charCount,
    lineCount: textData.lineCount,
    wordCount: textData.wordCount,
    preview: textData.preview,
    pastePosition
  };
}

/**
 * Generate bracketed text placeholder for given counter (0-based)
 */
export function getBracketedTextPlaceholder(counter: number): string {
  return createPlaceholderText(counter + 1);
}

/**
 * Extract number from bracketed text placeholder (reverse of getBracketedTextPlaceholder)
 */
export function extractNumberFromBracketedText(placeholder: string): string {
  const number = extractPlaceholderNumber(placeholder);
  return number.toString();
}

/**
 * Generate placeholder text for input (single character citation style)
 */
export function generatePlaceholderText(block: LargeTextBlock): string {
  return block.placeholderChar;
}

/**
 * Generate full summary text for preview area (with stats)
 */
export function generateBlockSummaryText(block: LargeTextBlock): string {
  const { lineCount, charCount, wordCount, displayName } = block;
  return generateSummaryTextInternal(charCount, lineCount, wordCount, displayName);
}

/**
 * Replace large text placeholders in content with actual text for sending to model
 */
export function replacePlaceholdersWithText(
  content: string,
  largeTextBlocks: LargeTextBlock[]
): string {
  let result = content;
  
  largeTextBlocks.forEach(block => {
    const placeholder = generatePlaceholderText(block);
    result = result.replace(placeholder, block.originalText);
  });
  
  return result;
}

/**
 * Remove a specific large text block from content
 */
export function removeLargeTextBlockFromContent(
  content: string,
  blockToRemove: LargeTextBlock
): string {
  const placeholder = generatePlaceholderText(blockToRemove);
  return content.replace(placeholder, '');
}

/**
 * Create a summary replacement for textarea content
 */
export function createTextAreaSummary(
  originalContent: string,
  largeTextData: LargeTextData,
  pastePosition?: number
): string {
  if (!largeTextData.isLarge) {
    return originalContent;
  }
  
  // If we know the paste position, we can be more precise
  // For now, we'll append the summary to existing content
  const summaryText = generateSummaryText(largeTextData);
  const previewText = generatePreviewText(largeTextData);
  
  // Create a marker that we can use to identify and replace this section
  const marker = `\n${summaryText}\n${previewText}\n`;
  
  return originalContent + marker;
}

/**
 * Generate citation context for prompt optimizer
 */
export function generateCitationContext(largeTextBlocks: LargeTextBlock[]): string {
  if (largeTextBlocks.length === 0) {
    return '';
  }
  
  const symbols = largeTextBlocks.map((_, index) => getBracketedTextPlaceholder(index));
  
  const contextLines = largeTextBlocks.map((block, index) => {
    const number = index + 1;
    return `Block ${number}: ${block.charCount.toLocaleString()} characters, ${block.lineCount} lines`;
  });
  
  return `

PRESERVE THESE SYMBOLS EXACTLY: ${symbols.join(', ')}
(Do not replace with placeholder text - they will expand automatically when prompt is used)

For context only - the referenced blocks contain:
${contextLines.join('\n')}`;
}