import {AssistantDefinition, AssistantProviderID} from "@/types/assistant";
import {Message} from "@/types/chat";
import {v4 as uuidv4} from 'uuid';
import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/assistant";
const SERVICE_NAME = "assistant";

const addData = (data: { [key: string]: any }) => {
    return (m: Message) => {
        return { ...m, data: { ...m.data, ...data } }
    };
}

const addDataToMessages = (messages: Message[], data: { [key: string]: any }) => {
    return messages.map((m) => {
        return { ...m, data: { ...m.data, ...data } }
    });
}

export const createAssistant = async (assistantDefinition: AssistantDefinition, abortSignal = null) => {
    if (!("disclaimer" in assistantDefinition)) assistantDefinition.disclaimer = '';
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/create",
        data: { ...assistantDefinition },
        service: SERVICE_NAME
    };

    if (assistantDefinition.provider === 'openai') {
        if (assistantDefinition.dataSources) {
            assistantDefinition.fileKeys = assistantDefinition.dataSources.map((ds) => ds.id);
        }

        const result = await doRequestOp(op);

        const id = result.data.assistantId;
        return {assistantId: id, id, provider: 'openai'};
    } else if (assistantDefinition.provider === AssistantProviderID.AMPLIFY) {

        try {
            const result = await doRequestOp(op);

            console.log("Create Assistant result:", result);

            return {
                id: result.data.id,
                assistantId: result.data.assistantId,
                provider: AssistantProviderID.AMPLIFY,
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
                provider: AssistantProviderID.AMPLIFY
            }

        }
    }

    return {
        assistantId: uuidv4(),
        provider: AssistantProviderID.AMPLIFY,
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
        service: SERVICE_NAME
    };
    const result = await doRequestOp(op);
    return result.success ? result.data : [];
}

export const deleteAssistant = async (assistantId: string) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/delete",
        data: { assistantId },
        service: SERVICE_NAME
    };
    const result = await doRequestOp(op);
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

/**
 * Adds a path to an assistant
 * @param assistantId The ID of the assistant
 * @param astPath The path to add to the assistant
 * @returns Success status and the updated assistant info
 */
export const addAssistantPath = async (assistantId: string, astPath: string) => {
  console.log(`Attempting to add path "${astPath}" to assistant "${assistantId}"`);
  try {
    // Make sure assistantId is in the correct format
    // The backend expects an assistantId with a prefix like "astp/"
    const formattedAssistantId = assistantId.startsWith('astp/') ? assistantId : assistantId;
    
    const op = {
      method: 'POST',
      path: URL_PATH,
      op: "/add_path",
      data: { 
        assistantId: formattedAssistantId, 
        astPath 
      }
    };
    
    console.log('Sending add_path request with payload:', JSON.stringify(op));
    const result = await doRequestOp(op);
    console.log('Add path API raw response:', JSON.stringify(result));
    
    // Check if the result is successful based on status code
    if (result.statusCode === 200) {
      // Handle the nested response structure
      let innerResponse;
      try {
        innerResponse = typeof result.body === 'string' 
          ? JSON.parse(result.body) 
          : result.body;
        
        console.log('Parsed inner response:', JSON.stringify(innerResponse));
        
        if (innerResponse && innerResponse.success) {
          console.log('Path successfully added to assistant in backend. The astPath should now be saved to both the lookup table and the assistant definition.');
          return {
            success: true,
            message: innerResponse.message || 'Path added successfully',
            data: innerResponse.data
          };
        } else {
          console.error('Backend reported failure:', innerResponse?.message || 'Unknown error');
          return {
            success: false,
            message: innerResponse?.message || 'Failed to add path to assistant'
          };
        }
      } catch (parseError) {
        console.error('Error parsing response body:', parseError, 'Raw body:', result.body);
        return {
          success: false,
          message: 'Error processing server response'
        };
      }
    } else {
      console.error(`API request failed with status: ${result.statusCode}, response:`, JSON.stringify(result));
      return {
        success: false,
        message: result.statusText || `Server returned error code: ${result.statusCode}`
      };
    }
  } catch (error) {
    console.error(`Error calling add_path API:`, error);
    return { 
      success: false, 
      message: `Error adding path: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
};
