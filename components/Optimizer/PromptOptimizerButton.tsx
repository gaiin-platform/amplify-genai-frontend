

import HomeContext from "@/pages/api/home/home.context";
import {optimizePrompt} from "@/services/promptOptimizerService";
import {IconWand} from "@tabler/icons-react";
import {useContext, useState} from "react";


interface PromptOptimzierProps {
    prompt: string,
    onOptimized: (prompt:string, optimizedPrompt:string) => void,
    maxPlaceholders: number
}


const PromptOptimizerButton: React.FC<PromptOptimzierProps> = ({prompt,onOptimized, maxPlaceholders}) => {

    const { state: { prompts}, setLoadingMessage} = useContext(HomeContext);


    // @ts-ignore
    return (<div>
                <button
                    className=" left-1 top-2 rounded-sm p-1 text-neutral-800 opacity-60 hover:bg-neutral-200 hover:text-neutral-900 dark:bg-opacity-50 dark:text-neutral-100 dark:hover:text-neutral-200"
                    onMouseDown={ (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const value = prompt;
                        if(value) {
                            setLoadingMessage("Optimizing Prompt...");

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
                                    setLoadingMessage("");


                                }
                            };

                            optimizeIt();

                        }
                    }
                    }
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
