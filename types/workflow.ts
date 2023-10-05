
export interface InputType {
    fileExtension: string;
    fileMimeType: string;
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
    inputs: InputType[];
    outputs: OutputType[];
}