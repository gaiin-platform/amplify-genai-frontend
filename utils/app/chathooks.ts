import {Conversation, Message} from "@/types/chat";

export interface HookButton {
    label: string,
    uri: string
}

export interface HookResult {
    updatedContent?: string;
}

export interface HookContext {
    [key: string]: any;
}

export interface ChatHook {
    name: string;
    description: string;
    exec: (context: HookContext, conversation: Conversation, messageContent: string) => HookResult;
}

export const appendOnce = (content: string, append: string): string => {
    if (content.indexOf(append) === -1) {
        return content + append;
    }
    return content;
}

export const getHook = (tags: string[]): ChatHook => {

    console.log("Returning empty hook");
    return {
        name: "Empty",
        description: "No op",
        exec: (context: HookContext, conversation: Conversation, messageContent: string) => {
            return {};
        }
    };
}