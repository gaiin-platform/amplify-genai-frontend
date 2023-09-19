export const extractJsonObjects = (text:string) => {
    let jsonObjects = [];
    let buffer = "";
    let stack = [];
    let insideString = false;

    for(let char of text) {
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
                    let jsonObj = JSON.parse(buffer);
                    jsonObjects.push(jsonObj);
                } catch (error) {
                    // failed to parse json
                }
                buffer = "";
            } else {
                continue;
            }
        } else {
            buffer += char;
        }
    }

    if (jsonObjects.length === 1) {
        jsonObjects = jsonObjects.pop();
    }

    return jsonObjects;
}

interface Context {
    [key: string]: any;
}

interface Op {
    op: string;
    [otherProps: string]: any;
}

interface OpRunner {
    (op: Op, context: Context): Promise<any>;
}

function fillTemplate(template: string, context: Context): string {
    return template.replace(/\{\{([^}]+)\}\}/g, function(_matchedString, key) {
        let value:any = context;
        key.split('.').forEach((k: string | number) => {

            if (value && value.hasOwnProperty(k)) {
                value = value[k];
            } else {
                value = undefined;
            }
        });
        return typeof value !== 'undefined' ? value : '';
    });
}

const ops: { [opName: string]: OpRunner } = {

    extractJson: async (op: Op, context: Context) => {
        // Given json mixed with text describing it, this
        // function will find and extract all of the valid json
        // and return a list of the valid json objects it found

        return extractJsonObjects(fillTemplate(op.input, context));
    },

    input: async (op: Op, context: Context) => {
        // Placeholder function for input
        return op.variables; // handle input operation
    },

    split: async (op: Op, context: Context) => {
        // Placeholder function for split
        return [context[op.input]]; // handle split operation
    },

    prompt: async (op: Op, context: Context) => {
        // Placeholder function for prompt
        return true; // handle prompt operation
    },

    map: async (op: Op, context: Context) => {
        const result = [];
        for (const item of context[op.input]) {
            const newContext = { ...context, [op.itemVariable]: item };
            for (const operation of op.function) {
                result.push(await executeOp(operation, newContext));
            }
        }
        return result;
    },

    format: async (op: Op, context: Context) => {
        return fillTemplate(op.input, context);
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

    canvasDraw: async (op: Op, context: Context) => {
        const canvas = document.querySelector(op.selector) as HTMLCanvasElement;
        const ctx = canvas.getContext('2d');
        // You can use ctx to draw on the canvas
        return ctx;
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
};

export async function executeOp(operation: Op, context: Context = {}): Promise<any> {
    const opRunner = ops[operation.op];
    if (!opRunner) throw new Error(`Unknown operation: ${operation.op}`);

    let localContext = {...context}
    const result = await opRunner(operation, localContext);

    if (operation.output) {
        localContext[operation.output] = result;
    }

    return localContext;
}