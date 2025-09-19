import { Step } from '@/types/assistantWorkflows';
import { OpDef } from '@/types/op';
import { AgentTool } from '@/types/agentTools';
import { promptForData } from '@/utils/app/llm';
import { Message, newMessage } from '@/types/chat';
import { DefaultModels } from '@/types/model';
import { fixJsonString } from '@/utils/app/errorHandling';

export interface ToolItem {
  id: string;
  name: string;
  description: string;
  parameters: any;
  type: 'api' | 'agent';
  originalTool: OpDef | AgentTool;
}

export interface AIStepGenerationResult {
  success: boolean;
  step?: Step;
  error?: string;
}

/**
 * Convert available APIs and agent tools to a unified ToolItem format
 */
export const createToolItemsFromAvailable = (
  availableApis: OpDef[] | null,
  availableAgentTools: Record<string, AgentTool> | null
): ToolItem[] => {
  const items: ToolItem[] = [];
  const seenTools = new Set<string>();

  // Add available APIs
  if (availableApis) {
    availableApis.forEach(api => {
      if (!seenTools.has(api.name)) {
        seenTools.add(api.name);
        items.push({
          id: api.name,
          name: api.name,
          description: api.description || 'No description available',
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
        items.push({
          id: toolName,
          name: toolName,
          description: agentTool.description || 'No description available',
          parameters: agentTool.parameters,
          type: 'agent',
          originalTool: agentTool
        });
      }
    });
  }

  // Always add think tool if not present
  if (!seenTools.has('think')) {
    items.push({
      id: 'think',
      name: 'think',
      description: 'Stop and think step by step.',
      parameters: {
        type: 'object',
        properties: {
          what_to_think_about: {
            type: 'string',
            description: 'What to think about'
          }
        }
      },
      type: 'agent',
      originalTool: {
        tool_name: 'think',
        description: 'Stop and think step by step.',
        tags: [],
        parameters: {
          type: 'object',
          properties: {
            what_to_think_about: {
              type: 'string',
              description: 'What to think about'
            }
          }
        }
      } as AgentTool
    });
  }

  // Filter out terminate tool - it's automatically managed in workflows
  return items.filter(item => item.name !== 'terminate');
};

/**
 * Create AI prompt for generating a single step
 */
export const createStepPrompt = (
  description: string,
  currentTool: string | null,
  availableTools: ToolItem[]
): string => {
  // If a specific tool is selected, focus on that tool
  let toolContext = '';
  let selectedToolInfo = null;

  if (currentTool && currentTool !== '') {
    const toolItem = availableTools.find(t => t.name === currentTool);
    if (toolItem) {
      selectedToolInfo = {
        name: toolItem.name,
        description: toolItem.description,
        parameters: Object.keys(toolItem.parameters?.properties || {})
      };
      toolContext = `\nSelected Tool: ${JSON.stringify(selectedToolInfo, null, 2)}`;
    }
  }

  // Provide context about all available tools for reference
  const allToolsInfo = availableTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: Object.keys(tool.parameters?.properties || {})
  }));

  return `You are an AI assistant that helps create individual workflow steps. Based on the user's description, generate a single step configuration.

User Description: "${description}"
${toolContext}

Available Tools (for reference): ${JSON.stringify(allToolsInfo.slice(0, 10), null, 2)}${allToolsInfo.length > 10 ? '\n... and more tools available' : ''}

Generate a single step with the following JSON structure:
{
  "stepName": "unique_step_name",
  "description": "What this step does",
  "tool": "${selectedToolInfo ? selectedToolInfo.name : 'tool_name_from_available_tools'}",
  "instructions": "Detailed instructions for this step",
  "args": {
    "param_name": "Instructions for how to determine this parameter value"
  },
  "values": {
    "param_name": "Fixed value if known"
  },
  "actionSegment": "optional_group_name"
}

Rules:
- Use the selected tool "${currentTool}" if provided, otherwise choose the most appropriate tool from available tools
- Instructions should be clear and actionable
- Only include parameters that exist for the selected tool
- Keep step name short, unique, and use underscores instead of spaces
- Use actionSegment only for optional/grouped functionality (leave undefined for core steps)
- If the selected tool is empty or unknown, choose the most appropriate tool from the available list

Generate ONLY the JSON, no additional text.`;
};

/**
 * Validate and filter a generated step to ensure it matches the selected tool's parameters
 */
export const validateAndFilterStep = (
  generatedStep: any,
  selectedTool: ToolItem | null
): Step => {
  // If no tool is selected, return the step as-is but ensure proper structure
  if (!selectedTool || !selectedTool.parameters) {
    return {
      stepName: generatedStep.stepName || '',
      description: generatedStep.description || '',
      tool: generatedStep.tool || '',
      instructions: generatedStep.instructions || '',
      args: generatedStep.args || {},
      values: generatedStep.values || {},
      actionSegment: generatedStep.actionSegment
    };
  }

  // Get valid parameters for the selected tool
  const validParams = Object.keys(selectedTool.parameters.properties || {});
  
  // Filter args and values to only include valid parameters
  const filteredArgs: Record<string, string> = {};
  const filteredValues: Record<string, string> = {};

  if (generatedStep.args) {
    Object.keys(generatedStep.args).forEach(paramName => {
      if (validParams.includes(paramName)) {
        filteredArgs[paramName] = generatedStep.args[paramName];
      }
    });
  }

  if (generatedStep.values) {
    Object.keys(generatedStep.values).forEach(paramName => {
      if (validParams.includes(paramName)) {
        // Ensure all values are strings to match schema requirements
        filteredValues[paramName] = String(generatedStep.values[paramName]);
      }
    });
  }

  return {
    stepName: generatedStep.stepName || '',
    description: generatedStep.description || '',
    tool: selectedTool.name, // Ensure we use the correct tool name
    instructions: generatedStep.instructions || '',
    args: filteredArgs,
    values: filteredValues,
    actionSegment: generatedStep.actionSegment
  };
};

/**
 * Generate a single step using AI
 */
export const generateSingleStep = async (
  description: string,
  currentTool: string | null,
  availableApis: OpDef[] | null,
  availableAgentTools: Record<string, AgentTool> | null,
  chatEndpoint: string,
  getDefaultModel: (model: DefaultModels) => any,
  defaultAccount: any,
  statsService: any
): Promise<AIStepGenerationResult> => {
  try {
    if (!description.trim()) {
      return { success: false, error: 'Please provide a description of your desired step' };
    }

    if (!chatEndpoint) {
      return { success: false, error: 'Chat endpoint not available' };
    }

    // Create available tools list
    const availableTools = createToolItemsFromAvailable(availableApis, availableAgentTools);
    
    // Find the currently selected tool
    const selectedToolItem = currentTool ? availableTools.find(t => t.name === currentTool) : null;

    // Create the prompt
    const prompt = createStepPrompt(description, currentTool, availableTools);
    
    // Generate the step
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
      return { success: false, error: 'No response from AI' };
    }

    // Parse the response
    let parsedStep;
    try {
      // Clean up the response in case there's extra text
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : response;
      parsedStep = JSON.parse(jsonString);
    } catch (parseError) {
      try {
        // Try to fix common JSON issues
        const fixedJson = await fixJsonString(
          model,
          chatEndpoint,
          statsService,
          response,
          defaultAccount
        );
        parsedStep = JSON.parse(fixedJson ?? "");
      } catch (fixError) {
        return { 
          success: false, 
          error: 'Failed to parse AI response. Please try again or configure the step manually.' 
        };
      }
    }

    // Validate and filter the generated step
    const validatedStep = validateAndFilterStep(parsedStep, selectedToolItem ?? null);

    return { success: true, step: validatedStep };

  } catch (error) {
    console.error('Error generating step:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to generate step. Please try again.' 
    };
  }
};