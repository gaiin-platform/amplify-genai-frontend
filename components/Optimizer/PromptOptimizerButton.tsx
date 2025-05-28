

import HomeContext from "@/pages/api/home/home.context";
import { Message, MessageType, newMessage } from "@/types/chat";
import { DefaultModels } from "@/types/model";
import { promptForData } from "@/utils/app/llm";
import {IconWand} from "@tabler/icons-react";
import {useContext, useState} from "react";


interface PromptOptimzierProps {
    prompt: string,
    onOptimized: (optimizedPrompt:string) => void
}


const PromptOptimizerButton: React.FC<PromptOptimzierProps> = ({prompt, onOptimized}) => {

    const { state: { prompts, chatEndpoint}, setLoadingMessage, getDefaultModel} = useContext(HomeContext);

    const promptInstructions = `
    You will be provide with a users prompt labeled as "Original Prompt".
    Analyze the provided prompt and create an optimized version that will produce better results from an LLM.
    
    ## What Makes an Effective Prompt
    
    1. **Clear Role Assignment**: Include a specific "Act as..." instruction with a detailed description of the expertise the LLM should embody.
    
    2. **Structured Format**: Organize information logically with headers, bullet points, and clear sections.
    
    3. **Step-by-Step Guidance**: Break down complex tasks into sequential steps and encourage methodical thinking.
    
    4. **Context Enrichment**: Provide sufficient background information for the LLM to understand the task fully.
    
    5. **Output Format Specification**: Clearly define how the response should be structured (tables, lists, headers, etc.).
    
    6. **Few-Shot Examples**: When appropriate, include examples of desired outputs to guide the model.
    
    7. **Strategic Placeholders**: Use {{PLACEHOLDER}} format for external information that users need to provide.
    
    8. **Constraints and Guardrails**: Explicitly state limitations, restrictions, or ethical boundaries.
    
    9. **Thinking Prompts**: Include phrases like "Think step by step" or "Let's work through this systematically."
    
    10. **Multi-perspective Approach**: Encourage exploring multiple angles or solutions to a problem.
    
    ## Your Optimization Task
    
    1. Analyze the original prompt for weaknesses and missed opportunities:
       - Lack of clear instructions
       - Missing structure
       - Absence of role definition
       - Insufficient guidance on output format
       - Lack of context or examples
    
    2. Rewrite the prompt to incorporate the principles above while preserving the original intent.
    
    3. When creating sections that require the LLM to fill in content, use the format <Insert XYZ> as placeholders.
    
    4. Create a list of specific optimizations you made and why they will improve the prompt's effectiveness.
    
    5. Insert your final improved prompt within the format defined below

    Example response: 
    You determined the improved prompt is: This is a much improved prompt.
    To allow me to properly extract your final improved prompt version, you must insert it in the following format at the end of your response:

    /OPTIMIZE_PROMPT_START
        This is a much improved prompt.
    /OPTIMIZE_PROMPT_END`;

    const optimizePrompt = async (promptValue: string) => {
        setLoadingMessage("Optimizing Prompt...");

        console.log("Calling prompt optimizer...");
        const messages: Message[] = [newMessage({role: 'user', content : `${promptInstructions}:\n\n\nOriginal Prompt: ${promptValue}`, type: MessageType.PROMPT})];
        const model = getDefaultModel(DefaultModels.ADVANCED);
        try {
            const result = await promptForData(chatEndpoint ?? '', messages, model, "Improve the users prompt, NO COMMENTS, PLEASANTRIES, PREAMBLES ALLOWED", null, 1000);
            // console.log("Optimization result: ", result);
            const extractedPrompt = result?.match(/\/OPTIMIZE_PROMPT_START\s*([\s\S]*?)\s*\/OPTIMIZE_PROMPT_END/);
            if (extractedPrompt && extractedPrompt[1]) {
                onOptimized(extractedPrompt[1].trim());
            } else {
                alert("Error optimizing prompt. Please try again.");
            }
        } catch (e) {
            console.log(e);
            alert("Error optimizing prompt. Please try again.")
        }
        finally {
            setLoadingMessage("");
        }
    }
    


    // @ts-ignore
    return (<div>
                <button
                    className=" left-1 top-2 rounded-sm p-1 text-neutral-800 opacity-60 hover:bg-neutral-200 hover:text-neutral-900 dark:bg-opacity-50 dark:text-neutral-100 dark:hover:text-neutral-200"
                    onMouseDown={ (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const value = prompt;
                        if(value) optimizePrompt(value); 
                    } }
                    onKeyDown={(e) => {

                    }}
                    id="promptOptimizerButton"
                    title="Optimize Prompt"

                >
                    <IconWand size={20}/>
                </button>
    </div>);
};

export default PromptOptimizerButton;
