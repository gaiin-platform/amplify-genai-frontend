import { Conversation } from '@/types/chat';
import { ConversationComponent } from './Conversation';
import { IconCalendarEvent } from '@tabler/icons-react';

interface Props {
  conversations: Conversation[];
}

export const TodayConversations = ({ conversations }: Props) => {
  // Get today's date
  const now = new Date();
  const today = now.toISOString().substring(0, 10); // YYYY-MM-DD

  // Filter conversations to only those from today
  const todayConversations = conversations
    .filter(conversation => {
      if (!conversation.date) return false;

      // Try to handle both ISO format dates and other date formats
      if (conversation.date.startsWith(today)) {
        return true;
      }

      // For dates in full ISO format (with time)
      try {
        const convDate = new Date(conversation.date);
        return convDate.getFullYear() === now.getFullYear() &&
               convDate.getMonth() === now.getMonth() &&
               convDate.getDate() === now.getDate();
      } catch (e) {
        return false;
      }
    })
    .slice()
    .reverse(); // Newest first

  return (
    <div className="enhanced-today-section flex w-full flex-col border-b dark:border-neutral-700 mb-3 pb-3">
      <div className="flex items-center gap-2 px-3 pb-2 pt-3">
        <IconCalendarEvent size={16} className="text-blue-500" />
        <h3 className="enhanced-today-title text-xs font-semibold uppercase tracking-wider">
          Today
        </h3>
      </div>
      <div className="fade-in flex w-full flex-col gap-1">
        {todayConversations.length > 0 ? (
          todayConversations.map((conversation, index) => (
            <ConversationComponent key={index} conversation={conversation} />
          ))
        ) : (
          <div className="px-4 py-2 text-xs text-neutral-500 dark:text-neutral-400 italic bg-neutral-100 dark:bg-neutral-800/40 rounded-md mx-3">
            No conversations from today
          </div>
        )}
      </div>
    </div>
  );
};