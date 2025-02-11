import {AttachedDocument} from "@/types/attacheddocument";
import {Conversation} from "@/types/chat";
import {Prompt} from "@/types/prompt";
import {FolderInterface} from "@/types/folder";
import { v4 as uuidv4 } from 'uuid';

export interface Status {
    id:string;
    summary:string;
    message:string;
    type:string
    inProgress:boolean;
    sticky?:boolean;
    icon?:string;
    animated?:boolean;
}

export const newStatus = (data:any) => {
    return {
        id: uuidv4(),
        summary: '',
        message: '',
        type: 'info',
        inProgress: false,
        ...data
    };
}

export interface InputsContext {
    conversations?: Conversation[];
    prompts?: Prompt[];
    folders?: FolderInterface[];
    parameters: { [key: string]: any };
    documents: AttachedDocument[];
}

export interface WorkflowContext {
    inputs: InputsContext;
}

export interface WorkflowRun {
    id: string;
    workflowDefinition: WorkflowDefinition;
    startTime: string;
    inputs: {
        parameters: { [key: string]: string };
        documents: AttachedDocument[];
    }
}

export interface InputDocument {
    name: string;
    fileExtension: string;
    fileMimeType: string;
}

export interface InputParameter {
    name: string;
    description: string;
    defaultValue: string;
    jsonSchema: string;
}

export interface Parameters {
    [key: string]: InputParameter;
}

export interface Inputs {
    parameters: Parameters,
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