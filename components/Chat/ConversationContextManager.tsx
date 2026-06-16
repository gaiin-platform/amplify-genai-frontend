import React, { FC, useMemo, useState } from 'react';
import { IconFileText, IconCheck, IconWorld, IconSitemap } from '@tabler/icons-react';
import { AttachedDocument } from '@/types/attacheddocument';
import { Conversation, ConversationContextEntry } from '@/types/chat';
import { Checkbox } from '@/components/ReusableComponents/CheckBox';
import { FolderInterface } from '@/types/folder';
import { ActiveTabs, Tabs } from '@/components/ReusableComponents/ActiveTabs';
import { ConversationsContextTab } from '@/components/Chat/ConversationsContextTab';

interface Props {
    conversation: Conversation | undefined;
    allConversations: Conversation[];
    folders: FolderInterface[];
    onUpdateRemovedDocuments: (removedDocIds: string[]) => void;
    onUpdateContextConversations: (entries: ConversationContextEntry[]) => void;
    onClose: () => void;
}

// ── Datasources tab content ───────────────────────────────────────────────────

interface DatasourcesTabProps {
    conversation: Conversation | undefined;
    onUpdateRemovedDocuments: (removedDocIds: string[]) => void;
}

const DatasourcesTab: FC<DatasourcesTabProps> = ({ conversation, onUpdateRemovedDocuments }) => {
    const allDocuments = useMemo(() => {
        if (!conversation || !conversation.messages) return [];
        const docMap = new Map<string, AttachedDocument>();
        conversation.messages.forEach((message) => {
            if (message.data?.dataSources) {
                message.data.dataSources.forEach((ds: AttachedDocument) => {
                    if (!docMap.has(ds.id)) docMap.set(ds.id, ds);
                });
            }
        });
        return Array.from(docMap.values());
    }, [conversation]);

    const [localRemovedDocIds, setLocalRemovedDocIds] = useState<Set<string>>(
        new Set(conversation?.removedDocumentIds || []),
    );

    const handleToggleDocument = (docId: string) => {
        const newSet = new Set(localRemovedDocIds);
        newSet.has(docId) ? newSet.delete(docId) : newSet.add(docId);
        setLocalRemovedDocIds(newSet);
        onUpdateRemovedDocuments(Array.from(newSet));
    };

    const getDocumentIcon = (doc: AttachedDocument) => {
        switch (doc.type) {
            case 'website/sitemap': return <IconSitemap className="text-blue-500" size={18} />;
            case 'website/url':    return <IconWorld className="text-blue-500" size={18} />;
            default:               return <IconFileText className="text-gray-500" size={18} />;
        }
    };

    const getDocumentLabel = (doc: AttachedDocument) =>
        !doc.name ? 'Untitled Document'
            : doc.name.length > 55 ? doc.name.slice(0, 55) + '...' : doc.name;

    if (allDocuments.length === 0) {
        return (
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center py-8">
                No documents have been attached to this conversation yet.
            </p>
        );
    }

    return (
        <div className="flex flex-col">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Select which documents should be included in the conversation context.
                Unchecked documents will not be sent to the AI.
            </p>

            <div className="overflow-y-auto" style={{ maxHeight: '300px' }}>
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
                                        : 'bg-gray-100 dark:bg-[#2A2B32] border-gray-300 dark:border-gray-700 opacity-60'}
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
                                <div className="mr-3">{getDocumentIcon(doc)}</div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className={`text-sm font-medium truncate ${isEnabled ? 'text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-gray-500'}`}>
                                            {getDocumentLabel(doc)}
                                        </p>
                                        {isEnabled && <IconCheck className="text-green-500 flex-shrink-0" size={16} />}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="mt-4 pt-3 pb-1 border-t border-gray-300 dark:border-gray-600">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                        {allDocuments.length - localRemovedDocIds.size} of {allDocuments.length} documents active
                    </span>
                    <button
                        onClick={() => {
                            const allDocIds = allDocuments.map(d => d.id);
                            if (localRemovedDocIds.size === allDocuments.length) {
                                setLocalRemovedDocIds(new Set());
                                onUpdateRemovedDocuments([]);
                            } else {
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
    );
};

// ── Main component ────────────────────────────────────────────────────────────

export const ConversationContextManager: FC<Props> = ({
    conversation,
    allConversations,
    folders,
    onUpdateRemovedDocuments,
    onUpdateContextConversations,
    onClose,
}) => {
    const hasDocuments = useMemo(() => {
        if (!conversation?.messages) return false;
        for (const msg of conversation.messages) {
            if (msg.data?.dataSources?.length > 0) return true;
        }
        return false;
    }, [conversation]);

    const tabs: Tabs[] = [
        ...(hasDocuments ? [{
            label: 'Datasources',
            content: (
                <DatasourcesTab
                    conversation={conversation}
                    onUpdateRemovedDocuments={onUpdateRemovedDocuments}
                />
            ),
        }] : []),
        {
            label: 'Conversations',
            content: (
                <ConversationsContextTab
                    currentConversationId={conversation?.id ?? ''}
                    allConversations={allConversations}
                    folders={folders}
                    contextEntries={conversation?.contextConversations ?? []}
                    onEntriesChange={onUpdateContextConversations}
                />
            ),
        },
    ];

    return (
        <div className="rounded-t-xl border dark:border-[#454652] bg-[#e5e7eb] dark:bg-[#343541]"
             style={{ width: '640px', minHeight: '420px', overflow: 'hidden' }}>

            {/* ── Header ── */}
            <div className="flex items-center justify-center text-center px-4 pt-3 pb-0">
                <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
                    Conversation Context
                </h3>
            </div>

            <ActiveTabs
                id="conversation-context-tabs"
                tabs={tabs}
                depth={0}
                onClose={onClose}
            />
        </div>
    );
};
