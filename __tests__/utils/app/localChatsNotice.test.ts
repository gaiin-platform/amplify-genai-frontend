import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/Home/home.context', () => ({ default: {} }));
vi.mock('@/utils/app/conversationStorage', () => ({ handleStorageSelection: vi.fn(), reconcileSelectedAfterStorageChange: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { custom: vi.fn(), dismiss: vi.fn(), error: vi.fn() }) }));

import { countLocalOnlyChats, shouldShowLocalChatsNotice } from '@/components/NewUI/shared/LocalChatsNotice';
import { isBlankPlaceholderConversation } from '@/components/NewUI/shared/chatFilters';

const base = { storeCloudConversations: true, storageSelection: 'future-cloud', localChatCount: 3, snoozedUntil: 0, now: 1000 };

describe('local chats notice', () => {
  it('shows for a cloud-enabled user who has chats only in this browser', () => {
    expect(shouldShowLocalChatsNotice(base)).toBe(true);
    expect(shouldShowLocalChatsNotice({ ...base, storageSelection: null })).toBe(true);
  });

  it('stays quiet for users who deliberately chose local-only storage', () => {
    expect(shouldShowLocalChatsNotice({ ...base, storageSelection: 'local-only' })).toBe(false);
  });

  it('stays quiet when cloud storage is unavailable, when nothing is local, or while snoozed', () => {
    expect(shouldShowLocalChatsNotice({ ...base, storeCloudConversations: false })).toBe(false);
    expect(shouldShowLocalChatsNotice({ ...base, localChatCount: 0 })).toBe(false);
    expect(shouldShowLocalChatsNotice({ ...base, snoozedUntil: 5000 })).toBe(false);
  });

  it('counts only local chats with real content', () => {
    const chats: any[] = [
      { id: 'a', name: 'Budget', isLocal: true, messages: [], compressedMessages: [1, 2] },
      { id: 'b', name: 'New Conversation', isLocal: true, messages: [] },            // placeholder
      { id: 'c', name: 'In the cloud', isLocal: false, messages: [] },               // cloud stub
      { id: 'd', name: 'Old chat', messages: [], compressedMessages: [3] },          // legacy entry without isLocal = local
    ];
    expect(countLocalOnlyChats(chats)).toBe(2);
  });
});

describe('blank placeholder detection', () => {
  it('does not treat a cloud stub that knows its message count as blank', () => {
    expect(isBlankPlaceholderConversation({ id: 'x', name: 'New Conversation', isLocal: false, messages: [], messageCount: 4 } as any)).toBe(false);
  });

  it('never treats a chat with an unreadable stored blob as blank (the cleanup would delete it)', () => {
    expect(isBlankPlaceholderConversation({ id: 'x', name: 'New Conversation', isLocal: true, messages: [], corruptCompressedMessages: [9, 9] } as any)).toBe(false);
  });

  it('still recognises a genuinely empty placeholder', () => {
    expect(isBlankPlaceholderConversation({ id: 'x', name: 'New Conversation', isLocal: true, messages: [] } as any)).toBe(true);
  });
});
