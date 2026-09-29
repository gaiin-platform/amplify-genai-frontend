import type { ConversationStorage } from '@/types/conversationStorage';

export function normalizeAdminConversationStorage(value: unknown): ConversationStorage {
  return value === 'future-local' || value === 'future-cloud' ? value : 'future-cloud';
}
