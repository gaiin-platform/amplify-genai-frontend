import { FC, useContext } from 'react';
import { IconUsers } from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';

export interface GroupAssistantsButtonProps {}

export const GroupAssistantsButton: FC<GroupAssistantsButtonProps> = () => {
    const {
        dispatch: homeDispatch,
    } = useContext(HomeContext);


    return (
        <button
            onClick={() => homeDispatch({ field: 'page', value: 'assistantGallery' })}
            className="enhanced-add-button w-full flex items-center gap-2 rounded-lg text-sm"
            title="View all group assistants"
        >
            <IconUsers size={18} className="text-purple-500 flex-shrink-0" />
            <span className="sidebar-text font-medium truncate text-gray-700 dark:text-gray-300">
                Assistant Gallery
            </span>
        </button>
    );
};
