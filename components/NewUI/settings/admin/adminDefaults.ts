import { DEFAULT_CONVERSATION_STORAGE, type ConversationStorage } from '@/types/conversationStorage';

export function normalizeAdminConversationStorage(value: unknown): ConversationStorage {
  return value === 'future-local' || value === 'future-cloud' ? value : DEFAULT_CONVERSATION_STORAGE;
}
