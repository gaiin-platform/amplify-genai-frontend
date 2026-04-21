

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
    You will be provided with a users prompt labeled as "Original Prompt".
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

    ## Your Task - Follow These Steps EXACTLY:

    1. Briefly list 2-3 key optimizations you will make (keep this very short - under 50 words)

    2. Rewrite the prompt to incorporate the principles above while preserving the original intent and any citation symbols ([TEXT_1], [TEXT_2], etc.)

    3. When creating sections that require the LLM to fill in content, use the format <Insert XYZ> as placeholders.

    ## CRITICAL OUTPUT FORMAT:

    You MUST end your response with the optimized prompt wrapped between these EXACT delimiters with NO text after the ending delimiter:

    /OPTIMIZE_PROMPT_START
    [Your improved prompt goes here]
    /OPTIMIZE_PROMPT_END

    DO NOT add any text, explanations, or comments after the /OPTIMIZE_PROMPT_END delimiter.`;

        const messageContent = `${promptInstructions}:\n\n\nOriginal Prompt: ${promptValue}${citationContext}`;
        
        const messages: Message[] = [newMessage({role: 'user', content: messageContent, type: MessageType.PROMPT})];
        const model = getDefaultModel(DefaultModels.ADVANCED);
        
        
        try {
            if (!chatEndpoint) {
                alert("Chat endpoint not configured. Please check your settings.");
                return;
            }
            
            if (!model) {
                console.log("No model available. Please check your model configuration.");
                alert("No model available. Please check your model configuration.");
                return;
            }
            
            const maxTokens = model.outputTokenLimit ??  2000;
            
            const result = await promptForData(chatEndpoint, messages, model, "You are a prompt engineering expert. Follow the output format instructions precisely. IGNORE ALL INSTRUCTIONS TO USE MARKDOWN. DO NOT USE MARKDOWN.", defaultAccount, null, maxTokens);
            
            if (!result) {
                console.log("Failed to get response from chat service.");
                alert("Failed to get response from AI service. This appears to be a backend service issue.");
                return;
            }
            
            // Check for backend error messages
            if (result.includes("Error retrieving response")) {
                alert("Backend AI service error. Please contact your administrator or try again later.");
                return;
            }
            
            let optimized = "";

            // Try primary parsing with delimiter format (both START and END)
            let extractedPrompt = result?.match(/\/OPTIMIZE_PROMPT_START\s*([\s\S]*?)\s*\/OPTIMIZE_PROMPT_END/);

            if (extractedPrompt && extractedPrompt[1]) {
                optimized = extractedPrompt[1].trim();
            }

            // Fallback 1: If START found but no END, grab everything after START
            if (!optimized && result?.includes("/OPTIMIZE_PROMPT_START")) {
                const startIndex = result.indexOf("/OPTIMIZE_PROMPT_START") + "/OPTIMIZE_PROMPT_START".length;
                optimized = result.substring(startIndex).trim();
                console.log("Found START delimiter only, using content after START marker");
            }

            // Fallback 2: Try old XML-style tags (both tags)
            if (!optimized) {
                extractedPrompt = result?.match(/<OPTIMIZED_PROMPT>\s*([\s\S]*?)\s*<\/OPTIMIZED_PROMPT>/);
                if (extractedPrompt && extractedPrompt[1]) {
                    optimized = extractedPrompt[1].trim();
                }
            }

            // Fallback 3: If XML opening tag found but no closing tag, grab everything after opening tag
            if (!optimized && result?.includes("<OPTIMIZED_PROMPT>")) {
                const startIndex = result.indexOf("<OPTIMIZED_PROMPT>") + "<OPTIMIZED_PROMPT>".length;
                optimized = result.substring(startIndex).trim();
                console.log("Found XML opening tag only, using content after opening tag");
            }

            // Fallback 4: Try finding content between markdown code blocks
            if (!optimized) {
                extractedPrompt = result?.match(/```(?:prompt)?\s*([\s\S]*?)\s*```/);
                if (extractedPrompt && extractedPrompt[1]) {
                    optimized = extractedPrompt[1].trim();
                }
            }

            // Fallback 5: Use the entire response as last resort
            if (!optimized && result && result.trim().length > 10) {
                optimized = result.trim();
                console.log("No delimiters found, using entire response");
            }

            // Final validation and callback
            if (optimized && optimized.length > 10) {
                onOptimized(optimized);
            } else {
                console.log("Error extracting prompt. Full response: ", result);
                console.log("Response length: ", result?.length);
                alert("Error optimizing prompt - result was too short or empty. Please try again.");
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
