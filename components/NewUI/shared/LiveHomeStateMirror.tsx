/**
 * LiveHomeStateMirror — renders nothing. Keeps `useSendService`'s module-level mirror of the
 * selected conversation id and the conversation list current for the life of the page.
 *
 * Why: the chat view is keyed by conversation id, so clicking away from a chat that is still
 * generating unmounts the component that owns the send. Its render-refreshed refs then go stale
 * and the send's later `selectedConversation` writes passed the "is this still selected?" guard,
 * yanking the user back. Mounted at the new-UI root in `home.tsx`.
 */
import { useLiveHomeStateMirror } from '@/hooks/useChatSendService';

export function LiveHomeStateMirror() {
  useLiveHomeStateMirror();
  return null;
}
