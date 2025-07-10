// components/DataSources/WebsiteURLInput.tsx
import React, { useState } from 'react';
import { IconSitemap } from '@tabler/icons-react';
import Checkbox from '../ReusableComponents/CheckBox';
import { AttachedDocument } from '@/types/attacheddocument';

export const isWebsiteDs = (document: AttachedDocument) => {
    return ['website/url', 'website/sitemap'].includes(document.type);
}

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
                    placeholder="Enter website URL or sitemap URL"
                    className="flex-grow rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                />
                <button
                    type="submit"
                    className="rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100 dark:hover:bg-[#343541]"
                >
                    Add URL
                </button>
            </div>
            <div className="flex items-center gap-2">
                <Checkbox
                    id="sitemap-checkbox"
                    label="This is a sitemap URL"
                    checked={isSitemap}
                    onChange={setIsSitemap}
                />
               <IconSitemap className="-mt-1 -ml-1" size={16} />
            </div>
        </form>
    );
};