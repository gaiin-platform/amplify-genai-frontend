import {OpenAIModelID, OpenAIModels} from "@/types/openai";
import {Conversation, CustomFunction, JsonSchema, newMessage} from "@/types/chat";
import {sendChatRequest} from "@/services/chatService";
import {describeAsJsonSchema} from "@/utils/app/data";
import {InputDocument} from "@/types/workflow";
import {AttachedDocument} from "@/types/attacheddocument";
// import {generateCSVSchema} from "@/utils/app/csv";

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


const doPrompt = async (apiKey:string, stopper:Stopper, persona: string, prompt: string, messageCallback?: (msg: string) => void, model?: OpenAIModelID, functions?: CustomFunction[], function_call?: string) => {

    if (functions) {
        if (model === OpenAIModelID.GPT_3_5) {
            model = OpenAIModelID.GPT_3_5_FN;
        } else if (model === OpenAIModelID.GPT_4) {
            model = OpenAIModelID.GPT_4_FN;
        } else if (!model) {
            model = OpenAIModelID.GPT_3_5_FN;
        }
    }

    const chatBody = {
        model: OpenAIModels[model || OpenAIModelID.GPT_4],
        messages: [newMessage({content: prompt})],
        key: apiKey,
        prompt: persona,
        temperature: 1.0,
        ...(functions && {functions: functions}),
        ...(function_call && {function_call: function_call}),
    };

    if (stopper.shouldStop()) {
        return null;
    }

    console.log({prompt: prompt});
    // @ts-ignore
    const response = await sendChatRequest(apiKey, chatBody, null, stopper.signal);

    const reader = response.body?.getReader();
    let charsReceived = '';

    while (true) {

        if (stopper.shouldStop()) {
            return null;
        }

        // @ts-ignore
        const {value, done} = await reader.read();

        if (done) {
            break;
        }

        let chunk = new TextDecoder("utf-8").decode(value);

        charsReceived += chunk;

        if (messageCallback) {
            messageCallback(charsReceived);
        }
    }

    return charsReceived;
}

const promptUntil = async (
    promptLLMFull: (persona: string, prompt: string, messageCallback?: (msg: string) => void, model?: OpenAIModelID, functions?: CustomFunction[], function_call?: string) => any,
    persona: string,
    prompt: string,
    extract: (result: string) => any,
    check: (arg0: any) => boolean,
    tries: number,
    feedbackInserter?: (result: any, prompt: string) => string,
    errorInserter?: (e: any, cleaned: string | null, prompt: string) => string,
    model?: OpenAIModelID,
    functions?: CustomFunction[],
    function_call?: string) => {

    while (tries > 0) {
        let cleaned = null;
        try {
            tries = tries - 1;
            let context = {
                result: null
            };
            const raw = await promptLLMFull(persona, prompt, (m) => {
            }, model, functions, function_call);

            console.log("Raw result:", raw);

            cleaned = extract(raw || "");

            console.log("cleaned", cleaned);

            const finalResult = check(cleaned);
            if (finalResult) {
                return finalResult;
            } else if (feedbackInserter) {
                prompt = feedbackInserter(cleaned, prompt);
            }
        } catch (e) {
            console.log(e);
            if (errorInserter) {
                prompt = errorInserter(e, cleaned, prompt);
            }
        }
    }
}


export const promptLLMInParallel = (promptLLM:(root:string, prompt:string)=>Promise<string>, stopper:Stopper, statusLogger:any, prompts: Prompt[], maxConcurrency: number) => {
    return new Promise((resolve, reject) => {

        if(prompts.length == 1){
            promptLLM(prompts[0].rootPrompt || "", prompts[0].prompt).then((result)=>{
                resolve([result]);
            }).catch((e)=>{
                reject(e);
            });
            return;
        }

        let results = new Array(prompts.length).fill(null);
        let currentIndex = 0;

        if(prompts.length === 0){
            resolve(results);
            return;
        }

        if(stopper.shouldStop()){
            reject("Interrupted");
            return;
        }

        // Add an index to each prompt object to ensure results order.
        prompts.forEach((prompt, index) => {
            prompt.index = index;
        });

        const executePrompt = async () => {
            // If we're done, resolve the promise with the results.
            if(stopper.shouldStop()){
                resolve("Interrupted");
                return;
            }

            if (currentIndex === prompts.length) {
                if (results.every(result => result !== null)) {
                    resolve(results);
                }
                return;
            }

            // Fetch the next prompt and increment the index.
            const currentPrompt = prompts[currentIndex];
            currentIndex++;

            const finished = results.filter(result => result !== null).length
            const total = results.length;
            //await statusLogger({summary: `Prompting [${total - finished} running]: ${currentPrompt}`, message: prompt, type: "info"});

            try {
                console.log(`Executing prompt ${currentIndex} / ${prompts.length}`);
                // Execute the promptLLM function and store the result in the correct index.

                //statusLogger({summary: `Prompting ${currentIndex} / ${prompts.length}...`, message: prompt, type: "info"});

                if(stopper.shouldStop()){
                    reject("Interrupted");
                    return;
                }

                const result = await promptLLM(currentPrompt.rootPrompt || "", currentPrompt.prompt);

                console.log(`Finished prompt ${currentIndex} / ${prompts.length}`);
                //statusLogger({summary: `Finished ${currentIndex} / ${prompts.length}...`, message: currentPrompt.prompt, type: "info"});
                // @ts-ignore
                results[currentPrompt.index] = result;

                // Recursively call executePrompt to handle the next prompt.
                if(stopper.shouldStop()){
                    reject("Interrupted");
                    return;
                }
                else {
                    executePrompt();
                }
            } catch (err) {
                reject(err);
            }
        };

        // Start maxConcurrency "threads".
        for (let i = 0; i < Math.min(maxConcurrency, prompts.length); i++) {
            if(!stopper.shouldStop()) {
                executePrompt();
            }
        }
    });
};

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


const promptLLMForJson = async (promptLLMFull: (persona: string, prompt: string, messageCallback?: (msg: string) => void, model?: OpenAIModelID, functions?: CustomFunction[], function_call?: string) => any,
                                persona: string,
                                instructions: string,
                                desiredSchema: JsonSchema,
                                check?: (arg0: any) => boolean,
                                feedbackInserter?: (result: any, prompt: string) => string,
                                errorInserter?: (e: any, cleaned: string | null, prompt: string) => string,
                                model?: OpenAIModelID) => {
    const prompt = instructions;

    model = model || process.env.NEXT_PUBLIC_DEFAULT_FUNCTION_CALL_MODEL as OpenAIModelID;

    const systemPrompt = ""; //"You are ChatGPT, a large language model trained by OpenAI. " +
    // "Follow the user's instructions carefully. " +
    // "Respond using JSON. ";

    let functionsToCall = [...jsonFunctions];

    // @ts-ignore
    functionsToCall[0].parameters.properties[jsonProperty] = desiredSchema;

    check = (check) ? check : (json) => json;

    return promptUntil(
        promptLLMFull,
        systemPrompt + persona, prompt,
        (rslt) => {
            rslt = balanceBrackets(rslt);
            let obj = null;
            try {
                obj = JSON.parse(rslt);
            }catch (e){
                console.log("Unable to parse json: ", rslt);
                throw e;
            }
            try {
                return obj.arguments.json;
            } catch (e){
                console.log("Result did not have arguments.json property: ", obj);
                throw e;
            }
        },
        check,
        3,
        // @ts-ignore
        feedbackInserter,
        errorInserter,
        model,
        functionsToCall,
        jsonFunction
    );
}


const describeDocuments = (docs: AttachedDocument[]) => {

    let documentsSchema = docs.map((doc) => {
        // Describe as json schema and then remove line breaks.
        return describeAsJsonSchema(doc.data);
    });

    let documentsDescription = JSON.stringify(documentsSchema).replaceAll("\n", " ");

    const inputTypes = docs.map((doc) => {
        let ext = doc.name.split('.').pop() || "none";
        let input: InputDocument = {fileExtension: ext, fileMimeType: doc.type, name: doc.name};
        return input;
    })

}

const generateOutline = async (promptLLMFull:any, topic:string, maxDepth:number, minSubtopics:number) => {
    try {
        console.log("Creating an outline for a topic: Computer Incident Response.");

        // 1. Define JSON Schema for the outline to be created
        const outlineSchema = {
            type: "object",
            properties: {
                topic: {type: "string"},
                subtopics: {
                    type: "array",
                    items: {type: "string"}
                }
            }
        };

        // 2. Creating prompt for LLM to generate an instance of the schema with "Computer Incident Response" as the topic
        const initialPrompt = `Create an outline for the topic "${topic}". 
            The outline should include a single top-level topic and some number of subtopics. 
            Also, include a cohesive motivating example that is used through all of the topics.`;

        // 3. Generate an instance of the schema
        let topLevelOutline:any = await promptLLMForJson(promptLLMFull,"", initialPrompt, outlineSchema);

        // 4. For each sub topic in the generated outline, generate a sub outline
        // Create a nested outline by generating sub-outlines for each subtopic
        const generateNestedOutline = async (outline: { subtopics: string[]; }, depth = 1) => {
            if (depth >= maxDepth) {
                return outline;
            }

            for (let i = 0; i < outline.subtopics.length; i++) {
                let subTopic = outline.subtopics[i];

                console.log(`Generating ${i}/${outline.subtopics.length} at depth ${depth} for subtopic ${subTopic}`);

                // Define a prompt using this subtopic
                let promptForSubTopic = `Given the overall topic of 
                "${topic}", the sub topics "${outline.subtopics.join(", ")}",
                and the current subtopic "${subTopic}", 
                generate an outline with this subtopic of "${subTopic}" as the top-level 
                topic and at least ${minSubtopics} child topics.`;

                // Generate a sub-outline for this subtopic
                let subOutline:any = await promptLLMForJson(promptLLMFull,"", promptForSubTopic, outlineSchema);

                // Recursively generate nested outlines for this sub-outline
                subOutline = await generateNestedOutline(subOutline, depth + 1);

                // Incorporate this sub-outline into the overall outline
                outline.subtopics[i] = subOutline;
            }

            return outline;
        };

        // Create a nested outline
        let fullOutline = await generateNestedOutline(topLevelOutline);

        // // 6. Add an outline identifier to each topic
        // const addIdentifiers = (outline: any, identifier = "") => {
        //     // Check if the outline is a string, if so, return
        //     if (typeof outline === 'string') {
        //         return;
        //     }
        //     outline.topic = `${identifier} ${outline.topic}`;
        //     for (let i = 0; i < outline.subtopics.length; i++) {
        //         addIdentifiers(outline.subtopics[i], `${identifier}${i + 1}.`);
        //     }
        // };
        //
        // //Add identifiers to the outline
        // addIdentifiers(fullOutline);
        //
        // // 7. Make each topic a markdown heading
        // const markdownHeading = (outline: any, level = 1) => {
        //     if (typeof outline === 'object' && outline !== null) {
        //         outline.topic = `${"#".repeat(level)} ${outline.topic}`;
        //         if (Array.isArray(outline.subtopics)) {
        //             for (let i = 0; i < outline.subtopics.length; i++) {
        //                 markdownHeading(outline.subtopics[i], level + 1);
        //             }
        //         }
        //     }
        // };
        //
        // //Convert the outline topics to markdown format
        // markdownHeading(fullOutline);
        //
        // //8. Programmatically combine the topics into a single outline.
        // const combineHeading = (outline: any, str = "") => {
        //     str += `\n${outline.topic}`;
        //     for (let i = 0; i < outline.subtopics.length; i++) {
        //         str = combineHeading(outline.subtopics[i], str);
        //     }
        //     return str;
        // };
        //
        // //Combine headings into a single outline
        // let outlineString = combineHeading(fullOutline);

        // Store result in value
        let value = {
            type: "object",
            data: fullOutline
        };

        return value;
    }
    catch (e) {
        console.log(e);
        let value = {
            type: "text",
            data: ""
        };
    }
};

// @ts-ignore
export const getToolMetadata = ({apiKey, stopper, context, requestedParameters, requestedDocuments, statusLogger}) => {
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
        promptLLM: {
            description: "(personaString,promptString)=>Promise<String> // persona should be an empty string, promptString must include detailed instructions for the " +
                "LLM and any data that the prompt operates on as a string and MUST NOT EXCEED 25,000 characters.",
        },
        tellUser: {
            description: "(msg:string)//output a message to the user",
        },
        // generateSchema: {
        //     description: "(columnNames: string[], columnTypes: string[]):string // Generate a JSON schema from a list of column names and types. Types are one of the strings 'string', 'number', 'integer', or 'boolean'.",
        // },
        promptLLMForJson: {
            description: "(persona: string, prompt: string, desiredSchema: JsonSchema)=>Promise<any> // Prompt the LLM to generate JSON that matches a specified schema." +
                " This is useful for generating JSON for APIs, databases, or other systems that require a specific JSON schema.",
        },
        promptLLMInParallel: {
            description: "(prompts: string[])=>Promise<string[]> // Execute a promptLLM function in parallel on a list of prompts." +
                " This is useful if you need to do something to chunks or pages of a document and can prepare the prompts in advance them " +
                " send the work off in parallel.",
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
export const parameterizeTools = ({apiKey, stopper, context, requestedParameters, requestedDocuments, debugOutput, statusLogger}:params) => {

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

    const promptLLMFull: (persona: string, prompt: string, messageCallback?: (msg: string) => void, model?: OpenAIModelID, functions?: CustomFunction[], function_call?: string) => any = (persona: string, prompt: string, messageCallback?: (msg: string) => void, model?: OpenAIModelID, functions?: CustomFunction[], function_call?: string) => {
        // Grab the first 30 characters of the prompt
        statusLogger({summary: `Prompting: ${prompt}`, message: prompt, type: "info"});
        return doPrompt(apiKey, stopper, persona, prompt, messageCallback, model, functions, function_call);
    }

    const promptLLM = (persona: string, prompt: string) => {

        return promptLLMFull(persona, prompt);
    }

    // create a function that delegates to promptUntil but uses apiKey, stopper, and promptLLMFull
    const promptUntilFull = (
        persona: string,
        prompt: string,
        extract: (result: string) => any,
        check: (arg0: any) => boolean,
        tries: number,
        feedbackInserter?: (result: any, prompt: string) => string,
        errorInserter?: (e: any, cleaned: string | null, prompt: string) => string,
        model?: OpenAIModelID,
        functions?: CustomFunction[],
        function_call?: string) => {
        return promptUntil(promptLLMFull, persona, prompt, extract, check, tries, feedbackInserter, errorInserter, model, functions, function_call);
    }

    const promptForJson = (persona: string, prompt: string, jsonSchemaAsJsonObject: JsonSchema) =>{
        statusLogger({summary: `Prompting (json): ${prompt.slice(0,30)}`, message: prompt, type: "info"});
        return promptLLMForJson(promptLLMFull, persona, prompt, jsonSchemaAsJsonObject);
    }

    const allDocuments = () => {
        return documents;
    };

    return {
        // This creates reliability issues, so we are cutting it for now.
        // getParameter: {
        //     description: "(name:string, defaultValue:any)=>any Get a parameter from the workflow settings. You should" +
        //         " call this for each important variable in the workflow that may need changing for reuse.",
        //     exec: (name: string, defaultValue: any) => {
        //         console.log("getParameter", name, defaultValue);
        //         requestedParameters[name] = {defaultValue: defaultValue};
        //         return defaultValue;
        //     }
        // },
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
        // generateSchema: {
        //     description: "(columnNames: string[], columnTypes: string[]):string // Generate a JSON schema from a list of column names and types. Types are one of the strings 'string', 'number', 'integer', or 'boolean'.",
        //     exec: (columnNames: string[], columnTypes: ColumnTypes) => {
        //         return generateCSVSchema(columnNames, columnTypes);
        //     }
        // },
        promptLLMForJson: {
            description: "(persona: string, prompt: string, desiredSchema: JsonSchema)=>Promise<any> // Prompt the LLM to generate JSON that matches a specified schema." +
                " This is useful for generating JSON for APIs, databases, or other systems that require a specific JSON schema.",
            exec: promptForJson
        },
        promptLLMInParallel: {
            description: "(prompts: string[])=>Promise<string[]> // Execute a promptLLM function in parallel on a list of prompts." +
                " This is useful if you need to do something to chunks or pages of a document and can prepare the prompts in advance them " +
                " send the work off in parallel.",
            exec: (prompts: string[]) => {

                let promptObjs = prompts.map((pStr, index) => {
                    let p: Prompt = {
                        prompt: "" + pStr,
                        index: index
                    };

                    return p;
                });

                return promptLLMInParallel(promptLLM, stopper, statusLogger, promptObjs, 3)
            },
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
        // generateOutline: {
        //     description:"(topic:string, maxDepth:number, minSubtopics:number)=>Promise<{ \"type\": \"object\", \"properties\": { \"topic\": { \"type\": \"string\" }, \"subtopics\": { \"type\": \"array\", \"items\": { \"oneOf\": [{ \"$ref\": \"#\" }, { \"type\": \"string\" }] } } } }> Generate an outline for a topic.",
        //     exec: (topic:string, maxDepth:number, minSubtopics:number) => {
        //         return generateOutline(promptLLMFull, topic, maxDepth, minSubtopics);
        //     }
        // },
        // outlineToMarkdown: {
        //     description:"(outline:{\"type\":\"object\",\"properties\":{\"topic\":{\"type\":\"string\"},\"subtopics\":{\"type\":\"array\",\"items\":{\"oneOf\":[{\"$ref\":\"#\"},{\"type\":\"string\"}]}}},\"content\":{\"type\":\"string\"}})=>string Convert an outline to markdown.",
        //     exec: (outline:any) => {
        //         return convertToMarkdown(outline);
        //     }
        // },
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
