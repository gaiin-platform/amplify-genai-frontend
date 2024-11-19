import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import {Message} from "@/types/chat";
import ChatSourceList from "@/components/Chat/ChatContentBlocks/ChatSourceList";
import React from "react";

interface Props {
    messageIsStreaming: boolean;
    message: Message;
}

const ChatSourceBlock: React.FC<Props> = (
    {message, messageIsStreaming
    }) => {

    const sources = (message.data?.state && message.data?.state.sources) ? message.data.state.sources : {};
        // console.log("ds",sources)
    if(Object.keys(sources).length === 0 || messageIsStreaming){
        return <></>;
    }

    return <div className="mt-3" key={message.id}>
        <ExpansionComponent title="Sources"
            content={Object.keys(sources).map((source, index) => (
            <ChatSourceList
                key={index}
                name={source}
                sources={sources[source].sources || []}/>
        ))}/>
    </div>;
};

export default ChatSourceBlock;
