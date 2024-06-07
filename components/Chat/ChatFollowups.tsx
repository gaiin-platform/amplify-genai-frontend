// ChatFollowups.tsx
import React, {useContext, useEffect, useRef} from 'react';
import {Conversation, MessageType} from "@/types/chat";
import {Prompt} from "@/types/prompt";
import HomeContext from "@/pages/api/home/home.context";

type ChatFollowupsProps = {
    promptSelected: (prompt: Prompt) => void,
};

const ChatFollowups: React.FC<ChatFollowupsProps> = ({promptSelected}) => {

    const {
        state: {prompts, selectedConversation},
    } = useContext(HomeContext);

    const promptsRef = useRef(prompts);

    useEffect(() => {
        promptsRef.current = prompts;
      }, [prompts]);

    const conversationTags = selectedConversation?.tags || [];
    const promptButtons = promptsRef.current.filter((prompt:Prompt) => {
        const promptTags = prompt.data?.requiredTags;
        if (prompt.type === MessageType.FOLLOW_UP && (!promptTags || promptTags.length === 0)) {
            return true;
        }
        if (!conversationTags || prompt.type !== MessageType.FOLLOW_UP) {
            return false;
        }
        return promptTags.some((tag: string) => conversationTags.includes(tag));
    });

    const sendPrompt = (prompt:Prompt) => {
        const toSend = {...prompt, type: MessageType.PROMPT};
        promptSelected(toSend);
    }

    return (
        <div className="mt-4 flex-wrap gap-4">
            {promptButtons.map((prompt:Prompt) => (
                <button
                    key={prompt.id}
                    className="invisible group-hover:visible focus:visible px-5 py-2 mr-1 mt-1 text-sm border border-gray-600 rounded-lg text-gray-700 hover:bg-gray-100 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
                    onClick={(e)=>{
                        e.preventDefault();
                        e.stopPropagation();
                        sendPrompt(prompt);
                    }}
                >
                    {prompt.name}
                </button>
            ))}
        </div>
    )
};

export default ChatFollowups;