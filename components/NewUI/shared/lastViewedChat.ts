/**
 * lastViewedChat — the "put me back in the chat I was reading" rule, React-free.
 *
 * home.tsx's startup effect mints a fresh `New Conversation` and selects it on every
 * load, and the new UI shows the landing page for any conversation with zero messages.
 * So a plain browser refresh always drops the user on the new-chat view, even when they
 * were mid-way through reading a conversation. This module holds the decisions behind
 * fixing that; `LastChatRestore.tsx` is the thin component that applies them.
 *
 * The id lives in **sessionStorage**, deliberately:
 *   - a refresh keeps it (that is the case we are fixing),
 *   - a brand-new tab starts clean rather than inheriting another tab's chat,
 *   - two tabs open on two different conversations do not overwrite each other.
 *
 * The hard part is not the storage — it is that `conversation.messages` is NOT a
 * reliable measure of "does this chat have content?" for a record out of
 * `state.conversations`. Three different shapes live in that one array:
 *
 *   - local, compressed:  `messages: []` + `compressedMessages: number[]`
 *     (`compressAllConversationMessages` on load, `condenseForConversationHistory`
 *      on every update) — a full conversation whose `messages.length` is 0
 *   - cloud metadata:     `messages` MISSING ENTIRELY
 *     (`updateWithRemoteConversations` writes the raw `/get/all` records into
 *      `conversations` without running them through `cleanConversationHistory`,
 *      which is the only thing that backfills `messages: []`)
 *   - full:               `messages: Message[]`
 *     (whatever was last dispatched by a send or an in-place update)
 *
 * So "no messages" means *unknown*, not *empty*, and the two functions below keep those
 * apart: content is proven by `messages`, by `compressedMessages`, or by the record being
 * cloud-stored (its messages live server-side). Reading `messages.length` blind is how
 * `messages is undefined` reached home.tsx's render.
 */

import { Conversation } from '@/types/chat';
import { isRemoteConversation } from '@/utils/app/conversation';

export const LAST_CHAT_KEY = 'amplify_last_chat_id';

/** `undefined` when the field is missing — deliberately not conflated with 0. */
const messageCount = (conversation: Conversation): number | undefined =>
  Array.isArray(conversation.messages) ? conversation.messages.length : undefined;

const hasCompressedMessages = (conversation: Conversation): boolean =>
  Array.isArray(conversation.compressedMessages) && conversation.compressedMessages.length > 0;

/**
 * What to do with the stored id for the view the user is currently on.
 *
 * `'keep'` exists because a conversation whose message state is *unknown* (cloud
 * metadata, or a still-compressed record) must not be allowed to erase a perfectly good
 * stored id — clearing on unknown is how the feature quietly stops working for
 * cloud-storage users.
 */
export type RecordedChatAction =
  | { action: 'record'; id: string }
  | { action: 'clear' }
  | { action: 'keep' };

export const nextRecordedChat = (
  page: string | undefined,
  conversation: Conversation | null | undefined,
): RecordedChatAction => {
  // The user is looking at the Library / Chats / assistant gallery / notebook: a refresh
  // there must behave exactly as it does today, so drop the id.
  if (page !== 'chat') return { action: 'clear' };
  if (!conversation || !conversation.id) return { action: 'clear' };

  const count = messageCount(conversation);
  if (count !== undefined && count > 0) return { action: 'record', id: conversation.id };

  // Content that is merely compressed or held server-side is still content, but this is
  // not the shape a *viewed* conversation normally has — don't record it, don't clear.
  if (hasCompressedMessages(conversation) || count === undefined) return { action: 'keep' };

  // A genuinely empty chat: the landing / new-chat view.
  return { action: 'clear' };
};

/**
 * The conversation to re-open, normalized so it is safe to hand to
 * `handleSelectConversation`, or `null` if the stored id is not restorable.
 *
 * Restorable means the record shows evidence of content in any of its three shapes (see
 * the header note). `messages` is guaranteed to be an array on the way out: several
 * old-UI paths dispatch a history record straight into `selectedConversation`, and
 * home.tsx's render reads `selectedConversation.messages.length` — a missing field there
 * is an unhandled TypeError, not a fallback. Adding `messages: []` never blocks
 * decompression, because `conversationWithUncompressedMessages` keys off
 * `compressedMessages`, which is left untouched.
 */
export const findRestorableConversation = (
  id: string | null | undefined,
  conversations: Conversation[] | null | undefined,
): Conversation | null => {
  if (!id || !conversations || conversations.length === 0) return null;

  const match = conversations.find((c) => c && c.id === id);
  if (!match) return null;

  const count = messageCount(match);
  const hasContent =
    (count !== undefined && count > 0) ||
    hasCompressedMessages(match) ||
    // Cloud-stored: local history holds metadata only, the messages are fetched on select.
    isRemoteConversation(match);

  if (!hasContent) return null;

  return count === undefined ? ({ ...match, messages: [] } as Conversation) : match;
};
