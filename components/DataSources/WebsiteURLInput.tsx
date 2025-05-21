// components/DataSources/WebsiteURLInput.tsx
import React, { useState } from 'react';
import { IconWorld, IconSitemap } from '@tabler/icons-react';

interface WebsiteURLInputProps {
    onAddURL: (url: string, isSitemap: boolean) => void;
}

export const WebsiteURLInput: React.FC<WebsiteURLInputProps> = ({ onAddURL }) => {
    const [url, setUrl] = useState('');
    const [isSitemap, setIsSitemap] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (url.trim()) {
            onAddURL(url.trim(), isSitemap);
            setUrl('');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 mb-4">
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    id="enterWebsiteUrl"
                    placeholder="Enter website URL or sitemap URL"
                    className="flex-grow rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                />
                <button
                    type="submit"
                    id="addUrlButton"
                    className="rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100 dark:hover:bg-[#343541]"
                >
                    Add URL
                </button>
            </div>
            <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 cursor-pointer">
                    <input
                        type="checkbox"
                        id="siteMapCheck"
                        checked={isSitemap}
                        onChange={(e) => setIsSitemap(e.target.checked)}
                        className="rounded"
                    />
                    <span className="text-sm flex items-center gap-1">
                        <IconSitemap size={16} /> This is a sitemap URL
                    </span>
                </label>
            </div>
        </form>
    );
};