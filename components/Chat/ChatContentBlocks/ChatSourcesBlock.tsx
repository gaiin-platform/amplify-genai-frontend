import {MemoizedReactMarkdown} from "@/components/Markdown/MemoizedReactMarkdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import {CodeBlock} from "@/components/Markdown/CodeBlock";
import {Conversation, Message} from "@/types/chat";
import Mermaid from "@/components/Chat/ChatContentBlocks/MermaidBlock";
import VegaVis from "@/components/Chat/ChatContentBlocks/VegaVisBlock";
import AssistantBlock from "@/components/Chat/ChatContentBlocks/AssistantBlock";
import {useChatService} from "@/hooks/useChatService";
import {usePromptFinderService} from "@/hooks/usePromptFinderService";
import {parsePartialJson} from "@/utils/app/data";
import ChatSourceList from "@/components/Chat/ChatContentBlocks/ChatSourceList";

interface Props {
    messageIsStreaming: boolean;
    messageIndex: number;
    message: Message;
    selectedConversation: Conversation|undefined;
    handleCustomLinkClick: (message:Message, href: string) => void,
}

const ChatSourceBlock: React.FC<Props> = (
    {message, messageIsStreaming
    }) => {

    const sources = (message.data?.state && message.data?.state.sources) ? message.data.state.sources : {};

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
