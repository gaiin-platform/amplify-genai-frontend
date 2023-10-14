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


export const promptLLMInParallel = (promptLLM:(root:string, prompt:string)=>Promise<string>, stopper:Stopper, prompts: Prompt[], maxConcurrency: number) => {
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

                if(stopper.shouldStop()){
                    reject("Interrupted");
                    return;
                }

                const result = await promptLLM(currentPrompt.rootPrompt || "", currentPrompt.prompt);

                console.log(`Finished prompt ${currentIndex} / ${prompts.length}`);
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
            return JSON.parse(rslt).arguments.json;
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


// @ts-ignore
export const parameterizeTools = ({apiKey, stopper, context, requestedParameters, requestedDocuments}) => {

    console.log("parameterizeTools", context, requestedParameters, requestedDocuments);

    const documents = [...context.inputs.documents];
    const parameters = {...context.inputs.parameters};

    const promptLLMFull: (persona: string, prompt: string, messageCallback?: (msg: string) => void, model?: OpenAIModelID, functions?: CustomFunction[], function_call?: string) => any = (persona: string, prompt: string, messageCallback?: (msg: string) => void, model?: OpenAIModelID, functions?: CustomFunction[], function_call?: string) =>
        doPrompt(apiKey, stopper, persona, prompt, messageCallback, model, functions, function_call);

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
        promptLLMForJson: {
            description: "(persona: string, prompt: string, desiredSchema: JsonSchema)=>Promise<any> Prompt the LLM to generate JSON that matches a specified schema." +
                " This is useful for generating JSON for APIs, databases, or other systems that require a specific JSON schema.",
            exec: promptForJson
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

                return promptLLMInParallel(promptLLM, stopper, promptObjs, 3)
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
        }
    };
}