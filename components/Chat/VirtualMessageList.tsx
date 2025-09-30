// Strike Team Alpha - Virtual Scrolling Implementation
// Replace the message rendering in Chat.tsx with this optimized version

import React, { useRef, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Message } from '@/types/chat';
import { MemoizedChatMessage } from '@/components/Chat/MemoizedChatMessage';

interface VirtualMessageListProps {
  messages: Message[];
  selectedConversation: any;
  handleEditMessage: (message: Message, index: number) => void;
  handleDeleteMessage: (index: number) => void;
}

export const VirtualMessageList: React.FC<VirtualMessageListProps> = ({
  messages,
  selectedConversation,
  handleEditMessage,
  handleDeleteMessage
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Estimate row height based on message content
  const estimateSize = useCallback((index: number) => {
    const message = messages[index];
    if (!message) return 100;
    
    // Rough estimation: 50px base + 20px per 100 characters
    const contentLength = message.content?.length || 0;
    const baseHeight = 50;
    const contentHeight = Math.ceil(contentLength / 100) * 20;
    
    return baseHeight + contentHeight;
  }, [messages]);
  
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 5, // Render 5 items outside visible area
    // Enable smooth scrolling
    scrollingDelay: 100,
  });
  
  const virtualItems = virtualizer.getVirtualItems();
  
  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    if (messages.length > 0) {
      virtualizer.scrollToIndex(messages.length - 1, {
        behavior: 'smooth',
        align: 'end',
      });
    }
  }, [messages.length, virtualizer]);
  
  // Optimize re-renders with memoized style object
  const listStyle = useMemo(() => ({
    height: `${virtualizer.getTotalSize()}px`,
    width: '100%',
    position: 'relative' as const,
  }), [virtualizer.getTotalSize()]);
  
  return (
    <div 
      ref={parentRef} 
      className="flex-1 overflow-y-auto"
      style={{ contain: 'strict' }} // CSS containment for performance
    >
      <div style={listStyle}>
        {virtualItems.map((virtualItem) => {
          const message = messages[virtualItem.index];
          const isLastMessage = virtualItem.index === messages.length - 1;
          
          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <MemoizedChatMessage
                message={message}
                messageIndex={virtualItem.index}
                onEdit={(editedMessage: Message) => handleEditMessage(editedMessage, virtualItem.index)}
              />
            </div>
          );
        })}
      </div>
      
      {/* Loading indicator for large lists */}
      {messages.length > 1000 && (
        <div className="fixed bottom-20 right-4 bg-blue-500 text-white px-3 py-1 rounded-full text-sm">
          {virtualItems.length} of {messages.length} messages rendered
        </div>
      )}
    </div>
  );
};

// Usage in Chat.tsx - Replace the existing message mapping with:
// <VirtualMessageList 
//   messages={selectedConversationState?.messages || []}
//   selectedConversation={selectedConversation}
//   handleEditMessage={handleEditMessage}
//   handleDeleteMessage={handleDeleteMessage}
// />