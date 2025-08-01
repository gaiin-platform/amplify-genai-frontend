import {useContext, useEffect, useRef} from "react";
import HomeContext from "@/pages/api/home/home.context";
import {Conversation, Message, MessageType} from "@/types/chat";
import { Prompt } from "@/types/prompt";
import { userFriendlyDate } from "@/utils/app/date";


export function usePromptFinderService() {

    const {
        state: {prompts},
    } = useContext(HomeContext);

    const promptsRef = useRef(prompts);

    useEffect(() => {
        promptsRef.current = prompts;
      }, [prompts]);


    const getApplicablePromptsByTagAndType = (conversation:Conversation, message:Message, type:MessageType) => {
        const tags = conversation.tags || [];

        if(!tags || tags.length === 0){
            return {content:null, label:message.label || message.content};
        }

        const applicable = promptsRef.current.find((p:Prompt) => {
            if(p.type === type && p.data && p.data.requiredTags){
                if(p.data.requiredTags.every((t:string) => tags.includes(t))){
                    return p;
                }
            }
            return null;
        });

        return {content:applicable?.content, label:message.label || message.content, prompt:applicable};
    };

    const getPrefix = (conversation:Conversation, message:Message) => {
        return getApplicablePromptsByTagAndType(conversation, message, MessageType.PREFIX_PROMPT);
    };

    const getOutputTransformers = (conversation:Conversation, message:Message) => {
        const {content, label, prompt} = getApplicablePromptsByTagAndType(conversation, message, MessageType.OUTPUT_TRANSFORMER);

        let transformer = (conversation:Conversation, message:Message, properties:{}): any => {
            const contentWithClickableDates = (content: string) => {
                const isoDateRegex = /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z\b/g;
                
                return content.replace(isoDateRegex, (match) => {
                    return `\`clickableDate:${match}\``;
                });
            };
            return contentWithClickableDates(message.content);
        };

        if(content) {
            try {
                let context = {
                    transformer: (conversation: Conversation, message: Message, properties: {}): any => {
                    }
                };

                

                transformer = context.transformer;
            } catch (e) {
                console.log("Error creating transformer from content.", content);
                console.log(e);
            }
        }

        return {content, transformer, label, prompt};
    };

    return {getPrefix, getOutputTransformers, getApplicablePromptsByTagAndType};
}