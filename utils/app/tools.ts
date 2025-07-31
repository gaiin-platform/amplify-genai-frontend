import {CustomFunction} from "@/types/chat";
import { Schema } from "@/types/op";

export interface Prompt {
    rootPrompt?: string;
    prompt: string;
    index?: number;
}

export interface AiTool {
    description: string,
    exec: (...args: any[]) => any;
}

export interface Stopper {
    shouldStop: () => boolean,
    signal: AbortSignal
}

export const abortResult = {
    success: false,
    code: null,
    exec: null,
    uncleanCode: null,
    result: null
};

const breakIntoChunksByLineCount = (input: string, maxLines: number): string[] => {
    const lines: string[] = input.split('\n');
    const chunks: string[] = [];

    for (let i = 0; i < lines.length; i += maxLines) {
        const chunk: string = lines.slice(i, i + maxLines).join('\n');
        chunks.push(chunk);
    }

    return chunks;
}

const breakIntoChunksByCharacterCount = (input: string, maxCharacters: number): string[] => {
    const chunks: string[] = [];

    for (let i = 0; i < input.length; i += maxCharacters) {
        const chunk: string = input.slice(i, i + maxCharacters);
        chunks.push(chunk);
    }

    return chunks;
}



function splitStringIntoChunks(str: string, chunkSize: number) {
    if (typeof str !== 'string' || typeof chunkSize !== 'number' || chunkSize <= 0) {
        throw new Error('Invalid input: Ensure str is a string and chunkSize is a positive number.');
    }

    const chunks = [];
    for (let i = 0; i < str.length; i += chunkSize) {
        chunks.push(str.slice(i, i + chunkSize));
    }

    return chunks;
}

const jsonFunction = "jsonResult";
const jsonProperty = "json";
const jsonFunctions: CustomFunction[] = [
    {
        name: jsonFunction,
        description: "Call this function to output the requested json",
        parameters: {
            type: "object",
            properties: {
                [jsonProperty]: {},
            },
            "required": [jsonProperty]
        }
    },
];

const balanceBrackets = (inputString:string) => {

    let bracketsStack = 0;
    let inString = false;
    let stringChar = '';
    let prevChar = '';
    let currChar = '';
    let stringStart = 0;

    for (let i = 0; i < inputString.length; i++) {
        prevChar = currChar;
        currChar = inputString[i];

        if (inString) {
            // Check for a closing quote, ensuring it's not escaped
            if (currChar === stringChar && prevChar !== '\\') {
                // Found the closing quote
                inString = false;
            }
        } else {
            // Check for an opening quote
            if (currChar === '"' || currChar === "'" || currChar === "`") {
                stringStart = i;
                inString = true;
                stringChar = currChar;
            } else if (currChar === '{') {
                bracketsStack += 1;
            } else if (currChar === '}') {
                bracketsStack -= 1;
            }
        }

    }

    if(bracketsStack > 0) {
        for(let i = 0; i < bracketsStack; i++) {
            inputString = inputString + "}";
        }
    }
    if(bracketsStack < 0) {
        for(let i = bracketsStack; i < 0; i++) {
            inputString = "{" + inputString;
        }
    }

    return inputString;
};

function convertToMarkdown(obj:any, prefix = "") {
    let output = "";

    if (obj.topic) {
        output += `${prefix}${obj.topic}`;

        if (obj.content) {
            output += `\n\n${obj.content}\n`;
        }

        if (obj.subtopics && obj.subtopics.length > 0) {
            obj.subtopics.forEach((subtopic:any, index:number) => {
                const subtopicPrefix = `${prefix}${index + 1}.`;
                output += `\n${convertToMarkdown(subtopic, subtopicPrefix)}`;
            });
        }
    } else if (typeof obj === "string") {
        output += `${prefix}${obj}`;
    }

    return output;
}




// @ts-ignore
export const getToolMetadata = ({stopper, context, requestedParameters, requestedDocuments, statusLogger}) => {
    return {
        log: {
            description: "(...args:any)=>void // Saves debug information for later inspection.",
        },
        getParameter: {
            description: "(name:string, type:\"string|options\")=>string // Get a parameter from the workflow settings. Options can be specified as a string like \"options(value=['option1','option2',....])\"",
        },
        breakIntoChunksByLineCount: {
            description:"(input: string, maxLines: number): string[]"
        },
        breakIntoChunksByCharacterCount: {
            description:"(input: string, maxCharacters: number): string[]"
        },
        getConversations: {
            description:"()=>Conversation[] // Get all conversations in my workspace in the format " +
                "Conversation { id: string; name: string; messages: Message[]; model: OpenAIModel; prompt: string; temperature: number; folderId: string | null; promptTemplate: Prompt | null; tags?: string[]; }, export interface Message { role: Role; content: string; id: string; type: string | undefined; data: any | undefined; }.",
        },
        getFolders: {
            description:"()=>FolderInterface[] // Get all folders in my workspace in the format " +
                "interface FolderInterface { id: string; name: string; type: FolderType; }",
        },
        getPromptTemplates: {
            description:"()=>PromptTemplate[] // Get all prompt templates in my workspace in the format " +
                "export interface Prompt { id: string; name: string; description: string; content: string; folderId: string | null; type: string | undefined;  }",
        },
        
        tellUser: {
            description: "(msg:string)//output a message to the user",
        },
        
        splitStringIntoChunks: {
            description: "(str: string, chunkSize: number)=>string[] Splits a string into chunks of a specified size." +
                " The function returns an array of substrings, ensuring that each chunk is at most `chunkSize` characters long." +
                " This is useful for processing or transmitting large strings in smaller, manageable pieces, especially" +
                " when interfacing with APIs or systems that have size limitations.",
        },
        getDocuments: {
            description: "()=>[{name:string,raw:string},...] // returns an array of documents with name and raw properties." +
                " Use this function to access all documents as strings.",
        },
        getDocument: {
            description: "(name:string)=>{name:string,raw:string} // Get a document by name.",
        },

    };
};

// @ts-ignore
export const parameterizeTools = ({stopper, context, requestedParameters, requestedDocuments, debugOutput, statusLogger}:params) => {

    console.log("parameterizeTools", context, requestedParameters, requestedDocuments);

    const documents = [...context.inputs.documents];
    const parameters = {...context.inputs.parameters};
    const conversations = [...context.inputs.conversations];
    const prompts = [...context.inputs.prompts];
    const folders = [...context.inputs.folders];

    console.log(parameters);

    const getParameter = (name:string, type:string) => {
        console.log("Fetch workflow param:", name, parameters[name]);
        return parameters[name];
    };


    const allDocuments = () => {
        return documents;
    };

    return {
        log: {
            description: "log(...args:any)=>void // Saves debug information for later inspection.",
            exec: (...args: any[]) => {
                // Stringify the arguments and combine them into a single string.
                const message = args.map(arg => JSON.stringify(arg)).join(" ");
                debugOutput.push(message);
            }
        },
        getParameter: {
               description: "getParameter(name:string, type:\"string|options\")=>string // Get a parameter from the workflow settings. Options can be specified as a string like \"options(value=['option1','option2',....])\"",
                exec: (name: string, type: string) => {
                   return getParameter(name, type);
                }
        },
        breakIntoChunksByLineCount: {
            description:"(input: string, maxLines: number): string[]",
            exec: (input: string, maxLines: number) => {
                return breakIntoChunksByLineCount(input, maxLines);
            }
        },
        breakIntoChunksByCharacterCount: {
            description:"(input: string, maxCharacters: number): string[]",
            exec: (input: string, maxCharacters: number) => {
                return breakIntoChunksByCharacterCount(input, maxCharacters);
            }
        },
        getConversations: {
            description:"getConversations()=>Conversation[] // Get all conversations in my workspace in the format " +
                "Conversation { id: string; name: string; messages: Message[]; model: OpenAIModel; prompt: string; temperature: number; folderId: string | null; promptTemplate: Prompt | null; tags?: string[]; }, export interface Message { role: Role; content: string; id: string; type: string | undefined; data: any | undefined; }.",
            exec: () => {
                return conversations;
            }
        },
        getFolders: {
            description:"getFolders()=>FolderInterface[] // Get all folders in my workspace in the format " +
                "interface FolderInterface { id: string; name: string; type: FolderType; }",
            exec: () => {
                return folders;
            }
        },
        getPromptTemplates: {
            description:"getPromptTemplates()=>PromptTemplate[] // Get all prompt templates in my workspace in the format " +
                "export interface Prompt { id: string; name: string; description: string; content: string; folderId: string | null; type: string | undefined;  }",
            exec: () => {
                return prompts;
            }
        },

        splitStringIntoChunks: {
            description: "(str: string, chunkSize: number)=>string[] Splits a string into chunks of a specified size." +
                " The function returns an array of substrings, ensuring that each chunk is at most `chunkSize` characters long." +
                " This is useful for processing or transmitting large strings in smaller, manageable pieces, especially" +
                " when interfacing with APIs or systems that have size limitations.",
            exec: (str: string, chunkSize: number) => {
                return splitStringIntoChunks(str, chunkSize);
            }
        },
 
        getDocuments: {

            description: "():[{name:string,raw:string},...] // returns an array of documents with name and raw properties." +
                " Use this function to access all documents as strings.",
            exec: () => {
                requestedDocuments.push("*");
                return allDocuments();
            },
        },
        getDocument: {
            description: "(name:string)=>{name:string,raw:string} // Get a document by name.",
            exec: (name: string) => {
                requestedDocuments.push(name);
                return allDocuments().find(document => document.name === name);
            }
        },

    };
}

export const emptySchema: Schema = {type: "object", properties: {}};

// for backward compatibiity 
export const parametersToParms = (parameters: Schema | undefined): Record<string, string>[] => {
    if (!parameters || !parameters.properties) return [];
    
    const params: Record<string, string>[] = [];
    Object.entries(parameters.properties).forEach(([paramName, paramInfo]: [string, any]) => {
        params.push({
            name: paramName,
            description: paramInfo.description ?? "No description provided"
        });
    });
    
    return params;
}