import {
    IconEdit,
    IconTrash,
    IconCheck,
    IconX,
    IconShare,
    IconGitBranch,
    IconLoader2,
    IconUsers,
} from '@tabler/icons-react';
import { MouseEventHandler, useContext, useMemo, useState } from 'react';

import HomeContext from '@/pages/api/home/home.context';
import { LayeredAssistant, isGroupLayeredAssistant } from '@/types/layeredAssistant';
import { Assistant, AssistantProviderID } from '@/types/assistant';
import { Prompt } from '@/types/prompt';
import { isAssistant } from '@/utils/app/assistants';
import { deleteLayeredAssistant, saveLayeredAssistant } from '@/services/assistantService';
import {
    saveGroupLayeredAssistant,
    deleteGroupLayeredAssistant,
} from '@/services/groupsService';
import ActionButton from '@/components/ReusableComponents/ActionButton';

interface Props {
    layeredAssistant: LayeredAssistant;
}

export const LayeredAssistantItem = ({ layeredAssistant }: Props) => {
    const {
        state: { layeredAssistants, prompts },
        dispatch: homeDispatch,
        setLoadingMessage,
        handleNewConversation,
    } = useContext(HomeContext);

    const [isHovered, setIsHovered] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isWaitingDelete, setIsWaitingDelete] = useState(false);

    const isGroupLA = isGroupLayeredAssistant(layeredAssistant);
    console.log(layeredAssistant.publicId, " - ", isGroupLA)

    /**
     * For group LAs: only show the assistants from that specific group.
     * For personal LAs: undefined → builder falls back to personal assistants.
     */
    const builderAssistants = useMemo<Prompt[] | undefined>(() => {
        if (!isGroupLA) return undefined;
        const gid = layeredAssistant.groupId;
        return prompts.filter((p: Prompt) => isAssistant(p) && p.groupId === gid);
    }, [isGroupLA, layeredAssistant.groupId, prompts]);

    const handleOpenDeleteConfirm: MouseEventHandler<HTMLButtonElement> = (e) => {
        e.stopPropagation();
        setIsDeleting(true);
    };

    const handleCancelDelete: MouseEventHandler<HTMLButtonElement> = (e) => {
        e.stopPropagation();
        setIsDeleting(false);
    };

    const handleConfirmDelete: MouseEventHandler<HTMLButtonElement> = async (e) => {
        e.stopPropagation();
        if (!layeredAssistant.publicId) {
            setIsDeleting(false);
            return;
        }
        setIsWaitingDelete(true);
        setLoadingMessage('Deleting layered assistant…');
        try {
            let result: any;
            if (isGroupLA && layeredAssistant.groupId) {
                result = await deleteGroupLayeredAssistant(
                    layeredAssistant.groupId,
                    layeredAssistant.publicId,
                );
            } else {
                result = await deleteLayeredAssistant(layeredAssistant.publicId);
            }

            if (result?.success) {
                homeDispatch({
                    field: 'layeredAssistants',
                    value: layeredAssistants.filter(
                        (x: LayeredAssistant) => x.publicId !== layeredAssistant.publicId,
                    ),
                });
            } else {
                alert('Failed to delete layered assistant. Please try again.');
            }
        } catch {
            alert('Failed to delete layered assistant. Please try again.');
        } finally {
            setLoadingMessage('');
            setIsWaitingDelete(false);
            setIsDeleting(false);
        }
    };

    const handleSelect = () => {
        if (!layeredAssistant.publicId) return;
        const syntheticAssistant: Assistant = {
            id: layeredAssistant.publicId,
            definition: {
                name: layeredAssistant.name,
                description: layeredAssistant.description,
                assistantId: layeredAssistant.publicId,
                instructions: '',
                tools: [],
                tags: [],
                fileKeys: [],
                dataSources: [],
                provider: AssistantProviderID.AMPLIFY,
                data: { isLayeredAssistant: true },
            },
        };
        handleNewConversation({ assistant: syntheticAssistant });
    };

    const handleOpenBuilder = () => {
        window.dispatchEvent(new CustomEvent('openLayeredBuilderTrigger', {
            detail: {
                isOpen: true,
                data: {
                    title: isGroupLA
                        ? `Layered Assistant Builder — ${layeredAssistant.groupId ?? 'Group'}`
                        : 'Layered Assistant Builder',
                    initialData: layeredAssistant,
                    assistants: builderAssistants,
                    onSave: handleSave,
                },
            },
        }));
    };

    const handleSave = async (la: LayeredAssistant) => {
        setLoadingMessage('Saving layered assistant…');
        try {
            let result: any;
            if (isGroupLA && la.groupId) {
                result = await saveGroupLayeredAssistant(la.groupId, la);
            } else {
                result = await saveLayeredAssistant(la);
            }

            if (result?.success && result.data?.publicId) {
                const saved: LayeredAssistant = { ...la, publicId: result.data.publicId };
                const updated = layeredAssistants.some(
                    (x: LayeredAssistant) => x.publicId === saved.publicId,
                )
                    ? layeredAssistants.map((x: LayeredAssistant) =>
                          x.publicId === saved.publicId ? saved : x,
                      )
                    : [...layeredAssistants, saved];
                homeDispatch({ field: 'layeredAssistants', value: updated });
            }
        } catch (e) {
            console.error('Failed to save layered assistant:', e);
        } finally {
            setLoadingMessage('');
        }
    };

    return (
        <div
            className="relative flex items-center"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
                setIsDeleting(false);
                setIsHovered(false);
            }}
        >
            <div className="relative flex w-full">
                <button
                    className="w-full cursor-pointer items-center gap-1 rounded-lg p-2 text-sm transition-colors duration-200 hover:bg-neutral-200 dark:hover:bg-[#343541]/90"
                    draggable={false}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleSelect();
                    }}
                    title={isGroupLA ? `Group layered assistant (${layeredAssistant.groupId})` : 'Chat with Layered Assistant'}
                >
                    <div className="relative flex items-center overflow-hidden text-left text-[12.5px] leading-3">
                        {/* Icon — purple branch for personal, teal users icon badge for group */}
                        <div className="pr-2 relative">
                            <IconGitBranch
                                size={18}
                                className={isGroupLA
                                    ? 'text-teal-500 dark:text-teal-400'
                                    : 'text-purple-500 dark:text-purple-400'
                                }
                            />
                        
                        </div>
                        <div className="overflow-hidden flex-1 text-ellipsis whitespace-nowrap break-all text-left text-[12.5px] leading-4">
                            {layeredAssistant.name || 'Untitled'}
                        </div>
                    </div>
                </button>

                {isHovered && (
                    <div className="absolute top-1 right-0 flex-shrink-0 flex flex-row items-center space-y-0 bg-neutral-200 dark:bg-[#343541]/90 rounded">
                        {!isDeleting && (
                            <ActionButton
                                handleClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenBuilder();
                                }}
                                title="Edit Layered Assistant"
                                id="editLayeredAssistant"
                            >
                                <IconEdit size={18} />
                            </ActionButton>
                        )}

                        {!isDeleting && (
                            <ActionButton
                                handleClick={(e) => {
                                    e.stopPropagation();
                                    // Share — stub for future implementation
                                }}
                                title="Share Layered Assistant"
                                id="shareLayeredAssistant"
                            >
                                <IconShare size={18} />
                            </ActionButton>
                        )}

                        {!isDeleting && (
                            <ActionButton
                                handleClick={handleOpenDeleteConfirm}
                                title="Delete Layered Assistant"
                                id="deleteLayeredAssistant"
                            >
                                <IconTrash size={18} />
                            </ActionButton>
                        )}

                        {isDeleting && (
                            <>
                                <ActionButton
                                    handleClick={handleConfirmDelete}
                                    title="Confirm Delete"
                                    id="confirmDeleteLayeredAssistant"
                                >
                                    {isWaitingDelete ? (
                                        <IconLoader2 size={18} className="animate-spin" />
                                    ) : (
                                        <IconCheck size={18} />
                                    )}
                                </ActionButton>
                                <ActionButton
                                    handleClick={handleCancelDelete}
                                    title="Cancel"
                                    id="cancelDeleteLayeredAssistant"
                                >
                                    <IconX size={18} />
                                </ActionButton>
                            </>
                        )}
                    </div>
                )}
            </div>

        </div>
    );
};
