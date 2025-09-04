import React, { useEffect, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface LatexBlockProps {
    math: string;
    displayMode?: boolean;
}

const LatexBlock: React.FC<LatexBlockProps> = ({ math, displayMode = false }) => {
    const ref = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (ref.current) {
            try {
                katex.render(math, ref.current, {
                    displayMode,
                    throwOnError: false,
                    errorColor: "#cc0000",
                    strict: "warn"
                });
            } catch (err) {
                // Fallback to plain text if LaTeX parsing fails
                ref.current.textContent = `$${displayMode ? '$' : ''}${math}${displayMode ? '$' : ''}$`;
            }
        }
    }, [math, displayMode]);

    return <span ref={ref} />;
};

export default LatexBlock;