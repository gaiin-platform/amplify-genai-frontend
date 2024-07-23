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
import { DataTable } from "@/components/Markdown/DataTable";
import AutonomousBlock from "@/components/Chat/ChatContentBlocks/AutonomousBlock";
import {useContext} from "react";
import HomeContext from "@/pages/api/home/home.context";
import OpBlock from "@/components/Chat/ChatContentBlocks/OpBlock";
import ApiKeyBlock from "./ApiKeyBlock";
import { ApiKey } from "@/types/apikeys";
import { ApiDocBlock } from "./APIDocBlock";

// TODO: IMPLEMENT DATA TABLE COMPONENT INTO THIS FILE

interface Props {
    messageIsStreaming: boolean;
    messageIndex: number;
    message: Message;
    selectedConversation: Conversation|undefined;
    handleCustomLinkClick: (message:Message, href: string) => void,
}

const ChatContentBlock: React.FC<Props> = (
    {selectedConversation,
        message,
        messageIndex,
        messageIsStreaming,
        handleCustomLinkClick,
    }) => {

    const {
        state: {
            featureFlags
        },
    } = useContext(HomeContext);

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

    const isLast = messageIndex == (selectedConversation?.messages.length ?? 0) - 1;

    return (<MemoizedReactMarkdown
    className="prose dark:prose-invert flex-1"
    remarkPlugins={[remarkGfm, remarkMath]}
    //onMouseUp={handleTextHighlight}
    // @ts-ignore
    //rehypePlugins={[rehypeRaw]}
    //rehypePlugins={[rehypeMathjax]}
    components={{
        // @ts-ignore
        Mermaid,
        a({href, title, children, ...props}) {
            return (
                (href && href.startsWith("#")) ?
                    <button
                        className="px-4 py-2 text-white bg-blue-500 rounded hover:bg-green-600"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCustomLinkClick(message, href || "#");
                        }}>
                        {children}
                    </button> :
                    <a href={href} onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCustomLinkClick(message, href || "/");
                    }}>
                        {children}
                    </a>
            );
        },
        code({node, inline, className, children, ...props}) {
            if (children.length) {
                if (children[0] == '▍') {
                    return <span className="animate-pulse cursor-default mt-1">▍</span>
                }

                children[0] = (children[0] as string).replace("`▍`", "▍")
            }

            let match = /language-(\w+)/.exec(className || '');

            if (!inline && match && match[1]) {

                switch (match[1]) {
                    case 'mermaid':
                        //console.log("mermaid")
                        //@ts-ignore
                        return (<Mermaid chart={String(children)} currentMessage={messageIndex == (selectedConversation?.messages.length ?? 0) - 1 }/>);
                    
                    case 'apiResult':
                        return (<ExpansionComponent title={"Result"} content={String(children)}/>)
                    case 'auto':
                        if (selectedConversation && featureFlags.automation) {
                            //console.log("mermaid")
                            //@ts-ignore
                            return (
                                <AutonomousBlock
                                    message={message}
                                    conversation={selectedConversation}
                                    onStart={(id, action) => {}}
                                    onEnd={(id, action) => {}}
                                    id={message.id}
                                    isLast={isLast}
                                    action={String(children)}
                                    ready={!messageIsStreaming}
                                />
                            );
                        }
                        break;
                
                    case 'op':
                        if (selectedConversation) {
                            //@ts-ignore
                            return (<OpBlock message={message} definition={String(children)} />
                            );
                        }
                        break;
                
                    case 'assistant':
                        //console.log("mermaid")
                        //@ts-ignore
                        return (<AssistantBlock definition={String(children)}/>);
                
                    case 'toggle':
                        //console.log("mermaid")
                        //@ts-ignore
                        return (<ExpansionComponent content={String(children)} title={"Source"}/>);
                
                    case 'APIkey':
                        return (<ApiKeyBlock content={String(children)}/>);

                    case 'APIdoc':
                        return (<ApiDocBlock content={String(children)}/>);
                
                    default:
                        if (match[1].toLowerCase() === 'vega' || match[1].toLowerCase() === 'vegalite') {
                            //console.log("mermaid")
                            //@ts-ignore
                            return (<VegaVis chart={String(children)} currentMessage={messageIndex == (selectedConversation?.messages.length ?? 0) - 1} />);
                        }
                        break;
                }
                
            }


            return !inline ? (
                <CodeBlock
                    key={Math.random()}
                    language={(match && match[1]) || ''}
                    value={String(children).replace(/\n$/, '')}
                    {...props}
                />
            ) : (
                <code className={className} {...props}>
                    {children}
                </code>
            );
        },
        table({children}) {
            return (
                <div style={{ overflowX: 'auto'}}>
                    <table className="w-full border-collapse border border-black px-3 py-1 dark:border-white">
                        {children}
                    </table>
                </div>
            );
        },
        th({children}) {
            return (
                <th className="break-words border border-black bg-gray-500 px-3 py-1 text-white dark:border-white">
                    {children}
                </th>
            );
        },
        td({children}) {

            return (
                <td className="break-words border border-black px-3 py-1 dark:border-white">
                    {children}
                </td>
            );
        },
    }}
>
    {`${transformedMessageContent}${
        messageIsStreaming && messageIndex == (selectedConversation?.messages.length ?? 0) - 1 ? '`▍`' : ''
    }`}
</MemoizedReactMarkdown>);
};

export default ChatContentBlock;
