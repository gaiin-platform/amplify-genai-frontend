import React from 'react';
import { Message } from '@/types/chat';
import { Conversation } from '@/types/chat';
import ChatContentBlock from './ChatContentBlock';
import ExpansionComponent from '../ExpansionComponent';
import { lzwUncompress } from '@/utils/app/lzwCompression';

interface Props {
    message: Message;
    messageIndex: number;
    selectedConversation: Conversation | undefined;
}

export const AssistantReasoningMessage: React.FC<Props> = ({ 
    message, 
    messageIndex, 
    selectedConversation 
}) => {

    if (!message?.data?.state?.reasoning) {
        return <></>;
    }


    // Create a modified message with reasoning content
    const reasoningMessage: Message = {
        ...message,
        content: typeof message.data.state.reasoning === 'string' ? message.data.state.reasoning :lzwUncompress(message.data.state.reasoning),
        role: 'assistant'
    };

    const handleCustomLinkClick = (_message: Message, href: string) => {
        // Handle custom link clicks if needed
        console.log('Custom link clicked in reasoning:', href);
    };

    return (
        <div className="text-sm!important opacity-70 mb-4">
            <ExpansionComponent
                content={
                <ChatContentBlock
                    message={reasoningMessage}
                    messageIndex={messageIndex}
                    messageIsStreaming={false}
                    selectedConversation={selectedConversation}
                    handleCustomLinkClick={handleCustomLinkClick}
                />}
                title="Reasoning"
            />
        </div>
    );
};