

import HomeContext from "@/pages/api/home/home.context";
import { Message, MessageType, newMessage } from "@/types/chat";
import { DefaultModels } from "@/types/model";
import { promptForData } from "@/utils/app/llm";
import { LargeTextBlock, generateCitationContext } from "@/utils/app/largeText";
import {IconWand} from "@tabler/icons-react";
import {useContext} from "react";


interface PromptOptimzierProps {
    prompt: string,
    largeTextBlocks: LargeTextBlock[],
    onOptimized: (optimizedPrompt:string) => void
}


const PromptOptimizerButton: React.FC<PromptOptimzierProps> = ({prompt, largeTextBlocks, onOptimized}) => {

    const { state: { prompts, chatEndpoint, defaultAccount}, setLoadingMessage, getDefaultModel} = useContext(HomeContext);


    const optimizePrompt = async (promptValue: string) => {
        setLoadingMessage("Optimizing Prompt...");

        // Generate citation context if large text blocks are present
        const citationContext = generateCitationContext(largeTextBlocks);
        
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
    
    8. **Citation Symbol Preservation**: If you see citation symbols like [TEXT_1], [TEXT_2], [TEXT_3] in the prompt, preserve them EXACTLY as they appear. These represent large text blocks that will be automatically substituted when the prompt is used.
    
    9. **Constraints and Guardrails**: Explicitly state limitations, restrictions, or ethical boundaries.
    
    10. **Thinking Prompts**: Include phrases like "Think step by step" or "Let's work through this systematically."
    
    11. **Multi-perspective Approach**: Encourage exploring multiple angles or solutions to a problem.
    
    ## Your Optimization Task
    
    1. Analyze the original prompt for weaknesses and missed opportunities:
       - Lack of clear instructions
       - Missing structure
       - Absence of role definition
       - Insufficient guidance on output format
       - Lack of context or examples
    
    2. Rewrite the prompt to incorporate the principles above while preserving the original intent and any citation symbols.
    
    3. When creating sections that require the LLM to fill in content, use the format <Insert XYZ> as placeholders.
    
    4. IMPORTANT: If the prompt contains citation symbols like [TEXT_1], [TEXT_2], [TEXT_3], preserve them exactly in your optimized version. Do not replace them with generic placeholders.
    
    5. Create a list of specific optimizations you made and why they will improve the prompt's effectiveness.
    
    6. Insert your final improved prompt within the format defined below

    Example response: 
    You determined the improved prompt is: This is a much improved prompt.
    To allow me to properly extract your final improved prompt version, you must insert it in the following format at the end of your response:

    /OPTIMIZE_PROMPT_START
        This is a much improved prompt.
    /OPTIMIZE_PROMPT_END`;

        const messageContent = `${promptInstructions}:\n\n\nOriginal Prompt: ${promptValue}${citationContext}`;
        
        const messages: Message[] = [newMessage({role: 'user', content: messageContent, type: MessageType.PROMPT})];
        const model = getDefaultModel(DefaultModels.ADVANCED);
        
        
        try {
            if (!chatEndpoint) {
                alert("Chat endpoint not configured. Please check your settings.");
                return;
            }
            
            if (!model) {
                alert("No model available. Please check your model configuration.");
                return;
            }
            
            const maxTokens = 1000;
            
            const result = await promptForData(chatEndpoint, messages, model, "Improve the users prompt, NO COMMENTS, PLEASANTRIES, PREAMBLES ALLOWED", defaultAccount, null, maxTokens);
            
            if (!result) {
                alert("Failed to get response from AI service. This appears to be a backend service issue.");
                return;
            }
            
            // Check for backend error messages
            if (result.includes("Error retrieving response")) {
                alert("Backend AI service error. Please contact your administrator or try again later.");
                return;
            }
            
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
                    className="chat-input-button rounded-sm p-1 text-neutral-800 opacity-60 hover:bg-neutral-200 hover:text-black dark:bg-opacity-50 dark:text-neutral-100 dark:hover:text-white"
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
