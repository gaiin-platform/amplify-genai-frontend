import { IconFileCheck } from '@tabler/icons-react';
import { useSession } from 'next-auth/react';
import React, { useContext, useEffect, useRef } from 'react';

import { useSendService } from '@/hooks/useChatSendService';

import { executeAssistantApiCall } from '@/services/assistantAPIService';
import { execOp } from '@/services/opsService';
import { getDbsForUser } from '@/services/pdbService';

import { filterModels } from '@/utils/app/models';
import {
  getApiCalls,
  getServerProvidedOpFormat,
  getServerProvidedOps,
  parseApiCalls,
  resolveOpDef,
  resolveServerHandler,
} from '@/utils/app/ops';
import { getSettings } from '@/utils/app/settings';
import { deepMerge } from '@/utils/app/state';

import { Conversation, Message, newMessage } from '@/types/chat';
import { FolderInterface } from '@/types/folder';
import { ApiCall, OpDef } from '@/types/op';
import { Prompt } from '@/types/prompt';

import HomeContext from '@/pages/api/home/home.context';

import ExpansionComponent from '@/components/Chat/ExpansionComponent';

import JSON5 from 'json5';

interface Props {
  conversation: Conversation;
  message: Message;
  onStart: (id: string, action: any) => void;
  onEnd: (id: string, action: any) => void;
  action: any;
  ready: boolean;
  id: string;
  isLast: boolean;
}

const hasExecuted: { [key: string]: boolean } = {};

const InvokeBlock: React.FC<Props> = ({
  action,
  ready,
  id,
  isLast,
  onEnd,
  onStart,
  message,
  conversation,
}) => {
  const {
    state: {
      selectedConversation,
      selectedAssistant,
      conversations,
      folders,
      models,
      prompts,
      defaultModelId,
      featureFlags,
      workspaceMetadata,
    },
    shouldStopConversation,
    handleCreateFolder,
    dispatch: homeDispatch,
    handleAddMessages: handleAddMessages,
  } = useContext(HomeContext);

  const promptsRef = useRef(prompts);

  useEffect(() => {
    promptsRef.current = prompts;
  }, [prompts]);

  const conversationsRef = useRef(conversations);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const foldersRef = useRef(folders);

  useEffect(() => {
    foldersRef.current = folders;
  }, [folders]);

  const { data: session, status } = useSession();

  const { handleSend } = useSendService();

  const getServerSelectedAssistant = (message: Message) => {
    const aid =
      message.data && message.data.state
        ? message.data.state.currentAssistantId
        : null;

    console.log(`Server-set assistantId: "${aid}"`);

    return aid;
  };

  const getOpTitle = (message: Message, url: string) => {
    return 'Remote Operation';
  };

  const runAction = async (action: any) => {
    try {
      if (!isLast || hasExecuted[id] || message.data.automation) {
        console.log(
          'Skipping execution of action:',
          action,
          'isLast:',
          isLast,
          'hasExecuted:',
          hasExecuted[id],
          'automation:',
          message.data.automation,
        );
        return;
      }
      hasExecuted[id] = true;

      homeDispatch({
        type: 'conversation',
        action: {
          type: 'updateMessages',
          conversationId: conversation.id,
          messages: [
            {
              ...message,
              data: {
                ...message.data,
                automation: {
                  status: 'running',
                },
              },
            },
          ],
        },
      });

      const context = {
        conversation,
      };

      const shouldConfirm = false;
      let actionData = null;

      try {
        actionData = JSON5.parse(action);
      } catch (e) {
        console.error(e);
        return null;
      }

      const title = actionData.name;

      homeDispatch({ field: 'loading', value: true });
      homeDispatch({ field: 'messageIsStreaming', value: true });

      const opDef = resolveOpDef(message, actionData.name);

      const requestData = {
        action: actionData,
        conversation: selectedConversation?.id,
        assistant: selectedAssistant?.id,
        message: message.id,
        operationDefinition: opDef
      };

      const result = await executeAssistantApiCall(requestData);

      console.log('Result of operation:', result);

      if (result && result.metaEvents) {
        const metaEvents = result.metaEvents;
        delete result.metaEvents;

        // Find all meta events with a state key
        const states = metaEvents
          .filter((e: any) => e.state)
          .map((e: any) => e.state);
        const state = deepMerge({}, ...states);

        console.log('Final state from meta', state);

        if (state.sources) {
          result.sources = state.sources;
        }
      }

      // If the result returns a pause, we should stop sending messages to the assistant
      const pauseMessage = result.data && result.data.pause;
      if (pauseMessage) {
        homeDispatch({ field: 'loading', value: false });
        homeDispatch({ field: 'messageIsStreaming', value: false });

        if (pauseMessage.data.pause.message) {
          // check if pauseMessage.pause.message is a string
          if (typeof pauseMessage.data.pause.message === 'string') {
            // Add the message to the conversation
            handleAddMessages(selectedConversation, [
              newMessage({
                role: 'assistant',
                content: pauseMessage.data.pause.message,
              }),
            ]);
          } else {
            // Add the message to the conversation
            handleAddMessages(selectedConversation, [
              pauseMessage.data.pause.message,
            ]);
          }
        } else {
          alert('Pause message is missing from the result of the operation.');
        }
      } else if (!shouldStopConversation()) {
        const sourcesList = result.sources;

        console.log('Sources list:', sourcesList);

        const feedbackMessage = {
          result: result,
        };

        const assistantId =
          getServerSelectedAssistant(message) || selectedAssistant?.id;

        if (!shouldStopConversation()) {
          homeDispatch({ field: 'loading', value: true });
          homeDispatch({ field: 'messageIsStreaming', value: true });

          handleSend(
            {
              options: { assistantId },
              message: newMessage({
                role: 'user',
                content: JSON.stringify(feedbackMessage),
                label: title || 'API Result',
                data: {
                  actionResult: true,
                  state: {
                    sources: sourcesList,
                  },
                },
              }),
            },
            shouldStopConversation,
          );
        }
      }
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  useEffect(() => {
    if (ready) {
      runAction(action);
    }
  }, [ready, action]);

  return (
    <div>
      <div className="rounded-xl text-neutral-600 border-2 dark:border-none dark:text-white bg-neutral-100 dark:bg-[#343541] rounded-md shadow-lg mb-2 mr-2">
        <ExpansionComponent
          title={'I am working on your request...'}
          content={action}
        />
      </div>
    </div>
  );
};

export default InvokeBlock;
