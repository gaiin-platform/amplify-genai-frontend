import {MemoizedReactMarkdown} from "@/components/Markdown/MemoizedReactMarkdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import {visit} from 'unist-util-visit';
import Papa from 'papaparse';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { resolveNUIType, sniffContentType } from '@/types/artifacts';

// Sanitization schema: extends the safe default to allow the custom elements
// used by the artifacts renderer (math-display, math-inline for LaTeX), while
// blocking <script>, event handlers, javascript: hrefs, etc.
const artifactSanitizeSchema = {
    ...defaultSchema,
    tagNames: [
        ...(defaultSchema.tagNames ?? []),
        'math-display',
        'math-inline',
    ],
    attributes: {
        ...defaultSchema.attributes,
        // Allow style and data-* on any element (used by dark mode styles + height hints)
        '*': [...(defaultSchema.attributes?.['*'] ?? []), 'style', 'className', 'class', 'data-height'],
    },
};
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
    /** For visualization artifacts: true = show source code, false = show preview */
    showCodeView?: boolean;
    // handleCustomLinkClick: (message:Message, href: string) => void,
}

// Rehype plugin to make inline styles dark-mode compatible
const rehypeDarkModeStyles = () => {
    return (tree: any) => {
        visit(tree, 'element', (node: any) => {
            if (node.properties && node.properties.style) {
                const style = node.properties.style;

                // Handle string styles (e.g., "background: white; color: black;")
                if (typeof style === 'string') {
                    // Remove hardcoded background colors and replace with class-based approach
                    const cleanedStyle = style
                        .replace(/background(-color)?:\s*white\s*;?/gi, '')
                        .replace(/background(-color)?:\s*#fff(fff)?\s*;?/gi, '')
                        .replace(/color:\s*black\s*;?/gi, '')
                        .replace(/color:\s*#000(000)?\s*;?/gi, '');

                    node.properties.style = cleanedStyle;

                    // Add dark-mode compatible class
                    if (!node.properties.className) {
                        node.properties.className = [];
                    }
                    if (typeof node.properties.className === 'string') {
                        node.properties.className = [node.properties.className];
                    }
                    node.properties.className.push('dark-mode-content');
                }
            }
        });
    };
};

/* ─── Dark-mode helper (shared with renderers) ─────────────────────────────── */
function useIsDarkMode(): boolean {
    const [isDark, setIsDark] = React.useState(() =>
        typeof document !== 'undefined'
            ? document.querySelector('main')?.classList.contains('dark') ?? true
            : true,
    );
    React.useEffect(() => {
        const el = document.querySelector('main');
        if (!el) return;
        const obs = new MutationObserver(() => setIsDark(el.classList.contains('dark')));
        obs.observe(el, { attributes: true, attributeFilter: ['class'] });
        return () => obs.disconnect();
    }, []);
    return isDark;
}

/* ─── Spreadsheet renderer ──────────────────────────────────────────────────── */
const SpreadsheetRenderer: React.FC<{ content: string; isStreaming: boolean }> = ({
    content,
    isStreaming,
}) => {
    const isDark = useIsDarkMode();
    const result = Papa.parse<string[]>(content, {
        skipEmptyLines: true,
        header: false,
    });
    const rows = result.data as string[][];
    if (!rows || rows.length === 0) {
        return (
            <div style={{ padding: '24px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontSize: 14 }}>
                {isStreaming ? 'Loading…' : 'No data'}
            </div>
        );
    }
    const headers = rows[0];
    const dataRows = rows.slice(1);
    const colCount = headers.length;
    const rowCount = dataRows.length;

    return (
        <div style={{ width: '100%', fontFamily: 'Inter, ui-sans-serif, sans-serif', display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
            {/* Row/col count badge */}
            <div style={{
                padding: '8px 14px 6px',
                fontSize: 12,
                color: 'var(--text-muted)',
                borderBottom: '1px solid var(--border-subtle)',
                flexShrink: 0,
            }}>
                {rowCount} row{rowCount !== 1 ? 's' : ''} × {colCount} column{colCount !== 1 ? 's' : ''}
                {isStreaming && ' (loading…)'}
            </div>
            {/* Table with horizontal scroll.
                - overflowX: auto enables the horizontal scrollbar for wide tables.
                - The table itself uses layout: auto so column widths flex to content.
                - Cells wrap by default (no whiteSpace: nowrap) so long text doesn't
                  force the column wider than the panel. A maxWidth cap plus word-break
                  prevents any single word from exploding a narrow panel. */}
            <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                <table style={{
                    borderCollapse: 'collapse',
                    tableLayout: 'auto',
                    minWidth: '100%',   /* never narrower than the panel */
                    fontSize: 13,
                }}>
                    <thead>
                        <tr>
                            {headers.map((h, ci) => (
                                <th key={ci} style={{
                                    position: 'sticky',
                                    top: 0,
                                    background: isDark ? 'rgba(30,32,38,0.97)' : 'rgba(248,249,250,0.97)',
                                    color: 'var(--text-secondary)',
                                    fontWeight: 600,
                                    padding: '8px 12px',
                                    textAlign: 'left',
                                    whiteSpace: 'nowrap',   /* headers stay on one line */
                                    borderBottom: '2px solid var(--border-subtle)',
                                    boxShadow: '0 1px 0 var(--border-subtle)',
                                    zIndex: 1,
                                }}>
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {dataRows.map((row, ri) => (
                            <tr key={ri} style={{
                                background: ri % 2 === 0
                                    ? 'transparent'
                                    : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
                            }}>
                                {Array.from({ length: colCount }).map((_, ci) => (
                                    <td key={ci} style={{
                                        padding: '6px 12px',
                                        color: 'var(--text-primary)',
                                        borderBottom: '1px solid var(--border-subtle)',
                                        /* Allow wrapping so text stays inside the panel */
                                        whiteSpace: 'normal',
                                        wordBreak: 'break-word',
                                        maxWidth: 360,          /* cap very wide columns */
                                        verticalAlign: 'top',
                                    }}>
                                        {row[ci] ?? ''}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

/* ─── Code renderer ─────────────────────────────────────────────────────────── */
const CodeRenderer: React.FC<{ content: string; language?: string }> = ({ content, language }) => {
    const isDark = useIsDarkMode();

    // Sniff language from first code fence if not declared
    let lang = language || '';
    let codeContent = content;
    if (!lang) {
        const fenceMatch = content.match(/^```(\w+)?\s*\n([\s\S]*?)(?:```\s*$|$)/m);
        if (fenceMatch) {
            lang = fenceMatch[1] || '';
            codeContent = fenceMatch[2] ?? content;
        }
    } else {
        // Strip outer code fence if present
        const fenceMatch = content.match(/^```(?:\w+)?\s*\n([\s\S]*?)(?:```\s*$|$)/m);
        if (fenceMatch) codeContent = fenceMatch[1] ?? content;
    }

    return (
        <div style={{ width: '100%', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
            {lang && (
                <div style={{
                    padding: '4px 14px',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    borderBottom: '1px solid var(--border-subtle)',
                    fontFamily: 'Inter, sans-serif',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                }}>
                    {lang}
                </div>
            )}
            <SyntaxHighlighter
                language={lang || 'text'}
                style={isDark ? oneDark : oneLight}
                customStyle={{
                    margin: 0,
                    background: 'transparent',
                    fontSize: 13,
                    lineHeight: 1.6,
                    padding: '14px 16px',
                    overflowX: 'auto',
                }}
                showLineNumbers
                wrapLongLines={false}
            >
                {codeContent.replace(/\n$/, '')}
            </SyntaxHighlighter>
        </div>
    );
};

/* ─── Visualization renderer ────────────────────────────────────────────────── */
interface VisualizationRendererProps {
    content: string;
    artifactIsStreaming: boolean;
    showCode: boolean;
}
const VisualizationRenderer: React.FC<VisualizationRendererProps> = ({
    content,
    artifactIsStreaming,
    showCode,
}) => {
    const isDark = useIsDarkMode();

    if (artifactIsStreaming) {
        return (
            <div style={{ padding: 24, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontSize: 14 }}>
                Rendering visualization…
            </div>
        );
    }

    const trimmed = content.trimStart();

    // Mermaid diagram
    const mermaidMatch = content.match(/^```mermaid\s*\n([\s\S]*?)(?:```\s*$|$)/m);
    if (mermaidMatch) {
        const Mermaid = require('@/components/Chat/ChatContentBlocks/MermaidBlock').default;
        return showCode ? (
            <pre style={{ padding: 16, fontSize: 13, overflowX: 'auto', color: 'var(--text-primary)', background: 'transparent' }}>
                <code>{content}</code>
            </pre>
        ) : (
            <div style={{ padding: 16 }}>
                <Mermaid chart={mermaidMatch[1]} currentMessage={true} />
            </div>
        );
    }

    // Inline SVG
    if (/^<svg[\s>]/i.test(trimmed)) {
        return showCode ? (
            <pre style={{ padding: 16, fontSize: 13, overflowX: 'auto', color: 'var(--text-primary)', background: 'transparent' }}>
                <code>{content}</code>
            </pre>
        ) : (
            <div
                style={{ padding: 16, display: 'flex', justifyContent: 'center' }}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content, { USE_PROFILES: { svg: true } }) }}
            />
        );
    }

    // Sandboxed HTML iframe
    const isHTML = /^<!DOCTYPE\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed);
    if (isHTML || trimmed.includes('<body') || trimmed.includes('<head')) {
        if (showCode) {
            return (
                <SyntaxHighlighter
                    language="html"
                    style={isDark ? oneDark : oneLight}
                    customStyle={{ margin: 0, background: 'transparent', fontSize: 13, padding: '14px 16px', overflowX: 'auto' }}
                    showLineNumbers
                >
                    {content}
                </SyntaxHighlighter>
            );
        }
        return (
            <iframe
                srcDoc={content}
                sandbox="allow-scripts"
                style={{
                    width: '100%',
                    minHeight: 480,
                    border: 'none',
                    background: isDark ? '#1a1b26' : '#fff',
                    display: 'block',
                }}
                title="Visualization preview"
            />
        );
    }

    // Fallback: render as code
    return (
        <pre style={{ padding: 16, fontSize: 13, overflowX: 'auto', color: 'var(--text-primary)', background: 'transparent' }}>
            <code>{content}</code>
        </pre>
    );
};

export const ArtifactContentBlock: React.FC<Props> = ( { selectedArtifact, artifactIsStreaming, artifactId, versionIndex, artifactEndRef, showCodeView = false }) => {

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
    
    // ── Type dispatch: route to the correct renderer ──────────────────────────
    const rawContentForType = transformedMessageContent;
    const nuiType = resolveNUIType(selectedArtifact.type)
        // For empty/unknown type, sniff from content
        || (!selectedArtifact.type ? sniffContentType(rawContentForType) : 'document');
    const effectiveType = selectedArtifact.type
        ? resolveNUIType(selectedArtifact.type)
        : sniffContentType(rawContentForType);

    if (effectiveType === 'spreadsheet') {
        return (
            <div className="artifactContentBlock w-full" id="artifactsContentBlock"
                data-artifact-id={artifactId} data-version-index={versionIndex}>
                <SpreadsheetRenderer content={rawContentForType} isStreaming={artifactIsStreaming} />
                <div ref={artifactEndRef} />
            </div>
        );
    }

    if (effectiveType === 'code') {
        const codeLang = selectedArtifact.metadata?.language as string | undefined;
        return (
            <div className="artifactContentBlock w-full" id="artifactsContentBlock"
                data-artifact-id={artifactId} data-version-index={versionIndex}>
                <CodeRenderer content={rawContentForType} language={codeLang} />
                <div ref={artifactEndRef} />
            </div>
        );
    }

    if (effectiveType === 'visualization') {
        return (
            <div className="artifactContentBlock w-full" id="artifactsContentBlock"
                data-artifact-id={artifactId} data-version-index={versionIndex}>
                <VisualizationRenderer
                    content={rawContentForType}
                    artifactIsStreaming={artifactIsStreaming}
                    showCode={showCodeView}
                />
                <div ref={artifactEndRef} />
            </div>
        );
    }

    // ── Default: document (Markdown renderer) ─────────────────────────────────
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
        rehypePlugins={[rehypeRaw, [rehypeSanitize, artifactSanitizeSchema], rehypeDarkModeStyles]}
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
                    const safeHref = DOMPurify.sanitize(href);
                    switch (true) {
                        case href.startsWith("#"):
                            return (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }}
                                    className={`dark:text-white hover:text-neutral-500 dark:hover:text-neutral-200 cursor-pointer underline`}
                                >
                                    {children}
                                </button>
                            );
                        case href.startsWith('javascript:'):
                            // Block javascript: hrefs entirely
                            return <>{children}</>;
                        default:
                            // External links — open in new tab (Bug 9 fix)
                            return (
                                <a
                                    href={safeHref}
                                    title={title}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                                >
                                    {children}
                                </a>
                            );
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
                    <div style={{ overflowX: 'auto', width: '100%' }}>
                        <table style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            borderColor: 'var(--border-subtle)',
                            fontSize: '14px',
                        }}>
                            {children}
                        </table>
                    </div>
                );
            },
            th({children}) {
                return (
                    <th style={{
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-active)',
                        color: 'var(--text-primary)',
                        padding: '8px 12px',
                        fontWeight: 600,
                        textAlign: 'left',
                        verticalAlign: 'middle',
                        whiteSpace: 'nowrap',
                    }}>
                        {children}
                    </th>
                );
            },
            td({children}) {
                return (
                    <td style={{
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        padding: '6px 12px',
                        verticalAlign: 'middle',
                        wordBreak: 'break-word',
                    }}>
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
