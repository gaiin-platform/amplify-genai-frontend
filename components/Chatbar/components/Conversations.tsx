import { Conversation } from '@/types/chat';
import { ConversationComponent } from './Conversation';

interface Props {
  conversations: Conversation[];
}

export const Conversations = ({ conversations }: Props) => {

  return (
    <div className="mt-2 flex w-full flex-col gap-0.5">
      {conversations
        .slice()
        .reverse()
        .map((conversation, index) => (
          <ConversationComponent key={index} conversation={conversation} />
        ))}
    </div>
  );
};
