import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MemoizedReactMarkdown } from "@/components/Markdown/MemoizedReactMarkdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import { CodeBlock } from "@/components/Markdown/CodeBlock";
import Mermaid from "@/components/Chat/ChatContentBlocks/MermaidBlock";
import VegaVis from "@/components/Chat/ChatContentBlocks/VegaVisBlock";
import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import LatexBlock from "@/components/Chat/ChatContentBlocks/LatexBlock";
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
  id?: string;
}

const AssistantContentBlock: React.FC<AssistantContentBlockProps> = ({
  message,
  messageIndex,
  messageIsStreaming,
  totalMessages,
  messageEndRef
}) => {
  // Check if this is the last message
  const isLastMessage = messageIndex === totalMessages - 1;

  // Check if content contains LaTeX
  const hasLatex = useCallback((content: string) => {
    // More precise LaTeX detection that avoids code blocks
    const codeBlockRegex = /```[\s\S]*?```|`[^`]*`/g;
    const contentWithoutCode = content.replace(codeBlockRegex, '');
    return /\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)/.test(contentWithoutCode);
  }, []);

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
    
    // Now process LaTeX only in non-code content
    // Replace display math $$...$$ with placeholder
    processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, latex) => {
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

  // Smart content processing that completely avoids LaTeX during any streaming
  const [processedContent, setProcessedContent] = useState(message.content);
  const [isContentStable, setIsContentStable] = useState(false);
  
  useEffect(() => {
    // CRITICAL: During ANY streaming, show raw content immediately
    if (messageIsStreaming) {
      setProcessedContent(message.content); // Raw content, no LaTeX processing
      setIsContentStable(false);
      return;
    }

    // Only process LaTeX when streaming has completely stopped
    const timer = setTimeout(() => {
      setProcessedContent(processLatex(message.content));
      setIsContentStable(true);
    }, 100); // Small delay to ensure streaming has fully stopped

    return () => clearTimeout(timer);
  }, [message.content, messageIsStreaming, processLatex]);

  const finalContent = processedContent;

  // Enhanced re-render mechanism with streaming awareness
  const [renderKey, setRenderKey] = useState(0);
  const lastStableContentRef = useRef<string>('');

  useEffect(() => {
    const handleReRenderEvent = () => {
      setRenderKey(prev => prev + 1);
    };

    // Listen for the custom event 'triggerAssistantReRender'
    window.addEventListener('triggerAssistantReRender', handleReRenderEvent);
    return () => {
      window.removeEventListener('triggerAssistantReRender', handleReRenderEvent);
    };
  }, []);

  // Only update render key when content is stable and actually changed
  useEffect(() => {
    if (isContentStable && finalContent !== lastStableContentRef.current) {
      lastStableContentRef.current = finalContent;
      setRenderKey(prev => prev + 1);
    }
  }, [finalContent, isContentStable]);


  return (
    <div 
      className={`assistantContentBlock overflow-x-auto px-4 max-w-full`}
      id={`assistantMessage${messageIndex}`}
      data-message-index={messageIndex}
      data-original-content={message.content}
      style={{ 
        minHeight: '20px' // Minimal styling to prevent any layout interference
      }}
    >
      {/* Use simple text rendering during ANY streaming to prevent scroll issues */}
      {messageIsStreaming ? (
        <div className="prose dark:prose-invert flex-1 max-w-none w-full">
          <div style={{ 
            whiteSpace: 'pre-wrap', 
            fontFamily: 'inherit',
            fontSize: 'inherit',
            lineHeight: 'inherit',
            color: 'inherit',
            margin: 0,
            padding: 0,
            wordBreak: 'break-word', // Match prose behavior
            overflowWrap: 'break-word' // Additional text wrapping
          }}>
            {message.content}
            {isLastMessage && <span className="animate-pulse cursor-default mt-1">▍</span>}
          </div>
        </div>
      ) : (
        <MemoizedReactMarkdown
          key={renderKey}
          className="prose dark:prose-invert flex-1 max-w-none w-full"
          remarkPlugins={[remarkGfm, remarkMath]}
          // @ts-ignore
          rehypePlugins={[rehypeRaw]}
          components={{
            // @ts-ignore
            Mermaid,
            // Math components with conditional layout containment
            'math-display': ({children}: {children: React.ReactNode}) => (
              <div style={{ 
                minHeight: '1.5em',
                display: 'block', 
                margin: '0.5em 0',
                // Only add layout containment when content is stable
                contain: isContentStable ? 'layout' : 'none'
              }}>
                <LatexBlock math={String(children)} displayMode={true} />
              </div>
            ),
            'math-inline': ({children}: {children: React.ReactNode}) => (
              <span style={{ 
                minHeight: '1em',
                minWidth: '1em',
                display: 'inline-block',
                verticalAlign: 'baseline',
                // Only add layout containment when content is stable
                contain: isContentStable ? 'layout' : 'none'
              }}>
                <LatexBlock math={String(children)} displayMode={false} />
              </span>
            ),
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
        {`${finalContent}${
          // Never show cursor in non-streaming mode
          ''
        }`}
      </MemoizedReactMarkdown>
      )}
      {messageEndRef && <div ref={messageEndRef}></div>}
    </div>
  );
};

export default AssistantContentBlock; 