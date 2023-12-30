import {useContext} from "react";
import HomeContext from "@/pages/api/home/home.context";
import {Conversation, Message, MessageType} from "@/types/chat";


export function usePrefixService() {

    const {
        state: {prompts},
    } = useContext(HomeContext);


    const getPrefix = (conversation:Conversation, message:Message) => {
        const tags = conversation.tags || [];

        if(!tags || tags.length === 0){
            return {prefix:null, label:message.label || message.content};
        }

        const prefix = prompts.find(p => {
            if(p.type === MessageType.PREFIX_PROMPT && p.data && p.data.requiredTags){
                if(p.data.requiredTags.every((t:string) => tags.includes(t))){
                    return p;
                }
            }
            return null;
        });

        return {prefix:prefix?.content, label:message.label || message.content};
    };


    return {getPrefix};
}