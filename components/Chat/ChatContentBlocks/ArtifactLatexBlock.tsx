import React, { useEffect, useRef, memo, useState, useCallback } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface ArtifactLatexBlockProps {
    math: string;
    displayMode?: boolean;
    estimatedHeight?: string;
}

const ArtifactLatexBlock: React.FC<ArtifactLatexBlockProps> = memo(({ 
    math, 
    displayMode = false, 
    estimatedHeight 
}) => {
    const ref = useRef<HTMLSpanElement>(null);
    const lastMathRef = useRef<string>("");
    const lastDisplayModeRef = useRef<boolean>(false);
    const [isRendered, setIsRendered] = useState(false);
    const [actualHeight, setActualHeight] = useState<string | null>(null);

    // Pre-calculate stable dimensions based on LaTeX complexity
    const getStableDimensions = useCallback((mathContent: string, isDisplay: boolean) => {
        const baseHeight = isDisplay ? '1.5em' : '1em';
        const baseWidth = isDisplay ? '2em' : '1em';
        
        // Analyze content complexity for better size estimation
        let heightMultiplier = 1;
        let widthMultiplier = 1;
        
        // Check for elements that increase height
        if (mathContent.includes('\\frac')) heightMultiplier += 0.5;
        if (mathContent.includes('\\sqrt')) heightMultiplier += 0.3;
        if (mathContent.includes('\\sum') || mathContent.includes('\\int')) heightMultiplier += 0.8;
        if (mathContent.includes('\\matrix') || mathContent.includes('\\begin{')) heightMultiplier += 1;
        if (mathContent.includes('^') && mathContent.includes('_')) heightMultiplier += 0.2; // superscript + subscript
        
        // Check for elements that increase width
        if (mathContent.length > 20) widthMultiplier += 0.5;
        if (mathContent.includes('\\begin{aligned}')) widthMultiplier += 1;
        
        return {
            height: `${parseFloat(baseHeight) * heightMultiplier}em`,
            width: `${parseFloat(baseWidth) * widthMultiplier}em`
        };
    }, []);

    const stableDimensions = getStableDimensions(math, displayMode);

    useEffect(() => {
        // Only re-render if the math content or display mode actually changed
        if (ref.current && math && 
            (math !== lastMathRef.current || displayMode !== lastDisplayModeRef.current)) {
            
            try {
                // CRITICAL: Set stable placeholder content immediately to prevent ANY layout shift
                if (ref.current && !isRendered) {
                    ref.current.innerHTML = `<span style="
                        display: ${displayMode ? 'block' : 'inline-block'};
                        min-height: ${estimatedHeight || stableDimensions.height};
                        min-width: ${stableDimensions.width};
                        background: transparent;
                        visibility: hidden;
                    ">${displayMode ? '$$' : '$'}</span>`;
                }

                // Use double RAF to ensure layout is stable before rendering
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        if (ref.current) {
                            try {
                                // Render to temporary container first to measure
                                const tempDiv = document.createElement('div');
                                tempDiv.style.position = 'absolute';
                                tempDiv.style.visibility = 'hidden';
                                tempDiv.style.pointerEvents = 'none';
                                document.body.appendChild(tempDiv);
                                
                                katex.render(math, tempDiv, {
                                    displayMode,
                                    throwOnError: false,
                                    errorColor: "#cc0000",
                                    strict: "warn"
                                });
                                
                                // Measure actual dimensions
                                const actualDimensions = {
                                    height: `${tempDiv.offsetHeight}px`,
                                    width: `${tempDiv.offsetWidth}px`
                                };
                                
                                // Now render to actual container with stable dimensions
                                katex.render(math, ref.current, {
                                    displayMode,
                                    throwOnError: false,
                                    errorColor: "#cc0000",
                                    strict: "warn"
                                });
                                
                                // Clean up temp element
                                document.body.removeChild(tempDiv);
                                
                                setActualHeight(actualDimensions.height);
                                lastMathRef.current = math;
                                lastDisplayModeRef.current = displayMode;
                                setIsRendered(true);
                            } catch (renderError) {
                                // Fallback rendering
                                if (ref.current) {
                                    ref.current.textContent = `$${displayMode ? '$' : ''}${math}${displayMode ? '$' : ''}$`;
                                    lastMathRef.current = math;
                                    lastDisplayModeRef.current = displayMode;
                                    setIsRendered(true);
                                }
                            }
                        }
                    });
                });
            } catch (err) {
                // Fallback to plain text if LaTeX parsing fails
                if (ref.current) {
                    ref.current.textContent = `$${displayMode ? '$' : ''}${math}${displayMode ? '$' : ''}$`;
                    lastMathRef.current = math;
                    lastDisplayModeRef.current = displayMode;
                    setIsRendered(true);
                }
            }
        }
    }, [math, displayMode, isRendered, estimatedHeight, stableDimensions]);

    return (
        <span 
            ref={ref} 
            style={{
                // Use estimated height initially, then actual height once rendered
                minHeight: actualHeight || estimatedHeight || stableDimensions.height,
                minWidth: stableDimensions.width,
                display: displayMode ? 'block' : 'inline-block',
                verticalAlign: displayMode ? 'top' : 'baseline',
                // Critical stability properties
                contain: 'layout style size', // Prevent any layout influence on parent
                overflow: 'hidden', // Prevent content overflow during render
                transition: 'none', // Disable all transitions
                willChange: 'auto', // Optimize for stability over performance
                // Prevent text selection issues during render
                userSelect: isRendered ? 'auto' : 'none'
            }}
        />
    );
}, (prevProps, nextProps) => {
    // Enhanced comparison to prevent unnecessary re-renders
    return prevProps.math === nextProps.math && 
           prevProps.displayMode === nextProps.displayMode &&
           prevProps.estimatedHeight === nextProps.estimatedHeight;
});

ArtifactLatexBlock.displayName = 'ArtifactLatexBlock';

export default ArtifactLatexBlock;
