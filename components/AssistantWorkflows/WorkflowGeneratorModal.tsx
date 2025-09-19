import React, { useState, useContext, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { IconLoader2, IconRobot, IconChevronDown, IconChevronUp, IconX, IconTools, IconCheck } from '@tabler/icons-react';
import { AstWorkflow } from '@/types/assistantWorkflows';
import { OpDef } from '@/types/op';
import HomeContext from '@/pages/api/home/home.context';
import { ToolSelectorModal, ToolItem } from './ToolSelectorModal';
import { promptForData } from '@/utils/app/llm';
import { Message, newMessage } from '@/types/chat';
import { DefaultModels } from '@/types/model';
import { AssistantWorkflow } from './AssistantWorkflow';
import { fixJsonString } from '@/utils/app/errorHandling';
import { createAllToolItems, TOOL_ITEM_PRESETS } from '@/utils/toolItemFactory';

interface WorkflowGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (workflow: AstWorkflow) => void;
  availableApis: OpDef[] | null;
  availableAgentTools: Record<string, any> | null;
}

const WorkflowGeneratorModal: React.FC<WorkflowGeneratorModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
  availableApis,
  availableAgentTools
}) => {
  const { state: { lightMode, chatEndpoint, defaultAccount, statsService }, getDefaultModel } = useContext(HomeContext);
  
  const [description, setDescription] = useState('');
  const [selectedTools, setSelectedTools] = useState<ToolItem[]>([]);
  const [showToolPicker, setShowToolPicker] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedWorkflow, setGeneratedWorkflow] = useState<AstWorkflow | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create tool items from available APIs and agent tools
  const toolItems = useMemo(() => {
    return createAllToolItems(availableApis, availableAgentTools, TOOL_ITEM_PRESETS.WORKFLOW_GENERATOR);
  }, [availableApis, availableAgentTools]);

  const handleClose = () => {
    setDescription('');
    setSelectedTools([]);
    setGeneratedWorkflow(null);
    setError(null);
    onClose();
  };

  const validateAndFilterWorkflow = (parsedWorkflow: any, selectedToolItems: ToolItem[]) => {
    // Create a map of valid tools and their parameters
    const validTools: Record<string, string[]> = {};
    
    // Add selected tools
    selectedToolItems.forEach(toolItem => {
      validTools[toolItem.name] = Object.keys(toolItem.parameters?.properties || {});
    });
    
    // Always include think tool
    validTools['think'] = ['what_to_think_about'];
    
    // Filter and validate steps
    const validatedSteps = parsedWorkflow.steps?.map((step: any) => {
      const toolName = step.tool;
      
      // If tool is empty string, keep it as is (user will select manually)
      if (toolName === '') {
        return {
          ...step,
          args: {}, // Clear args since no tool is selected
          values: {}
        };
      }
      
      // If tool doesn't exist in our valid tools, set to empty
      if (!validTools[toolName]) {
        return {
          ...step,
          tool: '',
          args: {},
          values: {}
        };
      }
      
      // Filter args to only include valid parameters for this tool
      const validParams = validTools[toolName];
      const filteredArgs: Record<string, string> = {};
      const filteredValues: Record<string, string> = {};
      
      if (step.args) {
        Object.keys(step.args).forEach(paramName => {
          if (validParams.includes(paramName)) {
            filteredArgs[paramName] = step.args[paramName];
          }
        });
      }
      
      if (step.values) {
        Object.keys(step.values).forEach(paramName => {
          if (validParams.includes(paramName)) {
            // Ensure all values are strings to match schema requirements
            filteredValues[paramName] = String(step.values[paramName]);
          }
        });
      }
      
      return {
        ...step,
        args: filteredArgs,
        values: filteredValues
      };
    }) || [];
    
    return {
      ...parsedWorkflow,
      steps: validatedSteps
    };
  };

  const createPrompt = (userDescription: string, selectedToolItems: ToolItem[]) => {
    const toolsForPrompt = [...selectedToolItems];
    
    const hasThink = toolsForPrompt.some(tool => tool.name === 'think');
    if (!hasThink) {
      toolsForPrompt.push({
        id: 'think',
        name: "think",
        description: "Stop and think step by step.\n\n    :param message:\n    :return:",
        icon: null,
        category: 'Agent Tool',
        tags: [],
        parameters: {
          properties: {
            what_to_think_about: { type: 'string' }
          }
        },
        type: 'builtin'
      } as ToolItem);
    }
    
    const toolsInfo = toolsForPrompt.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: Object.keys(tool.parameters?.properties || {})
    }));
    // console.log(toolsInfo);

    return `You are an AI assistant that creates workflow templates. Based on the user's description and available tools, generate a structured workflow.

User Description: "${userDescription}"

Available Tools: ${JSON.stringify(toolsInfo, null, 2)}

Generate a workflow with the following JSON structure:
{
  "name": "Workflow Name",
  "description": "Brief description",
  "steps": [
    {
      "stepName": "unique_step_name",
      "description": "What this step does",
      "tool": "tool_name_from_available_tools",
      "instructions": "Detailed instructions for this step",
      "args": {
        "param_name": "Instructions for how to determine this parameter value"
      },
      "values": {
        "param_name": "Fixed value if known"
      },
      "actionSegment": "optional_group_name"
    }
  ]
}

Rules:
- Each step must use a tool from the available tools list above
- Instructions should be clear and actionable
- Group related steps with the same actionSegment
- Don't include the terminate step (it's added automatically)
- Keep step names short, unique, and use underscores instead of spaces
- Only use tools that were provided in the available tools list
- If only the think tool is available, create a simple workflow with basic description and leave other tool names empty (empty string) so users can select tools manually later
- Use "think" steps strategically when the agent needs to:
  * Analyze or digest information from previous steps
  * Understand context before making decisions
  * Plan the approach for complex subsequent steps
  * Process data or results to determine next actions
  * Take a step back and evaluate progress
- Think steps are NOT needed for every action - only when analysis/preparation is required
- Action steps (API calls) should flow naturally when the task is straightforward
- Example flow: API call → think (analyze results) → API call → think (plan next approach) → API call
- For actionSegment usage:
  * Core/essential steps that are required for the basic workflow should NOT have an actionSegment (leave undefined)
  * Optional features, enhancements, or grouped functionality should use actionSegment
  * Think steps that are essential should NOT have actionSegment
Generate ONLY the JSON, no additional text.`;
  };

  const generateWorkflow = async () => {
    if (!description.trim()) {
      setError('Please provide a description of your desired workflow');
      return;
    }

    if (!chatEndpoint) {
      setError('Chat endpoint not available');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const prompt = createPrompt(description, selectedTools);
      const messages: Message[] = [newMessage({"content": prompt})];
      const model = getDefaultModel(DefaultModels.ADVANCED);

      const response = await promptForData(
        chatEndpoint,
        messages,
        model,
        "Respond with only a parsable json object",
        defaultAccount,
        statsService,
        4000
      );
      if (!response) {
        throw new Error('No response from AI');
      }

      // Try to parse the JSON response
      let parsedWorkflow;
      try {
        // Clean up the response in case there's extra text
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : response;
        parsedWorkflow = JSON.parse(jsonString);
      } catch (parseError) {
        console.error('Failed to parse AI response:', response);
        
        // Try to fix the JSON using the repair function
        try {
          console.log('Attempting to repair malformed JSON...');
          const model = getDefaultModel(DefaultModels.ADVANCED);
          const fixedJson = await fixJsonString(
            model, 
            chatEndpoint, 
            statsService, 
            response, 
            defaultAccount, 
          );
          
          if (fixedJson) {
            parsedWorkflow = JSON.parse(fixedJson);
            console.log('Successfully repaired and parsed JSON');
          } else {
            throw new Error('Failed to repair JSON');
          }
        } catch (repairError) {
          console.error('Failed to repair AI response:', repairError);
          throw new Error('AI response was not valid JSON and could not be repaired. Please try again.');
        }
      }

      // Validate and filter the workflow to ensure only real tools and parameters are used
      const validatedWorkflow = validateAndFilterWorkflow(parsedWorkflow, selectedTools);

      // Validate and transform to AstWorkflow format
      const workflow: AstWorkflow = {
        templateId: '',
        name: validatedWorkflow.name || 'Generated Workflow',
        description: validatedWorkflow.description || 'AI-generated workflow',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: {},
        template: {
          steps: Array.isArray(validatedWorkflow.steps) ? validatedWorkflow.steps : []
        },
        isBaseTemplate: false,
        isPublic: false
      };

      setGeneratedWorkflow(workflow);

    } catch (error) {
      console.error('Failed to generate workflow:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate workflow. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAccept = () => {
    if (generatedWorkflow) {
      onGenerate(generatedWorkflow);
      handleClose();
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className={`${lightMode} fixed inset-0 z-[9999] flex items-center justify-center`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm" onClick={handleClose} />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 max-w-4xl w-full mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm flex justify-between items-center flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <IconRobot size={20} className="text-green-600 dark:text-green-400" />
              AI Generate Workflow
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Describe your workflow and let AI create the steps for you</p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <IconX size={24} />
          </button>
        </div>
        
        {/* Content */}
        <div className="px-6 py-4 space-y-6 flex-grow overflow-y-auto bg-gray-50 dark:bg-gray-900/50">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg">
              <div className="flex items-start gap-2">
                <IconX size={16} className="flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium">Generation Failed</div>
                  <div className="mt-1 text-sm">{error}</div>
                </div>
              </div>
            </div>
          )}

          {!generatedWorkflow ? (
            <>
              {/* AI Generation Instructions */}
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-800 dark:text-gray-200">
                  Describe Your Workflow
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  rows={4}
                  placeholder="e.g., Create a workflow that processes customer feedback, analyzes sentiment, and sends notifications based on the results..."
                  title="Describe your desired workflow in natural language. Be specific about the steps and tools you want to use for better AI generation results."
                />
              </div>

              {/* Tool Selection */}
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-800 dark:text-gray-200">
                  Pre-Select Tools (Optional)
                </label>
                <div 
                  className="text-sm text-gray-600 dark:text-gray-400 mb-3"
                  title="Selecting tools beforehand helps the AI create more specific and accurate workflow steps"
                >
                  <p>Pre-selecting tools helps the AI generate more accurate steps. If no tools are selected, 
                  you will need to add tools to the individual steps later.</p>
                </div>
                
                {/* Selected Tools Preview */}
                {selectedTools.length > 0 && (
                  <div className="mb-3 p-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <IconTools size={16} className="text-gray-600 dark:text-gray-400" />
                        Selected Tools 
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium">
                          {selectedTools.length}
                        </span>
                      </span>
                      <button
                        onClick={() => setSelectedTools([])}
                        className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md transition-colors"
                        title="Remove all selected tools from the workflow generation"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {selectedTools.map(tool => (
                        <span
                          key={tool.id}
                          className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded"
                        >
                          {tool.name}
                          <button
                            onClick={() => setSelectedTools(prev => prev.filter(t => t.id !== tool.id))}
                            className="ml-1 hover:text-blue-600 dark:hover:text-blue-300"
                            title="Remove this tool from the selection"
                          >
                            <IconX size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                <button
                  onClick={() => setShowToolPicker(true)}
                  className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all duration-200 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium"
                  title="Pre-selecting tools helps the AI generate more accurate workflow steps. You can add more tools after generation."
                >
                  <IconTools size={20} />
                  <span>
                    {selectedTools.length > 0 ? 'Add More Tools' : 'Select Tools'}
                  </span>
                </button>
              </div>
            </>
          ) : (
            /* Generated Workflow Preview */
            <div className='text-black dark:text-neutral-300'>
              <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                <h4 
                  className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2"
                  title="Review the AI-generated workflow before saving it to your templates"
                >
                  <IconCheck size={20} className="text-green-600 dark:text-green-400" />
                  Generated Workflow Preview
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Review and customize before saving to your templates</p>
              </div>
              
              
              <AssistantWorkflow 
                id={"generatedWorkflowPreview"}
                workflowTemplate={generatedWorkflow} 
                enableCustomization={false}
                onWorkflowTemplateUpdate={(workflowTemplate: AstWorkflow | null) => {}}
                obfuscate={false}
              />
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3 flex-shrink-0">
          {!generatedWorkflow ? (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors border border-gray-300 dark:border-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={generateWorkflow}
                disabled={isGenerating || !description.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors flex items-center gap-2 shadow-sm"
                title="Uses AI to create a workflow based on your description and selected tools"
              >
                {isGenerating ? (
                  <>
                    <IconLoader2 size={16} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <IconRobot size={16} />
                    Generate Workflow
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setGeneratedWorkflow(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors border border-gray-300 dark:border-gray-600"
                title="Create a new version of the workflow with the same inputs"
              >
                Regenerate
              </button>
              <button
                onClick={handleAccept}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors shadow-sm"
                title="Accept this workflow and add it to your templates"
              >
                Save This Workflow
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {createPortal(modalContent, document.body)}
      <ToolSelectorModal
        isOpen={showToolPicker}
        onClose={() => setShowToolPicker(false)}
        onSelect={() => {}} // Not used in multi-select mode
        tools={toolItems}
        title="Select Tools for Workflow"
        allowMultiSelect={true}
        showSelectionPreview={true}
        selectedTools={selectedTools}
        onMultiSelectChange={setSelectedTools}
        showAdvancedFiltering={false}
        showClearSearch={true}
        defaultToolType="all"
      />
    </>
  );
};

export default WorkflowGeneratorModal; 