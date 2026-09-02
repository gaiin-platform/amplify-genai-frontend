/**
 * chatFilters — one implementation of the conversation filter/sort vocabulary,
 * shared by the "Chats and tasks" view and the sidebar Recents section so the two
 * always agree on what "Pinned", "Cloud" or "With assistant" mean.
 *
 * No React, no service calls — pure predicates over Conversation objects.
 *
 * A group is only offered when it can actually discriminate over the current list
 * (see buildChatFilterGroups). Cloud-stored conversations are stripped down to
 * {id, name, model, folderId, tags, isLocal, groupType, codeInterpreterRecordId, date}
 * by remoteForConversationHistory(), so an assistant can only be resolved for
 * local conversations — hiding the group when nothing resolves keeps the control
 * from silently lying.
 */
import { Conversation } from '@/types/chat';
import { isLocalConversation, isRemoteConversation } from '@/utils/app/conversation';
import { isAssistant } from '@/utils/app/assistants';
// Type-only import: keeps this module free of any React/runtime dependency.
import type { FilterGroupSpec } from '@/components/NewUI/shared/FilterMenu';

export type ChatSortKey = 'name' | 'assistant' | 'date';

/** Single-select sort options, used where there are no sortable column headers. */
export type ChatSortMode = 'recent' | 'oldest' | 'name';

export const CHAT_FILTER_DEFAULTS: Record<string, string> = {
    pinned: 'all',
    storage: 'all',
    assistant: 'all',
    sort: 'recent',
};

/**
 * Pinned state lives in `conversation.data.pinned` — same detection as
 * ConversationRow so every view agrees.
 * TODO: once `pinned?: boolean` exists on the Conversation type, simplify to c.pinned.
 */
export function isPinnedConv(c: Conversation): boolean {
    return !!(c.data?.pinned) || !!(c as any).pinned;
}

/** The conversation's assistant name, when it can be determined (local only). */
export function conversationAssistantName(c: Conversation): string | null {
    const template = c.promptTemplate;
    if (!template || !isAssistant(template)) return null;
    return template.data?.assistant?.definition?.name ?? null;
}

interface BuildGroupsOptions {
    /** Offer "Pinned only". Off in the sidebar, which already has a Pinned section. */
    includePinned?: boolean;
    /** Offer single-select sort options. Off where column headers own sorting. */
    includeSort?: boolean;
}

export function buildChatFilterGroups(
    conversations: Conversation[],
    { includePinned = true, includeSort = false }: BuildGroupsOptions = {}
): FilterGroupSpec[] {
    const groups: FilterGroupSpec[] = [];

    if (includePinned) {
        groups.push({
            id: 'pinned',
            label: 'Show',
            options: [
                { id: 'all', label: 'All chats' },
                { id: 'pinned', label: 'Pinned only' },
            ],
        });
    }

    if (conversations.some(isRemoteConversation)) {
        groups.push({
            id: 'storage',
            label: 'Storage',
            options: [
                { id: 'all', label: 'All' },
                { id: 'cloud', label: 'Cloud' },
                { id: 'local', label: 'Local' },
            ],
        });
    }

    if (conversations.some((c) => !!conversationAssistantName(c))) {
        groups.push({
            id: 'assistant',
            label: 'Assistant',
            options: [
                { id: 'all', label: 'All' },
                { id: 'with', label: 'With assistant' },
                { id: 'without', label: 'No assistant' },
            ],
        });
    }

    if (includeSort) {
        groups.push({
            id: 'sort',
            label: 'Sort by',
            options: [
                { id: 'recent', label: 'Last activity' },
                { id: 'oldest', label: 'Oldest first' },
                { id: 'name', label: 'Name (A–Z)' },
            ],
        });
    }

    return groups;
}

/**
 * Apply the filter groups to a list. Only groups present in `groups` are applied,
 * so a stale value for a group that is no longer offered can never filter
 * invisibly. Sorting is deliberately not applied here — callers sort differently
 * (column headers vs. the sidebar's time buckets).
 */
export function applyChatFilters(
    conversations: Conversation[],
    filters: Record<string, string>,
    groups: FilterGroupSpec[]
): Conversation[] {
    const offered = new Set(groups.map((g) => g.id));
    let list = conversations;

    if (offered.has('pinned') && filters.pinned === 'pinned') {
        list = list.filter(isPinnedConv);
    }
    if (offered.has('storage') && filters.storage && filters.storage !== 'all') {
        list = list.filter((c) =>
            filters.storage === 'cloud' ? isRemoteConversation(c) : isLocalConversation(c)
        );
    }
    if (offered.has('assistant') && filters.assistant && filters.assistant !== 'all') {
        list = list.filter((c) =>
            filters.assistant === 'with'
                ? !!conversationAssistantName(c)
                : !conversationAssistantName(c)
        );
    }

    return list;
}

/** How many offered groups sit away from their default (drives the active badge). */
export function countActiveChatFilters(
    filters: Record<string, string>,
    groups: FilterGroupSpec[]
): number {
    return groups.reduce((n, g) => {
        const current = filters[g.id] ?? CHAT_FILTER_DEFAULTS[g.id];
        return current !== CHAT_FILTER_DEFAULTS[g.id] ? n + 1 : n;
    }, 0);
}

/**
 * Comparator for the sortable-column-header case (Chats and tasks view).
 * Ties break on name so the order is stable between renders.
 */
export function compareConversations(
    key: ChatSortKey,
    direction: 'asc' | 'desc'
): (a: Conversation, b: Conversation) => number {
    const sign = direction === 'asc' ? 1 : -1;
    return (a, b) => {
        let comparison = 0;
        if (key === 'name') {
            comparison = a.name.localeCompare(b.name, undefined, {
                numeric: true,
                sensitivity: 'base',
            });
        } else if (key === 'assistant') {
            const aName = conversationAssistantName(a) ?? '';
            const bName = conversationAssistantName(b) ?? '';
            // Conversations without an assistant always sort last
            if (!aName !== !bName) return aName ? -1 : 1;
            comparison = aName.localeCompare(bName, undefined, {
                numeric: true,
                sensitivity: 'base',
            });
        } else {
            comparison =
                (a.date ? Date.parse(a.date) || 0 : 0) - (b.date ? Date.parse(b.date) || 0 : 0);
        }
        return comparison === 0
            ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
            : comparison * sign;
    };
}

/** Comparator for the single-select sort options used in the sidebar. */
export function compareConversationsByMode(
    mode: ChatSortMode
): (a: Conversation, b: Conversation) => number {
    if (mode === 'name') return compareConversations('name', 'asc');
    return compareConversations('date', mode === 'oldest' ? 'asc' : 'desc');
}
