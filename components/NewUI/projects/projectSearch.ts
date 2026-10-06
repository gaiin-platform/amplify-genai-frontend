import { Conversation } from '@/types/chat';
import { ProjectMemory } from '@/types/project';
import type { ProjectFileRow } from './useProjectResources';

export interface ChatHit { conversation: Conversation; snippet: string; inName: boolean }
export interface FileHit { file: ProjectFileRow }
export interface MemoryHit { memory: ProjectMemory }

export interface ProjectSearchResults {
    chats: ChatHit[];
    files: FileHit[];
    memories: MemoryHit[];
    total: number;
}

const SNIPPET_RADIUS = 60;

const snippetAround = (text: string, index: number, length: number): string => {
    const start = Math.max(0, index - SNIPPET_RADIUS);
    const end = Math.min(text.length, index + length + SNIPPET_RADIUS);
    return `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${end < text.length ? '…' : ''}`;
};

/**
 * Case-insensitive search across one project's chats, files and memory.
 *
 * `getMessageText` supplies a chat's message text when it is available locally
 * (cloud-stored chats are stubs until opened, so only their names are searched —
 * the same limitation as the Chats list).
 */
export function searchProject(
    query: string,
    data: {
        chats: Conversation[];
        files: ProjectFileRow[];
        memories: ProjectMemory[];
        getMessageText?: (conversation: Conversation) => string;
    },
): ProjectSearchResults {
    const q = query.trim().toLowerCase();
    if (!q) return { chats: [], files: [], memories: [], total: 0 };

    const chats: ChatHit[] = [];
    for (const conversation of data.chats) {
        const name = conversation.name || '';
        const nameIndex = name.toLowerCase().indexOf(q);
        if (nameIndex >= 0) {
            chats.push({ conversation, snippet: '', inName: true });
            continue;
        }
        const text = data.getMessageText?.(conversation) ?? '';
        const textIndex = text.toLowerCase().indexOf(q);
        if (textIndex >= 0) chats.push({ conversation, snippet: snippetAround(text, textIndex, q.length), inName: false });
    }

    const files = data.files.filter((f) => f.name.toLowerCase().includes(q)).map((file) => ({ file }));
    const memories = data.memories.filter((m) => m.content.toLowerCase().includes(q)).map((memory) => ({ memory }));
    return { chats, files, memories, total: chats.length + files.length + memories.length };
}
