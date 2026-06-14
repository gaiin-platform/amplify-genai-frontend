
export interface StepOutputAttribute {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
}

export interface Step {
    description: string;
    tool: string; // ties to op
    instructions: string;
    values?: { [key: string]: string };
    args: { [key: string]: string };
    stepName?: string;
    actionSegment?: string; // Groups steps by action, used to customize the workflow by linking steps to an action
    editableArgs?: string[]
    useAdvancedReasoning?: boolean;
    // Output declarations — describe what this step produces so later steps can reference it
    outputs?: StepOutputAttribute[];
    // Repeat control — allow this step to be repeated (up to maxRepeats times); default false
    allowRepeat?: boolean;
    maxRepeats?: number;
    // Skip control — explicitly forbid or allow the LLM skip heuristic
    // undefined = default (LLM decides), true = always allow skip check, false = never skip
    allowSkip?: boolean;
    // Retry and timeout — surface the backend fields already in workflow_model.py
    retries?: number;
    timeout?: number; // seconds
  }
  
  export interface AstWorkflowTemplate {
    steps: Step[];
  }
  
  export interface AstWorkflow {
    templateId: string;
    name: string;
    description: string;
    inputSchema: {
      type: string;
      properties: {
        [key: string]: {
          type: string;
          description?: string;
        }
      }
    };
    outputSchema: object;
    template?: AstWorkflowTemplate;
    isBaseTemplate?: boolean;
    isPublic?: boolean;
    user?: string;
  }