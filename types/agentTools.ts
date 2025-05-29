export interface AgentTool {
    tool_name: string;
    description: string;
    tags: string[];
    parameters?: {
      type: string;
      properties: {
        [key: string]: {
          type: string;
          [key: string]: any;
        };
      };
      required?: string[];
    };
    schema?:  {
      type: string;
      properties: {
        [key: string]: {
          type: string;
          [key: string]: any;
        };
      };
      required?: string[];
    };
    terminal?: boolean;
    [key: string]: any; // Allow additional properties
  }


