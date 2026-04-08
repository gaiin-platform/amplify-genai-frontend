import React, { FC, useEffect, useMemo, useState } from 'react';
import {
    IconCloud,
    IconDeviceFloppy,
    IconMessage,
    IconRefresh,
    IconFolder,
    IconChevronDown,
    IconChevronRight,
    IconX,
    IconAlertTriangle,
    IconLoader2,
    IconCheck,
} from '@tabler/icons-react';
import { Conversation, ConversationContextEntry } from '@/types/chat';
import { Checkbox } from '@/components/ReusableComponents/CheckBox';
import { FolderInterface } from '@/types/folder';
import { isLocalConversation } from '@/utils/app/conversation';
import { LoadedConvState, useConversationContextLoader } from '@/hooks/useConversationContextLoader';
import { CachedConversationMessage } from '@/utils/app/storage';

interface Props {
    currentConversationId: string;
    allConversations: Conversation[];
    folders: FolderInterface[];
    contextEntries: ConversationContextEntry[];
    onEntriesChange: (entries: ConversationContextEntry[]) => void;
}

interface FolderGroup {
    folderId: string | null;
    folderName: string;
    conversations: Conversation[];
}

export const ConversationsContextTab: FC<Props> = ({
    currentConversationId,
    allConversations,
    folders,
    contextEntries,
    onEntriesChange,
}) => {
    const { loadedStates, loadConversation, preloadFromCacheOrLocal } = useConversationContextLoader();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedConvIds, setExpandedConvIds] = useState<Set<string>>(new Set());
    const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string | null>>(new Set());

    // Available conversations (exclude current)
    const availableConversations = useMemo(
        () => allConversations.filter(c => c.id !== currentConversationId),
        [allConversations, currentConversationId],
    );

    // Map from conversation id → its index in allConversations (used as sort fallback)
    const originalIndexMap = useMemo(() => {
        const m = new Map<string, number>();
        allConversations.forEach((c, i) => m.set(c.id, i));
        return m;
    }, [allConversations]);

    // Group by folder — chat folders only, sorted to match sidebar order
    const folderGroups = useMemo((): FolderGroup[] => {
        const chatFolders = folders.filter(f => f.type === 'chat');

        // Collect conversations that match each folder
        const groups: FolderGroup[] = chatFolders
            .map(f => ({
                folderId: f.id,
                folderName: f.name,
                conversations: availableConversations.filter(c => c.folderId === f.id),
            }))
            .filter(g => g.conversations.length > 0); // only show folders that have convs

        // Unfiled conversations
        const filedIds = new Set(chatFolders.map(f => f.id));
        const unfiled = availableConversations.filter(c => !c.folderId || !filedIds.has(c.folderId));
        if (unfiled.length > 0) {
            groups.push({ folderId: null, folderName: 'No Folder', conversations: unfiled });
        }

        return groups;
    }, [availableConversations, folders]);

    const todayStr = new Date().toDateString();

    const isToday = (conv: Conversation) =>
        !!conv.date && new Date(conv.date).toDateString() === todayStr;

    /** Returns true when we can confirm locally that a conversation has no messages */
    const isLocallyEmpty = (conv: Conversation): boolean => {
        if (!isLocalConversation(conv)) return false; // cloud — unknown until fetched
        const hasMessages = (conv.messages?.length ?? 0) > 0;
        const hasCompressed = (conv.compressedMessages?.length ?? 0) > 0;
        return !hasMessages && !hasCompressed;
    };

    const sortAndFilter = (convs: Conversation[], originalIndices: Map<string, number>) => {
        const filtered = !searchQuery
            ? convs
            : convs.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
        // Most recent first.
        // Primary key: conv.date (ISO string) descending.
        // Fallback: original position in allConversations in reverse order
        //           (allConversations is typically oldest-first, so reversing gives newest-first).
        return [...filtered].sort((a, b) => {
            const aHasDate = !!a.date;
            const bHasDate = !!b.date;
            if (aHasDate && bHasDate) {
                return new Date(b.date!).getTime() - new Date(a.date!).getTime();
            }
            if (aHasDate) return -1; // a has date, b doesn't → a is newer
            if (bHasDate) return 1;  // b has date, a doesn't → b is newer
            // Neither has a date — use reverse original order (newest inserted = highest index)
            return (originalIndices.get(b.id) ?? 0) - (originalIndices.get(a.id) ?? 0);
        });
    };

    // On mount: eagerly load already-selected entries from memory/cache
    useEffect(() => {
        const ids = contextEntries.map(e => e.conversationId);
        if (ids.length > 0) {
            preloadFromCacheOrLocal(ids, allConversations);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Entry helpers ──────────────────────────────────────────────────────────

    const getEntry = (id: string) => contextEntries.find(e => e.conversationId === id);
    const isAdded = (id: string) => !!getEntry(id);

    const addEntry = (conv: Conversation) => {
        if (isAdded(conv.id)) return;
        onEntriesChange([...contextEntries, { conversationId: conv.id, mode: 'all' }]);
        loadConversation(conv, allConversations);
    };

    const removeEntry = (conversationId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        onEntriesChange(contextEntries.filter(en => en.conversationId !== conversationId));
        setExpandedConvIds(prev => { const s = new Set(prev); s.delete(conversationId); return s; });
    };

    const updateEntry = (conversationId: string, patch: Partial<ConversationContextEntry>) => {
        onEntriesChange(
            contextEntries.map(e => e.conversationId === conversationId ? { ...e, ...patch } : e),
        );
    };

    const handleRowClick = (conv: Conversation) => {
        if (!isAdded(conv.id)) {
            addEntry(conv);
        } else {
            // Toggle expand
            setExpandedConvIds(prev => {
                const s = new Set(prev);
                s.has(conv.id) ? s.delete(conv.id) : s.add(conv.id);
                return s;
            });
        }
    };

    const toggleFolder = (folderId: string | null) => {
        setCollapsedFolderIds(prev => {
            const s = new Set(prev);
            s.has(folderId) ? s.delete(folderId) : s.add(folderId);
            return s;
        });
    };

    // ── Message helpers ────────────────────────────────────────────────────────

    const toggleMessageSelected = (convId: string, msgId: string, allMsgs: CachedConversationMessage[]) => {
        const entry = getEntry(convId);
        if (!entry) return;
        const current = new Set(
            entry.mode === 'selected'
                ? (entry.selectedMessageIds ?? [])
                : allMsgs.map(m => m.id),
        );
        current.has(msgId) ? current.delete(msgId) : current.add(msgId);
        updateEntry(convId, { mode: 'selected', selectedMessageIds: Array.from(current) });
    };

    const setAllMessages = (convId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        updateEntry(convId, { mode: 'all', selectedMessageIds: undefined });
    };

    const isMessageSelected = (entry: ConversationContextEntry, msgId: string): boolean =>
        entry.mode === 'all' || (entry.selectedMessageIds?.includes(msgId) ?? false);

    const selectedCount = (entry: ConversationContextEntry, msgs: CachedConversationMessage[]): number =>
        entry.mode === 'all' ? msgs.length : (entry.selectedMessageIds?.length ?? 0);

    // ── Conversation row ───────────────────────────────────────────────────────

    const renderConvRow = (conv: Conversation) => {
        const added = isAdded(conv.id);
        const convState: LoadedConvState | undefined = loadedStates[conv.id];
        const entry = getEntry(conv.id);
        const isExpanded = expandedConvIds.has(conv.id);
        const isLocal = isLocalConversation(conv);
        const isEmpty = isLocallyEmpty(conv);
        const messages = convState?.messages ?? [];
        const isLoading = added && convState?.status === 'loading';
        const isLoaded = added && convState?.status === 'loaded';
        const isError = added && convState?.status === 'error';

        return (
            <div key={conv.id} className={`mb-1 ${isEmpty ? 'opacity-50' : ''}`}>
                {/* ── Main clickable row ── */}
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleRowClick(conv)}
                    onKeyDown={e => e.key === 'Enter' && handleRowClick(conv)}
                    title={isEmpty ? 'No messages — will be excluded when sending' : undefined}
                    className={`
                        flex items-center gap-2 px-2 py-2 rounded-lg border cursor-pointer
                        select-none transition-colors
                        ${added
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                            : 'bg-white dark:bg-[#40414F] border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-[#4a4b5a] hover:border-blue-300 dark:hover:border-blue-600'}
                    `}
                >
                    {/* Chevron — always shown when added (expand/collapse), space placeholder when not */}
                    <span className="flex-shrink-0 w-4 text-gray-400">
                        {added && (
                            isLoading
                                ? <IconLoader2 size={14} className="animate-spin text-blue-400" />
                                : isLoaded
                                    ? (isExpanded
                                        ? <IconChevronDown size={14} />
                                        : <IconChevronRight size={14} />)
                                    : isError
                                        ? <IconAlertTriangle size={14} className="text-red-400" />
                                        : null
                        )}
                    </span>

                    {/* Storage icon */}
                    <span className="flex-shrink-0 text-gray-400">
                        {isLocal ? <IconDeviceFloppy size={14} /> : <IconCloud size={14} />}
                    </span>

                    {/* Name */}
                    <span className={`flex-1 text-sm truncate min-w-0
                        ${added ? 'font-medium text-gray-800 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}
                    >
                        {conv.name || 'Untitled'}
                        {isToday(conv) && (
                            <span className="ml-1.5 text-[10px] font-medium text-blue-500 dark:text-blue-400 align-middle">
                                Today
                            </span>
                        )}
                        {isEmpty && (
                            <span className="ml-1.5 text-[10px] font-medium text-gray-400 dark:text-gray-500 align-middle">
                                Empty
                            </span>
                        )}
                    </span>

                    {/* Right side status area */}
                    {isLoaded && entry && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 tabular-nums">
                            {selectedCount(entry, messages)}/{messages.length}
                        </span>
                    )}

                    {isError && (
                        <button
                            onClick={e => { e.stopPropagation(); loadConversation(conv, allConversations, true); }}
                            className="text-xs text-red-400 hover:text-red-500 flex-shrink-0"
                            title={convState?.error ?? 'Error'}
                        >
                            Retry
                        </button>
                    )}

                    {/* Refresh for stale cloud cache */}
                    {isLoaded && !isLocal && convState?.fromCache && (
                        <button
                            onClick={e => { e.stopPropagation(); loadConversation(conv, allConversations, true); }}
                            className="text-gray-400 hover:text-blue-500 flex-shrink-0"
                            title="Refresh from cloud"
                        >
                            <IconRefresh size={13} />
                        </button>
                    )}

                    {/* Added indicator / Remove button */}
                    {added ? (
                        <button
                            onClick={e => removeEntry(conv.id, e)}
                            className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors ml-1"
                            title="Remove from context"
                        >
                            <IconX size={14} />
                        </button>
                    ) : (
                        <span className="flex-shrink-0 text-gray-300 dark:text-gray-600">
                            <IconCheck size={14} className="opacity-0 group-hover:opacity-100" />
                        </span>
                    )}
                </div>

                {/* ── Expanded message list ── */}
                {added && isExpanded && isLoaded && entry && (
                    <div
                        className="ml-5 mt-0.5 border-l-2 border-blue-200 dark:border-blue-800 pl-3 pb-1"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between py-1.5">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                Select individual messages:
                            </span>
                            <button
                                onClick={e => setAllMessages(conv.id, e)}
                                className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400"
                            >
                                Select All
                            </button>
                        </div>

                        {messages.length === 0 ? (
                            <p className="text-xs text-gray-400 dark:text-gray-500 italic py-2 text-center">
                                No messages available
                            </p>
                        ) : (
                            <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                                {messages.map(msg => {
                                    const sel = isMessageSelected(entry, msg.id);
                                    return (
                                        <div
                                            key={msg.id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => toggleMessageSelected(conv.id, msg.id, messages)}
                                            onKeyDown={e => e.key === 'Enter' && toggleMessageSelected(conv.id, msg.id, messages)}
                                            className={`
                                                flex items-start gap-2 px-2 py-1.5 rounded cursor-pointer
                                                transition-colors text-xs
                                                ${sel
                                                    ? 'bg-blue-50 dark:bg-blue-900/25 border border-blue-200 dark:border-blue-700'
                                                    : 'bg-gray-50 dark:bg-[#2A2B32] border border-transparent opacity-60 hover:opacity-80'}
                                            `}
                                        >
                                            <Checkbox
                                                id={`msg-${msg.id}`}
                                                label=""
                                                checked={sel}
                                                onChange={() => toggleMessageSelected(conv.id, msg.id, messages)}
                                            />
                                            <span className={`font-semibold flex-shrink-0 w-14
                                                ${msg.role === 'user'
                                                    ? 'text-blue-600 dark:text-blue-400'
                                                    : 'text-green-600 dark:text-green-400'}`}
                                            >
                                                {msg.role === 'user' ? 'You' : 'AI'}:
                                            </span>
                                            <span className="truncate text-gray-700 dark:text-gray-300 flex-1 min-w-0">
                                                {msg.content.slice(0, 120)}{msg.content.length > 120 ? '…' : ''}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // ── Folder group ───────────────────────────────────────────────────────────

    const renderFolderGroup = (group: FolderGroup) => {
        const items = sortAndFilter(group.conversations, originalIndexMap);
        if (items.length === 0) return null;

        const isCollapsed = collapsedFolderIds.has(group.folderId);
        const addedCount = items.filter(c => isAdded(c.id)).length;

        return (
            <div key={group.folderId ?? '__no_folder__'} className="mb-2">
                {/* Folder header */}
                <button
                    onClick={() => toggleFolder(group.folderId)}
                    className="w-full flex items-center gap-2 px-1 py-1 text-xs font-semibold
                               uppercase tracking-wider text-gray-500 dark:text-gray-400
                               hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                    {isCollapsed
                        ? <IconChevronRight size={13} />
                        : <IconChevronDown size={13} />}
                    {group.folderId !== null
                        ? <IconFolder size={13} />
                        : <IconMessage size={13} />}
                    <span className="flex-1 text-left truncate">{group.folderName}</span>
                    <span className="font-normal normal-case tracking-normal text-gray-400">
                        {addedCount > 0
                            ? `${addedCount}/${items.length} active`
                            : `${items.length}`}
                    </span>
                </button>

                {/* Conversations in folder */}
                {!isCollapsed && (
                    <div className="pl-4">
                        {items.map(renderConvRow)}
                    </div>
                )}
            </div>
        );
    };

    // ── Summary footer ─────────────────────────────────────────────────────────

    const totalActive = contextEntries.length;

    return (
        <div className="flex flex-col h-full">
            {/* Search */}
            <div className="mb-3">
                <input
                    type="text"
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                               bg-white dark:bg-[#40414F] text-gray-800 dark:text-gray-200
                               focus:outline-none focus:border-blue-400 dark:focus:border-blue-500"
                />
            </div>

            {/* Conversation lists */}
            <div className="flex-1 overflow-y-auto pr-1" style={{ maxHeight: '360px' }}>
                {availableConversations.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                        No other conversations to add as context.
                    </p>
                ) : folderGroups.every(g => sortAndFilter(g.conversations, originalIndexMap).length === 0) ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                        No conversations match your search.
                    </p>
                ) : (
                    folderGroups.map(renderFolderGroup)
                )}
            </div>

            {/* Footer */}
            <div className="mt-3 pt-2 border-t border-gray-300 dark:border-gray-600 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                    <IconMessage size={13} />
                    {totalActive === 0
                        ? 'No conversations added as context'
                        : `${totalActive} conversation${totalActive > 1 ? 's' : ''} active as context`}
                </span>
                {totalActive > 0 && (
                    <button
                        onClick={() => onEntriesChange([])}
                        className="text-red-400 hover:text-red-500"
                    >
                        Clear all
                    </button>
                )}
            </div>
        </div>
    );
};
