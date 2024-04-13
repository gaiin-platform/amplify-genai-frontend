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
        state: {prompts, selectedConversation},
    } = useContext(HomeContext);

    if(assistants.length === 0 || !assistants[0] || !assistants[0].id || assistants[0].id === DEFAULT_ASSISTANT.id){
        return <></>;
    }

    const getLabel = (assistant:Assistant) => {
        if(!assistant.definition.name) { return 'Untitled Assistant'; }
        return assistant.definition.name.length > 30 ? assistant.definition.name.slice(0, 30) + '...' : assistant.definition.name;
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