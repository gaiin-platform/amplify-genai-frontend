import { FC, useState, KeyboardEvent } from 'react';
import { IconSearch, IconX } from '@tabler/icons-react';
import { Modal } from '../ReusableComponents/Modal';

interface Props {
    onSubmit: (query: string) => void;
    onClose: () => void;
    initialQuery?: string;
}

export const SerpApiModal: FC<Props> = ({
    onSubmit,
    onClose,
    initialQuery = ''
}) => {
    const [query, setQuery] = useState(initialQuery);

    const handleSubmit = () => {
        if (query.trim()) {
            onSubmit(query.trim());
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        }
    };

    const modalContent = (
        <div>
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Enter your search query
                </label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <IconSearch size={18} className="text-gray-400" />
                    </div>
                    <input
                        type="text"
                        className="w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                        placeholder="e.g., What is the latest news on AI?"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoFocus
                    />
                    {query && (
                        <button
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            onClick={() => setQuery('')}
                        >
                            <IconX size={18} />
                        </button>
                    )}
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Search results will be included in your prompt to provide context
                </p>
            </div>
        </div>
    );

    return (
        <Modal
            title="Google Search Query"
            content={modalContent}
            onCancel={onClose}
            onSubmit={handleSubmit}
            showCancel={true}
            showSubmit={true}
            cancelLabel="Cancel"
            submitLabel="Search"
            disableSubmit={!query.trim()}
            width={() => Math.min(500, window.innerWidth * 0.9)}
            height={() => 300}
        />
    );
};
