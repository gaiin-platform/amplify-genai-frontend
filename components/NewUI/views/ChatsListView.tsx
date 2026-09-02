/**
 * ChatsListView — full-pane "Chats and tasks" view.
 * Opened by clicking the expand arrow next to "Recents" in the sidebar.
 * Matches the Claude reference screenshot: title row, search, filter, scrollable table.
 *
 * Reusable via: dispatch({ field: 'page', value: 'chats' })
 *
 * Phase N — "Shared with Me" tab added:
 *   A SegmentedControl below the title row switches between:
 *     "My Chats"    — existing conversation list (unchanged)
 *     "Shared with Me" — share bundles received via getSharedItems() (Case A)
 *
 *   ShareItem only has { sharedBy, sharedAt, key, note } — no conversation title.
 *   The "note" field is displayed as the primary description (required by the
 *   old ShareAnythingModal, optional in the new one). On "Open →" click the bundle
 *   is loaded via loadSharedItem(key), merged into state via importData(), and the
 *   first conversation from the bundle is navigated to.
 *
 *   Tab selection is NOT persisted to localStorage — resets to "My Chats" on
 *   navigation (keeps things simple, per spec).
 */
import React, {
    useContext,
    useState,
    useMemo,
    useRef,
    useEffect,
    useCallback,
} from 'react';
import ReactDOM from 'react-dom';
import {
    IconSearch,
    IconMessage2,
    IconPlus,
    IconShare,
    IconLoader2,
    IconAlertCircle,
    IconPencil,
    IconTrash,
    IconPin,
    IconPinnedOff,
    IconPinFilled,
} from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import { Conversation } from '@/types/chat';
import {
    isLocalConversation,
    saveConversations,
    deleteConversationCleanUp,
} from '@/utils/app/conversation';
import { uncompressMessages } from '@/utils/app/messages';
import { ShareItem, ExportFormatV4 } from '@/types/export';
import { getSharedItems, loadSharedItem } from '@/services/shareService';
import { importData } from '@/utils/app/importExport';
import { DefaultModels } from '@/types/model';
import { useSession } from 'next-auth/react';
import { getUserIdentifier } from '@/utils/app/data';
import { SegmentedControl } from '@/components/NewUI/shared/SegmentedControl';
import { saveFolders } from '@/utils/app/folders';
import { savePrompts } from '@/utils/app/prompts';
import { ConfirmDialog } from '@/components/NewUI/shared/ConfirmDialog';
import { NewUIShareModal } from '@/components/NewUI/chat/NewUIShareModal';
import { SortableHeader } from '@/components/NewUI/shared/SortableHeader';
import { FilterMenu } from '@/components/NewUI/shared/FilterMenu';
import {
    CHAT_FILTER_DEFAULTS,
    ChatSortKey,
    applyChatFilters,
    buildChatFilterGroups,
    compareConversations,
    conversationAssistantName,
    countActiveChatFilters,
    isPinnedConv,
} from '@/components/NewUI/shared/chatFilters';

// ── helpers ──────────────────────────────────────────────────────────────────

function relativeDate(isoString?: string | number): string {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMs < 60000) return 'just now';
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Filter vocabulary, pinned detection and comparators live in shared/chatFilters
// so this view and the sidebar Recents list stay in agreement.

/** Reserved width of the hover-action cell: 4 × 28px buttons + 3 × 4px gaps. */
const ACTION_CELL_WIDTH = 124;

// ── Tab definition ────────────────────────────────────────────────────────────

const TAB_ITEMS = [
    { id: 'mine', label: 'My Chats' },
    { id: 'shared', label: 'Shared with Me' },
];

type ChatTab = 'mine' | 'shared';

// ── Skeleton row (loading placeholder) ────────────────────────────────────────

const SkeletonRow: React.FC = () => (
    <div
        className="flex items-center gap-3 px-3 h-[48px] rounded-[8px] animate-pulse"
        aria-hidden="true"
    >
        <div className="w-4 h-4 rounded bg-[--bg-raised] flex-shrink-0" />
        <div className="flex-1 h-3 rounded bg-[--bg-raised]" />
        <div className="w-14 h-3 rounded bg-[--bg-raised] flex-shrink-0" />
    </div>
);

// ── component ─────────────────────────────────────────────────────────────────

export const ChatsListView: React.FC = () => {
    const {
        state: { conversations, prompts, folders, amplifyUsers, selectedConversation, statsService },
        dispatch,
        handleSelectConversation,
        handleUpdateConversation,
        handleNewConversation,
        getDefaultModel,
    } = useContext(HomeContext);

    // ── Refs so callbacks don't become stale ──────────────────────────────
    const conversationsRef = useRef(conversations);
    useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
    const selectedConversationRef = useRef(selectedConversation);
    useEffect(() => { selectedConversationRef.current = selectedConversation; }, [selectedConversation]);

    const { data: session } = useSession();
    const user = getUserIdentifier(session?.user) ?? '';

    const [search, setSearch] = useState('');
    const searchRef = useRef<HTMLInputElement>(null);

    // ── Sort + filter state (in-memory only, same as the Library view) ─────
    const [sort, setSort] = useState<{ key: ChatSortKey; direction: 'asc' | 'desc' }>({
        key: 'date',
        direction: 'desc',
    });
    const [filters, setFilters] = useState<Record<string, string>>({ ...CHAT_FILTER_DEFAULTS });

    // ── Tab state ──────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<ChatTab>('mine');

    // ── Shared-with-me state ───────────────────────────────────────────────
    const [sharedItems, setSharedItems] = useState<ShareItem[] | null>(null);
    const [sharedLoading, setSharedLoading] = useState(false);
    const [sharedError, setSharedError] = useState<string | null>(null);
    // key of the item currently being opened (for per-row spinner)
    const [openingKey, setOpeningKey] = useState<string | null>(null);

    // Auto-focus the search box when the view opens
    useEffect(() => {
        const t = setTimeout(() => {
            searchRef.current?.focus();
        }, 80);
        return () => clearTimeout(t);
    }, []);

    // ── Lazy-load shared items when tab is first activated ─────────────────
    const fetchSharedItems = useCallback(async () => {
        setSharedLoading(true);
        setSharedError(null);
        try {
            const result = await getSharedItems();
            if (result.success) {
                // Filter out items the current user sent (same logic as SharedItemList.tsx)
                const received = (result.items as ShareItem[]).filter(
                    (item) => item.sharedBy !== user
                );
                // Sort newest first
                received.sort(
                    (a, b) =>
                        new Date(b.sharedAt).getTime() - new Date(a.sharedAt).getTime()
                );
                setSharedItems(received);
            } else {
                setSharedError('Could not load shared items. Please try again.');
                setSharedItems([]);
            }
        } catch {
            setSharedError('Could not load shared items. Please try again.');
            setSharedItems([]);
        } finally {
            setSharedLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (activeTab === 'shared' && sharedItems === null && !sharedLoading) {
            fetchSharedItems();
        }
    }, [activeTab, sharedItems, sharedLoading, fetchSharedItems]);

    // ── "My Chats" tab — which filter groups are meaningful for this list ───
    // Groups that cannot discriminate over the current list are not offered, so the
    // Assistant filter never appears (and so can never mislead) in cloud-only mode.
    const filterGroups = useMemo(() => buildChatFilterGroups(conversations), [conversations]);
    const hasAssistantConvs = filterGroups.some((g) => g.id === 'assistant');
    const activeFilterCount = countActiveChatFilters(filters, filterGroups);

    const toggleSort = (key: ChatSortKey) => {
        setSort((current) =>
            current.key === key
                ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
                : { key, direction: key === 'date' ? 'desc' : 'asc' }
        );
    };

    const clearNarrowing = () => {
        setFilters({ ...CHAT_FILTER_DEFAULTS });
        setSearch('');
    };

    // ── Filter → search → sort ─────────────────────────────────────────────
    // Search mirrors Chatbar.tsx: matches conversation name AND, for local
    // conversations, decompressed message content (remote conversations are not
    // searchable by content — same limitation as classic UI).
    const filteredMine = useMemo(() => {
        let list = applyChatFilters(conversations, filters, filterGroups);

        const q = search.trim().toLowerCase();
        if (q) {
            list = list.filter((c) => {
                let messages = '';
                if (isLocalConversation(c)) {
                    const uncompressedMs = uncompressMessages(c.compressedMessages ?? []);
                    if (uncompressedMs) messages = uncompressedMs.map((m) => m.content).join(' ');
                }
                const searchable = c.name.toLowerCase() + ' ' + messages;
                return searchable.toLowerCase().includes(q);
            });
        }

        // Same comparator shape as NewLibraryView's sortedData: primary key, then
        // a stable name tie-break.
        return [...list].sort(compareConversations(sort.key, sort.direction));
    }, [conversations, filters, filterGroups, search, sort]);

    // ── "Shared with Me" tab — filter ─────────────────────────────────────
    const filteredShared = useMemo(() => {
        if (!sharedItems) return [];
        if (!search.trim()) return sharedItems;
        const q = search.toLowerCase();
        return sharedItems.filter((item) => {
            const displayName = amplifyUsers?.[item.sharedBy] ?? item.sharedBy;
            return (
                item.note.toLowerCase().includes(q) ||
                displayName.toLowerCase().includes(q)
            );
        });
    }, [sharedItems, search, amplifyUsers]);

    // ── Open a shared item ─────────────────────────────────────────────────
    const handleOpenSharedItem = async (item: ShareItem) => {
        setOpeningKey(item.key);
        setSharedError(null);
        try {
            const result = await loadSharedItem(item.key);
            if (!result.success) {
                setSharedError(
                    'Could not open this item — it may have been deleted. Please try again.'
                );
                return;
            }
            const sharedData: ExportFormatV4 = JSON.parse(result.item);

            // Merge into local state using the same flow as ImportAnythingModal
            const merged = importData(
                sharedData,
                conversations,
                prompts,
                folders,
                getDefaultModel(DefaultModels.DEFAULT)
            );
            dispatch({ field: 'conversations', value: merged.history });
            saveConversations(merged.history);
            dispatch({ field: 'folders', value: merged.folders });
            saveFolders(merged.folders);
            dispatch({ field: 'prompts', value: merged.prompts });
            savePrompts(merged.prompts);

            // Navigate to the first conversation in the shared bundle
            if (sharedData.history && sharedData.history.length > 0) {
                handleSelectConversation(sharedData.history[0]);
                dispatch({ field: 'page', value: 'chat' });
            }
        } catch {
            setSharedError(
                'An unexpected error occurred opening this item. Please try again.'
            );
        } finally {
            setOpeningKey(null);
        }
    };

    const handleOpen = (c: Conversation) => {
        handleSelectConversation(c);
        dispatch({ field: 'page', value: 'chat' });
    };

    // ── Delete a conversation (mirrors NewSidebar.handleDeleteConversation) ─
    const handleDeleteConversation = useCallback((conversation: Conversation) => {
        deleteConversationCleanUp(conversation);
        const updated = conversationsRef.current.filter((c) => c.id !== conversation.id);

        statsService.deleteConversationEvent(conversation);

        if (updated.length === 0) {
            // Keep at least one conversation (same as sidebar logic)
            // Let handleNewConversation handle the empty state when navigating
        } else if (selectedConversationRef.current?.id === conversation.id) {
            dispatch({ field: 'selectedConversation', value: updated[updated.length - 1] });
        }

        saveConversations(updated);
        dispatch({ field: 'conversations', value: updated });
    }, [dispatch, statsService]);

    // ── Pin / unpin (identical write to ConversationRow.handlePin) ─────────
    const handleTogglePin = useCallback((conversation: Conversation) => {
        handleUpdateConversation(conversation, {
            key: 'data',
            value: { ...conversation.data, pinned: !isPinnedConv(conversation) },
        });
    }, [handleUpdateConversation]);

    // ── Helpers for display ────────────────────────────────────────────────
    const senderDisplayName = (sharedBy: string) =>
        amplifyUsers?.[sharedBy] ?? sharedBy;

    const searchPlaceholder =
        activeTab === 'mine' ? 'Search chats…' : 'Search shared…';

    return (
        <div
            className="flex-1 flex flex-col bg-[--bg-app] overflow-hidden"
            style={{ fontFamily: 'Inter, sans-serif' }}
        >
            {/* Page header */}
            <div className="flex items-center justify-between px-8 pt-10 pb-6 flex-shrink-0">
                <h1
                    className="text-[28px] text-[--text-primary] font-normal leading-none tracking-[-0.01em]"
                    style={{ fontFamily: '"Newsreader", "Georgia", serif' }}
                >
                    Chats and tasks
                </h1>

                <div className="flex items-center gap-2">
                    {/* Search */}
                    <div className="relative">
                        <IconSearch
                            size={15}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-[--text-muted] pointer-events-none"
                        />
                        <input
                            ref={searchRef}
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={searchPlaceholder}
                            className={`
                h-[34px] pl-9 pr-3 rounded-[8px] text-[13px]
                bg-[--bg-raised] border border-[--border-subtle]
                text-[--text-primary] placeholder:text-[--text-muted]
                focus:outline-none focus:border-[--bg-active]
                transition-colors w-[200px]
              `}
                        />
                    </div>

                    {/* Filter (My Chats only) */}
                    {activeTab === 'mine' && (
                        <FilterMenu
                            groups={filterGroups}
                            value={filters}
                            defaults={CHAT_FILTER_DEFAULTS}
                            onChange={setFilters}
                        />
                    )}

                    {/* New chat */}
                    <button
                        onClick={() => handleNewConversation({})}
                        className="flex items-center gap-1.5 h-[34px] px-4 rounded-[8px] text-[13px] font-medium bg-[--text-primary] text-[--bg-app] hover:opacity-90 transition-opacity"
                    >
                        <IconPlus size={14} />
                        New
                    </button>
                </div>
            </div>

            {/* Tab strip */}
            <div className="px-8 pb-4 flex-shrink-0">
                <SegmentedControl
                    items={TAB_ITEMS}
                    value={activeTab}
                    onChange={(id) => {
                        setActiveTab(id as ChatTab);
                        setSearch('');
                    }}
                    size="sm"
                    aria-label="Chat view filter"
                />
            </div>

            {/* ── My Chats: sortable column headers ─────────────────────────── */}
            {activeTab === 'mine' && conversations.length > 0 && (
                <div className="px-8 flex-shrink-0">
                    <div
                        className="flex items-center gap-3 px-3 py-2 border-b"
                        style={{ borderColor: 'var(--border-subtle)' }}
                    >
                        {/* Row-icon spacer */}
                        <div className="w-4 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <SortableHeader
                                label="Name"
                                sortKey="name"
                                activeKey={sort.key}
                                direction={sort.direction}
                                onSort={toggleSort}
                            />
                        </div>
                        {hasAssistantConvs && (
                            <div className="hidden lg:block w-[150px] text-right flex-shrink-0">
                                <SortableHeader
                                    label="Assistant"
                                    sortKey="assistant"
                                    activeKey={sort.key}
                                    direction={sort.direction}
                                    onSort={toggleSort}
                                />
                            </div>
                        )}
                        <div className="w-[92px] text-right flex-shrink-0">
                            <SortableHeader
                                label="Date"
                                sortKey="date"
                                activeKey={sort.key}
                                direction={sort.direction}
                                onSort={toggleSort}
                            />
                        </div>
                        {/* Hover-action spacer */}
                        <div className="flex-shrink-0" style={{ width: ACTION_CELL_WIDTH }} />
                    </div>
                </div>
            )}

            {/* ── My Chats tab ──────────────────────────────────────────────── */}
            {activeTab === 'mine' && (
                <div className="flex-1 overflow-y-auto px-8 pb-8">
                    {filteredMine.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 text-[--text-muted]">
                            <IconMessage2 size={32} className="mb-3 opacity-40" />
                            <p className="text-[14px]">
                                {search || activeFilterCount > 0
                                    ? 'No chats match your filters'
                                    : 'No conversations yet'}
                            </p>
                            {(search || activeFilterCount > 0) && (
                                <button
                                    onClick={clearNarrowing}
                                    className="mt-3 text-[13px] font-medium text-[--accent] hover:opacity-80 transition-opacity"
                                >
                                    Clear filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col pt-1">
                            {filteredMine.map((c) => (
                                <MyChatRow
                                    key={c.id}
                                    conversation={c}
                                    showAssistantColumn={hasAssistantConvs}
                                    onOpen={handleOpen}
                                    onDelete={handleDeleteConversation}
                                    onRename={handleUpdateConversation}
                                    onTogglePin={handleTogglePin}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Shared with Me tab ────────────────────────────────────────── */}
            {activeTab === 'shared' && (
                <div className="flex-1 overflow-y-auto px-8 pb-8">
                    {/* Error state */}
                    {sharedError && (
                        <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-[8px] bg-[--bg-raised] border border-[--border-subtle]">
                            <IconAlertCircle
                                size={16}
                                className="flex-shrink-0 text-[--text-muted]"
                            />
                            <span className="text-[13px] text-[--text-secondary] flex-1">
                                {sharedError}
                            </span>
                            <button
                                onClick={() => { setSharedItems(null); setSharedError(null); }}
                                className="text-[13px] font-medium text-[--accent] hover:opacity-80 transition-opacity flex-shrink-0"
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    {/* Loading skeletons */}
                    {sharedLoading && (
                        <div className="flex flex-col">
                            {[1, 2, 3].map((n) => (
                                <SkeletonRow key={n} />
                            ))}
                        </div>
                    )}

                    {/* Empty state */}
                    {!sharedLoading && !sharedError && sharedItems !== null && filteredShared.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-24 text-[--text-muted]">
                            <IconShare size={32} className="mb-3 opacity-40" />
                            <p className="text-[14px]">
                                {search
                                    ? 'No shared conversations match your search'
                                    : 'No conversations shared with you yet'}
                            </p>
                            {!search && (
                                <p className="text-[13px] mt-1.5 text-center max-w-[260px]">
                                    When someone shares a chat with you, it will appear here.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Shared item rows */}
                    {!sharedLoading && filteredShared.length > 0 && (
                        <div className="flex flex-col">
                            {filteredShared.map((item) => {
                                const isOpening = openingKey === item.key;
                                return (
                                    <button
                                        key={item.key}
                                        onClick={() =>
                                            !isOpening && handleOpenSharedItem(item)
                                        }
                                        disabled={!!openingKey}
                                        className={`
                      w-full flex items-center gap-3 px-3 h-[56px] rounded-[8px]
                      text-left transition-colors duration-100
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--text-secondary]
                      ${openingKey
                                                ? 'opacity-60 cursor-default'
                                                : 'hover:bg-[--bg-hover] cursor-pointer'
                                            }
                    `}
                                    >
                                        {/* Icon */}
                                        <IconShare
                                            size={16}
                                            className="flex-shrink-0 text-[--text-muted]"
                                        />

                                        {/* Main content */}
                                        <div className="flex-1 min-w-0">
                                            {/* Title = note (the sender's description) */}
                                            <p className="text-[14px] text-[--text-primary] truncate leading-snug">
                                                {item.note || 'Untitled share'}
                                            </p>
                                            {/* Secondary = sender display name */}
                                            <p className="text-[12px] text-[--text-muted] truncate leading-snug">
                                                Shared by {senderDisplayName(item.sharedBy)}
                                            </p>
                                        </div>

                                        {/* Date */}
                                        <span className="flex-shrink-0 text-[13px] text-[--text-muted]">
                                            {relativeDate(item.sharedAt)}
                                        </span>

                                        {/* Open button */}
                                        <span
                                            className={`
                        flex-shrink-0 flex items-center gap-1 h-[28px] px-3 rounded-[6px]
                        text-[12px] font-medium transition-colors
                        ${openingKey === item.key
                                                    ? 'bg-[--bg-raised] text-[--text-muted]'
                                                    : 'bg-[--bg-raised] text-[--text-secondary] hover:bg-[--bg-active] hover:text-[--text-primary]'
                                                }
                      `}
                                            aria-hidden="true" // the whole button is the clickable area
                                        >
                                            {isOpening ? (
                                                <IconLoader2
                                                    size={12}
                                                    className="animate-spin motion-reduce:animate-none"
                                                />
                                            ) : (
                                                'Open →'
                                            )}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ── Sub-component: single My Chats row ────────────────────────────────────────
// Extracted to avoid calling useContext in a .map() callback (hooks rule).
// Supports Pin, inline Rename, Share (NewUIShareModal), and Delete (ConfirmDialog).
//
// Cells line up with the sortable column header row above the list, so the date
// and the hover actions each get their own fixed-width cell (the actions cell is
// reserved and fades in, rather than replacing the date).

interface MyChatRowProps {
    conversation: Conversation;
    showAssistantColumn: boolean;
    onOpen: (c: Conversation) => void;
    onDelete: (c: Conversation) => void;
    onRename: (conversation: Conversation, data: { key: string; value: any }) => void;
    onTogglePin: (c: Conversation) => void;
}

const MyChatRow: React.FC<MyChatRowProps> = ({
    conversation,
    showAssistantColumn,
    onOpen,
    onDelete,
    onRename,
    onTogglePin,
}) => {
    const { state: { selectedConversation } } = useContext(HomeContext);
    const isSelected = selectedConversation?.id === conversation.id;

    // ── Hover state ──────────────────────────────────────────────────────
    const [isHovered, setIsHovered] = useState(false);

    // ── Inline rename state ──────────────────────────────────────────────
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const renameInputRef = useRef<HTMLInputElement>(null);

    // ── Share modal state ────────────────────────────────────────────────
    const [showShareModal, setShowShareModal] = useState(false);

    // ── Delete confirm state ─────────────────────────────────────────────
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

    // Focus + select all when rename input appears
    useEffect(() => {
        if (isRenaming && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [isRenaming]);

    // ── Rename handlers ──────────────────────────────────────────────────
    const startRename = (e: React.MouseEvent) => {
        e.stopPropagation();
        setRenameValue(conversation.name || '');
        setIsRenaming(true);
    };

    const commitRename = () => {
        const trimmed = renameValue.trim();
        if (trimmed && trimmed !== conversation.name) {
            onRename(conversation, { key: 'name', value: trimmed });
        }
        setIsRenaming(false);
    };

    const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
        if (e.key === 'Escape') { e.preventDefault(); setIsRenaming(false); }
    };

    // While renaming or a modal is open, keep the hover highlight even if pointer leaves
    const keepHighlight = isRenaming || showShareModal || confirmDeleteOpen;

    // Row background class
    const rowBg = isSelected ? 'bg-[--bg-active]'
        : (isHovered || keepHighlight) ? 'bg-[--bg-hover]'
        : '';

    const showActions = !isRenaming && (isHovered || keepHighlight);

    // Reserved-width action cell: fades in on hover, and on keyboard focus so the
    // buttons are reachable by Tab. Suppressed entirely while renaming (focus is
    // in the rename input, which would otherwise trigger focus-within).
    const actionVisibility = showActions
        ? 'opacity-100'
        : isRenaming
            ? 'opacity-0 pointer-events-none'
            : 'opacity-0 pointer-events-none group-focus-within:opacity-100 group-focus-within:pointer-events-auto';

    const isPinned = isPinnedConv(conversation);
    const assistantName = conversationAssistantName(conversation);

    return (
        <div
            className={`group w-full flex items-center gap-3 px-3 h-[48px] rounded-[8px] ${rowBg} transition-colors duration-100`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => { if (!keepHighlight) setIsHovered(false); }}
        >
            {/* ── Inline rename input replaces the title cell while active ── */}
            {isRenaming ? (
                <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={handleRenameKeyDown}
                    onBlur={commitRename}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 min-w-0 h-[34px] px-2 text-[14px] text-[--text-primary] bg-transparent rounded-[6px] outline-none border border-[--accent]"
                    spellCheck={false}
                />
            ) : (
                /* Clickable title area — flex-1 so it never reaches under the right cells */
                <button
                    onClick={() => onOpen(conversation)}
                    className="flex items-center gap-3 flex-1 min-w-0 h-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--text-secondary] rounded-[8px]"
                >
                    <IconMessage2
                        size={16}
                        className="flex-shrink-0 text-[--text-muted]"
                    />
                    <span className="min-w-0 text-[14px] text-[--text-primary] truncate">
                        {conversation.name || 'New Conversation'}
                    </span>
                    {isPinned && (
                        <IconPinFilled
                            size={12}
                            className="flex-shrink-0 text-[--text-muted]"
                            aria-label="Pinned"
                        />
                    )}
                </button>
            )}

            {/* ── Assistant cell — only when the list has resolvable assistants ── */}
            {showAssistantColumn && (
                <span
                    className="hidden lg:block w-[150px] flex-shrink-0 text-right text-[12px] text-[--text-muted] truncate"
                    title={assistantName ?? undefined}
                >
                    {assistantName ?? '—'}
                </span>
            )}

            {/* ── Date cell ── */}
            <span className="w-[92px] flex-shrink-0 text-right text-[13px] text-[--text-muted] select-none">
                {relativeDate(conversation.date)}
            </span>

            {/* ── Hover-action cell — reserved width so the columns stay aligned ── */}
            <div
                className={`
                    flex-shrink-0 flex items-center justify-end gap-1
                    transition-opacity duration-100 motion-reduce:transition-none
                    ${actionVisibility}
                `}
                style={{ width: ACTION_CELL_WIDTH }}
                onClick={(e) => e.stopPropagation()}
            >
                    {/* Pin / Unpin */}
                    <button
                        aria-label={`${isPinned ? 'Unpin' : 'Pin'} ${conversation.name || 'conversation'}`}
                        title={isPinned ? 'Unpin' : 'Pin'}
                        onClick={(e) => { e.stopPropagation(); onTogglePin(conversation); }}
                        className="flex items-center justify-center h-[28px] w-[28px] rounded-[6px] transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-active)';
                            (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                        }}
                    >
                        {isPinned ? <IconPinnedOff size={14} /> : <IconPin size={14} />}
                    </button>

                    {/* Rename */}
                    <button
                        aria-label={`Rename ${conversation.name || 'conversation'}`}
                        title="Rename"
                        onClick={startRename}
                        className="flex items-center justify-center h-[28px] w-[28px] rounded-[6px] transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-active)';
                            (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                        }}
                    >
                        <IconPencil size={14} />
                    </button>

                    {/* Share */}
                    <button
                        aria-label={`Share ${conversation.name || 'conversation'}`}
                        title="Share"
                        onClick={(e) => { e.stopPropagation(); setShowShareModal(true); }}
                        className="flex items-center justify-center h-[28px] w-[28px] rounded-[6px] transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-active)';
                            (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                        }}
                    >
                        <IconShare size={14} />
                    </button>

                    {/* Delete */}
                    <button
                        aria-label={`Delete ${conversation.name || 'conversation'}`}
                        title="Delete"
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteOpen(true); }}
                        className="flex items-center justify-center h-[28px] w-[28px] rounded-[6px] transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-active)';
                            (e.currentTarget as HTMLElement).style.color = '#f87171'; // red-400
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                        }}
                    >
                        <IconTrash size={14} />
                    </button>
            </div>

            {/* Share modal — portalled to document.body */}
            {showShareModal && typeof document !== 'undefined' && ReactDOM.createPortal(
                <NewUIShareModal
                    conversationId={conversation.id}
                    conversationTitle={conversation.name}
                    onClose={() => { setShowShareModal(false); setIsHovered(false); }}
                />,
                document.body
            )}

            {/* Delete confirmation dialog */}
            <ConfirmDialog
                isOpen={confirmDeleteOpen}
                title="Delete conversation?"
                message={
                    <>
                        Are you sure you want to delete{' '}
                        <strong style={{ color: 'var(--text-primary)' }}>
                            {conversation.name || 'this conversation'}
                        </strong>
                        ? This cannot be undone.
                    </>
                }
                confirmLabel="Delete"
                onConfirm={() => {
                    setConfirmDeleteOpen(false);
                    setIsHovered(false);
                    onDelete(conversation);
                }}
                onCancel={() => setConfirmDeleteOpen(false)}
            />
        </div>
    );
};

export default ChatsListView;
