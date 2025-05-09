import { IconFileCheck } from '@tabler/icons-react';
import { useSession } from 'next-auth/react';
import React, { useContext, useEffect, useRef } from 'react';

import { useSendService } from '@/hooks/useChatSendService';

import { executeAssistantApiCall } from '@/services/assistantAPIService';
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

import { Conversation, Message, MessageType, newMessage } from '@/types/chat';
import { FolderInterface } from '@/types/folder';
import { ApiCall, OpDef } from '@/types/op';
import { Prompt } from '@/types/prompt';

import HomeContext from '@/pages/api/home/home.context';

import ExpansionComponent from '@/components/Chat/ExpansionComponent';

import JSON5 from 'json5';
import { isPollingResult, pollForResult } from '@/utils/app/resultPolling';

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
      prompts,
    },
    shouldStopConversation,
    handleConversationAction,
    dispatch: homeDispatch,
    handleAddMessages,
  } = useContext(HomeContext);

  const promptsRef = useRef(prompts);

  useEffect(() => {
    promptsRef.current = prompts;
  }, [prompts]);

  const conversationsRef = useRef(conversations);
  const selectedConversationRef = useRef(selectedConversation);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const foldersRef = useRef(folders);

  useEffect(() => {
    foldersRef.current = folders;
  }, [folders]);

  const { data: session, status } = useSession();

  const { handleSend } = useSendService();

  const shouldProvideResultToAssistant = (result:any) => {
    return !(result && result.data && result.data?.humanOnly);
  }

  const getAssistantResultView = (result:any) => {
    return result;
  }

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

      let actionData = null;
      try {
        actionData = JSON5.parse(action);
      } catch (e) {
        console.log("Invalid action spec: "+ action);
        console.error(e);
        return null;
      }

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


      // Count the number of messages with data.actionResult

      console.log("Last four messages: ", conversation.messages.slice(-4));

      const errorsValues = conversation.messages.slice(-4).map(
        (m, idx):number => {
          if(m.data && m.data.actionResult){
            try {
              const data = JSON5.parse(m.content);
              return (data.result && data.result.success) ? 0 : 1;
            } catch (error) {
              return 0;
            }
          }
          else {
            return 0;
          }
        },
      );

      console.log("Errors values: ", errorsValues);

      // Count the number of errors over the last 4 messages
      const errorCount = errorsValues.reduce((a, b) => a + b, 0);
      console.log("Error count over last four messages: "+errorCount);


      const title = actionData.name;

      if (title === 'tellUser') {
        //alert("Tell user!")

        //alert(actionData.payload.message);
        //alert(message.content);

        await handleConversationAction({
              type: 'updateMessages',
              conversation: conversation,
              messages: [
                {...message, content: actionData.payload.message},
              ],
            });

        return;
      }

      console.log("############### Updating message with automation status");

      await handleConversationAction({
              type: 'updateMessages',
              conversation: conversation,
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
            });


      // homeDispatch({ field: 'selectedConversation', value: conversation });

      const context = {
        conversation,
      };

      const shouldConfirm = false;

      homeDispatch({ field: 'loading', value: true });
      homeDispatch({ field: 'messageIsStreaming', value: true });

      let result = null;

      const opDef = resolveOpDef(message, actionData.name);

      // if(opDef) {

        const requestData = {
          action: actionData,
          conversation: selectedConversation?.id,
          assistant: selectedAssistant?.id,
          message: message.id,
          operationDefinition: opDef
        };

        console.log("Executing action:", requestData);

        result = await executeAssistantApiCall(requestData);
      // }
      // else {
      //   result = {
      //     "success":false,
      //     "message":"No operation definition found for action. Double check that you " +
      //       "specified a name and other needed items to invoke the function"};
      // }

      if(isPollingResult(result)){
        result = await pollForResult({retryIn:1000}, handleAddMessages, selectedConversation);
      }

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

        let feedbackMessage = {
          result: getAssistantResultView(result),
        };

        if(!result.success && errorCount > 0){
          feedbackMessage = {
            result: {instructions:"Stop and tell the user that you have run into repeated errors and ask if you should try again.", error:result},
          };
        }

        if(!shouldProvideResultToAssistant(result)){
          // This is for large responses that should not be sent to the assistant
          // for efficiency reasons

          handleAddMessages(selectedConversationRef.current, [
            newMessage(
              {
                role:"assistant",
                content:"I have completed the operation.",
                data:{
                  actionResult:true,
                  actionResultView:{
                    data: result,
                  },
                  state: {
                    sources: sourcesList
                  }
                }
              }
            )
          ]);

          homeDispatch({ field: 'messageIsStreaming', value: false });
          homeDispatch({ field: 'loading', value: false });

          return;
        }

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
          content={<div style={{  wordWrap: 'break-word', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>
                      {action}
                  </div>}
        />
      </div>
    </div>
  );
};

export default InvokeBlock;
