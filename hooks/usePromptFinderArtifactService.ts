import {useContext, useEffect, useRef} from "react";
import HomeContext from "@/pages/api/home/home.context";
import {Conversation, Message, MessageType} from "@/types/chat";
import { Prompt } from "@/types/prompt";
import { Artifact } from "@/types/artifacts";
import { lzwUncompress } from "@/utils/app/lzwCompression";

export function useArtifactPromptFinderService() {
    const {
        state: {prompts},
    } = useContext(HomeContext);

    const promptsRef = useRef(prompts);

    useEffect(() => {
        promptsRef.current = prompts;
      }, [prompts]);


    const getApplicablePromptsByTagAndType = (artifact:Artifact) => {
        const tags = artifact.tags || [];

        if(!tags || tags.length === 0){
            return {content:null};
        }

        const applicable = promptsRef.current.find((p:Prompt) => {
            if(p.data && p.data.requiredTags){
                if(p.data.requiredTags.every((t:string) => tags.includes(t))){
                    return p;
                }
            }
            return null;
        });

        return {content:applicable?.content, prompt:applicable};
    };


    const getOutputTransformers = (artifact:Artifact) => {
        const {content, prompt} = getApplicablePromptsByTagAndType(artifact);

        let transformer = (artifact:Artifact, properties: {}): any => {
            return lzwUncompress(artifact.contents);
        };

        if(content) {
            try {
                let context = {
                    transformer: (artifact:Artifact, properties: {}): any => {
                    }
                };

                transformer = context.transformer;
            } catch (e) {
                console.log("Error creating artifact transformer from content.", content);
                console.log(e);
            }
        }

        return {content, transformer, prompt};
    };

    return {getOutputTransformers, getApplicablePromptsByTagAndType};
}