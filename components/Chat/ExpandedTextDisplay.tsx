import React from 'react';

interface ExpandedTextDisplayProps {
  text: string;
  className?: string;
}

/**
 * Shared component for displaying expanded text content consistently
 * Used by LargeTextDisplay for both input preview and chat history
 */
export const ExpandedTextDisplay: React.FC<ExpandedTextDisplayProps> = ({
  text,
  className = ""
}) => {
  return (
    <div className={`mt-2 ${className}`}>
      <div className="max-h-64 overflow-y-auto p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-sm overflow-x-hidden expanded-text-container">
        <pre className="whitespace-pre-wrap text-gray-900 dark:text-gray-100 font-mono break-words overflow-wrap-anywhere expanded-text-content">
          {text}
        </pre>
      </div>
    </div>
  );
};