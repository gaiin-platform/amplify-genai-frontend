import {MemoizedReactMarkdown} from "@/components/Markdown/MemoizedReactMarkdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import {CodeBlock} from "@/components/Markdown/CodeBlock";
import {Conversation, Message} from "@/types/chat";
import Mermaid from "@/components/Chat/ChatContentBlocks/MermaidBlock";
import VegaVis from "@/components/Chat/ChatContentBlocks/VegaVisBlock";
import AssistantBlock from "@/components/Chat/ChatContentBlocks/AssistantBlock";
import {usePromptFinderService} from "@/hooks/usePromptFinderService";
import {parsePartialJson} from "@/utils/app/data";
import AutonomousBlock from "@/components/Chat/ChatContentBlocks/AutonomousBlock";
import {useContext, useEffect, useState} from "react";
import HomeContext from "@/pages/api/home/home.context";
import OpBlock from "@/components/Chat/ChatContentBlocks/OpBlock";
import ApiKeyBlock from "./ApiKeyBlock";
import { ApiDocBlock } from "./APIDocBlock";
import AutoArtifactsBlock from "./AutoArtifactBlock";
import DOMPurify from  "dompurify";
import React from "react";
import InvokeBlock from '@/components/Chat/ChatContentBlocks/InvokeBlock';




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
 
  // Add local state to trigger re-render
  const [renderKey, setRenderKey] = useState(0);

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

//   console.log(transformedMessageContent)
  
    return (
    <div className="chatContentBlock" 
         data-message-index={messageIndex}
         data-original-content={transformedMessageContent}>
    <MemoizedReactMarkdown
    key={renderKey}
    className="prose dark:prose-invert flex-1" 
    remarkPlugins={[remarkGfm, remarkMath]}
    //onMouseUp={handleTextHighlight}
    //rehypePlugins={[rehypeRaw]}
    //rehypePlugins={[rehypeMathjax]}
    components={{
        // @ts-ignore
        Mermaid,
        a({href, title, children, ...props}) {
            if (href && !href.startsWith("javascript:")) {

                switch (true) {
                    case href.startsWith("#"):
                        return (
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleCustomLinkClick(message, href || "#");
                                }}
                                className={`dark:text-white hover:text-neutral-500 dark:hover:text-neutral-200 cursor-pointer underline`}
                            >
                                {children}
                            </button>
                        );
                        
                    case href.startsWith('http://') || href.startsWith('https://'):
                        const safeHref = href ? DOMPurify.sanitize(href) : '';
                        // should create a whitelist 
                        return (
                            <a
                                className="text-[#5495ff]"
                                href={safeHref}
                                target="_blank"
                                rel="noopener noreferrer" // prevent tabnabbing attack
                            >
                                {children}
                            </a>
                        );

                    case href.startsWith('mailto:'):
                        return (
                            <a  href={href}>
                                {children}
                            </a>
                        );
                    default:
                        return <>{children}</>;
                }
            } else {
                return <>{children}</>;
            }
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
                        return (<Mermaid chart={String(children)} currentMessage={messageIndex == (selectedConversation?.messages.length ?? 0) - 1 }/>);
                    
                    case 'apiResult':
                        return (<ExpansionComponent title={"Result"} content={String(children)}/>)
                    case 'auto':
                        if (selectedConversation && featureFlags.automation) {
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
                    case 'invoke':
                        if (selectedConversation && featureFlags.assistantApis) {
                            return (
                                <InvokeBlock
                                    message={message}
                                    conversation={selectedConversation}
                                    onStart={(id, action) => { }}
                                    onEnd={(id, action) => { }}
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
                            return (<OpBlock message={message} definition={String(children)} />
                            );
                        }
                        break;
                    case 'autoArtifacts':
                        if (featureFlags.artifacts) {
                            return (<AutoArtifactsBlock content={String(children)} ready={!messageIsStreaming} message={message}/>);
                        }
                        break;
                    case 'assistant':
                        return (<AssistantBlock definition={String(children)}/>);

                    case 'toggle':
                        return (<ExpansionComponent content={String(children)} title={"Source"}/>);

                    case 'APIkey':
                        return (<ApiKeyBlock content={String(children)}/>);

                    case 'APIdoc':
                        return (<ApiDocBlock content={String(children)}/>);

                    default:
                        if (match[1].toLowerCase() === 'vega' || match[1].toLowerCase() === 'vegalite') {
                            //console.log("mermaid")
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
        messageIsStreaming && !document.querySelector('.highlight-pulse') && 
        messageIndex == (selectedConversation?.messages.length ?? 0) - 1 ? '`▍`' : ''
    }`}
</MemoizedReactMarkdown>
</div>);
};

export default ChatContentBlock;
