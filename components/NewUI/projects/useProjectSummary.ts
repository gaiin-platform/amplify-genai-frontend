import { useEffect, useState } from 'react';
import { loadProjectContext } from '@/services/projectContextCache';
import { Project } from '@/types/project';
import { PROJECTS_ENABLED } from '@/utils/app/projectsFlag';

/**
 * Resolves a project record for lightweight display (e.g. the chat header's
 * "back to project" link). Shares the send-time cache, so it also warms the
 * project's file list for the next message. Resolves to null when the project
 * is missing or can't be loaded.
 */
export function useProjectSummary(projectId?: string): Project | null {
    const [project, setProject] = useState<Project | null>(null);
    useEffect(() => {
        if (!projectId || !PROJECTS_ENABLED) {
            setProject(null);
            return;
        }
        let cancelled = false;
        loadProjectContext(projectId, 8000)
            .then((entry) => { if (!cancelled) setProject(entry.project); })
            .catch(() => { if (!cancelled) setProject(null); });
        return () => { cancelled = true; };
    }, [projectId]);
    return project;
}
