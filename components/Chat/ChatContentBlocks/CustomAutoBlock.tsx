import React, { useContext, useEffect, useState } from 'react';
import { executeAssistantApiCall } from '@/services/assistantAPIService';
import HomeContext from '@/pages/api/home/home.context';
import { Conversation, Message, newMessage } from '@/types/chat';
import ExpansionComponent from '@/components/Chat/ExpansionComponent';
import { useSendService } from "@/hooks/useChatSendService";

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
        state: { selectedConversation, selectedAssistant },
        dispatch: homeDispatch,
        handleAddMessages,
        shouldStopConversation,
    } = useContext(HomeContext);

    const { handleSend } = useSendService();
    const [isExecuted, setIsExecuted] = useState(false);
    const [actionPrompted, setActionPrompted] = useState<boolean>(false);

    const runAction = async () => {
        if (!isLast || isExecuted || message.data.customAuto) {
            return;
        }

        setActionPrompted(true);
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
            //const parsedAction = JSON.parse(action);

            const requestData = {
                action:action,
                conversation: selectedConversation?.id,
                assistant: selectedAssistant?.id,
                message: message.id
            };
            // console.log("REQUEST DATA", requestData);

            const result = await executeAssistantApiCall(requestData);

            if(!result || !result.data || !result.data.code || result.data.hasExecuted){
                return;
            }

            let resultString = JSON.stringify(result);
            if (resultString.length > 25000) {
                resultString = resultString.substring(0, 25000);
            }


            if (!shouldStopConversation()) {
                homeDispatch({ field: 'loading', value: true });
                homeDispatch({ field: 'messageIsStreaming', value: true });

                // Create a feedback message similar to AutonomousBlock
                const feedbackMessage = "Result: " + resultString;

                // Send the result back to the assistant
                handleSend(
                    {
                        options: { assistantId: selectedAssistant?.id },
                        message: newMessage({
                            role: 'user',
                            content: JSON.stringify(feedbackMessage),
                            label: 'API Result',
                            data: {
                                actionResult: true,
                                customAutoResult: true
                            }
                        })
                    },
                    shouldStopConversation
                );
            }

        } catch (error) {
            console.error('Error executing custom auto:', error);

            // Send error message back to the assistant
            if (!shouldStopConversation()) {
                handleSend(
                    {
                        options: { assistantId: selectedAssistant?.id },
                        message: newMessage({
                            role: 'user',
                            content: JSON.stringify({
                                error: 'Failed to execute custom auto action',
                                details: error
                            }),
                            label: 'API Error',
                            data: {
                                actionResult: true,
                                customAutoResult: true,
                                error: true
                            }
                        })
                    },
                    shouldStopConversation
                );
            }
        }

        onEnd(id, action);
    };

    useEffect(() => {
        if (ready && !actionPrompted) {
            runAction();
        }
    }, [ready, action]);

    return (
        <div>
            <div className="rounded-xl text-neutral-600 border-2 dark:border-none dark:text-white bg-neutral-100 dark:bg-[#343541] rounded-md shadow-lg mb-2 mr-2">
                <ExpansionComponent
                    title="Custom Auto Action in Progress..."
                    content={action}
                />
            </div>
        </div>
    );
};

export default CustomAutoBlock;