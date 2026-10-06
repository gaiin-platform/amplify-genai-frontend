import { getProject } from '@/services/projectService';
import { Project } from '@/types/project';

/**
 * Client-side cache of a project's record.
 *
 * Instructions, approved memories and the project's knowledge-base files are all
 * attached to a chat on the backend (amplify-lambda-js reads them by `projectId`),
 * so sending a message never waits on this. The client only needs the project's
 * record for light things — the chat header's name, the archived notice, and
 * whether memory suggestions are enabled — so it is cached briefly, de-duplicated
 * while in flight, and dropped whenever the project changes.
 */

const CACHE_TTL_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 4_000;

export interface ProjectContextEntry {
    project: Project;
    fetchedAt: number;
}

/** The project no longer exists (or isn't the caller's). Callers treat the chat as a plain chat. */
export class ProjectNotFoundError extends Error {
    constructor() {
        super('Project not found');
        this.name = 'ProjectNotFoundError';
    }
}

const cache = new Map<string, ProjectContextEntry>();
const inflight = new Map<string, Promise<ProjectContextEntry>>();

const fetchEntry = async (projectId: string): Promise<ProjectContextEntry> => {
    const result = await getProject(projectId);
    if (!result.success || !result.data) {
        if (/not found/i.test(result.message || '')) throw new ProjectNotFoundError();
        throw new Error(result.message || 'Project unavailable');
    }
    return { project: result.data, fetchedAt: Date.now() };
};

/**
 * Resolves the project record. Serves a fresh cache entry when one exists;
 * otherwise fetches (sharing any in-flight fetch) and rejects if it takes longer
 * than `timeoutMs`. A timed-out fetch keeps running and warms the cache.
 */
export const loadProjectContext = (
    projectId: string,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<ProjectContextEntry> => {
    const cached = cache.get(projectId);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return Promise.resolve(cached);

    let pending = inflight.get(projectId);
    if (!pending) {
        pending = fetchEntry(projectId)
            .then((entry) => {
                cache.set(projectId, entry);
                return entry;
            })
            .finally(() => {
                inflight.delete(projectId);
            });
        inflight.set(projectId, pending);
    }

    return new Promise<ProjectContextEntry>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Project context timed out')), timeoutMs);
        pending!.then(
            (entry) => { clearTimeout(timer); resolve(entry); },
            (error) => { clearTimeout(timer); reject(error); },
        );
    });
};

/** Warm the cache (e.g. when a project workspace opens). Never throws. */
export const prefetchProjectContext = (projectId: string): void => {
    loadProjectContext(projectId, 30_000).catch(() => undefined);
};

/** Drop cached data after any change to a project or its status. */
export const invalidateProjectContext = (projectId?: string): void => {
    if (projectId) {
        cache.delete(projectId);
        inflight.delete(projectId);
    } else {
        cache.clear();
        inflight.clear();
    }
};
