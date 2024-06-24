import {DEFAULT_SYSTEM_PROMPT} from "@/utils/app/const";
import {AttachedDocument} from "@/types/attacheddocument";


export enum AssistantProviderID {
    AMPLIFY = 'amplify',
    OPENAI = 'openai'
}

export interface AssistantTool {
    [key:string]:string;
}

export interface Assistant {
    id:string,
    definition: AssistantDefinition;
}

export interface AssistantDefinition {
    name:string;
    description:string;
    instructions:string;
    disclaimer?:string;
    tools:AssistantTool[];
    tags:string[],
    fileKeys:string[];
    dataSources:AttachedDocument[];
    provider:string;
    uri?:string;
    options?:{[key:string]:any};
    version?:number;
    id?:string;
    data?:{[key:string]:any};
    assistantId?:string;
}

export const DEFAULT_ASSISTANT: Assistant = {
    id: 'chat',
    definition:
        {
            provider:'amplify',
            name: "Standard Conversation",
            description: "No assistant will be used.",
            instructions: DEFAULT_SYSTEM_PROMPT,
            tools: [],
            tags: [],
            fileKeys: [],
            dataSources: [],
        }
};