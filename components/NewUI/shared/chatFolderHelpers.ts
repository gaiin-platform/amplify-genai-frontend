/**
 * chatFolderHelpers — shared logic for the new sidebar's chat-folder UI
 * (FolderRow, ConversationRow's "Move to folder" menu).
 *
 * `folders` (HomeContext state) mixes two very different things under the
 * same FolderInterface + type:'chat': folders a user actually creates to
 * organize chats, and legacy per-calendar-day folders the app auto-created
 * in the classic UI (name === getDateName(), e.g. "Aug 6, 2026") purely as a
 * date-bucketing mechanism for conversations with no ISO conversation.date.
 * The new sidebar's own Today/Yesterday/Previous grouping (NewSidebar.tsx)
 * already covers that case, so surfacing every legacy day-folder here would
 * just spam long-time users with dozens of junk "folders". isUserChatFolder
 * filters those out by matching the exact getDateName() format.
 */
import { FolderInterface } from '@/types/folder';

const LEGACY_DATE_FOLDER_RE = /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/;

export const isUserChatFolder = (f: FolderInterface): boolean =>
  (!f.type || f.type === 'chat') && !f.isGroupFolder && !LEGACY_DATE_FOLDER_RE.test(f.name);

export const getUserChatFolders = (folders: FolderInterface[]): FolderInterface[] =>
  folders.filter(isUserChatFolder);
