import React, { useState, useContext } from 'react';
import { createPortal } from 'react-dom';
import { IconLoader2, IconRobot, IconChevronDown, IconChevronUp, IconX, IconTools } from '@tabler/icons-react';
import { AstWorkflow } from '@/types/assistantWorkflows';
import { OpDef } from '@/types/op';
import HomeContext from '@/pages/api/home/home.context';
import ApiIntegrationsPanel from '../AssistantApi/ApiIntegrationsPanel';
import { promptForData } from '@/utils/app/llm';
import { Message, newMessage } from '@/types/chat';
import { DefaultModels } from '@/types/model';
import ExpansionComponent from '../Chat/ExpansionComponent';
import { AssistantWorkflow } from './AssistantWorkflow';
import { fixJsonString } from '@/utils/app/errorHandling';

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
  const [selectedApis, setSelectedApis] = useState<OpDef[]>([]);
  const [selectedAgentTools, setSelectedAgentTools] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedWorkflow, setGeneratedWorkflow] = useState<AstWorkflow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setDescription('');
    setSelectedApis([]);
    setSelectedAgentTools([]);
    setGeneratedWorkflow(null);
    setError(null);
    onClose();
  };

  const validateAndFilterWorkflow = (parsedWorkflow: any, selectedTools: any[]) => {
    // Create a map of valid tools and their parameters
    const validTools: Record<string, string[]> = {};
    
    // Add selected APIs
    selectedApis.forEach(api => {
      validTools[api.name] = Object.keys(api.parameters?.properties || {});
    });
    
    // Add selected agent tools
    selectedAgentTools.forEach(toolName => {
      if (availableAgentTools && availableAgentTools[toolName]) {
        const tool = availableAgentTools[toolName];
        validTools[tool.tool_name] = Object.keys(tool.parameters?.properties || {});
      }
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

  const createPrompt = (userDescription: string, selectedTools: any[]) => {
    const hasThink = selectedTools.some(tool => tool.tool_name === 'Think');
    if (!hasThink) {
      selectedTools.push({
        "name": "think",
        "description": "Stop and think step by step.\n\n    :param message:\n    :return:",
        "parameters": [
          "what_to_think_about"
        ]
      });
    }
    const toolsInfo = selectedTools.map(tool => ({
      name: tool.name || tool.tool_name,
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
      const selectedTools = [
        ...selectedApis,
        ...selectedAgentTools.map(toolName => 
          availableAgentTools ? availableAgentTools[toolName] : null
        ).filter(Boolean)
      ];

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
        description: validatedWorkflow.description || description,
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
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <IconRobot size={24} />
            AI Generate Workflow
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <IconX size={24} />
          </button>
        </div>
        
        {/* Content */}
        <div className="px-6 py-4 space-y-4 flex-grow overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {!generatedWorkflow ? (
            <>
              {/* Description Input */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Describe your desired workflow
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  rows={4}
                  placeholder="e.g., Create a workflow that processes customer feedback, analyzes sentiment, and sends notifications based on the results..."
                />
              </div>

              {/* Tool Selection */}
              <div className='text-black dark:text-neutral-100'>
                <ExpansionComponent
                  closedWidget={<IconTools className='flex-shrink-0' size={18} />}
                  content={ (
                  <div className="mt-3 p-4 border rounded-lg dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Select specific tools you want to include in your workflow.
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                     If no tools are selected, you will have to add tools to each individual step yourself, the generated workflow will be a bare framework with step descriptions but no actual tools.
                     </p>
                    <ApiIntegrationsPanel
                      key="workflow-generator-apis" 
                      availableApis={availableApis}
                      selectedApis={selectedApis}
                      setSelectedApis={setSelectedApis}
                      availableAgentTools={availableAgentTools}
                      builtInAgentTools={selectedAgentTools}
                      setBuiltInAgentTools={setSelectedAgentTools}
                      allowCreatePythonFunction={false}
                      compactDisplay={false}
                      height="300px"
                    />
                  </div>
                )}
                title="Pre-select APIs (Recommended - This helps the AI generate more accurate steps.)"
                isOpened={true}
                />
              </div>
            </>
          ) : (
            /* Generated Workflow Preview */
            <div className='text-black dark:text-neutral-300'>
              <h4 className="text-lg font-medium mb-3 text-gray-900 dark:text-white">
                Generated Workflow Preview
              </h4>
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
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={generateWorkflow}
                disabled={isGenerating || !description.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors flex items-center gap-2"
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
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                Regenerate
              </button>
              <button
                onClick={handleAccept}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
              >
                Use This Workflow
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default WorkflowGeneratorModal; 