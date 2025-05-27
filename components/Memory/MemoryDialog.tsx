import { FC, useState, useEffect, useContext } from 'react';
import { useSession } from "next-auth/react";
import { useRouter } from 'next/router';
import { Modal } from '../ReusableComponents/Modal';
import { doReadMemoryOp, doEditMemoryOp, doRemoveMemoryOp } from '../../services/memoryService';
import HomeContext from '@/pages/api/home/home.context';
import { Toggle } from '@/components/ReusableComponents/Toggle';
import MemoryTreeView from './MemoryTreeView';
import {
    Memory,
    MemoryType,
    MemoryDialogProps
} from '@/types/memory';

const LoadingSpinner = () => (
    <div className="flex justify-center py-4">
        <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    </div>
);

export const MemoryDialog: FC<MemoryDialogProps> = ({ open, onClose }) => {
    const router = useRouter();
    const {
        state: { memoryExtractionEnabled, conversations },
        dispatch: homeDispatch,
        handleSelectConversation
    } = useContext(HomeContext);

    const [memories, setMemories] = useState<Memory[]>([]);
    const [isMemoriesLoading, setIsMemoriesLoading] = useState(false);
    const [editingMemory, setEditingMemory] = useState<{ id: string, content: string } | null>(null);
    const [processingMemoryId, setProcessingMemoryId] = useState<string | null>(null);

    const { data: session } = useSession();
    const userEmail = session?.user?.email;

    const handleToggleMemoryExtraction = (enabled: boolean) => {
        homeDispatch({
            field: 'memoryExtractionEnabled',
            value: enabled
        });
    };

    const handleViewConversation = async (conversationId: string) => {
        // Find the conversation in the state
        const conversation = conversations.find(conv => conv.id === conversationId);

        if (conversation) {
            // Close the memory dialog first
            onClose();

            // Use handleSelectConversation to properly load and open the conversation
            await handleSelectConversation(conversation);
        } else {
            console.error('Conversation not found:', conversationId);
            alert('Unable to find the associated conversation');
        }
    };

    const loadMemories = async () => {
        if (!userEmail || !open) return;

        setIsMemoriesLoading(true);
        try {
            const userResponse = await doReadMemoryOp({});
            if (userResponse.statusCode === 200) {
                const body = JSON.parse(userResponse.body);
                const userMemories = body.memories.filter(
                    (memory: Memory) => memory.memory_type === 'user' as MemoryType
                );
                setMemories(userMemories);
            }
        } catch (error) {
            console.error('Error loading memories');
            setMemories([]);
        } finally {
            setIsMemoriesLoading(false);
        }
    };

    useEffect(() => {
        if (open && userEmail) {
            loadMemories();
        }
    }, [open, userEmail]);

    const handleEdit = (memory: Memory) => {
        setEditingMemory({
            id: memory.id,
            content: memory.content
        });
    };

    const handleSaveEdit = async () => {
        if (!editingMemory) return;
        setProcessingMemoryId(editingMemory.id);
        try {
            const response = await doEditMemoryOp(editingMemory.id, editingMemory.content);
            if (response.statusCode === 200) {
                await loadMemories();
            }
        } catch (error) {
            console.error('Error editing memory');
        } finally {
            setProcessingMemoryId(null);
            setEditingMemory(null);
        }
    };

    const handleCancelEdit = () => {
        setEditingMemory(null);
    };

    const handleDelete = async (memoryId: string) => {
        if (window.confirm('Are you sure you want to delete this memory?')) {
            setProcessingMemoryId(memoryId);
            try {
                const response = await doRemoveMemoryOp(memoryId);
                if (response.statusCode === 200) {
                    await loadMemories();
                }
            } catch (error) {
                console.error('Error deleting memory');
            } finally {
                setProcessingMemoryId(null);
            }
        }
    };

    if (!open) return null;

    return (
        <Modal
            title="Memory Management"
            onSubmit={onClose}
            onCancel={onClose}
            submitLabel="Close"
            showCancel={false}
            content={
                <div className="flex h-full">
                    <div className="w-48 border-r dark:border-neutral-700">
                        <button className="w-full text-left px-4 py-2 bg-gray-200 dark:bg-neutral-600">
                            User
                        </button>
                        <div className="p-4 border-t dark:border-neutral-700">
                            <Toggle
                                label="Auto-extract new memories"
                                enabled={memoryExtractionEnabled}
                                onChange={handleToggleMemoryExtraction}
                                size="small"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto">
                        {isMemoriesLoading ? (
                            <LoadingSpinner />
                        ) : memories.length === 0 ? (
                            <div className="text-center py-4">No memories found</div>
                        ) : (
                            <>
                                {editingMemory ? (
                                    <div className="p-4">
                                        <textarea
                                            className="w-full p-2 border rounded dark:bg-neutral-800 dark:border-neutral-600"
                                            value={editingMemory.content}
                                            onChange={(e) => setEditingMemory({
                                                ...editingMemory,
                                                content: e.target.value
                                            })}
                                            rows={4}
                                        />
                                        <div className="mt-2 flex justify-end space-x-2">
                                            <button
                                                onClick={handleCancelEdit}
                                                className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded"
                                                disabled={!!processingMemoryId}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleSaveEdit}
                                                className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center space-x-2"
                                                disabled={!!processingMemoryId}
                                            >
                                                {processingMemoryId === editingMemory?.id ? (
                                                    <>
                                                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        <span>Saving...</span>
                                                    </>
                                                ) : (
                                                    <span>Save</span>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <MemoryTreeView
                                        memories={memories}
                                        onEditMemory={handleEdit}
                                        onDeleteMemory={handleDelete}
                                        onViewConversation={handleViewConversation}
                                        processingMemoryId={processingMemoryId}
                                    />
                                )}
                            </>
                        )}
                    </div>
                </div>
            }
        />
    );
};