import React, { useState, useMemo } from 'react';
import { Step } from '@/types/assistantWorkflows';
import { OpDef, Schema } from '@/types/op';
import { AgentTool } from '@/types/agentTools';
import { emptySchema } from '@/utils/app/tools';
import { IconPlus, IconTrash, IconChevronDown, IconChevronUp, IconEdit, IconEditOff } from '@tabler/icons-react';
import Checkbox from '@/components/ReusableComponents/CheckBox';
import { InputsMap } from '@/components/ReusableComponents/InputMap';
import { ToolPickerModal, ToolItem } from './ToolPickerModal';
import { getOperationIcon } from '@/types/integrations';
import cloneDeep from 'lodash/cloneDeep';

interface StepEditorProps {
  step: Step;
  stepIndex: number;
  onStepChange: (updatedStep: Step) => void;
  availableApis: OpDef[] | null;
  availableAgentTools: Record<string, AgentTool> | null;
  isTerminate?: boolean;
  allowToolSelection?: boolean;
}

const StepEditor: React.FC<StepEditorProps> = ({
  step,
  stepIndex,
  onStepChange,
  availableApis,
  availableAgentTools,
  isTerminate = false,
  allowToolSelection = true
}) => {
  const [showToolSelector, setShowToolSelector] = useState(false);
  const [hoveredArgIndex, setHoveredArgIndex] = useState<string | null>(null);
  const [hoveredValueIndex, setHoveredValueIndex] = useState<string | null>(null);

  // Create ToolItems from available APIs and agent tools
  const toolItems = useMemo(() => {
    const items: ToolItem[] = [];
    const seenTools = new Set<string>();
    
    // Add available APIs
    if (availableApis) {
      availableApis.forEach(api => {
        if (!seenTools.has(api.name)) {
          seenTools.add(api.name);
          const IconComponent = getOperationIcon(api.name);
          items.push({
            id: api.name,
            name: api.name,
            description: api.description || 'No description available',
            icon: <IconComponent size={16} />,
            category: api.category || 'Custom APIs',
            tags: api.tags || [],
            parameters: api.parameters,
            type: 'api',
            originalTool: api
          });
        }
      });
    }
    
    // Add agent tools
    if (availableAgentTools) {
      Object.entries(availableAgentTools).forEach(([toolName, agentTool]) => {
        if (!seenTools.has(toolName)) {
          seenTools.add(toolName);
          const IconComponent = getOperationIcon(toolName);
          items.push({
            id: toolName,
            name: toolName,
            description: agentTool.description || 'No description available',
            icon: <IconComponent size={16} />,
            category: 'Agent Tools',
            tags: agentTool.tags || [],
            parameters: agentTool.parameters || emptySchema,
            type: 'agent',
            originalTool: agentTool
          });
        }
      });
    }
    
    return items;
  }, [availableApis, availableAgentTools]);

  const handleSelectTool = (toolItem: ToolItem) => {
    const args: Record<string, string> = {};
    if (toolItem.parameters?.properties) {
      Object.entries(toolItem.parameters.properties).forEach(([paramName, paramInfo]: [string, any]) => {
        args[paramName] = paramInfo.description ?? "No description provided";
      });
    }
    
    const updatedStep = cloneDeep(step);
    updatedStep.tool = toolItem.name;
    updatedStep.args = args;
    
    onStepChange(updatedStep);
    setShowToolSelector(false);
  };

  const updateStep = (updates: Partial<Step>) => {
    const updatedStep = { ...step, ...updates };
    onStepChange(updatedStep);
  };

  const addArgumentValue = () => {
    const stepArgs = step.args || {};
    const stepValues = step.values || {};
    const availableArgs = Object.keys(stepArgs);
    const usedArgs = Object.keys(stepValues);
    const unusedArgs = availableArgs.filter(arg => !usedArgs.includes(arg));
    const firstAvailableArg = unusedArgs[0];
    
    if (firstAvailableArg) {
      const updatedValues = { 
        ...stepValues, 
        [firstAvailableArg]: '' 
      };
      
      updateStep({
        values: updatedValues
      });
    }
  };

  const removeArgumentValue = (argName: string) => {
    const newValues = { ...step.values };
    delete newValues[argName];
    updateStep({ values: newValues });
  };

  const removeArgument = (argName: string) => {
    const newArgs = { ...step.args };
    delete newArgs[argName];
    updateStep({ args: newArgs });
  };

  const toggleEditableArg = (argName: string) => {
    const editableArgs = step.editableArgs || [];
    if (editableArgs.includes(argName)) {
      updateStep({
        editableArgs: editableArgs.filter(arg => arg !== argName)
      });
    } else {
      updateStep({
        editableArgs: [...editableArgs, argName]
      });
    }
  };

  return (
    <div className="mb-4">
      {/* Step Name */}
      <div className={`mb-4 ${isTerminate ? 'opacity-50' : ''}`}>
        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-neutral-200">
          Step Name
        </label>
        <input
          disabled={isTerminate}
          type="text"
          value={step.stepName || ''}
          onChange={(e) => updateStep({ stepName: e.target.value })}
          className="w-full p-2 border border-gray-300 rounded-lg bg-white dark:bg-[#40414F] dark:border-neutral-600 text-gray-900 dark:text-white"
          placeholder="Name for this step (used for references)"
        />
      </div>

      {/* Description */}
      <div className={`mb-4 ${isTerminate ? 'opacity-50' : ''}`}>
        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-neutral-200">
          Description
        </label>
        <input
          type="text"
          value={step.description}
          onChange={(e) => updateStep({ description: e.target.value })}
          className="w-full p-2 border border-gray-300 rounded-lg bg-white dark:bg-[#40414F] dark:border-neutral-600 text-gray-900 dark:text-white"
          placeholder="What this step does"
          disabled={isTerminate}
        />
      </div>

      {/* Tool */}
      {allowToolSelection && (
        <div className={`mb-4 ${isTerminate ? 'opacity-50' : ''}`}>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-neutral-200">
            Tool
          </label>
          <button
            disabled={isTerminate}
            type="button"
            className={`w-full p-2 border border-gray-300 text-left rounded-lg bg-white dark:bg-[#40414F] dark:border-neutral-600 text-gray-900 dark:text-white ${isTerminate ? "" : "hover:bg-gray-50 dark:hover:bg-[#4a4b59] transition-colors"}`}
            onClick={() => setShowToolSelector(true)}
          >
            {step.tool || "Select a tool"}
          </button>
        </div>
      )}

      {/* Instructions */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-neutral-200">
          Instructions
        </label>
        <textarea
          value={step.instructions}
          onChange={(e) => updateStep({ instructions: e.target.value })}
          className="w-full p-2 border border-gray-300 rounded-lg bg-white dark:bg-[#40414F] dark:border-neutral-600 text-gray-900 dark:text-white"
          rows={4}
          placeholder="Instructions for this step"
        />
      </div>

      {/* Action Segment */}
      <div className={`mb-4 ${isTerminate ? 'opacity-40' : ''}`}>
        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-neutral-200">
          Action Segment
        </label>
        <input
          type="text"
          value={step.actionSegment ?? ''}
          onChange={(e) => updateStep({ actionSegment: e.target.value || undefined })}
          className="w-full p-2 border border-gray-300 rounded-lg bg-white dark:bg-[#40414F] dark:border-neutral-600 text-gray-900 dark:text-white"
          placeholder="Group related steps"
          disabled={isTerminate}
        />
      </div>

      {/* Use Advanced Reasoning */}
      <div className="mb-4" title="Uses a more advanced model for this step">
        <Checkbox
          id={`advanced-reasoning-${stepIndex}`}
          label="Use Advanced Reasoning"
          checked={step.useAdvancedReasoning || false}
          onChange={(checked) => updateStep({ useAdvancedReasoning: checked })}
        />
      </div>

      {/* Argument Instructions */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium dark:text-neutral-200">
            Argument Instructions
          </label>
        </div>
        {Object.keys(step.args || {}).length === 0 ? (
          <div className="text-neutral-500 dark:text-neutral-400">
            No Arguments
          </div>
        ) : (
          Object.entries(step.args)
            .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
            .map(([key, value], argIndex) => (
              <div 
                key={argIndex} 
                className="w-full flex mb-2 last:mb-0"
                onMouseEnter={() => setHoveredArgIndex(`${stepIndex}-${argIndex}`)}
                onMouseLeave={() => setHoveredArgIndex(null)}
              >
                <div className="flex-grow">
                  <InputsMap
                    id={`arg-${stepIndex}-${argIndex}`}
                    inputs={[
                      {label: 'Argument', key: 'key', disabled: true},
                      {label: 'Instructions', key: 'value'}
                    ]}
                    state={{key, value}}
                    inputChanged={(changedKey, changedValue) => {
                      if (changedKey === 'value') {
                        const newArgs = { ...step.args };
                        newArgs[key] = changedValue;
                        updateStep({ args: newArgs });
                      }
                    }}
                  />
                </div>
                
                {!isTerminate && (
                  <div className="w-[28px] mt-1 flex items-center">
                    {hoveredArgIndex === `${stepIndex}-${argIndex}` && (
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => removeArgument(key)}
                          className="p-1 text-red-600 dark:text-red-400 hover:opacity-60 rounded flex-shrink-0"
                        >
                          <IconTrash size={20} />
                        </button>

                        <button
                          onClick={() => toggleEditableArg(key)}
                          className="p-1 text-neutral-900 dark:text-neutral-100 hover:opacity-80 rounded flex-shrink-0 mr-1"
                          title={`${(step.editableArgs || []).includes(key) ? "Users will be able to edit this argument's instructions.\nClick to mark as non-editable" : 'Users will not be able to edit this argument.\nClick to mark as editable'}`}
                        >
                          {(step.editableArgs || []).includes(key) ? (
                            <IconEdit size={20} />
                          ) : (
                            <IconEditOff size={20} className="opacity-60" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
        )}
      </div>

      {/* Argument Values */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium dark:text-neutral-200">
            Argument Values - Set fixed values for specific parameters (overrides AI decision-making)
          </label>
          <div className="flex flex-col items-end">
            <button
              onClick={addArgumentValue}
              className={`flex items-center px-2 py-1 rounded text-sm ${
                Object.keys(step.args || {}).filter(argKey => 
                  !Object.keys(step.values || {}).includes(argKey)
                ).length === 0
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
              disabled={Object.keys(step.args || {}).filter(argKey => 
                !Object.keys(step.values || {}).includes(argKey)
              ).length === 0}
              title={Object.keys(step.args || {}).filter(argKey => 
                !Object.keys(step.values || {}).includes(argKey)
              ).length === 0 ? 'No arguments available to add values for' : 'Add a value for an available argument'}
            >
              <IconPlus size={14} className="mr-1" />
              Add Value
            </button>
          </div>
        </div>
        {Object.keys(step.values || {}).length === 0 ? (
          <div className="text-neutral-500 dark:text-neutral-400">
            No values set
          </div>
        ) : (
          Object.entries(step.values || {})
            .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
            .map(([key, value], valueIndex) => (
              <div 
                key={valueIndex} 
                className="flex mb-2 last:mb-0"
                onMouseEnter={() => setHoveredValueIndex(`${stepIndex}-${valueIndex}`)}
                onMouseLeave={() => setHoveredValueIndex(null)}
              >
                <div className="flex-grow">
                  {/* Custom layout matching InputsMap styling */}
                  <div className="mt-2 grid grid-cols-1">
                    <div className="grid grid-cols-[auto_1fr] mr-2">
                      {/* Argument Dropdown */}
                      <label
                        className="border border-gray-400 dark:border-[#40414F] p-2 rounded-l text-[0.9rem] whitespace-nowrap text-center bg-gray-100 dark:bg-[#40414F] text-gray-700 dark:text-neutral-200"
                        title="Select argument from available parameters"
                      >
                        Argument
                      </label>
                      <div className="w-full rounded-r border border-gray-500 dark:border-neutral-800 flex items-center bg-white dark:bg-[#40414F] text-gray-900 dark:text-neutral-100 shadow focus:outline-none">
                        <select
                          className="w-full border-0 px-4 py-1 bg-white dark:bg-[#40414F] text-gray-900 dark:text-neutral-100 focus:outline-none"
                          value={key}
                          onChange={(e) => {
                            const newKey = e.target.value;
                            if (newKey && newKey !== key) {
                              const newValues = { ...step.values };
                              delete newValues[key];
                              newValues[newKey] = value;
                              updateStep({ values: newValues });
                            }
                          }}
                        >
                          <option value={key}>{key}</option>
                          {/* Show available arguments that aren't already used */}
                          {Object.keys(step.args || {}).filter(argKey => 
                            argKey !== key && !Object.keys(step.values || {}).includes(argKey)
                          ).map(argKey => (
                            <option key={argKey} value={argKey}>{argKey}</option>
                          ))}
                        </select>
                      </div>
                      
                      {/* Value Input */}
                      <label
                        className="border border-gray-400 dark:border-[#40414F] p-2 rounded-l text-[0.9rem] whitespace-nowrap text-center bg-gray-100 dark:bg-[#40414F] text-gray-700 dark:text-neutral-200"
                      >
                        Value
                      </label>
                      <div className="w-full rounded-r border border-gray-500 dark:border-neutral-800 flex items-center bg-white dark:bg-[#40414F] text-gray-900 dark:text-neutral-100 shadow focus:outline-none">
                        <input
                          className="w-full border-0 px-4 py-1 bg-white dark:bg-[#40414F] text-gray-900 dark:text-neutral-100 focus:outline-none"
                          placeholder="Value content"
                          value={value}
                          onChange={(e) => {
                            const newValues = { ...step.values };
                            newValues[key] = e.target.value;
                            updateStep({ values: newValues });
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="w-[28px] flex items-center">
                  {hoveredValueIndex === `${stepIndex}-${valueIndex}` && (
                    <button
                      onClick={() => removeArgumentValue(key)}
                      className="p-1 text-red-600 dark:text-red-400 hover:opacity-60 rounded flex-shrink-0"
                    >
                      <IconTrash size={18} />
                    </button>
                  )}
                </div>
              </div>
            ))
        )}
      </div>

      {/* Tool Picker Modal */}
      <ToolPickerModal
        isOpen={showToolSelector}
        onClose={() => setShowToolSelector(false)}
        onSelect={handleSelectTool}
        tools={toolItems}
        title="Select Tool for Step"
        showAdvancedFiltering={false}
        showClearSearch={false}
      />
    </div>
  );
};

export default StepEditor;