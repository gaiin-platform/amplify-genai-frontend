export type ConversationStorage = 'local-only' | 'cloud-only' | 'future-local' | 'future-cloud';

/**
 * Where a user's new conversations go when nobody has chosen: not the user, and not an admin
 * default. "Cloud going forward" — new conversations are stored in the cloud; existing ones stay
 * where they are. Every "no selection yet" fallback should use this one constant.
 */
export const DEFAULT_CONVERSATION_STORAGE: ConversationStorage = 'future-cloud';
  
  