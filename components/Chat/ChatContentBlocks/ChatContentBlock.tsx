import {MemoizedReactMarkdown} from "@/components/Markdown/MemoizedReactMarkdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import LatexBlock from "./LatexBlock";
import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import {CodeBlock} from "@/components/Markdown/CodeBlock";
import {Conversation, Message} from "@/types/chat";
import Mermaid from "@/components/Chat/ChatContentBlocks/MermaidBlock";
import VegaVis from "@/components/Chat/ChatContentBlocks/VegaVisBlock";
import AssistantBlock from "@/components/Chat/ChatContentBlocks/AssistantBlock";
import {usePromptFinderService} from "@/hooks/usePromptFinderService";
import {parsePartialJson} from "@/utils/app/data";
import AutonomousBlock from "@/components/Chat/ChatContentBlocks/AutonomousBlock";
import {useContext, useEffect, useRef, useState, useCallback} from "react";
import HomeContext from "@/pages/api/home/home.context";
import OpBlock from "@/components/Chat/ChatContentBlocks/OpBlock";
import ApiKeyBlock from "./ApiKeyBlock";
import { ApiDocBlock } from "./APIDocBlock";
import AutoArtifactsBlock from "./AutoArtifactBlock";
import AgentTableBlock from "./AgentTableBlock";
import AgentImageBlock from "./AgentImageBlock";
import AgentFileBlock from "./AgentFileBlock";
import DOMPurify from  "dompurify";
import React from "react";
import InvokeBlock from '@/components/Chat/ChatContentBlocks/InvokeBlock';
import { DateToggle } from "@/components/ReusableComponents/DateToggle";



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
            featureFlags,
            showPromptbar,
            showChatbar,
            selectedArtifacts
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

    const isLast = messageIndex == (selectedConversation?.messages?.length ?? 0) - 1;

    // Check if content contains LaTeX
    const hasLatex = useCallback((content: string) => {
        // More precise LaTeX detection that avoids code blocks
        const codeBlockRegex = /```[\s\S]*?```|`[^`]*`/g;
        const contentWithoutCode = content.replace(codeBlockRegex, '');
        return /\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)/.test(contentWithoutCode);
    }, []);

    // Debounced LaTeX processing to reduce jitter during streaming - only for LaTeX content
    const [debouncedContent, setDebouncedContent] = useState(transformedMessageContent);
    
    useEffect(() => {
        // If not streaming, not the last message, or no LaTeX detected, process immediately
        if (!messageIsStreaming || !isLast || !hasLatex(transformedMessageContent)) {
            setDebouncedContent(transformedMessageContent);
            return;
        }

        // For streaming messages with LaTeX, debounce the processing
        const timer = setTimeout(() => {
            setDebouncedContent(transformedMessageContent);
        }, 100); // 100ms debounce only for LaTeX content

        return () => clearTimeout(timer);
    }, [transformedMessageContent, messageIsStreaming, isLast, hasLatex]);

    // Memoized LaTeX processing function
    const processLatex = useCallback((content: string) => {
        // Store code blocks temporarily to avoid processing them
        const codeBlocks: string[] = [];
        const codeBlockPlaceholders: string[] = [];
        
        // Replace code blocks with placeholders
        let processed = content.replace(/```[\s\S]*?```/g, (match, offset) => {
            const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
            codeBlocks.push(match);
            codeBlockPlaceholders.push(placeholder);
            return placeholder;
        });
        
        // Replace inline code with placeholders
        processed = processed.replace(/`[^`]*`/g, (match, offset) => {
            const placeholder = `__INLINE_CODE_${codeBlocks.length}__`;
            codeBlocks.push(match);
            codeBlockPlaceholders.push(placeholder);
            return placeholder;
        });
        
        // Replace display math $$...$$ with placeholder
        processed = processed.replace(/\$\$(.*?)\$\$/g, (match, latex) => {
            return `<math-display>${latex}</math-display>`;
        });
        
        // Replace LaTeX display math \[ ... \] with placeholder
        processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (match, latex) => {
            return `<math-display>${latex}</math-display>`;
        });
        
        // Replace LaTeX inline math \( ... \) with placeholder
        processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (match, latex) => {
            return `<math-inline>${latex}</math-inline>`;
        });
        
        // Restore code blocks
        codeBlockPlaceholders.forEach((placeholder, index) => {
            processed = processed.replace(placeholder, codeBlocks[index]);
        });
        
        return processed;
    }, []);

    const finalContent = processLatex(debouncedContent);

    const promptbarRef = useRef(showPromptbar);

    useEffect(() => {
        promptbarRef.current = showPromptbar;
        setWindowInnerWidth(calcWidth())
    }, [showPromptbar]);

    const chatbarRef = useRef(showChatbar);

    useEffect(() => {
        chatbarRef.current = showChatbar;
        setWindowInnerWidth(calcWidth())
    }, [showChatbar]);


    const calcWidth = () => window.innerWidth - ((+promptbarRef.current + +chatbarRef.current) * 300);
    

    const [windowInnerWidth, setWindowInnerWidth] = useState<number>(calcWidth());

    useEffect(() => {
        const updateInnerWindow = () => setWindowInnerWidth(calcWidth());
        window.addEventListener('resize', updateInnerWindow);
        return () => window.removeEventListener('resize', updateInnerWindow);
        }, []);
 
  // Add local state to trigger re-render but use more stable key
  const [renderKey, setRenderKey] = useState(0);
  const [lastRenderContent, setLastRenderContent] = useState("");

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

  // Only update render key when content significantly changes (not during streaming jitter)
  useEffect(() => {
      if (!messageIsStreaming && finalContent !== lastRenderContent) {
          setLastRenderContent(finalContent);
          setRenderKey(prev => prev + 1);
      }
  }, [finalContent, messageIsStreaming, lastRenderContent]);

//   console.log(transformedMessageContent)
  
    return (
    <div className="chatContentBlock overflow-x-auto" 
         id="chatContentBlock"
         style={{maxWidth: windowInnerWidth, marginRight: (selectedArtifacts?.length ?? 0) > 0 ? '14%' : '0%'}}
         data-message-index={messageIndex}
         data-original-content={transformedMessageContent}>
    <MemoizedReactMarkdown
    key={renderKey}
    className="prose dark:prose-invert flex-1 max-w-none w-full" 
    remarkPlugins={[remarkGfm]}
    // @ts-ignore
    rehypePlugins={[rehypeRaw]}
    //onMouseUp={handleTextHighlight}
    components={{
        // @ts-ignore
        Mermaid,
        // Math components for LaTeX rendering
        'math-display': ({children}: {children: React.ReactNode}) => (
            <LatexBlock math={String(children)} displayMode={true} />
        ),
        'math-inline': ({children}: {children: React.ReactNode}) => (
            <LatexBlock math={String(children)} displayMode={false} />
        ),
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

            // Handle inline clickable dates
            if (inline) {
                const content = String(children);
                if (content.startsWith('clickableDate:')) {
                    const dateString = content.replace('clickableDate:', '');
                    // console.log('DateToggle rendering for:', dateString); // Debug log
                    return <DateToggle dateString={dateString} />;
                }
            }

            let match = /language-(\w+)/.exec(className || '');

            if (!inline && match && match[1]) {

                switch (match[1]) {
                    case 'mermaid':
                        return (<Mermaid chart={String(children)} currentMessage={messageIndex == (selectedConversation?.messages?.length ?? 0) - 1 }/>);
                    
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
                        
                    case 'agent_table':
                        return (<AgentTableBlock filePath={String(children).trim()} message={message} />);
                        
                    case 'agent_image':
                        return (<AgentImageBlock filePath={String(children).trim()} message={message} />);
                        
                    case 'agent':
                        return (<AgentFileBlock filePath={String(children).trim()} message={message} />);

                    case 'integrationsDialog':
                        if (featureFlags.integrations) {
                            return (
                                <button
                                    onClick={() => window.dispatchEvent(new Event('openIntegrationsDialog'))}
                                    className={`w-full px-12 py-2 text-white bg-blue-500 rounded hover:bg-green-600`}
                                >
                                    Click to setup service connections
                                </button>)
                        }
                        break;

                    default:
                        if (match[1].toLowerCase() === 'vega' || match[1].toLowerCase() === 'vegalite') {
                            //console.log("mermaid")
                            return (<VegaVis chart={String(children)} currentMessage={messageIndex == (selectedConversation?.messages?.length ?? 0) - 1} />);
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
    {`${finalContent}${
        messageIsStreaming && !document.querySelector('.highlight-pulse') && 
        messageIndex == (selectedConversation?.messages?.length ?? 0) - 1 ? '`▍`' : ''
    }`}
</MemoizedReactMarkdown>
</div>);
};

export default ChatContentBlock;