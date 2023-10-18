import {OpenAIModelID, OpenAIModels} from "@/types/openai";
import {CustomFunction, JsonSchema, newMessage} from "@/types/chat";
import {sendChatRequest} from "@/services/chatService";
import {describeAsJsonSchema} from "@/utils/app/data";
import {InputDocument} from "@/types/workflow";
import {AttachedDocument} from "@/types/attacheddocument";


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

export function getErrorStackTrace(errorDetails: ErrorDetails): string {
    let stackTrace = '';
    if (errorDetails.lineNumber !== null) {
        stackTrace += `at workflow:${errorDetails.lineNumber}:${errorDetails.columnNumber}\n`;
    }
    stackTrace += errorDetails.stackTrace;
    return stackTrace;
}


function parseJSONObjects(str: string) {
    let stack = [];
    let result = [];
    let temp = "";
    let inString = false;
    let inObjectOrArray = false;

    for (let ch of str) {
        if (ch === '"' && str[str.indexOf(ch) - 1] !== '\\') {
            inString = !inString;
        }

        if (!inString) {
            if (ch === '{' || ch === '[') {
                inObjectOrArray = true;
                stack.push(ch);
                temp += ch;
            } else if ((ch === '}' && stack[stack.length - 1] === '{') || (ch === ']' && stack[stack.length - 1] === '[')) {
                stack.pop();
                temp += ch;

                if (stack.length === 0) {
                    inObjectOrArray = false;
                    result.push(JSON.parse(temp));
                    temp = "";
                }
            } else if (inObjectOrArray) {
                temp += ch;
            }
        } else {
            temp += ch;
        }
    }

    while (result.length === 1) {
        result = result.pop();
    }

    return result;
}


export function evaluateWithLineNumber(code: string): ErrorDetails|null {
    try {
        eval(code);
        return null;
    } catch (error) {
        if (error instanceof EvalError) {
            const errorDetails = extractErrorDetails(error);
            return errorDetails;
        } else {
            if(error instanceof Error) {
                return {
                    message: error.message,
                    stackTrace: error.stack || '',
                    lineNumber: null,
                    columnNumber: null,
                };
            }
            else {
                return {
                    message: "Unknown error",
                    stackTrace: '',
                    lineNumber: null,
                    columnNumber: null,
                };
            }
        }
    }
}


interface ErrorDetails {
    message: string;
    stackTrace: string;
    lineNumber: number | null;
    columnNumber: number | null;
}

function extractErrorDetails(error: EvalError): ErrorDetails {
    const errorDetails: ErrorDetails = {
        message: error.message,
        stackTrace: error.stack || '',
        lineNumber: null,
        columnNumber: null,
    };

    const stackTraceLines = errorDetails.stackTrace.split('\n');
    const evalLine = stackTraceLines.find((line) => line.includes('eval'));
    if (evalLine) {
        const matchedLines = evalLine.match(/eval[^:]*:([0-9]+):([0-9]+)/);
        if (matchedLines && matchedLines.length > 2) {
            errorDetails.lineNumber = parseInt(matchedLines[1]);
            errorDetails.columnNumber = parseInt(matchedLines[2]);
        }
    }

    return errorDetails;
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
            }, model || OpenAIModelID.GPT_3_5, functions, function_call);

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

            try {
                console.log(`Executing prompt ${currentIndex} / ${prompts.length}`);
                // Execute the promptLLM function and store the result in the correct index.

               statusLogger({summary: `Prompting ${currentIndex} / ${prompts.length}...`, message: prompt, type: "info"});

                if(stopper.shouldStop()){
                    reject("Interrupted");
                    return;
                }

                const result = await promptLLM(currentPrompt.rootPrompt || "", currentPrompt.prompt);

                console.log(`Finished prompt ${currentIndex} / ${prompts.length}`);
                statusLogger({summary: `Finished ${currentIndex} / ${prompts.length}...`, message: prompt, type: "info"});
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
        model || OpenAIModelID.GPT_3_5_FN,
        functionsToCall,
        jsonFunction
    );
}

const statusMessage = (message:string)=> {
    const topicShort = (message.length > 30) ? message.slice(0, 30) + "..." : message;
    return {
        summary: `${topicShort}...`,
        message: message,
        type: "info"
    };
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

const generateOutline = async (statusLogger:any, promptLLMFull:any, topic:string, maxDepth:number, minSubtopics:number) => {
    try {
        console.log("Creating an outline for a topic: Computer Incident Response.");

        statusLogger({summary: `Outlining...`, message: topic, type: "info"});


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
                // const msg = `Generating ${i}/${outline.subtopics.length} at depth ${depth} for subtopic ${subTopic}`;
                // const topicShort = (subTopic.length > 30) ? subTopic.slice(0, 30) + "..." : subTopic;
                // const summary = `Outlining ${topicShort}...`;
                statusLogger(statusMessage("Outlining "+ subTopic));


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

        return fullOutline;
    }
    catch (e) {
        console.log(e);
        let value = {
            type: "text",
            data: ""
        };
    }
};

const applyPromptToDocument = async (promptLLM:any, promptLLMInParallel:any, document:string, persona:string, prompt:string) => {

    try {

        // Fetch pdf as a raw string
        let documentString = document;

        // Split the document into 5000 character chunks
        let chunks = splitStringIntoChunks(documentString, 5000);

        // Prepare prompts for the LLM to ask about techniques discussed in each chunk
        let prompts:string[] = chunks.map(chunk => `${prompt}:\n----------------------------\n ${chunk}`);
        // let promptPass2:string[] = chunks.map(chunk => `${prompt}:\n----------------------------\n ${chunk}`);
        // let promptPass3:string[] = chunks.map(chunk => `${prompt}:\n----------------------------\n ${chunk}`);
        // prompts = [...prompts, ...promptPass2, ...promptPass3];

        console.log("Will send prompts to LLM: ", prompts.length);
        // Prompt the LLM in parallel with each prompt
        let results = await promptLLMInParallel(prompts);

        // Perform a reduce of the results by prompting the LLM
        // Ask it to filter the current aggregated result and the next chunk to combine them and remove duplicates
        let aggregate = '';
        for (let result of results) {

            const reducePrompt = `
                Take the current aggregated list of techniques and the next chunk and combine them into a new aggregated result, ensuring there are no duplicates.
                
                Aggregated Result:
                ---------------------------------
                ${aggregate}
                
                ---------------------------------
                
                Next Chunk:
                ---------------------------------
                ${result}
                ---------------------------------
                
                De Duplicated Result:
                ---------------------------------
            `

            aggregate = await promptLLM("", reducePrompt);
        }

        return aggregate;
    } catch (e) {
        throw e;
    }
}


// @ts-ignore
export const parameterizeTools = ({apiKey, stopper, context, requestedParameters, requestedDocuments, statusLogger}) => {

    console.log("parameterizeTools", context, requestedParameters, requestedDocuments);

    const documents = [...context.inputs.documents];
    const parameters = {...context.inputs.parameters};

    const promptLLMFull: (persona: string, prompt: string, messageCallback?: (msg: string) => void, model?: OpenAIModelID, functions?: CustomFunction[], function_call?: string) => any = (persona: string, prompt: string, messageCallback?: (msg: string) => void, model?: OpenAIModelID, functions?: CustomFunction[], function_call?: string) => {
        // Grab the first 30 characters of the prompt
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
        promptLLM: {
            description: "async (personaString,promptString):Promise<String> //persona should be an empty string, promptString must include detailed instructions for the " +
                "LLM and any data that the prompt operates on as a string and MUST NOT EXCEED 25,000 characters.",
            exec: (persona: string, prompt: string) => {
                statusLogger(statusMessage("Prompting '"+prompt+"'"));
                return promptLLM(persona, prompt);
            }
        },
        promptLLMForJson: {
            description: "(persona: string, prompt: string, desiredSchema: JsonSchema)=>Promise<any> Prompt the LLM to generate JSON that matches a specified schema." +
                " This is useful for generating JSON for APIs, databases, or other systems that require a specific JSON schema.",
            exec: (persona: string, prompt: string, jsonSchemaAsJsonObject: JsonSchema) => {
                statusLogger(statusMessage("Prompting JSON '"+prompt+"'"));
                return promptForJson(persona, prompt, jsonSchemaAsJsonObject);
            }
        },
        promptLLMInParallel: {
            description: "(prompts: string[])=>Promise<string>[] Execute a promptLLM function in parallel on a list of prompts." +
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
        applyPromptToDocument: {
            description:"(document:string, persona:string, prompt:string) => Promise<string>",
            exec: (document:string, persona:string, prompt:string) => {
                const promptLLMInParallelDeep = (prompts: string[]) =>{
                    let promptObjs = prompts.map((pStr, index) => {
                        let p: Prompt = {
                            prompt: "" + pStr,
                            index: index
                        };

                        return p;
                    });

                    return promptLLMInParallel(promptLLM, stopper, statusLogger, promptObjs, 5);
                };

                return applyPromptToDocument(promptLLM, promptLLMInParallelDeep, document, persona, prompt);
            }
        },
        generateOutline: {
            description:"(topic:string, maxDepth:number, minSubtopics:number)=>Promise<{ \"type\": \"object\", \"properties\": { \"topic\": { \"type\": \"string\" }, \"subtopics\": { \"type\": \"array\", \"items\": { \"oneOf\": [{ \"$ref\": \"#\" }, { \"type\": \"string\" }] } } } }> Generate an outline for a topic.",
            exec: (topic:string, maxDepth:number, minSubtopics:number) => {
                return generateOutline(statusLogger, promptLLMFull, topic, maxDepth, minSubtopics);
            }
        },
        outlineToMarkdown: {
            description:"(outline:{\"type\":\"object\",\"properties\":{\"topic\":{\"type\":\"string\"},\"subtopics\":{\"type\":\"array\",\"items\":{\"oneOf\":[{\"$ref\":\"#\"},{\"type\":\"string\"}]}}},\"content\":{\"type\":\"string\"}})=>string Convert an outline to markdown.",
            exec: (outline:any) => {
                return convertToMarkdown(outline);
            }
        },
        getDocuments: {

            description: "():[{name:string,raw:string},...]// returns an array of documents with name and raw properties." +
                " Use this function to access all documents as strings.",
            exec: () => {
                requestedDocuments.push("*");
                return allDocuments();
            },
        },
        getDocument: {
            description: "(name:string)=>{name:string,raw:string} Get a document by name.",
            exec: (name: string) => {
                requestedDocuments.push(name);
                return allDocuments().find(document => document.name === name);
            }
        },

    };
}

