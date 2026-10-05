/**
 * What the backend says a project chat reply was built on. The server sends a
 * `projectContext` state event with every project chat reply (names and counts
 * only); the chat service stores it on the reply as `message.data.state.projectContext`.
 */
export interface ReplyProjectContext {
    projectId: string;
    name: string;
    instructions: boolean;
    memories: number;
    files: { name: string; retrievalOnly: boolean }[];
    totalFiles: number;
}

const isReplyContext = (value: any): value is ReplyProjectContext =>
    !!value && typeof value === 'object' && typeof value.projectId === 'string' && Array.isArray(value.files);

/** The context of the newest assistant reply that reports one, or null. */
export function getLastReplyContext(messages: any[] | undefined | null): ReplyProjectContext | null {
    if (!Array.isArray(messages)) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m?.role !== 'assistant') continue;
        const ctx = m?.data?.state?.projectContext;
        if (isReplyContext(ctx)) return ctx;
        // The newest assistant reply is the one that counts; an older reply's context is stale.
        return null;
    }
    return null;
}

/** One-line summary, e.g. "3 files, 2 memories, instructions". Empty when nothing was used. */
export function summarizeReplyContext(ctx: ReplyProjectContext | null): string {
    if (!ctx) return '';
    const parts: string[] = [];
    if (ctx.totalFiles > 0) parts.push(`${ctx.totalFiles} file${ctx.totalFiles === 1 ? '' : 's'}`);
    if (ctx.memories > 0) parts.push(`${ctx.memories} ${ctx.memories === 1 ? 'memory' : 'memories'}`);
    if (ctx.instructions) parts.push('instructions');
    return parts.join(', ');
}
