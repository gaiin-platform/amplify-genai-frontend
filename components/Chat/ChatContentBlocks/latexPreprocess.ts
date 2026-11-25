// Text preprocessing for LaTeX in chat messages. React-free so it can be
// memoized by the component and tested on its own.

// Check if content contains LaTeX
export const hasLatex = (content: string) => {
    // More precise LaTeX detection that avoids code blocks
    const codeBlockRegex = /```[\s\S]*?```|`[^`]*`/g;
    const contentWithoutCode = content.replace(codeBlockRegex, '');
    return /\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^\s$](?:[^$]*[^\s$])?\$/.test(contentWithoutCode);
};

// Converts LaTeX delimiters to <math-display>/<math-inline> elements, leaving
// fenced and inline code untouched. Runs every pass on any input.
export const processLatexFull = (content: string) => {
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

    // Replace single-dollar inline math $...$ with placeholder, skipping plain dollar amounts
    processed = processed.replace(/\$([^\s$](?:[^$]*[^\s$])?)\$/g, (match, latex) => {
        if (/^[\d.,]+$/.test(latex)) return match;
        return `<math-inline>${latex}</math-inline>`;
    });

    // Restore code blocks
    codeBlockPlaceholders.forEach((placeholder, index) => {
        processed = processed.replace(placeholder, codeBlocks[index]);
    });

    return processed;
};

// Every LaTeX pattern needs a "$" or a backslash, so text with neither is
// returned as is without running any regex. The full path returns such text
// unchanged too, except where its restore loop misplaces code: a fenced block
// inside a single-backtick span, or text that already contains a placeholder
// name such as __INLINE_CODE_0__ ahead of the code it stands for.
export const processLatex = (content: string) => {
    if (!content.includes('$') && !content.includes('\\')) return content;
    return processLatexFull(content);
};
