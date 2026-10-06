import { useCallback, useEffect, useMemo, useState } from 'react';
import { listProjects } from '@/services/projectService';
import { Project } from '@/types/project';
import { PROJECTS_ENABLED } from '@/utils/app/projectsFlag';

/**
 * A small shared cache of the user's project list, so the sidebar, the Chats
 * list and the "Move to project" picker can show project names without each
 * fetching it. Refreshed at most once a minute, and immediately when the
 * Projects view changes a project (invalidateProjectRegistry).
 */
const TTL_MS = 60_000;
let cache: { projects: Project[]; fetchedAt: number } | null = null;
let inflight: Promise<Project[]> | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

export const fetchProjectRegistry = async (force = false): Promise<Project[]> => {
    if (!force && cache && Date.now() - cache.fetchedAt < TTL_MS) return cache.projects;
    if (!inflight) {
        inflight = listProjects()
            .then((result) => {
                const projects = result.success ? result.data || [] : cache?.projects || [];
                cache = { projects, fetchedAt: result.success ? Date.now() : 0 };
                notify();
                return projects;
            })
            .catch(() => cache?.projects || [])
            .finally(() => { inflight = null; });
    }
    return inflight;
};

/** Call after any create/update/delete so name labels and pickers refresh. */
export const invalidateProjectRegistry = (): void => {
    cache = null;
    notify();
};

/**
 * @param enabled  Pass false to avoid any request (e.g. no chat belongs to a
 *                 project, so there is nothing to label). Data already cached is
 *                 still returned.
 */
export function useProjectRegistry(enabledRequested = true) {
    const enabled = enabledRequested && PROJECTS_ENABLED;
    const [projects, setProjects] = useState<Project[]>(() => cache?.projects || []);
    const [loaded, setLoaded] = useState<boolean>(() => !!cache);

    const refresh = useCallback(async (force = false) => {
        const result = await fetchProjectRegistry(force);
        setProjects(result);
        setLoaded(true);
    }, []);

    useEffect(() => {
        const onChange = () => {
            if (cache) {
                setProjects(cache.projects);
                setLoaded(true);
            } else if (enabled) {
                refresh(true);
            }
        };
        listeners.add(onChange);
        return () => { listeners.delete(onChange); };
    }, [enabled, refresh]);

    useEffect(() => { if (enabled) refresh(); }, [enabled, refresh]);

    const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
    const names = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
    const active = useMemo(() => projects.filter((p) => p.status === 'active'), [projects]);
    return { projects, active, byId, names, loaded, refresh };
}
