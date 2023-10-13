
export interface InputDocument {
    fileExtension: string;
    fileMimeType: string;
}

export interface InputParameter {
    name: string;
    description: string;
    defaultValue: string;
    jsonSchema: string;
}

export interface Inputs {
    parameters: InputParameter[],
    documents: InputDocument[]
}

export interface OutputType {
    type: string;
    data?: { [key: string]: string };
}

export interface WorkflowDefinition {
    id: string;
    formatVersion: string;
    version: string;
    folderId: string | null;
    description?: string;
    generatingPrompt?: string;
    name: string;
    code: string;
    tags: string[];
    inputs: Inputs;
    outputs: OutputType[];
}