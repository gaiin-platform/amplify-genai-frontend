import React, { FC, useContext, useEffect, useRef, useState } from 'react';
import HomeContext from '@/pages/api/home/home.context';

interface Props {
    open: boolean;
    onClose: () => void;
}

export const AdminUI: FC<Props> = ({ open, onClose }) => {
    const { state: { featureFlags }, dispatch: homeDispatch } = useContext(HomeContext);
    const [activeTab, setActiveTab] = useState('default');
    const [activeSubTab, setActiveSubTab] = useState('conversations');
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
                window.addEventListener('mouseup', handleMouseUp);
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            window.removeEventListener('mouseup', handleMouseUp);
            onClose();
        };

        window.addEventListener('mousedown', handleMouseDown);

        return () => {
            window.removeEventListener('mousedown', handleMouseDown);
        };
    }, [onClose]);

    if (!open) {
        return null;
    }

    const renderSubTabs = () => (
        <div className="flex space-x-4 mb-4">
            <button className={`px-4 py-2 ${activeSubTab === 'conversations' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black dark:bg-gray-600 dark:text-white'}`} onClick={() => setActiveSubTab('conversations')}>Conversations</button>
            <button className={`px-4 py-2 ${activeSubTab === 'dashboard' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black dark:bg-gray-600 dark:text-white'}`} onClick={() => setActiveSubTab('dashboard')}>Dashboard</button>
            <button className={`px-4 py-2 ${activeSubTab === 'assistant' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black dark:bg-gray-600 dark:text-white'}`} onClick={() => setActiveSubTab('assistant')}>Edit Assistant</button>
            <button className={`px-4 py-2 ${activeSubTab === 'group' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black dark:bg-gray-600 dark:text-white'}`} onClick={() => setActiveSubTab('group')}>Edit Group</button>
        </div>
    );

    const renderContent = () => {
        switch (activeSubTab) {
            case 'conversations':
                return <div className="text-black dark:text-white">Conversations List</div>;
            case 'dashboard':
                return <div className="text-black dark:text-white">Dashboard Content</div>;
            case 'assistant':
                return <div className="text-black dark:text-white">Edit Assistant Content</div>;
            case 'group':
                return <div className="text-black dark:text-white">Edit Group Content</div>;
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
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
                        <div className="text-lg pb-4 font-bold text-black dark:text-neutral-200">
                            Admin UI
                        </div>

                        <div className="flex space-x-4 mb-4">
                            <button className={`px-4 py-2 ${activeTab === 'default' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black dark:bg-gray-600 dark:text-white'}`} onClick={() => setActiveTab('default')}>Default</button>
                            {/* Add more primary tabs here in the future */}
                        </div>

                        {renderSubTabs()}
                        {renderContent()}

                        <button
                            type="button"
                            className="w-full px-4 py-2 mt-6 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                            onClick={onClose}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};