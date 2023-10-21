import {ChatBody, CustomFunction, JsonSchema, newMessage} from "@/types/chat";
import {sendChatRequest} from "@/services/chatService";
import {findWorkflowPattern, generateWorkflowPrompt, describeTools} from "@/utils/workflow/aiflow";
import {OpenAIModelID, OpenAIModels} from "@/types/openai";
import {InputDocument, Status, WorkflowContext, WorkflowDefinition} from "@/types/workflow";
import {describeAsJsonSchema, extractFirstCodeBlock, extractSection} from "@/utils/app/data";
import {parameterizeTools as coreTools} from "@/utils/app/tools";
import {AttachedDocument} from "@/types/attacheddocument";
import {parseVariableName} from "@/components/Chat/VariableModal";
import {Prompt} from "@/types/prompt";


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

export const fillInTemplate = (template:string, variables:string[], variableValues: string[], documents: AttachedDocument[] | null, insertDocuments:boolean) => {
    console.log("Fill in Template");
    const names = variables.map(v => parseVariableName(v));

    console.log("Variables", variables);
    console.log("Names", names);

    const newContent = template.replace(/{{(.*?)}}/g, (match, variable) => {
        const name = parseVariableName(variable);
        const index = names.indexOf(name);

        console.log("Variable", name, index, variableValues[index]);

        if (insertDocuments && documents && documents.length > 0) {
            let document = documents.filter((doc) => {
                if (doc.name == name) {
                    return "" + doc.raw;
                }
            })[0];

            if (document) {
                return "" + document.raw;
            }
        }

        return variableValues[index];
    });

    return newContent;
}

const promptLLMSelectOne = async (promptUntil:any,  options: {[key:string]:string}, instructions?: string, rootPrompt?: string, model?: OpenAIModelID) => {

    const prompt = (instructions)? instructions : `
        Select the correct options answer the question. "${instructions}":
                
        Please choose from the following options:
        ------------------ 
        ${Object.entries(options).map(([option,description]) => {
            return "\t\t" + option + ". " + description.replaceAll("\n", " ");
        }).join("\n")}
        ------------------
        `;

    const optionsKeys = Object.keys(options);

    rootPrompt = (rootPrompt) ? rootPrompt : "You are ChatGPT, a large language model trained by OpenAI. " +
        "Follow the user's instructions carefully. " +
        "Respond using JSON. ";

    //console.log("Select One Prompt:", prompt);

    const selectFunction = "correctAnswer";
    const selectedOptionsProperty = "answer";
    const selectFunctions: CustomFunction[] = [
        {
            name: selectFunction,
            description: "call this function to indicate the correct YES or NO answer to the question",
            parameters: {
                type: "object",
                properties: {
                    thought: {
                        "type": "string",
                        description: "Your thoughts on why this is the right answer",
                    },
                    [selectedOptionsProperty]: {
                        "type": "string",
                        "enum": optionsKeys,
                        description: "the correct answer to the question",
                    },
                },
                "required": ["thought",selectedOptionsProperty]
            }
        },
    ];

    //console.log("Select One Functions:", selectFunctions);

    return promptUntil(rootPrompt, prompt,
        (rslt:any) => {
            let json = JSON.parse(rslt);
            return json.arguments[selectedOptionsProperty];
        },
        (selectedOption:any) => selectedOption,
        3,
        // @ts-ignore
        null,
        null,
        model || OpenAIModelID.GPT_3_5_FN,
        selectFunctions,
        selectFunction
    );
}


async function generateReusableFunctionDescription(promptLLMForJson:any, promptUntil:any, javascriptPersona: string, task: string, prompt: string, context:WorkflowContext):Promise<ReusableDescription|null> {

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

    let documents = context.inputs.documents;
    let reuseParams = [];
    try {

        let documentParams:string[] = [];
        if (documents.length > 0) {
            try {
                //console.log("Prompting to determine if documents are snowflakes...");

                //Don't correct the indentation!!!
                const opts = await promptLLMSelectOne(
                    promptUntil,
                    {yes: "yes", no: "no"},
                    `
Workflow: Summarize
Thought: The same thing is done to all documents
DocumentsHandledDifferently: NO

Workflow: Insert a summary of the first excel file into the second document
Thought: The first document is handled differently than the second document
DocumentsHandledDifferently: YES

Workflow: Outline each of the attached documents and then concatenate the outlines together
Thought: All of the documents are processed the same way
DocumentsHandledDifferently: NO

Workflow: Outline the first slides to create a structure for the report. Then, write the first two sections. Finally, summarize the second and third documents and insert them into the report. 
Thought: The first document is processed differently than the second and third documents
DocumentsHandledDifferently: YES

Workflow:${task}
Thought:`
                );

                console.log("Documents are snowflakes:", opts);

                if (opts.toLowerCase() === "yes") {
                    console.log("Summarizing documents...");
                    documentParams = documents.map((doc: AttachedDocument) => {

                        // Filter the document name to only preserve the characters
                        // that are valid in a variable name
                        let safeName = doc.name.replaceAll(/[^a-zA-Z0-9\_]/g, "");
                        return `// ${doc.name} is a document attached to the request of type ${doc.type}
                                let ${safeName}String = fnlibs.getDocument("${doc.name}").raw;`;
                    });
                } else if(documents.length > 0){
                    documentParams = [
                      `
                      // Get all of the documents needed.
                      let documents = fnlibs.getDocuments(); 
                      `
                    ];
                }
                else {
                    documentParams = [
                        `
                      // Get the document to process as a string
                      let documentToProcessString = fnlibs.getDocuments()[0].raw; 
                      `
                    ];
                }
            }catch (e){
                console.log("Error:", e);
            }
        }

        let documentsStr = documentParams.join("\n");

        let fnPrompt = `Describe a reusable Javascript function to perform the task "${task}".
                Think step by step what parameters, other than documents, might change. 
                You should NOT create parameters for document paths, document contents, etc.
                Think about how to make
                the function as reusable and useful as possible while not introducing too many
                parameters. Don't go crazy with parameters, just a couple is enough.
                
                IGNORE DOCUMENTS FOR NOW.`;

        fnPrompt += (documents.length>0)? `There are ${documents.length} included with the request. 
        Focus on other possible parameters. All documents are already provided and you should not
        create parameters for them.
        
        The function will already include the following code:
        ${documentsStr}
        `
            : "";

        const jsonFnCode = await promptLLMForJson(
            javascriptPersona,
            fnPrompt,
            functionSchema,
        );

        //console.log("JSON Function:", jsonFnCode);

        // Hack for now to skip this since it needs work
        jsonFnCode.parameters = [];

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
                        let ${param.name} =
                        fnlibs.getParameter("${param.name}", ${JSON.stringify(param.defaultValue)})`;
        }).join("\n");


        reusableDescription = {
            name: jsonFnCode.functionName,
            description: jsonFnCode.functionDescription,
            params: reuseParams,
            paramInstructions: documentsStr + paramStr,
        }

    } catch (e) {
        console.log(e);
    }

    // @ts-ignore
    return reusableDescription;
}

async function executeWorkflow(tools: { [p: string]: AiTool }, code: string) {
    let javascriptFn = null;
    let success = false;
    let result = null;

    try {

        tools.executeWorkflow = {
          description: "",
          exec: async (workflow:Prompt, params:{[key:string]:any}) => {
            console.log("--> Sub Workflow:", workflow);
            let workflowCode = workflow.data?.code;
            console.log("--> Sub Workflow Code:", workflowCode);
            let documents = params.documents as AttachedDocument[];
            let variableData = params.variables;
            let variables = Object.keys(variableData);
            let variableValues = Object.values(variableData) as string[];

            let updatedCode = fillInTemplate(workflowCode, variables, variableValues, documents, false);

            return executeWorkflow(tools, updatedCode);
          }
        };

        const fnlibs = {}
        Object.entries(tools).forEach(([key, tool]) => {
            // @ts-ignore
            fnlibs[key] = tool.exec;
        })

        // if (stopper.shouldStop()) {
        //     return abortResult;
        // }

        tools.tellUser.exec("Running the workflow...");
        let context = {
            workflow: (fnlibs: {}): any => {
            }
        };

        // If we reset, we need to make sure and reset the
        // requested information from the workflow
        eval("context.workflow = " + code);

        //console.log("workflow fn", context.workflow);

        javascriptFn = context.workflow;
        result = await context.workflow(fnlibs);

        //console.log("Workflow Parameters:", workflowGlobalParams.requestedParameters);
        //console.log("Workflow Documents:", workflowGlobalParams.requestedDocuments);

        //console.log("Result:", result);
        //console.log("Will try again:", result == null);

        success = result != null;

    } catch (e) {
        console.log(e);
        tools.tellUser.exec("I am going to fix some errors in the workflow...");
    }
    return {success, result, javascriptFn};
}

function createWorkflowParams(context: WorkflowContext, apiKey: string, stopper: Stopper, statusLogger:(status:Status)=>void) {
    const workflowGlobalParams = {
        context: context,
        requestedParameters: {},
        requestedDocuments: [],
        apiKey: apiKey,
        stopper: stopper,
        statusLogger: statusLogger,
    }
    return workflowGlobalParams;
}

function createWorkflowTools(workflowGlobalParams: { requestedDocuments: any[]; requestedParameters: {}; apiKey: string; stopper: Stopper; statusLogger:(status:Status)=>void; context: WorkflowContext }, promptLLM: (persona: string, prompt: string) => Promise<null | string>, customTools: { [p: string]: AiTool }) {
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
        ...customTools,
    };
    return tools;
}

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

const promptLLMFull = async (apiKey:string, stopper:Stopper, persona: string, prompt: string, messageCallback?: (msg: string) => void, model?: OpenAIModelID, functions?: CustomFunction[], function_call?: string) => {

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

export const replayJSWorkflow = async (apiKey: string, code:string, customTools: { [p: string]: AiTool }, stopper: Stopper, statusLogger:(status:Status)=>void, context:WorkflowContext, incrementalPromptResultCallback: (responseText: string) => void) => {
    if(stopper.shouldStop()){
        return abortResult;
    }

    const promptLLM = (persona: string, prompt: string) => {
        return promptLLMFull(apiKey, stopper, persona, prompt);
    }

    const workflowGlobalParams = createWorkflowParams(context, apiKey, stopper, statusLogger);
    const tools = createWorkflowTools(workflowGlobalParams, promptLLM, customTools);

    const __ret = await executeWorkflow(tools, code);

    // @ts-ignore
    let result = __ret.result;
    let success = __ret.success;

    let workflowResultData = {
        success: success,
        code: code,
        exec: __ret.javascriptFn,
        result: result};

    console.log("Workflow Result Data:", workflowResultData);

    return workflowResultData;
}

export const executeJSWorkflow = async (apiKey: string, task: string, customTools: { [p: string]: AiTool }, stopper: Stopper, statusLogger:(status:Status)=>void, context:WorkflowContext, incrementalPromptResultCallback: (responseText: string) => void) => {

    const promptLLMCode = (persona: string, prompt: string) => {
        return promptLLMFull(apiKey, stopper, persona, prompt, incrementalPromptResultCallback);
    }
    const promptLLM = (persona: string, prompt: string) => {
        return promptLLMFull(apiKey, stopper, persona, prompt);
    }

    console.log("Workflow Context:", context);

    const workflowGlobalParams = createWorkflowParams(context, apiKey, stopper, statusLogger);
    const tools = createWorkflowTools(workflowGlobalParams, promptLLM, customTools);

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
                const raw = await promptLLMFull(apiKey, stopper, persona, prompt, (m) => {
                }, model || OpenAIModelID.GPT_3_5, functions, function_call);

                cleaned = extract(raw || "");

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
            (selectedOptions) => selectedOptions,
            3,
            // @ts-ignore
            null,
            null,
            OpenAIModelID.GPT_3_5_FN,
            selectFunctions,
            selectFunction
        );
    }

    //Write simple, concise code that does not rely on any library functions.  The code must start with ```{{language}} and end with ```.  Write a {{language}} function {{Signature}} {{Input}} that returns {{Output}}
    // @ts-ignore
    const extraInstructions = [
        "Try to do as much work in code as possible without prompting the LLM. Only prompt the LLM for outlining, " +
        "analyzing text, summarizing, writing, and other natural language processing tasks.",
        "Calling promptLLM is expensive. Only do this if you really need its natural language processing capabilities." +
        " You shouldn't call this function to do things you could easily do in regular Javascript.",

        "If there is a library that you wish you had been able to use, include a comment about that in" +
        "the code in the form '// @library-wish <name-of-npm-module>. Note, only client-side libraries are allowed.",

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

    //console.log("Code generation prompt:", prompt);


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
       another textual format. If you pass a document to promptLLM, make sure that you only pass chunks that are less than 25,000 characters.
    2. If you are summarizing, outlining, filtering, extracting, etc. with text, make sure the prompt is designed
       to be totally factual and not include details that aren't in the original information.
    3. You can use any standard Javascript that you want, just don't access global state, the document, etc.
    4. You can define helper functions, but they must be defined inside of the workflow function.
    5. Prompt in parallel when possible.
    6. DO AS MUCH IN CODE AS POSSIBLE AND ONLY PROMPT the LLM if ABSOLUTELY REQUIRED FOR TEXT PROCESSING AND REASONING
    7. YOU MUST START YOUR OUTPUT WITH THE FUNCTION DECLARATION
    `;

    let availableDocuments = context.inputs.documents.map((doc: AttachedDocument) => {
        let parts = doc.name.split(".");
        let fileExtension = (parts && parts.length > 1) ? parts.pop() : "None";

        return {
            name: doc.name,
            fileExtension: fileExtension,
            fileType: doc.type,
        };
    });
    let availableDocumentsByName = {};
    availableDocuments.forEach((doc) => {
        // @ts-ignore
        availableDocumentsByName[doc.name] = doc;
    });

    while (!success && tries > 0 && !stopper.shouldStop()) {

        // console.log("Prompting for the code for task: ", task);
        const reuseDesc = await generateReusableFunctionDescription(promptLLMForJson, promptUntil, javascriptPersona, task, prompt, context);

        const reuseInstructions = (reuseDesc) ? [reuseDesc?.paramInstructions] : [];
        prompt = generateWorkflowPrompt(task, tools, extraInstructions, reuseInstructions);

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

        //console.log(cleanedFn);
        //console.log(cleanedFn);
        if (cleanedFn != null) {

            if(stopper.shouldStop()){
                return abortResult;
            }
            const __ret = await executeWorkflow(tools, cleanedFn);

            finalFn = __ret.javascriptFn;
            // @ts-ignore
            fnResult = __ret.result;
            success = __ret.success;

            tries = tries - 1;
        }

        // Go through the requestedParameters and map each one to:
        // {name, description, jsonSchema, defaultValue, usage} using additional information from reusableDescription
        Object.entries(workflowGlobalParams.requestedParameters).forEach(([key, value]) => {
            if (reuseDesc) {
                let param = reuseDesc.params.find((param) => param.name === key);
                if (param) {
                    Object.entries(param).forEach(([pkey, pvalue]) => {
                        // @ts-ignore
                        value[pkey] = pvalue;
                    });
                }
            }
        });

        console.log("Requested Documents:", workflowGlobalParams.requestedDocuments);

        //Filter the list of context.inputs.documents to only include those that were requested
        let allDocuments = workflowGlobalParams.requestedDocuments.find((docName) => docName === "*");
        let documentInputs = (allDocuments) ? availableDocuments :
            workflowGlobalParams.requestedDocuments.map((docName) => {
                return availableDocumentsByName[docName];
            });

        if (success) {
            let workflowResultData = {success: success,
                reusableDescription: reuseDesc,
                inputs: {
                    parameters: {...workflowGlobalParams.requestedParameters},
                    documents: [...documentInputs],
                },
                code: cleanedFn,
                exec: finalFn,
                uncleanCode: uncleanedCode,
                result: fnResult};

            console.log("Workflow Result Data:", workflowResultData);

            return workflowResultData;
        }
        else {
            workflowGlobalParams.requestedParameters = {};
            workflowGlobalParams.requestedDocuments = [];
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

export default executeJSWorkflow;