import React, { useEffect, useRef, memo, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface LatexBlockProps {
    math: string;
    displayMode?: boolean;
}

const LatexBlock: React.FC<LatexBlockProps> = memo(({ math, displayMode = false }) => {
    const ref = useRef<HTMLSpanElement>(null);
    const lastMathRef = useRef<string>("");
    const lastDisplayModeRef = useRef<boolean>(false);
    const [isRendered, setIsRendered] = useState(false);

    useEffect(() => {
        // Only re-render if the math content or display mode actually changed
        if (ref.current && math && 
            (math !== lastMathRef.current || displayMode !== lastDisplayModeRef.current)) {
            
            try {
                // Set placeholder content immediately to prevent layout shift
                if (ref.current && !isRendered) {
                    ref.current.textContent = displayMode ? '$$' : '$';
                }

                // Use requestAnimationFrame to batch DOM updates and reduce jitter
                requestAnimationFrame(() => {
                    if (ref.current) {
                        katex.render(math, ref.current, {
                            displayMode,
                            throwOnError: false,
                            errorColor: "#cc0000",
                            strict: "warn"
                        });
                        
                        lastMathRef.current = math;
                        lastDisplayModeRef.current = displayMode;
                        setIsRendered(true);
                    }
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
    }, [math, displayMode, isRendered]);

    return (
        <span 
            ref={ref} 
            style={{
                minWidth: displayMode ? '2em' : '1em',
                minHeight: displayMode ? '1.5em' : '1em',
                display: displayMode ? 'block' : 'inline-block'
            }}
        />
    );
}, (prevProps, nextProps) => {
    // Custom comparison function to prevent unnecessary re-renders
    return prevProps.math === nextProps.math && 
           prevProps.displayMode === nextProps.displayMode;
});

LatexBlock.displayName = 'LatexBlock';

export default LatexBlock;