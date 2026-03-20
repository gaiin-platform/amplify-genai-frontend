import React, { useState } from 'react';
import { IconDatabase } from '@tabler/icons-react';
import { createBedrockKbDatasource, validateKbId } from '@/utils/app/bedrockKb';
import { AttachedDocument } from '@/types/attacheddocument';

interface BedrockKBInputProps {
    existingKbIds: string[];
    onAdd: (datasource: AttachedDocument) => void;
}

export const BedrockKBInput: React.FC<BedrockKBInputProps> = ({ existingKbIds, onAdd }) => {
    const [kbId, setKbId] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const trimmedId = kbId.trim().toUpperCase();
        const validation = validateKbId(trimmedId);
        if (!validation.valid) {
            setError(validation.error || 'Invalid Knowledge Base ID.');
            return;
        }

        if (existingKbIds.includes(trimmedId)) {
            setError('This Knowledge Base is already added.');
            return;
        }

        const ds = createBedrockKbDatasource(trimmedId, displayName.trim() || undefined);
        onAdd(ds);
        setKbId('');
        setDisplayName('');
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 mb-4">
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={kbId}
                    onChange={(e) => { setKbId(e.target.value); if (error) setError(null); }}
                    placeholder="Knowledge Base ID (e.g. ABCDEFGHIJ)"
                    className="flex-grow rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                />
                <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Display name (optional)"
                    className="w-[200px] rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                />
                <button
                    type="submit"
                    className="rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100 dark:hover:bg-[#343541] flex items-center gap-2"
                >
                    <IconDatabase size={16} />
                    Add KB
                </button>
            </div>
            {error && (
                <p className="text-red-500 text-sm ml-1">{error}</p>
            )}
        </form>
    );
};
