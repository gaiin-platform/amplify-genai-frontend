import React, { useState, useContext } from 'react';
import { IconLoader2, IconRobot, IconX, IconTools, IconCheck } from '@tabler/icons-react';
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
import { Modal } from '../ReusableComponents/Modal';

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
  const { state: { chatEndpoint, defaultAccount, statsService }, getDefaultModel } = useContext(HomeContext);

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

  const validateAndFilterWorkflow = (parsedWorkflow: any) => {
    const validTools: Record<string, string[]> = {};

    selectedApis.forEach(api => {
      validTools[api.name] = Object.keys(api.parameters?.properties || {});
    });

    selectedAgentTools.forEach(toolName => {
      if (availableAgentTools && availableAgentTools[toolName]) {
        const tool = availableAgentTools[toolName];
        validTools[tool.tool_name] = Object.keys(tool.parameters?.properties || {});
      }
    });

    validTools['think'] = ['what_to_think_about'];

    const validatedSteps = parsedWorkflow.steps?.map((step: any) => {
      const toolName = step.tool;

      if (toolName === '') {
        return { ...step, args: {}, values: {} };
      }

      if (!validTools[toolName]) {
        return { ...step, tool: '', args: {}, values: {} };
      }

      const validParams = validTools[toolName];
      const filteredArgs: Record<string, string> = {};
      const filteredValues: Record<string, string> = {};

      if (step.args) {
        Object.keys(step.args).forEach(paramName => {
          if (validParams.includes(paramName)) filteredArgs[paramName] = step.args[paramName];
        });
      }

      if (step.values) {
        Object.keys(step.values).forEach(paramName => {
          if (validParams.includes(paramName)) filteredValues[paramName] = String(step.values[paramName]);
        });
      }

      return { ...step, args: filteredArgs, values: filteredValues };
    }) || [];

    return { ...parsedWorkflow, steps: validatedSteps };
  };

  const createPrompt = (userDescription: string) => {
    const selectedTools: any[] = [
      ...selectedApis,
      ...selectedAgentTools.map(toolName =>
        availableAgentTools ? availableAgentTools[toolName] : null
      ).filter(Boolean)
    ];

    const hasThink = selectedTools.some(tool => tool.tool_name === 'Think');
    if (!hasThink) {
      selectedTools.push({
        name: "think",
        description: "Stop and think step by step.\n\n    :param message:\n    :return:",
        parameters: { properties: { what_to_think_about: { type: 'string' } } }
      });
    }

    const toolsInfo = selectedTools.map(tool => ({
      name: tool.name || tool.tool_name,
      description: tool.description,
      parameters: Object.keys(tool.parameters?.properties || {})
    }));

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
      const prompt = createPrompt(description);
      const messages: Message[] = [newMessage({ content: prompt })];
      const model = getDefaultModel(DefaultModels.ADVANCED);

      const response = await promptForData(
        chatEndpoint, messages, model,
        "Respond with only a parsable json object",
        defaultAccount, statsService, 4000
      );
      if (!response) throw new Error('No response from AI');

      let parsedWorkflow;
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        parsedWorkflow = JSON.parse(jsonMatch ? jsonMatch[0] : response);
      } catch {
        console.error('Failed to parse AI response:', response);
        try {
          console.log('Attempting to repair malformed JSON...');
          const model = getDefaultModel(DefaultModels.ADVANCED);
          const fixedJson = await fixJsonString(model, chatEndpoint, statsService, response, defaultAccount);
          if (fixedJson) {
            parsedWorkflow = JSON.parse(fixedJson);
            console.log('Successfully repaired and parsed JSON');
          } else {
            throw new Error('Failed to repair JSON');
          }
        } catch {
          throw new Error('AI response was not valid JSON and could not be repaired. Please try again.');
        }
      }

      const validatedWorkflow = validateAndFilterWorkflow(parsedWorkflow);

      setGeneratedWorkflow({
        templateId: '',
        name: validatedWorkflow.name || 'Generated Workflow',
        description: validatedWorkflow.description || description,
        inputSchema: { type: 'object', properties: {} },
        outputSchema: {},
        template: { steps: Array.isArray(validatedWorkflow.steps) ? validatedWorkflow.steps : [] },
        isBaseTemplate: false,
        isPublic: false
      });

    } catch (err) {
      console.error('Failed to generate workflow:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate workflow. Please try again.');
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

  const hasSelections = selectedApis.length > 0 || selectedAgentTools.length > 0;

  if (!isOpen) return null;

  const modalTitle = (
    <span className="flex items-center gap-2">
      <IconRobot size={20} className="text-green-600 dark:text-green-400" />
      AI Generate Workflow
    </span>
  ) as unknown as string;

  const modalContent = (
    <div className="space-y-4 pt-1">
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
          {/* Description Input */}
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
            />
          </div>

          {/* Selected Integrations Summary */}
          {hasSelections && (
            <div className="px-3 py-2 rounded-md bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600">
              <div className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">Selected Integrations:</div>
              <div className="text-xs text-neutral-700 dark:text-neutral-300 space-y-1">
                {selectedApis.length > 0 && (
                  <div>
                    <span className="font-medium">APIs: </span>
                    <span className="inline-flex flex-wrap gap-1">
                      {selectedApis.map(api => (
                        <span key={api.name} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
                          {api.name}
                          <button onClick={() => setSelectedApis(prev => prev.filter(a => a.name !== api.name))} className="hover:text-blue-600 dark:hover:text-blue-200" title={`Remove ${api.name}`}>
                            <IconX size={10} />
                          </button>
                        </span>
                      ))}
                    </span>
                  </div>
                )}
                {selectedAgentTools.length > 0 && (
                  <div>
                    <span className="font-medium">Tools: </span>
                    <span className="inline-flex flex-wrap gap-1">
                      {selectedAgentTools.map(tool => (
                        <span key={tool} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                          {tool}
                          <button onClick={() => setSelectedAgentTools(prev => prev.filter(t => t !== tool))} className="hover:text-green-600 dark:hover:text-green-200" title={`Remove ${tool}`}>
                            <IconX size={10} />
                          </button>
                        </span>
                      ))}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tool Selection - embedded via ExpansionComponent */}
          <div className="text-black dark:text-neutral-100">
            <ExpansionComponent
              closedWidget={<IconTools className="flex-shrink-0" size={18} />}
              title="Pre-select APIs (Recommended — helps the AI generate more accurate steps)"
              isOpened={true}
              content={(
                <div className="mt-3 p-4 border rounded-lg border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Select specific tools you want to include in your workflow.
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    If no tools are selected, you will have to add tools to each individual step yourself — the generated workflow will be a bare framework with step descriptions but no actual tools.
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
                    compactDisplay={true}
                    labelPrefix=''
                    allowConfiguration={true}
                  />
                </div>
              )}
            />
          </div>

          {/* Generating spinner shown inline when loading */}
          {isGenerating && (
            <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
              <IconLoader2 size={16} className="animate-spin" />
              Generating your workflow...
            </div>
          )}
        </>
      ) : (
        /* Generated Workflow Preview */
        <div className="text-black dark:text-neutral-300">
          <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <IconCheck size={20} className="text-green-600 dark:text-green-400" />
              Generated Workflow Preview
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Review and customize before saving to your templates</p>
          </div>
          <AssistantWorkflow
            id={"generatedWorkflowPreview"}
            workflowTemplate={generatedWorkflow}
            enableCustomization={false}
            onWorkflowTemplateUpdate={() => {}}
            obfuscate={false}
          />
        </div>
      )}
    </div>
  );

  return (
    <Modal
      title={modalTitle}
      content={modalContent}
      onCancel={handleClose}
      onSubmit={generatedWorkflow ? handleAccept : generateWorkflow}
      cancelLabel={generatedWorkflow ? 'Close' : 'Cancel'}
      submitLabel={generatedWorkflow ? 'Save This Workflow' : (isGenerating ? 'Generating...' : 'Generate Workflow')}
      disableSubmit={isGenerating || (!generatedWorkflow && !description.trim())}
      additionalButtonOptions={generatedWorkflow ? [{ label: 'Regenerate', handleClick: () => setGeneratedWorkflow(null) }] : []}
      disableClickOutside={true}
      width={() => Math.max(window.innerWidth * 0.92, 1100)}
      height={() => Math.max(window.innerHeight * 0.92, 700)}
      resizeOnVarChange={generatedWorkflow}
    />
  );
};

export default WorkflowGeneratorModal;
