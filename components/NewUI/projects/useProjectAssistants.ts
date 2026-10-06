import { useContext, useMemo } from 'react';
import HomeContext from '@/pages/api/home/home.context';
import { Assistant } from '@/types/assistant';
import { LayeredAssistant } from '@/types/layeredAssistant';
import { Prompt } from '@/types/prompt';
import { isAssistant } from '@/utils/app/assistants';
import { lookupAssistant, syntheticAssistant } from '@/components/NewUI/shared/useConversationAssistant';
import { Project } from '@/types/project';

export interface AssistantChoice {
    /** definition.assistantId (or the layered assistant's id) */
    id: string;
    name: string;
    description: string;
    isLayered: boolean;
}

const SYSTEM_TAG = 'amplify:system';

/**
 * The assistants the user can attach to a project — the same list the composer's
 * "Add assistant" menu offers (system and hidden assistants excluded), plus
 * layered/group assistants.
 */
export function useProjectAssistants() {
    const { state: { prompts, layeredAssistants, groups, featureFlags } } = useContext(HomeContext);

    const layered: LayeredAssistant[] = useMemo(() => [
        ...((layeredAssistants ?? []) as LayeredAssistant[]),
        ...(((groups ?? []) as any[]).flatMap((g: any) => g.layeredAssistants ?? []) as LayeredAssistant[]),
    ], [layeredAssistants, groups]);

    const choices: AssistantChoice[] = useMemo(() => {
        const seen = new Set<string>();
        const result: AssistantChoice[] = [];
        for (const p of (prompts ?? []) as Prompt[]) {
            if (!isAssistant(p)) continue;
            const defTags: string[] = p.data?.assistant?.definition?.tags ?? [];
            const dataTags: string[] = p.data?.tags ?? [];
            if (defTags.includes(SYSTEM_TAG) || dataTags.includes(SYSTEM_TAG)) continue;
            if (!featureFlags?.overrideInvisiblePrompts && p.data?.hidden) continue;
            const def = p.data?.assistant?.definition;
            const id = def?.assistantId;
            if (!def || !id || seen.has(id)) continue;
            seen.add(id);
            result.push({ id, name: def.name || 'Untitled assistant', description: def.description || '', isLayered: false });
        }
        for (const la of layered) {
            if (!la?.assistantId || seen.has(la.assistantId)) continue;
            seen.add(la.assistantId);
            result.push({ id: la.assistantId, name: la.name || 'Untitled assistant', description: la.description || '', isLayered: true });
        }
        return result.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    }, [prompts, layered, featureFlags?.overrideInvisiblePrompts]);

    return { choices, prompts: (prompts ?? []) as Prompt[], layered };
}

/**
 * Resolve the project's stored assistant reference to a full Assistant object
 * (what the composer and send path need). Falls back to a display-only stub when
 * the assistant is no longer in the user's list; the backend's normal access
 * check then decides whether it can actually be used.
 */
export function resolveProjectAssistant(
    project: Pick<Project, 'assistantId' | 'assistantName'> | null | undefined,
    prompts: Prompt[],
    layered: LayeredAssistant[],
): Assistant | null {
    if (!project?.assistantId) return null;
    return (
        lookupAssistant(prompts, layered, project.assistantId, project.assistantName) ??
        syntheticAssistant(project.assistantName || 'Assistant', project.assistantId)
    );
}

export function useProjectAssistant(project: Pick<Project, 'assistantId' | 'assistantName'> | null | undefined): Assistant | null {
    const { prompts, layered } = useProjectAssistants();
    return useMemo(
        () => resolveProjectAssistant(project, prompts, layered),
        [project?.assistantId, project?.assistantName, prompts, layered], // eslint-disable-line react-hooks/exhaustive-deps
    );
}
