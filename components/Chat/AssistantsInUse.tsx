// ChatFollowups.tsx
import React, {useContext} from 'react';
import {Conversation, MessageType} from "@/types/chat";
import {Prompt} from "@/types/prompt";
import HomeContext from "@/pages/api/home/home.context";
import {Assistant, DEFAULT_ASSISTANT} from "@/types/assistant";
import {IconRobot, IconX} from "@tabler/icons-react";
import { DEFAULT_SYSTEM_PROMPT } from '@/utils/app/const';

type Props = {
    assistants: Assistant[];
    assistantsChanged: (assistants: Assistant[]) => void;
};

const AssistantsInUse: React.FC<Props> = ({assistants,assistantsChanged}) => {

    const {
        state: {prompts, selectedConversation}, handleUpdateSelectedConversation
    } = useContext(HomeContext);

    if(assistants.length === 0 || !assistants[0] || !assistants[0].id || assistants[0].id === DEFAULT_ASSISTANT.id){
        return <></>;
    }

    const getLabel = (assistant:Assistant) => {
        if(!assistant.definition.name) { return 'Untitled Assistant'; }
        return assistant.definition.name.length > 30 ? assistant.definition.name.slice(0, 30) + '...' : assistant.definition.name;
    }

    function handleRemoveSelectedAssistant(assistant: Assistant) {
        if (selectedConversation) {
            const updatedConversation = {...selectedConversation};
            //add prompt template
            updatedConversation.promptTemplate = null;
            //clear tags - currently only really applies to the assistant creator 
            const aTags = assistant.definition.data?.conversationTags;
            if (updatedConversation.tags && aTags) {
                updatedConversation.tags = updatedConversation.tags.filter((tag:string) => !aTags.includes(tag));
            }
            updatedConversation.prompt = DEFAULT_SYSTEM_PROMPT;
            
            handleUpdateSelectedConversation(updatedConversation);

        }
    }

    return (
        <div className="flex flex-row pb-4 my-1">
            {assistants?.map((assistant, i) => (
                <div
                    id="assistantChatLabel"
                    key={i}
                    className={`relative enhanced-assistant-badge flex flex-row items-center justify-between rounded-full px-3 py-1.5 ml-1 mr-1`}
                    style={{ maxWidth: '300px' }}
                >
                    <div className="flex flex-row items-center gap-1.5">
                        <IconRobot size="16" className="text-white/90"/>
                        <div className={`truncate font-medium text-sm text-white leading-normal pr-2 mr-2`}
                           style={{ maxWidth: '250px' }}>
                            {getLabel(assistant)}
                        </div>
                    </div>
                    
                    <button
                        className="absolute right-2 text-white/70 hover:text-white transition-all"
                        onClick={(e) =>{
                            e.preventDefault();
                            e.stopPropagation();
                            assistantsChanged(assistants.filter(x => x != assistant));
                            handleRemoveSelectedAssistant(assistant);
                        }}
                    >
                        <IconX size="16"/>
                    </button>
                </div>
            ))}
        </div>
    )
};

export default AssistantsInUse;