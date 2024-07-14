

import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import {LoadingDialog} from "@/components/Loader/LoadingDialog";
import {optimizePrompt} from "@/services/promptOptimizerService";
import {IconWand} from "@tabler/icons-react";
import {useState} from "react";


interface PromptOptimzierProps {
    prompt: string,
    onOptimized: (prompt:string, optimizedPrompt:string) => void,
    maxPlaceholders: number
}


const PromptOptimizerButton: React.FC<PromptOptimzierProps> = ({prompt,onOptimized, maxPlaceholders}) => {

    const [isPromptOptimizerRunning, setIsPromptOptimizerRunning] = useState<boolean>(false);


    // @ts-ignore
    return (<div>
                {isPromptOptimizerRunning && (
                    <LoadingDialog open={isPromptOptimizerRunning} message={"Optimizing Prompt..."}/>
                )}
                <button
                    className="left-1 top-2 rounded-sm p-1 text-neutral-800 opacity-60 hover:bg-neutral-200 hover:text-neutral-900 dark:bg-opacity-50 dark:text-neutral-100 dark:hover:text-neutral-200"
                    onClick={ () => {

                        const value = prompt;
                        if(value) {
                            setIsPromptOptimizerRunning(true);
                            const optimizeIt = async () => {
                                try {

                                        console.log("Calling prompt optimizer...");
                                        const result = await optimizePrompt(value, maxPlaceholders);
                                        console.log("Optimization result: ", result);
                                        onOptimized(prompt, result.data.prompt_template);

                                } catch (e) {
                                    console.log(e);
                                    alert("Error optimizing prompt. Please try again.")
                                }
                                finally {
                                    setIsPromptOptimizerRunning(false);
                                }
                            };

                            optimizeIt();

                        }
                    }
                    }
                    onKeyDown={(e) => {

                    }}
                    title="Optimize Prompt"

                >
                    <IconWand size={20}/>
                </button>
    </div>);
};

export default PromptOptimizerButton;
