import React from 'react';
import { IconMessage, IconRocket, IconSparkles } from '@tabler/icons-react';

// HFU-tailored defaults — covers the three most common campus use cases:
// study support, Canvas/course logistics, and written communication.
const DEFAULT_SUGGESTIONS = [
  'Make flashcards for me from this paper',
  'What assignments are due this week?',
  'Draft a reply to this student email',
];

const DEFAULT_ICON = <IconMessage size={64} />;

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  suggestions?: string[];
  onSuggestionClick?: (suggestion: string) => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'Welcome to Amplify',
  description = "I'm your campus AI assistant. I can help with research, Canvas courses, drafting, and analysis. Try a suggestion below or type your own question.",
  icon = DEFAULT_ICON,
  action,
  suggestions = DEFAULT_SUGGESTIONS,
  onSuggestionClick,
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-8 animate-fade-in">
      <div className="text-gray-300 dark:text-gray-600 mb-6">
        {icon}
      </div>
      
      <h3 className="text-2xl font-semibold mb-2 text-gray-800 dark:text-gray-200">
        {title}
      </h3>
      
      <p className="text-gray-600 dark:text-gray-400 mb-8 text-center max-w-md">
        {description}
      </p>

      {suggestions.length > 0 && (
        <div className="w-full max-w-2xl mb-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center flex items-center justify-center gap-2">
            <IconSparkles size={16} />
            Try one of these suggestions
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => onSuggestionClick?.(suggestion)}
                className="text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 
                         hover:border-blue-400 dark:hover:border-blue-600 hover:bg-gray-50 
                         dark:hover:bg-gray-800 transition-all duration-200 group"
              >
                <p className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-blue-600 
                            dark:group-hover:text-blue-400 transition-colors">
                  {suggestion}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg 
                   hover:bg-blue-700 transition-colors duration-200"
        >
          <IconRocket size={20} />
          {action.label}
        </button>
      )}
    </div>
  );
};