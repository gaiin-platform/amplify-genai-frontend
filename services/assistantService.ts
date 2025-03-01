import {AssistantDefinition} from "@/types/assistant";
import {Message, newMessage} from "@/types/chat";
import {Stopper} from "@/utils/app/tools";
import {v4 as uuidv4} from 'uuid';
import { doRequestOp } from "./doRequestOp";

const URL_PATH =  "/assistant";


const addData = (data: { [key: string]: any }) => {
    return (m: Message) => {
        return {...m, data: {...m.data, ...data}}
    };
}

const addDataToMessages = (messages: Message[], data: { [key: string]: any }) => {
    return messages.map((m) => {
        return {...m, data: {...m.data, ...data}}
    });
}

export const createAssistant = async (assistantDefinition: AssistantDefinition, abortSignal = null) => {
    if (!("disclaimer" in assistantDefinition)) assistantDefinition.disclaimer = '';
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/create",
        data: {...assistantDefinition}
    };
    
    if (assistantDefinition.provider === 'openai') {
        if (assistantDefinition.dataSources) {
            assistantDefinition.fileKeys = assistantDefinition.dataSources.map((ds) => ds.id);
        }

        const result =  await doRequestOp(op);

        const id = result.data.assistantId;
        return {assistantId: id, id, provider: 'openai'};
    } else if (assistantDefinition.provider === 'amplify') {

        try {
            const result =  await doRequestOp(op);

            console.log("Create Assistant result:", result);

            return {
                id: result.data.id,
                assistantId: result.data.assistantId,
                provider: 'amplify',
                dataSources: assistantDefinition.fileKeys || [],
                name: assistantDefinition.name || "Unnamed Assistant",
                description: assistantDefinition.description || "No description provided",
                instructions: assistantDefinition.instructions || assistantDefinition.description,
                disclaimer: assistantDefinition.disclaimer || ""
            }
        } catch {
            console.log("Response result failed to parse assistant for correct data");
            return {
                id: null,
                assistantId: null,
                provider: 'amplify'
            }

        }
    }

    return {
        assistantId: uuidv4(),
        provider: 'amplify',
        dataSources: assistantDefinition.fileKeys || [],
        name: assistantDefinition.name || "Unnamed Assistant",
        description: assistantDefinition.description || "No description provided",
        instructions: assistantDefinition.instructions || assistantDefinition.description,
    }
};


export const listAssistants = async () => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: "/list",
    };
    const result =  await doRequestOp(op);
    return result.success ? result.data : [];
}

export const deleteAssistant = async (assistantId: string) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/delete",
        data: {assistantId}
    };
    const result =  await doRequestOp(op);
    return result.success;
}

// Simple function to send a direct message to an assistant (for standalone mode)
import { getSession } from "next-auth/react";
import { sendChatRequestWithDocuments } from "./chatService";

export const sendDirectAssistantMessage = async (
  chatEndpoint: string,
  assistantId: string,
  assistantName: string,
  message: string,
  model: any,
  previousMessages: Array<{role: string, content: string}> = []
) => {
  try {
    const session = await getSession();
    
    // @ts-ignore
    if (!session || !session.accessToken || !chatEndpoint) {
      throw new Error("No session or chat endpoint available");
    }
    
    const controller = new AbortController();
    
    // Create user message with assistant data embedded
    const userMessage = {
      role: 'user',
      content: message,
      // This is the critical part - message data needs to include assistant info
      data: {
        assistant: {
          definition: {
            assistantId: assistantId,
            name: assistantName
          }
        }
      }
    };
    
    // Convert previous messages to proper format with assistant data
    const formattedPreviousMessages = previousMessages.map(msg => {
      if (msg.role === 'user') {
        return {
          ...msg,
          data: {
            assistant: {
              definition: {
                assistantId: assistantId,
                name: assistantName
              }
            }
          }
        };
      }
      return msg;
    });
    
    // Add the current message to the history
    const allMessages = [...formattedPreviousMessages, userMessage];
    
    const chatBody = {
      model: model,
      messages: allMessages,
      temperature: 0.7,
      maxTokens: model?.outputTokenLimit ? Math.round(model.outputTokenLimit / 2) : 2000,
      // Pass assistantId directly in the top level and in options
      assistantId: assistantId,
      options: {
        assistantId: assistantId,
        assistantName: assistantName,
        skipRag: false,
        skipCodeInterpreter: false,
        skipMemory: true // Skip memory processing
      }
    };

    // @ts-ignore
    const response = await sendChatRequestWithDocuments(chatEndpoint, session.accessToken, chatBody, controller.signal);
    
    return {
      success: response.ok,
      response
    };
  } catch (error) {
    console.error("Error sending message to assistant:", error);
    return {
      success: false,
      error
    };
  }
}
