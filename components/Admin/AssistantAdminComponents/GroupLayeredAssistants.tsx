/**
 * GroupLayeredAssistants
 *
 * Manages the Layered Assistants that belong to an admin group.
 * Saves / deletes are routed through the /groups/layered_assistants proxy so that
 * the backend stores them under the group system user (astgr/ prefix).
 *
 * The builder is always called with the group's own assistants as the only
 * available leaf nodes — members cannot pull in assistants from other groups.
 */

import React, { Dispatch, FC, SetStateAction, useState } from 'react';
import {
    IconGitBranch,
    IconPlus,
    IconEdit,
    IconTrash,
    IconCheck,
    IconX,
    IconLoader2,
} from '@tabler/icons-react';

import { Group } from '@/types/groups';
import { Prompt } from '@/types/prompt';
import { LayeredAssistant, createLayeredAssistant } from '@/types/layeredAssistant';
import {
    saveGroupLayeredAssistant,
    deleteGroupLayeredAssistant,
} from '@/services/groupsService';

interface Props {
    selectedGroup: Group;
    layeredAssistants: LayeredAssistant[];
    isLoading: boolean;
    setLayeredAssistants: Dispatch<SetStateAction<LayeredAssistant[]>>;
}

export const GroupLayeredAssistants: FC<Props> = ({ selectedGroup, layeredAssistants, isLoading, setLayeredAssistants }) => {
    const [actionMessage, setActionMessage] = useState('');

    const [deletingId, setDeletingId]   = useState<string | null>(null);
    const [isDeleting, setIsDeleting]   = useState(false);

    // Group's own assistant prompts — the only choices allowed in the builder
    const groupAssistants: Prompt[] = selectedGroup.assistants ?? [];

    // ── Save (create or update) ──────────────────────────────────────
    const handleSave = async (la: LayeredAssistant): Promise<LayeredAssistant | null> => {
        setActionMessage('Saving…');
        try {
            const withGroup: LayeredAssistant = { ...la, groupId: selectedGroup.id };
            const result = await saveGroupLayeredAssistant(selectedGroup.id, withGroup);

            if (result?.success && result.data?.assistantId) {
                const saved: LayeredAssistant = {
                    ...withGroup,
                    assistantId: result.data.assistantId,
                    updatedAt:   result.data.updatedAt,
                    astPath:     la.astPath,
                    astPathData: la.astPathData,
                };
                setLayeredAssistants((prev) => {
                    const exists = prev.some((x) => x.assistantId === saved.assistantId);
                    return exists
                        ? prev.map((x) => (x.assistantId === saved.assistantId ? saved : x))
                        : [...prev, saved];
                });
                return saved;
            } else {
                alert('Failed to save layered assistant. Please try again.');
            }
        } catch (e) {
            console.error('Save failed:', e);
            alert('Failed to save layered assistant. Please try again.');
        } finally {
            setActionMessage('');
        }
        return null;
    };

    // ── Delete ───────────────────────────────────────────────────────
    const handleConfirmDelete = async () => {
        if (!deletingId) return;
        setIsDeleting(true);
        setActionMessage('Deleting…');
        try {
            const result = await deleteGroupLayeredAssistant(selectedGroup.id, deletingId);
            if (result?.success) {
                setLayeredAssistants((prev) => prev.filter((x) => x.assistantId !== deletingId));
            } else {
                alert('Failed to delete layered assistant. Please try again.');
            }
        } catch (e) {
            console.error('Delete failed:', e);
            alert('Failed to delete layered assistant. Please try again.');
        } finally {
            setIsDeleting(false);
            setActionMessage('');
            setDeletingId(null);
        }
    };

    // ── Render ───────────────────────────────────────────────────────
    return (
        <div className="p-4 text-black dark:text-white">

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <IconGitBranch size={22} />
                    <h2 className="text-lg font-semibold">Layered Assistants</h2>
                </div>
                <button
                    className="flex flex-row gap-1 items-center text-sm text-white px-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 transition-all duration-200 py-2 rounded-lg shadow-sm"
                    onClick={() => {
                        window.dispatchEvent(new CustomEvent('openLayeredBuilderTrigger', {
                            detail: {
                                isOpen: true,
                                data: {
                                    title: `New Layered Assistant — ${selectedGroup.name}`,
                                    initialData: createLayeredAssistant(),
                                    assistants: groupAssistants,
                                    onSave: handleSave,
                                },
                            },
                        }));
                    }}
                    disabled={groupAssistants.length === 0}
                    title={groupAssistants.length === 0 ? 'Add at least one group assistant before creating a layered assistant.' : 'Create a new layered assistant for this group'}
                >
                    <IconPlus size={16} className="mr-1" />
                    New Layered Assistant
                </button>
            </div>

            {groupAssistants.length === 0 && (
                <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-4">
                    This group has no assistants yet. Add group assistants first before creating layered assistants.
                </p>
            )}

            {/* Loading */}
            {isLoading && (
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                    <IconLoader2 size={16} className="animate-spin" />
                    Loading…
                </div>
            )}

            {/* Action feedback */}
            {actionMessage && (
                <div className="flex items-center gap-2 text-sm text-neutral-500 mb-2">
                    <IconLoader2 size={14} className="animate-spin" />
                    {actionMessage}
                </div>
            )}

            {/* Empty state */}
            {!isLoading && layeredAssistants.length === 0 && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    No layered assistants yet for <strong>{selectedGroup.name}</strong>.
                    Create one to route conversations across multiple group assistants.
                </p>
            )}

            {/* List */}
            {!isLoading && layeredAssistants.length > 0 && (
                <div className="flex flex-col gap-2">
                    {layeredAssistants.map((la) => (
                        <div
                            key={la.assistantId ?? la.name}
                            className="flex items-center justify-between rounded-lg border border-neutral-200 dark:border-neutral-700 px-4 py-3 bg-white dark:bg-[#2a2b32] hover:bg-neutral-50 dark:hover:bg-[#343541] transition-colors"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <IconGitBranch size={18} className="flex-shrink-0 text-purple-500 dark:text-purple-400" />
                                <div className="min-w-0">
                                    <p className="font-medium truncate">{la.name || 'Untitled'}</p>
                                    {la.description && (
                                        <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                                            {la.description}
                                        </p>
                                    )}
                                    <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5 font-mono">
                                        {la.assistantId}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0 ml-4">
                                {deletingId === la.assistantId ? (
                                    <>
                                        <button
                                            onClick={handleConfirmDelete}
                                            disabled={isDeleting}
                                            title="Confirm Delete"
                                            className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                                        >
                                            {isDeleting
                                                ? <IconLoader2 size={16} className="animate-spin" />
                                                : <IconCheck size={16} />
                                            }
                                        </button>
                                        <button
                                            onClick={() => setDeletingId(null)}
                                            title="Cancel"
                                            className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                        >
                                            <IconX size={16} />
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => {
                                                window.dispatchEvent(new CustomEvent('openLayeredBuilderTrigger', {
                                                    detail: {
                                                        isOpen: true,
                                                        data: {
                                                            title: `Edit Layered Assistant — ${selectedGroup.name}`,
                                                            initialData: la,
                                                            assistants: groupAssistants,
                                                            onSave: handleSave,
                                                        },
                                                    },
                                                }));
                                            }}
                                            title="Edit"
                                            className="p-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                                        >
                                            <IconEdit size={16} />
                                        </button>
                                        <button
                                            onClick={() => setDeletingId(la.assistantId ?? null)}
                                            title="Delete"
                                            className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                                        >
                                            <IconTrash size={16} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

        </div>
    );
};
