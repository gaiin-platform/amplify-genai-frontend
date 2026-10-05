import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { updateProject } from '@/services/projectService';
import { invalidateProjectContext } from '@/services/projectContextCache';
import { Project } from '@/types/project';
import { invalidateProjectRegistry } from './projectRegistry';

export const MAX_NAME_LENGTH = 120;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_INSTRUCTIONS_LENGTH = 12000;

/**
 * Editable drafts for the open project. "Dirty" is derived by comparing against
 * the saved project, so it clears automatically after a successful save and
 * survives the panel being collapsed on small screens.
 */
export function useProjectDrafts(project: Project | null, onSaved: (project: Project) => void) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [instructions, setInstructions] = useState('');
    const [saving, setSaving] = useState<'details' | 'instructions' | 'assistant' | null>(null);

    const projectId = project?.id ?? null;
    useEffect(() => {
        setName(project?.name ?? '');
        setDescription(project?.description ?? '');
        setInstructions(project?.instructions ?? '');
        setSaving(null);
        // Reset only when switching projects; saves and status changes must not discard edits.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

    const detailsDirty = !!project && (name !== project.name || description !== (project.description ?? ''));
    const instructionsDirty = !!project && instructions !== (project.instructions ?? '');

    const save = useCallback(async (kind: 'details' | 'instructions') => {
        if (!project) return;
        if (kind === 'details' && !name.trim()) {
            toast.error('A project needs a name.');
            return;
        }
        setSaving(kind);
        try {
            const result = await updateProject(
                kind === 'details'
                    ? { id: project.id, name: name.trim(), description: description.trim() }
                    : { id: project.id, instructions },
            );
            if (result.success && result.data) {
                invalidateProjectContext(project.id);
                invalidateProjectRegistry();
                onSaved(result.data);
                if (kind === 'details') {
                    setName(result.data.name);
                    setDescription(result.data.description ?? '');
                }
                toast.success(kind === 'details' ? 'Details saved.' : 'Instructions saved.');
            } else {
                toast.error(result.message || 'Failed to save changes.');
            }
        } catch (e) {
            console.error('Failed to save project', e);
            toast.error('Failed to save changes.');
        } finally {
            setSaving(null);
        }
    }, [project, name, description, instructions, onSaved]);

    const discard = useCallback((kind: 'details' | 'instructions') => {
        if (!project) return;
        if (kind === 'details') {
            setName(project.name);
            setDescription(project.description ?? '');
        } else {
            setInstructions(project.instructions ?? '');
        }
    }, [project]);

    /** Save explicit values (used by the editing dialogs). Resolves true on success. */
    const commit = useCallback(async (
        kind: 'details' | 'instructions',
        fields: { name?: string; description?: string; instructions?: string },
    ): Promise<boolean> => {
        if (!project) return false;
        setSaving(kind);
        try {
            const result = await updateProject({ id: project.id, ...fields });
            if (result.success && result.data) {
                invalidateProjectContext(project.id);
                invalidateProjectRegistry();
                onSaved(result.data);
                toast.success(kind === 'details' ? 'Details saved.' : 'Instructions saved.');
                return true;
            }
            toast.error(result.message || 'Failed to save changes.');
        } catch (e) {
            console.error('Failed to save project', e);
            toast.error('Failed to save changes.');
        } finally {
            setSaving(null);
        }
        return false;
    }, [project, onSaved]);

    const saveInstructionsText = useCallback((text: string) => commit('instructions', { instructions: text }), [commit]);
    const saveDetailsValues = useCallback(
        (name: string, description: string) => commit('details', { name: name.trim(), description: description.trim() }),
        [commit],
    );

    /** Attach / replace / remove the project's default assistant. Applies immediately. */
    const changeAssistant = useCallback(async (choice: { id: string; name: string } | null) => {
        if (!project) return;
        setSaving('assistant');
        try {
            const result = await updateProject({
                id: project.id,
                assistantId: choice?.id ?? '',
                assistantName: choice?.name ?? '',
            });
            if (result.success && result.data) {
                invalidateProjectContext(project.id);
                invalidateProjectRegistry();
                onSaved(result.data);
                toast.success(choice ? `${choice.name} attached to this project.` : 'Assistant removed from this project.');
            } else {
                toast.error(result.message || 'Failed to update assistant.');
            }
        } catch (e) {
            console.error('Failed to update project assistant', e);
            toast.error('Failed to update assistant.');
        } finally {
            setSaving(null);
        }
    }, [project, onSaved]);

    return {
        saveInstructionsText, saveDetailsValues,
        changeAssistant,
        name, setName, description, setDescription, instructions, setInstructions,
        detailsDirty, instructionsDirty, dirty: detailsDirty || instructionsDirty,
        saving, save, discard,
    };
}

export type ProjectDrafts = ReturnType<typeof useProjectDrafts>;
