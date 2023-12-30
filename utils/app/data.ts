
export function extractSection(code: string, startMarker: string, endMarker: string) {
    // Escape any special regex characters in the markers
    startMarker = startMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    endMarker = endMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Create a RegExp to match code between startMarker and endMarker
    var sectionRegExp = new RegExp(startMarker + "([\\s\\S]*?)" + endMarker);

    // Find the match in the provided code string
    var match = sectionRegExp.exec(code);

    // Return the code block between startMarker and endMarker if found, else null
    return match ? match[1].trim() : null;
}

export function extractFirstCodeBlock(markdown: string) {
    // Create a RegExp to match JavaScript codeblocks in Markdown
    var codeBlockRegExp = /```javascript([\s\S]*?)```/;

    // Find the match in the provided code string
    var match = codeBlockRegExp.exec(markdown);

    // Return the first code block if found, else null
    return match ? match[1].trim() : null;
}

export const extractJsonObjects = (text: string) => {

    let jsonObjects = [];
    let buffer = "";
    let stack = [];
    let insideString = false;
    let insideObject = false;

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
                    console.log("Attempting to parse:", buffer);
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
        } else if (stack.length > 0) {
            buffer += char;
        }
    }

    while (jsonObjects.length === 1) {
        jsonObjects = jsonObjects.pop();
    }

    return jsonObjects;
}

function addLineNumbers(str: string) {
    var lines = str.split('\n');

    for (var i = 0; i < lines.length; i++) {
        lines[i] = (i + 1) + '. ' + lines[i];
    }

    return lines.join('\n');
}


export const promptForJsonPrefix = (obj: any, id: string) => {
    const jsonSchema = describeAsJsonSchema(obj, id);
    const jsonSchemaString = JSON.stringify(jsonSchema, null, 2);
    return `json!(${jsonSchemaString})\n`;
}

// @ts-ignore
export const describeAsJsonSchema = (obj:any, id = 'root') => {

    try {
        // Case: null
        if (obj === null) {
            return {type: 'null'};
        }

        // Case: undefined
        if (typeof obj === 'undefined') {
            return {type: 'undefined'};
        }

        // Case: Date
        if (obj instanceof Date) {
            return {type: 'string', format: 'date-time'};
        }

        // Case: Blob
        // Please note, Blob is mainly used in browsers and might not available in all environments
        if (typeof Blob !== 'undefined' && obj instanceof Blob) {
            return {type: 'string', format: 'data-url'};
        }

        switch (typeof obj) {
            // Case: string, number, boolean
            case 'string':
            case 'number':
            case 'boolean':
                return {
                    type: typeof obj,
                };
            // Case: object
            case 'object':
                // Array handling
                if (Array.isArray(obj)) {
                    // @ts-ignore
                    const items = obj.length > 0 ? describeAsJsonSchema(obj[0]) : {};
                    return {type: 'array', items};
                }
                // Object Handling
                else {
                    // @ts-ignore
                    const properties = Object.fromEntries(
                        Object.entries(obj).map(([propertyName, value]) => [
                            propertyName,
                            describeAsJsonSchema(value),
                        ])
                    );
                    return {type: 'object', properties};
                }
            // Case: other data types
            default:
                return {};
        }
    }catch(e){
        return {};
    }
}