import { FC, useState } from 'react';
import { Modal } from '../ReusableComponents/Modal';
import { FileTypeResult } from '@/utils/app/largeText';

/**
 * Modal type configuration
 */
interface ModalTypeConfig {
  type: 'exceeds-limit' | 'ambiguous' | 'very-large';
  title: string;
  message: string;
  options: ModalOption[];
  recommendedOption: 'file' | 'block' | 'plain';
}

/**
 * Modal option configuration
 */
interface ModalOption {
  value: 'file' | 'block' | 'plain';
  label: string;
  description: string;
  disabled?: boolean;
}

/**
 * Props for LargeTextModal
 */
interface LargeTextModalProps {
  text: string;
  detectedType: FileTypeResult;
  textSize: number;
  modelLimit?: number;
  maxChars: number;
  onConfirm: (choice: 'file' | 'block' | 'plain') => void;
  onCancel: () => void;
}

/**
 * Determine modal configuration based on context
 */
function getModalConfig(
  textSize: number,
  modelLimit: number | undefined,
  maxChars: number,
  detectedType: FileTypeResult
): ModalTypeConfig {
  // Type 1: Exceeds model limit (forced file)
  if (modelLimit && textSize > modelLimit) {
    return {
      type: 'exceeds-limit',
      title: 'Text Exceeds Model Limit',
      message: `Your text (${textSize.toLocaleString()} characters) exceeds the selected model's limit (${modelLimit.toLocaleString()} characters). It must be converted to a file attachment.`,
      recommendedOption: 'file',
      options: [
        {
          value: 'file',
          label: `Create file attachment`,
          description: `Will create: pasted-text.${detectedType.extension}`,
        }
      ]
    };
  }

  // Type 2: Ambiguous format (low confidence detection)
  if (detectedType.confidence === 'low') {
    return {
      type: 'ambiguous',
      title: 'Large Text Detected',
      message: `We detected ${textSize.toLocaleString()} characters of text. File attachments work better with LLMs because they can efficiently read and reference the content without cluttering your prompt.`,
      recommendedOption: 'file',
      options: [
        {
          value: 'file',
          label: 'Create file attachment (Recommended)',
          description: `Creates a file attachment you can reference in your prompt. We'll automatically detect the format (JSON, CSV, XML, or plain text) and create the appropriate file type. Keeps your input clean and makes it easy to work with large content.`
        },
        {
          value: 'block',
          label: 'Create text block',
          description: 'Creates a collapsible [TEXT_n] placeholder in your input. You can expand, view, and edit the text block before sending. The full text is included when you send the message.'
        },
        {
          value: 'plain',
          label: 'Paste as plain text',
          description: 'Inserts the entire text directly into your input field. You can edit it freely, but this will make your prompt very long.'
        }
      ]
    };
  }

  // Type 3: Very large (exceeds max chars)
  return {
    type: 'very-large',
    title: 'Very Large Text Detected',
    message: `This text (${textSize.toLocaleString()} characters) is very large. File attachments are strongly recommended—LLMs can efficiently process large files while keeping your prompt clean and readable.`,
    recommendedOption: 'file',
    options: [
      {
        value: 'file',
        label: 'Create file attachment (Recommended)',
        description: `Creates pasted-text.${detectedType.extension} as a file attachment. We automatically detected this as ${detectedType.extension.toUpperCase()} format. The AI can read and reference it without filling your input field. Best for very large content.`
      },
      {
        value: 'block',
        label: 'Create text block anyway',
        description: 'Creates a [TEXT_n] placeholder that you can edit before sending. May cause performance issues with very large text. Consider using file attachment instead.'
      }
    ]
  };
}

/**
 * Format file size for display
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Modal component for large text paste decisions
 */
export const LargeTextModal: FC<LargeTextModalProps> = ({
  text,
  detectedType,
  textSize,
  modelLimit,
  maxChars,
  onConfirm,
  onCancel
}) => {
  const modalConfig = getModalConfig(textSize, modelLimit, maxChars, detectedType);
  const [selectedOption, setSelectedOption] = useState<'file' | 'block' | 'plain'>(
    modalConfig.recommendedOption
  );

  const handleSubmit = () => {
    onConfirm(selectedOption);
  };

  const preview = text.substring(0, 200);
  const hasMore = text.length > 200;

  const modalContent = (
    <div className="space-y-4">
      {/* Alert Message */}
      <div className={`p-3 rounded ${
        modalConfig.type === 'exceeds-limit'
          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
      }`}>
        <p className="text-sm">{modalConfig.message}</p>
      </div>

      {/* Text Preview */}
      <div className="border dark:border-neutral-600 rounded p-3">
        <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
          Preview ({formatSize(textSize)}):
        </div>
        <pre className="text-sm bg-neutral-50 dark:bg-neutral-800 p-2 rounded max-h-32 overflow-y-auto whitespace-pre-wrap break-words">
          {preview}{hasMore && '...'}
        </pre>
      </div>

      {/* Options */}
      <div className="space-y-2">
        <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          How would you like to proceed?
        </div>
        {modalConfig.options.map((option) => (
          <label
            key={option.value}
            className={`flex items-start p-3 border rounded cursor-pointer transition-colors ${
              selectedOption === option.value
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 dark:hover:border-neutral-500'
            } ${option.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input
              type="radio"
              name="largeTextOption"
              value={option.value}
              checked={selectedOption === option.value}
              onChange={() => !option.disabled && setSelectedOption(option.value)}
              disabled={option.disabled}
              className="mt-1 mr-3"
            />
            <div className="flex-1">
              <div className="font-medium text-sm text-neutral-900 dark:text-neutral-100">
                {option.label}
              </div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                {option.description}
              </div>
            </div>
          </label>
        ))}
      </div>

      {/* Detected Format Info */}
      {detectedType.extension !== 'txt' && (
        <div className="text-xs text-neutral-500 dark:text-neutral-400">
          Detected format: <span className="font-medium">{detectedType.extension.toUpperCase()}</span>
          {detectedType.confidence === 'high' && ' (high confidence)'}
        </div>
      )}
    </div>
  );

  return (
    <Modal
      title={modalConfig.title}
      content={modalContent}
      onCancel={onCancel}
      onSubmit={handleSubmit}
      showClose={true}
      showCancel={true}
      showSubmit={true}
      cancelLabel="Cancel"
      submitLabel="Confirm"
      disableSubmit={false}
      width={() => Math.min(700, window.innerWidth * 0.9)}
      height={() => Math.min(600, window.innerHeight * 0.8)}
    />
  );
};
