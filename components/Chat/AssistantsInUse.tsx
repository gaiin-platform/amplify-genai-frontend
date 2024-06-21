// ChatFollowups.tsx
import React, {useContext} from 'react';
import {Conversation, MessageType} from "@/types/chat";
import {Prompt} from "@/types/prompt";
import HomeContext from "@/pages/api/home/home.context";
import {Assistant, DEFAULT_ASSISTANT} from "@/types/assistant";
import {IconCheck, IconCircleX, IconAt} from "@tabler/icons-react";
import {AttachedDocument} from "@/types/attacheddocument";

type Props = {
    assistants: Assistant[];
    assistantsChanged: (assistants: Assistant[]) => void;
};

const AssistantsInUse: React.FC<Props> = ({assistants,assistantsChanged}) => {

    const {
        state: {prompts, selectedConversation}
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
            //add prompt template
            selectedConversation.promptTemplate = null;
            //clear tags - currently only really applies to the assistant creator 
            const aTags = assistant.definition.data?.conversationTags;
            if (selectedConversation.tags && aTags) {
                selectedConversation.tags = selectedConversation.tags.filter((tag:string) => !aTags.includes(tag));

                //remove added additional assistant creator prompt (I added when selecting the assitant creator)
                if (assistant.id === 'ast/assistant-builder' && selectedConversation.prompt) {
                    const marker = "CURRENT ASSISTANT CREATOR CUSTOM INSTRUCTIONS:";
                    const index = selectedConversation.prompt.indexOf(marker);
                    if (index !== -1) selectedConversation.prompt = selectedConversation.prompt.substring(0, index);
                } 
            }

        }
    }

    return (
        <div className="flex flex-row pb-2 mt-2">
            {assistants?.map((assistant, i) => (
                <div
                    key={i}
                    className={`bg-white flex flex-row items-center justify-between border bg-white rounded-md px-1 py-1 ml-1 mr-1 shadow-lg`}
                    style={{ maxWidth: '300px' }}
                >
                    <button
                        className="text-gray-400 hover:text-gray-600 transition-all"
                        onClick={(e) =>{
                            e.preventDefault();
                            e.stopPropagation();
                            assistantsChanged(assistants.filter(x => x != assistant));
                            handleRemoveSelectedAssistant(assistant);
                        }}
                    >
                        <IconCircleX/>
                    </button>

                    <div className="ml-1 flex flex-row items-center">
                        <div>
                            <IconAt size="18" className="text-gray-800"/>
                        </div>
                        <div className={`truncate font-medium text-sm text-gray-800`}
                           style={{ maxWidth: '300px' }}>
                            {getLabel(assistant)}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
};

export default AssistantsInUse;