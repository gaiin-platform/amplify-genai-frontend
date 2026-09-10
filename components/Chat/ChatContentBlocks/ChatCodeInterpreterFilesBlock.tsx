import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import ChatCodeInterpreter from "@/components/Chat/ChatContentBlocks/ChatCodeInterpreter";
import { IconInfoCircle } from "@tabler/icons-react";
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
    message: any;
}

const ChatCodeInterpreterFileBlock: React.FC<Props> = ({ message, messageIsStreaming }) => {

    const sessionRenewed = message.data?.state?.codeInterpreter?.sessionRenewed === true;

    // Read files from two sources:
    // 1. message.data.state.codeInterpreter.content — set during the current streaming session
    // 2. message.codeInterpreterMessageData.content  — persisted after streaming, survives page reload
    const streamingFiles: FileInfo[] = message.data?.state?.codeInterpreter?.content ?? [];
    const persistedFiles: FileInfo[] = message.codeInterpreterMessageData?.content ?? [];
    const files: FileInfo[] = streamingFiles.length > 0 ? streamingFiles : persistedFiles;

    if (messageIsStreaming || (files.length === 0 && !sessionRenewed)) {
        return <></>
    }

    return <div className="mt-3">
                {sessionRenewed &&
                <div className="flex items-start gap-2 rounded-md border border-blue-400/40 bg-blue-500/10 px-3 py-2 mb-2 text-sm text-black dark:text-white">
                    <IconInfoCircle size={16} className="mt-0.5 shrink-0" />
                    <span>
                        Session restarted. Files preserved, but Python state was cleared. You may need to re-run earlier steps.
                    </span>
                </div>}
                {files.length > 0 &&
                <ExpansionComponent title="Generated Files"
                    content={files.map((file: FileInfo, index: number) => (
                        <ChatCodeInterpreter key={index} file_info={file} />
                ))}/>}
            </div>;
};

export default ChatCodeInterpreterFileBlock;


