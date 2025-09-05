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
  // Enhanced LaTeX detection with whitespace prevention
  const hasLatex = useCallback((content: string) => {
    return /\$\$.*?\$\$|\$[^$\n]+?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)/.test(content);
  }, []);

  // Advanced content processing for layout-stable LaTeX rendering
  const processLatexWithLayoutStability = useCallback((content: string) => {
    if (!hasLatex(content)) return content;
    
    // Pre-calculate approximate dimensions to prevent layout shifts
    let processed = content.replace(/\$\$([\s\S]*?)\$\$/g, (match, latex) => {
      // Estimate display math height based on content complexity
      const estimatedHeight = latex.includes('\\frac') || latex.includes('\\sqrt') || 
                            latex.includes('\\sum') || latex.includes('\\int') ? '3em' : '1.5em';
      return `<math-display data-height="${estimatedHeight}">${latex}</math-display>`;
    });
    
    processed = processed.replace(/\$([^$\n]+?)\$/g, (match, latex) => {
      return `<math-inline data-height="1em">${latex}</math-inline>`;
    });
    
    processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (match, latex) => {
      const estimatedHeight = latex.includes('\\frac') || latex.includes('\\sqrt') || 
                            latex.includes('\\sum') || latex.includes('\\int') ? '3em' : '1.5em';
      return `<math-display data-height="${estimatedHeight}">${latex}</math-display>`;
    });
    
    processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (match, latex) => {
      return `<math-inline data-height="1em">${latex}</math-inline>`;
    });
    
    return processed;
  }, [hasLatex]);

  // State to manage processed content with layout stability
  const [processedContent, setProcessedContent] = useState(() => {
    // Pre-process immediately on mount to avoid any flicker
    return hasLatex(message.content) ? 
      processLatexWithLayoutStability(message.content) : 
      message.content;
  });
  
  const [isContentStable, setIsContentStable] = useState(false);

  // Ultra-stable content processing with streaming optimization
  useEffect(() => {
    const updateContent = () => {
      const newContent = processLatexWithLayoutStability(message.content);
      
      // Only update if content actually changed to prevent unnecessary re-renders
      if (newContent !== processedContent) {
        setProcessedContent(newContent);
      }
      
      // Mark content as stable after initial processing
      if (!isContentStable) {
        setIsContentStable(true);
      }
    };

    if (!messageIsStreaming) {
      // Process immediately when not streaming
      updateContent();
    } else {
      // For streaming: only debounce if we have LaTeX, otherwise update immediately
      if (hasLatex(message.content)) {
        // Debounce LaTeX processing during streaming to prevent excessive re-renders
        const timer = setTimeout(updateContent, 100);
        return () => clearTimeout(timer);
      } else {
        updateContent();
      }
    }
  }, [message.content, messageIsStreaming, processLatexWithLayoutStability, processedContent, hasLatex, isContentStable]);

  // State to trigger re-renders when needed
  const [renderKey, setRenderKey] = useState(0);
  const lastStableContentRef = useRef<string>('');
  
  // Listen for custom re-render events with stability checks
  useEffect(() => {
    const handleReRenderEvent = () => {
      // Only trigger re-render if content is stable and actually changed
      if (isContentStable && processedContent !== lastStableContentRef.current) {
        setRenderKey(prev => prev + 1);
        lastStableContentRef.current = processedContent;
      }
    };

    // Listen for the custom event 'triggerAssistantReRender'
    window.addEventListener('triggerAssistantReRender', handleReRenderEvent);
    return () => {
      window.removeEventListener('triggerAssistantReRender', handleReRenderEvent);
    };
    
  }, [isContentStable, processedContent]);

  // Check if this is the last message
  const isLastMessage = messageIndex === totalMessages - 1;


  return (
    <div 
      className={`assistantContentBlock overflow-x-auto px-4 max-w-full`}
      id={`assistantMessage${messageIndex}`}
      data-message-index={messageIndex}
      data-original-content={processedContent}
      style={{ 
        minHeight: '20px', // Prevent layout collapse during loading
        // Add layout stability during LaTeX processing
        ...(hasLatex(processedContent) && !isContentStable ? {
          willChange: 'auto', // Optimize for stability over performance during initial load
          contain: 'layout style' // Prevent layout thrashing
        } : {})
      }}
    >
      <MemoizedReactMarkdown
        key={renderKey}
        className="prose dark:prose-invert flex-1 max-w-none w-full"
        remarkPlugins={[remarkGfm, remarkMath]}
        // @ts-ignore
        rehypePlugins={[rehypeRaw]}
        components={{
          // @ts-ignore
          Mermaid,
          // Use the same lightweight math renderers as ChatContentBlock to avoid layout issues
          'math-display': ({children}: {children: React.ReactNode, [key: string]: any}) => (
            <LatexBlock math={String(children)} displayMode={true} />
          ),
          'math-inline': ({children}: {children: React.ReactNode, [key: string]: any}) => (
            <LatexBlock math={String(children)} displayMode={false} />
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
        {`${processedContent}${
          messageIsStreaming && !document.querySelector('.highlight-pulse') && isLastMessage ? '`▍`' : ''
        }`}
      </MemoizedReactMarkdown>
      {messageEndRef && <div ref={messageEndRef}></div>}
    </div>
  );
};

export default AssistantContentBlock; 