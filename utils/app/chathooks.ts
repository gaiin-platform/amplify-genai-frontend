import {Conversation, Message} from "@/types/chat";
import {findWorkflowPattern} from "@/utils/workflow/aiflow";

export interface HookButton {
    label:string,
    uri:string
}

export interface HookResult {
    updatedContent?:string;
}

export interface HookContext {
    [key:string]:any;
}

export interface ChatHook {
    name: string;
    description: string;
    exec: (context:HookContext, conversation:Conversation, messageContent:string)=>HookResult;
}

export const getHook = (tags: string[]):ChatHook => {

    console.log("Getting hook for tags: ", tags);

    if(tags.includes("automation")){

        console.log("Returning automation hooks");

        return {
            name: "Automation",
            description: "Run a custom automation",
            exec: (context: HookContext, conversation: Conversation, messageContent:string) => {
                console.log("Running automation hook");
                console.log("Message: ", messageContent);

                let updatedContent = messageContent;

                try {
                    const code = findWorkflowPattern(messageContent);
                    if(code){
                        updatedContent += "\n\n## Options: \n\n" +
                            "Would you like to: [Run Workflow](#workflow:run-workflow/) or [Save Workflow](#workflow:save-workflow/)?" +
                            "\n\n[Hello](#chat:send/hello) or [Cat](#chat:template/Cat)";
                    }
                }catch (e){

                }

                return {
                    updatedContent: updatedContent
                };
            }
        };
    }
    else {
        console.log("Returning empty hook");
        return {
            name: "Empty",
            description: "No op",
            exec: (context: HookContext, conversation: Conversation, messageContent:string) => {
                return {};
            }
        };
    }


}