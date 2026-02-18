import React, { FC, useMemo, useState } from 'react';
import { IconFileText, IconCheck, IconWorld, IconSitemap, IconX } from '@tabler/icons-react';
import { AttachedDocument } from '@/types/attacheddocument';
import { Conversation } from '@/types/chat';
import { Checkbox } from '@/components/ReusableComponents/CheckBox';

interface Props {
    conversation: Conversation | null;
    onUpdateRemovedDocuments: (removedDocIds: string[]) => void;
    onClose: () => void;
}

export const ConversationContextManager: FC<Props> = ({
    conversation,
    onUpdateRemovedDocuments,
    onClose
}) => {
    // Extract all unique documents from conversation messages
    const allDocuments = useMemo(() => {
        if (!conversation || !conversation.messages) return [];

        const docMap = new Map<string, AttachedDocument>();

        conversation.messages.forEach((message) => {
            if (message.data?.dataSources) {
                message.data.dataSources.forEach((ds: AttachedDocument) => {
                    if (!docMap.has(ds.id)) {
                        docMap.set(ds.id, ds);
                    }
                });
            }
        });

        return Array.from(docMap.values());
    }, [conversation]);

    // Initialize local state with current removed documents
    const [localRemovedDocIds, setLocalRemovedDocIds] = useState<Set<string>>(
        new Set(conversation?.removedDocumentIds || [])
    );

    const handleToggleDocument = (docId: string) => {
        const newSet = new Set(localRemovedDocIds);
        if (newSet.has(docId)) {
            newSet.delete(docId);
        } else {
            newSet.add(docId);
        }
        setLocalRemovedDocIds(newSet);
        onUpdateRemovedDocuments(Array.from(newSet));
    };

    const getDocumentIcon = (doc: AttachedDocument) => {
        switch (doc.type) {
            case 'website/sitemap':
                return <IconSitemap className="text-blue-500" size={18} />;
            case 'website/url':
                return <IconWorld className="text-blue-500" size={18} />;
            default:
                return <IconFileText className="text-gray-500" size={18} />;
        }
    };

    const getDocumentLabel = (doc: AttachedDocument) => {
        if (!doc.name) return 'Untitled Document';
        return doc.name.length > 50 ? doc.name.slice(0, 50) + '...' : doc.name;
    };

    if (allDocuments.length === 0) {
        return (
            <div className="md:flex rounded-t-xl border dark:border-[#454652] bg-[#e5e7eb] dark:bg-[#343541]">
                <div className="p-6 w-full">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                            Conversation Context
                        </h3>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            title="Close"
                        >
                            <IconX size={20} />
                        </button>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 text-center py-8">
                        No documents have been attached to this conversation yet.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="md:flex rounded-t-xl border dark:border-[#454652] bg-[#e5e7eb] dark:bg-[#343541]">
            <div className="p-0 bg-[#ffffff] text-medium text-gray-500 dark:text-gray-400 dark:bg-[#343541] rounded-lg w-full" style={{ minWidth: '500px', minHeight: '400px' }}>
                <div className="p-4">
                    <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                        Conversation Context
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        title="Close"
                    >
                        <IconX size={20} />
                    </button>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Select which documents should be included in the conversation context.
                    Unchecked documents will not be sent to the AI.
                </p>

                <div className="overflow-y-auto" style={{ maxHeight: '240px' }}>
                    <div className="space-y-2">
                        {allDocuments.map((doc) => {
                            const isEnabled = !localRemovedDocIds.has(doc.id);

                            return (
                                <div
                                    key={doc.id}
                                    className={`
                                        flex items-center p-3 rounded-lg border
                                        ${isEnabled
                                            ? 'bg-white dark:bg-[#40414F] border-gray-200 dark:border-gray-600'
                                            : 'bg-gray-100 dark:bg-[#2A2B32] border-gray-300 dark:border-gray-700 opacity-60'
                                        }
                                        hover:border-blue-300 dark:hover:border-blue-600 transition-colors
                                    `}
                                >
                                    <div className="mr-3">
                                        <Checkbox
                                            id={`doc-checkbox-${doc.id}`}
                                            label=""
                                            checked={isEnabled}
                                            onChange={() => handleToggleDocument(doc.id)}
                                        />
                                    </div>

                                    <div className="mr-3">
                                        {getDocumentIcon(doc)}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className={`
                                                text-sm font-medium truncate
                                                ${isEnabled
                                                    ? 'text-gray-800 dark:text-gray-200'
                                                    : 'text-gray-500 dark:text-gray-500'
                                                }
                                            `}>
                                                {getDocumentLabel(doc)}
                                            </p>
                                            {isEnabled && (
                                                <IconCheck className="text-green-500 flex-shrink-0" size={16} />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-4 pt-3 pb-2 border-t border-gray-300 dark:border-gray-600">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                            {allDocuments.length - localRemovedDocIds.size} of {allDocuments.length} documents active
                        </span>
                        <button
                            onClick={() => {
                                const allDocIds = allDocuments.map(d => d.id);
                                if (localRemovedDocIds.size === allDocuments.length) {
                                    // Re-enable all
                                    setLocalRemovedDocIds(new Set());
                                    onUpdateRemovedDocuments([]);
                                } else {
                                    // Disable all
                                    setLocalRemovedDocIds(new Set(allDocIds));
                                    onUpdateRemovedDocuments(allDocIds);
                                }
                            }}
                            className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                        >
                            {localRemovedDocIds.size === allDocuments.length ? 'Enable All' : 'Disable All'}
                        </button>
                    </div>
                </div>
                </div>
            </div>
        </div>
    );
};
