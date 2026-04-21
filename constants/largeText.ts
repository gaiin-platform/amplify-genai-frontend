/**
 * Constants and configuration for large text functionality
 */

/**
 * Thresholds that determine when text is considered "large"
 */
export const LARGE_TEXT_THRESHOLDS = {
  /** Character count threshold */
  CHARACTERS: 500,
  /** Line count threshold */
  LINES: 20,
} as const;

/**
 * Configuration for text preview generation
 */
export const PREVIEW_CONFIG = {
  /** Maximum length for preview snippets */
  MAX_LENGTH: 100,
  /** Minimum line length to be considered meaningful */
  MIN_MEANINGFUL_LINE_LENGTH: 10,
  /** Maximum preview length for start/end chunks */
  MAX_PREVIEW_LENGTH: 100,
} as const;

/**
 * Placeholder format configuration
 */
export const PLACEHOLDER_CONFIG = {
  /** Prefix for bracketed text placeholders */
  PREFIX: '[TEXT_',
  /** Suffix for bracketed text placeholders */
  SUFFIX: ']',
  /** Format string for generating placeholders */
  FORMAT: '[TEXT_{number}]',
} as const;

/**
 * Display configuration for text blocks
 */
export const DISPLAY_CONFIG = {
  /** Default display name prefix */
  DEFAULT_NAME_PREFIX: 'Input Text',
  /** Maximum filename length before truncation */
  MAX_FILENAME_LENGTH: 12,
  /** Maximum assistant name length before truncation */
  MAX_ASSISTANT_NAME_LENGTH: 30,
  /** Maximum attachment display width */
  MAX_ATTACHMENT_WIDTH: '220px',
  /** Minimum attachment display width */
  MIN_ATTACHMENT_WIDTH: '160px',
} as const;

/**
 * Text processing configuration
 */
export const TEXT_PROCESSING_CONFIG = {
  /** Word splitting regex pattern */
  WORD_SPLIT_PATTERN: /\s+/,
  /** Placeholder extraction regex pattern */
  PLACEHOLDER_REGEX: /\[TEXT_(\d+)\]/,
  /** Line break character */
  LINE_BREAK: '\n',
} as const;

/**
 * UI interaction configuration
 */
export const UI_CONFIG = {
  /** Textarea maximum height in pixels */
  TEXTAREA_MAX_HEIGHT: 400,
  /** Cursor position update delay in milliseconds */
  CURSOR_UPDATE_DELAY: 0,
  /** Assistant attachment max width in pixels */
  ASSISTANT_MAX_WIDTH: 300,
} as const;

/**
 * Helper function to generate placeholder text
 */
export function createPlaceholderText(number: number): string {
  return `${PLACEHOLDER_CONFIG.PREFIX}${number}${PLACEHOLDER_CONFIG.SUFFIX}`;
}

/**
 * Helper function to extract number from placeholder text
 */
export function extractPlaceholderNumber(placeholder: string): number {
  const match = placeholder.match(TEXT_PROCESSING_CONFIG.PLACEHOLDER_REGEX);
  return match ? parseInt(match[1], 10) : 1;
}

/**
 * Default threshold configuration for backward compatibility
 */
export const DEFAULT_LARGE_TEXT_THRESHOLD = {
  characters: LARGE_TEXT_THRESHOLDS.CHARACTERS,
  lines: LARGE_TEXT_THRESHOLDS.LINES,
} as const;