import React, {FC} from 'react';
import {Message} from "@/types/chat";
import {ChatMessage} from "@/components/Chat/ChatMessage";

interface Props {
    messages: Message[];
}

export const ExampleChat: FC<Props> = ({messages}) => {

    return (
        <div className="relative flex-1 overflow-hidden bg-white dark:bg-[#343541]">
            <div
                className="max-h-full overflow-x-hidden"
            >
                {messages?.map((message, i) => (
                    <ChatMessage
                        key={i}
                        message={message}
                        messageIndex={i}
                        onSend={() => {}}
                        onSendPrompt={() => {}}
                        onChatRewrite={() => {}}
                        handleCustomLinkClick={() => {}}
                    />
                ))}
            </div>
        </div>);
}