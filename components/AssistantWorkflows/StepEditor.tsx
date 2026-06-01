import React, { useState, useContext, useEffect } from 'react';
import { Step, StepOutputAttribute } from '@/types/assistantWorkflows';
import { OpDef } from '@/types/op';
import { AgentTool } from '@/types/agentTools';
import { IconPlus, IconTrash, IconChevronDown, IconChevronUp, IconEdit, IconEditOff, IconRobot, IconLoader2, IconSparkles, IconWand, IconPlugConnected } from '@tabler/icons-react';
import Checkbox from '@/components/ReusableComponents/CheckBox';
import { InputsMap } from '@/components/ReusableComponents/InputMap';
import cloneDeep from 'lodash/cloneDeep';
import HomeContext from '@/pages/api/home/home.context';
import { generateSingleStep, AIStepGenerationResult } from '@/utils/workflowAI';
import { toast } from 'react-hot-toast';
import { DefaultModels } from '@/types/model';
import ApiIntegrationsPanel from '@/components/AssistantApi/ApiIntegrationsPanel';

interface StepEditorProps {
  step: Step;
  stepIndex: number;
  onStepChange: (updatedStep: Step) => void;
  availableApis: OpDef[] | null;
  availableAgentTools: Record<string, AgentTool> | null;
  isTerminate?: boolean;
  allowToolSelection?: boolean;
  isNewStep?: boolean; // Flag to indicate if this is a newly created step
  // All steps in the workflow — used to show previous-step output references
  allSteps?: Step[];
  currentStepIndex?: number;
}

const StepEditor: React.FC<StepEditorProps> = ({
  step,
  stepIndex,
  onStepChange,
  availableApis,
  availableAgentTools,
  isTerminate = false,
  allowToolSelection = true,
  isNewStep = false,
  allSteps,
  currentStepIndex
}) => {
  const { state: { chatEndpoint, defaultAccount, statsService }, getDefaultModel } = useContext(HomeContext);
  
  const [hoveredArgIndex, setHoveredArgIndex] = useState<string | null>(null);
  const [hoveredValueIndex, setHoveredValueIndex] = useState<string | null>(null);
  const [confirmDeleteValueKey, setConfirmDeleteValueKey] = useState<string | null>(null);
  const [toolPickerOpen, setToolPickerOpen] = useState(false);
  const [openRefPickerKey, setOpenRefPickerKey] = useState<string | null>(null);
  
  // AI Generation state
  const [useAI, setUseAI] = useState(isNewStep && !isTerminate); // ON by default for new steps
  const [aiDescription, setAiDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAIHint, setShowAIHint] = useState(isNewStep && !isTerminate); // Show hint for new steps
  
  // Track the current step to reset AI state when configuring a different step
  const [currentStepKey, setCurrentStepKey] = useState('');

  // Reset AI state when configuring a different step
  useEffect(() => {
    // Create a unique key for this step configuration (exclude stepName since AI can change it)
    const stepKey = `${stepIndex}-${step.tool || 'no-tool'}`;
    
    if (currentStepKey && currentStepKey !== stepKey) {
      // We're configuring a different step, reset AI state
      setAiDescription('');
      setIsGenerating(false);
      setUseAI(isNewStep && !isTerminate);
      setShowAIHint(isNewStep && !isTerminate);
    }
    
    setCurrentStepKey(stepKey);
  }, [stepIndex, step.tool, isNewStep, isTerminate, currentStepKey]);

  const handleSelectApiTool = (api: OpDef) => {
    const args: Record<string, string> = {};
    if ((api as any).parameters?.properties) {
      Object.entries((api as any).parameters.properties).forEach(([paramName, paramInfo]: [string, any]) => {
        args[paramName] = paramInfo.description ?? 'No description provided';
      });
    }
    const updatedStep = cloneDeep(step);
    updatedStep.tool = api.name;
    updatedStep.args = args;
    onStepChange(updatedStep);
  };

  const handleSelectAgentTool = (tool: any) => {
    const args: Record<string, string> = {};
    if (tool.parameters?.properties) {
      Object.entries(tool.parameters.properties).forEach(([paramName, paramInfo]: [string, any]) => {
        args[paramName] = paramInfo.description ?? 'No description provided';
      });
    }
    const updatedStep = cloneDeep(step);
    updatedStep.tool = tool.name ?? tool.id ?? tool;
    updatedStep.args = args;
    onStepChange(updatedStep);
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
    setConfirmDeleteValueKey(argName);
  };

  const confirmRemoveArgumentValue = () => {
    if (!confirmDeleteValueKey) return;
    const newValues = { ...step.values };
    delete newValues[confirmDeleteValueKey];
    updateStep({ values: newValues });
    setConfirmDeleteValueKey(null);
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

  // Handle AI step generation
  const handleAIGenerate = async () => {
    if (!aiDescription.trim()) {
      toast.error('Please describe your desired step');
      return;
    }

    setIsGenerating(true);
    
    try {
      // Pass only the steps that come BEFORE the current step so the AI knows
      // what {{stepName.fieldName}} references are available to wire in.
      const priorSteps = (allSteps || [])
        .slice(0, currentStepIndex ?? (allSteps?.length ?? 0))
        .filter(s => !!s.stepName && s.outputs && s.outputs.length > 0)
        .map(s => ({ stepName: s.stepName as string, outputs: s.outputs }));

      const result: AIStepGenerationResult = await generateSingleStep(
        aiDescription,
        step.tool || null,
        availableApis,
        availableAgentTools,
        chatEndpoint!,
        getDefaultModel,
        defaultAccount,
        statsService,
        priorSteps
      );

      if (result.success && result.step) {
        // Merge AI-generated step with current step, preserving any existing data
        const mergedStep = {
          ...step,
          ...result.step,
          // Use AI-generated stepName, but preserve user-customized names
          // If stepName is just the tool name, let AI override it
          stepName: (step.stepName && step.stepName !== step.tool && step.stepName !== step.tool?.toLowerCase().replace(/\s+/g, '_')) 
            ? step.stepName 
            : result.step.stepName,
        };
        
        onStepChange(mergedStep);
        toast.success('Step generated successfully! You can edit the fields below.');
        setShowAIHint(false); // Hide hint after successful generation
      } else {
        toast.error(result.error || 'Failed to generate step');
      }
    } catch (error) {
      console.error('AI generation error:', error);
      toast.error('Failed to generate step. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="mb-4">
      {/* AI Generate Section */}
      {!isTerminate && (
        <div className="mb-4">
          {useAI ? (
            // Expanded view - Full AI Generation Section
            <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <IconRobot size={20} className="text-green-600 dark:text-green-400" />
                  <label className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    AI Step Generator
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setUseAI(false)}
                    className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-1"
                    title="Collapse AI Generator"
                  >
                    <IconChevronUp size={16} />
                    Collapse
                  </button>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-800 dark:text-gray-200">
                    Describe your desired step:
                  </label>
                  <textarea
                    value={aiDescription}
                    onChange={(e) => setAiDescription(e.target.value)}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    rows={3}
                    placeholder={`Example: "Send an email notification to the project manager with the analysis results and next steps"`}
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAIGenerate}
                    disabled={isGenerating || !aiDescription.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {isGenerating ? (
                      <>
                        <IconLoader2 size={16} className="animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <IconWand size={16} />
                        Generate Step
                      </>
                    )}
                  </button>
                  
                  {step.tool && (
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      Using tool: <span className="font-medium">{step.tool}</span>
                    </div>
                  )}
                </div>
                
                <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 p-2 rounded">
                  💡 AI will generate the step name, description, instructions, and configure arguments based on your description and the selected tool.
                </div>
              </div>
            </div>
          ) : (
            // Collapsed view - Compact header only
            <button
              onClick={() => setUseAI(true)}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between group"
              title="Expand AI Step Generator"
            >
              <div className="flex items-center gap-2">
                <IconRobot size={18} className="text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Use AI to Generate Step
                </span>
              </div>
              <IconChevronDown size={16} className="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200" />
            </button>
          )}
        </div>
      )}
      
      {/* Step Name */}
      <div className={`mb-4 ${isTerminate ? 'opacity-50' : ''}`}>
        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-neutral-200">
          Step Name <span className="text-red-500">*</span>
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
          Description <span className="text-red-500">*</span>
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
        <div className={`mb-4 ${isTerminate ? 'opacity-50 pointer-events-none' : ''}`}>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-neutral-200">
            Tool <span className="text-red-500">*</span>
          </label>
          <button
            type="button"
            onClick={() => setToolPickerOpen(prev => !prev)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-[#40414F] text-gray-900 dark:text-white text-sm hover:bg-gray-50 dark:hover:bg-[#353540] transition-colors"
          >
            {step.tool ? (
              <span className="font-medium">{step.tool}</span>
            ) : (
              <span className="text-gray-500 dark:text-neutral-400">Select Tool</span>
            )}
            {toolPickerOpen ? <IconChevronUp size={14} className="text-gray-500 dark:text-neutral-400" /> : <IconChevronDown size={14} className="text-gray-500 dark:text-neutral-400" />}
          </button>
          {toolPickerOpen && (
            <div className="mt-2 border-l ml-2 pl-4 border-gray-300 dark:border-neutral-600">
              <ApiIntegrationsPanel
                availableApis={availableApis}
                availableAgentTools={availableAgentTools}
                onClickApiItem={(api) => { handleSelectApiTool(api); setToolPickerOpen(false); }}
                onClickAgentTool={(tool) => { handleSelectAgentTool(tool); setToolPickerOpen(false); }}
                allowCreatePythonFunction={false}
                allowConfiguration={false}
                compactDisplay={false}
              />
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-neutral-200">
          Instructions <span className="text-red-500">*</span>
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
      <div className="mb-4 dark:text-white" title="Uses a more advanced model for this step">
        <Checkbox
          id={`advanced-reasoning-${stepIndex}`}
          label="Use Advanced Reasoning"
          checked={step.useAdvancedReasoning || false}
          onChange={(checked) => updateStep({ useAdvancedReasoning: checked })}
        />
      </div>

      {/* Skip Control */}
      {!isTerminate && (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-neutral-200">
            Skip Behaviour
          </label>
          <select
            value={
              step.allowSkip === false ? 'never' :
              step.allowSkip === true  ? 'always' :
              'default'
            }
            onChange={(e) => {
              const v = e.target.value;
              updateStep({
                allowSkip: v === 'never' ? false : v === 'always' ? true : undefined
              });
            }}
            className="w-full p-2 border border-gray-300 rounded-lg bg-white dark:bg-[#40414F] dark:border-neutral-600 text-gray-900 dark:text-white text-sm"
          >
            <option value="default">Default — AI decides whether to skip</option>
            <option value="never">Never skip — always execute this step</option>
            <option value="always">Always allow skip — AI may freely skip</option>
          </select>
        </div>
      )}

      {/* Auto-Repeat Step */}
      {!isTerminate && (
        <div className="mb-4 dark:text-white">
          <Checkbox
            id={`allow-repeat-${stepIndex}`}
            label="Auto-Repeat Step"
            checked={step.allowRepeat || false}
            onChange={(checked) => updateStep({ allowRepeat: checked, maxRepeats: checked ? (step.maxRepeats ?? 1) : undefined })}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 ml-6">
            Re-run this step after each success (polling, pagination, batching). Stops when the tool returns <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">{"done: true"}</code> or <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">{"has_more: false"}</code>, or when max repeats is reached.
          </p>
          {step.allowRepeat && (
            <div className="mt-2 ml-6 flex items-center gap-2">
              <label className="text-xs text-gray-500 dark:text-gray-400">How many extra times to repeat</label>
              <input
                type="number"
                min={1}
                max={10}
                value={step.maxRepeats ?? 1}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  updateStep({ maxRepeats: isNaN(v) ? 1 : Math.min(10, Math.max(1, v)) });
                }}
                className="w-16 px-2 py-0.5 border border-gray-300 rounded bg-white dark:bg-[#40414F] dark:border-neutral-600 text-gray-900 dark:text-white text-sm"
              />
            </div>
          )}
        </div>
      )}

      {/* Output Attributes */}
      {!isTerminate && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <div>
              <label className="block text-sm font-medium dark:text-neutral-200">
                Output Attributes
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Declare what this step produces. Later steps can reference outputs via{' '}
                <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">{'{{'}stepName.attributeName{'}}'}</code>
              </p>
            </div>
            <button
              onClick={() => {
                const newOutput: StepOutputAttribute = { name: '', type: 'string' };
                updateStep({ outputs: [...(step.outputs || []), newOutput] });
              }}
              className="flex items-center px-2 py-1 rounded text-sm bg-blue-600 text-white hover:bg-blue-700"
            >
              <IconPlus size={14} className="mr-1" />
              Add Output
            </button>
          </div>
          {(!step.outputs || step.outputs.length === 0) ? (
            <div className="text-neutral-500 dark:text-neutral-400 text-sm">No outputs declared</div>
          ) : (
            step.outputs.map((output, outIdx) => (
              <div key={outIdx} className="mb-2 grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
                <input
                  type="text"
                  value={output.name}
                  placeholder="Attribute name"
                  onChange={(e) => {
                    const updated = [...(step.outputs || [])];
                    updated[outIdx] = { ...updated[outIdx], name: e.target.value };
                    updateStep({ outputs: updated });
                  }}
                  className="p-2 border border-gray-300 rounded-lg bg-white dark:bg-[#40414F] dark:border-neutral-600 text-gray-900 dark:text-white text-sm"
                />
                <select
                  value={output.type}
                  onChange={(e) => {
                    const updated = [...(step.outputs || [])];
                    updated[outIdx] = { ...updated[outIdx], type: e.target.value as StepOutputAttribute['type'] };
                    updateStep({ outputs: updated });
                  }}
                  className="p-2 border border-gray-300 rounded-lg bg-white dark:bg-[#40414F] dark:border-neutral-600 text-gray-900 dark:text-white text-sm"
                >
                  <option value="string">string</option>
                  <option value="number">number</option>
                  <option value="boolean">boolean</option>
                  <option value="object">object</option>
                  <option value="array">array</option>
                </select>
                <input
                  type="text"
                  value={output.description || ''}
                  placeholder="Description (optional)"
                  onChange={(e) => {
                    const updated = [...(step.outputs || [])];
                    updated[outIdx] = { ...updated[outIdx], description: e.target.value || undefined };
                    updateStep({ outputs: updated });
                  }}
                  className="p-2 border border-gray-300 rounded-lg bg-white dark:bg-[#40414F] dark:border-neutral-600 text-gray-900 dark:text-white text-sm"
                />
                <button
                  onClick={() => {
                    const updated = (step.outputs || []).filter((_, i) => i !== outIdx);
                    updateStep({ outputs: updated });
                  }}
                  className="p-1 text-red-600 dark:text-red-400 hover:opacity-60 rounded"
                >
                  <IconTrash size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      )}

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
      {/* Build structured references from prior steps that have declared outputs ONLY */}
      {(() => {
        const idx = currentStepIndex ?? stepIndex;
        const priorSteps = (allSteps ?? []).slice(0, idx);
        // stepGroups: only steps with declared outputs
        const stepGroups: { stepName: string; stepLabel: string; stepNum: number; outputs: { name: string; type: string; description?: string; refValue: string }[] }[] = [];
        priorSteps.forEach((ps, i) => {
          if (ps.outputs && ps.outputs.length > 0) {
            const sName = ps.stepName || ps.tool || `step_${i + 1}`;
            stepGroups.push({
              stepName: sName,
              stepLabel: ps.stepName || ps.tool || `Step ${i + 1}`,
              stepNum: i + 1,
              outputs: ps.outputs
                .filter(o => o.name)
                .map(o => ({ name: o.name, type: o.type || 'string', description: o.description, refValue: `{{${sName}.${o.name}}}` }))
            });
          }
        });
        const hasRefs = stepGroups.length > 0;

        return (
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <div>
            <label className="block text-sm font-medium dark:text-neutral-200">
              Argument Values
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Set a fixed value for a parameter — overrides AI.{hasRefs && <span className="ml-1 text-blue-500 dark:text-blue-400">Step outputs from previous steps are available to wire in.</span>}
            </p>
          </div>
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

                      {/* Value label */}
                      <label
                        className="border border-gray-400 dark:border-[#40414F] p-2 rounded-l text-[0.9rem] whitespace-nowrap text-center bg-gray-100 dark:bg-[#40414F] text-gray-700 dark:text-neutral-200"
                      >
                        Value
                      </label>
                      {/* Value input + reference picker inline on right */}
                      <div className="w-full rounded-r border border-gray-500 dark:border-neutral-800 flex items-center bg-white dark:bg-[#40414F] shadow overflow-visible">
                        <input
                          className="flex-1 border-0 px-4 py-1.5 bg-transparent text-gray-900 dark:text-neutral-100 focus:outline-none min-w-0"
                          placeholder="Value content"
                          value={value}
                          onChange={(e) => {
                            const newValues = { ...step.values };
                            newValues[key] = e.target.value;
                            updateStep({ values: newValues });
                          }}
                        />
                        {/* Reference picker — sits on the right when prior steps have declared outputs */}
                        {hasRefs && (
                          <div className="relative flex-shrink-0 border-l border-gray-200 dark:border-neutral-600">
                            <button
                              type="button"
                              onClick={() => setOpenRefPickerKey(openRefPickerKey === `${stepIndex}-${valueIndex}` ? null : `${stepIndex}-${valueIndex}`)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-blue-600 dark:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors whitespace-nowrap"
                            >
                              <IconPlugConnected size={14} />
                              Reference output from previous step
                              <IconChevronDown size={11} className={`transition-transform ${openRefPickerKey === `${stepIndex}-${valueIndex}` ? 'rotate-180' : ''}`} />
                            </button>
                            {openRefPickerKey === `${stepIndex}-${valueIndex}` && (
                              <div className="absolute right-0 top-full z-50 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                                {stepGroups.map(group => (
                                  <div key={group.stepName}>
                                    <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700/60 border-b border-gray-100 dark:border-gray-600">
                                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Step {group.stepNum} — {group.stepLabel}</span>
                                    </div>
                                    {group.outputs.map(out => (
                                      <button
                                        key={out.refValue}
                                        type="button"
                                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left border-b border-gray-50 dark:border-gray-700/40 last:border-0"
                                        onClick={() => {
                                          const newValues = { ...step.values };
                                          newValues[key] = out.refValue;
                                          updateStep({ values: newValues });
                                          setOpenRefPickerKey(null);
                                        }}
                                      >
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm font-medium text-gray-900 dark:text-white">{out.name}</div>
                                          {out.description && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{out.description}</div>}
                                        </div>
                                        <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-mono">{out.type}</span>
                                      </button>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-[28px] flex items-center">
                  {hoveredValueIndex === `${stepIndex}-${valueIndex}` && (
                    <button
                      onClick={() => setConfirmDeleteValueKey(key)}
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
        );
      })()}

      {confirmDeleteValueKey && (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 p-6 max-w-sm w-full mx-4">
            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Delete Value</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
              Are you sure you want to delete the value for <span className="font-medium text-gray-900 dark:text-white">&ldquo;{confirmDeleteValueKey}&rdquo;</span>? This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDeleteValueKey(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemoveArgumentValue}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StepEditor;