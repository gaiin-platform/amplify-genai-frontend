/**
 * ConversationViewShell — a CSS override wrapper that applies the new
 * conversation-view-spec styling ON TOP of the existing Chat component,
 * without touching Chat.tsx logic at all.
 *
 * Strategy:
 *   - Wraps <Chat /> in a container with `data-new-ui="true"`
 *   - All style overrides live in `conversation-view.css` scoped to [data-new-ui]
 *   - Zero risk to backend-connected logic
 *
 * Per spec (conversation-view-spec.md):
 *   - bg-app background
 *   - 760px centered message column
 *   - User messages: right-aligned bubble, --bg-raised, 16px radius
 *   - Assistant messages: no bubble, full-width left-aligned
 *   - Sticky header 52px
 *   - Docked composer at bottom
 *   - Fade masks on scroll area
 */
import React, { MutableRefObject } from 'react';
import { Chat } from '@/components/Chat/Chat';

interface ConversationViewShellProps {
  stopConversationRef: MutableRefObject<boolean>;
}

export const ConversationViewShell: React.FC<ConversationViewShellProps> = ({
  stopConversationRef,
}) => {
  return (
    <div
      data-new-ui="true"
      className="flex flex-1 overflow-hidden new-ui-chat-shell"
    >
      <Chat stopConversationRef={stopConversationRef} />
    </div>
  );
};

export default ConversationViewShell;
