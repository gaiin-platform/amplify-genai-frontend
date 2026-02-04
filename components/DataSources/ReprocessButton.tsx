import React from 'react';
import { IconReload } from '@tabler/icons-react';
import ActionButton from '../ReusableComponents/ActionButton';
import { MASSIVE_DOCUMENT_TOKEN_THRESHOLD } from '@/utils/app/const';


interface ReprocessButtonProps {
    fileId: string;
    metadata?: { totalTokens?: number; [key: string]: any };
    onReprocess: (fileId: string) => void;
    status?: string;
    forceShow?: boolean; // Backdoor to force show button
}

/**
 * Reusable button component for reprocessing/re-embedding files.
 * Automatically hides for massive documents (400K+ tokens) that cannot be re-embedded.
 *
 * For "not_found" status (-----):
 * - Shows button if totalTokens exists (RAG was off, but file processed successfully)
 * - Hides button if no totalTokens (something went wrong, unlikely to reprocess)
 * - Can be forced to show via forceShow prop (backdoor feature)
 */
export const ReprocessButton: React.FC<ReprocessButtonProps> = ({
    fileId,
    metadata,
    onReprocess,
    status,
    forceShow = false
}) => {
    const totalTokens = metadata?.totalTokens || 0;

    console.log(`[REPROCESS BTN] ${fileId}: status=${status}, totalTokens=${totalTokens}, forceShow=${forceShow}`);

    // Hide button for massive documents - they can't be re-embedded
    if (totalTokens >= MASSIVE_DOCUMENT_TOKEN_THRESHOLD) {
        console.log(`[REPROCESS BTN] ${fileId}: Hiding - massive document (${totalTokens} tokens)`);
        return null;
    }

    // Special logic for "not_found" status (displayed as "-----")
    // This happens when RAG was disabled or file failed processing
    if (status === 'not_found' && !forceShow) {
        // If no totalTokens, file likely failed - don't show reprocess button
        if (!totalTokens || totalTokens === 0) {
            console.log(`[REPROCESS BTN] ${fileId}: Hiding - not_found with no tokens and forceShow=${forceShow}`);
            return null;
        }
        console.log(`[REPROCESS BTN] ${fileId}: Showing - not_found but has tokens (${totalTokens})`);
    }

    if (status === 'not_found' && forceShow) {
        console.log(`[REPROCESS BTN] ${fileId}: Showing - forceShow=true (backdoor activated)`);
    }

    console.log(`[REPROCESS BTN] ${fileId}: RENDERING button`);

    return (
        <ActionButton
            title='Regenerate text extraction and embeddings for this file.'
            handleClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (confirm("Are you sure you want to regenerate the text extraction and embeddings for this file?")) {
                    onReprocess(fileId);
                }
            }}
        >
            <IconReload size={16} />
        </ActionButton>
    );
};

export default ReprocessButton;
