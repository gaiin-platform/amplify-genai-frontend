import { Project, ProjectMemory } from '@/types/project';
import type { ProjectFileRow } from './useProjectResources';

/**
 * Must match FULL_CONTEXT_TOKEN_BUDGET in amplify-lambda-js/projects/projectContext.js:
 * up to this many tokens of project files are attached whole; beyond it (or while
 * a file's size is unknown) they are searched per message instead.
 */
export const PROJECT_FULL_CONTEXT_TOKEN_BUDGET = 25_000;

const CHARS_PER_TOKEN = 4;

export interface ProjectContextUsage {
    fileTokens: number;
    instructionTokens: number;
    memoryTokens: number;
    total: number;
    /** Share of the model's input window, 0–1 (0 when the window is unknown). */
    fraction: number;
    /** Files that have no size yet (still uploading/processing). */
    unmeasuredFiles: number;
    /** True when files are searched per message rather than attached in full. */
    retrievalOnly: boolean;
}

/** Rough size of everything a project adds to a chat, for the context meter. */
export function computeProjectContextUsage(
    project: Pick<Project, 'instructions' | 'memoryEnabled'>,
    files: ProjectFileRow[],
    memories: ProjectMemory[],
    contextWindow?: number,
): ProjectContextUsage {
    const usable = files.filter((f) => f.status === 'ready' || f.status === 'processing');
    const fileTokens = usable.reduce((sum, f) => sum + (f.totalTokens > 0 ? f.totalTokens : 0), 0);
    const unmeasuredFiles = usable.filter((f) => !(f.totalTokens > 0)).length;
    const instructionTokens = Math.ceil((project.instructions?.trim().length ?? 0) / CHARS_PER_TOKEN);
    const memoryTokens = project.memoryEnabled
        ? Math.ceil(memories.filter((m) => m.status === 'approved').reduce((sum, m) => sum + m.content.length, 0) / CHARS_PER_TOKEN)
        : 0;
    const retrievalOnly = usable.length > 0 && (unmeasuredFiles > 0 || fileTokens > PROJECT_FULL_CONTEXT_TOKEN_BUDGET);
    // Retrieval-only files contribute only the passages fetched per message, not their full size.
    const countedFiles = retrievalOnly ? 0 : fileTokens;
    const total = countedFiles + instructionTokens + memoryTokens;
    return {
        fileTokens,
        instructionTokens,
        memoryTokens,
        total,
        fraction: contextWindow && contextWindow > 0 ? Math.min(1, total / contextWindow) : 0,
        unmeasuredFiles,
        retrievalOnly,
    };
}

export const formatTokens = (n: number): string =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k` : `${n}`;
