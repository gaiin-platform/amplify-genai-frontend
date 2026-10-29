import { describe, expect, it, vi } from 'vitest';

// conversationStorage pulls in the cloud service and conversation helpers; only the pure
// selection helper is under test here.
vi.mock('@/services/remoteConversationService', () => ({
  deleteMultipleRemoteConversations: vi.fn(),
  deleteRemoteConversation: vi.fn(),
  fetchMultipleRemoteConversations: vi.fn(),
  fetchRemoteConversation: vi.fn(),
  uploadConversation: vi.fn(),
}));
vi.mock('@/utils/app/conversation', () => ({
  conversationWithCompressedMessages: vi.fn(),
  conversationWithUncompressedMessages: vi.fn(),
  isLocalConversation: vi.fn(),
  isRemoteConversation: vi.fn(),
  remoteForConversationHistory: vi.fn(),
  saveConversations: vi.fn(),
}));
vi.mock('@/utils/app/basePrompts', () => ({ baseAgentFolder: {} }));

import { getIsLocalStorageSelection } from '@/utils/app/conversationStorage';
import { DEFAULT_CONVERSATION_STORAGE } from '@/types/conversationStorage';
import { DEFAULT_STORAGE_SELECTION } from '@/components/NewUI/shared/userDisplayPrefs';
import { normalizeAdminConversationStorage } from '@/components/NewUI/settings/admin/adminDefaults';

describe('default conversation storage', () => {
  it('is "Cloud going forward"', () => {
    expect(DEFAULT_CONVERSATION_STORAGE).toBe('future-cloud');
  });

  it('is the same default for the user setting and the admin setting', () => {
    expect(DEFAULT_STORAGE_SELECTION).toBe(DEFAULT_CONVERSATION_STORAGE);
    expect(normalizeAdminConversationStorage(undefined)).toBe(DEFAULT_CONVERSATION_STORAGE);
  });

  it('creates new conversations in the cloud when no selection has been made yet', () => {
    expect(getIsLocalStorageSelection(null)).toBe(false);
    expect(getIsLocalStorageSelection('')).toBe(false);
  });

  it.each([
    ['local-only', true],
    ['future-local', true],
    ['cloud-only', false],
    ['future-cloud', false],
  ])('keeps honouring an explicit choice: %s → local=%s', (selection, expectedLocal) => {
    expect(getIsLocalStorageSelection(selection)).toBe(expectedLocal);
  });
});
