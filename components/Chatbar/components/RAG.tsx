import { IconBook } from '@tabler/icons-react';
import { KeyboardEvent, useContext, useEffect, useRef, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { SidebarButton } from '@/components/Sidebar/SidebarButton';
import React from 'react';

export const RAG = () => {
    const { t } = useTranslation('sidebar');
    const [isChanging, setIsChanging] = useState(false);
    
    const [prompt, setPrompt] = useState<string>('');
    const [selectedOption, setSelectedOption] = useState<string>('yes');
    const [file, setFile] = useState<File | null>(null);

    const modalRef = useRef<HTMLDivElement>(null);

    const handleEnter = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            setIsChanging(false);
        }
    };

    const handleRAG = () => {
        // TODO: Implement logic for handling RAG based on the user's input, option, and file
        console.log('Running RAG with:', prompt, selectedOption, file);
    };

    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
                window.addEventListener('mouseup', handleMouseUp);
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            window.removeEventListener('mouseup', handleMouseUp);
            setIsChanging(false);
        };

        window.addEventListener('mousedown', handleMouseDown);

        return () => {
            window.removeEventListener('mousedown', handleMouseDown);
        };
    }, []);

    return (
        <>
            <SidebarButton
                text={t('Retrieval')}
                icon={<IconBook size={18} />}
                onClick={() => setIsChanging(true)}
            />

            {isChanging && (
                <div
                    className="z-100 fixed inset-0 flex items-center justify-center bg-black bg-opacity-50"
                    onKeyDown={handleEnter}
                >
                    <div className="fixed inset-0 z-10 overflow-hidden">
                        <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div
                                className="hidden sm:inline-block sm:h-screen sm:align-middle"
                                aria-hidden="true"
                            />

                            <div
                                ref={modalRef}
                                className="dark:border-neutral-600 inline-block max-h-[400px] transform overflow-y-auto rounded-lg border border-gray-300 bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all dark:bg-[#202123] sm:my-8 sm:max-h-[600px] sm:w-full sm:max-w-lg sm:p-6 sm:align-middle"
                                role="dialog"
                            >
                                <div className="mb-10 text-4xl">Retrieval</div>

                                <div className="mt-6 rounded border p-4">
                                    <div className="text-xl font-bold">Retrieval Input</div>
                                    <div className="mt-4 italic">
                                        Please enter your prompt, select if you has a dedicated GPU, and upload your file.
                                    </div>

                                    <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
                                        Prompt
                                    </div>
                                    <textarea
                                        className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        rows={3}
                                    />

                                    <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
                                        Does your local machine have a dedicated GPU?
                                    </div>
                                    <div className="mt-2 flex space-x-4">
                                        <label>
                                            <input
                                                type="radio"
                                                value="yes"
                                                checked={selectedOption === 'yes'}
                                                onChange={() => setSelectedOption('yes')}
                                            />
                                            Yes
                                        </label>
                                        <label>
                                            <input
                                                type="radio"
                                                value="no"
                                                checked={selectedOption === 'no'}
                                                onChange={() => setSelectedOption('no')}
                                            />
                                            No
                                        </label>
                                    </div>

                                    <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
                                        Upload File
                                    </div>
                                    <input
                                        className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                        type="file"
                                        onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                                    />
                                </div>

                                <button
                                    type="button"
                                    className="mt-6 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                                    onClick={handleRAG}
                                >
                                    Run
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
