import {ChatBody, Message, newMessage} from "@/types/chat";
import {sendChatRequest} from "@/services/chatService";
import {findWorkflowPattern, generateWorkflowPrompt} from "@/utils/workflow/aiflow";
import {OpenAIModels, OpenAIModelID} from "@/types/openai";

interface AiTool {
    description:string,
    exec:()=>{}
}

export const executeJSWorkflow = async (apiKey:string, task: string, customTools:{[key:string]:AiTool}) => {

    const promptLLM = async (prompt: string) => {
        const chatBody = {
            model: OpenAIModels[OpenAIModelID.GPT_4],
            messages: [newMessage({content:prompt})],
            key: apiKey,
            prompt: "Act as an expert Javascript developer.",
            temperature: 1.0,
        };

        console.log("promptLLM", prompt);
        let response = await sendChatRequest(apiKey, chatBody, null, null);
        return await response.text();
    }

    const tools = {
        promptLLM: { description:"(promptString):Promise<String>", exec:promptLLM },
        log: { description:"(msgString):void", exec:(msgString: string) => console.log(msgString)},
        documentPages: { description: "(documentIdString):Promise<String[]>", exec:(documentIdString: string) => {
                console.log("document pages");
                return ["page 1"]
            }},
        getUserInput: { description: "(fields:[{description:'':type:''},...]) // type is string, " +
                "javascript regex pattern, integer, number, boolean, file, select:option1:option2",
            exec:(data: any) => {
                console.log("getUserInput", data);
                return {};
        }},
        ...customTools,
    };

    let prompt = generateWorkflowPrompt(task, tools);

    let success = false;
    let tries = 3;

    while(!success && tries > 0) {

        console.log("Prompting for the code for task: ", task);

        let uncleanedCode = await promptLLM(prompt);
        //console.log("Uncleaed code:", uncleanedCode)

        let cleanedFn = findWorkflowPattern(uncleanedCode);
        let finalFn = null;
        let fnResult = "";

        console.log(cleanedFn);
        if (cleanedFn != null) {

            try {

                const fnlibs = {}
                Object.entries(tools).forEach(([key,tool])=>{
                    // @ts-ignore
                    fnlibs[key] = tool.exec;
                })

                // const fnlibs = {
                //     promptLLM: promptLLM,
                //     log: (msgString: string) => console.log(msgString),
                //     documentPages: (documentIdString: string) => {
                //         console.log("document pages");
                //         return ["page 1"]
                //     },
                //     getUserInput: (data: any) => {
                //         console.log("getUserInput", data);
                //         return {}
                //     } // type is string, javascript regex pattern, integer, number, boolean, file, select:option1:option2
                // };

                let context = {workflow:(fnlibs:{}):any=>{}};
                eval("context.workflow = " + cleanedFn);

                console.log("workflow fn", context.workflow);

                finalFn = context.workflow;
                let result = await context.workflow(fnlibs);

                console.log("REsult:", result);
                fnResult = result;
                success = result != null;

                // if(!success){
                //     window.prompt("Please describe what is wrong with the output so I can try again.");
                // }


            } catch (e) {
                console.log(e);
            }

            tries = tries - 1;
        }

        let result = {success:success, code:cleanedFn, exec:finalFn, uncleanCode:uncleanedCode, result:fnResult};
        return result;
    }
};

export const extractJsonObjects = (text: string) => {

    let jsonObjects = [];
    let buffer = "";
    let stack = [];
    let insideString = false;

    for (let char of text) {
        if (char === '"' && (stack.length === 0 || stack[stack.length - 1] !== '\\')) {
            insideString = !insideString;
            buffer += char;
        } else if (insideString) {
            buffer += char;
        } else if (char === '{' || char === '[') {
            stack.push(char);
            buffer += char;
        } else if (char === '}' || char === ']') {
            if (stack.length === 0) continue;
            let openingChar = stack.pop();
            buffer += char;
            if ((openingChar === '{' && char === '}') || (openingChar === '[' && char === ']') && stack.length === 0) {
                try {
                    console.log("Attempting to parse:",buffer);
                    let jsonObj = JSON.parse(buffer);
                    jsonObjects.push(jsonObj);
                } catch (error) {
                    // failed to parse json
                    console.log(error);
                }
                buffer = "";
            } else {
                continue;
            }
        } else {
            buffer += char;
        }
    }

    while (jsonObjects.length === 1) {
        jsonObjects = jsonObjects.pop();
    }

    return jsonObjects;
}

function parseJSONObjects(str:string) {
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

        if(value && typeof value !== 'string'){
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
          return (typeof s !== 'string')? JSON.stringify(s) : s;
        };

        const sep = op.separator ? op.separator : "";
        let result = context[op.input].reduce((s: any, v: any) => stringify(s)+sep+stringify(v));
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