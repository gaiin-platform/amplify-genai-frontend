import React, { useEffect, useState, useRef } from 'react';
import { MemoizedReactMarkdown } from "@/components/Markdown/MemoizedReactMarkdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { CodeBlock } from "@/components/Markdown/CodeBlock";
import Mermaid from "@/components/Chat/ChatContentBlocks/MermaidBlock";
import VegaVis from "@/components/Chat/ChatContentBlocks/VegaVisBlock";
import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import DOMPurify from "dompurify";

interface AssistantMessage {
  role: string;
  content: string;
  data?: any;
}

interface AssistantContentBlockProps {
  message: AssistantMessage;
  messageIndex: number;
  messageIsStreaming: boolean;
  totalMessages: number;
  messageEndRef?: React.RefObject<HTMLDivElement>;
}

const AssistantContentBlock: React.FC<AssistantContentBlockProps> = ({
  message,
  messageIndex,
  messageIsStreaming,
  totalMessages,
  messageEndRef
}) => {
  // State to trigger re-renders when needed
  const [renderKey, setRenderKey] = useState(0);
  
  // Listen for custom re-render events
  useEffect(() => {
    const handleReRenderEvent = () => {
      setRenderKey(prev => prev + 1);
    };

    // // Listen for the custom event 'triggerAssistantReRender'
    // window.addEventListener('', handleReRenderEvent);
    // return () => {
    //   window.removeEventListener('', handleReRenderEvent);
    // };
    
  }, []);

  // Check if this is the last message
  const isLastMessage = messageIndex === totalMessages - 1;


  return (
    <div 
      className={`assistantContentBlock overflow-x-auto px-4 max-w-full`}
      data-message-index={messageIndex}
      data-original-content={message.content}
    >
      <MemoizedReactMarkdown
        key={renderKey}
        className="prose dark:prose-invert flex-1 max-w-full"
        remarkPlugins={[remarkGfm, remarkMath]}
        components={{
          // @ts-ignore
          Mermaid,
          img({ src, alt, children, ...props }) {
            console.log("Rendering an image with src: ", src, "and alt: ", alt);
    
            // Safely sanitize the src if needed
            const safeSrc = src && src.startsWith('data:image') ? DOMPurify.sanitize(src) : src;
            return (
              <img
                src={safeSrc}
                style={{ maxWidth: '100%', height: 'auto', display: 'block'}} 
                {...props}
              >
                {children}
              </img>
            );
          },
          a({ href, title, children, ...props }) {
            if (href && !href.startsWith("javascript:")) {
              switch (true) {
                case href.startsWith('http://') || href.startsWith('https://'):
                  const safeHref = href ? DOMPurify.sanitize(href) : '';
                  return (
                    <a
                      className="text-[#5495ff]"
                      href={safeHref}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {children}
                    </a>
                  );
                case href.startsWith('mailto:'):
                  return (
                    <a href={href}>
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
          code({ node, inline, className, children, ...props }) {
            if (children.length) {
              if (children[0] === '▍') {
                return <span className="animate-pulse cursor-default mt-1">▍</span>
              }

              children[0] = (children[0] as string).replace("`▍`", "▍")
            }

            let match = /language-(\w+)/.exec(className || '');

            if (!inline && match && match[1]) {
              switch (match[1]) {
                case 'mermaid':
                  return (<Mermaid chart={String(children)} currentMessage={isLastMessage} />);
                
                case 'toggle':
                  return (<ExpansionComponent content={String(children)} title={"Source"} />);
                
                default:
                  if (match[1].toLowerCase() === 'vega' || match[1].toLowerCase() === 'vegalite') {
                    return (<VegaVis chart={String(children)} currentMessage={isLastMessage} />);
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
          table({ children }) {
            return (
              <div style={{ overflowX: 'auto' }}>
                <table className="w-full border-collapse border border-black px-3 py-1 dark:border-white">
                  {children}
                </table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className="break-words border border-black bg-gray-500 px-3 py-1 text-white dark:border-white">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="break-words border border-black px-3 py-1 dark:border-white">
                {children}
              </td>
            );
          },
          svg({ children, ...props }) {
            return (
              <svg {...props} className="w-full h-auto">
                {children} 
              </svg>
            );
          },
        }}
      >
        {`${message.content}${
          messageIsStreaming && isLastMessage ? '`▍`' : ''
        }`}
      </MemoizedReactMarkdown>
      {messageEndRef && <div ref={messageEndRef}></div>}
    </div>
  );
};

export default AssistantContentBlock; 