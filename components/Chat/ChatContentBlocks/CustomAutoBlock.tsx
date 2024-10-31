import React, { useContext, useEffect, useState } from 'react';
import { executeCustomAuto } from '@/services/assistantAPIService';
import HomeContext from '@/pages/api/home/home.context';
import { Conversation, Message, newMessage } from '@/types/chat';
import ExpansionComponent from '@/components/Chat/ExpansionComponent';

interface Props {
    conversation: Conversation;
    message: Message;
    onStart: (id: string, action: any) => void;
    onEnd: (id: string, action: any) => void;
    action: any;
    ready: boolean;
    id: string;
    isLast: boolean;
}

const CustomAutoBlock: React.FC<Props> = ({
    conversation,
    message,
    onStart,
    onEnd,
    action,
    ready,
    id,
    isLast,
}) => {
    const {
        state: { selectedConversation },
        dispatch: homeDispatch,
        handleAddMessages,
    } = useContext(HomeContext);

    const [isExecuted, setIsExecuted] = useState(false);

    const runAction = async () => {
        if (!isLast || isExecuted || message.data.customAuto) {
            return;
        }

        setIsExecuted(true);
        onStart(id, action);

        homeDispatch({
            type: 'conversation',
            action: {
                type: 'updateMessages',
                conversationId: conversation.id,
                messages: [{
                    ...message,
                    data: {
                        ...message.data,
                        customAuto: {
                            status: 'running',
                        },
                    },
                }],
            },
        });

        try {
            const result = await executeCustomAuto(action);

            if (result.success) {
                const responseMessage = newMessage({
                    role: 'assistant',
                    content: JSON.stringify(result),
                    data: {
                        customAutoResult: true,
                    },
                });

                handleAddMessages(selectedConversation, [responseMessage]);
            } else {
                console.error('Custom auto execution failed:', result.message);
            }
        } catch (error) {
            console.error('Error executing custom auto:', error);
        }

        onEnd(id, action);
    };

    useEffect(() => {
        if (ready) {
            runAction();
        }
    }, [ready, action]);

    return (
        <div>
            <div className="rounded-xl text-neutral-600 border-2 dark:border-none dark:text-white bg-neutral-100 dark:bg-[#343541] rounded-md shadow-lg mb-2 mr-2">
                <ExpansionComponent
                    title="Custom Auto Action in Progress..."
                    content={JSON.stringify(action, null, 2)}
                />
            </div>
        </div>
    );
};

export default CustomAutoBlock;