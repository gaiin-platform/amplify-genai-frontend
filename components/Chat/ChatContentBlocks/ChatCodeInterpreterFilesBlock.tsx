import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import {Conversation, Message} from "@/types/chat";
import ChatCodeInterpreter from "@/components/Chat/ChatContentBlocks/ChatCodeInterpreter";
import React from "react";


interface FileInfo {
    type: string;
    values: {
      file_key: string;
      presigned_url: string;
      file_size: number;
      file_key_low_res?: string;
      presigned_url_low_res?: string;
    };
  }


interface Props {
    messageIsStreaming: boolean;
    message: Message;
}

const ChatCodeInterpreterFileBlock: React.FC<Props> = (
    {message, messageIsStreaming
    }) => {

    const files = (message.codeInterpreterMessageData?.content) ? message.codeInterpreterMessageData.content : [];
   
    if(Object.keys(files).length === 0 || messageIsStreaming){
        return <></>;
    }


    
    return <div className="mt-3">
        <ExpansionComponent title="Generated Files"
            content={files.map((file: FileInfo, index: number) => (
                <ChatCodeInterpreter
                    key={index}
                    file_info={file} />
                
        ))}/>
    </div>;
};

export default ChatCodeInterpreterFileBlock;


