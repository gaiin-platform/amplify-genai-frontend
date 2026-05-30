import { FC, useContext } from 'react';
import { IconGitBranch } from '@tabler/icons-react';
import { LayeredAssistant } from '@/types/layeredAssistant';
import HomeContext from '@/pages/api/home/home.context';
import { saveLayeredAssistant } from '@/services/assistantService';

export const LayeredAssistantButton: FC = () => {
    const {
        state: { layeredAssistants },
        dispatch: homeDispatch,
    } = useContext(HomeContext);

    const handleSave = async (la: LayeredAssistant) => {
        try {
            const result = await saveLayeredAssistant(la);
            if (result?.success && result.data?.assistantId) {
                const saved: LayeredAssistant = { ...la, assistantId: result.data.assistantId };
                const updated = layeredAssistants.some(x => x.assistantId === saved.assistantId)
                    ? layeredAssistants.map(x => x.assistantId === saved.assistantId ? saved : x)
                    : [...layeredAssistants, saved];
                homeDispatch({ field: 'layeredAssistants', value: updated });
            }
        } catch (e) {
            console.error('Failed to save layered assistant:', e);
        }
    };

    const handleOpen = () => {
        window.dispatchEvent(new CustomEvent('openLayeredBuilderTrigger', {
            detail: {
                isOpen: true,
                data: {
                    title: 'Layered Assistant Builder',
                    onSave: handleSave,
                },
            },
        }));
    };

    return (
        <button
            onClick={handleOpen}
            className="mt-3 enhanced-add-button w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-neutral-200 dark:hover:bg-[#343541]/90"
            title="Create a layered assistant with intelligent routing"
        >
            <IconGitBranch size={18} className="text-blue-500 flex-shrink-0" />
            <span className="sidebar-text font-medium truncate text-gray-700 dark:text-gray-300">
                Layered Assistants
            </span>
        </button>
    );
};
