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
    <div className="enhanced-today-section flex w-full flex-col mb-3 pb-2">
      <div className="flex items-center gap-2 px-3 pb-2 pt-3">
        {title.toLowerCase().includes('today') ? (
          <IconCalendarEvent size={16} className="text-blue-500" />
        ) : (
          <IconClock size={16} className="text-purple-500" />
        )}
        <h3 className="enhanced-today-title text-xs font-semibold uppercase tracking-wider">
          {title}
        </h3>
      </div>
      <div className="fade-in flex w-full flex-col gap-1">
        {todayConversations.map((conversation, index) => (
          <ConversationComponent key={index} conversation={conversation} />
        ))}
      </div>
    </div>
  );
};