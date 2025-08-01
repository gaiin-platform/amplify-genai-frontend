import { OpBindings, Schema } from "./op";

export interface AgentTool {
    tool_name: string;
    description: string;
    tags: string[];
    parameters?: Schema;
    terminal?: boolean;
    bindings? : OpBindings;
    [key: string]: any; // Allow additional properties
  }


