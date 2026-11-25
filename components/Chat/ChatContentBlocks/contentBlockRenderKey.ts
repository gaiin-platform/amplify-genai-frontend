// Decides when ChatContentBlock remounts its rendered markdown (by bumping
// its render key). Kept free of React so it can be tested in node.

// Content the block counts as already rendered on its first render. A message
// that is finished when it mounts is rendered by that first render, so it must
// not remount straight away. A block that mounts while a reply is streaming
// starts from "" so it still remounts once streaming ends.
export const initialRenderedContent = (finalContent: string, messageIsStreaming: boolean): string =>
    messageIsStreaming ? "" : finalContent;

// Remount when streaming has stopped and the content differs from what was
// last rendered (end of a stream, or an edit after the message finished).
export const shouldRemountContent = (
    finalContent: string,
    messageIsStreaming: boolean,
    lastRenderContent: string,
): boolean => !messageIsStreaming && finalContent !== lastRenderContent;
