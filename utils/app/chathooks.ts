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

export const appendOnce = (content:string, append:string):string => {
    if(content.indexOf(append) === -1){
        return content + append;
    }
    return content;
}

export const getHook = (tags: string[]):ChatHook => {

    if(tags.includes("automation")){

        return {
            name: "Automation",
            description: "Run a custom automation",
            exec: (context: HookContext, conversation: Conversation, messageContent:string) => {

                let updatedContent = messageContent;

                try {
                    const code = findWorkflowPattern(messageContent);
                    if(code){
                        updatedContent = appendOnce(updatedContent,"\n\n## Options: \n\n" +
                            "Would you like to: [Run Workflow](#workflow:run-workflow/) or [Save Workflow](#workflow:save-workflow/)?");
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