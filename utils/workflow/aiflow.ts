import {useChatService} from "@/hooks/useChatService";

export const findWorkflowPattern = (inputString:string, noFix?:boolean):string|null => {
    const workflowPattern = /workflow\s*=\s*async\s*\([^)]*\)\s*=>\s*{/g;

    let workflowFunction = workflowPattern.exec(inputString);
    if (workflowFunction === null) {
        console.log("Error: No 'workflow' function found.");
        return null;
    }

    let bracketsStack = 0;
    let inString = false;
    let stringChar = '';
    let prevChar = '';
    let currChar = '';
    let stringStart = 0;
    let inSingleLineComment = false;
    let inMultiLineComment = false;

    for (let i = workflowPattern.lastIndex - 1; i < inputString.length; i++) {
        prevChar = currChar;
        currChar = inputString[i];

        if (inString) {
            if (currChar === stringChar && prevChar !== '\\') {
                // Found the closing quote
                inString = false;
            }
        } else if (inSingleLineComment) {
            if (currChar === '\n') {
                // End of Single Line Comment
                inSingleLineComment = false;
            }
        } else if (inMultiLineComment) {
            if (currChar === '/' && prevChar === '*') {
                // End of multi line Comment
                inMultiLineComment = false;
            }
        } else {
            if (currChar === '/' && prevChar === '/') {
                inSingleLineComment = true;
            } else if (currChar === '*' && prevChar === '/') {
                inMultiLineComment = true;
            } else if (currChar === '"' || currChar === "'" || currChar === "`") {
                stringStart = i;
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
    }

    if (bracketsStack > 0 && !noFix) {
        for (let i = 0; i < bracketsStack; i++) {
            inputString = inputString + "}";
            let result:string|null = findWorkflowPattern(inputString, true);
            if (result != null) {
                return result;
            }
        }
    }

    //console.log(`Error: No proper ending for the 'workflow' function found. [inString:${inString}, bracketsStack:${bracketsStack}, prevChar:${prevChar}]`);
    return null;
}


export const generateCodeImprovementPrompt = (code: string, improvement: string) => {
    return "// The code " + improvement;
}

export const describeTools = (tools: { [s: string]: unknown; } | ArrayLike<unknown>) => {
    return Object.entries(tools)
        .map(([key, tool]) => { // @ts-ignore
            return key + ":" + tool.description;
        })
        .join(", ");
}

export const generateWorkflowPrompt = (task: string, tools: { [key: string]: { description: string } }, extraPromptInstructions?: string[], extraVarInstructions?:string[]) => {

    const toolMsg = describeTools(tools);
    //Object.entries(tools)
    //.map(([key,tool]) => {return key +":"+tool.description;}).join(",\n");

    const extraInstructions = (extraPromptInstructions) ? "// PAY ATTENTION:\n" + extraPromptInstructions.join("\n//   ") : "";
    const varInstructions = (extraVarInstructions) ? extraVarInstructions.join("\n") : "";


    return `const fnlibs = {
                            ${toolMsg}
                        };

                        //@START_WORKFLOW
                        const workflow = async (fnlibs) => {
                         
                            try {
                                fnlibs.tellUser("Executing the generated workflow...");
                                let value = {type:"text|table|code|object", data:null}; 
                                ${varInstructions}
                              
                                // Any tasks based on summarizing, outlining, analyzing, suggesting,
                                // brainstorming, etc. should be done by prompting the LLM. When you prompt
                                // you must give the LLM detailed step-by-step instructions on what to do and give it a 
                                // persona (e.g., act as an XYZ expert).
                                //
                                // Tell the user what you are doing before any point in your code where you
                                // prompt the LLM. 
                                //
                                // EXTRA INSTRUCTIONS:
                                // ${extraInstructions}
                                //
                                // FILL IN A STEP-BY-STEP PLAN IN COMMENTS FOR TASK:
                                // ${task}
                                //
                                // FILL IN CODE TO IMPLEMENT THE PLAN HERE:
                                //
                                
                                
                               // DESCRIBE HOW TO MAKE THE VALUE BEAUTIFULLY FORMATTED
                               // FOR THE USER 
                               // Store the output of the task in value so it can be returned
                               return value;
                            }
                            catch(e){
                               throw e;
                            }
                          };//@END_WORKFLOW`
}
