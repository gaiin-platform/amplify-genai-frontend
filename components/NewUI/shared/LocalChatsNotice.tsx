/**
 * LocalChatsNotice — tells users whose chats exist ONLY in this browser, and offers to move them to their
 * account. Renders nothing itself; it shows a toast once per load when it applies.
 *
 * Why: conversations stored locally are bound to one browser profile. Switching browser or computer, clearing
 * site data, or a browser purging storage makes them disappear, and nothing on the server can bring them
 * back. Users who started with local storage (the former default) are not told this anywhere, and the
 * cloud-by-default setting of the new UI deliberately does not move existing chats.
 *
 * Conservative on purpose:
 *   - not shown to users who chose "local only" themselves (that is a deliberate privacy choice),
 *   - not shown when cloud storage is unavailable for the deployment,
 *   - only counts chats with real content (placeholders are ignored),
 *   - can be dismissed for 30 days or for good.
 * The move itself is the existing "all conversations -> cloud" migration (handleStorageSelection).
 */

import React, { useContext, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import HomeContext from '@/components/Home/home.context';
import { Conversation } from '@/types/chat';
import { isLocalConversation, saveConversations } from '@/utils/app/conversation';
import { handleStorageSelection, reconcileSelectedAfterStorageChange } from '@/utils/app/conversationStorage';
import { isBlankPlaceholderConversation } from '@/components/NewUI/shared/chatFilters';

const SNOOZE_KEY = 'localChatsNoticeSnoozedUntil';
const NEVER = Number.MAX_SAFE_INTEGER;
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

export const countLocalOnlyChats = (conversations: Conversation[]) =>
  conversations.filter((c) => isLocalConversation(c) && !isBlankPlaceholderConversation(c)).length;

export const shouldShowLocalChatsNotice = (opts: {
  storeCloudConversations: boolean;
  storageSelection: string | null;
  localChatCount: number;
  snoozedUntil: number;
  now: number;
}) =>
  opts.storeCloudConversations &&
  opts.storageSelection !== 'local-only' &&
  opts.localChatCount > 0 &&
  opts.now >= opts.snoozedUntil;

export const LocalChatsNotice: React.FC = () => {
  const {
    state: { conversations, folders, conversationStateId, featureFlags, statsService, syncingConversations, selectedConversation },
    dispatch,
  } = useContext(HomeContext);

  const shownRef = useRef(false);
  const conversationsRef = useRef(conversations);
  const foldersRef = useRef(folders);
  const selectedRef = useRef(selectedConversation);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  useEffect(() => { foldersRef.current = folders; }, [folders]);
  useEffect(() => { selectedRef.current = selectedConversation; }, [selectedConversation]);

  useEffect(() => {
    if (shownRef.current) return;
    // wait until the stored chats are loaded and the cloud sync has finished, so the count is meaningful
    if (conversationStateId !== 'post-init' || syncingConversations) return;

    const snoozedUntil = Number(localStorage.getItem(SNOOZE_KEY) ?? 0) || 0;
    const localChatCount = countLocalOnlyChats(conversations ?? []);
    if (!shouldShowLocalChatsNotice({
      storeCloudConversations: !!featureFlags?.storeCloudConversations,
      storageSelection: localStorage.getItem('storageSelection'),
      localChatCount,
      snoozedUntil,
      now: Date.now(),
    })) return;

    shownRef.current = true;

    const moveToCloud = async (toastId: string) => {
      toast.dismiss(toastId);
      dispatch({ field: 'storageProcessing', value: { isProcessing: true, message: 'Moving conversations to cloud storage...', progress: 0, total: 0 } });
      try {
        const updated = await handleStorageSelection(
          'cloud-only',
          conversationsRef.current,
          foldersRef.current,
          statsService,
          (current, total) => dispatch({ field: 'storageProcessing', value: { isProcessing: true, message: 'Moving conversations to cloud storage...', progress: current, total } }),
          () => conversationsRef.current,
        );
        if (updated) {
          dispatch({ field: 'conversations', value: updated });
          saveConversations(updated);
          if (selectedRef.current) {
            dispatch({ field: 'selectedConversation', value: reconcileSelectedAfterStorageChange(selectedRef.current, updated) });
          }
        }
      } catch (e) {
        console.error('[LocalChatsNotice] move to cloud failed', e);
        toast.error('Could not move your conversations to the cloud. They are still stored in this browser.');
      } finally {
        dispatch({ field: 'storageProcessing', value: { isProcessing: false, message: '', progress: 0, total: 0 } });
      }
    };

    toast.custom((t) => (
      <div
        className="max-w-md rounded-lg border border-neutral-300 bg-white p-4 text-sm text-neutral-800 shadow-lg dark:border-neutral-600 dark:bg-[#202123] dark:text-neutral-100"
        role="status"
      >
        <div className="font-semibold">
          {localChatCount === 1 ? '1 conversation is' : `${localChatCount} conversations are`} stored only in this browser
        </div>
        <p className="mt-1 text-neutral-600 dark:text-neutral-300">
          They will not appear on another browser or computer, and they are lost if this browser&apos;s data is cleared.
          Move them to your account to keep them safe and reach them anywhere.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="rounded bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700"
            onClick={() => moveToCloud(t.id)}
          >
            Move to cloud
          </button>
          <button
            className="rounded border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-700"
            onClick={() => { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)); toast.dismiss(t.id); }}
          >
            Remind me later
          </button>
          <button
            className="rounded px-3 py-1.5 text-neutral-500 hover:underline"
            onClick={() => { localStorage.setItem(SNOOZE_KEY, String(NEVER)); toast.dismiss(t.id); }}
          >
            Don&apos;t ask again
          </button>
        </div>
      </div>
    ), { duration: Infinity, id: 'local-chats-notice' });
  }, [conversationStateId, syncingConversations, conversations, featureFlags, dispatch, statsService]);

  return null;
};

export default LocalChatsNotice;
