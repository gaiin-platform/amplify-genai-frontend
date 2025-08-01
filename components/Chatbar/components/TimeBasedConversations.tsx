import { Conversation } from '@/types/chat';
import { ConversationComponent } from './Conversation';
import { IconCalendarEvent, IconClock } from '@tabler/icons-react';

interface Props {
  conversations: Conversation[];
  title: string;
}

export const TimeBasedConversations = ({ conversations, title }: Props) => {
  // Filter conversations that have a date from today
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const todayConversations = conversations
    .filter(conversation => {
      // Only include conversations with dates from today and not in folders
      return conversation.date && 
             conversation.date.startsWith(today) && 
             !conversation.folderId;
    })
    .slice()
    .reverse(); // Most recent first

  // Don't render if there are no conversations from today
  if (todayConversations.length === 0) {
    return null;
  }

  return (
    <div className="enhanced-folder enhanced-folder-open mb-2">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <h3 className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
          {title}
        </h3>
      </div>
      <div className="fade-in flex w-full flex-col">
        {todayConversations.map((conversation, index) => (
          <ConversationComponent key={index} conversation={conversation} />
        ))}
      </div>
    </div>
  );
};