import {MemoizedReactMarkdown} from "@/components/Markdown/MemoizedReactMarkdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import {CodeBlock} from "@/components/Markdown/CodeBlock";
import Mermaid from "@/components/Chat/ChatContentBlocks/MermaidBlock";
import VegaVis from "@/components/Chat/ChatContentBlocks/VegaVisBlock";
import LatexBlock from "@/components/Chat/ChatContentBlocks/LatexBlock";
import ArtifactLatexBlock from "@/components/Chat/ChatContentBlocks/ArtifactLatexBlock";
import {useArtifactPromptFinderService} from "@/hooks/usePromptFinderArtifactService";
import {parsePartialJson} from "@/utils/app/data";
import {useContext, useEffect, useRef, useState, useCallback} from "react";
import HomeContext from "@/pages/api/home/home.context";
import { Artifact } from "@/types/artifacts";
import { lzwUncompress } from "@/utils/app/lzwCompression";
import DOMPurify from "dompurify";
import React from "react";

interface Props {
    artifactIsStreaming: boolean;
    selectedArtifact: Artifact;
    artifactId: string;
    versionIndex: number;
    artifactEndRef: React.RefObject<HTMLDivElement>;
    // handleCustomLinkClick: (message:Message, href: string) => void,
}

export const ArtifactContentBlock: React.FC<Props> = ( { selectedArtifact, artifactIsStreaming, artifactId, versionIndex, artifactEndRef}) => {

    const { state: { featureFlags} } = useContext(HomeContext); 

    const {getOutputTransformers} = useArtifactPromptFinderService();

    const transformMessageContent = (artifact:Artifact) => {
        try {
            const {transformer} = getOutputTransformers(artifact);
            return transformer(artifact, {parsePartialJson});
        }catch(e){
            console.log("Error transforming output.");
            console.log(e);
        }
        return lzwUncompress(artifact.contents);
    }

    const transformedMessageContent = transformMessageContent(selectedArtifact);

    // Advanced LaTeX detection with whitespace prevention
    const hasLatex = useCallback((content: string) => {
        // More precise LaTeX detection that avoids code blocks
        const codeBlockRegex = /```[\s\S]*?```|`[^`]*`/g;
        const contentWithoutCode = content.replace(codeBlockRegex, '');
        return /\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)/.test(contentWithoutCode);
    }, []);

    // Memoized LaTeX processing with enhanced layout stability
    const processLatexWithLayoutStability = useCallback((content: string) => {
        if (!hasLatex(content)) return content;
        
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
        
        // Pre-calculate approximate dimensions to prevent layout shifts
        processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, latex) => {
            // Estimate display math height based on content complexity
            const estimatedHeight = latex.includes('\\frac') || latex.includes('\\sqrt') || 
                                  latex.includes('\\sum') || latex.includes('\\int') ? '3em' : '1.5em';
            return `<math-display data-height="${estimatedHeight}">${latex}</math-display>`;
        });
        
        processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (match, latex) => {
            const estimatedHeight = latex.includes('\\frac') || latex.includes('\\sqrt') || 
                                  latex.includes('\\sum') || latex.includes('\\int') ? '3em' : '1.5em';
            return `<math-display data-height="${estimatedHeight}">${latex}</math-display>`;
        });
        
        processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (match, latex) => {
            return `<math-inline data-height="1em">${latex}</math-inline>`;
        });
        
        // Restore code blocks
        codeBlockPlaceholders.forEach((placeholder, index) => {
            processed = processed.replace(placeholder, codeBlocks[index]);
        });
        
        return processed;
    }, [hasLatex]);

    // Aggressive layout-stable content processing for artifacts
    const [processedContent, setProcessedContent] = useState(() => {
        // Pre-process immediately on mount to avoid any flicker
        return hasLatex(transformedMessageContent) ? 
            processLatexWithLayoutStability(transformedMessageContent) : 
            transformedMessageContent;
    });
    
    const [isContentStable, setIsContentStable] = useState(false);

    // Ultra-stable content processing with streaming optimization
    useEffect(() => {
        const updateContent = () => {
            const newContent = processLatexWithLayoutStability(transformedMessageContent);
            
            // Only update if content actually changed to prevent unnecessary re-renders
            if (newContent !== processedContent) {
                setProcessedContent(newContent);
            }
            
            // Mark content as stable after initial processing
            if (!isContentStable) {
                setIsContentStable(true);
            }
        };

        if (!artifactIsStreaming) {
            // Process immediately when not streaming
            updateContent();
        } else {
            // For streaming: only debounce if we have LaTeX, otherwise update immediately
            if (hasLatex(transformedMessageContent)) {
                // Shorter debounce for artifacts to maintain responsiveness
                const timer = setTimeout(updateContent, 50);
                return () => clearTimeout(timer);
            } else {
                updateContent();
            }
        }
    }, [transformedMessageContent, artifactIsStreaming, processLatexWithLayoutStability, processedContent, hasLatex, isContentStable]);

     // Enhanced re-render mechanism with stability checks
     // Enhanced re-render mechanism with stability checks
    const [renderKey, setRenderKey] = useState(0);
    const lastStableContentRef = useRef<string>('');

    useEffect(() => {
        const handleReRenderEvent = () => {
            // Only trigger re-render if content is stable and actually changed
            if (isContentStable && processedContent !== lastStableContentRef.current) {
                setRenderKey(prev => prev + 1);
                lastStableContentRef.current = processedContent;
            }
        };

        // Listen for the custom event 'triggerArtifactReRender'
        window.addEventListener('triggerArtifactReRender', handleReRenderEvent);
        return () => {
            window.removeEventListener('triggerArtifactReRender', handleReRenderEvent);
        };
    }, [isContentStable, processedContent]);
    
    return (
    <div className="artifactContentBlock w-full p-2"
        id="artifactsContentBlock"
        data-artifact-id={artifactId}
        data-version-index={versionIndex}
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
        key={`${renderKey}-${isContentStable}`} // Include stability state in key
        className="prose dark:prose-invert flex-1 max-w-none w-full"
        remarkPlugins={[remarkGfm, remarkMath]}
        // @ts-ignore
        rehypePlugins={[rehypeRaw]}
        //onMouseUp={handleTextHighlight}
        components={{
            // @ts-ignore
            Mermaid,
            // Enhanced LaTeX components with aggressive layout stability
            'math-display': ({children, ...props}: {children: React.ReactNode, [key: string]: any}) => {
                const estimatedHeight = props['data-height'] || '1.5em';
                return (
                    <div style={{ 
                        minHeight: estimatedHeight,
                        display: 'block', 
                        margin: '0.5em 0',
                        // Critical: prevent layout shift during render
                        overflow: 'hidden',
                        transition: 'none' // Disable transitions during streaming
                    }}>
                        <ArtifactLatexBlock 
                            math={String(children)} 
                            displayMode={true} 
                            estimatedHeight={estimatedHeight}
                        />
                    </div>
                );
            },
            'math-inline': ({children, ...props}: {children: React.ReactNode, [key: string]: any}) => {
                const estimatedHeight = props['data-height'] || '1em';
                return (
                    <span style={{ 
                        minHeight: estimatedHeight,
                        minWidth: '1em', // Prevent horizontal collapse
                        display: 'inline-block',
                        verticalAlign: 'baseline',
                        // Critical: prevent layout shift during render
                        overflow: 'hidden',
                        transition: 'none' // Disable transitions during streaming
                    }}>
                        <ArtifactLatexBlock 
                            math={String(children)} 
                            displayMode={false} 
                            estimatedHeight={estimatedHeight}
                        />
                    </span>
                );
            },
            img({ src, alt, children, ...props }) {
                console.log("Rendering an image with src: ", src, "and alt: ", alt);
        
                // Safely sanitize the src if needed
                const safeSrc = src && src.startsWith('data:image') ? DOMPurify.sanitize(src) : src;
                return (
                    <img
                        src={safeSrc}
                        style={{ maxWidth: '100%', height: 'auto', display: 'block'}} 
                        {...props}>
                            {children}
                        </img>
                 
                );
            },
            a({href, title, children, ...props}) {
                if (href) {
                    console.log("enter");
    
                    switch (true) {
                        case href.startsWith("#"):
                            return (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        // handleCustomLinkClick(message, href || "#");
                                    }}
                                    className={`dark:text-white hover:text-neutral-500 dark:hover:text-neutral-200 cursor-pointer underline`}
                                >
                                    {children}
                                </button>
                            );
                            
                        default:
                            return <>{children}</>;
                    }
                } else {
                    return <>{children}</>;
                }
            },
            svg({ children, ...props }) {
                return (
                    <svg {...props} className="w-full h-auto">
                        {children} 
                    </svg>
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
                            return (<Mermaid chart={String(children)} currentMessage={!!selectedArtifact}/>);

                        case 'toggle':
                            return (<ExpansionComponent content={String(children)} title={"Source"}/>);
                        default:
                            if (match[1].toLowerCase() === 'vega' || match[1].toLowerCase() === 'vegalite') {
                                //console.log("mermaid")
                                return (<VegaVis chart={String(children)} currentMessage={!!selectedArtifact} />);
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
        {`${processedContent}${artifactIsStreaming && !document.querySelector('.highlight-pulse') ? '`▍`' : ''}`}
    </MemoizedReactMarkdown>
    <div ref={artifactEndRef}> </div>
    </div>);

};
