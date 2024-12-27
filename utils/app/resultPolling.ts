// utils/polling.ts
import { newMessage } from '@/types/chat';
import { getAsyncResult } from '@/services/assistantAPIService';

export const isPollingResult = (result: any) => {
  return result && result.data && !!result.data.retryIn;
}

export const pollForResult = async (pollConfig: any, handleAddMessages: any, selectedConversation: any) => {
  let result = {data: pollConfig};

  let count = 3;
  while (result.data.retryIn && count > 0) {
    count--;
    console.log("Polling for result");
    handleAddMessages(selectedConversation, [
      newMessage({
        role: 'assistant',
        content: result.data.retryMessage || "I'm still working on that. I'll check back in a bit.",
      }),
    ]);

    await new Promise(resolve => setTimeout(resolve, result.data.retryIn));
    try {
      result = await getAsyncResult(result.data);
    }
    catch (e) {
      return {success: false, message: "Unable to fetch the result of the operation."};
    }
  }

  return result;
};