
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