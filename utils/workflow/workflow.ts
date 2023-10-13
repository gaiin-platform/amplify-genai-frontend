import {ChatBody, CustomFunction, JsonSchema, newMessage} from "@/types/chat";
import {sendChatRequest} from "@/services/chatService";
import {findWorkflowPattern, generateWorkflowPrompt, describeTools} from "@/utils/workflow/aiflow";
import {OpenAIModelID, OpenAIModels} from "@/types/openai";
import {WorkflowDefinition} from "@/types/workflow";
import {describeAsJsonSchema, extractFirstCodeBlock, extractSection} from "@/utils/app/data";
import {parameterizeTools as coreTools} from "@/utils/app/tools";
import {AttachedDocument} from "@/types/attacheddocument";


interface AiTool {
    description: string,
    exec: (...args: any[]) => any;
}

interface Stopper {
    shouldStop: () => boolean,
    signal: AbortSignal
}


interface ReusableDescription {
    name: string,
    description: string,
    params: [{
        name: string,
        type: string,
        description: string,
        defaultValue: string,
        usage: string,
    }],
    paramInstructions: string,
}

const abortResult = {success: false, code: null, exec: null, uncleanCode: null, result: null};


async function generateReusableFunctionDescription(promptLLMForJson:any, javascriptPersona: string, task: string, prompt: string):Promise<ReusableDescription|null> {

    let reusableDescription = null;

    const functionSchema = {
        "type": "object",
        "properties": {
            "functionName": {
                "type": "string",
                "description": "The name of the function."
            },
            "parameters": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "The name of the parameter."
                        },
                        "jsonSchema": {
                            "type": "string",
                            "description": "A JSON Schema for the parameter as a string."
                        },
                        "description": {
                            "type": "string",
                            "description": "A brief description of the parameter."
                        }
                    },
                    "required": ["name", "jsonSchema", "description"]
                },
                "description": "The list of parameters the function accepts."
            },
            "functionDescription": {
                "type": "string",
                "description": "A brief description of what the function does."
            }
        },
        "required": ["functionName", "parameters", "functionDescription"]
    };

    let reuseParams = [];
    try {
        const jsonFnCode = await promptLLMForJson(
            javascriptPersona,
            `Describe a reusable Javascript function to perform the task "${task}".
                Think step by step what parameters in the task might change. Think about how to make
                the function as reusable and useful as possible while not introducing too many
                parameters.`,
            functionSchema,
        );

        console.log("JSON Function:", jsonFnCode);

        // Iterate through each of the paramaters in jsonFnCode
        for (let param of jsonFnCode.parameters) {
            // If the parameter is a string, prompt the user for a string
            let stringParam = await promptLLMForJson(
                javascriptPersona,
                `Provide a default value for "${param.name}" in the function:
                        ------------------------------------------- 
                        ${jsonFnCode.functionName} -
                        ${jsonFnCode.functionDescription}
                        -------------------------------------------
                        The parameter's JSON schema is:
                        ${param.jsonSchema}
                        -------------------------------------------
                        `,
                {
                    "type": "object",
                    "properties": {
                        "defaultValueAsJSON": {
                            "type": "string",
                            "description": "A JSON value that will be assigned as the default value with JSON.parse(..default value..)."
                        }
                    },
                    "required": ["defaultValueAsJSON"]
                },
            );

            console.log("Param Default Value:", stringParam);

            let usage = await promptLLMForJson(
                javascriptPersona,
                `
                        Background of how you are going to implement this function:
                        ----------------- Background -----------------
                        ${prompt}
                        ------------------Current Task----------------
                         Provide a one sentence description of how to use "${param.name}" 
                        in the implementation of the Javascript function:
                        
                        ${jsonFnCode.functionName} -
                        ${jsonFnCode.functionDescription}
                        
                        The parameter's JSON schema is:
                        ${param.jsonSchema}
                        
                        It's default value is:
                        ${stringParam["defaultValueAsJSON"]}
                        -------------------------------------------
                        `,
                {
                    "type": "object",
                    "properties": {
                        "howWouldYouUseTheParameter": {
                            "type": "string",
                            "description": "A one sentence description of how you would use the parameter in the function."
                        }
                    },
                    "required": ["defaultValueAsJSON"]
                },
            );

            reuseParams.push({
                name: param.name,
                type: param.jsonSchema,
                description: param.description,
                defaultValue: stringParam["defaultValueAsJSON"],
                usage: usage["howWouldYouUseTheParameter"],
            })

        }

        let paramStr = reuseParams.map((param) => {
            return `// ${param.description}
                    // ${param.usage}
                    let ${param.name} = fnlibs.getParameter("${param.name}", ${JSON.stringify(param.defaultValue)})`;
        }).join("\n");
        console.log("Param String:", paramStr);

        reusableDescription = {
            name: jsonFnCode.functionName,
            description: jsonFnCode.functionDescription,
            params: reuseParams,
            paramInstructions: paramStr,
        }

    } catch (e) {
        console.log(e);
    }

    return reusableDescription;
}

export const executeJSWorkflow = async (apiKey: string, task: string, customTools: { [p: string]: AiTool }, stopper: Stopper, incrementalPromptResultCallback: (responseText: string) => void) => {


    const promptLLMFull = async (persona: string, prompt: string, messageCallback?: (msg: string) => void, model?: OpenAIModelID, functions?: CustomFunction[], function_call?: string) => {

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

    const promptLLMCode = (persona: string, prompt: string) => {
        return promptLLMFull(persona, prompt, incrementalPromptResultCallback);
    }
    const promptLLM = (persona: string, prompt: string) => {
        return promptLLMFull(persona, prompt);
    }

    const workflowGlobalParams = {
        requestedParameters:{},
        requestedDocuments:[],
        apiKey: apiKey,
        stopper: stopper}

    const parameterizedTools = coreTools(workflowGlobalParams);

    const tools: { [name: string]: AiTool } = {
        promptLLM: {
            description: "async (personaString,promptString):Promise<String> //persona should be an empty string, promptString must include detailed instructions for the " +
                "LLM and any data that the prompt operates on as a string and MUST NOT EXCEED 25,000 characters.",
            exec: promptLLM
        },

        tellUser: {
            description: "(msg:string)//output a message to the user",
            exec: (msg: string) => console.log(msg),
        },

        ...parameterizedTools,
        // readXlsxFile: {
        //     description:"(document.raw)=>Promise<[[row1col1,row1col2,...],[row2col1,row2col2...]...]>",
        //     exec: readXlsxFile
        // },
        //log: { description:"(msgString):void", exec:(msgString: string) => console.log(msgString)},
        ...customTools,
    };

    function extractCodeBlocks(str: string) {
        const pattern = /```(\w*)\n([^`]*?)```/gms;
        let match;
        const blocks = [];

        while ((match = pattern.exec(str)) !== null) {
            blocks.push({
                language: match[1],
                code: match[2]
            });
        }

        return blocks;
    }

    const promptUntil = async (
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

                //console.log("Raw result:", raw);

                cleaned = extract(raw || "");

                //console.log("cleaned", cleaned);

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

    const promptForCode = async (
        persona: string,
        prompt: string,
        check: (arg0: any) => boolean,
        tries: number,
        feedbackInserter?: (result: any, prompt: string) => string,
        errorInserter?: (e: any, cleaned: string | null, prompt: string) => string,
        model?: OpenAIModelID) => {

        const cleaner = (rawCode: string) => {
            return extractCodeBlocks(rawCode || "")[0].code;
        }

        const checker = (cleanedFn: string) => {
            let context = {
                result: null
            };
            eval("context.result = " + cleanedFn + ";")
            return check(context.result);
        }

        return promptUntil(persona, prompt, cleaner, checker, tries, feedbackInserter, errorInserter, model);
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

    const promptLLMForJson = async (persona: string,
                                    instructions: string,
                                    desiredSchema: JsonSchema,
                                    check?: (arg0: any) => boolean,
                                    feedbackInserter?: (result: any, prompt: string) => string,
                                    errorInserter?: (e: any, cleaned: string | null, prompt: string) => string,
                                    model?: OpenAIModelID) => {
        const prompt = instructions;

        const systemPrompt = "You are ChatGPT, a large language model trained by OpenAI. " +
            "Follow the user's instructions carefully. " +
            "Respond using JSON. ";

        let functionsToCall = [...jsonFunctions];

        // @ts-ignore
        functionsToCall[0].parameters.properties[jsonProperty] = desiredSchema;

        check = (check) ? check : (json) => json;

        return promptUntil(systemPrompt + persona, prompt,
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


    const selectFunction = "correctAnswer";
    const selectedOptionsProperty = "selectedOptionsForAnswer";
    const selectFunctions: CustomFunction[] = [
        {
            name: selectFunction,
            description: "call this function to indicate the correct options for the question",
            parameters: {
                type: "object",
                properties: {
                    [selectedOptionsProperty]: {
                        type: "array",
                        description: "the correct answers to the question",
                        items: {
                            type: "object", properties: {
                                "option": {type: "number"},
                                "optionExplanation": {type: "string"},
                                "optionRelevant": {type: "boolean"}
                            }
                        }
                    },
                },
                "required": ["selectedOptionsForAnswer"]
            }
        },
    ];

    interface Option {
        id: string,
        description: any,
    }

    const promptLLMSelectFromOptions = async (persona: string, instructions: string, options: Option[], model?: OpenAIModelID) => {
        options.push({
            id: "none of the above", description: "none of the tools are relevant for this " +
                "task (can only be selected by itself)"
        });

        const prompt = `
            Select the correct options answer the question. "${instructions}":
                
        Please choose
            from the following options:
        ------------------ ${options.map((option: Option, index: number) => {
                return "\t\t" + index + ". " + option.id +
                        " : " + option.description.replaceAll("\n", " ")
            }).join("\n")}
                 ------------------
                You may also answer
            with an empty selection.ONLY CHOOSE OPTIONS
            ON THE LIST.
        `;

        const systemPrompt = "You are ChatGPT, a large language model trained by OpenAI. " +
            "Follow the user's instructions carefully. " +
            "Respond using JSON. ";

        console.log("Select Options Prompt:", prompt);


        return promptUntil(systemPrompt + persona, prompt,
            (rslt) => {

                let json = JSON.parse(rslt);
                const selected = (obj: { arguments: { selectedOptionsForAnswer: { option: number, optionRelevant: boolean }[] } }) =>
                    new Map(obj.arguments.selectedOptionsForAnswer.map(optionObj => [optionObj.option, optionObj.optionRelevant]));

                // Check if the user selected "none of the above"
                return selected(json).get(options.length - 1) === true ?
                    [] :
                    options.filter((option, index) => selected(json).get(index) === true);
            },
            (selectedOptions) => selectedOptions != null,
            3,
            // @ts-ignore
            null,
            null,
            OpenAIModelID.GPT_3_5_FN,
            selectFunctions,
            selectFunction
        );
    }


    // const jsonFn = await promptLLMForJson(
    //     "Act as an expert Javascript developer.",
    //     "Write simple, concise code with no imports for the task:\n" +
    //     "-----------------------------------------\n" +
    //     task +
    //     "-----------------------------------------\n" +
    //     "The function interface should be:  const workflow = async (fnLibs) => { } " +
    //     "Do not output any other code to call the function. Just output the function." +
    //     "You should return a result from the function in the format {type:'text,table',data:<your output>}.",
    //     {
    //         "type": "object",
    //         "properties": {
    //             "functionInterface": {
    //                 "type": "string",
    //                 "description": "Javascript function interface specification"
    //             },
    //             "functionBody": {
    //                 "type": "string",
    //                 "description": "body of the javascript function MUST include the function interface and be written" +
    //                     " so that the function can be called by invoking workflow(fnLibs)"
    //             }
    //         },
    //         "required": ["functionInterface", "functionBody"]
    //     },
    //     (json) => {
    //
    //         try {
    //             console.log("Checking generated fn...")
    //
    //             let context = {
    //                 workflow: (fnlibs: {}): any => {
    //                 },
    //                 result:{}
    //             };
    //
    //             let fnLibs = {};
    //
    //             const codeToEval = "" + json.arguments.json.functionBody + "\n\n context.result = workflow;";
    //             console.log("Will eval:", codeToEval);
    //
    //             context.result(fnLibs).then((result: any) => {
    //                 console.log("JSON Prompt Code Eval:",result);
    //             });
    //
    //
    //         }catch (e) {
    //             console.log(e);
    //         }
    //
    //         return json;
    //     }
    // );
    //
    // console.log("JSON Function:", jsonFn);

    // const opts = await promptLLMSelectFromOptions(
    //     "Act as an expert Javascript developer.",
    //     `Which of the following tools are relevant for "${task}".`,
    //     [{
    //         id: "promptLLM", description: "ask the large language to perform reasoning, writing, " +
    //             "summarizing, outlining, brainstorming, or natural language processing tasks " +
    //             "(no tasks that could be performed faster by code"
    //     },
    //         {id: "encrypt", description: "encrypt a message"},
    //         {id: "decrypt", description: "decrypt a message"},
    //         {id: "log", description: "log a message"},
    //     ]
    // );
    //
    // console.log("Options:", opts);


    //console.log("AI Tools:", aiSelectedTools);


    //Write simple, concise code that does not rely on any library functions.  The code must start with ```{{language}} and end with ```.  Write a {{language}} function {{Signature}} {{Input}} that returns {{Output}}
    // @ts-ignore
    const extraInstructions = [
        "Try to do as much work in code as possible without prompting the LLM. Only prompt the LLM for outlining, " +
        "analyzing text, summarizing, writing, and other natural language processing tasks.",
        "Calling promptLLM is expensive. Only do this if you really need its natural language processing capabilities." +
        " You shouldn't call this function to do things you could easily do in regular Javascript.",

        "If there is a library that you wish you had been able to use, include a comment about that in" +
        "the code in the form '// @library-wish <name-of-npm-module>. Note, only client-side libraries are allowed.",

        // @ts-ignore
        (tools.getDocuments && tools.getDocuments.exec().length > 0) ?
            "Before using a document, make sure and describe its structure and properties relevant to the task." +
            "Then, think step-by-step how to use the document properties to accomplish the task." : "",
        "When you produce a result, produce it as a json object has the following format:" +
        "{type:'text,table,code',data:<your output>}. If you specify a table, you should make" +
        " the output an array of objects where each object is a row and the properties of the object " +
        "are the columns. For text, make sure your output is a string that can also have markdown. For" +
        " code, your output should be a string."
    ];

    if (stopper.shouldStop()) {
        return abortResult;
    }
    let prompt = generateWorkflowPrompt(task, tools, extraInstructions);

    console.log("Code generation prompt:", prompt);


    let success = false;
    let tries = 3;

    let finalFn = null;
    let fnResult = "";
    let cleanedFn: string | null = null;
    let uncleanedCode = null;

    const javascriptPersona = `Write simple, concise code with no imports. Write prompts with
    step by step instructions that clearly explain the task in concrete detail. Your plans are 
    extremely detailed and concrete with steps in your plans being easily translatable to code.
    
    RULES:
    --------------
    1. You CAN but are NOT REQUIRED to prompt the LLM to perform tasks that require reasoning about text, writing text, outlining text,
       extracting or filtering information from text, etc. However, you don't use the LLM for basic string
       manipulation, such as combining or joining outputs, unless they need to be potentially converted into
       another textual format. 
    2. If you are summarizing, outlining, filtering, extracting, etc. with text, make sure the prompt is designed
       to be totally factual and not include details that aren't in the original information.
    3. You can use any standard Javascript that you want, just don't access global state, the document, etc.
    4. You can define helper functions, but they must be defined inside of the workflow function.
    5. Prompt in parallel when possible.
    6. DO AS MUCH IN CODE AS POSSIBLE AND ONLY PROMPT the LLM if ABSOLUTELY REQUIRED FOR TEXT PROCESSING AND REASONING
    `;

    while (!success && tries > 0 && !stopper.shouldStop()) {

        console.log("Prompting for the code for task: ", task);
        const reuseDesc = await generateReusableFunctionDescription(promptLLMForJson, javascriptPersona, task, prompt);

        prompt = generateWorkflowPrompt(task, tools, extraInstructions, [reuseDesc?.paramInstructions]);

        //console.log("PROMPT: ", task);
        //console.log(prompt);

        await tools.tellUser.exec("Thinking...");
        uncleanedCode = await promptLLMCode(javascriptPersona, prompt);

        if (stopper.shouldStop()) {
            return abortResult;
        }
        //console.log("Uncleaed code:", uncleanedCode)

        const findFn = (code: string) => {
            try {
                return findWorkflowPattern(code);
            } catch (e) {
            }
            return null;
        }

        cleanedFn = findWorkflowPattern(uncleanedCode || "");
        const originalCleanedFn = cleanedFn;

        // Some fallbacks to handle truncation of the output at the very end...the alternative
        // is a slow roudtrip to the LLM again
        cleanedFn = (!cleanedFn) ? extractSection(uncleanedCode || "", "@START_WORKFLOW", "@END_WORKFLOW") : cleanedFn;
        cleanedFn = (!cleanedFn) ? extractFirstCodeBlock(uncleanedCode || "") : cleanedFn;

        finalFn = null;
        fnResult = "";

        console.log(cleanedFn);
        console.log(cleanedFn);
        if (cleanedFn != null) {

            try {

                const fnlibs = {}
                Object.entries(tools).forEach(([key, tool]) => {
                    // @ts-ignore
                    fnlibs[key] = tool.exec;
                })

                if (stopper.shouldStop()) {
                    return abortResult;
                }

                tools.tellUser.exec("Running the workflow...");
                let context = {
                    workflow: (fnlibs: {}): any => {
                    }
                };
                eval("context.workflow = " + cleanedFn);

                console.log("workflow fn", context.workflow);

                finalFn = context.workflow;
                let result = await context.workflow(fnlibs);

                console.log("Workflow Parameters:", workflowGlobalParams.requestedParameters);
                console.log("Workflow Documents:", workflowGlobalParams.requestedDocuments);

                console.log("Result:", result);
                console.log("Will try again:", result == null);
                fnResult = result;
                success = result != null;

            } catch (e) {
                console.log(e);
                tools.tellUser.exec("I made a mistake, trying again...");
            }

            tries = tries - 1;
        }

        // Go through the requestedParameters and map each one to:
        // {name, description, jsonSchema, defaultValue} using additional information from reusableDescription


        if (success) {
            return {success: success,
                reusableDescription: reuseDesc,
                inputs: {
                    parameters: {...workflowGlobalParams.requestedParameters},
                    documents: [...workflowGlobalParams.requestedDocuments],
                },
                code: cleanedFn,
                exec: finalFn,
                uncleanCode: uncleanedCode,
                result: fnResult};
        }
    }
    return {success: false, inputs:{}, code: cleanedFn, exec: finalFn, uncleanCode: uncleanedCode, result: fnResult};
};


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

export default class Workflow {

    constructor(public name: string, public workflow: Op[]) {
    }

    runner = (extraOps: any, initialContext: Context | undefined, listener: (stage: string, op: Op, data: {}) => void) => {
        return createWorkflowRunner(
            this.workflow,
            {...ops, ...extraOps},
            initialContext,
            listener
        );
    }

    run = async (initialContext: Context, extraOps: {}, listener: { (stage: string, op: Op, data: {}): void }) => {
        return new Promise(async (resolve, reject) => {
            try {
                const runner = createWorkflowRunner(this.workflow, {...ops, ...extraOps}, initialContext, listener);

                let result;
                for await (const res of runner()) {
                    result = await res; // Hold onto the result to retrieve the final context
                    //console.log(`Generator returned: ${JSON.stringify(result)}`, result);
                }

                // Resolve with the final context
                resolve(result ? result[0] : initialContext);

            } catch (error) {
                console.error(`Error running workflow: ${error}`);
                reject(error);
            }
        });
    };
}

export interface Context {
    [key: string]: any;
}

export interface Op {
    op: string;

    [otherProps: string]: any;
}

export interface OpRunner {
    (op: Op, context: Context): Promise<any>;
}

export function fillTemplate(template: string, context: Context): string {
    return template.replace(/\{\{([^}]+)\}\}/g, function (_matchedString, key) {
        let value: any = context;

        key.split('.').forEach((k: string | number) => {

            console.log(k, JSON.stringify(value[k]));

            if (value && value.hasOwnProperty(k)) {
                value = value[k];
            } else {
                value = undefined;
            }
        });

        if (value && typeof value !== 'string') {
            value = JSON.stringify(value);
        }

        return typeof value !== 'undefined' ? value : '';
    });
}

export const ops: { [opName: string]: OpRunner } = {

    prompt: async (op: Op, context: Context) => {

        if (!op.message) throw new Error("The 'message' property is missing in 'send' operation.");

        let message = newMessage({
            ...op.message,
            content: fillTemplate(op.message.content, context)
        });

        const chatBody: ChatBody = {
            model: op.model,
            messages: [message],
            key: op.apiKey,
            prompt: op.rootPrompt,
            temperature: op.temperature,
        };

        return new Promise((resolve, reject) => {
            sendChatRequest(chatBody, null, null)
                .then(async (result) => {
                    let data = await result.text()
                    resolve(data);
                })
        });

    },

    extractJson: async (op: Op, context: Context) => {
        // Given json mixed with text describing it, this
        // function will find and extract all of the valid json
        // and return a list of the valid json objects it found

        return parseJSONObjects(fillTemplate(op.input, context));
    },

    input: async (op: Op, context: Context) => {
        // Placeholder function for input
        return op.variables; // handle input operation
    },

    split: async (op: Op, context: Context) => {
        // Placeholder function for split
        return [context[op.input]]; // handle split operation
    },

    map: async (op: Op, context: Context) => {
        let result = [];

        console.log("Map", context[op.input]);

        for (const item of context[op.input]) {

            const newContext = {...context, [op.itemVariable]: item};

            for (const operation of op.function) {
                const mapResult = await executeOp(operation, newContext);
                console.log("mapResult", mapResult["_output"]);
                result.push(mapResult["_output"]);
            }
        }
        return result;
    },

    format: async (op: Op, context: Context) => {
        let result = fillTemplate(op.input, context);
        return result;
    },

    join: async (op: Op, context: Context) => {
        const stringify = (s: any) => {
            return (typeof s !== 'string') ? JSON.stringify(s) : s;
        };

        const sep = op.separator ? op.separator : "";
        let result = context[op.input].reduce((s: any, v: any) => stringify(s) + sep + stringify(v));
        return result;
    },

    parallel: async (op: Op, context: Context) => {
        return await Promise.all(op.ops.map((itemOp: Op) => executeOp(itemOp, context)));
    },

    sequential: async (op: Op, context: Context) => {
        let result;
        let results = []

        // Force a deep copy to avoid shenanigans
        let tempContext = JSON.parse(JSON.stringify(context));

        for (const itemOp of op.ops) {
            result = await executeOp(itemOp, tempContext);
            results.push(JSON.parse(JSON.stringify(result)));

            if (itemOp.output) {
                tempContext[itemOp.output] = result[itemOp.output];
            }
        }
        return results;
    },

    fetch: async (op: Op, context: Context) => {
        const response = await fetch(op.url, {
            method: op.method || 'GET',
            headers: op.headers || {},
            body: op.body || null,
        });
        return response.json();
    },

    parseJSON: async (op: Op, context: Context) => {
        return JSON.parse(context[op.input]);
    },

    domQuery: async (op: Op, context: Context) => {
        return document.querySelectorAll(op.query);
    },

    localStorage: async (op: Op, context: Context) => {
        switch (op.action) {
            case 'get':
                return localStorage.getItem(op.key);
            case 'set':
                localStorage.setItem(op.key, op.value);
                break;
            case 'remove':
                localStorage.removeItem(op.key);
                break;
        }
    },

    sessionStorage: async (op: Op, context: Context) => {
        switch (op.action) {
            case 'get':
                return sessionStorage.getItem(op.key);
            case 'set':
                sessionStorage.setItem(op.key, op.value);
                break;
            case 'remove':
                sessionStorage.removeItem(op.key);
                break;
        }
    },

    cookie: async (op: Op, context: Context) => {
        const key = fillTemplate(op.key, context);
        const value = fillTemplate(op.value, context);

        switch (op.action) {
            case 'get':
                // @ts-ignore
                return document.cookie.split('; ').find(row => row.startsWith(key)).split('=')[1];
            case 'set':
                document.cookie = `${key}=${value}`;
                break;
            case 'remove':
                document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
                break;
        }
    },

    redirect: async (op: Op, context: Context) => {
        window.location.href = fillTemplate(op.url, context);
    },

    // executeJS: async (op: Op, context: Context) => {
    //     return eval(op.script);
    // },

    formInput: async (op: Op, context: Context) => {
        const form = document.querySelector(op.formSelector);
        if (form) {
            const input = form.querySelector(op.fieldSelector);
            if (input) input.value = op.value;
        }
    },

    click: async (op: Op, context: Context) => {
        const element = document.querySelector(op.selector);
        if (element) {
            element.click();
        }
    },

    geolocation: async (op: Op, context: Context) => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject("Geolocation is not supported by your browser");
            } else {
                navigator.geolocation.getCurrentPosition(position => resolve(position), err => reject(err));
            }
        });
    },

    notification: async (op: Op, context: Context) => {
        const title = fillTemplate(op.title, context);

        if (!("Notification" in window)) {
            throw new Error("This browser does not support desktop notification");
        } else if (Notification.permission === "granted") {
            const notification = new Notification(title, op.options);
        } else { // @ts-ignore
            if (Notification.permission !== 'denied' || Notification.permission === "default") {
                const permission = await Notification.requestPermission();
                if (permission === "granted") {
                    const notification = new Notification(title, op.options);
                }
            }
        }
    },

    history: async (op: Op, context: Context) => {
        switch (op.action) {
            case 'push':
                history.pushState(op.state, op.title, op.url);
                break;
            case 'replace':
                history.replaceState(op.state, op.title, op.url);
                break;
            case 'back':
                history.back();
                break;
            case 'forward':
                history.forward();
                break;
            case 'go':
                history.go(op.value);
                break;
        }
    },

    fileAPI: async (op: Op, context: Context) => {
        // Placeholder function for File API. Detailed implementation will depend on the type of operation e.g. readFile, writeFile, etc.
        console.log('File API used');
    },

    navigator: async (op: Op, context: Context) => {
        // @ts-ignore
        return navigator[op.property];
    },

    audioAPI: async (op: Op, context: Context) => {
        const audioContext = new AudioContext();
        const oscillator = audioContext.createOscillator();
        oscillator.type = 'square';
        oscillator.frequency.value = 3000;
        oscillator.start();
        return oscillator;
    },

    consoleLog: async (op: Op, context: Context) => {
        console.log(fillTemplate(op.message, context));
    },

    noOp: async (op: Op, context: Context) => {
    }
};

export async function executeOp(operation: Op, context: Context = {}): Promise<any> {
    const opRunner = ops[operation.op];
    if (!opRunner) throw new Error(`Unknown operation: ${operation.op}`);

    let localContext = {...context}
    const result = await opRunner(operation, localContext);

    if (operation.output) {
        localContext[operation.output] = result;
    }
    localContext["_output"] = result;

    return localContext;
}

export interface WorkflowRunner {
    (): AsyncGenerator<Promise<any>, void, any>;
}

export const createWorkflowRunner = (
    workflow: Op[],
    executors: Record<string, (op: Op, context: Context) => Promise<any>>,
    initialContext: Context = {},
    listener: (stage: string, op: Op, data: {}) => void
) => {
    return async function* () {
        const context = {...initialContext};

        listener('workflow:start', {op: "noOp"}, context);

        const execOp = async (op: Op): Promise<[{}, any]> => {

            listener("op:pre", op, context);

            const executor = executors[op.op];
            //console.log("op:pre/executor", executors[op.op]);

            const result = executor != null ? await executors[op.op](op, context) : Promise.reject("Unknown operaton: " + op.op);
            //console.log("op:post/result", result);

            if (op.output) {
                context[op.output] = result;
            }

            listener("op:post", op, context);

            return [context, result];
        };

        for (let op of workflow) {
            if (op.op === 'until') {
                const condition = op.condition;
                while (!context[condition]) {
                    for (let innerOp of op.ops) {
                        yield execOp(innerOp);
                    }
                }
            } else if (op.op === 'while') {
                const condition = op.condition;
                while (context[condition]) {
                    for (let innerOp of op.ops) {
                        yield execOp(innerOp);
                    }
                }
            } else {
                yield execOp(op);
            }
        }

        listener('workflow:done', {op: "noOp"}, context);
    }
};