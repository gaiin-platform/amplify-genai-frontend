import {MemoizedReactMarkdown} from "@/components/Markdown/MemoizedReactMarkdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import {CodeBlock} from "@/components/Markdown/CodeBlock";
import Mermaid from "@/components/Chat/ChatContentBlocks/MermaidBlock";
import VegaVis from "@/components/Chat/ChatContentBlocks/VegaVisBlock";
import {useArtifactPromptFinderService} from "@/hooks/usePromptFinderArtifactService";
import {parsePartialJson} from "@/utils/app/data";
import {useContext, useEffect, useRef, useState} from "react";
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

     // Add local state to trigger re-render
    const [renderKey, setRenderKey] = useState(0);

    useEffect(() => {
        const handleReRenderEvent = () => {
            setRenderKey(prev => prev + 1);
        };

        // Listen for the custom event 'triggerChatReRender'
        window.addEventListener('triggerArtifactReRender', handleReRenderEvent);
        return () => {
            window.removeEventListener('triggerArtifactReRender', handleReRenderEvent);
        };
    }, []);
    
    return (
    <div className="artifactContentBlock w-full p-2"
        id="artifactsContentBlock"
        data-artifact-id={artifactId}
        data-version-index={versionIndex}
        data-original-content={transformedMessageContent}
        >
    <MemoizedReactMarkdown
        key={renderKey}
        className="prose dark:prose-invert flex-1 max-w-none w-full"
        remarkPlugins={[remarkGfm, remarkMath]}
        //onMouseUp={handleTextHighlight}
        // @ts-ignore
        //rehypePlugins={[rehypeRaw]}
        //rehypePlugins={[rehypeMathjax]}
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
        {`${transformedMessageContent}${artifactIsStreaming && !document.querySelector('.highlight-pulse') ? '`▍`' : ''}`}
    </MemoizedReactMarkdown>
    <div ref={artifactEndRef}> </div>
    </div>);

};

