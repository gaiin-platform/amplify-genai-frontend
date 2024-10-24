import {Conversation, Message} from "@/types/chat";
import {usePromptFinderService} from "@/hooks/usePromptFinderService";
import {parsePartialJson} from "@/utils/app/data";
import {useEffect, useState} from "react";
import React from "react";


interface Props {
    messageIndex: number;
    message: Message;
    selectedConversation: Conversation | undefined;
    setIsHighlightDisplay: (val: boolean) => void;
}


const AssistantMessageHighlight: React.FC<Props> = (
    {selectedConversation,
        message,
        messageIndex,
        setIsHighlightDisplay
    }) => {


    const {getOutputTransformers} = usePromptFinderService();

    const transformMessageContent = (conversation:Conversation, message:Message) => {
        try {
            const {transformer} = getOutputTransformers(conversation, message);
            return transformer(conversation, message, {parsePartialJson});
        }catch(e){
            console.log("Error transforming output.");
            console.log(e);
        }
        return message.content;
    }

    const transformedMessageContent = selectedConversation ?
        transformMessageContent(selectedConversation, message) :
        message.content;
    // console.log(transformedMessageContent);

    const [renderKey, setRenderKey] = useState<number>(0);

    useEffect(() => {
        const handleReRenderEvent = () => {
            setRenderKey(prev => prev + 1);
        };

        // Listen for the custom event 'triggerChatReRender'
        window.addEventListener('triggerChatReRender', handleReRenderEvent);
        return () => {
            window.removeEventListener('triggerChatReRender', handleReRenderEvent);
        };
    }, []);

    const content = transformedMessageContent.split(/(```[\s\S]*?```)/g);


    return (
    <div key={renderKey} className="border border-blue-500 px-2 py-4 mr-2">
        <div className="chatContentBlock" 
            data-is-highlight-display={true}
            data-message-index={messageIndex}
            data-original-content={transformedMessageContent}>
            <div className="prose dark:prose-invert flex-1">

            {transformedMessageContent
                .split(/(```[\s\S]*?```)/g)
                .filter(Boolean) // Remove any empty strings
                .map((part: string, index: number) => {
                    return part.split('\n').map((line, i) => (
                            <p key={`${index}-${i}`} className="prose dark:prose-invert flex-1">
                                {line ? line :  '\n\n'}
                            </p> 
                    ));
                    
                })}
            </div>

            
        </div>

        <div className="mt-10 flex justify-center">
            <button
                    className="h-[40px] rounded-md bg-blue-500 px-4 py-1 text-sm font-medium text-white enabled:hover:bg-blue-600 disabled:opacity-50 shadow-lg"
                    onClick={() => {
                        setIsHighlightDisplay(false);
                    }}
                >
                    {'Return to rendered message content'}
            </button>
        </div>
    </div>
);
};

export default AssistantMessageHighlight;
