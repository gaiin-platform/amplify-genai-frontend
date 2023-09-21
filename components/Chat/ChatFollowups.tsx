// ChatFollowups.tsx
import React from 'react';

type ButtonConfig = {
    title: string,
    handler: () => void,
};

type ChatFollowupsProps = {
    buttonsConfig: ButtonConfig[],
};

const ChatFollowups: React.FC<ChatFollowupsProps> = ({buttonsConfig}) => {
    return (
        <div className="mt-4 flex gap-4">
            {buttonsConfig.map(({title, handler}) => (
                <button
                    key={title}
                    className="invisible group-hover:visible focus:visible px-5 py-2 text-sm border border-gray-600 rounded-lg text-gray-700 hover:bg-gray-100 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
                    onClick={handler}
                >
                    {title}
                </button>
            ))}
        </div>
    )
};

export default ChatFollowups;