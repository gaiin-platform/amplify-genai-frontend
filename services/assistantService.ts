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
            console.error("Failed to parse assistant data from response");
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
 * @param previousPath The previous path, if updating an existing path
 * @returns Success status and the updated assistant info
 */
export const addAssistantPath = async (assistantId: string, astPath: string, previousPath: string = "") => {
  try {
    // Make sure assistantId is in the correct format
    // The backend expects an assistantId with a prefix like "astp/"
    const formattedAssistantId = assistantId.startsWith('astp/') ? assistantId : assistantId;
    
    // Convert path to lowercase for consistency
    const lowerCasePath = astPath.toLowerCase();
    
    const op = {
      method: 'POST',
      path: URL_PATH,
      op: "/add_path",
      data: { 
        assistantId: formattedAssistantId, 
        astPath: lowerCasePath,
        previousPath: previousPath 
      },
      service: SERVICE_NAME
    };
    
    const result = await doRequestOp(op);
    
    // Check for API Gateway style response with statusCode and body
    let parsedResult = result;
    if (result.statusCode && result.body) {
      try {
        // If the body is a string, parse it
        const parsedBody = typeof result.body === 'string' 
          ? JSON.parse(result.body) 
          : result.body;
        
        parsedResult = parsedBody;
      } catch (parseError) {
        console.error('Error parsing response body:', parseError);
        return {
          success: false,
          message: 'Error processing server response'
        };
      }
    }
    
    // Now check if the parsed result is successful
    if (parsedResult.success) {
      return {
        success: true,
        message: parsedResult.message || 'Path added successfully',
        data: parsedResult.data
      };
    } else {
      console.error('Backend reported failure:', parsedResult.message || 'Unknown error');
      return {
        success: false,
        message: parsedResult.message || 'Failed to add path to assistant'
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

/**
 * Looks up an assistant by path
 * @param astPath The path to look up
 * @returns Success status and the assistant info if found
 */
export const lookupAssistant = async (astPath: string) => {
  try {
    // Convert path to lowercase for consistency
    const lowerCasePath = astPath.toLowerCase();
    
    const op = {
      method: 'POST',
      path: URL_PATH,
      op: "/lookup",
      data: { astPath: lowerCasePath },
      service: SERVICE_NAME
    };
    
    const result = await doRequestOp(op);
    
    // Handle nested response formats - API Gateway might be wrapping the response
    let actualResult = result;
    
    // Check if there's a statusCode and body - API Gateway format
    if (result.statusCode && result.body) {
      try {
        // Body might be a string that needs parsing
        const parsedBody = typeof result.body === 'string' ? JSON.parse(result.body) : result.body;
        actualResult = parsedBody;
      } catch (parseError) {
        console.error('Error parsing response body:', parseError);
      }
    }
    
    // Now check success on the actual result
    if (actualResult.success) {
      // Get the correct path - try top level first, then data, then pathFromDefinition
      const path = actualResult.data?.astPath || 
                   actualResult.data?.data?.astPath ||
                   actualResult.data?.pathFromDefinition;
      
      // Return all the data we have, including name and definition if available
      return {
        success: true,
        message: actualResult.message || 'Assistant found',
        assistantId: actualResult.data?.assistantId,
        astPath: path, // Use the derived path
        pathFromDefinition: actualResult.data?.pathFromDefinition,
        public: actualResult.data?.public || false,
        // Include these important fields if they exist
        name: actualResult.data?.name,
        definition: actualResult.data?.definition,
        // Pass along the entire data object for completeness
        data: actualResult.data
      };
    } else {
      return {
        success: false,
        message: actualResult.message || 'Assistant not found at this path'
      };
    }
  } catch (error) {
    console.error(`Error looking up assistant path:`, error);
    return { 
      success: false, 
      message: `Error looking up path: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
};
