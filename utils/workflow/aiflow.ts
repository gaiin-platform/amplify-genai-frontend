import {useChatService} from "@/hooks/useChatService";

export const findWorkflowPattern = (inputString: string) => {

    const workflowPattern = /workflow\s*=\s*async\s*\(fnlibs\)\s*=>\s*{/g;

    let workflowFunction = workflowPattern.exec(inputString);
    if (workflowFunction === null) {
        return null;
    }

    let bracketsStack = 0;
    let inString = false;
    let stringChar = '';
    let prevChar = '';

    for (let i = workflowPattern.lastIndex - 1; i < inputString.length; i++) {
        const currChar = inputString[i];

        if (inString) {
            // Check for a closing quote, ensuring it's not escaped
            if (currChar === stringChar && prevChar !== '\\') {
                // Found the closing quote
                inString = false;
            }
        } else {
            // Check for an opening quote
            if (currChar === '"' || currChar === "'" || currChar === "`") {
                inString = true;
                stringChar = currChar;
            } else if (currChar === '{') {
                bracketsStack += 1;
            } else if (currChar === '}') {
                bracketsStack -= 1;
                if (bracketsStack === 0) {
                    const workflowFunctionCode = "async (fnlibs) => " + inputString.slice(workflowPattern.lastIndex - 1, i + 1);
                    return workflowFunctionCode.trim();
                }
            }
        }

        prevChar = currChar;
    }

    console.log("Error: No proper ending for the 'workflow' function found.");
    return null;
};

export const generateCodeImprovementPrompt = (code:string, improvement:string) => {
    return "// The code "+improvement;
}

export const generateWorkflowPrompt = (task: string, tools:{[key: string]:{description: string}}) => {

    const toolMsg = Object.entries(tools)
        .map(([key,tool]) => {return key +":"+tool.description;}).join(",\n");

    return `const fnlibs = {
                            ${toolMsg}
                        };

                        const workflow = async (fnlibs) => {
                            let result = new Promise((resolve, reject) => {
                            try {
                                console.log("EXECUTING...");
                                let value = null; 
                                // Any tasks based on summarizing, outlining, analyzing, suggesting,
                                // brainstorming, etc. should be done by prompting the LLM. When you prompt
                                // you must give
                                // the LLM detailed step-by-step instructions on what to do and give it a 
                                // persona (e.g., act as an XYZ expert).
                                // FILL IN CODE TO:
                                // ${task}
                                
                               // Store the output of the task in value so it can be returned
                               resolve(value);
                            }
                            catch(e){
                               reject(e);
                            }
                          });
                           return result;
                        }`;
}