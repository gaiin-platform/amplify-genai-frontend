import { FC, KeyboardEvent, useEffect, useRef, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { Prompt } from '@/types/prompt';

interface Props {
    prompt: Prompt;
    onClose: () => void;
    onSharePrompt: (prompt: Prompt) => void;
}

export const ShareModal: FC<Props> = ({ prompt, onClose, onSharePrompt }) => {
    const { t } = useTranslation('promptbar');
    const [name, setName] = useState(prompt.name);
    const [description, setDescription] = useState(prompt.description);
    const [content, setContent] = useState(prompt.content);

    const modalRef = useRef<HTMLDivElement>(null);

    const handleEnter = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            //onUpdatePrompt({ ...prompt, name, description, content: content.trim() });
            onClose();
        }
    };

    return (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
            onKeyDown={handleEnter}
        >
            <div className="fixed inset-0 z-10 overflow-hidden">
                <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                    <div
                        className="hidden sm:inline-block sm:h-screen sm:align-middle"
                        aria-hidden="true"
                    />

                    <div
                        ref={modalRef}
                        className="dark:border-netural-400 inline-block max-h-[400px] transform overflow-y-auto rounded-lg border border-gray-300 bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all dark:bg-[#202123] sm:my-8 sm:max-h-[600px] sm:w-full sm:max-w-lg sm:p-6 sm:align-middle"
                        role="dialog"
                    >
                        <div className="text-sm font-bold text-black dark:text-neutral-200">
                            Name
                        </div>
                        <div className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100">
                            {prompt.name}
                        </div>

                        <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
                            Description
                        </div>
                        <div className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100" >
                            {prompt.description}
                        </div>

                        <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
                            Prompt
                        </div>
                        <div className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100" >
                            {prompt.content}
                        </div>

                        <button
                            type="button"
                            className="w-full px-4 py-2 mt-6 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                            onClick={() => {
                                // const updatedPrompt = {
                                //     ...prompt,
                                //     name,
                                //     description,
                                //     content: content.trim(),
                                // };

                                //onUpdatePrompt(updatedPrompt);
                                onClose();
                            }}
                        >
                            {t('Close')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
