import React from 'react';
import { IconAsterisk, IconMinus, IconRobot, IconUserCog, IconSettings } from '@tabler/icons-react';
import { OpBindingMode } from '@/types/op';
import { ToggleOptionButtons } from '../ReusableComponents/ToggleOptionButtons';

interface ParameterBindingEditorProps {
  paramSource: any; // Schema with properties and required array
  paramModes: Record<string, OpBindingMode>;
  paramValues: Record<string, string>;
  onParamModeChange: (param: string, mode: OpBindingMode) => void;
  onParamValueChange: (param: string, value: string) => void;
}

// Use the same formatting function as OperationSelector
const formatOperationName = (name: string): string => {
  // First split by underscores and capitalize first letter of each part
  const underscoreSplit = name.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');

  // Then add spaces before uppercase characters (for camelCase/PascalCase)
  return underscoreSplit.replace(/([A-Z])/g, ' $1').trim()
      // Remove any extra spaces that might have been created
      .replace(/\s+/g, ' ');
};

export const ApiParameterBindingEditor: React.FC<ParameterBindingEditorProps> = ({
  paramSource,
  paramModes,
  paramValues,
  onParamModeChange,
  onParamValueChange
}) => {
  if (!paramSource?.properties || Object.keys(paramSource.properties).length === 0) {
    return (
      <div className="text-center py-2 text-gray-500 dark:text-gray-400 text-sm">
        No parameters to configure
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 flex items-center mb-3">
        <IconSettings size={16} stroke={1.5} className="mr-1" />
        Parameters
      </h3>

      {Object.entries(paramSource.properties).map(([paramName, paramInfo]: [string, any]) => (
        <div key={paramName} className="bg-gray-50 dark:bg-[#40414F] rounded-lg p-4 border border-gray-300 dark:border-neutral-600">
          <label className="flex items-center justify-between font-medium text-sm text-gray-900 dark:text-white mb-2">
            <div className="flex items-center">
              {paramSource.required?.includes(paramName) ? (
                <IconAsterisk size={16} stroke={1.5} className="text-red-500 mr-2" />
              ) : (
                <IconMinus size={14} stroke={1.5} className="text-green-500 mr-2" />
              )}
              {formatOperationName(paramName)}
            </div>
            {paramInfo.type && (
              <span className="text-xs font-normal py-1 px-2 bg-gray-200 dark:bg-gray-700 rounded-full text-gray-700 dark:text-gray-300">
                {paramInfo.type}
              </span>
            )}
          </label>

          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center bg-white dark:bg-[#343541] border border-gray-300 dark:border-neutral-600 rounded-md overflow-hidden">
              <ToggleOptionButtons
                activeColor={"text-blue-700 dark:text-blue-300"}
                options={[
                  { 
                    id: 'ai', 
                    name: 'AI',
                    title: "Let AI generate the parameter value. Add hints to influence the assigned parameter value (optional).",
                    icon: IconRobot
                  },
                  { 
                    id: 'manual', 
                    name: 'Manual',
                    title: 'Manually specify the parameter value',
                    icon: IconUserCog
                  }
                ]}
                selected={paramModes[paramName] || 'ai'}
                onToggle={(mode) => onParamModeChange(paramName, mode as OpBindingMode)}
              />
            </div>
            <input
              type="text"
              value={paramValues[paramName] || ''}
              onChange={(e) => onParamValueChange(paramName, e.target.value)}
              placeholder={paramModes[paramName] === 'manual' ? 
                          `Enter ${formatOperationName(paramName)} value...` : 
                          'AI value generation hints (optional)'}
              className="flex-1 px-3 py-2 border rounded-md bg-white dark:bg-[#343541] border-gray-300 dark:border-neutral-600
                        text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500
                        focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-shadow duration-150"
            />
          </div>

          {paramInfo.description && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">
              {paramInfo.description}
            </p>
          )}
        </div>
      ))}
    </div>
  );
};

export default ApiParameterBindingEditor; 