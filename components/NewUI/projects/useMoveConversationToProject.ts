import { useCallback, useContext } from 'react';
import toast from 'react-hot-toast';
import HomeContext from '@/pages/api/home/home.context';
import { Conversation } from '@/types/chat';

/**
 * Attach a chat to a project, move it to another, or detach it (projectId = null).
 * The list updates optimistically so labels and filters react immediately, then
 * the change is persisted through the same path as rename/pin (which also
 * re-uploads cloud-stored chats).
 */
export function useMoveConversationToProject() {
    const { state: { conversations }, dispatch, handleUpdateConversation } = useContext(HomeContext);

    return useCallback(async (conversation: Conversation, projectId: string | null, projectName?: string) => {
        const next = projectId ?? undefined;
        dispatch({
            field: 'conversations',
            value: (conversations as Conversation[]).map((c) => (c.id === conversation.id ? { ...c, projectId: next } : c)),
        });
        try {
            await handleUpdateConversation(conversation, { key: 'projectId', value: next });
            toast.success(projectId ? `Moved to ${projectName || 'project'}.` : 'Removed from project.');
        } catch (e) {
            console.error('Failed to move conversation', e);
            dispatch({
                field: 'conversations',
                value: (conversations as Conversation[]).map((c) => (c.id === conversation.id ? { ...c, projectId: conversation.projectId } : c)),
            });
            toast.error('Could not update the chat. Try again.');
        }
    }, [conversations, dispatch, handleUpdateConversation]);
}
